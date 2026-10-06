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
// liteAECO - (ifc-storey-cleanup.js)
// ========

function storeyRefs(content, wanted) {
    const refs = [];
    if (content.includes('#')) mapRefsOutsideStrings(content, (match, id) => { const ref = Number(id); if (!wanted || wanted.has(ref)) refs.push(ref); return match; });
    return refs;
}
function storeyRef(value) { const match = /^#(\d+)$/.exec(value?.trim() || ''); return match ? Number(match[1]) : null; }
function storeyMatrixMultiply(a, b) {
    return Array.from({ length: 16 }, (_, i) => {
        const r = i % 4, c = Math.floor(i / 4) * 4;
        return a[r] * b[c] + a[r + 4] * b[c + 1] + a[r + 8] * b[c + 2] + a[r + 12] * b[c + 3];
    });
}
const STOREY_IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function storeyAxisMatrix(axis, values) {
    if (!axis || axis.type !== 'IFCAXIS2PLACEMENT3D') return null;
    const a = splitStepAttributes(axis.content);
    const vector = (ref, fallback, type) => {
        if (ref === '$') return fallback;
        const entity = values.get(storeyRef(ref));
        if (!entity || entity.type !== type) return null;
        const coords = splitStepAttributes(entity.content)[0];
        if (!coords?.startsWith('(')) return null;
        const v = splitStepAttributes(coords.slice(1, -1)).map(s => Number(s.replace(/[dD]/, 'E')));
        return v.length === 3 && v.every(Number.isFinite) ? v : null;
    };
    const point = vector(a[0], null, 'IFCCARTESIANPOINT');
    let z = vector(a[1], [0,0,1], 'IFCDIRECTION'), x = vector(a[2], [1,0,0], 'IFCDIRECTION');
    if (!point || !z || !x) return null;
    const normalize = v => { const n = Math.hypot(...v); return n > 1e-14 ? v.map(c => c / n) : null; };
    z = normalize(z); if (!z) return null;
    const dot = x.reduce((sum, c, i) => sum + c * z[i], 0);
    x = normalize(x.map((c, i) => c - dot * z[i])); if (!x) return null;
    const y = [z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
    return [...x,0,...y,0,...z,0,...point,1];
}

async function cleanupBuildingStoreys(file, options = {}) {
    if (!options.optRemoveEmptyStoreys && !options.optMergeDuplicateStoreys) return file;
    const store = await ScratchStore.create(options.useScratchDisk !== false);
    try {
        await store.put('storeys', new Blob());
        const storeys = new Map(), buildings = new Set(), placements = new Map();
        const meta = await streamStepFile(file, { collectEntities: false,
            onProgress: done => wlog(`Storey cleanup: indexed ${(done / 1048576).toFixed(0)} MB...`),
            onBatch: records => store.append('storeys', entityBlob(records)),
            onEntity: (raw, type) => {
                if (type === 'IFCBUILDINGSTOREY') {
                    const p = parseEntity(raw), a = splitStepAttributes(p.content);
                    if (a.length !== 10) throw new Error(`Unsupported building-storey attributes on #${p.id}.`);
                    if (storeys.has(Number(p.id))) throw new Error(`Duplicate building-storey identifier #${p.id}.`);
                    storeys.set(Number(p.id), { a, parents: new Set(), parentLinks: 0, contents: false, protected: false });
                } else if (type === 'IFCBUILDING') buildings.add(Number(parseEntity(raw).id));
                else if (options.optMergeDuplicateStoreys && type === 'IFCLOCALPLACEMENT') {
                    const p = parseEntity(raw), a = splitStepAttributes(p.content);
                    placements.set(Number(p.id), [storeyRef(a[0]), storeyRef(a[1]), a.length === 2 && (a[0] === '$' || !!storeyRef(a[0])) && !!storeyRef(a[1])]);
                }
            }
        });
        if (!storeys.size) { wlog('Storey cleanup: no building storeys found.'); return file; }
        const axesNeeded = new Set(), axes = new Map(), vectorsNeeded = new Set(), vectors = new Map();
        if (options.optMergeDuplicateStoreys) for (const item of storeys.values()) {
            let id = storeyRef(item.a[5]); const seen = new Set();
            while (id && !seen.has(id)) {
                seen.add(id); const placement = placements.get(id); if (!placement) break;
                if (placement[1]) axesNeeded.add(placement[1]); id = placement[0];
            }
        }
        for await (const records of store.batches('storeys')) for (const raw of records) {
            const content = raw.slice(raw.indexOf('(') + 1);
            if (!content.includes('#')) continue;
            const refs = storeyRefs(content, storeys);
            if (!refs.length && !axesNeeded.size) continue;
            const p = parseEntity(raw), id = Number(p.id);
            if (axesNeeded.has(id)) {
                axes.set(id, p); for (const ref of storeyRefs(p.content)) vectorsNeeded.add(ref);
            }
            if (!refs.length) continue;
            const a = splitStepAttributes(p.content);
            if (p.type === 'IFCRELAGGREGATES' && a.length === 6) {
                const parent = storeyRef(a[4]), children = storeyRefs(a[5]);
                if (storeys.has(parent) && children.length) storeys.get(parent).contents = true;
                for (const child of children) if (storeys.has(child)) {
                    const item = storeys.get(child); item.parents.add(parent); item.parentLinks++;
                }
                for (const ref of storeyRefs(a.slice(0,4).join(','))) if (storeys.has(ref)) storeys.get(ref).protected = true;
            } else if (['IFCRELCONTAINEDINSPATIALSTRUCTURE','IFCRELREFERENCEDINSPATIALSTRUCTURE'].includes(p.type) && a.length === 6) {
                const target = storeyRef(a[5]);
                if (storeys.has(target)) storeys.get(target).contents = true;
                for (const ref of storeyRefs(a.slice(0,5).join(','))) if (storeys.has(ref)) storeys.get(ref).protected = true;
            } else for (const ref of refs) storeys.get(ref).protected = true;
        }
        const removed = new Set(), swaps = new Map();
        const eligible = item => !item.protected && item.parentLinks === 1 && item.parents.size === 1 && buildings.has([...item.parents][0]) && item.a[6] === '$';
        if (options.optRemoveEmptyStoreys) for (const [id, item] of storeys) {
            if (eligible(item) && !item.contents && [3,4,7].every(at => item.a[at] === '$' || item.a[at] === "''")) removed.add(id);
        }
        if (options.optMergeDuplicateStoreys) {
            for await (const records of store.batches('storeys')) for (const raw of records) {
                const id = Number(raw.slice(1, raw.indexOf('=')));
                if (vectorsNeeded.has(id)) vectors.set(id, parseEntity(raw));
            }
            const unit = getProjectUnits(meta.unitText).length?.factor;
            if (!(unit > 0)) throw new Error('Cannot resolve units for duplicate-storey cleanup.');
            const cache = new Map();
            const frame = initial => {
                if (!initial) return STOREY_IDENTITY;
                let id = initial; const pending = [], seen = new Set();
                while (id && !cache.has(id)) {
                    if (seen.has(id) || !placements.get(id)?.[2]) return null;
                    seen.add(id); pending.push(id); id = placements.get(id)[0];
                }
                let matrix = id ? cache.get(id) : STOREY_IDENTITY;
                while (pending.length) {
                    const current = pending.pop(), local = storeyAxisMatrix(axes.get(placements.get(current)[1]), vectors);
                    if (!matrix || !local) return null;
                    matrix = storeyMatrixMultiply(matrix, local); cache.set(current, matrix);
                }
                return matrix;
            };
            const groups = new Map();
            for (const [id, item] of [...storeys].sort((a,b) => a[0]-b[0])) {
                if (removed.has(id) || !eligible(item) || !item.a[2] || item.a[2] === '$' || item.a[2] === "''") continue;
                const elevation = Number(item.a[9].replace(/[dD]/, 'E'));
                if (!Number.isFinite(elevation)) continue;
                const placementId = storeyRef(item.a[5]); if (!placementId) continue;
                const matrix = frame(placementId); if (!matrix || !matrix.every(Number.isFinite)) continue;
                const signature = matrix.map((value, i) => (i >= 12 && i < 15 ? value * unit : value).toFixed(i >= 12 && i < 15 ? 8 : 12));
                const key = JSON.stringify([[...item.parents][0], ...item.a.slice(1,5), ...item.a.slice(6,9), elevation, signature]);
                if (groups.has(key)) swaps.set(id, groups.get(key)); else groups.set(key, id);
            }
        }
        if (!removed.size && !swaps.size) { wlog('Storey cleanup: no safe redundant storeys found.'); return file; }
        let reported = 0;
        for (const id of removed) if (reported++ < 50) wlog(`Storey cleanup: remove empty storey #${id} (${storeys.get(id).a[2]}).`);
        for (const [id, target] of swaps) if (reported++ < 50) wlog(`Storey cleanup: merge duplicate storey #${id} into #${target} (${storeys.get(id).a[2]}).`);
        if (reported > 50) wlog(`Storey cleanup: ${reported - 50} further matches omitted from the log.`);
        const chunks = [new Blob([meta.header.trim() + '\nDATA;\n'])];
        let relationshipsRemoved = 0;
        for await (const records of store.batches('storeys')) {
            const output = [];
            for (const raw of records) {
                const p = parseEntity(raw), id = Number(p.id);
                if (removed.has(id) || swaps.has(id)) continue;
                const refs = storeyRefs(p.content, storeys);
                if (!refs.some(ref => removed.has(ref) || swaps.has(ref))) { output.push(raw + '\n'); continue; }
                const a = splitStepAttributes(p.content);
                if (!['IFCRELAGGREGATES','IFCRELCONTAINEDINSPATIALSTRUCTURE','IFCRELREFERENCEDINSPATIALSTRUCTURE'].includes(p.type)) throw new Error(`Unsafe storey reference on #${id}; cleanup cancelled.`);
                const listAt = p.type === 'IFCRELAGGREGATES' ? 5 : 4;
                if (!a[listAt].startsWith('(')) throw new Error(`Invalid spatial membership on #${id}.`);
                const members = storeyRefs(a[listAt]).filter(ref => !removed.has(ref)).map(ref => swaps.get(ref) || ref);
                if (!members.length) { relationshipsRemoved++; continue; }
                a[listAt] = '(' + [...new Set(members)].map(ref => '#' + ref).join(',') + ')';
                for (let i = 0; i < a.length; i++) if (i !== listAt) a[i] = mapRefsOutsideStrings(a[i], (match, ref) => swaps.has(Number(ref)) ? '#' + swaps.get(Number(ref)) : match);
                const line = `#${id}=${p.typeRaw}(${a.join(',')});`;
                if (storeyRefs(parseEntity(line).content).some(ref => removed.has(ref) || swaps.has(ref))) throw new Error(`Unresolved storey reference on #${id}.`);
                output.push(line + '\n');
            }
            chunks.push(new Blob(output));
        }
        chunks.push(new Blob([meta.footer]));
        wlog(`Storey cleanup: removed ${removed.size} empty storey(s), merged ${swaps.size} duplicate storey(s), removed ${relationshipsRemoved} empty relationship(s). Geometry and placement chains preserved.`);
        return new Blob(chunks, { type: 'application/x-step' });
    } finally { await store.cleanup(); }
}
