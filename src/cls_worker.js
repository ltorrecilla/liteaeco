// ============================================================
// cls_worker.js - Clash narrowphase KERNEL + worker protocol (v9)
// ------------------------------------------------------------
// PURE module: no DOM, no window, no model handles, no fragments
// API. Everything crosses the boundary as plain data + typed
// arrays. That boundary is deliberate: the same message schema
// works over postMessage today and over a socket to a local
// helper or cloud service tomorrow.
//
// Message schema v3 (v2 + incremental meshes: uid keys, per-worker cache, cacheReset)
//   in : { type:"verify", schema:1, jobId, tolerance,
//          candidates:[{ idx, aKey, bKey, region|null, boxA|null, boxB|null }],
//          meshes: { uid: { tris:Float32Array, count:int } }   // ONLY meshes this worker lacks
//          }
//   out: { type:"result", schema:1, jobId,
//          verdicts:[{ idx, keep, method?, depth?, volume?,
//                      center?, box? }],
//          computeMs, cacheReset:boolean, cachedTris }
//   err: { type:"error", schema:1, jobId, error }
//
// Loaded three ways:
//   1. as a MODULE WORKER (self.onmessage registered below)
//   2. imported by cls_narrow.js for the single-thread path -
//      both paths run the exact same kernel, so results are
//      identical by construction
//   3. imported by node harnesses
// ============================================================

export const CLS_WORKER_SCHEMA = 6; // v6: depth = thickness of the overlap zone (fallbacks: deepest inside corner, cloud measure); v5: penetration kernel (real crossings only, corners counted only when clearly inside, 3-ray inside test, duplicates); v4: per-job relative transform (msg.transform, B -> A data space)

// ---------------------------------------------------------------
// transformed mesh views (schema 4). Repositioned models: the job
// carries T (16 floats, column-major, B data -> A data space). B meshes
// are cached untouched; a transformed COPY is cached beside them under
// bKey + "|T" + sig, so the kernel below never learns about transforms
// and the BVH of the view is built lazily exactly like any mesh. Views
// count toward the triangle budget and evict like meshes, but are never
// reported to the sender (they are worker-internal). Identity/absent
// transform = today's path, byte for byte.
// ---------------------------------------------------------------
export function transformTris(tris, count, m) {
  const out = new Float32Array(count * 9);
  const m0 = m[0], m1 = m[1], m2 = m[2], m4 = m[4], m5 = m[5], m6 = m[6];
  const m8 = m[8], m9 = m[9], m10 = m[10], m12 = m[12], m13 = m[13], m14 = m[14];
  for (let i = 0; i < count * 9; i += 3) {
    const x = tris[i], y = tris[i + 1], z = tris[i + 2];
    out[i] = m0 * x + m4 * y + m8 * z + m12;
    out[i + 1] = m1 * x + m5 * y + m9 * z + m13;
    out[i + 2] = m2 * x + m6 * y + m10 * z + m14;
  }
  return out;
}
export function transformedView(mesh, m) {
  return { tris: transformTris(mesh.tris, mesh.count, m), count: mesh.count };
}
export function meshBoxOf(mesh) {
  if (mesh.box) return mesh.box;
  const T = mesh.tris;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < mesh.count * 9; i += 3) {
    const x = T[i], y = T[i + 1], z = T[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  mesh.box = { min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } };
  return mesh.box;
}
const VIEW_TAG = "|T";
export function isViewKey(k) { return typeof k === "string" && k.includes(VIEW_TAG); }

// ---------------------------------------------------------------
// geometry predicates
// ---------------------------------------------------------------

// triangle-vs-AABB (Akenine-Möller, axis tests)
export function triIntersectsBox(tris, o, box, eps) {
  const cx = (box.min.x + box.max.x) / 2,
    cy = (box.min.y + box.max.y) / 2,
    cz = (box.min.z + box.max.z) / 2;
  const hx = (box.max.x - box.min.x) / 2 + eps,
    hy = (box.max.y - box.min.y) / 2 + eps,
    hz = (box.max.z - box.min.z) / 2 + eps;
  const v0x = tris[o] - cx, v0y = tris[o + 1] - cy, v0z = tris[o + 2] - cz;
  const v1x = tris[o + 3] - cx, v1y = tris[o + 4] - cy, v1z = tris[o + 5] - cz;
  const v2x = tris[o + 6] - cx, v2y = tris[o + 7] - cy, v2z = tris[o + 8] - cz;

  // AABB of tri vs box
  if (Math.min(v0x, v1x, v2x) > hx || Math.max(v0x, v1x, v2x) < -hx) return false;
  if (Math.min(v0y, v1y, v2y) > hy || Math.max(v0y, v1y, v2y) < -hy) return false;
  if (Math.min(v0z, v1z, v2z) > hz || Math.max(v0z, v1z, v2z) < -hz) return false;

  // plane of tri vs box
  const e0x = v1x - v0x, e0y = v1y - v0y, e0z = v1z - v0z;
  const e1x = v2x - v1x, e1y = v2y - v1y, e1z = v2z - v1z;
  const nx = e0y * e1z - e0z * e1y,
    ny = e0z * e1x - e0x * e1z,
    nz = e0x * e1y - e0y * e1x;
  const d = nx * v0x + ny * v0y + nz * v0z;
  const r = hx * Math.abs(nx) + hy * Math.abs(ny) + hz * Math.abs(nz);
  if (Math.abs(d) > r) return false;

  // 9 cross-axis tests
  const e2x = v0x - v2x, e2y = v0y - v2y, e2z = v0z - v2z;
  const edges = [
    [e0x, e0y, e0z],
    [e1x, e1y, e1z],
    [e2x, e2y, e2z],
  ];
  const verts = [
    [v0x, v0y, v0z],
    [v1x, v1y, v1z],
    [v2x, v2y, v2z],
  ];
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const e of edges) {
    for (const a of axes) {
      const ax = a[1] * e[2] - a[2] * e[1],
        ay = a[2] * e[0] - a[0] * e[2],
        az = a[0] * e[1] - a[1] * e[0];
      const len = Math.abs(ax) + Math.abs(ay) + Math.abs(az);
      if (len < 1e-12) continue;
      let mn = Infinity,
        mx = -Infinity;
      for (const v of verts) {
        const p = ax * v[0] + ay * v[1] + az * v[2];
        if (p < mn) mn = p;
        if (p > mx) mx = p;
      }
      const rr = hx * Math.abs(ax) + hy * Math.abs(ay) + hz * Math.abs(az);
      if (mn > rr || mx < -rr) return false;
    }
  }
  return true;
}

