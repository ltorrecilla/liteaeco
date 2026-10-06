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
// liteAECO - (liteaeco-cde.js)
// ========

(function () {
    "use strict";
    var W = (typeof window !== "undefined") ? window : globalThis;
    W.liteAECO = W.liteAECO || {};
    if (W.liteAECO.cde) return;

    var CDE_BUILD = 25;
    var DB_NAME = "liteaeco-cde";
    var MANIFEST_NAME = "project.json";
    var STRUCTURE_VERSION = 2;
    var LOG_DIR = [".liteaeco", "log"];
    var CACHE_DIR = [".liteaeco", "cache"];
    var OBJECTS_DIR = [".liteaeco", "objects"];
    var CACHE_MODELS_DIR = [".liteaeco", "cache", "models"];
    var MODELS_DIR = ["BIM", "Models"];
    var COORD_DIR = ["BIM", "Coordination"];
    var REPORTS_DIR = ["BIM", "Coordination", "reports"];
    var ADMIN_DIR = [".admin"];
    var ISSUES_DIR = [".admin", "issues"];
    var ISSUES_EXPORTS_DIR = [".admin", "issues", "exports"];
    var APP_ISSUES_SUB = { model_viewer: "coordination", meetings: "meetings" };
    var ISSUES_APPS_CREATED = ["model_viewer", "meetings"];
    var HASHFILE_MAX_BYTES = 64 * 1024 * 1024;
    var FP_HEAD_BYTES = 16 * 1024;
    var FP_ALGO = 3;
    var FP_PIECE = 8 * 1024 * 1024;
    var GENESIS = "GENESIS";

    var subtle = (typeof crypto !== "undefined" && crypto.subtle) ? crypto.subtle : null;

    var B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    var _lastUlidTime = 0;
    var _lastUlidRand = null;

    function _randBytes(n) {
        var a = new Uint8Array(n);
        if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(a);
        else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
        return a;
    }

    function uuidV4() {
        var c = (W && W.crypto) || (typeof crypto !== "undefined" ? crypto : null);
        if (c && typeof c.randomUUID === "function") {
            try { return c.randomUUID(); } catch (e) {  }
        }
        if (!c || typeof c.getRandomValues !== "function") throw new Error("No secure random source for IDs");
        var b = new Uint8Array(16);
        c.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        var h = "";
        for (var i = 0; i < 16; i++) h += (b[i] < 16 ? "0" : "") + b[i].toString(16);
        return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    }
    function newPersonId() { return uuidV4(); }

    function ulid(nowMs) {
        var t = (nowMs !== undefined) ? nowMs : Date.now();
        if (t < _lastUlidTime) t = _lastUlidTime;
        var rand;
        if (t === _lastUlidTime && _lastUlidRand) {
            rand = _lastUlidRand.slice();
            var wrapped = true;
            for (var k = rand.length - 1; k >= 0; k--) {
                if (rand[k] < 255) { rand[k]++; wrapped = false; break; }
                rand[k] = 0;
            }
            if (wrapped) {
                t = _lastUlidTime + 1;
                rand = _randBytes(10);
            }
        } else {
            rand = _randBytes(10);
        }
        _lastUlidTime = t; _lastUlidRand = rand;

        var out = "";
        var tt = t;
        for (var j = 0; j < 10; j++) { out = B32[tt % 32] + out; tt = Math.floor(tt / 32); }
        var bits = "";
        for (var b = 0; b < rand.length; b++) bits += rand[b].toString(2).padStart(8, "0");
        for (var c = 0; c < 16; c++) out += B32[parseInt(bits.slice(c * 5, c * 5 + 5), 2)];
        return out;
    }

    function sha256Hex(text) {
        if (!subtle) return Promise.resolve("nosubtle");
        var bytes = new TextEncoder().encode(text);
        return subtle.digest("SHA-256", bytes).then(function (buf) {
            var v = new Uint8Array(buf), s = "";
            for (var i = 0; i < v.length; i++) s += v[i].toString(16).padStart(2, "0");
            return s;
        });
    }

    function badKey(k) {
        return k === "__proto__" || k === "constructor" || k === "prototype";
    }
    function nmap() { return Object.create(null); }
    function safeAssign(target, src) {
        if (src) Object.keys(src).forEach(function (k) {
            if (!badKey(k)) target[k] = src[k];
        });
        return target;
    }

    function canonicalEvent(ev) {
        var arr = [ev.id, ev.ts, ev.author, ev.app, ev.type,
            ev.target || null, ev.payload === undefined ? null : ev.payload,
            ev.prevHash || null];
        if (ev.kid) arr.push(ev.kid);
        return JSON.stringify(arr);
    }

    var dbPromise = null;
    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve) {
            if (typeof indexedDB === "undefined") return resolve(null);
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains("links")) db.createObjectStore("links", { keyPath: "guid" });
                if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { resolve(null); };
        });
        return dbPromise;
    }
    function kv(store, mode, fn) {
        return openDB().then(function (db) {
            if (!db) return null;
            return new Promise(function (resolve) {
                var t = db.transaction(store, mode);
                var out = fn(t.objectStore(store));
                t.oncomplete = function () { resolve(out && out.__req ? out.__req.result : out); };
                t.onerror = function () { resolve(null); };
            });
        });
    }
    function kvGet(store, key) {
        return openDB().then(function (db) {
            if (!db) return null;
            return new Promise(function (resolve) {
                var r = db.transaction(store, "readonly").objectStore(store).get(key);
                r.onsuccess = function () { resolve(r.result === undefined ? null : r.result); };
                r.onerror = function () { resolve(null); };
            });
        });
    }

    var _deviceIdCache = null;
    function deviceId() {
        if (_deviceIdCache) return Promise.resolve(_deviceIdCache);
        return kvGet("kv", "deviceId").then(function (id) {
            if (id) { _deviceIdCache = id; return id; }
            var fresh = ulid();
            return kv("kv", "readwrite", function (s) { s.put(fresh, "deviceId"); return fresh; })
                .then(function () { return kvGet("kv", "deviceId"); })
                .then(function (stored) { _deviceIdCache = stored || fresh; return _deviceIdCache; });
        });
    }

    var _keypairFlight = null;
    function ensureKeypair() {
        if (_keypairFlight) return _keypairFlight;
        _keypairFlight = kvGet("kv", "keypair").then(function (kp) {
            if (kp && kp.publicKeyJwk) return kp;
            if (!subtle) return null;
            return subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])
                .then(function (pair) {
                    return subtle.exportKey("jwk", pair.publicKey).then(function (jwk) {
                        var rec = { publicKeyJwk: jwk, privateKey: pair.privateKey, publicKey: pair.publicKey };
                        return kv("kv", "readwrite", function (s) {
                            var req = s.get("keypair");
                            req.onsuccess = function () { if (!(req.result && req.result.publicKeyJwk)) s.put(rec, "keypair"); };
                            return null;
                        });
                    });
                })
                .then(function () { return kvGet("kv", "keypair"); })
                .catch(function () { return null; });
        }).then(function (kp) {
            if (!kp) _keypairFlight = null;
            return kp;
        }, function () { _keypairFlight = null; return null; });
        return _keypairFlight;
    }

    function signCanonical(canonical) {
        return kvGet("kv", "keypair").then(function (kp) {
            if (!kp || !kp.privateKey || !subtle) return null;
            var bytes = new TextEncoder().encode(canonical);
            return subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, bytes)
                .then(function (buf) {
                    var v = new Uint8Array(buf), s = "";
                    for (var i = 0; i < v.length; i++) s += String.fromCharCode(v[i]);
                    return btoa(s);
                }).catch(function () { return null; });
        });
    }

    function getMember(guid) { return kvGet("kv", "member:" + guid); }

    function loadStateTrusted(root, guid) {
        if (!guid) return loadState(root);
        return getTrustPin(guid).catch(function () { return null; }).then(function (pin) {
            return loadState(root, { pinnedRoot: pin }).then(function (st) {
                if (st.trust && st.trust.enabled && st.trust.rootKid && !pin && !st.trust.rootMismatch) {
                    return setTrustPin(guid, st.trust.rootKid).catch(function () { }).then(function () { return st; });
                }
                return st;
            });
        });
    }
    function isAdmin(st, memberId, kid, dev) {
        if (!st) return false;
        var tr = st.trust;
        if (tr && tr.enabled) {
            var d = kid ? tr.devices[kid] : null;
            return !!(kid && tr.admins[kid] && d && d.status === "approved");
        }
        var rec = st.members && st.members[memberId];
        return !!(rec && rec.role === "admin" && Array.isArray(rec.deviceIds) && dev && rec.deviceIds.indexOf(dev) !== -1);
    }
    var PEOPLE_CACHE = [".liteaeco", "cache", "people.json"];
    function readPeopleCache(root) {
        return getFileByRel(root, PEOPLE_CACHE.join("/"), false)
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) { return f.text(); })
            .then(function (t) { var d = JSON.parse(t); return d && Array.isArray(d.people) ? d : null; })
            .catch(function () { return null; });
    }
    function writePeopleCache(root, people, source) {
        var slim = (people || []).map(function (p) {
            return { id: p.id, name: p.name || "", mail: p.mail || "", company: p.company || "", jobRole: p.jobRole || "" };
        });
        return readPeopleCache(root).then(function (old) {
            if (old && JSON.stringify(old.people) === JSON.stringify(slim)) return false;
            var doc = JSON.stringify({ savedAt: new Date().toISOString(), source: source || null, people: slim }, null, 2);
            return getFileByRel(root, PEOPLE_CACHE.join("/"), true)
                .then(function (fh) { return fh.createWritable(); })
                .then(function (w) { return w.write(doc).then(function () { return w.close(); }); })
                .then(function () { return true; });
        });
    }
    function whoAmI(root, guid) {
        var out = { memberId: null, author: null, deviceId: null, kid: null, name: "", mail: "", company: "", jobRole: "",
            role: "", isAdmin: false, claimed: false, trust: { enabled: false, deviceApproved: false, rootMismatch: false }, state: null };
        return Promise.all([
            deviceId().catch(function () { return null; }),
            deviceKid().catch(function () { return null; }),
            getMember(guid).catch(function () { return null; }),
            loadStateTrusted(root, guid).catch(function () { return null; }),
            readPeopleCache(root)
        ]).then(function (r) {
            var dev = r[0], kid = r[1], mid = r[2], st = r[3], pc = r[4];
            out.deviceId = dev; out.kid = kid; out.state = st;
            var cur = st && mid ? resolvePerson(st, mid) : mid;
            out.memberId = cur || null;
            out.claimed = !!cur;
            out.author = cur || (dev ? "device:" + dev : null);
            var rec = st && st.members && cur ? st.members[cur] : null;
            if (rec) { out.name = rec.name || ""; out.mail = rec.mail || ""; out.role = rec.role || ""; }
            if (pc && cur) {
                for (var i = 0; i < pc.people.length; i++) {
                    var p = pc.people[i];
                    if (p.id === cur || (st && resolvePerson(st, p.id) === cur)) {
                        out.company = p.company || ""; out.jobRole = p.jobRole || "";
                        if (!out.name) out.name = p.name || "";
                        if (!out.mail) out.mail = p.mail || "";
                        break;
                    }
                }
            }
            var tr = st && st.trust;
            if (tr) {
                out.trust.enabled = !!tr.enabled;
                out.trust.rootMismatch = !!tr.rootMismatch;
                out.trust.deviceApproved = !!(kid && tr.devices && tr.devices[kid] && tr.devices[kid].status === "approved");
            }
            out.isAdmin = isAdmin(st, cur, kid, dev);
            return out;
        }).catch(function () { return out; });
    }
    function setMember(guid, memberId) {
        return kv("kv", "readwrite", function (s) { s.put(memberId, "member:" + guid); return memberId; });
    }

    function getDir(root, parts, create) {
        var p = Promise.resolve(root);
        parts.forEach(function (name) {
            p = p.then(function (dir) { return dir.getDirectoryHandle(name, { create: !!create }); });
        });
        return p;
    }
    function splitRel(rel) {
        return String(rel || "").split("/").filter(function (s) { return s.length; });
    }
    function getFileByRel(root, rel, create) {
        var parts = splitRel(rel);
        var fname = parts.pop();
        return getDir(root, parts, create).then(function (dir) {
            return dir.getFileHandle(fname, { create: !!create });
        });
    }
    function readTextFile(root, rel) {
        return getFileByRel(root, rel, false)
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) { return f.text(); })
            .catch(function (e) {
                if (e && e.name === "NotFoundError") return null;
                return { __readError: true, error: e };
            });
    }
    function writeTextFile(root, rel, text) {
        return getFileByRel(root, rel, true).then(function (fh) {
            return fh.createWritable().then(function (w) {
                return w.write(text).then(function () { return w.close(); });
            });
        });
    }
    function appendTextFile(root, rel, text) {
        return getFileByRel(root, rel, true).then(function (fh) {
            return fh.getFile().then(function (f) {
                return fh.createWritable({ keepExistingData: true }).then(function (w) {
                    return w.seek(f.size)
                        .then(function () { return w.write(text); })
                        .then(function () { return w.close(); });
                });
            });
        });
    }
    function hashFile(root, rel) {
        return getFileByRel(root, rel, false)
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) {
                if (f.size > HASHFILE_MAX_BYTES) {
                    var e = new Error("hashFile: file too large (" + f.size + " bytes); use fingerprintIfc");
                    e.tooLarge = true; throw e;
                }
                return f.arrayBuffer();
            })
            .then(function (buf) {
                if (!subtle) return "nosubtle";
                return subtle.digest("SHA-256", buf).then(function (d) {
                    return Array.prototype.map.call(new Uint8Array(d), function (b) {
                        return ("0" + b.toString(16)).slice(-2);
                    }).join("");
                });
            });
    }

    var FILE_HASH_FULL_MAX = 64 * 1024 * 1024;
    var FILE_QUICK_FULL_MAX = 2 * 1024 * 1024;
    var FILE_FP_SLICE = 1024 * 1024;
    var FILE_LOG_CHUNK = 200;
    var ARCHIVE_ROOT = [".liteaeco", "archive"];

    function digestHex(buf) {
        if (!subtle) return Promise.resolve(null);
        return subtle.digest("SHA-256", buf).then(function (d) {
            var v = new Uint8Array(d), h = "";
            for (var i = 0; i < v.length; i++) h += ("0" + v[i].toString(16)).slice(-2);
            return h;
        });
    }
    function contentHash(file, mode, buf) {
        try {
            var fullMax = mode === "quick" ? FILE_QUICK_FULL_MAX : FILE_HASH_FULL_MAX;
            if (file.size <= fullMax) {
                return (buf ? Promise.resolve(buf) : file.arrayBuffer())
                    .then(digestHex)
                    .then(function (h) { return h ? "sha256:" + h : null; })
                    .catch(function () { return null; });
            }
            return Promise.all([
                file.slice(0, FILE_FP_SLICE).arrayBuffer(),
                file.slice(file.size - FILE_FP_SLICE).arrayBuffer()
            ]).then(function (r) {
                var head = new Uint8Array(r[0]), tail = new Uint8Array(r[1]);
                var sz = new TextEncoder().encode("|" + file.size);
                var all = new Uint8Array(head.length + tail.length + sz.length);
                all.set(head, 0); all.set(tail, head.length); all.set(sz, head.length + tail.length);
                return digestHex(all);
            }).then(function (h) { return h ? "fp1:" + h : null; })
              .catch(function () { return null; });
        } catch (e) { return Promise.resolve(null); }
    }
    function contentHashAt(root, rel, mode) {
        return getFileByRel(root, rel, false)
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) { return contentHash(f, mode); })
            .catch(function () { return null; });
    }
    function pipeFile(file, fh) {
        return fh.createWritable().then(function (w) {
            return file.stream().pipeTo(w);
        });
    }
    function fileWrite(dir, name, file) {
        var big = file.size > FILE_HASH_FULL_MAX;
        return (big ? Promise.resolve(null) : file.arrayBuffer()).then(function (buf) {
            return contentHash(file, undefined, buf).then(function (hash) {
                return dir.getFileHandle(name, { create: true }).then(function (fh) {
                    var done = buf
                        ? fh.createWritable().then(function (w) { return w.write(buf).then(function () { return w.close(); }); })
                        : pipeFile(file, fh);
                    return done.then(function () { return dir.getFileHandle(name, { create: false }); })
                        .then(function (h2) { return h2.getFile(); })
                        .then(function (check) {
                            if (check.size !== file.size) throw new Error("size mismatch after write: " + name);
                            return { size: file.size, hash: hash, mtime: check.lastModified };
                        });
                });
            });
        });
    }
    function archiveStamp() {
        var d = new Date(), p = function (n) { return ("0" + n).slice(-2); };
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    }
    function archiveMonth() {
        var d = new Date();
        return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
    }
    function archiveDir(root, dirArr) {
        var rel = ARCHIVE_ROOT.concat([archiveMonth()], dirArr || []);
        var p = Promise.resolve(root);
        rel.forEach(function (seg) { p = p.then(function (d) { return d.getDirectoryHandle(seg, { create: true }); }); });
        return p.then(function (dir) { return { dir: dir, rel: rel }; });
    }
    function exists(dir, name) {
        return dir.getFileHandle(name, { create: false }).then(function () { return true; }, function () {
            return dir.getDirectoryHandle(name, { create: false }).then(function () { return true; }, function () { return false; });
        });
    }
    function archiveFreeName(arch, name, reason, isDir) {
        var dot = isDir ? -1 : name.lastIndexOf(".");
        var stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
        var stamp = archiveStamp();
        function tryN(n) {
            if (n >= 100) return Promise.reject(new Error("no free archive name for " + name));
            var cand = stem + "__" + stamp + "_" + reason + (n ? "-" + n : "") + ext;
            return exists(arch, cand).then(function (taken) { return taken ? tryN(n + 1) : cand; });
        }
        return tryN(0);
    }
    function fileArchive(root, dir, dirArr, name, reason, keep) {
        var srcFh, src, hash, A, out;
        return dir.getFileHandle(name, { create: false })
            .then(function (fh) { srcFh = fh; return fh.getFile(); })
            .then(function (f) { src = f; return contentHash(f); })
            .then(function (h) { hash = h; return archiveDir(root, dirArr); })
            .then(function (a) { A = a; return archiveFreeName(A.dir, name, reason, false); })
            .then(function (o) {
                out = o;
                if (keep || typeof srcFh.move !== "function") return false;
                return srcFh.move(A.dir, out)
                    .then(function () { return A.dir.getFileHandle(out, { create: false }); })
                    .then(function () { return true; }, function () { return false; });
            })
            .then(function (moved) {
                if (moved) return null;
                return A.dir.getFileHandle(out, { create: true })
                    .then(function (fh) { return pipeFile(src, fh); })
                    .then(function () { return A.dir.getFileHandle(out, { create: false }); })
                    .then(function (h) { return h.getFile(); })
                    .then(function (check) {
                        if (check.size !== src.size) {
                            return A.dir.removeEntry(out).catch(function () { })
                                .then(function () { throw new Error("archive copy verify failed: " + name); });
                        }
                        if (!keep) return dir.removeEntry(name);
                    });
            })
            .then(function () {
                return {
                    name: name, path: (dirArr || []).concat(name).join("/"),
                    to: A.rel.concat(out).join("/"), size: src.size, hash: hash
                };
            });
    }
    function archivedToday(root, dirArr, name) {
        var dot = name.lastIndexOf(".");
        var stem = dot > 0 ? name.slice(0, dot) : name;
        var prefix = stem + "__" + archiveStamp().slice(0, 8) + "-";
        return getDir(root, ARCHIVE_ROOT.concat([archiveMonth()], dirArr || []), false).then(function (d) {
            if (!d || typeof d.keys !== "function") return false;
            var it = d.keys();
            return (function next() {
                return it.next().then(function (r) {
                    if (r.done) return false;
                    return String(r.value).indexOf(prefix) === 0 ? true : next();
                });
            })();
        }, function () { return false; });
    }
    function fileWriteSafe(root, dir, dirArr, name, file, opts) {
        var daily = !!(opts && opts.archive === "daily");
        return dir.getFileHandle(name, { create: false }).then(function () { return true; }, function () { return false; })
            .then(function (had) {
                if (!had) return null;
                return (daily ? archivedToday(root, dirArr, name) : Promise.resolve(false)).then(function (skip) {
                    return skip ? null : fileArchive(root, dir, dirArr, name, "ovw", true).then(function (e) { return e.to; });
                });
            })
            .then(function (replaced) {
                return fileWrite(dir, name, file).then(function (r) {
                    return {
                        name: name, path: (dirArr || []).concat(name).join("/"),
                        size: r.size, mtime: r.mtime, hash: r.hash, replaced: replaced
                    };
                });
            });
    }
    function fileLogEntries(sess, author, type, target, base, files) {
        if (!files || !files.length || !sess || !sess.append) return Promise.resolve(0);
        var parts = Math.ceil(files.length / FILE_LOG_CHUNK), p = Promise.resolve();
        for (var i = 0; i < parts; i++) {
            (function (i) {
                var chunk = files.slice(i * FILE_LOG_CHUNK, (i + 1) * FILE_LOG_CHUNK);
                var payload = {};
                Object.keys(base || {}).forEach(function (k) { payload[k] = base[k]; });
                payload.count = chunk.length; payload.total = files.length; payload.files = chunk;
                if (parts > 1) payload.part = (i + 1) + "/" + parts;
                p = p.then(function () { return sess.append(author, "hub.files", [{ type: type, target: target, payload: payload }]); });
            })(i);
        }
        return p.then(function () { return parts; });
    }
    function canUpload(root, guid, folderRel) {
        var probe = (String(folderRel || "").replace(/^\/+|\/+$/g, "") ? folderRel.replace(/\/+$/, "") + "/" : "") + "__probe__";
        return accessLevelForMe(root, guid, probe).then(function (l) { return !!(l && l.upload); });
    }

    var STAMPS_REL = ".liteaeco/stamps.json";
    function stampSeeds() {
        return {
            version: 2,
            types: [
                { id: "type-approved", title: "APPROVED", color: "#16a34a", enabled: true, decision: "approved" },
                { id: "type-rejected", title: "REJECTED", color: "#dc2626", enabled: true, decision: "rejected" },
                { id: "type-reviewed", title: "REVIEWED", color: "#2563eb", enabled: true, decision: "reviewed" }
            ],
            companies: [],
            fallback: { name: "", note: "" }
        };
    }
    function cleanLib(d) {
        var str = function (v, n) { return String(v == null ? "" : v).slice(0, n); };
        var types = (Array.isArray(d && d.types) ? d.types : []).filter(function (t) { return t && t.id; }).map(function (t) {
            return { id: str(t.id, 60), title: str(t.title || "STAMP", 40), color: str(t.color || "#16a34a", 20), enabled: t.enabled !== false, decision: t.decision || null };
        });
        var companies = (Array.isArray(d && d.companies) ? d.companies : []).filter(function (c) { return c && c.id; }).map(function (c) {
            return { id: str(c.id, 60), name: str(c.name, 120), note: str(c.note, 600), enabled: c.enabled !== false };
        });
        var fb = (d && d.fallback) || {};
        return { version: 2, types: types, companies: companies, fallback: { name: str(fb.name, 120), note: str(fb.note, 600) } };
    }
    function migrateV1(templates) {
        var lib = { version: 2, types: [], companies: [], fallback: { name: "", note: "" } };
        var seenT = {}, seenC = {};
        (templates || []).forEach(function (t, i) {
            if (!t) return;
            var title = String(t.title || "STAMP");
            if (!seenT[title.toUpperCase()]) {
                seenT[title.toUpperCase()] = 1;
                lib.types.push({ id: "type-" + i + "-" + Date.now().toString(36), title: title, color: t.color || "#16a34a", enabled: true, decision: t.decision || null });
            }
            var co = String(t.company || "");
            if (co && !seenC[co.toLowerCase()]) {
                seenC[co.toLowerCase()] = 1;
                lib.companies.push({ id: "co-" + i + "-" + Date.now().toString(36), name: co, note: String(t.note || ""), enabled: true });
            } else if (!co && t.note && !lib.fallback.note) lib.fallback.note = String(t.note);
        });
        return lib;
    }
    function stampsRead(root) {
        return getFileByRel(root, STAMPS_REL, false)
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) { return f.text(); })
            .then(function (t) {
                var d = JSON.parse(t);
                var lib = (d && d.version === 2) ? cleanLib(d) : cleanLib(migrateV1(d && d.templates));
                lib.exists = true; lib.migrated = !(d && d.version === 2);
                lib.savedAt = d.savedAt || null; lib._raw = d;
                return lib;
            })
            .catch(function () { var lib = stampSeeds(); lib.exists = false; return lib; });
    }
    function signedPart(doc) {
        return { version: doc.version, savedAt: doc.savedAt, types: doc.types, companies: doc.companies, fallback: doc.fallback };
    }
    function stampsSave(root, lib) {
        var doc = cleanLib(lib);
        doc.savedAt = new Date().toISOString();
        var sp = (typeof signData === "function") ? signData(signedPart(doc)).catch(function () { return null; }) : Promise.resolve(null);
        return sp.then(function (sig) {
            if (sig) doc.signature = sig;
            return getFileByRel(root, STAMPS_REL, true);
        }).then(function (fh) { return fh.createWritable(); })
          .then(function (w) { return w.write(JSON.stringify(doc, null, 2)).then(function () { return w.close(); }); })
          .then(function () { return doc; });
    }
    function stampsVerify(st, lib) {
        var tr = st && st.trust;
        if (!tr || !tr.enabled) return Promise.resolve(true);
        var raw = lib && lib._raw ? lib._raw : lib;
        if (!raw || raw.version !== 2) return Promise.resolve(false);
        var sig = raw.signature;
        var d = sig && tr.devices[sig.kid];
        if (!(sig && tr.admins[sig.kid] && d && d.status === "approved")) return Promise.resolve(false);
        return verifyData(signedPart(raw), sig).catch(function () { return false; });
    }

    function bufToHex(buf) {
        var v = new Uint8Array(buf), s = "";
        for (var i = 0; i < v.length; i++) s += ("0" + v[i].toString(16)).slice(-2);
        return s;
    }

    var _fpMemo = nmap();
    function fpMemoKey(root, rel, f) {
        return "fp" + FP_ALGO + ":" + (root && root.name ? root.name : "") + "|" + rel + "|" + f.size + "|" + f.lastModified;
    }
    function hashPieces(f) {
        var n = Math.max(1, Math.ceil(f.size / FP_PIECE));
        var digests = new Array(n);
        function read(i) { return f.slice(i * FP_PIECE, Math.min(f.size, (i + 1) * FP_PIECE)).arrayBuffer(); }
        function step(i, cur) {
            if (i >= n) return Promise.resolve();
            var next = i + 1 < n ? read(i + 1) : null;
            return cur.then(function (buf) { return subtle.digest("SHA-256", buf); })
                .then(function (d) { digests[i] = new Uint8Array(d); return step(i + 1, next); });
        }
        return step(0, read(0)).then(function () {
            var tag = new TextEncoder().encode("liteaeco-fp3|" + f.size + "|" + FP_PIECE + "|");
            var all = new Uint8Array(tag.length + n * 32);
            all.set(tag, 0);
            for (var i = 0; i < n; i++) all.set(digests[i], tag.length + i * 32);
            return subtle.digest("SHA-256", all).then(function (b) { return bufToHex(b).slice(0, 32); });
        });
    }
    function fingerprintIfc(root, rel) {
        return getFileByRel(root, rel, false)
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) {
                var mk = fpMemoKey(root, rel, f);
                if (_fpMemo[mk]) return _fpMemo[mk];
                var memo = kvGet("kv", mk).catch(function () { return null; });
                var job = memo.then(function (hit) {
                    if (hit && hit.fp && hit.fpAlgo === FP_ALGO && hit.size === f.size) return hit;
                    var head = f.slice(0, Math.min(FP_HEAD_BYTES, f.size));
                    return head.arrayBuffer().then(function (buf) {
                        var text = "";
                        try { text = new TextDecoder("utf-8", { fatal: false }).decode(buf); } catch (e) { text = ""; }
                        var info = parseIfcHeader(text);
                        var sizeBytes = new TextEncoder().encode("|" + f.size);
                        var all = new Uint8Array(buf.byteLength + sizeBytes.length);
                        all.set(new Uint8Array(buf), 0);
                        all.set(sizeBytes, buf.byteLength);
                        if (!subtle) {
                            return { fp: "nosubtle", fpLegacy: "nosubtle", fpAlgo: FP_ALGO, size: f.size, lastModified: f.lastModified,
                                headerTimestamp: info.timestamp, headerName: info.name, schema: info.schema, isIfc: info.isIfc };
                        }
                        return Promise.all([
                            subtle.digest("SHA-256", all).then(function (b) { return bufToHex(b).slice(0, 32); }),
                            hashPieces(f)
                        ]).then(function (r) {
                            var out = {
                                fp: r[1], fpLegacy: r[0], fpAlgo: FP_ALGO, size: f.size, lastModified: f.lastModified,
                                headerTimestamp: info.timestamp, headerName: info.name, schema: info.schema,
                                isIfc: info.isIfc
                            };
                            kv("kv", "readwrite", function (s) { s.put(out, mk); return null; }).catch(function () { });
                            return out;
                        });
                    });
                });
                _fpMemo[mk] = job;
                job.catch(function () { delete _fpMemo[mk]; });
                return job.then(function (r) { var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; }); return c; });
            });
    }

    function parseIfcHeader(text) {
        var out = { isIfc: /ISO-10303-21/.test(text), name: null, timestamp: null, schema: null };
        var m = text.match(/FILE_NAME\s*\(\s*'((?:[^']|'')*)'\s*,\s*'([^']*)'/);
        if (m) { out.name = m[1].replace(/''/g, "'"); out.timestamp = m[2] || null; }
        var s = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/);
        if (s) out.schema = s[1];
        return out;
    }

    function defaultManifest(meta) {
        meta = meta || {};
        var now = new Date().toISOString();
        return {
            schemaVersion: 1,
            structureVersion: STRUCTURE_VERSION,
            cdeBuild: CDE_BUILD,
            guid: meta.guid || uuidV4(),
            number: meta.number || "",
            title: meta.title || "",
            client: meta.client || "",
            address: meta.address || "",
            type: meta.type || "",
            folders: {
                admin: ADMIN_DIR.join("/"),
                models: MODELS_DIR.join("/"),
                coordination: COORD_DIR.join("/"),
                modelReports: REPORTS_DIR.join("/"),
                issues: ISSUES_DIR.join("/"),
                issuesExports: ISSUES_EXPORTS_DIR.join("/"),
                timelines: ADMIN_DIR.concat("timelines").join("/"),
                reports: "reports",
                log: LOG_DIR.join("/"),
                objects: OBJECTS_DIR.join("/"),
                cache: CACHE_DIR.join("/"),
                cacheModels: CACHE_MODELS_DIR.join("/")
            },
            apps: {
                org_chart: { folder: ADMIN_DIR.join("/") },
                meetings: {
                    folder: ADMIN_DIR.concat("meetings").join("/"),
                    issues: ISSUES_DIR.concat(APP_ISSUES_SUB.meetings).join("/")
                },
                resp_matrix: { folder: ADMIN_DIR.concat("rasci").join("/") },
                timelines: { folder: ADMIN_DIR.concat("timelines").join("/") },
                model_viewer: {
                    folders: [{ tag: "", path: MODELS_DIR.join("/") }],
                    federations: COORD_DIR.join("/"),
                    reports: REPORTS_DIR.join("/"),
                    issues: ISSUES_DIR.concat(APP_ISSUES_SUB.model_viewer).join("/")
                }
            },
            createdAt: now,
            updatedAt: now
        };
    }

    function readManifest(root) {
        return readTextFile(root, MANIFEST_NAME).then(function (txt) {
            if (txt === null) return null;
            if (txt && txt.__readError) return txt;
            try { return JSON.parse(txt); } catch (e) { return { __readError: true, error: e }; }
        });
    }

    function writeManifest(root, manifest) {
        manifest.updatedAt = new Date().toISOString();
        return writeTextFile(root, MANIFEST_NAME, JSON.stringify(manifest, null, 2)).then(function () { return manifest; });
    }

    function bootstrap(root, meta, opts) {
        return readManifest(root).then(function (existing) {
            if (existing && existing.__readError) throw new Error("project.json unreadable, refusing to bootstrap");
            var gate = (!existing && opts && opts.onNewProject)
                ? Promise.resolve(opts.onNewProject(root)).then(function (go) {
                    if (!go) { var e = new Error("cancelled"); e.cancelled = true; throw e; }
                })
                : Promise.resolve();
            return gate.then(function () {
            var ensureDirs = ensureStructureDirs(root, existing || null);
            if (existing) {
                return ensureDirs.then(function () { return ensureStructure(root, existing); })
                    .then(function (m) { m.__adopted = true; return m; });
            }
            var manifest = defaultManifest(meta);
            return ensureDirs.then(function () { return writeManifest(root, manifest); });
            });
        });
    }

    var STRUCTURE_KEYS = ["models", "coordination", "modelReports", "issues", "issuesExports"];
    function okFirst(seg) { return seg.charAt(0) !== "." || seg.toLowerCase() === ".admin"; }
    function cleanRel(v) {
        var parts = String(v == null ? "" : v).split("/").filter(Boolean);
        return parts.length && okFirst(parts[0]) && parts.every(function (x) { return x !== ".." && x !== "."; }) ? parts : null;
    }
    function issuesFolder(m, app) {
        var sub = Object.prototype.hasOwnProperty.call(APP_ISSUES_SUB, app) ? APP_ISSUES_SUB[app] : null;
        if (!sub) return null;
        var a = m && m.apps && m.apps[app];
        var own = a && typeof a.issues === "string" ? cleanRel(a.issues) : null;
        if (own) return own.join("/");
        var f = (m && m.folders) || {};
        var base = (typeof f.issues === "string" && cleanRel(f.issues)) || ISSUES_DIR;
        return base.concat(sub).join("/");
    }
    var DEFAULTS = null;
    function defaultsOf() {
        if (!DEFAULTS) { var d = defaultManifest({ guid: "defaults" }); DEFAULTS = { folders: d.folders, apps: d.apps }; }
        return DEFAULTS;
    }
    function folderOf(m, key) {
        var f = m && m.folders;
        var own = f && typeof f[key] === "string" ? cleanRel(f[key]) : null;
        if (own) return own.join("/");
        var d = defaultsOf().folders[key];
        return typeof d === "string" ? d : null;
    }
    function appFolderOf(m, app, key) {
        if (key === "issues") return issuesFolder(m, app);
        var a = m && m.apps && m.apps[app];
        var own = a && typeof a[key] === "string" ? cleanRel(a[key]) : null;
        if (own) return own.join("/");
        var da = defaultsOf().apps[app];
        return da && typeof da[key] === "string" ? da[key] : null;
    }
    function rosterFileOf(m) { return folderOf(m, "admin") + "/members.xlsx"; }
    function issueFoldersOf(m) {
        var apps = (m && m.apps) || {}, out = [];
        Object.keys(apps).forEach(function (a) {
            if (apps[a] && typeof apps[a].issues === "string" && apps[a].issues) {
                var f = issuesFolder(m, a);
                if (f && out.indexOf(f) < 0) out.push(f);
            }
        });
        return out;
    }
    function modelFoldersOf(m) {
        var a = m && m.apps && m.apps.model_viewer;
        var list = a && Array.isArray(a.folders) ? a.folders.filter(function (x) { return x && typeof x.path === "string" && cleanRel(x.path); })
            .map(function (x) { return { tag: String(x.tag || ""), path: cleanRel(x.path).join("/") }; }) : [];
        if (list.length) return list;
        return defaultsOf().apps.model_viewer.folders.map(function (x) { return { tag: x.tag, path: x.path }; });
    }
    function structureDirList(m) {
        var def = defaultManifest({}).folders;
        var f = (m && m.folders) || {};
        var out = [LOG_DIR, CACHE_DIR, CACHE_MODELS_DIR, OBJECTS_DIR];
        ["admin"].concat(STRUCTURE_KEYS).forEach(function (k) {
            var v = typeof f[k] === "string" && f[k].trim() ? f[k] : def[k];
            var parts = cleanRel(v);
            if (parts) out.push(parts);
        });
        ISSUES_APPS_CREATED.forEach(function (app) {
            var p = cleanRel(issuesFolder(m, app));
            if (p) out.push(p);
        });
        return out;
    }
    function ensureStructureDirs(root, m) {
        return Promise.all(structureDirList(m).map(function (parts) { return getDir(root, parts, true); }));
    }

    function pathsRewrite(m, oldKey, newKey) {
        var changes = [];
        oldKey = String(oldKey || "").replace(/^\/+|\/+$/g, "");
        newKey = String(newKey || "").replace(/^\/+|\/+$/g, "");
        if (!m || !oldKey || !newKey || oldKey === newKey) return changes;
        var lo = oldKey.toLowerCase();
        function map(v) {
            if (typeof v !== "string") return null;
            var t = v.replace(/^\/+|\/+$/g, ""), tl = t.toLowerCase();
            if (tl === lo) return newKey;
            if (tl.indexOf(lo + "/") === 0) return newKey + t.slice(oldKey.length);
            return null;
        }
        function apply(obj, key, where) {
            var n = map(obj[key]);
            if (n !== null && n !== obj[key]) { changes.push({ where: where, from: obj[key], to: n }); obj[key] = n; }
        }
        if (m.folders) Object.keys(m.folders).forEach(function (k) { apply(m.folders, k, "folders." + k); });
        if (m.apps) Object.keys(m.apps).forEach(function (a) {
            var app = m.apps[a];
            if (!app || typeof app !== "object") return;
            ["folder", "federations", "reports", "issues"].forEach(function (k) { apply(app, k, "apps." + a + "." + k); });
            if (Array.isArray(app.folders)) app.folders.forEach(function (f, i) {
                if (f && typeof f === "object") apply(f, "path", "apps." + a + ".folders[" + i + "]");
            });
        });
        return changes;
    }

    function ensureStructure(root, manifestOpt) {
        var mp = manifestOpt ? Promise.resolve(manifestOpt) : readManifest(root);
        return mp.then(function (m) {
            if (!m || m.__readError) return m;
            return ensureStructureDirs(root, m).then(function () {
                var changed = false;
                var def = defaultManifest({ guid: m.guid });
                m.folders = m.folders || {};
                Object.keys(def.folders).forEach(function (k) {
                    if (m.folders[k] === undefined) { m.folders[k] = def.folders[k]; changed = true; }
                });
                m.apps = m.apps || {};
                Object.keys(def.apps).forEach(function (k) {
                    if (m.apps[k] === undefined) { m.apps[k] = def.apps[k]; changed = true; }
                });
                if (m.apps.model_viewer) {
                    var mv = m.apps.model_viewer, dmv = def.apps.model_viewer;
                    if (!Array.isArray(mv.folders) || !mv.folders.length) { mv.folders = dmv.folders; changed = true; }
                    if (!mv.federations) { mv.federations = dmv.federations; changed = true; }
                    if (!mv.reports) { mv.reports = dmv.reports; changed = true; }
                }
                ISSUES_APPS_CREATED.forEach(function (app) {
                    var a = m.apps[app];
                    if (a && typeof a === "object" && !(typeof a.issues === "string" && cleanRel(a.issues))) {
                        a.issues = issuesFolder(m, app); changed = true;
                    }
                });
                if ((m.structureVersion || 1) < STRUCTURE_VERSION) { m.structureVersion = STRUCTURE_VERSION; changed = true; }
                if (m.cdeBuild !== CDE_BUILD) { m.cdeBuild = CDE_BUILD; changed = true; }
                if (!changed) return m;
                return writeManifest(root, m);
            });
        });
    }

    function resumeLatestSegment(root, dev, api) {
        var cap = W.__cdeRotateEvents || 500;
        return getDir(root, LOG_DIR, false).then(function (dir) {
            var names = [];
            return (function collect(iter) {
                return iter.next().then(function (r) {
                    if (r.done) return names;
                    if (r.value.kind === "file" && r.value.name.indexOf(dev + "-") === 0 && /\.jsonl$/.test(r.value.name)) names.push(r.value.name);
                    return collect(iter);
                });
            })(dir.values());
        }).then(function (names) {
            if (!names.length) return null;
            names.sort();
            var latest = names[names.length - 1];
            var rel = LOG_DIR.join("/") + "/" + latest;
            return readTextFile(root, rel).then(function (txt) {
                if (txt == null || (txt && txt.__readError)) return null;
                if (!txt.length) { api.segmentRel = rel; api.prevHash = GENESIS; api.lineCount = 0; return null; }
                if (txt.charAt(txt.length - 1) !== "\n") return null;
                var lines = txt.split("\n").filter(function (l) { return l.length; });
                if (lines.length >= cap) return null;
                var last;
                try { last = JSON.parse(lines[lines.length - 1]); } catch (e) { return null; }
                return sha256Hex(canonicalEvent(last)).then(function (h) {
                    api.segmentRel = rel;
                    api.prevHash = h;
                    api.lineCount = lines.length;
                });
            });
        }).catch(function () { return null; });
    }

    function session(root) {
        var api = {};
        var ready = deviceId().then(function (dev) {
            api.deviceId = dev;
            api.sessionId = ulid();
            api.segmentRel = LOG_DIR.join("/") + "/" + dev + "-" + api.sessionId + ".jsonl";
            api.prevHash = GENESIS;
            api.lineCount = 0;
            api.chain = Promise.resolve();
            if (typeof navigator !== "undefined" && navigator.locks) {
                var gateResolve;
                var gate = new Promise(function (r) { gateResolve = r; });
                navigator.locks.request("liteaeco-seg-" + dev, { ifAvailable: true }, function (lock) {
                    if (!lock) { gateResolve(); return; }
                    return new Promise(function () {
                        resumeLatestSegment(root, dev, api)
                            .then(function () { gateResolve(); }, function () { gateResolve(); });
                    });
                });
                return gate.then(function () { return api; });
            }
            return api;
        });

        api.append = function (author, app, events) {
            return ready.then(function () {
                var run = api.chain.then(function () {
                    return deviceKid().then(function (k) { api.kid = k || null; });
                }).then(function () {
                    var cap = W.__cdeRotateEvents || 500;
                    if (api.lineCount > 0 && api.lineCount + events.length > cap) {
                        api.sessionId = ulid();
                        api.segmentRel = LOG_DIR.join("/") + "/" + api.deviceId + "-" + api.sessionId + ".jsonl";
                        api.prevHash = GENESIS;
                        api.lineCount = 0;
                    }
                    var lines = "";
                    var pending = api.prevHash;
                    var seq = Promise.resolve();
                    events.forEach(function (e) {
                        seq = seq.then(function () {
                            var ev = {
                                id: ulid(),
                                ts: new Date().toISOString(),
                                author: author,
                                app: app,
                                type: e.type,
                                target: e.target || null,
                                payload: e.payload === undefined ? null : e.payload,
                                prevHash: pending
                            };
                            if (api.kid) ev.kid = api.kid;
                            var canonical = canonicalEvent(ev);
                            return signCanonical(canonical).then(function (sig) {
                                if (sig) ev.sig = sig;
                                return sha256Hex(canonical).then(function (h) {
                                    pending = h;
                                    lines += JSON.stringify(ev) + "\n";
                                    return ev;
                                });
                            });
                        });
                    });
                    return seq.then(function () {
                        if (!lines) return [];
                        return appendTextFile(root, api.segmentRel, lines).then(function (r) {
                            api.prevHash = pending;
                            api.lineCount += events.length;
                            return r;
                        });
                    });
                });
                api.chain = run.then(function () { }, function () { });
                return run;
            });
        };
        api.ready = function () { return ready; };
        return api;
    }

    var LOGCACHE_DB = "liteaeco-logcache";
    var LOGCACHE_PRUNE_MS = 180 * 24 * 3600 * 1000;
    var logDbPromise = null;
    function openLogDB() {
        if (logDbPromise) return logDbPromise;
        logDbPromise = new Promise(function (resolve) {
            if (typeof indexedDB === "undefined") return resolve(null);
            var req;
            try { req = indexedDB.open(LOGCACHE_DB, 1); } catch (e) { return resolve(null); }
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains("segs")) db.createObjectStore("segs");
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { resolve(null); };
            req.onblocked = function () { resolve(null); };
        });
        return logDbPromise;
    }
    function segCacheGet(name) {
        return openLogDB().then(function (db) {
            if (!db) return null;
            return new Promise(function (resolve) {
                try {
                    var r = db.transaction("segs", "readonly").objectStore("segs").get(name);
                    r.onsuccess = function () { resolve(r.result || null); };
                    r.onerror = function () { resolve(null); };
                } catch (e) { resolve(null); }
            });
        });
    }
    function segCachePut(name, val) {
        return openLogDB().then(function (db) {
            if (!db) return null;
            return new Promise(function (resolve) {
                try {
                    var t = db.transaction("segs", "readwrite");
                    t.objectStore("segs").put(val, name);
                    t.oncomplete = function () { resolve(true); };
                    t.onerror = function () { resolve(null); };
                } catch (e) { resolve(null); }
            });
        });
    }
    var _logPruneDone = false;
    function segCachePrune() {
        if (_logPruneDone) return;
        _logPruneDone = true;
        openLogDB().then(function (db) {
            if (!db) return;
            try {
                var cutoff = Date.now() - LOGCACHE_PRUNE_MS;
                var cur = db.transaction("segs", "readwrite").objectStore("segs").openCursor();
                cur.onsuccess = function () {
                    var c = cur.result;
                    if (!c) return;
                    if (!c.value || !c.value.used || c.value.used < cutoff) c.delete();
                    c.continue();
                };
            } catch (e) { }
        });
    }
    function clearLogCache() {
        return openLogDB().then(function (db) {
            if (!db) return false;
            return new Promise(function (resolve) {
                try {
                    var t = db.transaction("segs", "readwrite");
                    t.objectStore("segs").clear();
                    t.oncomplete = function () { resolve(true); };
                    t.onerror = function () { resolve(false); };
                } catch (e) { resolve(false); }
            });
        });
    }
    function parseSegmentBytes(bytes, lineBase) {
        var lastNl = -1;
        for (var i = bytes.length - 1; i >= 0; i--) { if (bytes[i] === 10) { lastNl = i; break; } }
        var dec = new TextDecoder("utf-8");
        var complete = lastNl >= 0 ? dec.decode(bytes.subarray(0, lastNl + 1)) : "";
        var tail = dec.decode(bytes.subarray(lastNl + 1));
        var events = [], warns = [], tailEvents = [];
        var lines = complete.split("\n");
        for (var j = 0; j < lines.length; j++) {
            var ln = lines[j].trim();
            if (!ln) continue;
            try { events.push(JSON.parse(ln)); }
            catch (e) { warns.push(lineBase + j); }
        }
        var tl = tail.trim();
        if (tl) { try { tailEvents.push(JSON.parse(tl)); } catch (e) {  } }
        return { events: events, tailEvents: tailEvents, warns: warns, completeBytes: lastNl + 1, lines: lines.length - 1 };
    }
    function readSegmentCached(fh, warnings) {
        return fh.getFile().then(function (f) {
            return segCacheGet(fh.name).then(function (c) {
                var now = Date.now();
                var fresh = c && c.size === f.size && c.lastModified === f.lastModified;
                if (fresh) {
                    (c.warns || []).forEach(function (ln) { warnings.push({ segment: fh.name, line: ln, reason: "parse" }); });
                    if (now - (c.used || 0) > 24 * 3600 * 1000) { c.used = now; segCachePut(fh.name, c); }
                    return c.tailEvents && c.tailEvents.length ? c.events.concat(c.tailEvents) : c.events;
                }
                var grown = c && f.size > c.size && typeof c.parsedBytes === "number" && c.parsedBytes <= f.size && f.lastModified >= c.lastModified;
                var start = grown ? c.parsedBytes : 0;
                return f.slice(start).arrayBuffer().then(function (buf) {
                    var r = parseSegmentBytes(new Uint8Array(buf), grown ? (c.lines || 0) : 0);
                    var events = grown ? c.events.concat(r.events) : r.events;
                    var warns = (grown ? (c.warns || []) : []).concat(r.warns);
                    warns.forEach(function (ln) { warnings.push({ segment: fh.name, line: ln, reason: "parse" }); });
                    segCachePut(fh.name, {
                        size: f.size, lastModified: f.lastModified,
                        parsedBytes: start + r.completeBytes, lines: (grown ? (c.lines || 0) : 0) + r.lines,
                        events: events, tailEvents: r.tailEvents, warns: warns, used: now
                    });
                    return r.tailEvents.length ? events.concat(r.tailEvents) : events;
                });
            });
        });
    }

    function readLog(root) {
        var warnings = [];
        return getDir(root, LOG_DIR, false).then(function (dir) {
            var files = [];
            return (function collect(iter) {
                return iter.next().then(function (r) {
                    if (r.done) return files;
                    var entry = r.value;
                    if (entry.kind === "file" && /\.jsonl$/.test(entry.name)) files.push(entry);
                    return collect(iter);
                });
            })(dir.values());
        }).then(function (files) {
            segCachePrune();
            return Promise.all(files.map(function (fh) {
                return readSegmentCached(fh, warnings).catch(function () {
                    warnings.push({ segment: fh.name, reason: "read" });
                    return [];
                });
            }));
        }).then(function (perSegment) {
            var all = [];
            var seen = nmap();
            var segments = perSegment.map(function (evs, i) { return { index: i, events: evs }; });
            perSegment.forEach(function (evs) {
                evs.forEach(function (ev) {
                    if (!ev || !ev.id || seen[ev.id]) return;
                    seen[ev.id] = true;
                    all.push(ev);
                });
            });
            all.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
            return { events: all, warnings: warnings, segments: segments };
        }).catch(function () {
            return { events: [], warnings: [{ reason: "nolog" }], segments: [] };
        });
    }

    function replay(events, trustCtx) {
        var state = {
            project: nmap(),
            members: nmap(),
            contacts: nmap(),
            teams: nmap(),
            files: nmap(),
            models: nmap(),
            frags: nmap(),
            federations: nmap(),
            reports: nmap(),
            issues: nmap(),
            disciplines: nmap(),
            clash: { decisions: nmap() },
            aliases: nmap(),
            aliasInfo: nmap(),
            trust: null,
            access: { rules: nmap(), mode: "open", grants: nmap() },
            lastEventId: null
        };
        var ctx = trustCtx || { sigOk: nmap(), chainOk: nmap(), kidOf: nmap(), pubByKid: nmap(), subtle: false };
        var TR = state.trust = {
            enabled: false, rootKid: null, rootMember: null, pinnedRoot: ctx.pinnedRoot || null,
            rootMismatch: false, rootMissing: false, verifiable: !!ctx.subtle,
            admins: nmap(),
            devices: nmap(),
            events: nmap(),
            rejected: [],
            conflicts: [],
            counts: { verified: 0, pending: 0, unverified: 0, legacy: 0 }
        };
        var pendingByKid = nmap();
        if (TR.pinnedRoot) {
            var found = events.some(function (e) { return e && e.type === "trust.enable" && e.payload && e.payload.rootKid === TR.pinnedRoot; });
            if (!found) { TR.enabled = true; TR.rootMissing = true; TR.rootMismatch = true; }
        }
        function sigGood(ev) { return !!ctx.sigOk[ev.id] && ctx.chainOk[ev.id] !== false; }
        function sameMember(a, b) {
            if (!a || !b) return false;
            return a === b || resolveAlias(state.aliases, a) === resolveAlias(state.aliases, b);
        }
        function levelOf(ev) {
            if (!TR.enabled) return "legacy";
            if (!sigGood(ev)) return "unverified";
            var d = TR.devices[ev.kid];
            if (!d || d.status === "revoked" || !sameMember(d.memberId, ev.author)) return "unverified";
            return d.status === "approved" ? "verified" : "pending";
        }
        function adminEv(ev) {
            if (!TR.enabled || !sigGood(ev) || !TR.admins[ev.kid]) return false;
            var d = TR.devices[ev.kid];
            return !!(d && d.status === "approved");
        }
        function adminCount() { return Object.keys(TR.admins).length; }
        function reject(ev, reason) { TR.rejected.push({ id: ev.id, type: ev.type, author: ev.author, reason: reason }); }
        function setLevel(ev, lvl) {
            var prev = TR.events[ev.id];
            if (prev) TR.counts[prev]--;
            TR.events[ev.id] = lvl;
            TR.counts[lvl]++;
            if (lvl === "pending" && ev.kid) (pendingByKid[ev.kid] = pendingByKid[ev.kid] || []).push(ev.id);
        }
        events.forEach(function (ev) {
            var t = ev.type, id = ev.target, p = ev.payload || {};
            state.lastEventId = ev.id;
            if (id != null && badKey(String(id))) return;
            var lvl = levelOf(ev);
            if (t === "trust.enable" || t === "device.bind" || t === "device.approve" || t === "device.revoke" || t === "admin.grant" || t === "admin.revoke") {
                var pk = p.kid || p.rootKid;
                if (typeof pk !== "string" || pk.length > 128 || badKey(pk)) { reject(ev, "bad-kid"); setLevel(ev, "unverified"); return; }
                if (t === "trust.enable") {
                    var pubKid = p.pubkey ? ctx.kidOf[jwkCore(p.pubkey)] : null;
                    if (TR.enabled && !TR.rootMissing) {
                        if (p.rootKid !== TR.rootKid) TR.conflicts.push({ id: ev.id, type: t, reason: "second-root" });
                        setLevel(ev, lvl); return;
                    }
                    if (!sigGood(ev) || ev.kid !== p.rootKid || pubKid !== p.rootKid) { reject(ev, "unsigned-root"); setLevel(ev, "unverified"); return; }
                    var mem = state.members[p.memberId];
                    var claimKid = mem && mem.pubkey ? ctx.kidOf[jwkCore(mem.pubkey)] : null;
                    if (!mem || mem.role !== "admin" || claimKid !== p.rootKid) { reject(ev, "no-admin-claim"); setLevel(ev, "unverified"); return; }
                    if (TR.pinnedRoot && TR.pinnedRoot !== p.rootKid) { TR.conflicts.push({ id: ev.id, type: t, reason: "pinned-root-differs" }); TR.rootMismatch = true; TR.enabled = true; setLevel(ev, "unverified"); return; }
                    if (TR.rootMissing) { setLevel(ev, "unverified"); return; }
                    TR.enabled = true; TR.rootKid = p.rootKid; TR.rootMember = p.memberId;
                    TR.admins[p.rootKid] = p.memberId;
                    var rd = nmap();
                    rd.kid = p.rootKid; rd.code = shortCode(p.rootKid); rd.memberId = p.memberId;
                    rd.label = typeof p.label === "string" ? p.label.slice(0, 120) : ""; rd.status = "approved";
                    rd.boundAt = ev.ts; rd.approvedBy = p.rootKid;
                    TR.devices[p.rootKid] = rd;
                    setLevel(ev, "verified");
                    return;
                }
                if (t === "device.bind") {
                    var bKid = p.pubkey ? ctx.kidOf[jwkCore(p.pubkey)] : null;
                    if (!sigGood(ev) || ev.kid !== p.kid || bKid !== p.kid || typeof p.memberId !== "string" || badKey(p.memberId) || !sameMember(p.memberId, ev.author)) {
                        reject(ev, "bad-bind"); setLevel(ev, "unverified"); return;
                    }
                    var ex = TR.devices[p.kid];
                    if (ex && ex.status !== "revoked" && !sameMember(ex.memberId, p.memberId)) { reject(ev, "key-bound-to-other-member"); setLevel(ev, "unverified"); return; }
                    if (ex && ex.status === "revoked") { reject(ev, "key-revoked"); setLevel(ev, "unverified"); return; }
                    var bd = ex || nmap();
                    bd.kid = p.kid; bd.code = shortCode(p.kid); bd.memberId = p.memberId;
                    bd.label = typeof p.label === "string" ? p.label.slice(0, 120) : (bd.label || "");
                    if (!bd.status) { bd.status = TR.admins[p.kid] ? "approved" : "pending"; bd.boundAt = ev.ts; }
                    TR.devices[p.kid] = bd;
                    setLevel(ev, levelOf(ev));
                    return;
                }
                if (t === "device.approve" || t === "admin.grant") {
                    var target = TR.devices[p.kid];
                    if (!adminEv(ev)) { reject(ev, "not-admin"); setLevel(ev, lvl); return; }
                    if (!target || target.status === "revoked") { reject(ev, "unknown-or-revoked-device"); setLevel(ev, lvl); return; }
                    target.status = "approved"; target.approvedBy = ev.kid;
                    if (t === "admin.grant") TR.admins[p.kid] = target.memberId;
                    (pendingByKid[p.kid] || []).forEach(function (eid) { if (TR.events[eid] === "pending") { TR.counts.pending--; TR.counts.verified++; TR.events[eid] = "verified"; } });
                    pendingByKid[p.kid] = [];
                    setLevel(ev, lvl);
                    return;
                }
                if (t === "admin.revoke") {
                    if (!adminEv(ev)) { reject(ev, "not-admin"); setLevel(ev, lvl); return; }
                    if (!TR.admins[p.kid]) { setLevel(ev, lvl); return; }
                    if (adminCount() <= 1) { reject(ev, "last-admin"); setLevel(ev, lvl); return; }
                    delete TR.admins[p.kid];
                    setLevel(ev, lvl);
                    return;
                }
                if (t === "device.revoke") {
                    var rv = TR.devices[p.kid];
                    var self = sigGood(ev) && ev.kid === p.kid && rv && rv.status !== "revoked";
                    if (!self && !adminEv(ev)) { reject(ev, "not-admin"); setLevel(ev, lvl); return; }
                    if (!rv) { setLevel(ev, lvl); return; }
                    if (TR.admins[p.kid] && adminCount() <= 1) { reject(ev, "last-admin"); setLevel(ev, lvl); return; }
                    delete TR.admins[p.kid];
                    rv.status = "revoked"; rv.revokedBy = ev.kid;
                    setLevel(ev, lvl);
                    return;
                }
            }
            if (TR.enabled && (TRUST_PROTECTED[t] || /^access\./.test(t))) {
                if (!adminEv(ev)) { reject(ev, "not-admin"); setLevel(ev, lvl); return; }
            }
            if (TR.enabled && t === "project.info" && (p.sharedPath !== undefined || p.modelFolders !== undefined || p.mainTimeline !== undefined || p.mainTimelineTitle !== undefined) && !adminEv(ev)) {
                var PROTECTED_INFO = { sharedPath: 1, modelFolders: 1, mainTimeline: 1, mainTimelineTitle: 1 };
                var stripped = nmap();
                Object.keys(p).forEach(function (k) { if (!PROTECTED_INFO[k]) stripped[k] = p[k]; });
                reject(ev, "protected-fields-stripped");
                p = stripped;
            }
            setLevel(ev, lvl);
            switch (t) {
                case "project.info":
                    safeAssign(state.project, p);
                    break;
                case "member.claim":
                    var m = state.members[id];
                    if (!m) { m = nmap(); m.id = id; m.deviceIds = []; }
                    Object.keys(p).forEach(function (k) {
                        if (badKey(k)) return;
                        if (k === "deviceId") {
                            if (m.deviceIds.indexOf(p.deviceId) === -1) m.deviceIds.push(p.deviceId);
                        } else m[k] = p[k];
                    });
                    state.members[id] = m;
                    break;
                case "person.remap":
                case "person.merge":
                    var af = typeof p.from === "string" ? p.from.trim() : "";
                    var at = typeof p.to === "string" ? p.to.trim() : "";
                    if (!af || !at || af === at || af.length > 128 || at.length > 128 || badKey(af) || badKey(at)) break;
                    if (resolveAlias(state.aliases, at) === af) break;
                    state.aliases[af] = at;
                    var ai = nmap();
                    ai.kind = t === "person.merge" ? "merge" : "remap";
                    ai.file = typeof p.file === "string" ? p.file.slice(0, 512) : null;
                    ai.ts = ev.ts; ai.author = ev.author;
                    state.aliasInfo[af] = ai;
                    if (state.members[af]) {
                        var src = state.members[af], dst = state.members[at];
                        if (!dst) {
                            dst = nmap();
                            safeAssign(dst, src);
                            dst.id = at;
                            dst.deviceIds = (src.deviceIds || []).slice();
                            state.members[at] = dst;
                        } else {
                            if (!Array.isArray(dst.deviceIds)) dst.deviceIds = [];
                            (src.deviceIds || []).forEach(function (d) { if (dst.deviceIds.indexOf(d) === -1) dst.deviceIds.push(d); });
                        }
                    }
                    if (state.contacts[af] && !state.contacts[at]) {
                        var moved = nmap();
                        safeAssign(moved, state.contacts[af]);
                        moved.id = at;
                        state.contacts[at] = moved;
                    }
                    break;
                case "person.unmerge":
                    var uf = typeof p.from === "string" ? p.from.trim() : "";
                    if (!uf || badKey(uf)) break;
                    if (state.aliasInfo[uf] && state.aliasInfo[uf].kind === "merge") {
                        delete state.aliases[uf];
                        delete state.aliasInfo[uf];
                    }
                    break;
                case "contact.add":
                    var ca = nmap(); ca.id = id;
                    state.contacts[id] = safeAssign(ca, p);
                    break;
                case "contact.update":
                    if (!state.contacts[id]) { var cu = nmap(); cu.id = id; state.contacts[id] = cu; }
                    safeAssign(state.contacts[id], p);
                    delete state.contacts[id]._deleted;
                    break;
                case "contact.remove":
                    if (!state.contacts[id]) { var cr = nmap(); cr.id = id; state.contacts[id] = cr; }
                    state.contacts[id]._deleted = true;
                    break;
                case "team.add":
                case "team.update":
                    var ta = nmap(); ta.id = id;
                    state.teams[id] = safeAssign(ta, p);
                    break;
                case "team.remove":
                    if (!state.teams[id]) { var tr = nmap(); tr.id = id; state.teams[id] = tr; }
                    state.teams[id]._deleted = true;
                    break;
                case "file.assign":
                    var fa = nmap();
                    fa.app = p.app || null; fa.kind = p.kind || null;
                    fa.contentHash = p.contentHash || null;
                    fa.assignedBy = ev.author; fa.ts = ev.ts;
                    state.files[id] = fa;
                    break;
                case "file.unassign":
                    delete state.files[id];
                    break;
                case "access.rule.set":
                    if (!TR.enabled) break;
                    var rule = accessSanitizeRule(p);
                    if (!rule) break;
                    rule.ts = ev.ts; rule.author = ev.author;
                    state.access.rules[rule.ruleId] = rule;
                    break;
                case "access.mode":
                    if (!TR.enabled) break;
                    if (p.mode === "open" || p.mode === "restricted") state.access.mode = p.mode;
                    break;
                case "access.grant.set":
                    if (!TR.enabled) break;
                    var g = accessSanitizeGrant(p);
                    if (!g) break;
                    g.ts = ev.ts; g.author = ev.author;
                    if (!g.principals.length && !g.breakInheritance) delete state.access.grants[accessKey(g.path)];
                    else state.access.grants[accessKey(g.path)] = g;
                    break;
                case "access.grant.remove":
                    if (!TR.enabled) break;
                    var gk = accessKey(p.path);
                    if (gk && !badKey(gk)) delete state.access.grants[gk];
                    break;
                case "access.rule.remove":
                    if (!TR.enabled) break;
                    if (typeof p.ruleId === "string" && !badKey(p.ruleId)) delete state.access.rules[p.ruleId];
                    break;
                case "project.geo":
                    var geo = nmap(); safeAssign(geo, p); geo.ts = ev.ts; geo.author = ev.author;
                    state.project.geo = geo;
                    break;
                case "model.version":
                    if (p.renamedFrom && !badKey(String(p.renamedFrom)) && p.renamedFrom !== id && state.models[p.renamedFrom]) {
                        var moved = state.models[p.renamedFrom];
                        moved.path = id; moved.renamedFrom = p.renamedFrom; moved.renamedTs = ev.ts;
                        state.models[id] = moved;
                        delete state.models[p.renamedFrom];
                        if (state.disciplines[p.renamedFrom]) {
                            if (!state.disciplines[id]) state.disciplines[id] = state.disciplines[p.renamedFrom];
                            delete state.disciplines[p.renamedFrom];
                        }
                    }
                    var mv = state.models[id];
                    if (!mv) { mv = nmap(); mv.path = id; mv.versions = []; }
                    if (p.tag && !badKey(String(p.tag))) mv.tag = p.tag;
                    if (p.fingerprint && p.rekeyFrom && mv.current && mv.current === p.rekeyFrom && mv.current !== p.fingerprint) {
                        var lastV = mv.versions[mv.versions.length - 1];
                        if (lastV && lastV.fingerprint === p.rekeyFrom) { lastV.fingerprint = p.fingerprint; lastV.fpLegacy = p.rekeyFrom; }
                        mv.current = p.fingerprint;
                        mv.legacyCurrent = p.rekeyFrom;
                    } else if (p.fingerprint && mv.current !== p.fingerprint) {
                        mv.versions.push({ fingerprint: p.fingerprint, size: p.size || 0,
                            headerTimestamp: p.headerTimestamp || null, ts: ev.ts, author: ev.author });
                        mv.current = p.fingerprint;
                        mv.legacyCurrent = null;
                    }
                    state.models[id] = mv;
                    break;
                case "model.frag":
                    var fr = nmap(); safeAssign(fr, p); fr.by = ev.author; fr.ts = ev.ts;
                    state.frags[id] = fr;
                    break;
                case "federation.save":
                    var fd = nmap(); safeAssign(fd, p); fd.ts = ev.ts; fd.author = ev.author;
                    state.federations[id] = fd;
                    break;
                case "federation.remove":
                    delete state.federations[id];
                    break;
                case "report.save":
                    var rp = nmap(); safeAssign(rp, p); rp.ts = ev.ts; rp.author = ev.author;
                    state.reports[id] = rp;
                    break;
                case "bcf.topic.create":
                case "bcf.topic.update":
                    var tp = state.issues[id];
                    if (!tp) { tp = nmap(); tp.guid = id; tp.comments = 0; tp.createdBy = ev.author; tp.createdAt = ev.ts; }
                    safeAssign(tp, p); tp.ts = ev.ts; tp.author = ev.author;
                    state.issues[id] = tp;
                    break;
                case "model.discipline":
                    if ((typeof id !== "string" || !id || id.length > 1024) || badKey(id)) break;
                    var dcode = typeof p.code === "string" ? p.code.toUpperCase() : null;
                    if (dcode === null || (dcode && !/^[A-Z0-9]{1,12}$/.test(dcode))) break;
                    if (!dcode) { delete state.disciplines[id]; break; }
                    var dsc = nmap(); dsc.code = dcode; dsc.ts = ev.ts; dsc.author = ev.author;
                    state.disciplines[id] = dsc;
                    break;
                case "clash.decision":
                    if ((typeof id !== "string" || !id || id.length > 400) || badKey(id)) break;
                    var hasSt = typeof p.status === "string" && p.status.length > 0 && p.status.length <= 40;
                    var hasCm = typeof p.comment === "string" && p.comment.length <= 8000;
                    if (!hasSt && !hasCm) break;
                    var cd = state.clash.decisions[id];
                    if (!cd) { cd = nmap(); state.clash.decisions[id] = cd; }
                    if (hasSt) { cd.status = p.status; cd.statusTs = ev.ts; cd.statusBy = ev.author; }
                    if (hasCm) { cd.comment = p.comment; cd.commentTs = ev.ts; cd.commentBy = ev.author; }
                    if (typeof p.pairKey === "string") cd.pairKey = p.pairKey;
                    if (typeof p.num === "number" && isFinite(p.num)) cd.num = p.num;
                    if (typeof p.federationId === "string") cd.federationId = p.federationId;
                    cd.ts = ev.ts; cd.author = ev.author;
                    break;
                case "bcf.topic.comment":
                    var tc = state.issues[id];
                    if (!tc) { tc = nmap(); tc.guid = id; tc.comments = 0; }
                    tc.comments = (tc.comments || 0) + 1; tc.ts = ev.ts;
                    state.issues[id] = tc;
                    break;
                default:
                    break;
            }
        });
        return state;
    }

    function resolveAlias(aliases, id) {
        var cur = id == null ? "" : String(id);
        if (!cur || !aliases) return cur;
        var seen = {};
        for (var hops = 0; hops < 64; hops++) {
            if (seen[cur]) return cur;
            seen[cur] = true;
            var nx = Object.prototype.hasOwnProperty.call(aliases, cur) ? aliases[cur] : null;
            if (!nx || nx === cur) return cur;
            cur = String(nx);
        }
        return cur;
    }

    function resolvePerson(st, id) {
        return resolveAlias(st && st.aliases ? st.aliases : st, id);
    }

    var TRUST_PROTECTED = { "admin.grant": 1, "admin.revoke": 1, "device.approve": 1, "person.merge": 1, "person.unmerge": 1 };

    function jwkCore(jwk) {
        if (!jwk || typeof jwk !== "object") return null;
        if (jwk.kty !== "EC" || jwk.crv !== "P-256" || typeof jwk.x !== "string" || typeof jwk.y !== "string") return null;
        return JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
    }
    function jwkKid(jwk) {
        var core = jwkCore(jwk);
        if (!core || !subtle) return Promise.resolve(null);
        return sha256Hex(core);
    }
    function shortCode(kid) {
        var k = String(kid || "").slice(0, 8).toUpperCase();
        return k.length === 8 ? k.slice(0, 4) + "-" + k.slice(4) : "";
    }
    var _kidCache = null;
    function deviceKid() {
        if (_kidCache) return Promise.resolve(_kidCache);
        return ensureKeypair().then(function (kp) {
            if (!kp || !kp.publicKeyJwk) return null;
            return jwkKid(kp.publicKeyJwk).then(function (k) { _kidCache = k; return k; });
        }).catch(function () { return null; });
    }
    function devicePublicKey() {
        return ensureKeypair().then(function (kp) { return kp ? kp.publicKeyJwk : null; }).catch(function () { return null; });
    }

    function b64Bytes(s) {
        try {
            var bin = atob(String(s)), out = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
        } catch (e) { return null; }
    }
    var _importCache = nmap();
    function importPub(kid, jwk) {
        if (_importCache[kid]) return _importCache[kid];
        var core = jwkCore(jwk);
        if (!core || !subtle) return Promise.resolve(null);
        _importCache[kid] = subtle.importKey("jwk", JSON.parse(core), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])
            .catch(function () { return null; });
        return _importCache[kid];
    }
    function verifyWith(kid, jwk, text, sigB64) {
        var sig = b64Bytes(sigB64);
        if (!sig || !subtle) return Promise.resolve(false);
        return importPub(kid, jwk).then(function (key) {
            if (!key) return false;
            return subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, new TextEncoder().encode(text))
                .catch(function () { return false; });
        });
    }

    function stableJson(v) {
        if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
        if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
        return "{" + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) {
            return JSON.stringify(k) + ":" + stableJson(v[k]);
        }).join(",") + "}";
    }
    function signData(obj) {
        var text = stableJson(obj);
        return Promise.all([deviceKid(), devicePublicKey(), signCanonical(text)]).then(function (r) {
            if (!r[0] || !r[1] || !r[2]) return null;
            return { kid: r[0], pubkey: r[1], sig: r[2], alg: "ES256" };
        });
    }
    function verifyData(obj, signature) {
        if (!signature || !signature.kid || !signature.sig || !signature.pubkey) return Promise.resolve(false);
        return jwkKid(signature.pubkey).then(function (k) {
            if (!k || k !== signature.kid) return false;
            return verifyWith(k, signature.pubkey, stableJson(obj), signature.sig);
        });
    }

    var _sigMemo = nmap();

    function prepareTrust(logResult) {
        var events = (logResult && logResult.events) || [];
        var segments = (logResult && logResult.segments) || [];
        var ctx = { sigOk: nmap(), chainOk: nmap(), kidOf: nmap(), pubByKid: nmap(), subtle: !!subtle };
        if (!subtle) return Promise.resolve(ctx);
        var jwks = [];
        events.forEach(function (ev) {
            var p = ev.payload;
            if (p && p.pubkey && jwkCore(p.pubkey)) jwks.push(p.pubkey);
        });
        var goodHash = nmap();
        var chainWork = segments.map(function (seg) {
            var expected = GENESIS, broken = false, seq = Promise.resolve();
            seg.events.forEach(function (ev) {
                seq = seq.then(function () {
                    if (!ev || !ev.id) return;
                    if (ev.prevHash !== expected) broken = true;
                    return sha256Hex(canonicalEvent(ev)).then(function (h) {
                        if (!broken) goodHash[h] = true;
                        expected = h;
                    });
                });
            });
            return seq;
        });
        return Promise.all(jwks.map(function (j) {
            return jwkKid(j).then(function (k) { if (k) { ctx.kidOf[jwkCore(j)] = k; ctx.pubByKid[k] = j; } });
        })).then(function () { return Promise.all(chainWork); }).then(function () {
            return Promise.all(events.map(function (ev) {
                return sha256Hex(canonicalEvent(ev)).then(function (h) {
                    ctx.chainOk[ev.id] = !!goodHash[h];
                    if (!ev.sig || !ev.kid || !ctx.pubByKid[ev.kid]) { ctx.sigOk[ev.id] = false; return; }
                    var memo = h + "|" + ev.sig;
                    if (_sigMemo[memo] !== undefined) { ctx.sigOk[ev.id] = _sigMemo[memo]; return; }
                    return verifyWith(ev.kid, ctx.pubByKid[ev.kid], canonicalEvent(ev), ev.sig).then(function (ok) {
                        _sigMemo[memo] = ok; ctx.sigOk[ev.id] = ok;
                    });
                });
            }));
        }).then(function () { return ctx; });
    }

    var ACCESS_MARKER = ".liteaeco-access";

    function accessNormPath(p) {
        return String(p == null ? "" : p).replace(/\\/g, "/").split("/")
            .map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== "."; }).join("/");
    }
    function accessKey(p) { return accessNormPath(p).toLowerCase(); }
    function accessList(v) {
        if (!Array.isArray(v)) return [];
        var out = [];
        v.forEach(function (x) {
            var s = String(x == null ? "" : x).trim().slice(0, 120);
            if (s && out.indexOf(s) === -1 && out.length < 200) out.push(s);
        });
        return out;
    }
    function accessSanitizeRule(p) {
        if (!p || typeof p.ruleId !== "string" || !p.ruleId || p.ruleId.length > 64 || badKey(p.ruleId)) return null;
        var path = accessNormPath(p.path);
        if (!path || path.length > 512 || path.split("/")[0].charAt(0) === ".") return null;
        var a = p.allow || {};
        var r = nmap();
        r.ruleId = p.ruleId; r.path = path;
        r.allow = { companies: accessList(a.companies), roles: accessList(a.roles), teams: accessList(a.teams), members: accessList(a.members) };
        return r;
    }
    function accessNorm(v) { return String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, " "); }
    function accessSplitTeams(v) {
        if (Array.isArray(v)) return v.map(accessNorm).filter(Boolean);
        return String(v == null ? "" : v).split(/[,;|\n]/).map(accessNorm).filter(Boolean);
    }
    function accessMatch(rule, who, aliases) {
        if (!who || !who.approved) return false;
        var a = rule.allow || {};
        var c = accessNorm(who.company), r = accessNorm(who.role), teams = accessSplitTeams(who.teams);
        var me = who.memberId ? resolveAlias(aliases || null, who.memberId) : null;
        if (c && (a.companies || []).some(function (x) { return accessNorm(x) === c; })) return true;
        if (r && (a.roles || []).some(function (x) { return accessNorm(x) === r; })) return true;
        if (teams.length && (a.teams || []).some(function (x) { return teams.indexOf(accessNorm(x)) !== -1; })) return true;
        if (me && (a.members || []).some(function (x) { return resolveAlias(aliases || null, x) === me; })) return true;
        return false;
    }
    function accessRulesOn(rules, relPath) {
        var k = accessKey(relPath), out = [];
        Object.keys(rules || {}).forEach(function (id) {
            var rp = accessKey(rules[id].path);
            if (rp && (k === rp || k.indexOf(rp + "/") === 0)) out.push(rules[id]);
        });
        return out;
    }
    function accessDecide(snapshot, relPath, markerIds) {
        var s = snapshot || {};
        if (s.admin) return { visible: true, reason: "admin", ruleIds: [] };
        var rules = s.rules || {};
        var applied = accessRulesOn(rules, relPath);
        for (var i = 0; i < applied.length; i++) {
            if (!accessMatch(applied[i], s.who, s.aliases)) return { visible: false, reason: "rule", ruleIds: [applied[i].ruleId] };
        }
        var ids = markerIds || [];
        for (var j = 0; j < ids.length; j++) {
            var r = rules[ids[j]];
            if (!r) { if (!s.rulesComplete) return { visible: false, reason: "unknown-marker", ruleIds: [ids[j]] }; continue; }
            if (!accessMatch(r, s.who, s.aliases)) return { visible: false, reason: "marker", ruleIds: [ids[j]] };
        }
        return { visible: true, reason: applied.length || ids.length ? "allowed" : "open", ruleIds: [] };
    }

    function accessReadMarker(dirHandle) {
        if (!dirHandle || !dirHandle.getFileHandle) return Promise.resolve(null);
        return dirHandle.getFileHandle(ACCESS_MARKER, { create: false })
            .then(function (fh) { return fh.getFile(); })
            .then(function (f) { return f.text(); })
            .then(function (t) {
                try { var j = JSON.parse(t); return (j && typeof j.ruleId === "string" && !badKey(j.ruleId)) ? j.ruleId : "__unreadable__"; }
                catch (e) { return "__unreadable__"; }
            })
            .catch(function (e) { return (e && e.name === "NotFoundError") || (e && e.name === "TypeMismatchError") ? null : "__unreadable__"; });
    }
    function accessWriteMarker(root, relPath, ruleId, guid) {
        return getDir(root, splitRel(relPath), false).then(function (dir) {
            return dir.getFileHandle(ACCESS_MARKER, { create: true }).then(function (fh) {
                return fh.createWritable().then(function (w) {
                    return w.write(JSON.stringify({ format: "liteaeco-access", ruleId: ruleId, guid: guid || null }))
                        .then(function () { return w.close(); });
                });
            });
        });
    }
    function accessRemoveMarker(root, relPath) {
        return getDir(root, splitRel(relPath), false).then(function (dir) {
            return dir.removeEntry(ACCESS_MARKER);
        }).catch(function () { });
    }
    function accessChainMarkers(root, relPath, isFile) {
        var parts = splitRel(accessNormPath(relPath));
        if (isFile) parts = parts.slice(0, -1);
        var ids = [], dir = root, i = 0;
        function step() {
            if (i >= parts.length) return Promise.resolve(ids);
            return dir.getDirectoryHandle(parts[i], { create: false }).then(function (d) {
                dir = d; i++;
                return accessReadMarker(d).then(function (id) { if (id) ids.push(id); return step(); });
            }).catch(function () { return ids; });
        }
        return step();
    }

    var LEVEL = { none: 0, see: 1, upload: 2 };
    var PRINCIPAL_TYPES = { everyone: 1, company: 1, role: 1, team: 1, member: 1 };
    function accessSanitizeGrant(p) {
        if (!p) return null;
        var path = accessNormPath(p.path);
        var first = path ? path.split("/")[0] : "";
        if (!path || path.length > 512 || (first.charAt(0) === "." && first.toLowerCase() !== ".admin")) return null;
        var seen = {}, list = [];
        (Array.isArray(p.principals) ? p.principals : []).forEach(function (x) {
            if (!x || !PRINCIPAL_TYPES[x.type]) return;
            var value = x.type === "everyone" ? "" : String(x.value == null ? "" : x.value).trim().slice(0, 120);
            if (x.type !== "everyone" && !value) return;
            var level = x.level === "upload" ? "upload" : "see";
            var k = x.type + "|" + value.toLowerCase();
            if (seen[k] !== undefined) { if (level === "upload") list[seen[k]].level = "upload"; return; }
            if (list.length >= 200) return;
            seen[k] = list.length;
            list.push({ type: x.type, value: value, level: level });
        });
        var g = nmap();
        g.path = path; g.principals = list; g.breakInheritance = !!p.breakInheritance;
        return g;
    }
    function principalMatches(pr, who, aliases) {
        if (!who || !who.approved) return false;
        if (pr.type === "everyone") return true;
        var v = accessNorm(pr.value);
        if (pr.type === "company") return !!v && accessNorm(who.company) === v;
        if (pr.type === "role") return !!v && accessNorm(who.role) === v;
        if (pr.type === "team") return !!v && accessSplitTeams(who.teams).indexOf(v) !== -1;
        if (pr.type === "member") return !!who.memberId && resolveAlias(aliases || null, pr.value) === resolveAlias(aliases || null, who.memberId);
        return false;
    }
    function grantLevelFor(g, who, aliases) {
        var lv = 0;
        (g.principals || []).forEach(function (pr) {
            if (principalMatches(pr, who, aliases)) lv = Math.max(lv, LEVEL[pr.level] || 1);
        });
        return lv;
    }
    function folderLevel(grants, dirParts, who, aliases) {
        var lv = 0;
        for (var i = 1; i <= dirParts.length; i++) {
            var g = grants[dirParts.slice(0, i).join("/").toLowerCase()];
            if (!g) continue;
            if (g.breakInheritance) lv = 0;
            lv = Math.max(lv, grantLevelFor(g, who, aliases));
        }
        return lv;
    }
    function accessLevel(snapshot, relPath, isFile, markerIds) {
        var s = snapshot || {};
        var norm = accessNormPath(relPath);
        var key = norm.toLowerCase();
        var parts = norm ? norm.split("/") : [];
        if (!s.admin && s.adminFolder) {
            var ak = accessKey(s.adminFolder);
            var under = function (k) { return !!k && (key === k || key.indexOf(k + "/") === 0); };
            if (under(ak)) {
                if (isFile && s.rosterFile && key === accessKey(s.rosterFile)) return { see: true, upload: false, pathOnly: false, reason: "roster" };
                var inIssues = (s.issueFolders || []).some(function (f) { return under(accessKey(f)); });
                if (inIssues) return { see: true, upload: true, pathOnly: false, reason: "issues" };
                var inApp = (s.appFolders || []).some(function (f) { return under(accessKey(f)); });
                if (inApp) {
                    var dirParts = isFile ? parts.slice(0, -1) : parts.slice();
                    var lv = s.who ? folderLevel(s.grants || {}, dirParts, s.who, s.aliases || null) : 0;
                    return { see: true, upload: lv >= LEVEL.upload, pathOnly: false, reason: lv >= LEVEL.upload ? "app-grant" : "app-read" };
                }
                return { see: false, upload: false, pathOnly: false, reason: "admin-folder" };
            }
        }
        var sys = (s.systemFiles || ["admin/members.xlsx"]).map(function (x) { return accessKey(x); });
        if (isFile && sys.indexOf(key) !== -1 && !s.admin) return { see: false, upload: false, pathOnly: false, reason: "system" };
        if (s.admin) return { see: true, upload: true, pathOnly: false, reason: "admin" };
        if (s.mode !== "restricted") {
            var d = accessDecide(s, relPath, markerIds);
            return { see: d.visible, upload: d.visible, pathOnly: false, reason: d.reason };
        }
        var dirParts = isFile ? parts.slice(0, -1) : parts;
        if (!dirParts.length) return { see: true, upload: false, pathOnly: false, reason: "root" };
        var grants = s.grants || {};
        var lv = folderLevel(grants, dirParts, s.who, s.aliases);
        if (lv >= 1) return { see: true, upload: lv >= 2, pathOnly: false, reason: "grant" };
        if (!isFile) {
            var prefix = key + "/";
            var below = Object.keys(grants).some(function (gk) {
                return gk.indexOf(prefix) === 0 && folderLevel(grants, grants[gk].path.split("/"), s.who, s.aliases) >= 1;
            });
            if (below) return { see: false, upload: false, pathOnly: true, reason: "path" };
        }
        return { see: false, upload: false, pathOnly: false, reason: "no-grant" };
    }

    function accessLevelForMe(root, guid, relPath) {
        return Promise.all([accessGetSnapshot(guid).catch(function () { return null; }), accessChainMarkers(root, relPath, true)])
            .then(function (r) {
                if (r[0]) return accessLevel(r[0], relPath, true, r[1]);
                return getTrustPin(guid).catch(function () { return null; }).then(function (pin) {
                    return loadState(root, { pinnedRoot: pin }).then(function (st) {
                        if (st.access && st.access.mode === "restricted") return { see: false, upload: false, pathOnly: false, reason: "no-snapshot" };
                        var d = accessDecide({ admin: false, who: null, rules: {}, rulesComplete: false }, relPath, r[1]);
                        return { see: d.visible, upload: d.visible, pathOnly: false, reason: d.reason };
                    });
                });
            })
            .catch(function () { return { see: true, upload: true, pathOnly: false, reason: "error" }; });
    }

    function accessSnapKey(guid) { return "accesssnap:" + guid; }
    function accessGetSnapshot(guid) { return kvGet("kv", accessSnapKey(guid)); }
    function accessSetSnapshot(guid, snap) { return kv("kv", "readwrite", function (s) { s.put(snap, accessSnapKey(guid)); return snap; }); }

    function accessIsHiddenForMe(root, guid, relPath) {
        return accessLevelForMe(root, guid, relPath).then(function (l) { return !l.see; });
    }
    function accessIsHiddenForMeV12(root, guid, relPath) {
        return Promise.all([accessGetSnapshot(guid).catch(function () { return null; }), accessChainMarkers(root, relPath, true)])
            .then(function (r) {
                var snap = r[0] || { admin: false, who: null, rules: {}, rulesComplete: false };
                return !accessDecide(snap, relPath, r[1]).visible;
            })
            .catch(function () { return false; });
    }

    function pinKey(guid) { return "trustroot:" + guid; }
    function getTrustPin(guid) { return kvGet("kv", pinKey(guid)); }
    function setTrustPin(guid, kid) { return kv("kv", "readwrite", function (s) { if (kid) s.put(kid, pinKey(guid)); else s.delete(pinKey(guid)); return kid; }); }

    function loadState(root, opts) {
        opts = opts || {};
        return readLog(root).then(function (r) {
            return prepareTrust(r).then(function (ctx) { return { r: r, ctx: ctx }; });
        }).then(function (x) {
            var r = x.r;
            x.ctx.pinnedRoot = opts.pinnedRoot || null;
            var state = replay(r.events, x.ctx);
            state._warnings = r.warnings;
            state._eventCount = r.events.length;
            return state;
        });
    }

    function linkFolder(meta, opts) {
        if (!W.showDirectoryPicker) return Promise.reject(new Error("File System Access API unavailable"));
        return W.showDirectoryPicker({ mode: "readwrite" }).then(function (root) {
            return readTextFile(root, ORG_MANIFEST).then(function (orgTxt) {
                if (typeof orgTxt === "string") { var oe = new Error("This folder is an organization folder, not a project."); oe.code = "IS_ORG"; throw oe; }
                return bootstrap(root, meta, opts);
            }).then(function (manifest) {
                return kv("links", "readwrite", function (s) {
                    var req = s.get(manifest.guid);
                    req.onsuccess = function () {
                        var prev = req.result || {};
                        s.put({
                            guid: manifest.guid, handle: root, name: root.name,
                            linkedAt: new Date().toISOString(),
                            localPath: prev.localPath || null
                        });
                    };
                    return null;
                }).then(function () {
                    if (W.liteAECO.projects && manifest.guid) {
                        W.liteAECO.projects.save({
                            guid: manifest.guid, number: manifest.number, title: manifest.title,
                            client: manifest.client, address: manifest.address, type: manifest.type
                        }, "cde").catch(function () { });
                    }
                    var fresh = !manifest.__adopted;
                    delete manifest.__adopted;
                    return { guid: manifest.guid, handle: root, manifest: manifest, fresh: fresh };
                });
            });
        });
    }

    function openProject(guid) {
        return kvGet("links", guid).then(function (rec) {
            if (!rec || !rec.handle) return null;
            return rec.handle.queryPermission({ mode: "readwrite" }).then(function (perm) {
                return { guid: guid, handle: rec.handle, permission: perm, name: rec.name, localPath: rec.localPath || null };
            }).catch(function () {
                return { guid: guid, handle: rec.handle, permission: "prompt", name: rec.name, localPath: rec.localPath || null };
            });
        });
    }

    function setLocalPath(guid, path) {
        return kvGet("links", guid).then(function (rec) {
            if (!rec) return null;
            rec.localPath = String(path || "").trim() || null;
            return kv("links", "readwrite", function (s) { s.put(rec); return rec.localPath; });
        });
    }

    function requestAccess(guid) {
        return kvGet("links", guid).then(function (rec) {
            if (!rec || !rec.handle) return null;
            return rec.handle.requestPermission({ mode: "readwrite" }).then(function (perm) {
                return { guid: guid, handle: rec.handle, permission: perm, name: rec.name, localPath: rec.localPath || null };
            });
        });
    }

    function listLinked() {
        return openDB().then(function (db) {
            if (!db) return [];
            return new Promise(function (resolve) {
                var r = db.transaction("links", "readonly").objectStore("links").getAll();
                r.onsuccess = function () {
                    resolve((r.result || []).filter(function (x) { return x.kind !== "org"; }).map(function (x) {
                        return { guid: x.guid, name: x.name, linkedAt: x.linkedAt, localPath: x.localPath || null };
                    }));
                };
                r.onerror = function () { resolve([]); };
            });
        });
    }

    function unlink(guid) {
        return kv("links", "readwrite", function (s) { s.delete(guid); return null; });
    }

    var ORG_MANIFEST = "org.json";
    var PROJECT_LIST_NAME = "liteaeco-projects.json";
    var LIST_FIELDS = ["guid", "number", "title", "client", "address", "type", "startDate", "folderName", "sharedPath"];
    var GUID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;

    function readJson(root, rel) {
        return readTextFile(root, rel).then(function (txt) {
            if (txt === null) return null;
            if (txt && txt.__readError) return txt;
            try { return JSON.parse(txt); } catch (e) { return { __readError: true, error: e, malformed: true }; }
        });
    }

    function readOrgManifest(root) {
        return readJson(root, ORG_MANIFEST).then(function (m) {
            if (!m || m.__readError) return m;
            if (m.format !== "liteaeco-org" || typeof m.guid !== "string" || !GUID_RE.test(m.guid))
                return { __readError: true, malformed: true };
            return m;
        });
    }

    function clip(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n || 200); }

    function sanitizeListEntry(p) {
        if (!p || typeof p !== "object" || typeof p.guid !== "string" || !GUID_RE.test(p.guid)) return null;
        var out = {};
        LIST_FIELDS.forEach(function (k) { out[k] = clip(p[k], (k === "address" || k === "sharedPath") ? 500 : 200); });
        if (out.startDate && !/^\d{4}-\d{2}-\d{2}/.test(out.startDate)) out.startDate = "";
        return out;
    }

    function readProjectList(root) {
        return readJson(root, PROJECT_LIST_NAME).then(function (d) {
            if (d === null) return { ok: true, missing: true, projects: [] };
            if (d.__readError) return { ok: false, malformed: !!d.malformed, projects: [] };
            if (d.format !== "liteaeco-project-list" || !Array.isArray(d.projects)) return { ok: false, malformed: true, projects: [] };
            var seen = {}, list = [];
            d.projects.forEach(function (p) {
                var e = sanitizeListEntry(p);
                if (e && !seen[e.guid]) { seen[e.guid] = true; list.push(e); }
            });
            var sig = d.signature && typeof d.signature === "object" ? { kid: String(d.signature.kid || ""), sig: String(d.signature.sig || ""), pubkey: d.signature.pubkey || null } : null;
            return { ok: true, projects: list, updatedAt: clip(d.updatedAt, 40), updatedBy: clip(d.updatedBy, 120), org: d.org || null,
                signature: sig, _core: listCore(d) };
        });
    }

    function listCore(doc) {
        return { format: doc.format, version: doc.version, org: doc.org, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy, projects: doc.projects };
    }
    function verifyProjectList(res) {
        if (!res || !res.ok || !res.signature || !res._core) return Promise.resolve(false);
        return verifyData(res._core, res.signature);
    }
    function writeProjectList(root, orgManifest, projects, updatedBy, opts) {
        var seen = {}, list = [];
        (projects || []).forEach(function (p) {
            var e = sanitizeListEntry(p);
            if (e && !seen[e.guid]) { seen[e.guid] = true; list.push(e); }
        });
        var doc = {
            format: "liteaeco-project-list", version: 2,
            org: { guid: orgManifest.guid, name: clip(orgManifest.name) },
            updatedAt: new Date().toISOString(), updatedBy: clip(updatedBy, 120),
            projects: list
        };
        var signing = (opts && opts.sign) ? signData(listCore(doc)) : Promise.resolve(null);
        return signing.then(function (sig) {
            if (sig) doc.signature = sig;
            return writeTextFile(root, PROJECT_LIST_NAME, JSON.stringify(doc, null, 2));
        }).then(function () { return doc; });
    }

    function storeOrg(root, manifest) {
        return kvGet("kv", "org").then(function (prev) {
            return kv("links", "readwrite", function (s) {
                if (prev && prev.guid && prev.guid !== manifest.guid) s.delete(prev.guid);
                s.put({ guid: manifest.guid, handle: root, name: root.name, kind: "org", linkedAt: new Date().toISOString(), localPath: null });
                return null;
            });
        }).then(function () {
            return kv("kv", "readwrite", function (s) {
                s.put({ guid: manifest.guid, handle: root, name: manifest.name || root.name, linkedAt: new Date().toISOString() }, "org");
                return null;
            });
        });
    }

    function linkOrg(opts) {
        if (!W.showDirectoryPicker) return Promise.reject(new Error("File System Access API unavailable"));
        return W.showDirectoryPicker({ mode: "readwrite" }).then(function (root) {
            return readOrgManifest(root).then(function (existing) {
                if (existing && existing.__readError) {
                    var re = new Error("org.json unreadable, refusing to link"); re.code = "ORG_UNREADABLE"; throw re;
                }
                if (existing) return storeOrg(root, existing).then(function () { return { guid: existing.guid, handle: root, manifest: existing, fresh: false }; });
                return readManifest(root).then(function (pm) {
                    if (pm) { var pe = new Error("This folder is a project, not an organization."); pe.code = "IS_PROJECT"; throw pe; }
                    var gate = (opts && opts.onNewOrg) ? Promise.resolve(opts.onNewOrg(root)) : Promise.resolve(true);
                    return gate.then(function (go) {
                        if (!go) { var ce = new Error("cancelled"); ce.cancelled = true; throw ce; }
                        var m = {
                            format: "liteaeco-org", version: 1,
                            guid: uuidV4(),
                            name: clip(root.name), createdAt: new Date().toISOString()
                        };
                        return Promise.all([getDir(root, LOG_DIR, true), getDir(root, ["admin"], true)])
                            .then(function () { return writeTextFile(root, ORG_MANIFEST, JSON.stringify(m, null, 2)); })
                            .then(function () { return writeProjectList(root, m, [], ""); })
                            .then(function () { return storeOrg(root, m); })
                            .then(function () { return { guid: m.guid, handle: root, manifest: m, fresh: true }; });
                    });
                });
            });
        });
    }

    function getOrg() {
        return kvGet("kv", "org").then(function (rec) {
            if (!rec || !rec.handle) return null;
            return rec.handle.queryPermission({ mode: "readwrite" })
                .catch(function () { return "prompt"; })
                .then(function (perm) { return { guid: rec.guid, handle: rec.handle, name: rec.name, permission: perm }; });
        });
    }

    function requestOrgAccess() {
        return kvGet("kv", "org").then(function (rec) {
            if (!rec || !rec.handle) return null;
            return rec.handle.requestPermission({ mode: "readwrite" }).then(function (perm) {
                return { guid: rec.guid, handle: rec.handle, name: rec.name, permission: perm };
            });
        });
    }

    function unlinkOrg() {
        return kvGet("kv", "org").then(function (rec) {
            return kv("links", "readwrite", function (s) { if (rec && rec.guid) s.delete(rec.guid); return null; })
                .then(function () { return kv("kv", "readwrite", function (s) { s.delete("org"); return null; }); });
        });
    }

    function scanFolder(root, rel, depth, opts) {
        depth = depth === undefined ? 1 : depth;
        var dirFilter = opts && typeof opts.dirFilter === "function" ? opts.dirFilter : null;
        var out = [];
        function walk(dir, prefix, d) {
            var entries = [];
            return (function collect(iter) {
                return iter.next().then(function (r) {
                    if (r.done) return entries;
                    entries.push(r.value);
                    return collect(iter);
                });
            })(dir.values()).then(function (list) {
                var seq = Promise.resolve();
                list.forEach(function (entry) {
                    if (entry.name.charAt(0) === ".") return;
                    if (entry.kind === "file") {
                        seq = seq.then(function () {
                            return entry.getFile().then(function (f) {
                                out.push({
                                    path: prefix + entry.name, name: entry.name,
                                    size: f.size, lastModified: f.lastModified
                                });
                            }).catch(function () {  });
                        });
                    } else if (entry.kind === "directory" && d > 0) {
                        seq = seq.then(function () {
                            var sub = prefix + entry.name;
                            var gate = dirFilter ? Promise.resolve(dirFilter(sub, entry)).catch(function () { return false; }) : Promise.resolve(true);
                            return gate.then(function (ok) { if (ok) return walk(entry, sub + "/", d - 1); });
                        });
                    }
                });
                return seq;
            });
        }
        var parts = splitRel(rel);
        return getDir(root, parts, false)
            .then(function (dir) {
                if (!dirFilter || !parts.length) return walk(dir, parts.length ? parts.join("/") + "/" : "", depth);
                return Promise.resolve(dirFilter(parts.join("/"), dir)).catch(function () { return false; })
                    .then(function (ok) { if (ok) return walk(dir, parts.join("/") + "/", depth); });
            })
            .then(function () { return out; })
            .catch(function () { return out; });
    }

    var INDEX_REL = CACHE_DIR.join("/") + "/index.json";
    function readIndex(root) {
        return readTextFile(root, INDEX_REL).then(function (txt) {
            if (!txt || txt.__readError) return null;
            try { return JSON.parse(txt); } catch (e) { return null; }
        });
    }
    function writeIndex(root, entries) {
        var doc = { scannedAt: new Date().toISOString(), entries: entries };
        return writeTextFile(root, INDEX_REL, JSON.stringify(doc)).then(function () { return doc; });
    }

    var LTF_SIGNATURE = "federation";
    var LTF_VERSION = 1;
    function newLtf(meta) {
        meta = meta || {};
        var now = new Date().toISOString();
        return {
            liteaeco: LTF_SIGNATURE,
            ltfVersion: LTF_VERSION,
            id: meta.id || ulid(),
            name: meta.name || "",
            project: meta.project || "",
            models: Array.isArray(meta.models) ? meta.models : [],
            settings: meta.settings || { excludedCategories: [] },
            clash: meta.clash || { tolerance: 10, pairs: [], excludedClasses: [], skipClassPairs: false },
            createdBy: meta.createdBy || "", createdAt: now,
            updatedBy: meta.createdBy || "", updatedAt: now
        };
    }
    function validateLtf(obj) {
        var errors = [];
        if (!obj || typeof obj !== "object") return { ok: false, errors: ["not an object"] };
        if (obj.liteaeco !== LTF_SIGNATURE) errors.push("missing liteaeco:\"federation\" header");
        if (typeof obj.ltfVersion !== "number") errors.push("ltfVersion missing");
        else if (obj.ltfVersion > LTF_VERSION) errors.push("ltfVersion " + obj.ltfVersion + " newer than supported " + LTF_VERSION);
        if (typeof obj.id !== "string" || !obj.id) errors.push("id missing");
        if (typeof obj.name !== "string") errors.push("name missing");
        if (typeof obj.project !== "string" || !obj.project) errors.push("project guid missing");
        var tags = nmap();
        if (!Array.isArray(obj.models) || !obj.models.length) errors.push("models must be a non-empty array");
        else obj.models.forEach(function (m, i) {
            if (!m || typeof m !== "object") { errors.push("models[" + i + "] not an object"); return; }
            if (typeof m.tag !== "string" || !m.tag) errors.push("models[" + i + "].tag missing");
            else tags[m.tag] = true;
            if (typeof m.path !== "string" || !m.path) errors.push("models[" + i + "].path missing");
            if (m.role !== undefined && m.role !== "reference" && m.role !== "working") errors.push("models[" + i + "].role invalid");
        });
        if (obj.clash !== undefined) {
            var c = obj.clash;
            if (!c || typeof c !== "object") errors.push("clash not an object");
            else {
                if (c.tolerance !== undefined && !(typeof c.tolerance === "number" && c.tolerance > 0)) errors.push("clash.tolerance must be > 0");
                if (c.pairs !== undefined) {
                    if (!Array.isArray(c.pairs)) errors.push("clash.pairs not an array");
                    else c.pairs.forEach(function (pr, i) {
                        if (!pr || typeof pr.a !== "string" || typeof pr.b !== "string") { errors.push("clash.pairs[" + i + "] needs a/b tags"); return; }
                        if (!tags[pr.a]) errors.push("clash.pairs[" + i + "].a unknown tag " + pr.a);
                        if (!tags[pr.b]) errors.push("clash.pairs[" + i + "].b unknown tag " + pr.b);
                        if (pr.a === pr.b) errors.push("clash.pairs[" + i + "] a == b");
                        if (pr.tolerance !== undefined && !(typeof pr.tolerance === "number" && pr.tolerance > 0)) errors.push("clash.pairs[" + i + "].tolerance must be > 0");
                    });
                }
                if (c.excludedClasses !== undefined && !Array.isArray(c.excludedClasses)) errors.push("clash.excludedClasses not an array");
                if (c.skipClassPairs !== undefined && typeof c.skipClassPairs !== "boolean") errors.push("clash.skipClassPairs not boolean");
            }
        }
        return { ok: errors.length === 0, errors: errors };
    }
    function readLtf(root, rel) {
        return readTextFile(root, rel).then(function (txt) {
            if (txt === null) return { ok: false, absent: true, errors: ["absent"] };
            if (txt && txt.__readError) return { ok: false, readError: true, errors: ["read error"] };
            var obj;
            try { obj = JSON.parse(txt); } catch (e) { return { ok: false, errors: ["invalid JSON"] }; }
            var v = validateLtf(obj);
            return { ok: v.ok, ltf: obj, errors: v.errors };
        });
    }
    function writeLtf(root, rel, ltf, by) {
        var v = validateLtf(ltf);
        if (!v.ok) return Promise.reject(new Error("invalid .ltf: " + v.errors.join("; ")));
        ltf.updatedAt = new Date().toISOString();
        if (by) ltf.updatedBy = by;
        return writeTextFile(root, rel, JSON.stringify(ltf, null, 2)).then(function () { return ltf; });
    }

    var CACHE_MODELS_REL = CACHE_MODELS_DIR.join("/");
    function fragRel(fp, ext) { return CACHE_MODELS_REL + "/" + fp + "." + ext; }
    function readSidecar(root, fp) {
        return readTextFile(root, fragRel(fp, "json")).then(function (txt) {
            if (!txt || txt.__readError) return null;
            try { return JSON.parse(txt); } catch (e) { return null; }
        });
    }
    function writeSidecar(root, fp, sc) {
        sc.fingerprint = fp;
        sc.createdAt = sc.createdAt || new Date().toISOString();
        return writeTextFile(root, fragRel(fp, "json"), JSON.stringify(sc, null, 2)).then(function () { return sc; });
    }
    function fragExists(root, fp) {
        return readSidecar(root, fp).then(function (sc) {
            if (!sc) return null;
            return getFileByRel(root, fragRel(fp, "frag"), false)
                .then(function (fh) { return fh.getFile(); })
                .then(function (f) { sc.__fragSize = f.size; return sc; })
                .catch(function () { return null; });
        });
    }
    function listSidecars(root) {
        return getDir(root, CACHE_MODELS_DIR, false).then(function (dir) {
            var names = [];
            return (function collect(iter) {
                return iter.next().then(function (r) {
                    if (r.done) return names;
                    if (r.value.kind === "file" && /\.json$/.test(r.value.name)) names.push(r.value.name.slice(0, -5));
                    return collect(iter);
                });
            })(dir.values());
        }).then(function (fps) {
            return Promise.all(fps.map(function (fp) { return readSidecar(root, fp); }));
        }).then(function (list) {
            return list.filter(function (sc) { return sc && sc.fingerprint; });
        }).catch(function () { return []; });
    }
    function retainFrags(root, keepPerModel) {
        var keep = keepPerModel === undefined ? 2 : keepPerModel;
        return getDir(root, CACHE_MODELS_DIR, false).then(function (dir) {
            var files = [];
            return (function collect(iter) {
                return iter.next().then(function (r) {
                    if (r.done) return files;
                    if (r.value.kind === "file") files.push(r.value.name);
                    return collect(iter);
                });
            })(dir.values()).then(function (names) {
                var jsons = nmap(), frags = nmap();
                names.forEach(function (n) {
                    if (/\.json$/.test(n)) jsons[n.slice(0, -5)] = true;
                    else if (/\.frag$/.test(n)) frags[n.slice(0, -5)] = true;
                });
                return listSidecars(root).then(function (scs) {
                    var byModel = nmap();
                    scs.forEach(function (sc) {
                        var k = sc.sourcePath || "?";
                        (byModel[k] = byModel[k] || []).push(sc);
                    });
                    var doomed = [];
                    Object.keys(byModel).forEach(function (k) {
                        var arr = byModel[k].sort(function (a, b) { return (b.createdAt || "") < (a.createdAt || "") ? -1 : 1; });
                        arr.slice(keep).forEach(function (sc) { doomed.push(sc.fingerprint); });
                    });
                    Object.keys(frags).forEach(function (fp) { if (!jsons[fp]) doomed.push(fp); });
                    var seq = Promise.resolve();
                    var deleted = [];
                    doomed.forEach(function (fp) {
                        seq = seq.then(function () {
                            return Promise.all([
                                dir.removeEntry(fp + ".frag").catch(function () { }),
                                dir.removeEntry(fp + ".json").catch(function () { })
                            ]).then(function () { deleted.push(fp); });
                        });
                    });
                    return seq.then(function () { return { deleted: deleted }; });
                });
            });
        }).catch(function () { return { deleted: [] }; });
    }

    W.liteAECO.cde = {
        CDE_BUILD: CDE_BUILD,
        ulid: ulid,
        linkFolder: linkFolder,
        openProject: openProject,
        setLocalPath: setLocalPath,
        requestAccess: requestAccess,
        listLinked: listLinked,
        unlink: unlink,
        newPersonId: newPersonId,
        resolvePerson: resolvePerson,
        access: {
            MARKER: ACCESS_MARKER, normPath: accessNormPath, key: accessKey, match: accessMatch,
            rulesOn: accessRulesOn, decide: accessDecide, readMarker: accessReadMarker,
            writeMarker: accessWriteMarker, removeMarker: accessRemoveMarker, chainMarkers: accessChainMarkers,
            getSnapshot: accessGetSnapshot, setSnapshot: accessSetSnapshot, isHiddenForMe: accessIsHiddenForMe,
            level: accessLevel, levelForMe: accessLevelForMe, folderLevel: folderLevel, grantLevelFor: grantLevelFor,
            principalMatches: principalMatches, sanitizeGrant: accessSanitizeGrant
        },
        trust: {
            kid: deviceKid, publicKey: devicePublicKey, shortCode: shortCode, jwkKid: jwkKid,
            signData: signData, verifyData: verifyData, stableJson: stableJson,
            prepare: prepareTrust, getPin: getTrustPin, setPin: setTrustPin
        },
        uuid: uuidV4,
        org: {
            link: linkOrg, get: getOrg, requestAccess: requestOrgAccess, unlink: unlinkOrg,
            readManifest: readOrgManifest, readProjectList: readProjectList, writeProjectList: writeProjectList, verifyProjectList: verifyProjectList,
            MANIFEST: ORG_MANIFEST, LIST: PROJECT_LIST_NAME
        },
        bootstrap: bootstrap,
        readManifest: readManifest,
        writeManifest: writeManifest,
        paths: { rewrite: pathsRewrite, structureDirs: structureDirList, issuesFolder: issuesFolder,
            folder: folderOf, appFolder: appFolderOf, modelFolders: modelFoldersOf,
            rosterFile: rosterFileOf, issueFolders: issueFoldersOf },
        session: session,
        readLog: readLog,
        clearLogCache: clearLogCache,
        replay: replay,
        loadState: loadState,
        scanFolder: scanFolder,
        hashFile: hashFile,
        files: {
            contentHash: contentHash, contentHashAt: contentHashAt, write: fileWrite, archive: fileArchive,
            archiveDir: archiveDir, archiveFreeName: archiveFreeName, writeSafe: fileWriteSafe,
            logEntries: fileLogEntries, canUpload: canUpload,
            HASH_FULL_MAX: FILE_HASH_FULL_MAX, FP_SLICE: FILE_FP_SLICE, LOG_CHUNK: FILE_LOG_CHUNK, ARCHIVE_ROOT: ARCHIVE_ROOT
        },
        loadStateTrusted: loadStateTrusted,
        isAdmin: isAdmin,
        people: { read: readPeopleCache, write: writePeopleCache },
        stamps: { read: stampsRead, save: stampsSave, verify: stampsVerify, seeds: stampSeeds },
        ensureStructure: ensureStructure,
        fingerprintIfc: fingerprintIfc,
        FP_ALGO: FP_ALGO,
        ltf: { new: newLtf, validate: validateLtf, read: readLtf, write: writeLtf, SIGNATURE: LTF_SIGNATURE, VERSION: LTF_VERSION },
        frags: { listSidecars: listSidecars, readSidecar: readSidecar, writeSidecar: writeSidecar, exists: fragExists, retain: retainFrags, rel: fragRel },
        readIndex: readIndex,
        writeIndex: writeIndex,
        identity: {
            device: deviceId,
            ensureKeypair: ensureKeypair,
            getMember: getMember,
            setMember: setMember,
            whoAmI: whoAmI
        },
        _internals: {
            badKey: badKey,
            ulid: ulid,
            sha256Hex: sha256Hex,
            canonicalEvent: canonicalEvent,
            defaultManifest: defaultManifest,
            replay: replay,
            splitRel: splitRel,
            parseIfcHeader: parseIfcHeader,
            GENESIS: GENESIS,
            sanitizeListEntry: sanitizeListEntry
        }
    };
})();
