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
// liteAECO - (ifc-optimizer-worker.js)
// ========

importScripts('ifc-worker.js?v=11', 'ifc-delete-schemas.js?v=2', 'ifc-optimizer-classes.js?v=1', 'ifc-optimizer-boxes.js?v=1');
const optimizerBaseHandler = self.onmessage;

function deletionSchema(header) {
    const name = getSchema(header).toUpperCase();
    const schema = self.IFC_DELETE_SCHEMAS[name];
    if (!schema) throw new Error(`Class deletion does not support schema ${name}.`);
    return schema;
}
function inherits(schema, type, base) {
    while (type) {
        if (type === base) return true;
        type = schema[type]?.parent;
    }
    return false;
}
function protectedClass(schema, type) {
    return ['IFCSPATIALELEMENT', 'IFCSPATIALSTRUCTUREELEMENT', 'IFCPORT',
        'IFCFEATUREELEMENT', 'IFCPOSITIONINGELEMENT', 'IFCGRID'].some(base => inherits(schema, type, base));
}
const CLASS_SUGGESTIONS = Object.fromEntries(self.IFC_OPTIMIZER_RECOMMENDATIONS.map(([, name, rank, reason]) => [name.toUpperCase(), [rank, reason]]));
async function optimizerClasses(file) {
    const counts = new Map();
    const meta = await streamStepFile(file, { collectEntities: false,
        onEntity: (_, type) => counts.set(type, (counts.get(type) || 0) + 1) });
    const schema = deletionSchema(meta.header);
    const classes = [];
    for (const [type, count] of counts) if (inherits(schema, type, 'IFCPRODUCT')) {
        const suggestion = CLASS_SUGGESTIONS[type];
        classes.push({ type, name: schema[type].name, count, protected: protectedClass(schema, type),
            rank: suggestion?.[0] || 0, reason: suggestion?.[1] || '' });
    }
    classes.sort((a, b) => Number(a.protected) - Number(b.protected) || b.rank - a.rank || a.name.localeCompare(b.name));
    return { classes, schema: getSchema(meta.header) };
}

