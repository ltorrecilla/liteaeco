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
// liteAECO - (liteaeco-bcf.js)
// ========





































(function (W) {
    "use strict";
    W.liteAECO = W.liteAECO || {};

    var BCF_BUILD = 5;   
    var EXTRAS = "liteaeco.json";

    
    var STATUSES = ["Active", "In Progress", "In Review", "Done", "Closed"];
    var TYPES = ["Conflict", "Coordination", "Comment", "Design", "Defect", "Request", "Requirement", "Decision", "Task"];
    var PRIORITIES = ["Low", "Normal", "Major", "Critical"];
    var STAGES = ["Design", "Tender", "Construction", "Handover", "Operation"];
    var CLOSED = ["Done", "Closed"];

    
    var TOPIC_ORDER = {
        2: ["ReferenceLink", "Title", "Priority", "Index", "Labels", "CreationDate", "CreationAuthor", "ModifiedDate", "ModifiedAuthor",
            "DueDate", "AssignedTo", "Stage", "Description", "BimSnippet", "DocumentReference", "RelatedTopic"],
        3: ["ReferenceLinks", "Title", "Priority", "Index", "Labels", "CreationDate", "CreationAuthor", "ModifiedDate", "ModifiedAuthor",
            "DueDate", "AssignedTo", "Stage", "Description", "BimSnippet", "DocumentReferences", "RelatedTopics", "Comments", "Viewpoints"]
    };
    var MARKUP_ORDER_2 = ["Header", "Topic", "Comment", "Viewpoints"];
    var COMMENT_ORDER = ["Date", "Author", "Comment", "Viewpoint", "ModifiedDate", "ModifiedAuthor"];
    var TEXT_FIELDS = { title: "Title", priority: "Priority", stage: "Stage", assignedTo: "AssignedTo", description: "Description", dueDate: "DueDate" };
    var ATTR_FIELDS = { status: "TopicStatus", type: "TopicType" };
    var FIELDS = ["title", "status", "type", "priority", "stage", "assignedTo", "dueDate", "description", "labels"];
    
    
    function intOrNull(v) { var n = parseInt(v, 10); return isFinite(n) && n > 0 && String(n) === String(v).trim() ? n : null; }

    
    function zip() {
        var f = W.fflate;
        if (!f || typeof f.unzipSync !== "function") throw new Error("fflate missing (js/vendor/index-0.8.3.js)");
        return f;
    }
    var enc = new TextEncoder(), dec = new TextDecoder();
    function u8(x) {
        if (x instanceof Uint8Array) return x;
        if (x && x.buffer instanceof ArrayBuffer) return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength);
        return new Uint8Array(x);
    }
    function uuid() {
        var c = W.crypto;
        if (c && typeof c.randomUUID === "function") return c.randomUUID();
        var b = new Uint8Array(16);
        if (c && c.getRandomValues) c.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
        b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
        var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    }
    function iso(v) {
        if (v == null || v === "") return "";
        var d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? "" : d.toISOString();
    }
    function kids(el, name) {
        var out = [];
        for (var n = el ? el.firstChild : null; n; n = n.nextSibling) if (n.nodeType === 1 && (!name || n.localName === name || n.nodeName === name)) out.push(n);
        return out;
    }
    function kid(el, name) { return kids(el, name)[0] || null; }
    function text(el, name) { var k = kid(el, name); return k ? k.textContent : ""; }
    function mk(doc, parentEl, name) {
        var ns = parentEl && parentEl.namespaceURI;
        return ns ? doc.createElementNS(ns, name) : doc.createElement(name);
    }
    function nameOf(n) { return n.localName || n.nodeName; }
    
    function place(parent, el, order) {
        var idx = order.indexOf(nameOf(el));
        var ref = null;
        for (var n = parent.firstChild; n; n = n.nextSibling) {
            if (n.nodeType !== 1) continue;
            var j = order.indexOf(nameOf(n));
            if (j > idx) { ref = n; break; }
        }
        parent.insertBefore(el, ref);
        return el;
    }
    function setText(doc, parent, name, value, order) {
        var el = kid(parent, name);
        if (value == null || value === "") { if (el) parent.removeChild(el); return; }
        if (!el) el = place(parent, mk(doc, parent, name), order);
        el.textContent = String(value);
    }

    
    function versionOf(files) {
        var v = files["bcf.version"];
        if (!v) return "2.1";
        var m = /VersionId\s*=\s*"([^"]+)"/.exec(dec.decode(v));
        return m ? m[1] : "2.1";
    }
    function read(bytes) {
        var files = zip().unzipSync(u8(bytes));
        var version = versionOf(files);
        return { version: version, major: /^3/.test(version) ? 3 : 2, files: files, docs: {} };
    }
    function topics(pack) {
        var out = [];
        Object.keys(pack.files).forEach(function (n) {
            var m = /^([^/]+)\/markup\.bcf$/i.exec(n);
            if (m) out.push(m[1]);
        });
        return out;
    }
    function parser() { return new W.DOMParser(); }
    function markupDoc(pack, guid) {
        if (pack.docs[guid]) return pack.docs[guid];
        var raw = pack.files[guid + "/markup.bcf"];
        if (!raw) throw new Error("topic " + guid + " not in the file");
        var doc = parser().parseFromString(dec.decode(raw), "application/xml");
        var err = doc.getElementsByTagName("parsererror")[0];
        if (err) throw new Error("markup.bcf of " + guid + " is not valid XML");
        pack.docs[guid] = doc;
        return doc;
    }
    function topicEl(doc) { return kid(doc.documentElement, "Topic"); }
    function flush(pack) {
        var ser = new W.XMLSerializer();
        Object.keys(pack.docs).forEach(function (g) {
            var s = ser.serializeToString(pack.docs[g]);
            if (!/^<\?xml/.test(s)) s = '<?xml version="1.0" encoding="utf-8"?>\n' + s;
            pack.files[g + "/markup.bcf"] = enc.encode(s);
        });
        pack.docs = {};
    }
    function write(pack) {
        flush(pack);
        var input = {};
        Object.keys(pack.files).forEach(function (n) {
            
            input[n] = /\.(png|jpe?g)$/i.test(n) ? [pack.files[n], { level: 0 }] : pack.files[n];
        });
        return zip().zipSync(input, { level: 6 });
    }
    function clone(pack) {
        flush(pack);
        var files = {};
        Object.keys(pack.files).forEach(function (n) { files[n] = pack.files[n]; });
        return { version: pack.version, major: pack.major, files: files, docs: {} };
    }

    
    function commentEls(doc, major) {
        return major === 3 ? kids(kid(topicEl(doc), "Comments"), "Comment") : kids(doc.documentElement, "Comment");
    }
    function viewpointEls(doc, major) {
        return major === 3 ? kids(kid(topicEl(doc), "Viewpoints"), "ViewPoint") : kids(doc.documentElement, "Viewpoints");
    }
    function labelsOf(t, major) {
        if (major === 3) return kids(kid(t, "Labels"), "Label").map(function (e) { return e.textContent; });
        return kids(t, "Labels").map(function (e) { return e.textContent; });
    }
    function extrasOf(pack, guid) {
        var raw = pack.files[guid + "/" + EXTRAS];
        if (!raw) return null;
        try { return JSON.parse(dec.decode(raw)); } catch (e) { return null; }
    }
    function headerOf(doc, major) {
        var h = kid(doc.documentElement, "Header");
        if (!h) return [];
        var files = major === 3 ? kids(kid(h, "Files"), "File") : kids(h, "File");
        return files.map(function (f) { return { fileName: text(f, "Filename"), date: text(f, "Date"), path: text(f, "Reference") }; });
    }
    function topic(pack, guid) {
        var doc = markupDoc(pack, guid), t = topicEl(doc), M = pack.major;
        var out = {
            guid: t.getAttribute("Guid") || guid,
            title: text(t, "Title"),
            index: intOrNull(text(t, "Index")),
            status: t.getAttribute("TopicStatus") || "",
            type: t.getAttribute("TopicType") || "",
            priority: text(t, "Priority"),
            stage: text(t, "Stage"),
            assignedTo: text(t, "AssignedTo"),
            dueDate: text(t, "DueDate"),
            description: text(t, "Description"),
            labels: labelsOf(t, M),
            creationDate: text(t, "CreationDate"),
            creationAuthor: text(t, "CreationAuthor"),
            modifiedDate: text(t, "ModifiedDate"),
            modifiedAuthor: text(t, "ModifiedAuthor"),
            comments: commentEls(doc, M).map(function (c) {
                var vp = kid(c, "Viewpoint");
                return { guid: c.getAttribute("Guid"), date: text(c, "Date"), author: text(c, "Author"), text: text(c, "Comment"),
                    viewpoint: vp ? vp.getAttribute("Guid") : "", modifiedDate: text(c, "ModifiedDate"), modifiedAuthor: text(c, "ModifiedAuthor") };
            }),
            viewpoints: viewpointEls(doc, M).map(function (v) {
                return { guid: v.getAttribute("Guid"), viewpoint: text(v, "Viewpoint"), snapshot: text(v, "Snapshot"), index: text(v, "Index") };
            }),
            header: headerOf(doc, M),
            extras: extrasOf(pack, guid),
            version: pack.version
        };
        return out;
    }
    function snapshot(pack, guid, vpGuid) {
        var t = topic(pack, guid);
        var list = t.viewpoints.filter(function (v) { return v.snapshot && (!vpGuid || v.guid === vpGuid); });
        var names = list.map(function (v) { return v.snapshot; });
        if (!vpGuid) names.push("snapshot.png");   
        for (var i = 0; i < names.length; i++) {
            var f = pack.files[guid + "/" + names[i]];
            if (f) return f;
        }
        return null;
    }

    
    function setFields(pack, guid, fields, who, when) {
        var doc = markupDoc(pack, guid), t = topicEl(doc), M = pack.major, order = TOPIC_ORDER[M];
        var changed = false, numberOnly = true;
        Object.keys(fields || {}).forEach(function (k) {
            if (k !== "index" && k in fields) numberOnly = numberOnly && false;
            var v = fields[k];
            if (k in ATTR_FIELDS) {
                
                if ((v == null || v === "") && M === 3) return;
                if (v == null || v === "") t.removeAttribute(ATTR_FIELDS[k]); else t.setAttribute(ATTR_FIELDS[k], String(v));
                changed = true;
            } else if (k in TEXT_FIELDS) {
                if (k === "title" && (v == null || String(v).trim() === "")) return;   
                setText(doc, t, TEXT_FIELDS[k], k === "dueDate" ? iso(v) : v, order);
                changed = true;
            } else if (k === "index") {
                var n = intOrNull(v);
                if (!n) return;                        
                setText(doc, t, "Index", String(n), order);
                changed = true;
            } else if (k === "labels") {
                var list = (Array.isArray(v) ? v : v ? Array.from(v) : []).map(String).filter(Boolean);
                if (M === 3) {
                    var L = kid(t, "Labels");
                    if (L) t.removeChild(L);
                    if (list.length) {
                        L = place(t, mk(doc, t, "Labels"), order);
                        list.forEach(function (s) { var e = mk(doc, L, "Label"); e.textContent = s; L.appendChild(e); });
                    }
                } else {
                    kids(t, "Labels").forEach(function (e) { t.removeChild(e); });
                    var after = null;
                    list.forEach(function (s) {
                        var e = mk(doc, t, "Labels"); e.textContent = s;
                        if (after) t.insertBefore(e, after.nextSibling); else place(t, e, order);
                        after = e;
                    });
                }
                changed = true;
            }
        });
        
        
        if (changed && !numberOnly) {
            setText(doc, t, "ModifiedDate", iso(when || new Date()), order);
            if (who) setText(doc, t, "ModifiedAuthor", who, order);
        }
        return changed;
    }
    
    
    function addPhotoViewpoint(pack, guid, png) {
        var doc = markupDoc(pack, guid), M = pack.major;
        var first = viewpointEls(doc, M)[0];
        var vg = uuid();
        var vfile = null;
        if (first && text(first, "Viewpoint") && pack.files[guid + "/" + text(first, "Viewpoint")]) {
            var src = dec.decode(pack.files[guid + "/" + text(first, "Viewpoint")]);
            var vd = parser().parseFromString(src, "application/xml");
            if (!vd.getElementsByTagName("parsererror")[0]) {
                vd.documentElement.setAttribute("Guid", vg);
                vfile = "viewpoint_" + vg + ".bcfv";
                var s = new W.XMLSerializer().serializeToString(vd);
                if (!/^<\?xml/.test(s)) s = '<?xml version="1.0" encoding="utf-8"?>\n' + s;
                pack.files[guid + "/" + vfile] = enc.encode(s);
            }
        }
        var img = u8(png);
        
        var sfile = "snapshot_" + vg + (img[0] === 0xFF && img[1] === 0xD8 ? ".jpg" : ".png");
        pack.files[guid + "/" + sfile] = img;
        addViewpoint(pack, guid, { guid: vg, viewpoint: vfile, snapshot: sfile });
        return vg;
    }
    
    function addViewpoint(pack, guid, v) {
        var doc = markupDoc(pack, guid), M = pack.major;
        var vp;
        if (M === 3) {
            var t = topicEl(doc);
            var box = kid(t, "Viewpoints") || place(t, mk(doc, t, "Viewpoints"), TOPIC_ORDER[3]);
            vp = mk(doc, box, "ViewPoint"); box.appendChild(vp);
        } else {
            
            vp = mk(doc, doc.documentElement, "Viewpoints");
            doc.documentElement.appendChild(vp);
        }
        vp.setAttribute("Guid", v.guid || uuid());
        if (v.viewpoint) { var e1 = mk(doc, vp, "Viewpoint"); e1.textContent = v.viewpoint; vp.appendChild(e1); }
        if (v.snapshot) { var e2 = mk(doc, vp, "Snapshot"); e2.textContent = v.snapshot; vp.appendChild(e2); }
        return vp.getAttribute("Guid");
    }
    function addComment(pack, guid, c) {
        c = c || {};
        var doc = markupDoc(pack, guid), M = pack.major;
        var cg = c.guid || uuid();
        var vpGuid = c.viewpoint || (c.photo ? addPhotoViewpoint(pack, guid, c.photo) : "");
        var host;
        if (M === 3) {
            var t = topicEl(doc);
            host = kid(t, "Comments") || place(t, mk(doc, t, "Comments"), TOPIC_ORDER[3]);
        } else host = doc.documentElement;
        var el = mk(doc, host, "Comment");
        el.setAttribute("Guid", cg);
        [["Date", iso(c.date || new Date())], ["Author", c.author || "unknown"], ["Comment", c.text || ""]].forEach(function (p) {
            if (p[0] === "Comment" && !p[1] && M === 3) return;
            var e = mk(doc, el, p[0]); e.textContent = p[1]; el.appendChild(e);
        });
        if (vpGuid) { var v = mk(doc, el, "Viewpoint"); v.setAttribute("Guid", vpGuid); el.appendChild(v); }
        if (M === 3) host.appendChild(el);
        else {
            
            var last = kids(host, "Comment").pop();
            if (last) host.insertBefore(el, last.nextSibling); else place(host, el, MARKUP_ORDER_2);
        }
        return cg;
    }
    function setHeader(pack, guid, models) {
        var doc = markupDoc(pack, guid), root = doc.documentElement, M = pack.major;
        var old = kid(root, "Header");
        if (old) root.removeChild(old);
        var list = (models || []).filter(function (m) { return m && (m.fileName || m.path); });
        if (!list.length) return;
        var h = mk(doc, root, "Header");
        root.insertBefore(h, kids(root)[0] || null);   
        var box = h;
        if (M === 3) { box = mk(doc, h, "Files"); h.appendChild(box); }
        var now = iso(new Date());
        list.forEach(function (m) {
            var f = mk(doc, box, "File");
            f.setAttribute(M === 3 ? "IsExternal" : "isExternal", "true");
            var n = mk(doc, f, "Filename"); n.textContent = m.fileName || String(m.path).split("/").pop(); f.appendChild(n);
            var d = mk(doc, f, "Date"); d.textContent = iso(m.date) || now; f.appendChild(d);
            if (m.path) { var r = mk(doc, f, "Reference"); r.textContent = m.path; f.appendChild(r); }
            box.appendChild(f);
        });
    }
    function setExtras(pack, guid, obj) {
        if (obj == null) { delete pack.files[guid + "/" + EXTRAS]; return; }
        pack.files[guid + "/" + EXTRAS] = enc.encode(JSON.stringify(obj, null, 1));
    }
    function only(pack, guid) {
        flush(pack);
        var keep = topics(pack);
        if (keep.indexOf(guid) < 0) throw new Error("topic " + guid + " missing from the export");
        keep.forEach(function (g) {
            if (g === guid) return;
            Object.keys(pack.files).forEach(function (n) { if (n.indexOf(g + "/") === 0) delete pack.files[n]; });
        });
    }
    function create(o) {
        o = o || {};
        var M = /^3/.test(o.version || "") ? 3 : 2;
        var version = M === 3 ? "3.0" : "2.1";
        var guid = o.guid || uuid();
        var vx = M === 3
            ? '<?xml version="1.0" encoding="utf-8"?>\n<Version xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" VersionId="3.0" />'
            : '<?xml version="1.0" encoding="utf-8"?>\n<Version xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" VersionId="2.1"><DetailedVersion>2.1</DetailedVersion></Version>';
        var now = iso(o.date || new Date());
        var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
        var type = o.type || (M === 3 ? "Issue" : ""), status = o.status || (M === 3 ? "Active" : "");
        var mx = '<?xml version="1.0" encoding="utf-8"?>\n<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            '<Topic Guid="' + guid + '"' + (type ? ' TopicType="' + esc(type) + '"' : "") + (status ? ' TopicStatus="' + esc(status) + '"' : "") + '>' +
            '<Title>' + esc(o.title || "Untitled") + '</Title><CreationDate>' + now + '</CreationDate><CreationAuthor>' + esc(o.author || "unknown") + '</CreationAuthor>' +
            '</Topic></Markup>';
        var pack = { version: version, major: M, files: {}, docs: {} };
        pack.files["bcf.version"] = enc.encode(vx);
        pack.files[guid + "/markup.bcf"] = enc.encode(mx);
        var f = {};
        ["index", "priority", "stage", "assignedTo", "dueDate", "description", "labels"].forEach(function (k) { if (o[k] != null && o[k] !== "" && !(Array.isArray(o[k]) && !o[k].length)) f[k] = o[k]; });
        if (Object.keys(f).length) {
            setFields(pack, guid, f, null, null);
            
            var t = topicEl(markupDoc(pack, guid));
            ["ModifiedDate", "ModifiedAuthor"].forEach(function (n) { var e = kid(t, n); if (e) t.removeChild(e); });
        }
        pack.guid = guid;
        return pack;
    }

    
    





    function merge(local, remote, guid, dirty) {
        var d = dirty instanceof Set ? dirty : new Set(dirty || []);
        if (topics(remote).indexOf(guid) < 0) return clone(local);
        var out = clone(remote);
        var L = topic(local, guid), R = topic(out, guid);
        var all = d.has("__new");
        var f = {};
        FIELDS.forEach(function (k) { if (all || d.has(k)) f[k] = L[k]; });
        
        if ((d.has("index") || all) && L.index) f.index = L.index;
        if (Object.keys(f).length) setFields(out, guid, f, L.modifiedAuthor || null, L.modifiedDate || null);
        
        var rv = {};
        R.viewpoints.forEach(function (v) { rv[v.guid] = v; });
        var takeVps = all || d.has("__snapshot") || d.has("__marker");
        var ldoc = markupDoc(local, guid), odoc = markupDoc(out, guid);
        var lvEls = viewpointEls(ldoc, local.major);
        L.viewpoints.forEach(function (v, i) {
            var isNew = !rv[v.guid];
            if (!isNew && !takeVps) return;
            [v.viewpoint, v.snapshot].forEach(function (n) { if (n && local.files[guid + "/" + n]) out.files[guid + "/" + n] = local.files[guid + "/" + n]; });
            if (isNew && local.major === out.major) {
                var imp = odoc.importNode(lvEls[i], true);
                if (out.major === 3) {
                    var t = topicEl(odoc);
                    var box = kid(t, "Viewpoints") || place(t, mk(odoc, t, "Viewpoints"), TOPIC_ORDER[3]);
                    box.appendChild(imp);
                } else odoc.documentElement.appendChild(imp);
            }
        });
        
        var have = {};
        R.comments.forEach(function (c) { have[c.guid] = 1; });
        var lcEls = commentEls(ldoc, local.major);
        L.comments.forEach(function (c, i) {
            if (have[c.guid]) return;
            if (local.major === out.major) {
                var imp = odoc.importNode(lcEls[i], true);
                if (out.major === 3) {
                    var t = topicEl(odoc);
                    (kid(t, "Comments") || place(t, mk(odoc, t, "Comments"), TOPIC_ORDER[3])).appendChild(imp);
                } else {
                    var last = kids(odoc.documentElement, "Comment").pop();
                    if (last) odoc.documentElement.insertBefore(imp, last.nextSibling); else place(odoc.documentElement, imp, MARKUP_ORDER_2);
                }
            } else addComment(out, guid, { guid: c.guid, text: c.text, author: c.author, date: c.date, viewpoint: c.viewpoint });
        });
        
        
        
        var reassign = d.has("__federation");
        if (reassign) setHeader(out, guid, L.header);
        else if (L.header.length && !R.header.length) setHeader(out, guid, L.header);
        var le = L.extras, re = R.extras;
        if (le || re) {
            var x = Object.assign({}, re || {}, le ? { v: le.v, app: le.app, topic: guid, savedAt: le.savedAt, savedBy: le.savedBy } : {});
            if (le && le.federation && !(re && re.federation)) x.federation = le.federation;
            if (le && le.models && le.models.length && !(re && re.models && re.models.length)) x.models = le.models;
            if (le && (all || d.has("__marker"))) x.marker = le.marker || null;
            if (le && le.context && (all || !(re && re.context))) x.context = le.context;
            if (reassign) { x.federation = (le && le.federation) || null; x.models = (le && le.models) || []; }
            setExtras(out, guid, x);
        }
        return out;
    }

    
    function summary(pack, guid, rel, app) {
        var t = topic(pack, guid), x = t.extras || {};
        return {
            app: app || x.app || "",
            file: rel,
            number: t.index || null,
            title: String(t.title || "").slice(0, 300),
            status: t.status || "",
            type: t.type || "",
            priority: t.priority || "",
            assignedTo: t.assignedTo || "",
            dueDate: t.dueDate || null,
            labels: t.labels.slice(0, 20),
            federation: x.federation || null,
            models: (x.models || []).map(function (m) { return m.path || m.fileName; }).slice(0, 50)
        };
    }

    
    









    function numbering(entries) {
        var list = (entries || []).filter(function (e) { return e && e.guid; });
        var key = function (e) { var t = Date.parse(e.creationDate || ""); return [isFinite(t) ? t : 8640000000000000, String(e.guid)]; };
        var cmp = function (a, b) { var ka = key(a), kb = key(b); return ka[0] - kb[0] || (ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0); };
        var seen = {}, byNum = {}, numbers = {}, loose = [], max = 0;
        list.slice().sort(cmp).forEach(function (e) {
            if (seen[e.guid]) return;          
            seen[e.guid] = 1;
            var n = intOrNull(e.index);
            if (n && !byNum[n]) { byNum[n] = e.guid; numbers[e.guid] = n; if (n > max) max = n; }
            else loose.push(e);
        });
        var changes = [];
        loose.forEach(function (e) {           
            max += 1;
            numbers[e.guid] = max;
            changes.push({ guid: e.guid, number: max });
        });
        return { numbers: numbers, changes: changes, next: max + 1 };
    }
    


    async function collectNumbers(io, folders, cache) {
        var out = [];
        for (var fi = 0; fi < (folders || []).length; fi++) {
            var files = [];
            try { files = (await io.list(folders[fi])) || []; } catch (e) { files = []; }
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (!/\.bcf(zip)?$/i.test(f.name || f.path || "")) continue;
                var c = cache && cache.get(f.path);
                if (!c || c.size !== f.size || c.lastModified !== f.lastModified) {
                    var got = [];
                    try {
                        var b = await io.read(f.path);
                        if (b) {
                            var pk = read(b);
                            topics(pk).forEach(function (g) { var x = topic(pk, g); got.push({ guid: g, index: x.index, creationDate: x.creationDate, rel: f.path }); });
                        }
                    } catch (e) { got = []; }
                    c = { size: f.size, lastModified: f.lastModified, entries: got };
                    if (cache) cache.set(f.path, c);
                }
                Array.prototype.push.apply(out, c.entries);
            }
        }
        return out;
    }

    


    function normalizeSnapshots(pack, guid) {
        if (topics(pack).indexOf(guid) < 0) return false;
        var doc = markupDoc(pack, guid), changed = false;
        viewpointEls(doc, pack.major).forEach(function (v) {
            var sn = kid(v, "Snapshot");
            if (!sn) return;
            var name = sn.textContent, f = pack.files[guid + "/" + name];
            if (!f || !/\.png$/i.test(name) || !(f[0] === 0xFF && f[1] === 0xD8)) return;
            var nn = name.replace(/\.png$/i, ".jpg"), i = 1;
            while (pack.files[guid + "/" + nn]) nn = name.replace(/\.png$/i, "_" + (i++) + ".jpg");
            pack.files[guid + "/" + nn] = f;
            delete pack.files[guid + "/" + name];
            sn.textContent = nn;
            changed = true;
        });
        return changed;
    }

    
    





    async function saveTopic(io, o) {
        var remoteBytes = await io.read(o.rel);
        var remote = remoteBytes ? read(remoteBytes) : null;
        var has = !!remote && topics(remote).indexOf(o.guid) >= 0;
        
        
        normalizeSnapshots(o.local, o.guid);
        if (has) normalizeSnapshots(remote, o.guid);
        var known = {};
        (o.known ? Array.from(o.known) : []).forEach(function (g) { known[g] = 1; });
        if (has) topic(remote, o.guid).comments.forEach(function (c) { known[c.guid] = 1; });
        var pack = has ? merge(o.local, remote, o.guid, o.dirty || new Set(["__new"])) : clone(o.local);
        var bytes = write(pack);
        await io.write(o.rel, bytes, { archive: "daily" });
        var saved = read(bytes);
        var t = topic(saved, o.guid);
        var events = [{ type: remoteBytes ? "bcf.topic.update" : "bcf.topic.create", target: o.guid, payload: summary(saved, o.guid, o.rel, o.app) }];
        t.comments.forEach(function (c) {
            if (!known[c.guid]) events.push({ type: "bcf.topic.comment", target: o.guid, payload: { app: o.app || "", comment: c.guid } });
        });
        if (typeof io.append === "function") {
            try { await io.append(events); } catch (e) { if (W.console) W.console.warn("[liteaeco-bcf] log append failed", e); }
        }
        return { bytes: bytes, pack: saved, merged: has, created: !remoteBytes, comments: t.comments.map(function (c) { return c.guid; }), events: events };
    }

    W.liteAECO.bcf = {
        BCF_BUILD: BCF_BUILD,
        STATUSES: STATUSES, TYPES: TYPES, PRIORITIES: PRIORITIES, STAGES: STAGES, CLOSED: CLOSED,
        FIELDS: FIELDS,
        read: read, write: write, clone: clone, topics: topics, topic: topic, snapshot: snapshot,
        setFields: setFields, addComment: addComment, addViewpoint: addViewpoint, normalizeSnapshots: normalizeSnapshots, setHeader: setHeader, setExtras: setExtras,
        only: only, create: create, merge: merge, summary: summary, uuid: uuid, saveTopic: saveTopic,
        numbering: numbering, collectNumbers: collectNumbers,
        isClosed: function (s) { return CLOSED.indexOf(s) >= 0; }
    };
})(typeof window !== "undefined" ? window : this);