// tri-tri intersection (Möller interval method, no-div variant essentials)
export function triTriIntersect(A, ao, B, bo) {
  const p1 = [A[ao], A[ao + 1], A[ao + 2]];
  const q1 = [A[ao + 3], A[ao + 4], A[ao + 5]];
  const r1 = [A[ao + 6], A[ao + 7], A[ao + 8]];
  const p2 = [B[bo], B[bo + 1], B[bo + 2]];
  const q2 = [B[bo + 3], B[bo + 4], B[bo + 5]];
  const r2 = [B[bo + 6], B[bo + 7], B[bo + 8]];

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const n2 = cross(sub(q2, p2), sub(r2, p2));
  let dp1 = dot(n2, sub(p1, p2));
  let dq1 = dot(n2, sub(q1, p2));
  let dr1 = dot(n2, sub(r1, p2));
  if (dp1 > 0 && dq1 > 0 && dr1 > 0) return false;
  if (dp1 < 0 && dq1 < 0 && dr1 < 0) return false;

  const n1 = cross(sub(q1, p1), sub(r1, p1));
  let dp2 = dot(n1, sub(p2, p1));
  let dq2 = dot(n1, sub(q2, p1));
  let dr2 = dot(n1, sub(r2, p1));
  if (dp2 > 0 && dq2 > 0 && dr2 > 0) return false;
  if (dp2 < 0 && dq2 < 0 && dr2 < 0) return false;

  // coplanar handling: project on dominant axis of n1 and do 2D overlap
  const EPS = 1e-12;
  if (
    Math.abs(dp2) < EPS && Math.abs(dq2) < EPS && Math.abs(dr2) < EPS
  ) {
    const ax = Math.abs(n1[0]), ay = Math.abs(n1[1]), az = Math.abs(n1[2]);
    let i0 = 0, i1 = 1;
    if (ax >= ay && ax >= az) { i0 = 1; i1 = 2; }
    else if (ay >= az) { i0 = 0; i1 = 2; }
    const t1 = [p1, q1, r1].map((v) => [v[i0], v[i1]]);
    const t2 = [p2, q2, r2].map((v) => [v[i0], v[i1]]);
    return tri2dOverlap(t1, t2);
  }

  // interval test along the intersection line of the two planes
  const D = cross(n1, n2);
  const proj = (v) => dot(D, v);
  const int1 = planeIntervals(proj, p1, q1, r1, dp1, dq1, dr1);
  const int2 = planeIntervals(proj, p2, q2, r2, dp2, dq2, dr2);
  if (!int1 || !int2) return false;
  return Math.max(int1[0], int2[0]) <= Math.min(int1[1], int2[1]);
}

function planeIntervals(proj, a, b, c, da, db, dc) {
  // order so that one vertex is on the opposite side of the other two
  const verts = [a, b, c];
  const dist = [da, db, dc];
  let solo = -1;
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3,
      k = (i + 2) % 3;
    if (dist[i] * dist[j] <= 0 && dist[i] * dist[k] <= 0 && (dist[j] !== 0 || dist[k] !== 0)) {
      solo = i;
      break;
    }
  }
  if (solo < 0) solo = 0;
  const i = solo,
    j = (solo + 1) % 3,
    k = (solo + 2) % 3;
  const pi = proj(verts[i]),
    pj = proj(verts[j]),
    pk = proj(verts[k]);
  const dj = dist[i] - dist[j] || 1e-30;
  const dk = dist[i] - dist[k] || 1e-30;
  const t1 = pi + ((pj - pi) * dist[i]) / dj;
  const t2 = pi + ((pk - pi) * dist[i]) / dk;
  return t1 <= t2 ? [t1, t2] : [t2, t1];
}

function tri2dOverlap(t1, t2) {
  // SAT in 2D over both triangles' edges
  const tris = [t1, t2];
  for (const t of tris) {
    for (let i = 0; i < 3; i++) {
      const a = t[i],
        b = t[(i + 1) % 3];
      const nx = -(b[1] - a[1]),
        ny = b[0] - a[0];
      let min1 = Infinity, max1 = -Infinity, min2 = Infinity, max2 = -Infinity;
      for (const v of t1) {
        const p = nx * v[0] + ny * v[1];
        if (p < min1) min1 = p;
        if (p > max1) max1 = p;
      }
      for (const v of t2) {
        const p = nx * v[0] + ny * v[1];
        if (p < min2) min2 = p;
        if (p > max2) max2 = p;
      }
      if (max1 < min2 || max2 < min1) return false;
    }
  }
  return true;
}

// segment (p->q) vs triangle: returns intersection point or null
function segTri(px, py, pz, qx, qy, qz, T, o) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
  const e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
  const dx = qx - px, dy = qy - py, dz = qz - pz;
  const hx = dy * e2z - dz * e2y,
    hy = dz * e2x - dx * e2z,
    hz = dx * e2y - dy * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-14) return null;
  const inv = 1 / det;
  const sx = px - ax, sy = py - ay, sz = pz - az;
  const u = (sx * hx + sy * hy + sz * hz) * inv;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const qxv = sy * e1z - sz * e1y,
    qyv = sz * e1x - sx * e1z,
    qzv = sx * e1y - sy * e1x;
  const v = (dx * qxv + dy * qyv + dz * qzv) * inv;
  if (v < -1e-9 || u + v > 1 + 1e-9) return null;
  const t = (e2x * qxv + e2y * qyv + e2z * qzv) * inv;
  if (t < -1e-9 || t > 1 + 1e-9) return null;
  return [px + dx * t, py + dy * t, pz + dz * t];
}

function triNormal(T, o, out) {
  const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
  const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
  const nx = e1y * e2z - e1z * e2y,
    ny = e1z * e2x - e1x * e2z,
    nz = e1x * e2y - e1y * e2x;
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-12) return;
  const v = [nx / l, ny / l, nz / l];
  // dedupe (direction-insensitive)
  for (const u of out) {
    if (Math.abs(u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) > 0.999) return;
  }
  if (out.length < 8) out.push(v);
}

