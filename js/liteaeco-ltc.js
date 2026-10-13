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
// liteAECO - (liteaeco-ltc.js)
// ========












































(function (root) {
    "use strict";
    var LTC_BUILD = 1;
    var MIME = "application/vnd.liteaeco.coordination+zip";
    var EXT = ".ltc";
    var SIGNATURE = "coordination-pack";
    var PACK_VERSION = 1;
    var CHUNK = 8 * 1024 * 1024;
    var LIMITS = { entries: 10000, manifest: 4 * 1024 * 1024, smallJson: 16 * 1024 * 1024, models: 500, cdir: 64 * 1024 * 1024 };
    var NAME_RE = /^[A-Za-z0-9._\-]+(\/[A-Za-z0-9._\-]+)*$/;
    var U32 = 0xFFFFFFFF;
    var Z64 = U32;   

    
    var enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    var dec = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;
    function toBlob(data) {
        if (data && typeof data.slice === "function" && typeof data.size === "number") return data;   
        if (typeof data === "string") return new Blob([enc.encode(data)]);
        if (data instanceof ArrayBuffer) return new Blob([new Uint8Array(data)]);
        if (data && data.buffer instanceof ArrayBuffer) return new Blob([data]);
        return new Blob([]);
    }
    function bytesOf(blob, start, end) {
        return blob.slice(start, end).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    function setU64(dv, off, n) {
        dv.setUint32(off, n % 0x100000000, true);
        dv.setUint32(off + 4, Math.floor(n / 0x100000000), true);
    }
    function getU64(dv, off) {
        return dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 0x100000000;
    }
    function isPackName(name) { return /\.ltc$/i.test(String(name || "")); }
    function entryName(i, ext) { return "models/m" + String(i + 1).padStart(2, "0") + "." + ext; }
    
    function safeText(s, n) {
        return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n || 200);
    }
    function aborted(signal) {
        if (signal && signal.aborted) { var e = new Error("cancelled"); e.cancelled = true; throw e; }
    }

    
    var CRC_TABLE = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
        return t;
    })();
    function crcUpdate(crc, bytes) {
        for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return crc;
    }
    
    function crc32(data, onProgress, signal) {
        var blob = toBlob(data);
        var size = blob.size, pos = 0, crc = 0xFFFFFFFF;
        function step() {
            aborted(signal);
            if (pos >= size) return Promise.resolve((crc ^ 0xFFFFFFFF) >>> 0);
            var end = Math.min(size, pos + CHUNK);
            return bytesOf(blob, pos, end).then(function (b) {
                crc = crcUpdate(crc, b);
                if (onProgress) { try { onProgress(end - pos); } catch (e) { } }
                pos = end;
                return step();
            });
        }
        return step();
    }
    function hex8(n) { return ("00000000" + (n >>> 0).toString(16)).slice(-8); }

    
    function dosTime(d) {
        return {
            time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
            date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
        };
    }
    
    function zipStored(entries) {
        var dt = dosTime(new Date());
        var parts = [], central = [];
        var offset = 0;
        entries.forEach(function (e) {
            var nameB = enc.encode(e.name);
            var size = e.blob.size;
            var big = size >= Z64;
            var bigOff = offset >= Z64;
            
            var lx = big ? 20 : 0;
            var h = new DataView(new ArrayBuffer(30 + lx));
            h.setUint32(0, 0x04034b50, true); h.setUint16(4, big ? 45 : 20, true); h.setUint16(6, 0x0800, true);
            h.setUint16(8, 0, true); h.setUint16(10, dt.time, true); h.setUint16(12, dt.date, true);
            h.setUint32(14, e.crc >>> 0, true);
            h.setUint32(18, big ? U32 : size, true); h.setUint32(22, big ? U32 : size, true);
            h.setUint16(26, nameB.length, true); h.setUint16(28, lx, true);
            if (big) { h.setUint16(30, 0x0001, true); h.setUint16(32, 16, true); setU64(h, 34, size); setU64(h, 42, size); }
            
            parts.push(new Uint8Array(h.buffer, 0, 30), nameB);
            if (lx) parts.push(new Uint8Array(h.buffer, 30, lx));
            parts.push(e.blob);
            
            var cfields = (big ? 2 : 0) + (bigOff ? 1 : 0);
            var cx = cfields ? 4 + cfields * 8 : 0;
            var c = new DataView(new ArrayBuffer(46 + cx));
            c.setUint32(0, 0x02014b50, true); c.setUint16(4, 45, true); c.setUint16(6, (big || bigOff) ? 45 : 20, true);
            c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt.time, true); c.setUint16(14, dt.date, true);
            c.setUint32(16, e.crc >>> 0, true);
            c.setUint32(20, big ? U32 : size, true); c.setUint32(24, big ? U32 : size, true);
            c.setUint16(28, nameB.length, true); c.setUint16(30, cx, true);
            c.setUint32(42, bigOff ? U32 : offset, true);
            if (cx) {
                c.setUint16(46, 0x0001, true); c.setUint16(48, cfields * 8, true);
                var p = 50;
                if (big) { setU64(c, p, size); p += 8; setU64(c, p, size); p += 8; }
                if (bigOff) { setU64(c, p, offset); p += 8; }
            }
            central.push(new Uint8Array(c.buffer, 0, 46), nameB);
            if (cx) central.push(new Uint8Array(c.buffer, 46, cx));
            offset += 30 + lx + nameB.length + size;
        });
        var cdSize = central.reduce(function (n, b) { return n + b.byteLength; }, 0);
        var cdOff = offset;
        var tail = [];
        var need64 = entries.length > 0xFFFE || cdOff >= Z64 || cdSize >= Z64;
        if (need64) {
            var z = new DataView(new ArrayBuffer(56));
            z.setUint32(0, 0x06064b50, true); setU64(z, 4, 44); z.setUint16(12, 45, true); z.setUint16(14, 45, true);
            z.setUint32(16, 0, true); z.setUint32(20, 0, true);
            setU64(z, 24, entries.length); setU64(z, 32, entries.length); setU64(z, 40, cdSize); setU64(z, 48, cdOff);
            var l = new DataView(new ArrayBuffer(20));
            l.setUint32(0, 0x07064b50, true); l.setUint32(4, 0, true); setU64(l, 8, cdOff + cdSize); l.setUint32(16, 1, true);
            tail.push(z.buffer, l.buffer);
        }
        var eo = new DataView(new ArrayBuffer(22));
        eo.setUint32(0, 0x06054b50, true);
        eo.setUint16(8, need64 ? 0xFFFF : entries.length, true); eo.setUint16(10, need64 ? 0xFFFF : entries.length, true);
        eo.setUint32(12, need64 ? U32 : cdSize, true); eo.setUint32(16, need64 ? U32 : cdOff, true);
        tail.push(eo.buffer);
        return new Blob(parts.concat(central, tail), { type: MIME });
    }

    

    function build(opts) {
        opts = opts || {};
        var files = (opts.files || []).map(function (f) { return { name: f.name, blob: toBlob(f.data) }; });
        var bad = files.filter(function (f) { return !NAME_RE.test(f.name) || /(^|\/)\.\.?(\/|$)/.test(f.name) || f.name === "mimetype" || f.name === "manifest.json"; });
        if (bad.length) return Promise.reject(new Error("invalid entry name: " + bad[0].name));
        var seen = {};
        for (var i = 0; i < files.length; i++) {
            if (seen[files[i].name]) return Promise.reject(new Error("duplicate entry: " + files[i].name));
            seen[files[i].name] = true;
        }
        var total = files.reduce(function (n, f) { return n + f.blob.size; }, 0), done = 0;
        var report = function (n) { done += n; if (opts.onProgress) { try { opts.onProgress(done, total); } catch (e) { } } };
        var seq = Promise.resolve();
        files.forEach(function (f) {
            seq = seq.then(function () { return crc32(f.blob, report, opts.signal).then(function (c) { f.crc = c; }); });
        });
        return seq.then(function () {
            aborted(opts.signal);
            var manifest = JSON.parse(JSON.stringify(opts.manifest || {}));
            manifest.liteaeco = SIGNATURE;
            manifest.packVersion = PACK_VERSION;
            manifest.mimetype = MIME;
            manifest.files = {};
            files.forEach(function (f) { manifest.files[f.name] = { size: f.blob.size, crc32: hex8(f.crc) }; });
            var v = validateManifest(manifest);
            if (!v.ok) throw new Error("invalid manifest: " + v.errors.join("; "));
            var mt = toBlob(MIME), mf = toBlob(JSON.stringify(manifest, null, 2));
            return Promise.all([crc32(mt), crc32(mf)]).then(function (c) {
                var entries = [{ name: "mimetype", blob: mt, crc: c[0] }, { name: "manifest.json", blob: mf, crc: c[1] }]
                    .concat(files.map(function (f) { return { name: f.name, blob: f.blob, crc: f.crc }; }));
                return zipStored(entries);
            });
        });
    }

    
    
    function sniff(blob) {
        if (!blob || typeof blob.slice !== "function" || blob.size < 38 + MIME.length) return Promise.resolve(false);
        return bytesOf(blob, 0, 38 + MIME.length).then(function (b) {
            var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
            if (dv.getUint32(0, true) !== 0x04034b50) return false;
            if (dv.getUint16(8, true) !== 0) return false;            
            if (dv.getUint16(26, true) !== 8 || dv.getUint16(28, true) !== 0) return false;
            if (dec.decode(b.subarray(30, 38)) !== "mimetype") return false;
            return dec.decode(b.subarray(38, 38 + MIME.length)) === MIME;
        }).catch(function () { return false; });
    }

    function findEocd(blob) {
        var len = Math.min(blob.size, 22 + 65535);
        var start = blob.size - len;
        return bytesOf(blob, start, blob.size).then(function (b) {
            for (var i = b.length - 22; i >= 0; i--) {
                if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
                    var dv = new DataView(b.buffer, b.byteOffset + i, 22);
                    return {
                        at: start + i, entries: dv.getUint16(10, true),
                        cdSize: dv.getUint32(12, true), cdOff: dv.getUint32(16, true)
                    };
                }
            }
            throw new Error("not a zip (no end record)");
        });
    }
    function readZip64(blob, eocd) {
        if (eocd.entries !== 0xFFFF && eocd.cdSize !== U32 && eocd.cdOff !== U32) return Promise.resolve(eocd);
        if (eocd.at < 20) return Promise.reject(new Error("zip64 locator missing"));
        return bytesOf(blob, eocd.at - 20, eocd.at).then(function (b) {
            var dv = new DataView(b.buffer, b.byteOffset, 20);
            if (dv.getUint32(0, true) !== 0x07064b50) throw new Error("zip64 locator missing");
            var off = getU64(dv, 8);
            return bytesOf(blob, off, off + 56);
        }).then(function (b) {
            var dv = new DataView(b.buffer, b.byteOffset, 56);
            if (dv.getUint32(0, true) !== 0x06064b50) throw new Error("zip64 end record missing");
            return { at: eocd.at, entries: getU64(dv, 32), cdSize: getU64(dv, 40), cdOff: getU64(dv, 48) };
        });
    }
    function parseCentral(b, count) {
        var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        var out = [], p = 0;
        for (var i = 0; i < count; i++) {
            if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error("broken central directory");
            var e = {
                flags: dv.getUint16(p + 8, true), method: dv.getUint16(p + 10, true), crc: dv.getUint32(p + 16, true),
                csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true), off: dv.getUint32(p + 42, true)
            };
            var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
            if (p + 46 + nl + xl + cl > b.length) throw new Error("broken central directory");
            e.name = dec.decode(b.subarray(p + 46, p + 46 + nl));
            
            var x = p + 46 + nl, xe = x + xl;
            while (x + 4 <= xe) {
                var id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true), q = x + 4;
                if (id === 0x0001) {
                    if (e.usize === U32) { e.usize = getU64(dv, q); q += 8; }
                    if (e.csize === U32) { e.csize = getU64(dv, q); q += 8; }
                    if (e.off === U32) { e.off = getU64(dv, q); q += 8; }
                }
                x += 4 + sz;
            }
            out.push(e);
            p += 46 + nl + xl + cl;
        }
        return out;
    }

    function validateManifest(m) {
        var errors = [];
        if (!m || typeof m !== "object") return { ok: false, errors: ["not an object"] };
        if (m.liteaeco !== SIGNATURE) errors.push("not a liteAECO coordination pack");
        if (typeof m.packVersion !== "number" || m.packVersion < 1) errors.push("packVersion missing");
        else if (m.packVersion > PACK_VERSION) errors.push("packVersion " + m.packVersion + " is newer than this app supports (" + PACK_VERSION + ")");
        if (m.mimetype !== undefined && m.mimetype !== MIME) errors.push("wrong mimetype");
        if (!Array.isArray(m.models) || !m.models.length) errors.push("models missing");
        else if (m.models.length > LIMITS.models) errors.push("too many models");
        else m.models.forEach(function (md, i) {
            if (!md || typeof md !== "object") { errors.push("models[" + i + "] not an object"); return; }
            if (typeof md.name !== "string" || !md.name) errors.push("models[" + i + "].name missing");
            if (typeof md.frag !== "string" || !NAME_RE.test(md.frag)) errors.push("models[" + i + "].frag invalid");
            if (md.pose != null && !normPose(md.pose)) errors.push("models[" + i + "].pose invalid");
        });
        if (!m.files || typeof m.files !== "object") errors.push("files missing");
        else Object.keys(m.files).forEach(function (n) {
            var f = m.files[n];
            if (!NAME_RE.test(n) || /(^|\/)\.\.?(\/|$)/.test(n)) errors.push("bad file name " + n);
            if (!f || typeof f.size !== "number" || f.size < 0 || !/^[0-9a-f]{8}$/.test(String(f.crc32 || ""))) errors.push("bad file record " + n);
        });
        if (m.models && m.files && Array.isArray(m.models)) m.models.forEach(function (md, i) {
            if (md && md.frag && !m.files[md.frag]) errors.push("models[" + i + "].frag not in files");
        });
        return { ok: errors.length === 0, errors: errors };
    }

    
    function read(blob) {
        var fail = function (msg) { return { ok: false, error: msg }; };
        if (!blob || typeof blob.slice !== "function") return Promise.resolve(fail("no file"));
        return sniff(blob).then(function (okSig) {
            if (!okSig) return fail("not a liteAECO coordination pack (signature missing)");
            return findEocd(blob).then(function (e) { return readZip64(blob, e); }).then(function (e) {
                if (e.entries > LIMITS.entries) return fail("too many entries");
                if (e.cdSize > LIMITS.cdir || e.cdOff + e.cdSize > blob.size) return fail("broken central directory");
                return bytesOf(blob, e.cdOff, e.cdOff + e.cdSize).then(function (b) {
                    var list = parseCentral(b, e.entries);
                    var map = Object.create(null);
                    for (var i = 0; i < list.length; i++) {
                        var en = list[i];
                        if (!NAME_RE.test(en.name) || /(^|\/)\.\.?(\/|$)/.test(en.name)) return fail("unsafe entry name: " + en.name);
                        if (map[en.name]) return fail("duplicate entry: " + en.name);
                        if (en.method !== 0) return fail("compressed entries are not allowed: " + en.name);
                        if (en.csize !== en.usize) return fail("bad entry size: " + en.name);
                        if (en.off + en.csize > blob.size) return fail("entry outside the file: " + en.name);
                        map[en.name] = en;
                    }
                    if (!list.length || list[0].name !== "mimetype") return fail("mimetype must be the first entry");
                    if (!map["manifest.json"]) return fail("manifest.json missing");
                    var dataStart = Object.create(null);
                    function startOf(en) {
                        if (dataStart[en.name] != null) return Promise.resolve(dataStart[en.name]);
                        return bytesOf(blob, en.off, en.off + 30).then(function (h) {
                            var dv = new DataView(h.buffer, h.byteOffset, 30);
                            if (dv.getUint32(0, true) !== 0x04034b50) throw new Error("broken local header: " + en.name);
                            var s = en.off + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
                            if (s + en.csize > blob.size) throw new Error("entry outside the file: " + en.name);
                            dataStart[en.name] = s;
                            return s;
                        });
                    }
                    function entryBlob(name) {
                        var en = map[name];
                        if (!en) return Promise.reject(new Error("entry not found: " + name));
                        return startOf(en).then(function (s) { return blob.slice(s, s + en.csize); });
                    }
                    function text(name, cap) {
                        var en = map[name];
                        if (!en) return Promise.reject(new Error("entry not found: " + name));
                        if (en.csize > (cap || LIMITS.smallJson)) return Promise.reject(new Error("entry too large: " + name));
                        return entryBlob(name).then(function (x) { return x.arrayBuffer(); }).then(function (ab) { return dec.decode(new Uint8Array(ab)); });
                    }
                    return text("manifest.json", LIMITS.manifest).then(function (t) {
                        var manifest;
                        try { manifest = JSON.parse(t); } catch (err) { return fail("manifest.json is not valid JSON"); }
                        var v = validateManifest(manifest);
                        if (!v.ok) return fail(v.errors.join("; "));
                        
                        var names = Object.keys(manifest.files);
                        for (var k = 0; k < names.length; k++) {
                            var en2 = map[names[k]], rec = manifest.files[names[k]];
                            if (!en2) return fail("file missing in pack: " + names[k]);
                            if (en2.usize !== rec.size || hex8(en2.crc) !== rec.crc32) return fail("file does not match the manifest: " + names[k]);
                        }
                        var listed = function (n) { return !!manifest.files[n]; };
                        return {
                            ok: true, manifest: manifest, names: names,
                            has: listed,
                            blob: function (n) { return listed(n) ? entryBlob(n) : Promise.reject(new Error("not listed: " + n)); },
                            text: function (n) { return listed(n) ? text(n) : Promise.reject(new Error("not listed: " + n)); },
                            json: function (n) { return listed(n) ? text(n).then(JSON.parse) : Promise.reject(new Error("not listed: " + n)); },
                            
                            verify: function (n, onProgress) {
                                if (!listed(n)) return Promise.resolve(false);
                                return entryBlob(n).then(function (x) { return crc32(x, onProgress); })
                                    .then(function (c) { return hex8(c) === manifest.files[n].crc32; });
                            }
                        };
                    });
                });
            });
        }).catch(function (err) { return fail(String((err && err.message) || err)); });
    }

    
    

    function normPose(p) {
        if (!p || typeof p !== "object") return null;
        var num = function (v) { var n = typeof v === "number" ? v : Number(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : NaN; };
        var r = function (v) { return Math.round(v * 1e6) / 1e6; };
        var x = num(p.x || 0), y = num(p.y || 0), z = num(p.z || 0), rot = num(p.rot || 0);
        if ([x, y, z, rot].some(function (v) { return isNaN(v) || Math.abs(v) > 1e7; })) return null;
        var out = { x: r(x), y: r(y), z: r(z), rot: r(rot) };
        if (p.scale !== undefined && p.scale !== null && p.scale !== "") {
            var s = num(p.scale);
            if (isNaN(s) || s <= 0 || s > 1000) return null;
            if (s !== 1) out.scale = Math.round(s * 1e9) / 1e9;
        }
        return out;
    }
    function poseIsZero(p) { return !p || (!p.x && !p.y && !p.z && !p.rot && (!p.scale || p.scale === 1)); }
    


    function reducePoses(events) {
        var out = Object.create(null);
        (events || []).forEach(function (ev) {
            if (!ev || typeof ev.target !== "string" || !ev.target || ev.target.length > 1024) return;
            var p = ev.payload || {};
            if (ev.type === "model.version" && typeof p.renamedFrom === "string" && p.renamedFrom !== ev.target
                && Object.prototype.hasOwnProperty.call(out, p.renamedFrom)) {
                if (!Object.prototype.hasOwnProperty.call(out, ev.target)) out[ev.target] = out[p.renamedFrom];
                delete out[p.renamedFrom];
                return;
            }
            if (ev.type !== "model.pose") return;
            if (p.pose === null || poseIsZero(p.pose)) { out[ev.target] = null; return; }
            var n = normPose(p.pose);
            if (n) out[ev.target] = n;
        });
        return out;
    }

    var api = {
        LTC_BUILD: LTC_BUILD, MIME: MIME, EXT: EXT, SIGNATURE: SIGNATURE, PACK_VERSION: PACK_VERSION, LIMITS: LIMITS,
        isPackName: isPackName, sniff: sniff, crc32: crc32, build: build, read: read,
        validateManifest: validateManifest, normPose: normPose, poseIsZero: poseIsZero, reducePoses: reducePoses,
        entryName: entryName, safeText: safeText, hex8: hex8,
        _testZip64At: function (n) { Z64 = n > 0 ? n : U32; }
    };
    if (root) { root.liteAECO = root.liteAECO || {}; root.liteAECO.ltc = api; }
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