class DeleteColumn {
    constructor(Type = Float64Array) { this.Type = Type; this.parts = []; this.length = 0; }
    push(value) {
        const part = Math.floor(this.length / 65536), at = this.length % 65536;
        if (!at) this.parts.push(new this.Type(65536));
        this.parts[part][at] = value; this.length++;
    }
    get(i) { return this.parts[Math.floor(i / 65536)][i % 65536]; }
}
function numericRefs(text) {
    const refs = [];
    if (!text.includes('#')) return refs;
    mapRefsOutsideStrings(text, (match, id) => { refs.push(Number(id)); return match; });
    return refs;
}
function repairDeletedAttribute(value, removed) {
    const v = value.trim(), ref = v.match(/^#(\d+)$/);
    if (ref) return removed(Number(ref[1])) ? '$' : v;
    if (v.startsWith('(') && v.endsWith(')')) {
        return '(' + splitStepAttributes(v.slice(1, -1)).filter(item => {
            const ref = item.trim().match(/^#(\d+)$/);
            return !ref || !removed(Number(ref[1]));
        }).map(item => repairDeletedAttribute(item, removed)).join(',') + ')';
    }
    const typed = v.match(/^([A-Z][A-Z0-9_]*)\(([\s\S]*)\)$/i);
    if (typed) return typed[1] + '(' + repairDeletedAttribute(typed[2], removed) + ')';
    return v;
}

async function deleteOptimizerClasses(file, selected, replacements = new Map(), additions = []) {
    const store = await ScratchStore.create(true);
    try {
        await store.put('classes', new Blob());
        const ids = new DeleteColumn(), starts = new DeleteColumn(), edges = new DeleteColumn();
        const codes = new DeleteColumn(Uint16Array), types = [], typeCodes = new Map(), byId = new Map();
        const relations = new Map();
        const meta = await streamStepFile(file, { collectEntities: false,
            onProgress: done => wlog(`Class deletion: indexed ${(done / 1048576).toFixed(0)} MB...`),
            onBatch: async records => {
            for (const raw of records) {
                const p = parseEntity(raw), id = Number(p.id);
                if (byId.has(id)) throw new Error(`Duplicate entity identifier #${id}.`);
                byId.set(id, ids.length); ids.push(id); starts.push(edges.length);
                if (!typeCodes.has(p.type)) { typeCodes.set(p.type, types.length); types.push(p.type); }
                codes.push(typeCodes.get(p.type));
                const content = p.type === 'IFCPRESENTATIONLAYERASSIGNMENT' || p.type === 'IFCPRESENTATIONLAYERWITHSTYLE'
                    ? splitStepAttributes(p.content).filter((_, i) => i !== 2).join(',') : p.content;
                for (const ref of numericRefs(content)) edges.push(ref);
                if (p.type.startsWith('IFCREL')) {
                    relations.set(id, splitStepAttributes(p.content).map(value => ({
                        refs: numericRefs(value), list: value.trim().startsWith('(')
                    })));
                }
            }
            await store.append('classes', entityBlob(records));
        } });
        starts.push(edges.length);
        const schema = deletionSchema(meta.header);
        for (const type of types) if (!schema[type]) throw new Error(`Unknown ${getSchema(meta.header)} entity ${type}; deletion cancelled.`);
        const chosen = new Set(selected.map(type => String(type).toUpperCase()));
        for (const type of chosen) {
            if (!inherits(schema, type, 'IFCPRODUCT') || protectedClass(schema, type)) throw new Error(`Class ${type} cannot be deleted.`);
            if (!typeCodes.has(type)) throw new Error(`Class ${type} is absent from this file.`);
        }
        const removed = new Uint8Array(ids.length), changed = [], relationRefs = new Map(), inverse = new Map();
        const indexOf = id => byId.get(id);
        const isRemoved = id => { const i = indexOf(id); return i !== undefined && removed[i] === 1; };
        const mark = id => { const i = indexOf(id); if (i !== undefined && !removed[i]) { removed[i] = 1; changed.push(id); } };
        const attrIndex = (type, name) => schema[type].attrs.findIndex(attr => attr[0] === name);
        for (const [id, attrs] of relations) for (const attr of attrs) for (const ref of attr.refs) {
            if (!relationRefs.has(ref)) relationRefs.set(ref, []);
            relationRefs.get(ref).push(id);
        }
        const anchors = [
            ['IFCSTYLEDITEM', 'Item'], ['IFCPRESENTATIONLAYERASSIGNMENT', 'AssignedItems'],
            ['IFCINDEXEDCOLOURMAP', 'MappedTo'], ['IFCINDEXEDTEXTUREMAP', 'MappedTo'],
            ['IFCTEXTURECOORDINATEGENERATOR', 'Maps'], ['IFCMATERIALDEFINITIONREPRESENTATION', 'RepresentedMaterial'],
            ['IFCMATERIALPROPERTIES', 'Material'], ['IFCEXTENDEDMATERIALPROPERTIES', 'Material'],
            ['IFCSHAPEASPECT', 'PartOfProductDefinitionShape']
        ];
        const anchorAttributes = new Map();
        for (const type of types) {
            const anchor = anchors.find(([base]) => inherits(schema, type, base));
            if (anchor) anchorAttributes.set(type, attrIndex(type, anchor[1]));
        }
        const boxedTypes = new Map();
        if (replacements.size) for (const [id, attrs] of relations) {
            const type = types[codes.get(indexOf(id))];
            if (type !== 'IFCRELDEFINESBYTYPE') continue;
            const objects = attrs[attrIndex(type, 'RelatedObjects')]?.refs || [];
            const allBoxed = objects.length > 0 && objects.every(ref => replacements.has(ref));
            for (const target of attrs[attrIndex(type, 'RelatingType')]?.refs || []) {
                boxedTypes.set(target, (boxedTypes.get(target) ?? true) && allBoxed);
            }
        }
        for await (const records of store.batches('classes')) for (const raw of records) {
            const p = parseEntity(raw), a = anchorAttributes.get(p.type), id = Number(p.id);
            if (boxedTypes.get(id) && inherits(schema, p.type, 'IFCTYPEPRODUCT')) {
                const attrs = splitStepAttributes(p.content), at = attrIndex(p.type, 'RepresentationMaps');
                if (at >= 0 && schema[p.type].attrs[at][1] && attrs[at] !== '$') {
                    attrs[at] = '$';
                    replacements.set(id, { line: `#${id}=${p.typeRaw}(${attrs.join(',')});`, refs: numericRefs(attrs.join(',')) });
                }
            }
            if (a === undefined || a < 0) continue;
            const i = indexOf(id);
            for (const target of numericRefs(splitStepAttributes(p.content)[a])) {
                if (!inverse.has(target)) inverse.set(target, []);
                inverse.get(target).push(i);
            }
        }
        const semanticRoot = type => inherits(schema, type, 'IFCROOT') &&
            !inherits(schema, type, 'IFCTYPEOBJECT') && !inherits(schema, type, 'IFCPROPERTYDEFINITION');
        const semanticRoots = types.map(semanticRoot);
        const reachable = preserve => {
            const keep = new Uint8Array(ids.length), pending = [];
            const seed = i => { if (i !== undefined && !removed[i] && !keep[i]) { keep[i] = 1; pending.push(i); } };
            for (let i = 0; i < ids.length; i++) if (semanticRoots[codes.get(i)] || preserve && !preserve[i]) seed(i);
            while (pending.length) {
                const i = pending.pop();
                const replacement = replacements.get(ids.get(i));
                if (preserve && replacement) {
                    for (const ref of replacement.refs) seed(indexOf(ref));
                } else for (let at = starts.get(i); at < starts.get(i + 1); at++) seed(indexOf(edges.get(at)));
                for (const attachment of inverse.get(ids.get(i)) || []) seed(attachment);
            }
            return keep;
        };
        wlog(`Class deletion: checking dependencies for ${ids.length.toLocaleString()} entities (${store.kind} scratch storage)...`);
        const before = reachable();
        let selectedCount = 0;
        for (let i = 0; i < ids.length; i++) if (chosen.has(types[codes.get(i)])) { mark(ids.get(i)); selectedCount++; }
        for (let at = 0; at < changed.length; at++) for (const id of relationRefs.get(changed[at]) || []) {
            if (isRemoved(id)) continue;
            const type = types[codes.get(indexOf(id))], attrs = relations.get(id), definitions = schema[type].attrs;
            if (type === 'IFCRELVOIDSELEMENT') {
                const host = attrIndex(type, 'RelatingBuildingElement'), opening = attrIndex(type, 'RelatedOpeningElement');
                if (attrs[host]?.refs.some(isRemoved)) for (const child of attrs[opening]?.refs || []) mark(child);
            }
            if (type === 'IFCRELNESTS' || type === 'IFCRELCONNECTSPORTTOELEMENT') {
                const host = attrIndex(type, type === 'IFCRELNESTS' ? 'RelatingObject' : 'RelatedElement');
                const children = attrIndex(type, type === 'IFCRELNESTS' ? 'RelatedObjects' : 'RelatingPort');
                if (attrs[host]?.refs.some(isRemoved)) for (const child of attrs[children]?.refs || []) {
                    const i = indexOf(child);
                    if (i !== undefined && inherits(schema, types[codes.get(i)], 'IFCPORT')) mark(child);
                }
            }
            const invalid = attrs.some((attr, i) => {
                if (!attr.refs.some(isRemoved)) return false;
                const definition = definitions[i];
                if (!definition) throw new Error(`Unsupported attribute layout on #${id}.`);
                if (definition[1]) return false;
                return attr.list ? attr.refs.filter(ref => !isRemoved(ref)).length < definition[2] : true;
            });
            if (invalid) mark(id);
        }
        const after = reachable(before);
        let resources = 0;
        for (let i = 0; i < ids.length; i++) if (!removed[i] && before[i] && !after[i]) { mark(ids.get(i)); resources++; }
        const chunks = [new Blob([meta.header.trim() + '\nDATA;\n'])];
        let rewritten = 0;
        for await (const records of store.batches('classes')) {
            const output = [];
            for (const raw of records) {
                const p = parseEntity(raw);
                if (isRemoved(Number(p.id))) continue;
                let line = replacements.get(Number(p.id))?.line || raw;
                if (line !== raw) Object.assign(p, parseEntity(line));
                if (numericRefs(p.content).some(isRemoved)) {
                    const attrs = splitStepAttributes(p.content), definitions = schema[p.type].attrs;
                    for (let i = 0; i < attrs.length; i++) {
                        if (!numericRefs(attrs[i]).some(isRemoved)) continue;
                        const definition = definitions[i];
                        let repaired = repairDeletedAttribute(attrs[i], isRemoved);
                        if (definition?.[1] && definition[2] > 0 && repaired === '()') repaired = '$';
                        if (!definition || !definition[1] && (repaired === '$' || repaired === '()' && definition[2] > 0)) {
                            throw new Error(`Deleting these classes would invalidate ${p.type} #${p.id}; output cancelled.`);
                        }
                        attrs[i] = repaired;
                    }
                    line = `#${p.id}=${p.typeRaw}(${attrs.join(',')});`; rewritten++;
                    if (numericRefs(parseEntity(line).content).some(isRemoved)) throw new Error(`Deleted reference remains on #${p.id}.`);
                }
                output.push(line + '\n');
            }
            chunks.push(new Blob(output));
        }
        for (let i = 0; i < additions.length; i += 4096) chunks.push(new Blob([additions.slice(i, i + 4096).join('\n') + '\n']));
        chunks.push(new Blob([meta.footer]));
        wlog(`Class deletion: removed ${selectedCount} selected object(s), ${changed.length - selectedCount - resources} dependent object(s)/relationship(s), ${resources} unused resource(s); repaired ${rewritten} record(s).`);
        return new File(chunks, file.name || 'class-filtered.ifc', { type: 'application/x-step' });
    } finally { await store.cleanup(); }
}

self.onmessage = async event => {
    const data = event.data || {};
    try {
        if (data.options?.deleteClasses?.length && data.options?.boxClasses?.length) throw new Error('Choose either deletion or bounding-box replacement.');
        if (data.action === 'optimizerClasses') {
            self.postMessage({ type: 'result', reqId: data.reqId, ...await optimizerClasses(data.file) });
            return;
        }
        if (data.action === 'optimizeFile' && data.options?.deleteClasses?.length) {
            const file = await deleteOptimizerClasses(data.file, data.options.deleteClasses);
            await optimizerBaseHandler({ data: { ...data, file, fileName: data.fileName || data.file.name } });
            return;
        }
        if (data.action === 'optimizeFile' && data.options?.boxClasses?.length) {
            const file = await boxOptimizerClasses(data.file, data.options.boxClasses);
            await optimizerBaseHandler({ data: { ...data, file, fileName: data.fileName || data.file.name } });
            return;
        }
        await optimizerBaseHandler(event);
    } catch (error) {
        self.postMessage({ type: 'error', reqId: data.reqId, msg: error.message });
    }
};