// all edge-vs-triangle intersection points between two triangles
function triTriPoints(A, ao, B, bo, out) {
  for (let e = 0; e < 3; e++) {
    const p = (e * 3), q = (((e + 1) % 3) * 3);
    let pt = segTri(A[ao + p], A[ao + p + 1], A[ao + p + 2], A[ao + q], A[ao + q + 1], A[ao + q + 2], B, bo);
    if (pt) out.push(pt);
    pt = segTri(B[bo + p], B[bo + p + 1], B[bo + p + 2], B[bo + q], B[bo + q + 1], B[bo + q + 2], A, ao);
    if (pt) out.push(pt);
  }
}

// point-in-mesh by ray parity along +X against ALL triangles of the mesh.
// v8: optional cached boxes gate each triangle (5 loads) before the ray
// math; skipped triangles are exactly those the ray cannot hit, so the
// crossing count is unchanged.
// +X ray from (px,py,pz) vs triangle t: 1 when the ray crosses it
// (Möller-Trumbore with dir (1,0,0)); shared by the linear and BVH
// point-in-mesh paths so both count crossings identically
function rayXHitsTri(px, py, pz, tris, o) {
  const ax = tris[o] - px, ay = tris[o + 1] - py, az = tris[o + 2] - pz;
  const bx = tris[o + 3] - px, by = tris[o + 4] - py, bz = tris[o + 5] - pz;
  const cx = tris[o + 6] - px, cy = tris[o + 7] - py, cz = tris[o + 8] - pz;
  if (ax < 0 && bx < 0 && cx < 0) return 0;
  if ((ay > 0 && by > 0 && cy > 0) || (ay < 0 && by < 0 && cy < 0)) return 0;
  if ((az > 0 && bz > 0 && cz > 0) || (az < 0 && bz < 0 && cz < 0)) return 0;
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const det = e1z * e2y - e1y * e2z;
  if (Math.abs(det) < 1e-14) return 0;
  const inv = 1 / det;
  const u = (ay * e2z - az * e2y) * inv;
  if (u < 0 || u > 1) return 0;
  const qx = -ay * e1z + az * e1y;
  const qy = -az * e1x + ax * e1z;
  const qz = -ax * e1y + ay * e1x;
  const v = qx * inv;
  if (v < 0 || u + v > 1) return 0;
  const tHit = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return tHit > 1e-12 ? 1 : 0;
}

// point-in-mesh by ray parity along +X. Linear scan; kept as the
// reference implementation (harness cross-checks the BVH path).
export function pointInMeshLinear(px, py, pz, tris, count, boxes) {
  let crossings = 0;
  for (let t = 0; t < count; t++) {
    if (boxes) {
      const w = t * 6;
      if (boxes[w + 3] < px) continue;
      if (boxes[w + 1] > py || boxes[w + 4] < py) continue;
      if (boxes[w + 2] > pz || boxes[w + 5] < pz) continue;
    }
    crossings += rayXHitsTri(px, py, pz, tris, t * 9);
  }
  return crossings % 2 === 1;
}

// BVH point-in-mesh: visits only nodes the +X ray can pass through
function pointInMeshBVH(px, py, pz, mesh) {
  const bvh = bvhOf(mesh);
  const nb = bvh.bounds, T = mesh.tris, idx = bvh.index;
  let crossings = 0;
  const stack = [0];
  while (stack.length) {
    const n = stack.pop();
    const o = n * 6;
    if (nb[o + 3] < px) continue;
    if (nb[o + 1] > py || nb[o + 4] < py) continue;
    if (nb[o + 2] > pz || nb[o + 5] < pz) continue;
    const cnt = bvh.count[n];
    if (cnt > 0) {
      const st = bvh.start[n];
      for (let k = st; k < st + cnt; k++) crossings += rayXHitsTri(px, py, pz, T, idx[k] * 9);
    } else {
      stack.push(bvh.left[n], bvh.right[n]);
    }
  }
  return crossings % 2 === 1;
}

// per-mesh triangle AABBs, computed ONCE per mesh on first use and
// cached on the mesh entry (QW2). An element in fifty candidate pairs
// used to rebuild its boxes fifty times. Flat layout:
// [minx,miny,minz,maxx,maxy,maxz] per triangle, unpadded - callers
// apply tolerance at compare time.
export function boxesOf(mesh) {
  if (mesh.boxes) return mesh.boxes;
  const n = mesh.count;
  const T = mesh.tris;
  const out = new Float32Array(n * 6);
  for (let t = 0; t < n; t++) {
    const o = t * 9, w = t * 6;
    const x0 = T[o], x1 = T[o + 3], x2 = T[o + 6];
    const y0 = T[o + 1], y1 = T[o + 4], y2 = T[o + 7];
    const z0 = T[o + 2], z1 = T[o + 5], z2 = T[o + 8];
    out[w] = Math.min(x0, x1, x2);
    out[w + 1] = Math.min(y0, y1, y2);
    out[w + 2] = Math.min(z0, z1, z2);
    out[w + 3] = Math.max(x0, x1, x2);
    out[w + 4] = Math.max(y0, y1, y2);
    out[w + 5] = Math.max(z0, z1, z2);
  }
  mesh.boxes = out;
  return out;
}

