/*
 * Copyright 2026 Luis Torrecilla (liteAECO)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ========
// liteAECO - (cls_worker.js)
// ========

export const CLS_WORKER_SCHEMA = 4;

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

  if (Math.min(v0x, v1x, v2x) > hx || Math.max(v0x, v1x, v2x) < -hx) return false;
  if (Math.min(v0y, v1y, v2y) > hy || Math.max(v0y, v1y, v2y) < -hy) return false;
  if (Math.min(v0z, v1z, v2z) > hz || Math.max(v0z, v1z, v2z) < -hz) return false;

  const e0x = v1x - v0x, e0y = v1y - v0y, e0z = v1z - v0z;
  const e1x = v2x - v1x, e1y = v2y - v1y, e1z = v2z - v1z;
  const nx = e0y * e1z - e0z * e1y,
    ny = e0z * e1x - e0x * e1z,
    nz = e0x * e1y - e0y * e1x;
  const d = nx * v0x + ny * v0y + nz * v0z;
  const r = hx * Math.abs(nx) + hy * Math.abs(ny) + hz * Math.abs(nz);
  if (Math.abs(d) > r) return false;

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

  const D = cross(n1, n2);
  const proj = (v) => dot(D, v);
  const int1 = planeIntervals(proj, p1, q1, r1, dp1, dq1, dr1);
  const int2 = planeIntervals(proj, p2, q2, r2, dp2, dq2, dr2);
  if (!int1 || !int2) return false;
  return Math.max(int1[0], int2[0]) <= Math.min(int1[1], int2[1]);
}

function planeIntervals(proj, a, b, c, da, db, dc) {
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
  for (const u of out) {
    if (Math.abs(u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) > 0.999) return;
  }
  if (out.length < 8) out.push(v);
}

function triTriPoints(A, ao, B, bo, out) {
  for (let e = 0; e < 3; e++) {
    const p = (e * 3), q = (((e + 1) % 3) * 3);
    let pt = segTri(A[ao + p], A[ao + p + 1], A[ao + p + 2], A[ao + q], A[ao + q + 1], A[ao + q + 2], B, bo);
    if (pt) out.push(pt);
    pt = segTri(B[bo + p], B[bo + p + 1], B[bo + p + 2], B[bo + q], B[bo + q + 1], B[bo + q + 2], A, ao);
    if (pt) out.push(pt);
  }
}

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
  const work = new Int32Array(3 * (2 * Math.ceil(Math.log2(Math.max(2, n))) + 64));
  let wp = 0;
  const root = nodes++;
  work[wp++] = root; work[wp++] = 0; work[wp++] = n;
  while (wp > 0) {
    const hi = work[--wp], lo = work[--wp], node = work[--wp];
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

export const KPROF = { regionMs: 0, probeMs: 0, sampleMs: 0, depthMs: 0, cands: 0, contacts: 0, sampled: 0, rays1: 0, triTests: 0, listA: 0, listB: 0 };
export const KMESH = new Map();
export function resetKernelProfile() { for (const k of Object.keys(KPROF)) KPROF[k] = 0; KMESH.clear(); }
const _now = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
const JX = 7e-7, JY = 3.1e-7, JZ = 1.3e-7;

export function verifyCandidate(c, A, B, tolerance) {
  const EPS = Math.max(1e-4, tolerance * 0.1);
  const region = c.region && c.region.min ? c.region : null;
  KPROF.cands++;
  let _t = _now();

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

  let contact = false;
  const surfacePts = [];
  const dirs = [];
  if (listA.length && listB.length) {
    const bA = boxesOf(A), bB = boxesOf(B);
    let pairsHit = 0;
    const hits = [];
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
        if (triTriIntersect(A.tris, ta * 9, B.tris, tb * 9)) {
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

  let cloud = null;
  let sampleForContainment = false;
  if (!contact && (!listA.length || !listB.length)) {
    if (c.boxA && c.boxB && !(boxInside(c.boxB, c.boxA, EPS) || boxInside(c.boxA, c.boxB, EPS))) {
      sampleForContainment = false;
    } else if (!listA.length && !listB.length) {
      sampleForContainment = false;
    } else {
      const src = listA.length ? A : B, tgt = listA.length ? B : A, lst = listA.length ? listA : listB;
      const o1 = lst[0] * 9, o2 = lst[lst.length - 1] * 9 + 3;
      const r1 = pointInMeshBVH(src.tris[o1] + JX, src.tris[o1 + 1] + JY, src.tris[o1 + 2] + JZ, tgt);
      const r2 = pointInMeshBVH(src.tris[o2] + JX, src.tris[o2 + 1] + JY, src.tris[o2 + 2] + JZ, tgt);
      sampleForContainment = r1 || r2 || r1 !== r2;
      KPROF.rays1++;
    }
  }
  if (contact || sampleForContainment) {
    cloud = { pts: [], minx: Infinity, miny: Infinity, minz: Infinity, maxx: -Infinity, maxy: -Infinity, maxz: -Infinity, n: 0 };
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
    const sample = (mesh, tlist, other, cap) => {
      const step = Math.max(1, Math.floor((tlist.length * 3) / cap));
      let s = 0;
      for (const t of tlist) {
        const o = t * 9;
        for (let v = 0; v < 3; v++) {
          if (s++ % step) continue;
          const x = mesh.tris[o + v * 3],
            y = mesh.tris[o + v * 3 + 1],
            z = mesh.tris[o + v * 3 + 2];
          if (pointInMeshBVH(x + JX, y + JY, z + JZ, other)) addPt(x, y, z);
        }
      }
    };
    for (const p of surfacePts) addPt(p[0], p[1], p[2]);
    const allA = listA.length ? listA : [...Array(Math.min(A.count, 400)).keys()];
    const allB = listB.length ? listB : [...Array(Math.min(B.count, 400)).keys()];
    sample(A, allA, B, 200);
    sample(B, allB, A, 200);
    if (!contact && cloud.n > 0) contact = true;
    KPROF.sampled++;
  }
  {
    const dt = _now() - _t;
    KPROF.sampleMs += dt; _t = _now();
    const e = KMESH.get(c.aKey || "A"); if (e) e.ms += dt;
  }

  if (!contact) return { keep: false };

  if (cloud && cloud.n > 0) {
    const dx = Math.max(0, cloud.maxx - cloud.minx);
    const dy = Math.max(0, cloud.maxy - cloud.miny);
    const dz = Math.max(0, cloud.maxz - cloud.minz);
    let depth = Math.min(dx, dy, dz);
    for (const dvec of dirs) {
      let mn = Infinity, mx = -Infinity;
      for (const p of cloud.pts) {
        const s = p[0] * dvec[0] + p[1] * dvec[1] + p[2] * dvec[2];
        if (s < mn) mn = s;
        if (s > mx) mx = s;
      }
      if (mx - mn < depth) depth = mx - mn;
    }
    KPROF.depthMs += _now() - _t;
    if (depth < tolerance) return { keep: false };
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

function boxInside(a, b, eps) {
  return a.min.x >= b.min.x - eps && a.min.y >= b.min.y - eps && a.min.z >= b.min.z - eps &&
    a.max.x <= b.max.x + eps && a.max.y <= b.max.y + eps && a.max.z <= b.max.z + eps;
}

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
  const shipped = msg.meshes || {};
  for (const k of Object.keys(shipped)) {
    const m = shipped[k];
    if (!m || local.map.has(k)) continue;
    local.map.set(k, { tris: m.tris, count: m.count });
    local.tris += m.count;
  }
  const verdicts = [];
  const T = Array.isArray(msg.transform) && msg.transform.length === 16 ? msg.transform : null;
  const viewKey = (bKey) => bKey + VIEW_TAG + (msg.transformSig || "x");
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
      c = { ...c, boxB: meshBoxOf(B) };
    }
    verdicts.push({ idx: c.idx, ...verifyCandidate(c, A, B, msg.tolerance) });
  }
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
      if (!isViewKey(k)) evicted.push(k);
    }
    if (local.tris > budget) { local.map.clear(); local.tris = 0; cacheReset = true; }
  }
  const top = [...KMESH.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 12).map(([k, e]) => ({ key: k, ...e }));
  return { type: "result", schema: CLS_WORKER_SCHEMA, jobId: msg.jobId, verdicts, computeMs: now() - __t0, cacheReset, evicted, cachedTris: local.tris, profile: { ...KPROF }, topMeshes: top };
}

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
  const wt = "node:worker_threads";
  import( wt)
    .then(({ parentPort }) => {
      if (!parentPort) return;
      parentPort.on("message", (msg) => {
        try {
          parentPort.postMessage(runVerifyJob(msg || {}, _workerCache));
        } catch (err) {
          parentPort.postMessage({ type: "error", schema: CLS_WORKER_SCHEMA, jobId: msg?.jobId, error: String(err?.message || err) });
        }
      });
    })
    .catch(() => {  });
}
