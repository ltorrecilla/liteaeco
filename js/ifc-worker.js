const WORKER_PROTO = 8;
let globalIfcApi = null;
let globalWebIFC = null;
function tokenizeEntities(bodyText) {
    const entities = [];
    const n = bodyText.length;
    let i = 0, start = 0, inString = false;
    let pieces = null; 
    while (i < n) {
        const ch = bodyText[i];
        if (inString) {
            if (ch === "'") {
                if (bodyText[i + 1] === "'") { i += 2; continue; } 
                inString = false;
            }
            i++; continue;
        }
        if (ch === '/' && bodyText[i + 1] === '*') {
            const seg = bodyText.substring(start, i);
            if (seg) (pieces || (pieces = [])).push(seg);
            const end = bodyText.indexOf('*/', i + 2);
            i = end === -1 ? n : end + 2;
            start = i;
            continue;
        }
        if (ch === "'") { inString = true; i++; continue; }
        if (ch === ';') {
            i++;
            let t = bodyText.substring(start, i);
            if (pieces) { pieces.push(t); t = pieces.join(''); pieces = null; }
            t = t.trim();
            if (t) entities.push(t);
            start = i;
            continue;
        }
        i++;
    }
    let tail = bodyText.substring(start);
    if (pieces) { pieces.push(tail); tail = pieces.join(''); }
    tail = tail.trim();
    if (tail) entities.push(tail);
    return entities;
}
function parseEntity(raw) {
    const m = raw.match(/^#(\d+)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (!m) return null;
    const open = m.index + m[0].length - 1; 
    const close = raw.lastIndexOf(')');
    if (close <= open) return null;
    return {
        id: m[1],
        typeRaw: m[2],
        type: m[2].toUpperCase(),
        content: raw.substring(open + 1, close)
    };
}
const UNIT_TO_METER = { METER: 1, MILLIMETER: 0.001, CENTIMETER: 0.01, FOOT: 0.3048, INCH: 0.0254 };
function getLengthUnit(ifcData) {
    const ua = ifcData.match(/IFCUNITASSIGNMENT\s*\(\s*\(([^)]*)\)/i);
    if (ua) {
        const refs = ua[1].match(/#\d+/g) || [];
        for (const ref of refs) {
            const re = new RegExp('^#' + ref.slice(1) + '\\s*=\\s*(IFCSIUNIT|IFCCONVERSIONBASEDUNIT)\\s*\\(([^;]*)\\)\\s*;', 'im');
            const m = ifcData.match(re);
            if (!m) continue;
            const attrs = splitStepAttributes(m[2]).map(a => a.toUpperCase());
            if (attrs[1] !== '.LENGTHUNIT.') continue;
            if (m[1].toUpperCase() === 'IFCSIUNIT') {
                if (attrs[3] !== '.METRE.') return 'UNKNOWN';
                if (attrs[2] === '$') return 'METER';
                if (attrs[2] === '.MILLI.') return 'MILLIMETER';
                if (attrs[2] === '.CENTI.') return 'CENTIMETER';
                return 'UNKNOWN';
            }
            const nm = (attrs[2] || '').replace(/'/g, '');
            if (nm === 'FOOT' || nm === 'FEET') return 'FOOT';
            if (nm === 'INCH') return 'INCH';
            return 'UNKNOWN';
        }
    }
    if (/IFCCONVERSIONBASEDUNIT\s*\(\s*[^,]+,\s*\.LENGTHUNIT\.\s*,\s*'(?:FOOT|Foot|foot)'/i.test(ifcData)) return "FOOT";
    if (/IFCSIUNIT\s*\(\s*[^,]+,\s*\.LENGTHUNIT\.\s*,\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/i.test(ifcData)) return "MILLIMETER";
    if (/IFCSIUNIT\s*\(\s*[^,]+,\s*\.LENGTHUNIT\.\s*,\s*\$\s*,\s*\.METRE\.\s*\)/i.test(ifcData)) return "METER";
    return "UNKNOWN";
}
function splitStepAttributes(attrString) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let depth = 0;
    for (let i = 0; i < attrString.length; i++) {
        const char = attrString[i];
        if (char === "'") {
            if (inQuotes && attrString[i + 1] === "'") { current += "''"; i++; continue; }
            inQuotes = !inQuotes;
            current += char;
        } else if (!inQuotes && char === '(') {
            depth++;
            current += char;
        } else if (!inQuotes && char === ')') {
            if (depth > 0) depth--;
            current += char;
        } else if (char === ',' && !inQuotes && depth === 0) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
function roundFloatSafe(match, decimals) {
    const dotIdx = match.indexOf('.');
    if (match.length - dotIdx - 1 <= decimals) return match;
    const v = parseFloat(match);
    const r = v.toFixed(decimals);
    if (v !== 0 && parseFloat(r) === 0) return match;
    return r;
}
function generateNormalizedHash(type, content, applyFloatNorm, decimals) {
    let clean = content.replace(/\s+/g, '');
    if (!applyFloatNorm) return `${type}(${clean})`;
    clean = clean.replace(/(-?\d+\.\d+)/g, (match) => roundFloatSafe(match, decimals));
    return `${type}(${clean})`;
}
function mapRefsOutsideStrings(str, fn) {
    if (!str.includes("'")) return str.replace(/#(\d+)\b/g, fn);
    const seg = str.split(/('(?:[^']|'')*')/);
    for (let i = 0; i < seg.length; i += 2) seg[i] = seg[i].replace(/#(\d+)\b/g, fn);
    return seg.join('');
}
function makeSwapProbe(swapMap) {
    if (swapMap.size === 0 || swapMap.size > 300) return null;
    const ids = Array.from(swapMap.keys()).map(k => String(k).replace(/\D/g, '')).filter(Boolean);
    if (!ids.length) return null;
    return new RegExp('#(?:' + ids.join('|') + ')(?!\\d)');
}
function resolveReferences(s, swapMap, probe) {
    if (swapMap.size === 0) return s;
    const n = s.length;
    let out = null, last = 0, i = 0, inStr = false;
    while (i < n) {
        const c = s.charCodeAt(i);
        if (inStr) { if (c === 39) { if (s.charCodeAt(i + 1) === 39) { i += 2; continue; } inStr = false; } i++; continue; }
        if (c === 39) { inStr = true; i++; continue; }
        if (c === 35) {
            let j = i + 1;
            while (j < n) { const d = s.charCodeAt(j); if (d < 48 || d > 57) break; j++; }
            if (j > i + 1) {
                const id = s.substring(i + 1, j);
                if (swapMap.has(id)) {
                    let cur = id, g = 0;
                    while (swapMap.has(cur) && g++ < 100000) cur = swapMap.get(cur);
                    if (out === null) out = '';
                    out += s.substring(last, i + 1) + cur;
                    last = j;
                }
            }
            i = j; continue;
        }
        i++;
    }
    return out === null ? s : out + s.substring(last);
}
function offsetReferences(s, offset) {
    const n = s.length;
    let out = '', last = 0, i = 0, inStr = false;
    while (i < n) {
        const c = s.charCodeAt(i);
        if (inStr) { if (c === 39) { if (s.charCodeAt(i + 1) === 39) { i += 2; continue; } inStr = false; } i++; continue; }
        if (c === 39) { inStr = true; i++; continue; }
        if (c === 35) {
            let j = i + 1, v = 0, d;
            while (j < n && (d = s.charCodeAt(j)) >= 48 && d <= 57) { v = v * 10 + (d - 48); j++; }
            if (j > i + 1) { out += s.substring(last, i + 1) + (v + offset); last = j; }
            i = j; continue;
        }
        i++;
    }
    return out + s.substring(last);
}
const STEP_REAL_RE = /-?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/g;
function formatStepReal(v) {
    if (!isFinite(v)) return '0.0';
    let s = v.toPrecision(12);
    if (/e/i.test(s)) {
        const parts = s.split(/e/i);
        let m = parts[0];
        if (m.includes('.')) { m = m.replace(/0+$/, ''); if (m.endsWith('.')) m += '0'; }
        else m += '.0';
        return m + 'E' + parts[1];
    }
    if (s.includes('.')) {
        s = s.replace(/0+$/, '');
        if (s.endsWith('.')) s += '0';
    } else {
        s += '.0';
    }
    return s;
}
function scaleNum(tok, factor) {
    const v = parseFloat(tok);
    return v === v ? formatStepReal(v * factor) : tok;
}
function scaleAllNumbers(str, factor) {
    return str.replace(STEP_REAL_RE, (m) => {
        const v = parseFloat(m);
        return v === v ? formatStepReal(v * factor) : m;
    });
}
const TYPED_MEASURE_RE = /\b(IFC(?:POSITIVE)?LENGTHMEASURE|IFCAREAMEASURE|IFCVOLUMEMEASURE)\s*\(\s*([^)]*?)\s*\)/gi;
function scaleTypedMeasures(content, factor) {
    if (!/MEASURE/i.test(content)) return content;
    return content.replace(TYPED_MEASURE_RE, (m, type, val) => {
        const t = type.toUpperCase();
        const f = t === 'IFCAREAMEASURE' ? factor * factor : t === 'IFCVOLUMEMEASURE' ? factor * factor * factor : factor;
        return `${type}(${scaleNum(val, f)})`;
    });
}
function normStoreyName(a) {
    const s = a.replace(/^'|'$/g, '').trim();
    return s ? s.toUpperCase() : null;
}
const LENGTH_WATCH = new Set([
    'IFCELLIPSEPROFILEDEF', 'IFCTRAPEZIUMPROFILEDEF', 'IFCISHAPEPROFILEDEF',
    'IFCLSHAPEPROFILEDEF', 'IFCUSHAPEPROFILEDEF', 'IFCTSHAPEPROFILEDEF',
    'IFCZSHAPEPROFILEDEF', 'IFCCSHAPEPROFILEDEF', 'IFCASYMMETRICISHAPEPROFILEDEF',
    'IFCOFFSETCURVE2D', 'IFCOFFSETCURVE3D', 'IFCRECTANGULARPYRAMID',
    'IFCREVOLVEDAREASOLID', 'IFCFIXEDREFERENCESWEPTAREASOLID',
    'IFCBSPLINECURVEWITHKNOTS', 'IFCRATIONALBSPLINESURFACEWITHKNOTS'
]);
function applyScale(type, content, factor, watchSet) {
    let a;
    switch (type) {
        case 'IFCCARTESIANPOINT':
            return scaleAllNumbers(content, factor);
        case 'IFCCARTESIANPOINTLIST2D':
        case 'IFCCARTESIANPOINTLIST3D':
            a = splitStepAttributes(content);
            if (a.length >= 1) { a[0] = scaleAllNumbers(a[0], factor); return a.join(','); }
            return content;
        case 'IFCRECTANGLEPROFILEDEF':
            a = splitStepAttributes(content);
            if (a.length > 4) { a[3] = scaleNum(a[3], factor); a[4] = scaleNum(a[4], factor); return a.join(','); }
            return content;
        case 'IFCROUNDEDRECTANGLEPROFILEDEF':
            a = splitStepAttributes(content);
            if (a.length > 5) { a[3] = scaleNum(a[3], factor); a[4] = scaleNum(a[4], factor); a[5] = scaleNum(a[5], factor); return a.join(','); }
            return content;
        case 'IFCCIRCLEPROFILEDEF':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[3] = scaleNum(a[3], factor); return a.join(','); }
            return content;
        case 'IFCCIRCLEHOLLOWPROFILEDEF':
            a = splitStepAttributes(content);
            if (a.length > 4) { a[3] = scaleNum(a[3], factor); a[4] = scaleNum(a[4], factor); return a.join(','); }
            return content;
        case 'IFCEXTRUDEDAREASOLID':
        case 'IFCSURFACEOFLINEAREXTRUSION':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[3] = scaleNum(a[3], factor); return a.join(','); }
            return content;
        case 'IFCBOUNDINGBOX':
        case 'IFCBLOCK':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[1] = scaleNum(a[1], factor); a[2] = scaleNum(a[2], factor); a[3] = scaleNum(a[3], factor); return a.join(','); }
            return content;
        case 'IFCSWEPTDISKSOLID':
            a = splitStepAttributes(content);
            if (a.length > 1) {
                a[1] = scaleNum(a[1], factor);
                if (a.length > 2 && a[2] !== '$') a[2] = scaleNum(a[2], factor);
                return a.join(',');
            }
            return content;
        case 'IFCCIRCLE':
        case 'IFCSPHERE':
            a = splitStepAttributes(content);
            if (a.length > 1) { a[1] = scaleNum(a[1], factor); return a.join(','); }
            return content;
        case 'IFCRIGHTCIRCULARCYLINDER':
        case 'IFCRIGHTCIRCULARCONE':
            a = splitStepAttributes(content);
            if (a.length > 2) { a[1] = scaleNum(a[1], factor); a[2] = scaleNum(a[2], factor); return a.join(','); }
            return content;
        case 'IFCBUILDINGSTOREY':
            a = splitStepAttributes(content);
            if (a.length > 9 && a[9] !== '$') { a[9] = scaleNum(a[9], factor); return a.join(','); }
            return content;
        case 'IFCSITE': 
            a = splitStepAttributes(content);
            if (a.length > 11 && a[11] !== '$') { a[11] = scaleNum(a[11], factor); return a.join(','); }
            return content;
        case 'IFCVECTOR': 
        case 'IFCCYLINDRICALSURFACE':
            a = splitStepAttributes(content);
            if (a.length > 1) { a[1] = scaleNum(a[1], factor); return a.join(','); }
            return content;
        case 'IFCELLIPSE':
            a = splitStepAttributes(content);
            if (a.length > 2) { a[1] = scaleNum(a[1], factor); a[2] = scaleNum(a[2], factor); return a.join(','); }
            return content;
        case 'IFCEXTRUDEDAREASOLIDTAPERED':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[3] = scaleNum(a[3], factor); return a.join(','); }
            return content;
        case 'IFCGEOMETRICREPRESENTATIONCONTEXT': 
            a = splitStepAttributes(content);
            if (a.length > 3 && a[3] !== '$') { a[3] = scaleNum(a[3], factor); return a.join(','); }
            return content;
        case 'IFCQUANTITYLENGTH':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[3] = scaleNum(a[3], factor); return a.join(','); }
            return content;
        case 'IFCQUANTITYAREA':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[3] = scaleNum(a[3], factor * factor); return a.join(','); }
            return content;
        case 'IFCQUANTITYVOLUME':
            a = splitStepAttributes(content);
            if (a.length > 3) { a[3] = scaleNum(a[3], factor * factor * factor); return a.join(','); }
            return content;
        case 'IFCPROPERTYSINGLEVALUE':
            return scaleTypedMeasures(content, factor);
        default:
            if (LENGTH_WATCH.has(type)) watchSet.add(type);
            return content;
    }
}
function isDedupType(type, includeColors) {
    if (type === 'IFCMATERIAL' || /^IFC[A-Z0-9]*PROFILEDEF$/.test(type) ||
        type === 'IFCPROPERTYSINGLEVALUE' || type === 'IFCQUANTITYLENGTH' ||
        type === 'IFCQUANTITYAREA' || type === 'IFCQUANTITYVOLUME' || type === 'IFCQUANTITYWEIGHT' ||
        type === 'IFCQUANTITYCOUNT' || type === 'IFCOWNERHISTORY' || type === 'IFCPERSONANDORGANIZATION' ||
        type === 'IFCAPPLICATION' || type === 'IFCORGANIZATION' || type === 'IFCPERSON' ||
        type === 'IFCUNITASSIGNMENT' || type === 'IFCSIUNIT') return true;
    if (includeColors && type === 'IFCCOLOURRGB') return true;
    return false;
}
class StepTokenizer {
    constructor() {
        this.inString = false;
        this.inComment = false;
        this.pendingQuote = false; 
        this.carryChar = '';       
        this.parts = [];           
    }
    feed(text, onEntity) {
        if (this.carryChar) { text = this.carryChar + text; this.carryChar = ''; }
        const n = text.length;
        let i = 0, start = 0, commentClosedAt = -1;
        if (this.pendingQuote) {
            this.pendingQuote = false;
            if (text[0] === "'") { i = 1; } else { this.inString = false; }
        }
        while (i < n) {
            const ch = text[i];
            if (this.inComment) {
                const e = text.indexOf('*/', i);
                if (e === -1) { start = n; i = n; break; }
                this.inComment = false; i = e + 2; start = i; commentClosedAt = i; continue;
            }
            if (this.inString) {
                if (ch === "'") {
                    if (i + 1 >= n) { this.pendingQuote = true; i++; continue; }
                    if (text[i + 1] === "'") { i += 2; continue; }
                    this.inString = false;
                }
                i++; continue;
            }
            if (ch === '/' && text[i + 1] === '*') {
                const seg = text.substring(start, i);
                if (seg) this.parts.push(seg);
                const e = text.indexOf('*/', i + 2);
                if (e === -1) { this.inComment = true; start = n; i = n; break; }
                i = e + 2; start = i; commentClosedAt = i; continue;
            }
            if (ch === "'") { this.inString = true; i++; continue; }
            if (ch === ';') {
                i++;
                let t = text.substring(start, i);
                if (this.parts.length) { this.parts.push(t); t = this.parts.join(''); this.parts.length = 0; }
                t = t.trim();
                start = i;
                if (t && onEntity(t) === true) return i;
                continue;
            }
            i++;
        }
        let end = n;
        if (n > 0) {
            const last = text[n - 1];
            if (this.inComment && last === '*') {
                this.carryChar = '*'; 
            } else if (!this.inComment && !this.inString && last === '/' && commentClosedAt !== n) {
                this.carryChar = '/'; end = n - 1;
            }
        }
        const rest = text.substring(start, end);
        if (rest) this.parts.push(rest);
        return -1;
    }
    flush() {
        if (this.carryChar) { this.parts.push(this.carryChar); this.carryChar = ''; }
        const t = this.parts.join('').trim(); this.parts.length = 0; return t;
    }
}
async function streamStepFile(file, opts = {}) {
    const collect = !!opts.collectEntities;
    const onProgress = opts.onProgress || null;
    const progressEvery = opts.progressEvery || 32 * 1048576;
    const SLICE = 8 * 1048576;
    let sliceOff = 0;
    const reader = { read: async () => {
        if (sliceOff >= file.size) return { done: true, value: undefined };
        const buf = await file.slice(sliceOff, sliceOff + SLICE).arrayBuffer();
        sliceOff += SLICE;
        return { done: sliceOff >= file.size, value: new Uint8Array(buf) };
    } };
    const fileName = opts.name || file.name || 'file';
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    let encoding = 'utf-8';
    if (head.length >= 2 && head[0] === 0xFF && head[1] === 0xFE) encoding = 'utf-16le';
    else if (head.length >= 2 && head[0] === 0xFE && head[1] === 0xFF) encoding = 'utf-16be';
    else if (head.length >= 4 && head[0] !== 0 && head[1] === 0 && head[2] !== 0 && head[3] === 0) encoding = 'utf-16le';
    const decoder = new TextDecoder(encoding);
    const UNIT_TYPES = new Set(['IFCUNITASSIGNMENT', 'IFCSIUNIT', 'IFCCONVERSIONBASEDUNIT']);
    let phase = 0; 
    let header = '', footer = '';
    const entities = collect ? [] : null;
    const ids = opts.collectIds ? [] : null;
    const firstOfType = {};
    const unitParts = [];
    let maxId = 0;
    let bytesDone = 0, nextProgress = progressEvery;
    const tok = new StepTokenizer();
    const consumeEntity = (raw) => {
        if (raw === 'ENDSEC;') return true; 
        if (raw.charCodeAt(0) === 35) {
            const n = raw.length;
            let i = 1, id = 0, c;
            while (i < n && (c = raw.charCodeAt(i)) >= 48 && c <= 57) { id = id * 10 + (c - 48); i++; }
            while (i < n && raw.charCodeAt(i) === 32) i++;
            if (raw.charCodeAt(i) === 61) {
                i++;
                while (i < n && raw.charCodeAt(i) === 32) i++;
                const ts = i;
                while (i < n && ((c = raw.charCodeAt(i)) >= 65 && c <= 90 || c >= 97 && c <= 122 || c >= 48 && c <= 57 || c === 95)) i++;
                if (i > ts) {
                    if (id > maxId) maxId = id;
                    if (ids) ids.push(id);
                    const type = raw.substring(ts, i).toUpperCase();
                    if (firstOfType[type] === undefined) firstOfType[type] = String(id);
                    if (UNIT_TYPES.has(type)) unitParts.push(raw);
                }
            }
        }
        if (entities) entities.push(raw);
        return false;
    };
    while (true) {
        const { done, value } = await reader.read();
        let text = value ? decoder.decode(value, { stream: !done }) : decoder.decode();
        if (value) bytesDone += value.byteLength;
        if (onProgress && bytesDone >= nextProgress) { onProgress(bytesDone, file.size); nextProgress += progressEvery; }
        if (phase === 0) {
            header += text;
            const di = header.indexOf('DATA;');
            if (di === -1) {
                if (done || header.length > 8 * 1048576) break; 
                continue;
            }
            text = header.substring(di + 5);
            header = header.substring(0, di);
            phase = 1;
        }
        if (phase === 1) {
            const stopAt = tok.feed(text, consumeEntity);
            if (stopAt !== -1) { phase = 2; footer = 'ENDSEC;' + text.substring(stopAt); }
        } else if (phase === 2) {
            footer += text;
        }
        if (done) break;
    }
    if (phase === 1) {
        const tail = tok.flush();
        if (tail) consumeEntity(tail);
        footer = 'ENDSEC;\nEND-ISO-10303-21;\n';
    }
    if (phase === 0) {
        const peek = header.replace(/[\r\n]+/g, ' ').slice(0, 120);
        throw new Error(`"${fileName}" has no DATA; section (${(file.size / 1048576).toFixed(1)} MB, decoded as ${encoding}). File starts with: ${peek}`);
    }
    return { header, footer, entities, ids, maxId, firstOfType, unitText: unitParts.join('\n') };
}
function normalizeFloatPrecision(str, decimals) {
    const segments = str.split(/('(?:[^']|'')*')/);
    for (let i = 0; i < segments.length; i += 2) {
        segments[i] = segments[i].replace(/(-?\d+\.\d+)/g, (match) => roundFloatSafe(match, decimals));
    }
    return segments.join('');
}
function newIfcGuid() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; 
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let big = 0n;
    for (let i = 0; i < 16; i++) big = (big << 8n) | BigInt(bytes[i]);
    const out = new Array(22);
    for (let i = 21; i >= 1; i--) { out[i] = chars[Number(big & 63n)]; big >>= 6n; }
    out[0] = chars[Number(big & 3n)];
    return out.join('');
}
function repairDuplicateGuids(entities, applyFix) {
    const guidAttrRe = /^'([0-9A-Za-z_$]{22})'$/;
    const strOrNull = (a) => a === '$' || (a.length >= 2 && a[0] === "'" && a[a.length - 1] === "'");
    const seen = new Set();
    const repairs = [];
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p) continue;
        const attrs = splitStepAttributes(p.content);
        if (attrs.length < 4) continue;
        const m = attrs[0].trim().match(guidAttrRe);
        if (!m) continue;
        if (!/^(#\d+|\$)$/.test(attrs[1].trim())) continue; 
        if (!strOrNull(attrs[2].trim())) continue;        
        if (!strOrNull(attrs[3].trim())) continue;        
        const g = m[1];
        if (!seen.has(g)) { seen.add(g); continue; }
        if (!applyFix) {
            repairs.push({ type: p.type, id: p.id, oldGuid: g, newGuid: null });
            continue;
        }
        let ng;
        do { ng = newIfcGuid(); } while (seen.has(ng));
        seen.add(ng);
        attrs[0] = `'${ng}'`;
        entities[i] = `#${p.id}= ${p.typeRaw}(${attrs.join(',')});`;
        repairs.push({ type: p.type, id: p.id, oldGuid: g, newGuid: ng });
    }
    return repairs;
}
function globalResourceDedup(entities, includeColors, floatNorm, dec) {
    const dict = new Map();
    const swap = new Map();
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p || !isDedupType(p.type, includeColors)) continue;
        const content = resolveReferences(p.content, swap);
        const hash = generateNormalizedHash(p.type, content, floatNorm, dec);
        if (dict.has(hash)) {
            swap.set(p.id, dict.get(hash));
        } else {
            dict.set(hash, p.id);
            entities[i] = `#${p.id}= ${p.typeRaw}(${content});`;
        }
    }
    if (swap.size === 0) return entities;
    const out = [];
    for (const raw of entities) {
        const p = parseEntity(raw);
        if (p && swap.has(p.id)) continue; 
        out.push(raw.includes('#') ? resolveReferences(raw, swap) : raw);
    }
    return out;
}
const PRESENTATION_STRIP_TYPES = new Set([
    'IFCSTYLEDITEM', 'IFCSTYLEDREPRESENTATION', 'IFCPRESENTATIONSTYLEASSIGNMENT',
    'IFCSTYLEASSIGNMENTSELECT', 'IFCSURFACESTYLE', 'IFCSURFACESTYLERENDERING',
    'IFCSURFACESTYLESHADING', 'IFCSURFACESTYLELIGHTING', 'IFCSURFACESTYLEWITHOUTBOUNDARIES',
    'IFCSURFACESTYLEWITHTEXTURES', 'IFCFILLAREASTYLE', 'IFCFILLAREASTYLEHATCHING',
    'IFCFILLAREASTYLETILESYMBOLWITHSTYLE', 'IFCCURVESTYLE', 'IFCCURVESTYLEFONT',
    'IFCCURVESTYLEFONTANDSCALING', 'IFCCURVESTYLEFONTSTYLE', 'IFCCURVESTYLEFONTPATTERN',
    'IFCTEXTSTYLE', 'IFCTEXTSTYLEFONTMODEL', 'IFCTEXTSTYLEFORDEFINEDFONT', 'IFCTEXTSTYLETEXTMODEL',
    'IFCPRESENTATIONLAYERASSIGNMENT', 'IFCPRESENTATIONLAYERWITHSTYLE',
    'IFCCOLOURRGB', 'IFCCOLOURSPECIFICATION', 'IFCDRAUGHTINGPREDEFINEDCOLOUR',
    'IFCDRAUGHTINGPREDEFINEDCURVESTYLEFONT', 'IFCINDEXEDCOLOURMAP',
    'IFCPIXELTEXTURE', 'IFCIMAGETEXTURE', 'IFCBLOBTEXTURE', 'IFCTEXTUREMAP',
    'IFCTEXTURECOORDINATE', 'IFCTEXTURECOORDINATEGENERATOR', 'IFCTEXTUREVERTEX',
    'IFCTEXTUREVERTEXLIST', 'IFCMATERIALDEFINITIONREPRESENTATION'
]);
function scrubRefs(raw, removed) {
    const p = parseEntity(raw);
    if (!p) {
        return mapRefsOutsideStrings(raw, (m, id) => removed.has(id) ? '$' : m);
    }
    const attrs = splitStepAttributes(p.content);
    let changed = false;
    for (let k = 0; k < attrs.length; k++) {
        const a = attrs[k].trim();
        if (a.startsWith('(') && a.endsWith(')')) {
            const inner = a.slice(1, -1);
            if (!inner.includes('#')) continue;
            const items = splitStepAttributes(inner);
            const kept = items.filter(it => {
                const mm = it.trim().match(/^#(\d+)$/);
                return !(mm && removed.has(mm[1]));
            });
            if (kept.length !== items.length) { attrs[k] = '(' + kept.join(',') + ')'; changed = true; }
        } else {
            const mm = a.match(/^#(\d+)$/);
            if (mm && removed.has(mm[1])) { attrs[k] = '$'; changed = true; }
        }
    }
    if (!changed) return raw;
    return `#${p.id}= ${p.typeRaw}(${attrs.join(',')});`;
}
function stripPresentationEntities(entities) {
    const removed = new Set();
    const kept = [];
    for (const raw of entities) {
        const p = parseEntity(raw);
        if (p && PRESENTATION_STRIP_TYPES.has(p.type)) { removed.add(p.id); continue; }
        kept.push(raw);
    }
    let scrubbed = 0;
    for (let i = 0; i < kept.length; i++) {
        if (!kept[i].includes('#')) continue;
        const before = kept[i];
        kept[i] = scrubRefs(kept[i], removed);
        if (kept[i] !== before) scrubbed++;
    }
    return { entities: kept, removed: removed.size, scrubbed };
}
function getSchema(ifcData) {
    const m = ifcData.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i);
    return m ? m[1].toUpperCase() : "UNKNOWN";
}
let ACTION_LABEL = 'IFC Merged';
function fmtMB(bytes) { return (bytes / 1048576).toFixed(2) + ' MB'; }
function safeComment(s) { return String(s).replace(/\*\
function buildBanner(moduleName, source, extraLines) {
    const lines = [
        '* IFC Operations with liteAECO.com',
        `* Action: ${ACTION_LABEL}`,
        `* Module: ${moduleName}`
    ];
    if (source) lines.push(`* Source: ${source}`);
    if (extraLines && extraLines.length) { lines.push('*'); for (const l of extraLines) lines.push('* ' + safeComment(l)); }
    return '';
}
function attachContextsToProject(entities, projectId, contextIds) {
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p || p.type !== 'IFCPROJECT' || p.id !== String(projectId)) continue;
        const attrs = splitStepAttributes(p.content);
        if (attrs.length < 9) return 0;
        const cur = attrs[7].trim();
        const existing = cur.startsWith('(') ? (cur.slice(1, -1).match(/#\d+/g) || []) : [];
        const set = new Set(existing);
        let added = 0;
        for (const id of contextIds) { const ref = '#' + id; if (!set.has(ref)) { set.add(ref); added++; } }
        attrs[7] = '(' + Array.from(set).join(',') + ')';
        entities[i] = `#${p.id}= ${p.typeRaw}(${attrs.join(',')});`;
        return added;
    }
    return 0;
}
function extractStoreys(entities) {
    const storeys = [];
    for (const raw of entities) {
        const p = parseEntity(raw);
        if (!p || p.type !== 'IFCBUILDINGSTOREY') continue;
        const attrs = splitStepAttributes(p.content);
        const name = attrs.length > 2 ? normStoreyName(attrs[2]) : null;
        const elevationStr = attrs.length > 9 ? attrs[9] : '$';
        const elevation = elevationStr !== '$' ? parseFloat(elevationStr) : null;
        storeys.push({ id: p.id, name, elevation });
    }
    return storeys;
}
function wlog(msg, warn) { self.postMessage({ type: 'log', msg, warn: !!warn }); }
let coord = null;      
let childState = null; 
class ScratchStore {
    static async create(useDisk) {
        const s = new ScratchStore();
        try {
            if (useDisk && typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
                const root = await navigator.storage.getDirectory();
                s.dir = await root.getDirectoryHandle('liteaeco-merge', { create: true });
                s.prefix = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '_';
                const fh = await s.dir.getFileHandle(s.prefix + 'probe', { create: true });
                const h = await fh.createSyncAccessHandle(); h.close();
                await s.dir.removeEntry(s.prefix + 'probe');
                s.kind = 'opfs';
            }
        } catch (e) { s.dir = null; }
        if (!s.dir) { s.kind = 'memory'; s.mem = new Map(); }
        return s;
    }
    async put(key, value) {
        if (this.kind === 'memory') { this.mem.set(key, value); return; }
        const bytes = (value instanceof Uint8Array) ? value : new TextEncoder().encode(value.join('\0'));
        const fh = await this.dir.getFileHandle(this.prefix + key, { create: true });
        const h = await fh.createSyncAccessHandle();
        try { h.truncate(0); h.write(bytes, { at: 0 }); h.flush(); } finally { h.close(); }
    }
    async get(key) {
        let v;
        if (this.kind === 'memory') { v = this.mem.get(key); this.mem.delete(key); }
        else v = await this._readBytes(key);
        return (v instanceof Uint8Array) ? new TextDecoder().decode(v).split('\0') : v;
    }
    async _readBytes(key) {
        const fh = await this.dir.getFileHandle(this.prefix + key);
        const h = await fh.createSyncAccessHandle();
        let out;
        try { const size = h.getSize(); out = new Uint8Array(size); h.read(out, { at: 0 }); } finally { h.close(); }
        try { await this.dir.removeEntry(this.prefix + key); } catch (e) { }
        return out;
    }
    async cleanup() {
        if (this.kind === 'memory') { this.mem.clear(); return; }
        try { for await (const name of this.dir.keys()) if (name.startsWith(this.prefix)) await this.dir.removeEntry(name); } catch (e) { }
    }
}
async function coordMaster(d) {
    const o = d.options;
    let source = d.file;
    let deepUsed = false;
    const store = await ScratchStore.create(!!o.useScratchDisk);
    wlog(`Scratch storage: ${store.kind === 'opfs' ? 'OPFS (disk-backed)' : 'memory'}.`);
    if (o.optDeepCompress) {
        wlog(`Master: Deep Graph Compression (per-file, ${(d.file.size / 1048576).toFixed(1)} MB)...`);
        try {
            const scan = await streamStepFile(d.file, { collectEntities: false, collectIds: true });
            const out = await runOptimizationCore({
                buffer: await d.file.arrayBuffer(),
                optStripPsets: !!o.optStripPsets,
                optStripPresentation: !!o.optStripPresentation,
                initialMaxId: scan.maxId,
                validModelIDs: scan.ids
            });
            source = new Blob([out]);
            deepUsed = true;
            wlog(`Master: compressed to ${(source.size / 1048576).toFixed(1)} MB.`);
        } catch (err) {
            wlog(`Master: deep compression failed (${err.message}); using the original file.`, true);
        }
    }
    wlog(`Master: streaming ${(source.size / 1048576).toFixed(1)} MB...`);
    const m = await streamStepFile(source, {
        collectEntities: true,
        onProgress: (done, total) => wlog(`Master: ${(done / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB read...`)
    });
    let entities = m.entities;
    const unit = getLengthUnit(m.unitText);
    const schema = getSchema(m.header);
    const pProject = m.firstOfType.IFCPROJECT || null;
    if (!pProject) throw new Error("Missing IFCPROJECT root node in the Master File.");
    const pTrees = {
        pProject,
        pSite: m.firstOfType.IFCSITE || null,
        pBuilding: m.firstOfType.IFCBUILDING || null,
        pOwnerHistory: m.firstOfType.IFCOWNERHISTORY || null,
        pStoreys: (o.optStorey !== 'keep' && o.optBuilding === 'merge') ? extractStoreys(entities) : []
    };
    wlog(`Master: parsed ${entities.length} entities (max #${m.maxId}).`);
    const resourceDict = new Map();
    const swap = new Map();
    if (o.optResourceDedup) {
        for (let i = 0; i < entities.length; i++) {
            const p = parseEntity(entities[i]);
            if (!p || !isDedupType(p.type, o.optDedupColors)) continue;
            const content = resolveReferences(p.content, swap);
            const hash = generateNormalizedHash(p.type, content, o.optFloatPrecision, o.floatPrecisionVal);
            if (resourceDict.has(hash)) swap.set(p.id, resourceDict.get(hash));
            else resourceDict.set(hash, p.id);
        }
        wlog(`Indexed ${resourceDict.size} unique resources. Found ${swap.size} internal redundancies in Master file.`);
        if (swap.size > 0) {
            const probe = makeSwapProbe(swap);
            const kept = [];
            for (const raw of entities) {
                const p = parseEntity(raw);
                if (p && swap.has(p.id)) continue;
                kept.push(raw.includes('#') ? resolveReferences(raw, swap, probe) : raw);
            }
            entities = kept;
        }
    }
    await store.put('src0', entities); 
    entities = null;
    coord = { store, header: m.header, footer: m.footer, maxId: m.maxId, unit, pTrees, contextIds: [], sources: [{ key: 'src0', name: d.fileName || d.file.name || 'master', size: d.file.size }], deepUsed };
    return { maxId: m.maxId, unit, schema, pTrees, masterDictArray: Array.from(resourceDict.entries()) };
}
async function coordGraft(d) {
    if (!coord) throw new Error("Coordinator not initialised (call 'master' first).");
    const key = 'src' + coord.sources.length;
    await coord.store.put(key, new Uint8Array(d.buffer));
    coord.sources.push({ key, name: d.fileName, size: d.fileSize || 0 });
    if (d.contextIds) coord.contextIds.push(...d.contextIds);
    return { stored: key, bytes: d.buffer.byteLength };
}
function encodeRecs(recs) {
    const enc = new TextEncoder();
    const parts = [];
    const CHUNK = 50000;
    for (let i = 0; i < recs.length; i += CHUNK) {
        parts.push(enc.encode(recs.slice(i, i + CHUNK).map(r => r.text).join('\n') + '\n').buffer);
    }
    return parts;
}
function newFinalizeState(o) {
    return {
        o,
        dict: new Map(), swap: new Map(),
        seenGuids: new Set(), guidRepairs: [],
        dedupRemoved: 0, stripRemoved: 0, stripScrubbed: 0, charsReduced: 0, total: 0
    };
}
function processSource(entities, st, hooks) {
    const o = st.o;
    const dedup = !!o.dedupResources;
    const guidMode = o.guidRepair || 'off'; 
    const guidAttrRe = /^'([0-9A-Za-z_$]{22})'$/;
    const strOrNull = (a) => a === '$' || (a.length >= 2 && a[0] === "'" && a[a.length - 1] === "'");
    if (hooks && hooks.before) hooks.before(entities);
    if (dedup) {
        for (let i = 0; i < entities.length; i++) {
            const p = parseEntity(entities[i]);
            if (!p || !isDedupType(p.type, o.optDedupColors)) continue;
            const content = resolveReferences(p.content, st.swap);
            const hash = generateNormalizedHash(p.type, content, o.optFloatPrecision, o.floatPrecisionVal);
            if (st.dict.has(hash)) { st.swap.set(p.id, st.dict.get(hash)); st.dedupRemoved++; }
            else { st.dict.set(hash, p.id); entities[i] = `#${p.id}= ${p.typeRaw}(${content});`; }
        }
    }
    const probe = dedup ? makeSwapProbe(st.swap) : null;
    const removed = new Set();
    if (o.optStripPresentation) {
        for (const raw of entities) {
            const p = parseEntity(raw);
            if (p && PRESENTATION_STRIP_TYPES.has(p.type)) removed.add(p.id);
        }
    }
    const recs = [];
    for (let i = 0; i < entities.length; i++) {
        let raw = entities[i];
        entities[i] = null;
        const p = parseEntity(raw);
        if (p) {
            if (dedup && st.swap.has(p.id)) continue;
            if (removed.size && removed.has(p.id)) { st.stripRemoved++; continue; }
        }
        if (dedup && st.swap.size && raw.includes('#')) raw = resolveReferences(raw, st.swap, probe);
        if (removed.size && raw.includes('#')) { const b = raw; raw = scrubRefs(raw, removed); if (raw !== b) st.stripScrubbed++; }
        if (guidMode !== 'off' && p && p.content.charCodeAt(0) === 39 && p.content.charCodeAt(23) === 39 && p.content.charCodeAt(24) === 44) {
            const attrs = splitStepAttributes(p.content);
            if (attrs.length >= 4) {
                const m = attrs[0].trim().match(guidAttrRe);
                if (m && /^(#\d+|\$)$/.test(attrs[1].trim()) && strOrNull(attrs[2].trim()) && strOrNull(attrs[3].trim())) {
                    const g = m[1];
                    if (!st.seenGuids.has(g)) st.seenGuids.add(g);
                    else if (guidMode === 'fix') {
                        let ng; do { ng = newIfcGuid(); } while (st.seenGuids.has(ng));
                        st.seenGuids.add(ng);
                        const q = parseEntity(raw); const a2 = splitStepAttributes(q.content);
                        a2[0] = `'${ng}'`;
                        raw = `#${q.id}= ${q.typeRaw}(${a2.join(',')});`;
                        st.guidRepairs.push({ type: p.type, id: p.id, oldGuid: g, newGuid: ng });
                    } else st.guidRepairs.push({ type: p.type, id: p.id, oldGuid: g, newGuid: null });
                }
            }
        }
        if (o.optFloatPrecision && raw.indexOf('.') !== -1) { const b = raw; raw = normalizeFloatPrecision(raw, o.floatPrecisionVal); st.charsReduced += b.length - raw.length; }
        if (p) recs.push({ id: parseInt(p.id, 10), text: raw });
        else { const mm = raw.match(/^#(\d+)\s*=/); if (mm) recs.push({ id: parseInt(mm[1], 10), text: raw }); }
    }
    recs.sort((a, b) => a.id - b.id);
    st.total += recs.length;
    return encodeRecs(recs);
}
function logFinalizeSummary(st, label) {
    const o = st.o;
    if (o.dedupResources) wlog(`${label}: removed ${st.dedupRemoved} duplicate resource(s).`);
    if (st.guidRepairs.length > 0) {
        if (o.guidRepair === 'fix') wlog(`GlobalId repair: regenerated ${st.guidRepairs.length} duplicate GlobalId(s):`);
        else wlog(`⚠ Found ${st.guidRepairs.length} duplicate GlobalId(s) — left untouched. Duplicate GlobalIds are invalid IFC; enable the repair option to fix them.`, true);
        const detail = st.guidRepairs.slice(0, 20);
        for (const r of detail) wlog(`  ${r.type} #${r.id}: ${r.oldGuid}${r.newGuid ? ' -> ' + r.newGuid : ''}`);
        if (st.guidRepairs.length > detail.length) wlog(`  ... and ${st.guidRepairs.length - detail.length} more.`);
    }
    if (o.optStripPresentation) wlog(`Presentation strip: removed ${st.stripRemoved} styling entities, scrubbed ${st.stripScrubbed} reference(s).`);
    if (o.optFloatPrecision) wlog(`Float normalization (${o.floatPrecisionVal} dp): removed ~${st.charsReduced.toLocaleString()} characters.`);
    wlog(`Sorted ${st.total} entities sequentially.`);
}
function headerBytes(header, moduleName, extraLines) {
    return new TextEncoder().encode(header.replace(/\/\*[\s\S]*?\*\
}
async function coordFinalize(d) {
    if (!coord) throw new Error("Coordinator not initialised (call 'master' first).");
    const o = d.options;
    const st = newFinalizeState({
        dedupResources: o.optLevel === 'high',
        guidRepair: o.optLevel !== 'none' ? 'fix' : 'report',
        optDedupColors: o.optDedupColors, optFloatPrecision: o.optFloatPrecision, floatPrecisionVal: o.floatPrecisionVal,
        optStripPresentation: o.optStripPresentation
    });
    const srcLines = [`Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, 'Source files:'];
    coord.sources.forEach((s, i) => srcLines.push(`  ${i === 0 ? 'Parent' : 'Child ' + i}: ${s.name} (${fmtMB(s.size)})`));
    const parts = [headerBytes(coord.header, coord.deepUsed ? 'web-ifc/IfcLoader V.0.0.77 + liteAECO text engine' : 'liteAECO text engine', srcLines)];
    let attached = 0;
    for (let s = 0; s < coord.sources.length; s++) {
        const src = coord.sources[s];
        const entities = await coord.store.get(src.key);
        wlog(`Finalize ${s + 1}/${coord.sources.length}: ${src.name} (${entities.length} entities)...`);
        const hooks = (s === 0 && coord.contextIds.length > 0)
            ? { before: (ents) => { attached = attachContextsToProject(ents, coord.pTrees.pProject, coord.contextIds); } }
            : null;
        for (const p of processSource(entities, st, hooks)) parts.push(p);
    }
    parts.push(new TextEncoder().encode(coord.footer).buffer);
    if (attached) wlog(`Attached ${attached} child representation context(s) to master IfcProject #${coord.pTrees.pProject}.`);
    logFinalizeSummary(st, 'Global resource dedup');
    const bytes = parts.reduce((n, p) => n + p.byteLength, 0);
    await coord.store.cleanup();
    coord = null;
    return { parts, bytes };
}
async function optimizeFile(d) {
    const o = d.options;
    ACTION_LABEL = 'IFC Optimized';
    const fileName = d.fileName || d.file.name || 'file';
    let source = d.file;
    let deepUsed = false;
    if (o.optDeepCompress) {
        wlog(`Deep Graph Compression (${(d.file.size / 1048576).toFixed(1)} MB)...`);
        try {
            const scan = await streamStepFile(d.file, { collectEntities: false, collectIds: true, name: fileName });
            const out = await runOptimizationCore({
                buffer: await d.file.arrayBuffer(),
                optStripPsets: !!o.optStripPsets,
                optStripPresentation: !!o.optStripPresentation,
                initialMaxId: scan.maxId,
                validModelIDs: scan.ids
            });
            source = new Blob([out]);
            deepUsed = true;
            wlog(`Deep compression: ${(d.file.size / 1048576).toFixed(1)} MB -> ${(source.size / 1048576).toFixed(1)} MB.`);
        } catch (err) {
            wlog(`Deep compression failed (${err.message}); continuing with the original file.`, true);
        }
    }
    wlog(`Streaming ${(source.size / 1048576).toFixed(1)} MB...`);
    const m = await streamStepFile(source, {
        collectEntities: true, name: fileName,
        onProgress: (done, total) => wlog(`${(done / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB read...`)
    });
    wlog(`Parsed ${m.entities.length} entities (max #${m.maxId}), schema ${getSchema(m.header)}, unit ${getLengthUnit(m.unitText)}.`);
    const st = newFinalizeState({
        dedupResources: true,
        guidRepair: o.guidRepair || 'fix',
        optDedupColors: !!o.optDedupColors, optFloatPrecision: !!o.optFloatPrecision, floatPrecisionVal: o.floatPrecisionVal || 6,
        optStripPresentation: !!o.optStripPresentation
    });
    const srcLines = [`Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, `Source file: ${fileName} (${fmtMB(d.file.size)})`];
    const parts = [headerBytes(m.header, deepUsed ? 'web-ifc/IfcLoader V.0.0.77 + liteAECO text engine' : 'liteAECO text engine', srcLines)];
    for (const p of processSource(m.entities, st, null)) parts.push(p);
    parts.push(new TextEncoder().encode(m.footer).buffer);
    logFinalizeSummary(st, 'Resource dedup');
    const bytes = parts.reduce((n, p) => n + p.byteLength, 0);
    return { parts, bytes };
}
async function coordAbort() {
    if (coord && coord.store) await coord.store.cleanup();
    coord = null;
    return { ok: true };
}
let psetSession = null;
function decodeIfcString(s) {
    if (!s || s.indexOf("\\") === -1 && s.indexOf("''") === -1) return s;
    let out = s.replace(/''/g, "'");
    out = out.replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (m, hex) => {
        let r = '';
        for (let i = 0; i + 4 <= hex.length; i += 4) r += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
        return r;
    });
    out = out.replace(/\\X\\([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
    return out;
}
function encodeIfcString(s) {
    let out = '', x2 = false;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        if (c > 126 || c < 32) {
            if (!x2) { out += '\\X2\\'; x2 = true; }
            out += c.toString(16).toUpperCase().padStart(4, '0');
        } else {
            if (x2) { out += '\\X0\\'; x2 = false; }
            if (c === 39) out += "''";
            else if (c === 92) out += '\\\\';
            else out += ch;
        }
    }
    if (x2) out += '\\X0\\';
    return out;
}
function unq(a) {
    if (!a || a === '$') return null;
    const t = a.trim();
    return (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") ? decodeIfcString(t.slice(1, -1)) : t;
}
function isRootedEntity(p) {
    return p.content.charCodeAt(0) === 39 && p.content.charCodeAt(23) === 39 && p.content.charCodeAt(24) === 44;
}
async function psetLoad(d) {
    const fileName = d.fileName || d.file.name || 'model';
    const m = await streamStepFile(d.file, {
        collectEntities: true, name: fileName,
        onProgress: (done, total) => wlog(`${(done / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB read...`)
    });
    const entities = m.entities;
    wlog(`Parsed ${entities.length} entities (max #${m.maxId}).`);
    const psets = new Map();        
    const relDefs = [];             
    const rootedByType = new Map(); 
    const typeLevel = [];           
    let app = null, person = null, site = null, headerDate = null;
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p) continue;
        const idNum = parseInt(p.id, 10);
        const T = p.type;
        if (T === 'IFCPROPERTYSET' || T === 'IFCELEMENTQUANTITY') {
            const a = splitStepAttributes(p.content);
            psets.set(idNum, { name: unq(a[2]) || 'Unnamed_Pset', type: T });
            continue;
        }
        if (T === 'IFCRELDEFINESBYPROPERTIES') {
            const a = splitStepAttributes(p.content);
            const pd = (a[5] || '').match(/#(\d+)/);
            if (pd) {
                const refs = ((a[4] || '').match(/#\d+/g) || []).map(x => parseInt(x.slice(1), 10));
                relDefs.push({ psetId: parseInt(pd[1], 10), objIds: refs });
            }
            continue;
        }
        if (T === 'IFCAPPLICATION' && !app) { const a = splitStepAttributes(p.content); app = unq(a[2]); continue; }
        if (T === 'IFCPERSON' && !person) {
            const a = splitStepAttributes(p.content);
            person = [unq(a[2]), unq(a[1])].filter(Boolean).join(' ') || null; continue;
        }
        if (T === 'IFCSITE' && !site) {
            const a = splitStepAttributes(p.content);
            site = { lat: a[9] || '$', lon: a[10] || '$', elev: a[11] || '$' };
        }
        if (!T.startsWith('IFCREL') && !T.startsWith('IFCPROPERTY') && isRootedEntity(p)) {
            let set = rootedByType.get(T);
            if (!set) { set = new Set(); rootedByType.set(T, set); }
            set.add(idNum);
        }
    }
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p || !isRootedEntity(p) || p.type.startsWith('IFCREL') || p.type.startsWith('IFCPROPERTY')) continue;
        const a = splitStepAttributes(p.content);
        const hps = a[5] && a[5].trim();
        if (!hps || hps[0] !== '(') continue;
        const refs = (hps.match(/#\d+/g) || []).map(x => parseInt(x.slice(1), 10));
        if (refs.length === 0 || !refs.every(r => psets.has(r))) continue;
        typeLevel.push({ objId: parseInt(p.id, 10), type: p.type, psetIds: refs });
    }
    const idClass = new Map();
    for (const [type, set] of rootedByType) for (const id of set) idClass.set(id, type);
    const classData = {};
    const classObjects = {}; 
    const ensure = (cls, psetName) => {
        (classData[cls] || (classData[cls] = {}));
        return classData[cls][psetName] || (classData[cls][psetName] = { psetIds: new Set(), objectIds: new Set() });
    };
    for (const cls of rootedByType.keys()) classData[cls] = classData[cls] || {};
    let typeLevelLinks = 0;
    for (const rel of relDefs) {
        const ps = psets.get(rel.psetId);
        if (!ps) continue;
        for (const objId of rel.objIds) {
            const cls = idClass.get(objId);
            if (!cls) continue;
            const e = ensure(cls, ps.name);
            e.psetIds.add(rel.psetId);
            e.objectIds.add(objId);
        }
    }
    for (const t of typeLevel) {
        for (const pid of t.psetIds) {
            const ps = psets.get(pid);
            if (!ps) continue;
            const e = ensure(t.type, ps.name);
            e.psetIds.add(pid);
            e.objectIds.add(t.objId);
            typeLevelLinks++;
        }
    }
    if (typeLevelLinks > 0) wlog(`Added ${typeLevelLinks} type-level Property Set link(s) from IfcTypeObject.HasPropertySets.`);
    const classDataOut = {};
    const classCounts = {};
    for (const cls in classData) {
        classDataOut[cls] = {};
        const uniq = new Set();
        for (const psetName in classData[cls]) {
            const e = classData[cls][psetName];
            classDataOut[cls][psetName] = { psetIds: Array.from(e.psetIds), objectCount: e.objectIds.size };
            for (const id of e.objectIds) uniq.add(id);
        }
        classCounts[cls] = uniq.size;
    }
    const psetNameToIds = {};
    for (const [id, ps] of psets) (psetNameToIds[ps.name] || (psetNameToIds[ps.name] = [])).push(id);
    const dm = m.header.match(/FILE_NAME\([^,]*,[^\d]*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    headerDate = dm ? dm[1].replace('T', ' ') : null;
    const CHILD_ATTR = { IFCPROPERTYSET: 4, IFCELEMENTQUANTITY: 5, IFCCOMPLEXPROPERTY: 3, IFCPHYSICALCOMPLEXQUANTITY: 2 };
    const entityById = new Map();
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (p && (p.type.startsWith('IFCPROPERTY') || p.type.startsWith('IFCQUANTITY') || p.type.startsWith('IFCCOMPLEX') || p.type.startsWith('IFCPHYSICAL') || p.type.startsWith('IFCELEMENTQUANTITY'))) {
            entityById.set(p.id, p);
        }
    }
    const psetChildren = new Map();      
    const childParents = new Map();      
    const collectChildren = (p, rootPsetId, depth) => {
        if (depth > 8) return;
        const idx = CHILD_ATTR[p.type];
        if (idx === undefined) return;
        const a = splitStepAttributes(p.content);
        const refs = ((a[idx] || '').match(/#\d+/g) || []).map(x => x.slice(1));
        for (const cid of refs) {
            psetChildren.get(rootPsetId).add(cid);
            let s = childParents.get(cid);
            if (!s) { s = new Set(); childParents.set(cid, s); }
            s.add(rootPsetId);
            const child = entityById.get(cid);
            if (child) collectChildren(child, rootPsetId, depth + 1);
        }
    };
    for (const [idNum] of psets) {
        const key = String(idNum);
        psetChildren.set(key, new Set());
        const p = entityById.get(key);
        if (p) collectChildren(p, key, 0);
    }
    psetSession = { entities, header: m.header, footer: m.footer, maxId: m.maxId, fileName, fileSize: d.file.size, psets, psetChildren, childParents };
    wlog(`Indexed ${Object.keys(psetNameToIds).length} unique Property Set / Quantity names globally.`);
    wlog(`Mapping complete. Found ${Object.keys(classDataOut).length} unique IFC Classes.`);
    return {
        meta: {
            schema: getSchema(m.header), date: headerDate, app, person, site,
            unit: getLengthUnit(m.unitText), maxId: m.maxId, entityCount: entities.length, sizeBytes: d.file.size
        },
        classData: classDataOut, classCounts, psetNameToIds
    };
}
function pruneRefList(attrValue, deletedIds) {
    if (!attrValue || attrValue === '$' || attrValue === '*') return attrValue;
    const t = attrValue.trim();
    if (!t.startsWith('(') || !t.endsWith(')')) return attrValue;
    const refs = t.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean)
        .filter(v => { const m = v.match(/^#(\d+)$/); return !(m && deletedIds.has(m[1])); });
    return refs.length > 0 ? `(${refs.join(',')})` : '$';
}
async function psetApply(d) {
    if (!psetSession) throw new Error("psetApply: no model loaded (call 'psetLoad' first).");
    const ops = d.ops || {};
    const renames = ops.renames || {};
    const deleteSet = new Set((ops.deletePsetIds || []).map(String));
    ACTION_LABEL = ops.actionLabel || 'PSet Modified';
    const childDeleteSet = new Set();
    if (deleteSet.size && psetSession.childParents) {
        for (const [cid, parents] of psetSession.childParents) {
            let all = true;
            for (const pid of parents) if (!deleteSet.has(pid)) { all = false; break; }
            if (all) childDeleteSet.add(cid);
        }
    }
    const deletedNames = new Set();
    if (deleteSet.size && psetSession.psets) {
        for (const id of deleteSet) { const ps = psetSession.psets.get(parseInt(id, 10)); if (ps) deletedNames.add(ps.name); }
    }
    let renamed = 0, deleted = 0, relPruned = 0, childDeleted = 0, typeCleaned = 0, scrubbed = 0;
    const entities = psetSession.entities;
    const recs = [];
    for (let i = 0; i < entities.length; i++) {
        let raw = entities[i];
        const p = parseEntity(raw);
        if (!p) continue;
        if (deleteSet.size) {
            if (deleteSet.has(p.id) && (p.type === 'IFCPROPERTYSET' || p.type === 'IFCELEMENTQUANTITY')) { deleted++; continue; }
            if (childDeleteSet.has(p.id) && (p.type.startsWith('IFCPROPERTY') || p.type.startsWith('IFCQUANTITY') || p.type.startsWith('IFCCOMPLEX') || p.type.startsWith('IFCPHYSICAL'))) { childDeleted++; continue; }
            if (p.type === 'IFCRELDEFINESBYPROPERTIES') {
                const a = splitStepAttributes(p.content);
                const relDef = a[a.length - 1] || '';
                const refIDs = Array.from(relDef.matchAll(/#(\d+)/g)).map(x => x[1]);
                const remaining = refIDs.filter(id => !deleteSet.has(id));
                if (refIDs.length > 0 && remaining.length === 0) { relPruned++; continue; }
                if (remaining.length < refIDs.length) {
                    a[a.length - 1] = remaining.length === 1 ? `#${remaining[0]}` : `(${remaining.map(id => '#' + id).join(',')})`;
                    raw = `#${p.id}= ${p.typeRaw}(${a.join(',')});`;
                }
            } else if (isRootedEntity(p) && !p.type.startsWith('IFCREL') && !p.type.startsWith('IFCPROPERTY') && raw.includes('#')) {
                const a = splitStepAttributes(p.content);
                if (a.length > 5 && a[5] && a[5].trim().startsWith('(')) {
                    const before = a[5];
                    a[5] = pruneRefList(a[5], deleteSet);
                    if (a[5] !== before) { raw = `#${p.id}= ${p.typeRaw}(${a.join(',')});`; typeCleaned++; }
                }
            }
        }
        const newName = renames[p.id];
        if (newName !== undefined && (p.type === 'IFCPROPERTYSET' || p.type === 'IFCELEMENTQUANTITY')) {
            const q = parseEntity(raw);
            const a = splitStepAttributes(q.content);
            if (a.length > 2) {
                a[2] = `'${encodeIfcString(newName)}'`;
                raw = `#${q.id}= ${q.typeRaw}(${a.join(',')});`;
                renamed++;
            }
        }
        recs.push({ id: parseInt(p.id, 10), text: raw });
    }
    for (const raw of (ops.newEntities || [])) {
        const mm = raw.match(/^#(\d+)\s*=/);
        if (mm) recs.push({ id: parseInt(mm[1], 10), text: raw });
    }
    recs.sort((a, b) => a.id - b.id);
    const srcLines = [`Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`,
                      `Source file: ${psetSession.fileName} (${fmtMB(psetSession.fileSize)})`];
    if (deletedNames.size) srcLines.push(`Deleted PSets: ${Array.from(deletedNames).join(', ')}`);
    const parts = [headerBytes(psetSession.header, 'liteAECO text engine', srcLines)];
    for (const p of encodeRecs(recs)) parts.push(p);
    parts.push(new TextEncoder().encode(psetSession.footer).buffer);
    if (renamed) wlog(`Renamed ${renamed} Property Set definition(s).`);
    if (deleted || relPruned || childDeleted) wlog(`Removed ${deleted} Pset / Quantity definition(s), ${relPruned} IfcRelDefinesByProperties relationship(s), and ${childDeleted} orphan-safe property / quantity child definition(s).`);
    if (typeCleaned) wlog(`Cleaned deleted Pset references from ${typeCleaned} type object definition(s).`);
    const bytes = parts.reduce((n, p) => n + p.byteLength, 0);
    return { parts, bytes, renamed, deleted, relPruned, childDeleted, typeCleaned, deletedNames: Array.from(deletedNames) };
}
function stepValueToPlain(v) {
    if (v === undefined || v === null) return '';
    let t = String(v).trim();
    if (t === '' || t === '$' || t === '*') return '';
    const w = t.match(/^IFC[A-Z0-9_]*\s*\(([\s\S]*)\)$/i);
    if (w) t = w[1].trim();
    if (t === '.T.') return 'TRUE';
    if (t === '.F.') return 'FALSE';
    if (t === '.U.') return 'UNKNOWN';
    const en = t.match(/^\.([A-Z0-9_]+)\.$/);
    if (en) return en[1];
    if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") return decodeIfcString(t.slice(1, -1));
    if (t[0] === '(') {
        return splitStepAttributes(t.slice(1, -1)).map(stepValueToPlain).filter(x => x !== '').join('; ');
    }
    return t;
}
function extractPropValueFromEntity(p) {
    const a = splitStepAttributes(p.content);
    switch (p.type) {
        case 'IFCPROPERTYSINGLEVALUE': return stepValueToPlain(a[2]);
        case 'IFCPROPERTYENUMERATEDVALUE': return stepValueToPlain(a[2]);
        case 'IFCPROPERTYLISTVALUE': return stepValueToPlain(a[2]);
        case 'IFCPROPERTYBOUNDEDVALUE': {
            const hi = stepValueToPlain(a[2]), lo = stepValueToPlain(a[3]), sp = stepValueToPlain(a[5]);
            const parts = [];
            if (lo !== '') parts.push(`min ${lo}`);
            if (hi !== '') parts.push(`max ${hi}`);
            if (sp !== '') parts.push(`set ${sp}`);
            return parts.join('; ');
        }
        case 'IFCPROPERTYTABLEVALUE': {
            const def = a[2] && a[2].trim().startsWith('(') ? splitStepAttributes(a[2].trim().slice(1, -1)) : [];
            const val = a[3] && a[3].trim().startsWith('(') ? splitStepAttributes(a[3].trim().slice(1, -1)) : [];
            return def.map((d, k) => `${stepValueToPlain(d)}=${stepValueToPlain(val[k])}`).join('; ');
        }
        case 'IFCPROPERTYREFERENCEVALUE': return (a[3] || '').trim();
        case 'IFCQUANTITYLENGTH': case 'IFCQUANTITYAREA': case 'IFCQUANTITYVOLUME':
        case 'IFCQUANTITYWEIGHT': case 'IFCQUANTITYCOUNT': case 'IFCQUANTITYTIME':
            return stepValueToPlain(a[3]);
        default: return '';
    }
}
async function psetTable(d) {
    if (!psetSession) throw new Error("psetTable: no model loaded (call 'psetLoad' first).");
    const wantCls = new Set(d.classes || []);
    const wantPsets = new Set(d.psetNames || []);
    const entities = psetSession.entities;
    const selPsets = new Map();   
    const propMap = new Map();    
    const relDefs = [];           
    const objInfo = new Map();    
    const typeLevel = [];         
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p) continue;
        const T = p.type;
        if (T === 'IFCPROPERTYSET' || T === 'IFCELEMENTQUANTITY') {
            const a = splitStepAttributes(p.content);
            const name = unq(a[2]) || 'Unnamed_Pset';
            if (wantPsets.has(name)) selPsets.set(p.id, { name });
            continue;
        }
        if (T.startsWith('IFCPROPERTY') || T.startsWith('IFCQUANTITY') || T === 'IFCCOMPLEXPROPERTY' || T === 'IFCPHYSICALCOMPLEXQUANTITY') {
            propMap.set(p.id, p); continue;
        }
        if (T === 'IFCRELDEFINESBYPROPERTIES') {
            const a = splitStepAttributes(p.content);
            const pd = (a[5] || '').match(/#(\d+)/);
            if (pd) relDefs.push({ psetId: pd[1], objIds: ((a[4] || '').match(/#\d+/g) || []).map(x => x.slice(1)) });
            continue;
        }
        if (!T.startsWith('IFCREL') && isRootedEntity(p) && wantCls.has(T)) {
            const a = splitStepAttributes(p.content);
            objInfo.set(p.id, { cls: T, g: unq(a[0]) || '[No GUID]', n: unq(a[2]) || '[Unnamed]' });
            const hps = a[5] && a[5].trim();
            if (hps && hps[0] === '(') {
                const refs = (hps.match(/#\d+/g) || []).map(x => x.slice(1));
                if (refs.length) typeLevel.push({ objId: p.id, psetIds: refs });
            }
        }
    }
    const psetPropsCache = new Map(); 
    const CHILD_ATTR = { IFCPROPERTYSET: 4, IFCELEMENTQUANTITY: 5, IFCCOMPLEXPROPERTY: 3, IFCPHYSICALCOMPLEXQUANTITY: 2 };
    const psetEntityById = new Map();
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (p && selPsets.has(p.id)) psetEntityById.set(p.id, p);
    }
    const flattenPset = (psetId) => {
        if (psetPropsCache.has(psetId)) return psetPropsCache.get(psetId);
        const out = {};
        const psetName = selPsets.get(psetId).name;
        const walk = (p, prefix, depth) => {
            if (depth > 8) return;
            const idx = CHILD_ATTR[p.type];
            if (idx === undefined) return;
            const a = splitStepAttributes(p.content);
            const refs = ((a[idx] || '').match(/#\d+/g) || []).map(x => x.slice(1));
            for (const cid of refs) {
                const child = propMap.get(cid);
                if (!child) continue;
                const ca = splitStepAttributes(child.content);
                const propName = unq(ca[0]) || 'Unknown';
                const fullName = prefix ? `${prefix}.${propName}` : propName;
                if (child.type === 'IFCCOMPLEXPROPERTY' || child.type === 'IFCPHYSICALCOMPLEXQUANTITY') { walk(child, fullName, depth + 1); continue; }
                out[`${psetName}:::${fullName}`] = extractPropValueFromEntity(child);
            }
        };
        const root = psetEntityById.get(psetId);
        if (root) walk(root, '', 0);
        psetPropsCache.set(psetId, out);
        return out;
    };
    const classes = {};
    const rowsByObj = new Map(); 
    let totalElements = 0;
    const addRow = (objId, psetId) => {
        const info = objInfo.get(objId);
        if (!info || !selPsets.has(psetId)) return;
        let row = rowsByObj.get(objId);
        if (!row) {
            row = { cls: info.cls, g: info.g, i: parseInt(objId, 10), n: info.n, props: {} };
            rowsByObj.set(objId, row);
            (classes[info.cls] || (classes[info.cls] = { rows: [] })).rows.push(row);
            totalElements++;
        }
        Object.assign(row.props, flattenPset(psetId));
    };
    for (const rel of relDefs) for (const objId of rel.objIds) addRow(objId, rel.psetId);
    for (const t of typeLevel) for (const pid of t.psetIds) addRow(t.objId, pid);
    wlog(`Compiled ${totalElements} element row(s) across ${Object.keys(classes).length} class(es).`);
    return { classes, totalElements };
}
async function psetInject(d) {
    if (!psetSession) throw new Error("psetInject: no model loaded (call 'psetLoad' first).");
    const ops = d.ops || {};
    ACTION_LABEL = ops.actionLabel || 'PSet Injection';
    const entities = psetSession.entities;
    const NUMERIC_TYPES = /^(IFCREAL|IFCINTEGER|IFC[A-Z]*MEASURE|IFCNUMERICMEASURE|IFCCOUNTMEASURE|IFCPOSITIVE[A-Z]*)$/;
    const BOOL_TYPES = /^(IFCBOOLEAN|IFCLOGICAL)$/;
    const fmtReal = (n) => { const s = String(n); return /[.eE]/.test(s) ? s : s + '.'; };
    const isNumericString = (val) => {
        if (typeof val === 'number') return Number.isFinite(val);
        if (typeof val !== 'string') return false;
        const t = val.trim();
        if (t === '' || /^[-+]?0\d/.test(t)) return false; 
        return !isNaN(t) && !isNaN(parseFloat(t));
    };
    const inferTypeAndValue = (val) => {
        if (val === true || String(val).trim().toLowerCase() === 'true') return { type: 'IFCBOOLEAN', val: '.T.' };
        if (val === false || String(val).trim().toLowerCase() === 'false') return { type: 'IFCBOOLEAN', val: '.F.' };
        if (isNumericString(val)) {
            const n = Number(val);
            return Number.isInteger(n) ? { type: 'IFCINTEGER', val: String(n) } : { type: 'IFCREAL', val: fmtReal(n) };
        }
        return { type: 'IFCLABEL', val: `'${encodeIfcString(String(val))}'` };
    };
    const literalForType = (type, oldInner, val) => {
        const hasQuotes = oldInner.startsWith("'") && oldInner.endsWith("'");
        if (hasQuotes) return `'${encodeIfcString(String(val))}'`;
        if (BOOL_TYPES.test(type)) {
            const s = String(val).trim().toLowerCase();
            if (s === 'true' || s === 't' || s === '.t.' || s === '1' || val === true) return '.T.';
            if (s === 'false' || s === 'f' || s === '.f.' || s === '0' || val === false) return '.F.';
            if (type === 'IFCLOGICAL' && (s === 'u' || s === 'unknown' || s === '.u.')) return '.U.';
            return null;
        }
        if (NUMERIC_TYPES.test(type) || /^[-+]?\d/.test(oldInner)) {
            if (!isNumericString(val)) return null;
            const n = Number(val);
            return (type === 'IFCINTEGER' || type === 'IFCCOUNTMEASURE') ? String(Math.trunc(n)) : fmtReal(n);
        }
        return /^\.[A-Z_]+\.$/.test(String(val)) ? String(val) : null;
    };
    const entIndex = new Map();     
    const classElements = {};       
    const psetsById = new Map();    
    const relList = [];             
    let ownerHistoryId = null;
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p) continue;
        entIndex.set(p.id, i);
        (classElements[p.type] || (classElements[p.type] = [])).push(parseInt(p.id, 10));
        if (p.type === 'IFCOWNERHISTORY' && ownerHistoryId === null) ownerHistoryId = p.id;
        else if (p.type === 'IFCPROPERTYSET') {
            const a = splitStepAttributes(p.content);
            psetsById.set(p.id, { name: unq(a[2]) || '', propRefs: ((a[4] || '').match(/#\d+/g) || []).map(x => x.slice(1)) });
        } else if (p.type === 'IFCRELDEFINESBYPROPERTIES') {
            const a = splitStepAttributes(p.content);
            const pd = (a[5] || '').match(/#(\d+)/);
            if (pd) relList.push({ psetId: pd[1], objIds: ((a[4] || '').match(/#\d+/g) || []).map(x => x.slice(1)) });
        }
    }
    const propNameOf = (id) => {
        const idx = entIndex.get(id);
        if (idx === undefined) return null;
        const p = parseEntity(entities[idx]);
        if (!p) return null;
        return unq(splitStepAttributes(p.content)[0]);
    };
    const elToPsetMap = {};
    for (const rel of relList) {
        const ps = psetsById.get(rel.psetId);
        if (!ps || !ps.name) continue;
        const props = {};
        for (const pid of ps.propRefs) { const n = propNameOf(pid); if (n) props[n] = pid; }
        for (const objId of rel.objIds) {
            (elToPsetMap[objId] || (elToPsetMap[objId] = {}))[ps.name] = { psetID: rel.psetId, props };
        }
    }
    const OH = ownerHistoryId ? `#${ownerHistoryId}` : '$'; 
    let localMaxId = psetSession.maxId;
    const generatedLines = [];
    const modificationsMap = new Map(); 
    const psetUpdates = {};             
    let successfullyUpdated = 0, newlyInjectedExcelProps = 0, skippedTypeMismatch = 0;
    const rawOf = (id) => {
        if (modificationsMap.has(id)) return modificationsMap.get(id);
        const idx = entIndex.get(id);
        return idx === undefined ? null : entities[idx];
    };
    const overwriteSingleValue = (propId, propVal) => {
        const raw = rawOf(propId);
        if (!raw) return false;
        const p = parseEntity(raw);
        if (!p || p.type !== 'IFCPROPERTYSINGLEVALUE') return false;
        const args = splitStepAttributes(p.content);
        if (args.length < 3) return false;
        let newArg;
        const mm = args[2].match(/^([A-Z0-9_]+)\((.*)\)$/);
        if (mm) {
            const lit = literalForType(mm[1], mm[2], propVal);
            if (lit === null) {
                const inf = inferTypeAndValue(propVal);
                newArg = `${inf.type}(${inf.val})`;
                skippedTypeMismatch++;
                wlog(`Type changed #${propId}: ${mm[1]} -> ${inf.type} (value "${propVal}" did not fit).`, true);
            } else newArg = `${mm[1]}(${lit})`;
        } else {
            const inf = inferTypeAndValue(propVal);
            newArg = `${inf.type}(${inf.val})`;
        }
        if (args[2] === newArg) return false;
        args[2] = newArg;
        modificationsMap.set(propId, `#${p.id}= ${p.typeRaw}(${args.join(',')});`);
        return true;
    };
    const appendNewPropToPset = (psetID, propName, type, val) => {
        localMaxId++;
        generatedLines.push(`#${localMaxId}= IFCPROPERTYSINGLEVALUE('${encodeIfcString(propName)}',$,${type}(${val}),$);`);
        (psetUpdates[psetID] || (psetUpdates[psetID] = [])).push(`#${localMaxId}`);
        return String(localMaxId);
    };
    const createPsetWithRel = (psetName, propDefs, elementIds) => {
        const propIds = [];
        for (const p of propDefs) {
            localMaxId++;
            generatedLines.push(`#${localMaxId}= IFCPROPERTYSINGLEVALUE('${encodeIfcString(p.name)}',$,${p.type}(${p.val}),$);`);
            propIds.push(`#${localMaxId}`);
        }
        localMaxId++;
        const psetId = localMaxId;
        generatedLines.push(`#${psetId}= IFCPROPERTYSET('${newIfcGuid()}',${OH},'${encodeIfcString(psetName)}',$,(${propIds.join(',')}));`);
        localMaxId++;
        generatedLines.push(`#${localMaxId}= IFCRELDEFINESBYPROPERTIES('${newIfcGuid()}',${OH},$,$,(${elementIds.map(e => '#' + e).join(',')}),#${psetId});`);
        return propIds.length;
    };
    const excelRows = ops.excelRows || [];
    if (excelRows.length > 0) {
        wlog(`Processing ${excelRows.length} spreadsheet row(s) (overwrites & auto-injections)...`);
        const elementNewPsets = {};
        for (const item of excelRows) {
            const elementID = String(item.elementID);
            for (const propData of (item.props || [])) {
                const found = elToPsetMap[elementID] && elToPsetMap[elementID][propData.pset];
                if (found) {
                    if (found.props[propData.name]) {
                        if (overwriteSingleValue(found.props[propData.name], propData.value)) successfullyUpdated++;
                    } else {
                        const inf = inferTypeAndValue(propData.value);
                        found.props[propData.name] = appendNewPropToPset(found.psetID, propData.name, inf.type, inf.val);
                        newlyInjectedExcelProps++;
                    }
                } else {
                    const g = (elementNewPsets[elementID] || (elementNewPsets[elementID] = {}));
                    const inf = inferTypeAndValue(propData.value);
                    (g[propData.pset] || (g[propData.pset] = [])).push({ name: propData.name, type: inf.type, val: inf.val });
                    newlyInjectedExcelProps++;
                }
            }
        }
        for (const elID in elementNewPsets) {
            for (const psetName in elementNewPsets[elID]) {
                createPsetWithRel(psetName, elementNewPsets[elID][psetName], [parseInt(elID, 10)]);
            }
        }
        wlog(`Spreadsheet processing complete. Overwrote ${successfullyUpdated} existing properties. Auto-injected ${newlyInjectedExcelProps} new properties.`);
    }
    const queued = ops.queued || [];
    let totalManualNewEntities = 0, mergedIntoExisting = 0, overwrittenManual = 0;
    if (queued.length > 0) {
        wlog(`Processing ${queued.length} manually queued property definition(s)...`);
        const manualLiteral = (prop) => {
            if (prop.type === 'IFCBOOLEAN') {
                const s = String(prop.value).trim().toLowerCase();
                return (s === 'true' || s === '1' || s === 't') ? '.T.' : '.F.';
            }
            if (prop.type === 'IFCINTEGER') return String(Math.trunc(Number(prop.value) || 0));
            if (prop.type === 'IFCREAL') return fmtReal(Number(prop.value) || 0);
            return `'${encodeIfcString(String(prop.value))}'`;
        };
        const grouped = {};
        for (const p of queued) for (const cls of (p.ifcClasses || [])) {
            const key = `${cls}|${p.psetName}`;
            (grouped[key] || (grouped[key] = [])).push(p);
        }
        for (const key in grouped) {
            const [className, psetName] = key.split('|');
            const elems = classElements[className] || [];
            if (elems.length === 0) continue;
            const propDefs = grouped[key].map(prop => ({ name: prop.name, type: prop.type, val: manualLiteral(prop) }));
            const needNewPset = [];
            for (const elID of elems) {
                const existing = elToPsetMap[elID] && elToPsetMap[elID][psetName];
                if (!existing) { needNewPset.push(elID); continue; }
                for (const p of propDefs) {
                    if (existing.props[p.name]) {
                        if (overwriteSingleValue(existing.props[p.name], grouped[key].find(q => q.name === p.name).value)) overwrittenManual++;
                    } else {
                        existing.props[p.name] = appendNewPropToPset(existing.psetID, p.name, p.type, p.val);
                        mergedIntoExisting++;
                    }
                }
            }
            if (needNewPset.length > 0) totalManualNewEntities += createPsetWithRel(psetName, propDefs, needNewPset);
        }
        wlog(`Manual queue: ${totalManualNewEntities} new attributes in new Psets, ${mergedIntoExisting} appended to existing Psets, ${overwrittenManual} overwritten.`);
    }
    for (const psetId in psetUpdates) {
        const raw = rawOf(psetId);
        if (!raw) continue;
        const p = parseEntity(raw);
        const a = splitStepAttributes(p.content);
        const cur = (a[4] || '$').trim();
        const inner = cur.startsWith('(') ? cur.slice(1, -1).trim() : '';
        a[4] = '(' + (inner ? inner + ',' : '') + psetUpdates[psetId].join(',') + ')';
        modificationsMap.set(psetId, `#${p.id}= ${p.typeRaw}(${a.join(',')});`);
    }
    if (skippedTypeMismatch > 0) wlog(`${skippedTypeMismatch} value(s) did not match the existing property type and were written as IFCLABEL.`, true);
    const recs = [];
    for (let i = 0; i < entities.length; i++) {
        const p = parseEntity(entities[i]);
        if (!p) continue;
        recs.push({ id: parseInt(p.id, 10), text: modificationsMap.has(p.id) ? modificationsMap.get(p.id) : entities[i] });
    }
    for (const raw of generatedLines) {
        const mm = raw.match(/^#(\d+)\s*=/);
        if (mm) recs.push({ id: parseInt(mm[1], 10), text: raw });
    }
    recs.sort((a, b) => a.id - b.id);
    const srcLines = [`Date: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`,
                      `Source file: ${psetSession.fileName} (${fmtMB(psetSession.fileSize)})`];
    const parts = [headerBytes(psetSession.header, 'liteAECO text engine', srcLines)];
    for (const p of encodeRecs(recs)) parts.push(p);
    parts.push(new TextEncoder().encode(psetSession.footer).buffer);
    const bytes = parts.reduce((n, p) => n + p.byteLength, 0);
    return { parts, bytes, successfullyUpdated, newlyInjectedExcelProps, totalManualNewEntities, mergedIntoExisting, overwrittenManual, skippedTypeMismatch, newEntityCount: generatedLines.length };
}
async function psetClose() { psetSession = null; return { ok: true }; }
const COORD_ACTIONS = { master: coordMaster, graft: coordGraft, finalize: coordFinalize, abort: coordAbort, optimizeFile: optimizeFile, psetLoad: psetLoad, psetApply: psetApply, psetTable: psetTable, psetInject: psetInject, psetClose: psetClose };
self.postMessage({ type: 'ready', proto: WORKER_PROTO });
const generalIdRegex = /#(\d+)\b/g;
self.onmessage = async function (e) {
    const d = e.data || {};
    if (d.action && COORD_ACTIONS[d.action]) {
        try {
            const res = await COORD_ACTIONS[d.action](d);
            const transfer = (res && res.parts) ? res.parts : [];
            self.postMessage({ type: 'result', reqId: d.reqId, ...res }, transfer);
        } catch (err) {
            self.postMessage({ type: 'error', reqId: d.reqId, msg: err.message });
        }
        return;
    }
    try {
        if (d.action === 'optimize') {
            await runOptimization(d);
            return;
        }
        if (d.action === 'ping') { self.postMessage({ type: 'pong', proto: WORKER_PROTO }); return; }
        if (d.action === 'childLoad') {
            const { file, fileName, options } = d;
            if (!file) throw new Error("childLoad: file missing");
            let source = file;
            if (options && options.optDeepCompress) {
                wlog(`${fileName}: Deep Graph Compression (per-file, ${(file.size / 1048576).toFixed(1)} MB)...`);
                try {
                    const scan = await streamStepFile(file, { collectEntities: false, collectIds: true, name: fileName });
                    const out = await runOptimizationCore({
                        buffer: await file.arrayBuffer(),
                        optStripPsets: !!options.optStripPsets,
                        optStripPresentation: !!options.optStripPresentation,
                        initialMaxId: scan.maxId,
                        validModelIDs: scan.ids
                    });
                    source = new Blob([out]);
                    wlog(`${fileName}: compressed to ${(source.size / 1048576).toFixed(1)} MB.`);
                } catch (err) {
                    wlog(`${fileName}: deep compression failed (${err.message}); using the original file.`, true);
                }
            }
            const ents = await streamStepFile(source, { collectEntities: true, name: fileName });
            childState = { fileName, entities: ents.entities, unit2: getLengthUnit(ents.unitText), schema: getSchema(ents.header) };
            self.postMessage({ type: 'loaded', reqId: d.reqId, fileName, maxId: ents.maxId, schema: childState.schema });
            return;
        }
        if (d.action !== 'childGraft') throw new Error(`Unknown worker request (action: ${d.action || 'none'})`);
        if (!childState) throw new Error("childGraft: 'childLoad' must run first");
        const { offset, unit1, pTrees, options, masterDictArray } = d;
        const fileName = childState.fileName;
        const resourceDict = new Map(masterDictArray);
        let childEntities = childState.entities;
        const unit2 = childState.unit2;
        childState = null;
        let scaleFactor = 1.0;
        if (unit1 !== unit2 && UNIT_TO_METER[unit1] && UNIT_TO_METER[unit2]) {
            scaleFactor = UNIT_TO_METER[unit2] / UNIT_TO_METER[unit1];
        }
        let cProject;
        const cSites = [], cBuildings = [], cOwnerHistories = [], contextIds = [];
        const unscaledWatch = new Set();
        let scaledMeasures = 0;
        for (let i = 0; i < childEntities.length; i++) {
            let raw = childEntities[i];
            if (!raw) continue;
            const p = parseEntity(raw);
            if (p && scaleFactor !== 1.0) {
                const scaled = applyScale(p.type, p.content, scaleFactor, unscaledWatch);
                if (scaled !== p.content) {
                    raw = `#${p.id}= ${p.typeRaw}(${scaled});`;
                    if (p.type === 'IFCPROPERTYSINGLEVALUE' || p.type.startsWith('IFCQUANTITY')) scaledMeasures++;
                }
            }
            raw = offsetReferences(raw, offset);
            childEntities[i] = raw;
            if (p) {
                const newId = String(parseInt(p.id, 10) + offset);
                if (p.type === 'IFCPROJECT') cProject = newId;
                else if (p.type === 'IFCSITE') cSites.push(newId);
                else if (p.type === 'IFCBUILDING') cBuildings.push(newId);
                else if (p.type === 'IFCOWNERHISTORY') cOwnerHistories.push(newId);
                else if (p.type === 'IFCGEOMETRICREPRESENTATIONCONTEXT') contextIds.push(newId);
            }
        }
        const swapMap = new Map();
        let deduplicatedCount = 0;
        if (options.optResourceDedup) {
            for (let i = 0; i < childEntities.length; i++) {
                const raw = childEntities[i];
                if (!raw || !raw.includes('=')) continue;
                const p = parseEntity(raw);
                if (!p || !isDedupType(p.type, options.optDedupColors)) continue;
                const content = resolveReferences(p.content, swapMap);
                const hash = generateNormalizedHash(p.type, content, options.optFloatPrecision, options.floatPrecisionVal);
                if (resourceDict.has(hash)) {
                    swapMap.set(p.id, resourceDict.get(hash));
                    deduplicatedCount++;
                } else {
                    resourceDict.set(hash, p.id);
                    childEntities[i] = `#${p.id}= ${p.typeRaw}(${content});`;
                }
            }
        }
        if (cProject) swapMap.set(cProject, pTrees.pProject);
        if (options.optMeta === 'merge' && pTrees.pOwnerHistory) cOwnerHistories.forEach(id => swapMap.set(id, pTrees.pOwnerHistory));
        if (options.optSite === 'merge' && pTrees.pSite) cSites.forEach(id => swapMap.set(id, pTrees.pSite));
        if (options.optBuilding === 'merge' && pTrees.pBuilding && options.optSite === 'merge') {
            cBuildings.forEach(id => swapMap.set(id, pTrees.pBuilding));
        }
        if (options.optStorey !== 'keep' && options.optBuilding === 'merge') {
            const cStoreys = [];
            for (const raw of childEntities) {
                const p = parseEntity(raw);
                if (!p || p.type !== 'IFCBUILDINGSTOREY') continue;
                const attrs = splitStepAttributes(p.content);
                const name = attrs.length > 2 ? normStoreyName(attrs[2]) : null;
                const elevationStr = attrs.length > 9 ? attrs[9] : '$';
                const elevation = elevationStr !== '$' ? parseFloat(elevationStr) : null;
                cStoreys.push({ id: p.id, name, elevation });
            }
            for (const cStorey of cStoreys) {
                for (const pStorey of pTrees.pStoreys) {
                    if ((options.optStorey === 'name' && cStorey.name === pStorey.name && cStorey.name) ||
                        (options.optStorey === 'elevation' && cStorey.elevation !== null && pStorey.elevation !== null && Math.abs(cStorey.elevation - pStorey.elevation) < 0.001)) {
                        swapMap.set(cStorey.id, pStorey.id);
                        break;
                    }
                }
            }
        }
        if (swapMap.size > 0) {
            const probe = makeSwapProbe(swapMap);
            for (let i = 0; i < childEntities.length; i++) {
                let raw = childEntities[i];
                if (!raw) continue;
                const p = parseEntity(raw);
                if (p && swapMap.has(p.id)) { childEntities[i] = ''; continue; }
                if (p && p.type === 'IFCRELAGGREGATES') {
                    const attrs = splitStepAttributes(p.content);
                    if (attrs.length > 5) {
                        const listStr = attrs[5].trim();
                        if (listStr.startsWith('(') && listStr.endsWith(')')) {
                            const items = listStr.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
                            const kept = items.filter(ref => !swapMap.has(ref.replace('#', '')));
                            if (kept.length === 0) { childEntities[i] = ''; continue; }
                            if (kept.length !== items.length) {
                                attrs[5] = '(' + kept.join(',') + ')';
                                raw = `#${p.id}= ${p.typeRaw}(${attrs.join(',')});`;
                            }
                        }
                    }
                }
                if (raw.includes('#')) raw = resolveReferences(raw, swapMap, probe);
                childEntities[i] = raw;
            }
        }
        const result = {
            success: true,
            fileName: fileName,
            scaleFactor: scaleFactor,
            deduplicatedCount: deduplicatedCount,
            unscaledTypes: Array.from(unscaledWatch),
            scaledMeasures: scaledMeasures,
            contextIds: contextIds
        };
        const survivors = childEntities.filter(line => line && line.trim() !== '');
        const buf = new TextEncoder().encode(survivors.join('\0')).buffer; 
        result.buffer = buf;
        result.reqId = d.reqId;
        self.postMessage(result, [buf]);
    } catch (error) {
        if (e.data && e.data.action === 'optimize') {
            self.postMessage({ type: 'error', msg: error.message });
        } else {
            childState = null;
            self.postMessage({ type: 'error', reqId: d.reqId, success: false, error: error.message, msg: error.message });
        }
    }
};
async function runOptimization(data) {
    const buffer = await runOptimizationCore(data);
    self.postMessage({ type: 'done', buffer }, [buffer]);
}
async function runOptimizationCore(data) {
    const {
        buffer,
        optStripPsets,
        optStripPresentation = false,
        initialMaxId,
        validModelIDs
    } = data;
    if (!globalIfcApi) {
        self.postMessage({ type: 'log', msg: 'Downloading WASM engine (first run only)...' });
        globalWebIFC = await import("https:
        globalIfcApi = new globalWebIFC.IfcAPI();
        globalIfcApi.SetWasmPath("https:
        await globalIfcApi.Init();
    }
    const ifcApi = globalIfcApi;
    const WebIFC = globalWebIFC;
    self.postMessage({ type: 'log', msg: 'Parsing merged model into memory graph...' });
    const dataArray = new Uint8Array(buffer);
    const modelID = ifcApi.OpenModel(dataArray);
    self.postMessage({ type: 'log', msg: 'Applying explicit data stripping...' });
    const typesToForceStrip = [];
    if (optStripPresentation) {
        typesToForceStrip.push(
            WebIFC.IFCSTYLEDITEM,
            WebIFC.IFCSURFACESTYLE,
            WebIFC.IFCCOLOURRGB,
            WebIFC.IFCPRESENTATIONLAYERASSIGNMENT
        );
    }
    if (optStripPsets) {
        typesToForceStrip.push(WebIFC.IFCPROPERTYSET, WebIFC.IFCRELDEFINESBYPROPERTIES, WebIFC.IFCPROPERTYSETDEFINITION);
    }
    let explicitDeleted = 0;
    for (const type of typesToForceStrip) {
        try {
            const lines = ifcApi.GetLineIDsWithType(modelID, type);
            const size = lines.size();
            for (let i = 0; i < size; i++) {
                ifcApi.DeleteLine(modelID, lines.get(i));
                explicitDeleted++;
            }
        } catch (err) { }
    }
    self.postMessage({ type: 'log', msg: `Force-stripped ${explicitDeleted} user-selected entities.` });
    self.postMessage({ type: 'log', msg: 'Executing Graph Garbage Collection (Tree-Shaking)...' });
    const orphanableTypes = [
        WebIFC.IFCEXTRUDEDAREASOLID, WebIFC.IFCPOLYLINE, WebIFC.IFCFACETEDBREP, WebIFC.IFCSHAPEREPRESENTATION,
        WebIFC.IFCPRODUCTDEFINITIONSHAPE, WebIFC.IFCFACE, WebIFC.IFCFACEOUTERBOUND, WebIFC.IFCPOLYLOOP,
        WebIFC.IFCBOUNDINGBOX, WebIFC.IFCBLOCK, WebIFC.IFCRECTANGLEPROFILEDEF, WebIFC.IFCCIRCLEPROFILEDEF,
        WebIFC.IFCPROPERTYSINGLEVALUE, WebIFC.IFCPROPERTYSET, WebIFC.IFCELEMENTQUANTITY, WebIFC.IFCCOMPLEXPROPERTY,
        WebIFC.IFCQUANTITYLENGTH, WebIFC.IFCQUANTITYAREA, WebIFC.IFCQUANTITYVOLUME, WebIFC.IFCQUANTITYCOUNT, WebIFC.IFCQUANTITYWEIGHT,
        WebIFC.IFCMATERIAL, WebIFC.IFCCOLOURRGB, WebIFC.IFCSTYLEDITEM, WebIFC.IFCSURFACESTYLE,
        WebIFC.IFCOWNERHISTORY, WebIFC.IFCPERSONANDORGANIZATION, WebIFC.IFCAPPLICATION,
        WebIFC.IFCORGANIZATION, WebIFC.IFCPERSON, WebIFC.IFCUNITASSIGNMENT, WebIFC.IFCSIUNIT
    ];
    const bloatCandidateIDs = new Set();
    for (const type of orphanableTypes) {
        try {
            const lines = ifcApi.GetLineIDsWithType(modelID, type);
            const size = lines.size();
            for (let i = 0; i < size; i++) bloatCandidateIDs.add(lines.get(i));
        } catch (err) { }
    }
    self.postMessage({ type: 'log', msg: `Identified ${bloatCandidateIDs.size} resource entities for orphan-checking.` });
    const keepSet = new Set();
    const stack = [];
    function seed(id) { if (!keepSet.has(id)) { keepSet.add(id); stack.push(id); } }
    if (validModelIDs && validModelIDs.length > 0) {
        for (let i = 0; i < validModelIDs.length; i++) {
            const id = validModelIDs[i];
            if (!bloatCandidateIDs.has(id)) seed(id);
        }
    } else {
        for (let i = 1; i <= initialMaxId + 1000; i++) {
            if (!bloatCandidateIDs.has(i)) seed(i);
        }
    }
    self.postMessage({ type: 'log', msg: 'Traversing spatial and relational graph from active roots...' });
    while (stack.length) {
        const expressID = stack.pop();
        let entity;
        try { entity = ifcApi.GetLine(modelID, expressID); } catch (err) { continue; }
        if (!entity) continue;
        const vals = Object.values(entity);
        for (let k = 0; k < vals.length; k++) {
            const val = vals[k];
            if (!val) continue;
            if (val.type === 5) {
                seed(val.value);
            } else if (Array.isArray(val)) {
                for (let j = 0; j < val.length; j++) {
                    const item = val[j];
                    if (item && item.type === 5) seed(item.value);
                }
            }
        }
    }
    let orphansDeleted = 0;
    for (const id of bloatCandidateIDs) {
        if (!keepSet.has(id)) {
            try {
                ifcApi.DeleteLine(modelID, id);
                orphansDeleted++;
            } catch (err) { }
        }
    }
    self.postMessage({ type: 'log', msg: `Tree-Shaking complete. Purged ${orphansDeleted} dead/orphaned entities.` });
    self.postMessage({ type: 'log', msg: 'Serializing optimized graph back to ArrayBuffer...' });
    const optimizedModelData = ifcApi.SaveModel(modelID);
    ifcApi.CloseModel(modelID);
    return optimizedModelData.buffer;
}