// ---------------------------------------------------------------
// per-mesh BVH (v10). Flat arrays, built ONCE per mesh on first use
// and cached beside the triangles (workers build their own copy
// lazily; the mesh cache on the main thread keeps its own). Median
// split on the largest extent, leaf size 8. Every query below is a
// pure pruning of the v9 linear scans: identical results, only the
// triangles that CAN matter are visited.
// ---------------------------------------------------------------
const BVH_LEAF = 8;
export function bvhOf(mesh) {
  if (mesh.bvh) return mesh.bvh;
  const n = mesh.count;
  const bx = boxesOf(mesh);
  const index = new Int32Array(n);
  for (let i = 0; i < n; i++) index[i] = i;
  const cx = new Float32Array(n), cy = new Float32Array(n), cz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    cx[i] = (bx[o] + bx[o + 3]) * 0.5;
    cy[i] = (bx[o + 1] + bx[o + 4]) * 0.5;
    cz[i] = (bx[o + 2] + bx[o + 5]) * 0.5;
  }
  const cap = Math.max(4, Math.ceil(n / BVH_LEAF) * 4 + 8);
  const bounds = new Float32Array(cap * 6);
  const left = new Int32Array(cap), right = new Int32Array(cap);
  const start = new Int32Array(cap), count = new Int32Array(cap);
  let nodes = 0;
  // typed work stack: [node, lo, hi] triples (v11.1: no per-node arrays)
  const work = new Int32Array(3 * (2 * Math.ceil(Math.log2(Math.max(2, n))) + 64));
  let wp = 0;
  const root = nodes++;
  work[wp++] = root; work[wp++] = 0; work[wp++] = n;
  while (wp > 0) {
    const hi = work[--wp], lo = work[--wp], node = work[--wp];
    // one pass: node bounds AND centroid bounds (split axis by centroid
    // spread: big flat walls otherwise degenerate into overlapping siblings)
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
    for (let k = lo; k < hi; k++) {
      const i = index[k], o = i * 6;
      const a = bx[o], b = bx[o + 1], c = bx[o + 2], d = bx[o + 3], e = bx[o + 4], f = bx[o + 5];
      if (a < x0) x0 = a; if (b < y0) y0 = b; if (c < z0) z0 = c;
      if (d > x1) x1 = d; if (e > y1) y1 = e; if (f > z1) z1 = f;
      const px = cx[i], py = cy[i], pz = cz[i];
      if (px < cx0) cx0 = px; if (px > cx1) cx1 = px;
      if (py < cy0) cy0 = py; if (py > cy1) cy1 = py;
      if (pz < cz0) cz0 = pz; if (pz > cz1) cz1 = pz;
    }
    const ob = node * 6;
    bounds[ob] = x0; bounds[ob + 1] = y0; bounds[ob + 2] = z0;
    bounds[ob + 3] = x1; bounds[ob + 4] = y1; bounds[ob + 5] = z1;
    const cnt = hi - lo;
    if (cnt <= BVH_LEAF) { start[node] = lo; count[node] = cnt; continue; }
    const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0;
    const axisArr = ex >= ey && ex >= ez ? cx : ey >= ez ? cy : cz;
    const mid = (lo + hi) >> 1;
    // nth_element (quickselect) on index[lo..hi) by axisArr
    let l = lo, r = hi - 1;
    while (l < r) {
      const pivot = axisArr[index[(l + r) >> 1]];
      let i = l, j = r;
      while (i <= j) {
        while (axisArr[index[i]] < pivot) i++;
        while (axisArr[index[j]] > pivot) j--;
        if (i <= j) { const t = index[i]; index[i] = index[j]; index[j] = t; i++; j--; }
      }
      if (mid <= j) r = j; else if (mid >= i) l = i; else break;
    }
    if (mid === lo || mid === hi) { start[node] = lo; count[node] = cnt; continue; }
    const L = nodes++, R = nodes++;
    left[node] = L; right[node] = R; count[node] = 0;
    work[wp++] = L; work[wp++] = lo; work[wp++] = mid;
    work[wp++] = R; work[wp++] = mid; work[wp++] = hi;
  }
  mesh.bvh = { bounds, left, right, start, count, index, nodes };
  return mesh.bvh;
}

// triangles whose (unpadded) box overlaps the padded query box.
// Callers still run the exact triIntersectsBox on the survivors, so
// this is a strict superset filter (same as the v9 linear scan).
function bvhQueryBox(mesh, x0, y0, z0, x1, y1, z1, out) {
  const bvh = bvhOf(mesh);
  const nb = bvh.bounds, bx = boxesOf(mesh), idx = bvh.index;
  const stack = [0];
  while (stack.length) {
    const n = stack.pop();
    const o = n * 6;
    if (nb[o] > x1 || nb[o + 3] < x0 || nb[o + 1] > y1 || nb[o + 4] < y0 || nb[o + 2] > z1 || nb[o + 5] < z0) continue;
    const cnt = bvh.count[n];
    if (cnt > 0) {
      const st = bvh.start[n];
      for (let k = st; k < st + cnt; k++) {
        const t = idx[k], w = t * 6;
        if (bx[w] > x1 || bx[w + 3] < x0 || bx[w + 1] > y1 || bx[w + 4] < y0 || bx[w + 2] > z1 || bx[w + 5] < z0) continue;
        out.push(t);
      }
    } else {
      stack.push(bvh.left[n], bvh.right[n]);
    }
  }
}

// ---------------------------------------------------------------
// v15 penetration helpers (industry definition: a clash = one element
// goes INTO the other by more than the tolerance; touching never counts)
// ---------------------------------------------------------------
const XEPS = 1e-5; // m: a crossing must pass a plane by more than this, both sides
const SURF_EPS = 5e-4; // m: a corner is "inside" only deeper than this
const DUP_EPS = 1e-3; // m: same box within this = duplicate candidate
const CONTAIN_PROBES = 5; // corners tested for full containment

// proper crossing: each triangle straddles the other's plane by > eps
// (metric distances), then the exact interval test. Coplanar faces and
// a vertex / edge resting on a face are touching, not crossing.
export function triTriCross(A, ao, B, bo, eps) {
  const side = (T, o, U, u) => {
    const ux = U[u + 3] - U[u], uy = U[u + 4] - U[u + 1], uz = U[u + 5] - U[u + 2];
    const vx = U[u + 6] - U[u], vy = U[u + 7] - U[u + 1], vz = U[u + 8] - U[u + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 0)) return false;
    nx /= len; ny /= len; nz /= len;
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < 9; k += 3) {
      const d = nx * (T[o + k] - U[u]) + ny * (T[o + k + 1] - U[u + 1]) + nz * (T[o + k + 2] - U[u + 2]);
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    return mn < -eps && mx > eps;
  };
  if (!side(A, ao, B, bo) || !side(B, bo, A, ao)) return false;
  return triTriIntersect(A, ao, B, bo);
}

