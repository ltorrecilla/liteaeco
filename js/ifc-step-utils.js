(function () {
    'use strict';
    function escapeStepString(value) {
        return String(value ?? '').replace(/'/g, "''");
    }
    function encodeIfcString(str) {
        if (str === null || str === undefined) return '';
        const s = String(str);
        let res = '';
        let inUnicode = false;
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            if (code > 126 || code < 32) {
                if (!inUnicode) { res += '\\X2\\'; inUnicode = true; }
                res += code.toString(16).toUpperCase().padStart(4, '0');
            } else {
                if (inUnicode) { res += '\\X0\\'; inUnicode = false; }
                res += (s[i] === "'") ? "''" : s[i];
            }
        }
        if (inUnicode) res += '\\X0\\';
        return res;
    }
    const GUID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
    function generateIfcGuid() {
        let bytes;
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
        } else {
            bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        let bits = '';
        for (const b of bytes) bits += b.toString(2).padStart(8, '0');
        let guid = GUID_CHARS[parseInt(bits.slice(0, 2), 2)];
        for (let i = 2; i < 128; i += 6) {
            guid += GUID_CHARS[parseInt(bits.slice(i, i + 6), 2)];
        }
        return guid;
    }
    function splitStepAttributes(attrString) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let depth = 0;
        for (let i = 0; i < attrString.length; i++) {
            const ch = attrString[i];
            if (ch === "'") {
                current += ch;
                if (inQuotes && attrString[i + 1] === "'") {
                    current += "'";
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (!inQuotes && ch === '(') {
                depth++;
                current += ch;
            } else if (!inQuotes && ch === ')') {
                depth--;
                current += ch;
            } else if (ch === ',' && !inQuotes && depth === 0) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }
    function getEntityID(entityStr) {
        const m = entityStr.match(/^\s*#(\d+)\s*=/);
        return m ? m[1] : null;
    }
    async function* iterateStepStatements(file, chunkSize = 10 * 1024 * 1024) {
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let offset = 0;
        while (offset < file.size) {
            const slice = file.slice(offset, offset + chunkSize);
            const bytes = await slice.arrayBuffer();
            offset += chunkSize;
            buffer += decoder.decode(bytes, { stream: offset < file.size });
            let start = 0, inString = false, inComment = false;
            let i = 0;
            for (; i < buffer.length; i++) {
                const ch = buffer[i];
                if (inComment) {
                    if (ch === '*' && buffer[i + 1] === '/') { inComment = false; i++; }
                    continue;
                }
                if (inString) {
                    if (ch === "'") inString = false;
                    continue;
                }
                if (ch === "'") { inString = true; continue; }
                if (ch === '/' && buffer[i + 1] === '*') { inComment = true; i++; continue; }
                if (ch === ';') {
                    yield buffer.substring(start, i + 1);
                    start = i + 1;
                }
            }
            buffer = buffer.substring(start);
        }
        if (buffer.trim()) yield buffer;
    }
    window.IfcStep = {
        escapeStepString,
        encodeIfcString,
        generateIfcGuid,
        splitStepAttributes,
        getEntityID,
        iterateStepStatements
    };
})();