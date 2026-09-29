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
// liteAECO - (meetings-links.js)
// ========

































(function (W) {
    "use strict";
    W.liteAECO = W.liteAECO || {};
    const M = W.liteAECO.meetings = W.liteAECO.meetings || {};
    const APP = "meetings";

    const HEADERS = ["GUID", "Linked to", "Item", "Path", "Name", "Size", "Hash", "Kind", "Added by", "Added at", "Session", "Meta", "Comments"];

    const cde = () => W.liteAECO.cde;
    const t = (k, d) => (W.BASE_PAGE && W.BASE_PAGE[k]) || d;
    function esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    const parts = (rel) => String(rel || "").split("/").filter(Boolean);
    const baseName = (p) => parts(p).pop() || "";
    function newGuid() {
        const C = cde();
        if (C && C.uuid) return C.uuid();
        return W.crypto.randomUUID();
    }
    const json = (v) => { try { return JSON.stringify(v); } catch (e) { return ""; } };
    const unjson = (s, d) => { if (!s || s === "-") return d; try { return JSON.parse(s); } catch (e) { return d; } };

    
    function safeId(v) { const s = String(v == null ? "" : v).trim(); return /^[A-Za-z0-9-]{1,64}$/.test(s) ? s : ""; }

    
    function toAoa(links, refOf) {
        const rows = [HEADERS.slice()];
        (links || []).forEach(l => {
            const sub = l.linkedTo && l.linkedTo.type === "subthread" ? l.linkedTo.refGuid : "";
            rows.push([
                l.guid, sub || "meeting", sub && refOf ? (refOf(sub) || "-") : "-", l.path, l.name,
                l.size || 0, l.hash || "-", l.kind || "link", l.addedBy || "-", l.addedAt || "-",
                l.session || "-", l.meta ? json(l.meta) : "-", (l.comments && l.comments.length) ? json(l.comments) : "-"
            ]);
        });
        return rows;
    }
    function fromAoa(rows, itemGuids) {
        const hdr = (rows && rows[0]) || [];
        const ci = (h) => hdr.findIndex(x => String(x || "").trim() === h);
        const idx = {}; HEADERS.forEach(h => { idx[h] = ci(h); });
        const cell = (r, h) => { const i = idx[h]; const v = i >= 0 ? r[i] : undefined; return (v == null || String(v).trim() === "-") ? "" : String(v).trim(); };
        const known = itemGuids instanceof Set ? itemGuids : new Set(itemGuids || []);
        const out = [];
        for (let i = 1; i < (rows || []).length; i++) {
            const r = rows[i];
            if (!r || !cell(r, "Path")) continue;
            const to = cell(r, "Linked to");
            out.push({
                guid: safeId(cell(r, "GUID")) || newGuid(),
                
                linkedTo: to && to !== "meeting" && known.has(to) ? { type: "subthread", refGuid: to } : { type: "meeting", refGuid: "" },
                path: cell(r, "Path"), name: cell(r, "Name") || baseName(cell(r, "Path")),
                size: parseInt(cell(r, "Size"), 10) || 0, hash: cell(r, "Hash"),
                kind: cell(r, "Kind") === "upload" ? "upload" : "link",
                addedBy: cell(r, "Added by"), addedAt: cell(r, "Added at"),
                session: parseInt(cell(r, "Session"), 10) || null,
                meta: unjson(cell(r, "Meta"), null), comments: unjson(cell(r, "Comments"), [])
            });
        }
        return out;
    }

    
    function routeFor(path) {
        const p = String(path || "");
        if (/\.pdf$/i.test(p)) return { url: "pdf-viewer.html" };
        if (/\.(dxf|dwg)$/i.test(p)) return { url: "dxf-compare.html" };
        if (/\.(docx|docm|dotx|doc|dot|rtf|odt|ott|fodt|xlsx|xlsm|xlsb|xltx|xls|ods|fods)$/i.test(p)) return { url: "doc-viewer.html" };
        return null;
    }
    const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
        txt: "text/plain", csv: "text/csv", mp4: "video/mp4", mp3: "audio/mpeg", zip: "application/zip" };
    const mimeOf = (p) => MIME[(String(p).split(".").pop() || "").toLowerCase()] || "application/octet-stream";
    function iconFor(path) {
        const p = String(path || "").toLowerCase();
        if (/\.(jpe?g|png|gif|webp|svg|heic)$/.test(p)) return "image";
        if (/\.pdf$/.test(p)) return "file-text";
        if (/\.(dxf|dwg)$/.test(p)) return "drafting-compass";
        if (/\.(xlsx?|xlsm|xlsb|ods|csv)$/.test(p)) return "file-spreadsheet";
        if (/\.(ifc|frag)$/.test(p)) return "box";
        return "file";
    }

    
    async function prepare(env) {
        if (env.__lv) return env.__lv;
        const A = cde() && cde().access;
        let snap = null;
        try { snap = A && A.getSnapshot ? await A.getSnapshot(env.projectGuid) : null; } catch (e) { snap = null; }
        env.__lv = (rel, isFile, markers) => {
            if (!A) return { see: true, pathOnly: false };
            if (snap && A.level) return A.level(snap, rel, isFile, markers || []);
            const d = A.decide({ admin: false, who: null, rules: {}, rulesComplete: false }, rel, markers || []);
            return { see: d.visible, pathOnly: false };
        };
        return env.__lv;
    }
    function visible(env, path) { return env.__lv ? !!env.__lv(path, true).see : null; }

    
    async function dirOf(handle, list, create) {
        let d = handle;
        for (const p of list) d = await d.getDirectoryHandle(p, { create: !!create });
        return d;
    }
    async function manifest(env) {
        if (env.__manifest !== undefined) return env.__manifest;
        let m = null;
        try { m = await cde().readManifest(env.handle); } catch (e) { m = null; }
        env.__manifest = m && !m.__readError ? m : null;
        return env.__manifest;
    }
    async function filesFolder(env) {
        const m = await manifest(env);
        const base = cde().paths.appFolder(m, APP, "folder") || ".admin/meetings";
        const g = String(env.meetingGuid || "").replace(/[^A-Za-z0-9-]/g, "");
        if (!g) throw new Error("meeting has no GUID");
        return base + "/files/" + g;
    }
    async function exists(dir, name) {
        try { await dir.getFileHandle(name, { create: false }); return true; } catch (e) { return false; }
    }
    async function freeName(dir, name) {
        if (!(await exists(dir, name))) return name;
        const dot = name.lastIndexOf(".");
        const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
        for (let i = 2; i < 1000; i++) {
            const c = stem + " (" + i + ")" + ext;
            if (!(await exists(dir, c))) return c;
        }
        throw new Error("no free name for " + name);
    }
    const safeName = (n) => String(n || "file").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 150) || "file";

    
    async function upload(env, files, opts) {
        opts = opts || {};
        const C = cde();
        const folder = await filesFolder(env);
        if (!(await C.files.canUpload(env.handle, env.projectGuid, folder))) {
            const e = new Error("read-only folder: " + folder); e.readOnly = true; throw e;
        }
        const p = parts(folder);
        const dir = await dirOf(env.handle, p, true);
        const out = [], entries = [];
        for (const file of Array.from(files || [])) {
            let blob = file, name = safeName(file.name), meta = null;
            const isImg = /^image\//.test(file.type || "") && !/image\/(svg|hei[cf])/i.test(file.type || "");
            if (isImg && typeof opts.processImage === "function") {
                const r = await opts.processImage(file);
                blob = new Blob([r.u8], { type: r.mime });
                const ext = r.mime === "image/png" ? ".png" : ".jpg";
                name = name.replace(/\.[A-Za-z0-9]+$/, "") + ext;
                meta = Object.assign({ mime: r.mime, originalSize: file.size || 0 }, r.meta || {});
            }
            name = await freeName(dir, name);
            const entry = await C.files.writeSafe(env.handle, dir, p, name, blob);
            entries.push(entry);
            out.push({
                guid: newGuid(), linkedTo: opts.linkedTo || { type: "meeting", refGuid: "" },
                path: entry.path, name: name, size: entry.size || blob.size || 0, hash: entry.hash || "",
                kind: "upload", addedBy: env.author || "", addedAt: new Date().toISOString(),
                session: opts.session || null, meta: meta, comments: []
            });
        }
        if (entries.length) {
            try { await C.files.logEntries(env.session, env.author, "file.upload", folder, { folder: folder, via: APP }, entries); }
            catch (e) { console.warn("[meetings] upload log failed", e); }
        }
        return out;
    }

    

    async function linkFromEntry(env, entry, opts) {
        opts = opts || {};
        let hash = "";
        try { hash = (await cde().files.contentHashAt(env.handle, entry.path, "quick")) || ""; } catch (e) { hash = ""; }
        return {
            guid: newGuid(), linkedTo: opts.linkedTo || { type: "meeting", refGuid: "" },
            path: entry.path, name: entry.name || baseName(entry.path), size: entry.size || 0, hash: hash,
            kind: "link", addedBy: env.author || "", addedAt: new Date().toISOString(),
            session: opts.session || null, meta: null, comments: []
        };
    }

    
    const folderOf = (path) => parts(path).slice(0, -1).join("/");
    



    const FT_LAST_KEY = (guid) => "liteaeco_ftsel_" + guid;
    function hubFilesHref(env, path) {
        let u = "project-core.html?project=" + encodeURIComponent(env.projectGuid) + "&tab=files";
        if (path) u += "&folder=" + encodeURIComponent(folderOf(path)) + "&file=" + encodeURIComponent(baseName(path));
        return u;
    }
    async function canSee(env, path) {
        const A = cde().access;
        try {
            const lv = await prepare(env);
            const mk = A && A.chainMarkers ? await A.chainMarkers(env.handle, path, true) : [];
            return !!lv(path, true, mk).see;
        } catch (e) { return true; }   
    }
    
    async function openFolder(env, link, win) {
        if (!(await canSee(env, link.path))) return { ok: false, reason: "access" };
        try { await fileAt(env, link.path); } catch (e) { return { ok: false, reason: "missing" }; }
        const w = win || W;
        try { w.localStorage.setItem(FT_LAST_KEY(env.projectGuid), folderOf(link.path)); } catch (e) {  }
        const url = hubFilesHref(env, link.path);
        const tab = w.open(url, "_blank");
        return tab ? { ok: true, url: url, folder: folderOf(link.path) } : { ok: false, reason: "popup" };
    }

    






    const INDEX = [".liteaeco", "cache", "filetree.json"];
    const MAX_HASHED = 5;
    async function readIndex(env) {
        try {
            const f = await fileAt(env, INDEX.join("/"));
            const j = JSON.parse(await f.text());
            return Array.isArray(j && j.files) ? j.files.filter(x => x && typeof x.path === "string") : [];
        } catch (e) { return []; }
    }
    async function relocate(env, link) {
        if (!link || !link.path) return null;
        const list = await readIndex(env);
        if (!list.length) return null;
        const name = baseName(link.path).toLowerCase();
        const ext = (name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".")) : "");
        const size = Number(link.size) || 0;
        const not = (x) => x.path !== link.path && x.path.split("/")[0] !== ".liteaeco";
        let cands = list.filter(x => not(x) && baseName(x.path).toLowerCase() === name && (!size || Number(x.size) === size));
        if (!cands.length && size && link.hash && ext) {
            cands = list.filter(x => not(x) && Number(x.size) === size && baseName(x.path).toLowerCase().slice(-ext.length) === ext);
        }
        if (!cands.length || cands.length > MAX_HASHED) return null;
        const hits = [];
        for (const c of cands) {
            let file;
            try { file = await fileAt(env, c.path); } catch (e) { continue; }          
            if (size && file.size !== size) continue;
            if (!(await canSee(env, c.path))) continue;
            if (link.hash) {
                let h = "";
                try { h = (await cde().files.contentHashAt(env.handle, c.path, "quick")) || ""; } catch (e) { h = ""; }
                if (h !== link.hash) continue;
            }
            hits.push({ path: c.path, name: baseName(c.path), size: file.size });
        }
        return hits.length === 1 ? hits[0] : null;
    }
    
    async function download(env, link, win) {
        if (!(await canSee(env, link.path))) return { ok: false, reason: "access" };
        let file;
        try { file = await fileAt(env, link.path); } catch (e) { return { ok: false, reason: "missing" }; }
        const w = win || W;
        const url = URL.createObjectURL(file);
        const a = w.document.createElement("a");
        a.href = url; a.download = link.name || baseName(link.path);
        w.document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return { ok: true, name: a.download };
    }

    async function fileAt(env, path) {
        const p = parts(path), name = p.pop();
        return (await (await dirOf(env.handle, p, false)).getFileHandle(name, { create: false })).getFile();
    }
    
    async function open(env, link, win) {
        const A = cde().access;
        try {
            
            const lv = await prepare(env);
            const mk = A && A.chainMarkers ? await A.chainMarkers(env.handle, link.path, true) : [];
            if (!lv(link.path, true, mk).see) return { ok: false, reason: "access" };
        } catch (e) {  }
        let file;
        try { file = await fileAt(env, link.path); } catch (e) { return { ok: false, reason: "missing" }; }
        const r = routeFor(link.path);
        const w = win || W;
        if (r) {
            const url = r.url + "?project=" + encodeURIComponent(env.projectGuid) + "&open=" + encodeURIComponent(link.path);
            const tab = w.open(url, "_blank");
            return tab ? { ok: true, url: url } : { ok: false, reason: "popup" };
        }
        const blob = new Blob([await file.arrayBuffer()], { type: (link.meta && link.meta.mime) || file.type || mimeOf(link.path) });
        const url = URL.createObjectURL(blob);
        const tab = w.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return tab ? { ok: true, url: url } : { ok: false, reason: "popup" };
    }

    
    async function listDir(env, rel, markers) {
        const lv = await prepare(env);
        const dir = await dirOf(env.handle, parts(rel), false);
        const A = cde().access;
        const folders = [], files = [];
        for await (const e of dir.values()) {
            if (e.name.charAt(0) === ".") continue;   
            const path = (rel ? rel + "/" : "") + e.name;
            if (e.kind === "directory") {
                let mk = null;
                try { mk = A && A.readMarker ? await A.readMarker(e) : null; } catch (x) { mk = null; }
                const chain = mk ? markers.concat([mk]) : markers;
                const l = lv(path, false, chain);
                if (l.see || l.pathOnly) folders.push({ name: e.name, path: path, markers: chain });
            } else if (lv(path, true, markers).see) {
                let size = 0, mtime = 0;
                try { const f = await e.getFile(); size = f.size; mtime = f.lastModified; } catch (x) {  }
                files.push({ name: e.name, path: path, size: size, lastModified: mtime });
            }
        }
        const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        return { folders: folders.sort(byName), files: files.sort(byName) };
    }
    const fmtSize = (n) => !n ? "" : n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

    
    function openPicker(opts) {
        const env = opts.env;
        const box = W.document.createElement("div");
        box.className = "fixed inset-0 bg-slate-900/40 z-[150] flex items-center justify-center p-4 att-noprint";
        box.dataset.mtgPicker = "1";
        box.innerHTML = `<div class="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-full max-w-2xl h-[75vh] flex flex-col overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <h3 class="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2"><i data-lucide="link" class="w-4 h-4 text-indigo-600"></i> ${esc(opts.title || t("lnkPickTitle", "Link project files"))}</h3>
                <button type="button" data-x class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="px-5 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
                <div data-crumbs class="flex-1 min-w-0 flex flex-wrap items-center gap-1 text-xs"></div>
                <input data-filter type="text" placeholder="${esc(t("lnkFilter", "Filter..."))}" class="w-40 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500">
            </div>
            <div data-list class="flex-1 overflow-y-auto p-2 text-sm"></div>
            <div class="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50 shrink-0">
                <span data-count class="text-xs text-slate-500"></span>
                <div class="flex gap-2">
                    <button type="button" data-x class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200">${esc(t("btnCancel", "Cancel"))}</button>
                    <button type="button" data-ok disabled class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">${esc(t("lnkLink", "Link"))}</button>
                </div>
            </div></div>`;
        const $ = (s) => box.querySelector(s);
        const picked = new Map();
        let cur = { path: "", markers: [] }, listing = { folders: [], files: [] }, stack = [{ name: t("lnkRoot", "Project"), path: "", markers: [] }];
        const close = () => { W.document.removeEventListener("keydown", onKey); box.remove(); };
        const onKey = (e) => { if (e.key === "Escape") close(); };
        W.document.addEventListener("keydown", onKey);
        box.addEventListener("click", (e) => { if (e.target === box) close(); });
        box.querySelectorAll("[data-x]").forEach(b => { b.onclick = close; });
        const icons = () => { if (W.lucide) try { W.lucide.createIcons({ root: box }); } catch (e) { } };
        function draw() {
            const f = ($("[data-filter]").value || "").toLowerCase();
            const hit = (x) => !f || x.name.toLowerCase().indexOf(f) >= 0;
            $("[data-crumbs]").innerHTML = stack.map((s, i) => `<button type="button" data-crumb="${i}" class="font-semibold ${i === stack.length - 1 ? "text-slate-800" : "text-indigo-600 hover:underline"}">${esc(s.name)}</button>`).join('<span class="text-slate-300">/</span>');
            const rows = listing.folders.filter(hit).map(d => `<button type="button" data-dir="${esc(d.path)}" class="w-full text-left px-3 py-2 rounded hover:bg-slate-50 flex items-center gap-2"><i data-lucide="folder" class="w-4 h-4 text-amber-500 shrink-0"></i><span class="truncate">${esc(d.name)}</span></button>`)
                .concat(listing.files.filter(hit).map(x => `<label class="w-full px-3 py-2 rounded hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"><input type="checkbox" data-file="${esc(x.path)}" ${picked.has(x.path) ? "checked" : ""} class="accent-indigo-600 shrink-0"><i data-lucide="${iconFor(x.path)}" class="w-4 h-4 text-slate-400 shrink-0"></i><span class="truncate flex-1">${esc(x.name)}</span><span class="text-[11px] text-slate-400 shrink-0">${fmtSize(x.size)}</span></label>`));
            $("[data-list]").innerHTML = rows.length ? rows.join("") : `<p class="text-sm text-slate-400 italic p-6 text-center">${esc(t("lnkEmpty", "Nothing here."))}</p>`;
            $("[data-count]").textContent = picked.size ? (picked.size + " " + t("lnkSelected", "selected")) : "";
            $("[data-ok]").disabled = !picked.size;
            box.querySelectorAll("[data-crumb]").forEach(b => { b.onclick = () => { stack = stack.slice(0, Number(b.dataset.crumb) + 1); go(stack[stack.length - 1]); }; });
            box.querySelectorAll("[data-dir]").forEach(b => { b.onclick = () => { const d = listing.folders.find(x => x.path === b.dataset.dir); stack.push(d); go(d); }; });
            box.querySelectorAll("[data-file]").forEach(c => {
                c.onchange = () => {
                    const x = listing.files.find(y => y.path === c.dataset.file);
                    if (c.checked) picked.set(x.path, x); else picked.delete(x.path);
                    $("[data-count]").textContent = picked.size ? (picked.size + " " + t("lnkSelected", "selected")) : "";
                    $("[data-ok]").disabled = !picked.size;
                };
            });
            icons();
        }
        async function go(d) {
            cur = d;
            $("[data-list]").innerHTML = `<p class="text-sm text-slate-400 italic p-6 text-center">${esc(t("lnkLoading", "Loading..."))}</p>`;
            try { listing = await listDir(env, d.path, d.markers || []); }
            catch (e) { console.warn("[meetings] folder not listed", e); listing = { folders: [], files: [] }; }
            if (cur === d) draw();
        }
        $("[data-filter]").addEventListener("input", draw);
        $("[data-ok]").onclick = async () => {
            $("[data-ok]").disabled = true;
            try { if (opts.onPick) await opts.onPick([...picked.values()]); }
            finally { close(); }
        };
        W.document.body.appendChild(box);
        icons();
        const ready = go(stack[0]);
        return { box: box, close: close, ready: ready, go: (i) => go(i) };
    }

    
    

    function groups(rows, opts) {
        opts = opts || {};
        const upTo = opts.upTo != null ? Number(opts.upTo) : null;
        const map = new Map();
        (rows || []).forEach(r => {
            const s = Number(r.session) || 0;
            if (upTo != null && s > upTo) return;
            if (!map.has(s)) map.set(s, []);
            map.get(s).push(r);
        });
        const keys = [...map.keys()].sort((a, b) => b - a);
        const n = opts.openCount == null ? 3 : opts.openCount;
        const st = opts.openState || {};
        return keys.map((s, i) => ({
            session: s, rows: map.get(s),
            open: Object.prototype.hasOwnProperty.call(st, s) ? !!st[s] : i < n,
            current: upTo != null ? s === upTo : s === Number(opts.current)
        }));
    }

    M.links = {
        BUILD: 4, HEADERS: HEADERS, safeId: safeId,   
        toAoa: toAoa, fromAoa: fromAoa, routeFor: routeFor, iconFor: iconFor, fmtSize: fmtSize,
        prepare: prepare, visible: visible, filesFolder: filesFolder, upload: upload, linkFromEntry: linkFromEntry,
        open: open, openFolder: openFolder, download: download, folderOf: folderOf, hubFilesHref: hubFilesHref, relocate: relocate,
        listDir: listDir, openPicker: openPicker, groups: groups
    };
})(typeof window !== "undefined" ? window : globalThis);