// ray parity along any direction (Möller-Trumbore), BVH slab-culled
function rayDirHitsTri(px, py, pz, dx, dy, dz, T, o) {
  const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2];
  const e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const a = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(a) < 1e-18) return 0;
  const f = 1 / a;
  const sx = px - T[o], sy = py - T[o + 1], sz = pz - T[o + 2];
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return 0;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = f * (dx * qx + dy * qy + dz * qz);
  if (v < 0 || u + v > 1) return 0;
  return f * (e2x * qx + e2y * qy + e2z * qz) > 1e-12 ? 1 : 0;
}
function pointInMeshDir(px, py, pz, mesh, dx, dy, dz) {
  const bvh = bvhOf(mesh);
  const nb = bvh.bounds, T = mesh.tris, idx = bvh.index;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let crossings = 0;
  const stack = [0];
  while (stack.length) {
    const n = stack.pop();
    const o = n * 6;
    let t0x = (nb[o] - px) * ix, t1x = (nb[o + 3] - px) * ix;
    if (t0x > t1x) { const s = t0x; t0x = t1x; t1x = s; }
    let t0y = (nb[o + 1] - py) * iy, t1y = (nb[o + 4] - py) * iy;
    if (t0y > t1y) { const s = t0y; t0y = t1y; t1y = s; }
    let t0z = (nb[o + 2] - pz) * iz, t1z = (nb[o + 5] - pz) * iz;
    if (t0z > t1z) { const s = t0z; t0z = t1z; t1z = s; }
    const tmin = Math.max(t0x, t0y, t0z), tmax = Math.min(t1x, t1y, t1z);
    if (tmax < 0 || tmin > tmax) continue;
    const cnt = bvh.count[n];
    if (cnt > 0) {
      const st = bvh.start[n];
      for (let k = st; k < st + cnt; k++) crossings += rayDirHitsTri(px, py, pz, dx, dy, dz, T, idx[k] * 9);
    } else {
      stack.push(bvh.left[n], bvh.right[n]);
    }
  }
  return crossings % 2 === 1;
}
// two generic directions (no axis, no diagonal: edges and seams are
// practically never hit exactly)
const RAY2 = (() => { const v = [-0.3127, 0.8813, 0.3542], l = Math.hypot(...v); return v.map((x) => x / l); })();
const RAY3 = (() => { const v = [0.2671, -0.3359, -0.9032], l = Math.hypot(...v); return v.map((x) => x / l); })();
// inside by majority of 3 rays: one gap in a not-closed export mesh
// flips one ray, not two
function insideRobust(x, y, z, mesh) {
  const r1 = pointInMeshBVH(x + JX, y + JY, z + JZ, mesh);
  const r2 = pointInMeshDir(x, y, z, mesh, RAY2[0], RAY2[1], RAY2[2]);
  if (r1 === r2) return r1;
  return pointInMeshDir(x, y, z, mesh, RAY3[0], RAY3[1], RAY3[2]);
}

// squared distance point -> triangle (Ericson, closest point on triangle)
function pointTriDist2(px, py, pz, T, o) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const abx = T[o + 3] - ax, aby = T[o + 4] - ay, abz = T[o + 5] - az;
  const acx = T[o + 6] - ax, acy = T[o + 7] - ay, acz = T[o + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let cx, cy, cz;
  if (d1 <= 0 && d2 <= 0) { cx = ax; cy = ay; cz = az; }
  else {
    const bpx = px - T[o + 3], bpy = py - T[o + 4], bpz = pz - T[o + 5];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { cx = T[o + 3]; cy = T[o + 4]; cz = T[o + 5]; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3);
        cx = ax + v * abx; cy = ay + v * aby; cz = az + v * abz;
      } else {
        const cpx = px - T[o + 6], cpy = py - T[o + 7], cpz = pz - T[o + 8];
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { cx = T[o + 6]; cy = T[o + 7]; cz = T[o + 8]; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const w = d2 / (d2 - d6);
            cx = ax + w * acx; cy = ay + w * acy; cz = az + w * acz;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
              cx = T[o + 3] + w * (T[o + 6] - T[o + 3]); cy = T[o + 4] + w * (T[o + 7] - T[o + 4]); cz = T[o + 5] + w * (T[o + 8] - T[o + 5]);
            } else {
              const den = 1 / (va + vb + vc);
              const v = vb * den, w = vc * den;
              cx = ax + abx * v + acx * w; cy = ay + aby * v + acy * w; cz = az + abz * v + acz * w;
            }
          }
        }
      }
    }
  }
  const ex = px - cx, ey = py - cy, ez = pz - cz;
  return ex * ex + ey * ey + ez * ez;
}
// distance point -> mesh surface, BVH best-first pruning
export function distToMesh(px, py, pz, mesh) {
  const bvh = bvhOf(mesh);
  const nb = bvh.bounds, T = mesh.tris, idx = bvh.index;
  let best = Infinity;
  const stack = [0];
  while (stack.length) {
    const n = stack.pop();
    const o = n * 6;
    const qx = px < nb[o] ? nb[o] - px : px > nb[o + 3] ? px - nb[o + 3] : 0;
    const qy = py < nb[o + 1] ? nb[o + 1] - py : py > nb[o + 4] ? py - nb[o + 4] : 0;
    const qz = pz < nb[o + 2] ? nb[o + 2] - pz : pz > nb[o + 5] ? pz - nb[o + 5] : 0;
    if (qx * qx + qy * qy + qz * qz >= best) continue;
    const cnt = bvh.count[n];
    if (cnt > 0) {
      const st = bvh.start[n];
      for (let k = st; k < st + cnt; k++) {
        const d2 = pointTriDist2(px, py, pz, T, idx[k] * 9);
        if (d2 < best) best = d2;
      }
    } else {
      stack.push(bvh.left[n], bvh.right[n]);
    }
  }
  return Math.sqrt(best);
}
// how deep a point sits inside a mesh (0 = outside)
export function insideBy(x, y, z, mesh) {
  if (!insideRobust(x, y, z, mesh)) return 0;
  return distToMesh(x, y, z, mesh);
}

