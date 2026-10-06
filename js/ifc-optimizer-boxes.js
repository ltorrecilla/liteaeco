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
// liteAECO - (ifc-optimizer-boxes.js)
// ========

function boxInverse(matrix) {
    const rows = Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) => c < 4 ? matrix[c * 4 + r] : Number(c - 4 === r)));
    for (let c = 0; c < 4; c++) {
        let pivot = c;
        for (let r = c + 1; r < 4; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
        if (!Number.isFinite(rows[pivot][c]) || Math.abs(rows[pivot][c]) < 1e-14) throw new Error('Cannot invert object placement.');
        [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
        const divisor = rows[c][c];
        for (let k = 0; k < 8; k++) rows[c][k] /= divisor;
        for (let r = 0; r < 4; r++) if (r !== c) {
            const factor = rows[r][c];
            for (let k = 0; k < 8; k++) rows[r][k] -= factor * rows[c][k];
        }
    }
    return Array.from({ length: 16 }, (_, i) => rows[i % 4][4 + Math.floor(i / 4)]);
}
function boxPoint(m, x, y, z) {
    return [0, 1, 2].map(r => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
}
function boxMultiply(a, b) {
    return Array.from({ length: 16 }, (_, i) => {
        const row = i % 4, col = Math.floor(i / 4) * 4;
        return a[row] * b[col] + a[row + 4] * b[col + 1] + a[row + 8] * b[col + 2] + a[row + 12] * b[col + 3];
    });
}
async function boxOptimizerClasses(file, selected) {
    const cap = Math.round((navigator?.deviceMemory || 8) * 32) * 1048576;
    if (file.size >= cap) throw new Error(`Bounding boxes require full-model geometry loading. This file exceeds the ${Math.round(cap / 1048576)} MB memory guard. Use streaming optimization or class deletion.`);
    const chosen = new Set(selected.map(type => String(type).toUpperCase())), products = new Map(), present = new Set();
    const meta = await streamStepFile(file, { collectEntities: false, onEntity: (raw, type) => {
        if (chosen.has(type)) {
            const p = parseEntity(raw), attrs = splitStepAttributes(p.content);
            products.set(Number(p.id), { p, attrs });
            present.add(type);
        }
    } });
    const schema = deletionSchema(meta.header);
    for (const type of chosen) {
        if (!inherits(schema, type, 'IFCPRODUCT') || protectedClass(schema, type)) throw new Error(`Class ${type} cannot be replaced.`);
        if (!present.has(type)) throw new Error(`Class ${type} is absent from this file.`);
    }
    const unit = getProjectUnits(meta.unitText).length?.factor;
    if (!(unit > 0)) throw new Error('Cannot resolve project length units.');
    if (!globalIfcApi) {
        wlog('Downloading geometry engine for bounding boxes...');
        globalWebIFC = await import('https://unpkg.com/web-ifc@0.0.77/web-ifc-api.js');
        const api = new globalWebIFC.IfcAPI();
        api.SetWasmPath('https://unpkg.com/web-ifc@0.0.77/');
        await api.Init(); globalIfcApi = api;
    }
    const api = globalIfcApi;
    let buffer = new Uint8Array(await file.arrayBuffer());
    const model = api.OpenModel(buffer, { COORDINATE_TO_ORIGIN: false });
    buffer = null;
    if (model < 0) throw new Error('Geometry engine could not open this model.');
    const replacements = new Map(), additions = [], identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    let next = meta.maxId, skipped = 0;
    const add = text => {
        if (!Number.isSafeInteger(++next)) throw new Error('Entity identifiers exceed safe integer range.');
        additions.push(`#${next}=${text};`); return next;
    };
    const real = value => {
        if (!Number.isFinite(value)) throw new Error('Geometry contains non-finite coordinates.');
        const s = value.toString(); return /[.eE]/.test(s) ? s.replace('e', 'E') : s + '.';
    };
    try {
        api.SetGeometryTransformation(model, identity);
        let completed = 0;
        for (const [id, { p, attrs }] of products) {
            const definition = schema[p.type].attrs;
            const repAt = definition.findIndex(a => a[0] === 'Representation');
            const placementAt = definition.findIndex(a => a[0] === 'ObjectPlacement');
            const representation = /^#(\d+)$/.exec(attrs[repAt]);
            if (!representation) { skipped++; continue; }
            const pds = api.GetLine(model, Number(representation[1]));
            const representations = pds?.Representations;
            if (!Array.isArray(representations) || !representations.length) throw new Error(`No shape representation on #${id}.`);
            const shapes = representations.map(ref => api.GetLine(model, ref.value));
            const shape = shapes.find(s => s.RepresentationIdentifier?.value === 'Body') || shapes[0];
            const context = shape?.ContextOfItems?.value;
            if (!context) throw new Error(`No geometry context on #${id}.`);
            const placement = /^#(\d+)$/.exec(attrs[placementAt]);
            const inverse = boxInverse(placement ? api.GetWorldTransformMatrix(model, Number(placement[1])) : identity);
            const localTransform = boxMultiply(inverse, [1/unit,0,0,0,0,0,1/unit,0,0,-1/unit,0,0,0,0,0,1]);
            const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
            let vertices = 0, seen = false, colour = null;
            api.StreamMeshes(model, [id], mesh => {
                seen = true;
                for (let g = 0; g < mesh.geometries.size(); g++) {
                    const placed = mesh.geometries.get(g), geometry = api.GetGeometry(model, placed.geometryExpressID);
                    if (!colour) colour = placed.color;
                    try {
                        const points = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
                        const m = boxMultiply(localTransform, placed.flatTransformation);
                        for (let v = 0; v < points.length; v += 6) {
                            const x = points[v], y = points[v + 1], z = points[v + 2];
                            for (let a = 0; a < 3; a++) {
                                const coordinate = m[a] * x + m[a + 4] * y + m[a + 8] * z + m[a + 12];
                                if (!Number.isFinite(coordinate)) throw new Error(`Invalid geometry on #${id}.`);
                                min[a] = Math.min(min[a], coordinate); max[a] = Math.max(max[a], coordinate);
                            }
                            vertices++;
                        }
                    } finally { geometry.delete(); }
                }
            });
            if (!seen || !vertices || max.some((v, a) => !(v > min[a]))) throw new Error(`Cannot create a solid bounding box for #${id}. Empty, unsupported, or planar geometry; output cancelled.`);
            const size = max.map((v, a) => v - min[a]);
            const origin = [min[0] + size[0] / 2, min[1] + size[1] / 2, min[2]];
            const point = add(`IFCCARTESIANPOINT((${origin.map(real).join(',')}))`);
            const axis = add(`IFCAXIS2PLACEMENT3D(#${point},$,$)`);
            const profile = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,$,${real(size[0])},${real(size[1])})`);
            const direction = add('IFCDIRECTION((0.,0.,1.))');
            const block = add(`IFCEXTRUDEDAREASOLID(#${profile},#${axis},#${direction},${real(size[2])})`);
            const rep = add(`IFCSHAPEREPRESENTATION(#${context},'Body','SweptSolid',(#${block}))`);
            const productShape = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${rep}))`);
            if (colour && [colour.x, colour.y, colour.z, colour.w].every(Number.isFinite)) {
                const rgb = add(`IFCCOLOURRGB($,${[colour.x, colour.y, colour.z].map(real).join(',')})`);
                const shading = add(`IFCSURFACESTYLESHADING(#${rgb}${schema.IFCSURFACESTYLESHADING.attrs.length > 1 ? ',' + real(1 - colour.w) : ''})`);
                const style = add(`IFCSURFACESTYLE($,.BOTH.,(#${shading}))`);
                const assignment = getSchema(meta.header).toUpperCase() === 'IFC2X3' ? add(`IFCPRESENTATIONSTYLEASSIGNMENT((#${style}))`) : style;
                add(`IFCSTYLEDITEM(#${block},(#${assignment}),$)`);
            }
            attrs[repAt] = `#${productShape}`;
            replacements.set(id, { line: `#${id}=${p.typeRaw}(${attrs.join(',')});`, refs: [...numericRefs(attrs.join(',')), context] });
            if (++completed % 100 === 0) { wlog(`Bounding boxes: processed ${completed} objects...`); await new Promise(resolve => setTimeout(resolve, 0)); }
        }
    } finally { api.CloseModel(model); }
    wlog(`Bounding boxes: replaced ${replacements.size} objects; ${skipped} objects had no representation. Metadata and placements retained. Type-level shared geometry may remain.`);
    return deleteOptimizerClasses(file, [], replacements, additions);
}