// Thickness of the zone where A and B overlap (v15.1): twice the largest
// distance, from a point inside BOTH, to the nearer of the two surfaces.
// Test points: the middle of the cloud, and midpoints between cloud
// points (crossing outlines + corners inside) - those land inside the
// overlap from wall to wall. Fixed pseudo-random pairs: same answer on
// every run. A sample can only find a thinner zone, never a thicker one.
const MID_PAIRS = 120;
const MID_CENTRE = 30;
export function overlapThickness(pts, A, B) {
  const n = pts.length;
  if (!n) return 0;
  let best = 0, bx = 0, by = 0, bz = 0;
  const test = (x, y, z) => {
    if (!insideRobust(x, y, z, A) || !insideRobust(x, y, z, B)) return false;
    const dA = distToMesh(x, y, z, A);
    if (dA <= best) return false;
    const d = Math.min(dA, distToMesh(x, y, z, B));
    if (d > best) { best = d; bx = x; by = y; bz = z; return true; }
    return false;
  };
  let cx = 0, cy = 0, cz = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
  cx /= n; cy /= n; cz /= n;
  test(cx, cy, cz);
  const stepC = Math.max(1, Math.floor(n / MID_CENTRE));
  for (let i = 0; i < n; i += stepC) {
    const p = pts[i];
    test((p[0] + cx) / 2, (p[1] + cy) / 2, (p[2] + cz) / 2);
  }
  if (n > 1) {
    let seed = 0x9e3779b9;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const pairs = Math.min(MID_PAIRS, (n * (n - 1)) / 2);
    for (let k = 0; k < pairs; k++) {
      const p = pts[Math.floor(rnd() * n)], q = pts[Math.floor(rnd() * n)];
      if (p === q) continue;
      test((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
    }
  }
  // refine: step from the best point along the 6 axis directions while it
  // improves, halving the step (the zone's middle, not just near it)
  if (best > 0) {
    let step = best;
    for (let round = 0; round < 12 && step > 2e-4; round++) {
      const x = bx, y = by, z = bz;
      const moved = test(x + step, y, z) || test(x - step, y, z) || test(x, y + step, z) ||
        test(x, y - step, z) || test(x, y, z + step) || test(x, y, z - step);
      if (!moved) step /= 2;
    }
  }
  return 2 * best;
}

// ---------------------------------------------------------------
// per-candidate verification kernel. c: { region } (plain box or
// null); A/B: { tris:Float32Array, count } meshes. Returns a plain
// verdict - the caller decides how to apply it. Mirrors the v8
// single-thread block exactly (hybrid region filter, cached-box
// pre-cull, jittered+box-gated parity ray, 400-pair cloud cap).
// ---------------------------------------------------------------
// per-job kernel profile (v10.3): where the compute goes. Phases:
// region (BVH region filter), probe (tree-vs-tree tri-tri), sample
// (parity-ray cloud), depth (normal projections). Counters: hits
// tested and list sizes, to relate time to geometry density.
export const KPROF = { regionMs: 0, probeMs: 0, sampleMs: 0, depthMs: 0, cands: 0, contacts: 0, sampled: 0, rays1: 0, triTests: 0, listA: 0, listB: 0 };
// per-mesh attribution (v11.1): time per A key so the log can NAME the
// meshes that eat the run instead of guessing about them
export const KMESH = new Map(); // aKey -> { ms, cands, tris }
export function resetKernelProfile() { for (const k of Object.keys(KPROF)) KPROF[k] = 0; KMESH.clear(); }
const _now = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
// parity-ray jitter: ASYMMETRIC on purpose. Equal offsets on y and z
// keep a cube-corner ray exactly on the y=z face diagonal of the other
// mesh (both triangles or neither count the crossing -> wrong parity).
// Distinct sub-micrometer offsets make the ray generic; stored cloud
// points stay exact.
const JX = 7e-7, JY = 3.1e-7, JZ = 1.3e-7;

export function verifyCandidate(c, A, B, tolerance) {
  const EPS = Math.max(1e-4, tolerance * 0.1);
  const region = c.region && c.region.min ? c.region : null;
  KPROF.cands++;
  let _t = _now();

  // ---- region filter via BVH: only triangles near the box-overlap
  // region participate. Same survivors as the v9 linear scan
  // (BVH box test is a superset filter; exact tri-box test follows).
  const listA = [], listB = [];
  if (region) {
    const rx0 = region.min.x - EPS, ry0 = region.min.y - EPS, rz0 = region.min.z - EPS;
    const rx1 = region.max.x + EPS, ry1 = region.max.y + EPS, rz1 = region.max.z + EPS;
    const candA = [], candB = [];
    bvhQueryBox(A, rx0, ry0, rz0, rx1, ry1, rz1, candA);
    bvhQueryBox(B, rx0, ry0, rz0, rx1, ry1, rz1, candB);
    for (let k = 0; k < candA.length; k++) if (triIntersectsBox(A.tris, candA[k] * 9, region, EPS)) listA.push(candA[k]);
    for (let k = 0; k < candB.length; k++) if (triIntersectsBox(B.tris, candB[k] * 9, region, EPS)) listB.push(candB[k]);
  }
  {
    const dt = _now() - _t;
    KPROF.regionMs += dt; _t = _now();
    KPROF.listA += listA.length; KPROF.listB += listB.length;
    const key = c.aKey || "A";
    let e = KMESH.get(key);
    if (!e) { e = { ms: 0, cands: 0, tris: A.count, bTris: 0 }; KMESH.set(key, e); }
    e.ms += dt; e.cands++; e.bTris += B.count;
  }

  // ---- contact = REAL crossings only (v15). Two triangles count when
  // each passes through the other's plane by more than XEPS on both
  // sides. Faces lying on each other (flush fits, face-to-face) and
  // edges resting on a face do not count: touching is not a clash.
  let contact = false;
  const surfacePts = [];
  const dirs = [];
  if (listA.length && listB.length) {
    const bA = boxesOf(A), bB = boxesOf(B);
    let pairsHit = 0;
    const hits = [];
    // pick the smaller list as the probe side to keep tree walks few
    const probeIsB = listB.length <= listA.length;
    const probe = probeIsB ? listB : listA;
    const other = probeIsB ? A : B;
    const pb = probeIsB ? bB : bA;
    outer: for (let ip = 0; ip < probe.length; ip++) {
      const tp = probe[ip], op = tp * 6;
      hits.length = 0;
      bvhQueryBox(other, pb[op] - EPS, pb[op + 1] - EPS, pb[op + 2] - EPS, pb[op + 3] + EPS, pb[op + 4] + EPS, pb[op + 5] + EPS, hits);
      for (let k = 0; k < hits.length; k++) {
        const to = hits[k];
        const ta = probeIsB ? to : tp, tb = probeIsB ? tp : to;
        KPROF.triTests++;
        if (triTriCross(A.tris, ta * 9, B.tris, tb * 9, XEPS)) {
          contact = true;
          triTriPoints(A.tris, ta * 9, B.tris, tb * 9, surfacePts);
          triNormal(A.tris, ta * 9, dirs);
          triNormal(B.tris, tb * 9, dirs);
          if (++pairsHit >= 400) break outer;
        }
      }
    }
  }

  {
    const dt = _now() - _t;
    KPROF.probeMs += dt; _t = _now();
    const e = KMESH.get(c.aKey || "A"); if (e) e.ms += dt;
  }
  if (contact) KPROF.contacts++;

  // cloud: crossing points + corners CLEARLY inside the other element
  // (more than SURF_EPS from its surface; a corner lying on a face is
  // not inside, whatever the rounding says)
  const cloud = { pts: [], minx: Infinity, miny: Infinity, minz: Infinity, maxx: -Infinity, maxy: -Infinity, maxz: -Infinity, n: 0 };
  const addPt = (x, y, z) => {
    if (x < cloud.minx) cloud.minx = x;
    if (x > cloud.maxx) cloud.maxx = x;
    if (y < cloud.miny) cloud.miny = y;
    if (y > cloud.maxy) cloud.maxy = y;
    if (z < cloud.minz) cloud.minz = z;
    if (z > cloud.maxz) cloud.maxz = z;
    if (cloud.pts.length < 800) cloud.pts.push([x, y, z]);
    cloud.n++;
  };
  // deepest corner: how far it sits inside the other element (v15.1)
  let maxIn = 0;
  const sample = (mesh, tlist, other, cap) => {
    const step = Math.max(1, Math.floor((tlist.length * 3) / cap));
    let s = 0;
    for (const t of tlist) {
      const o = t * 9;
      for (let v = 0; v < 3; v++) {
        if (s++ % step) continue;
        const x = mesh.tris[o + v * 3], y = mesh.tris[o + v * 3 + 1], z = mesh.tris[o + v * 3 + 2];
        const d = insideBy(x, y, z, other);
        if (d > SURF_EPS) {
          addPt(x, y, z);
          if (d > maxIn) maxIn = d;
        }
      }
    }
  };

  if (contact) {
    for (const p of surfacePts) addPt(p[0], p[1], p[2]);
    sample(A, listA, B, 200);
    sample(B, listB, A, 200);
    KPROF.sampled++;
  } else {
    // No crossing: apart, or one element entirely inside the other
    // (closed meshes). Containment needs one box inside the other.
    const bInA = c.boxA && c.boxB ? boxInside(c.boxB, c.boxA, EPS) : true;
    const aInB = c.boxA && c.boxB ? boxInside(c.boxA, c.boxB, EPS) : true;
    if (!bInA && !aInB) return { keep: false };
    // duplicates: same box within DUP_EPS and nothing crossing (identical
    // shapes share every face, so neither rule above sees them)
    if (c.boxA && c.boxB && boxInside(c.boxA, c.boxB, DUP_EPS) && boxInside(c.boxB, c.boxA, DUP_EPS)) {
      const b = c.boxA;
      const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
      const depth = Math.min(dx, dy, dz);
      if (depth < tolerance || !(listA.length && listB.length)) return { keep: false };
      return {
        keep: true, method: "tri", depth, volume: dx * dy * dz, duplicate: true,
        center: [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2],
        box: { min: { ...b.min }, max: { ...b.max } },
      };
    }
    // the inner one: up to CONTAIN_PROBES spread corners, ALL clearly inside
    const inner = bInA ? B : A, outerMesh = bInA ? A : B;
    const nv = inner.count * 3;
    const probes = Math.min(CONTAIN_PROBES, nv);
    const stepV = Math.max(1, Math.floor(nv / probes));
    let inside = probes > 0;
    for (let i = 0, k = 0; k < probes && i < nv; i += stepV, k++) {
      const o = i * 3;
      KPROF.rays1++;
      if (insideBy(inner.tris[o], inner.tris[o + 1], inner.tris[o + 2], outerMesh) <= SURF_EPS) { inside = false; break; }
    }
    if (!inside) return { keep: false };
    const all = [...Array(Math.min(inner.count, 400)).keys()];
    sample(inner, all, outerMesh, 200);
    KPROF.sampled++;
    if (!cloud.n) return { keep: false };
  }
  {
    const dt = _now() - _t;
    KPROF.sampleMs += dt; _t = _now();
    const e = KMESH.get(c.aKey || "A"); if (e) e.ms += dt;
  }

  if (cloud.n > 0) {
    const dx = Math.max(0, cloud.maxx - cloud.minx);
    const dy = Math.max(0, cloud.maxy - cloud.miny);
    const dz = Math.max(0, cloud.maxz - cloud.minz);
    // Depth (v15.1) = thickness of the overlap zone. The thinnest
    // direction of the point cloud read an L-shaped overlap (an element
    // pushed a few mm into two walls of a recess) as the element's full
    // size; the deepest corner alone under-read a duct through a wall
    // whose face has a corner point near the duct's edge. Fallbacks when
    // no test point lands inside both: deepest corner, then the cloud.
    let depth = overlapThickness(cloud.pts, A, B);
    if (!(depth > 0) && maxIn > 0) depth = maxIn;
    if (!(depth > 0)) {
      depth = Math.min(dx, dy, dz);
      for (const dvec of dirs) {
        let mn = Infinity, mx = -Infinity;
        for (const p of cloud.pts) {
          const s = p[0] * dvec[0] + p[1] * dvec[1] + p[2] * dvec[2];
          if (s < mn) mn = s;
          if (s > mx) mx = s;
        }
        if (mx - mn < depth) depth = mx - mn;
      }
    }
    KPROF.depthMs += _now() - _t;
    if (depth < tolerance) return { keep: false }; // sub-tolerance penetration
    return {
      keep: true,
      method: "tri",
      depth,
      volume: dx * dy * dz,
      center: [(cloud.minx + cloud.maxx) / 2, (cloud.miny + cloud.maxy) / 2, (cloud.minz + cloud.maxz) / 2],
      box: { min: { x: cloud.minx, y: cloud.miny, z: cloud.minz }, max: { x: cloud.maxx, y: cloud.maxy, z: cloud.maxz } },
    };
  }
  return { keep: false };
}

// box a inside box b (with slack)
function boxInside(a, b, eps) {
  return a.min.x >= b.min.x - eps && a.min.y >= b.min.y - eps && a.min.z >= b.min.z - eps &&
    a.max.x <= b.max.x + eps && a.max.y <= b.max.y + eps && a.max.z <= b.max.z + eps;
}

// ---------------------------------------------------------------
// job runner: shared by the worker protocol below and by any
// in-process transport (tests, single-thread fallback batching)
// ---------------------------------------------------------------
// per-worker persistent mesh cache (schema 3). Meshes are keyed by a
// uid the sender assigns per mesh OBJECT, so a re-fetched mesh gets a
// new uid and a stale copy can never be reused. Boxes and BVH are
// built once per uid and live as long as the mesh does. Budgeted by
// triangle count: on overflow the cache is dropped after the job and
// the reply says so (cacheReset), the sender then forgets its
// have-list for this worker.
const WORKER_TRI_BUDGET = 40_000_000;
export function makeMeshCache() {
  return { map: new Map(), tris: 0 };
}
export function runVerifyJob(msg, cache = null) {
  if (msg.schema !== CLS_WORKER_SCHEMA) {
    return { type: "error", schema: CLS_WORKER_SCHEMA, jobId: msg.jobId, error: "schema mismatch: got " + msg.schema };
  }
  const local = cache || makeMeshCache();
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const __t0 = now();
  resetKernelProfile();
  // absorb newly shipped meshes
  const shipped = msg.meshes || {};
  for (const k of Object.keys(shipped)) {
    const m = shipped[k];
    if (!m || local.map.has(k)) continue;
    local.map.set(k, { tris: m.tris, count: m.count });
    local.tris += m.count;
  }
  const verdicts = [];
  // relative transform of THIS job (B -> A data space); null = unmoved pair
  const T = Array.isArray(msg.transform) && msg.transform.length === 16 ? msg.transform : null;
  const viewKey = (bKey) => bKey + VIEW_TAG + (msg.transformSig || "x");
  // LRU touch: meshes (and views) used by this job move to the end of the map
  for (const c of msg.candidates) {
    const keys = T ? [c.aKey, c.bKey, viewKey(c.bKey)] : [c.aKey, c.bKey];
    for (const k of keys) {
      const m = local.map.get(k);
      if (m) { local.map.delete(k); local.map.set(k, m); }
    }
  }
  for (let c of msg.candidates) {
    const A = local.map.get(c.aKey);
    const Bsrc = local.map.get(c.bKey);
    if (!A || !Bsrc) { verdicts.push({ idx: c.idx, keep: false, error: "mesh missing" }); continue; }
    let B = Bsrc;
    if (T) {
      const vk = viewKey(c.bKey);
      B = local.map.get(vk);
      if (!B) {
        B = transformedView(Bsrc, T);
        local.map.set(vk, B);
        local.tris += B.count;
      }
      // boxB from the sender is in B data space; the kernel needs A space
      c = { ...c, boxB: meshBoxOf(B) };
    }
    verdicts.push({ idx: c.idx, ...verifyCandidate(c, A, B, msg.tolerance) });
  }
  // LRU eviction (v11.5): the budget comes from the sender (sized from
  // the device); oldest meshes go first, but never the ones THIS job
  // just used. Evicted uids are reported so the sender forgets them.
  const budget = Number(msg.triBudget) > 0 ? Number(msg.triBudget) : WORKER_TRI_BUDGET;
  const evicted = [];
  let cacheReset = false;
  if (local.tris > budget) {
    const used = new Set();
    for (const c of msg.candidates) {
      used.add(c.aKey); used.add(c.bKey);
      if (T) used.add(viewKey(c.bKey));
    }
    for (const [k, m] of local.map) {
      if (local.tris <= budget) break;
      if (used.has(k)) continue;
      local.map.delete(k);
      local.tris -= m.count;
      if (!isViewKey(k)) evicted.push(k); // views are worker-internal
    }
    if (local.tris > budget) { local.map.clear(); local.tris = 0; cacheReset = true; }
  }
  const top = [...KMESH.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 12).map(([k, e]) => ({ key: k, ...e }));
  return { type: "result", schema: CLS_WORKER_SCHEMA, jobId: msg.jobId, verdicts, computeMs: now() - __t0, cacheReset, evicted, cachedTris: local.tris, profile: { ...KPROF }, topMeshes: top };
}

// worker context: register the protocol. Guarded so the same file
// imports cleanly on the main thread (window present) and in node
// (self absent).
const IN_WORKER =
  typeof self !== "undefined" &&
  typeof window === "undefined" &&
  typeof self.postMessage === "function";
const _workerCache = makeMeshCache();
if (IN_WORKER) {
  self.onmessage = (e) => {
    try {
      self.postMessage(runVerifyJob(e.data || {}, _workerCache));
    } catch (err) {
      self.postMessage({ type: "error", schema: CLS_WORKER_SCHEMA, jobId: e?.data?.jobId, error: String(err?.message || err) });
    }
  };
} else if (typeof process !== "undefined" && process.versions?.node && typeof window === "undefined") {
  // node worker_threads transport: SAME schema over parentPort. This is
  // the local-helper/cloud foothold - any host that can import this file
  // and pass messages runs the identical kernel. The specifier is built
  // at runtime so browser bundlers leave it alone; browsers never reach
  // this branch (window check above, process absent).
  const wt = "node:worker_threads";
  import(/* @vite-ignore */ wt)
    .then(({ parentPort }) => {
      if (!parentPort) return; // imported on a node MAIN thread: no-op
      parentPort.on("message", (msg) => {
        try {
          parentPort.postMessage(runVerifyJob(msg || {}, _workerCache));
        } catch (err) {
          parentPort.postMessage({ type: "error", schema: CLS_WORKER_SCHEMA, jobId: msg?.jobId, error: String(err?.message || err) });
        }
      });
    })
    .catch(() => { /* not a worker context */ });
}
