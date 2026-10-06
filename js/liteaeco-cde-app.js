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
// liteAECO - (liteaeco-cde-app.js)
// ========

(function (W) {
    "use strict";
    W.liteAECO = W.liteAECO || {};
    const core = () => (W.liteAECO && W.liteAECO.cde) || null;

    function params() {
        try {
            const q = new URLSearchParams(W.location.search);
            const guid = q.get("project"), open = q.get("open");
            return (guid && open) ? { guid, open, q } : null;
        } catch (e) { return null; }
    }

    const splitRel = (rel) => String(rel || "").split("/").filter(Boolean);
    async function dirOf(handle, parts, create) {
        let d = handle;
        for (const p of parts) d = await d.getDirectoryHandle(p, { create: !!create });
        return d;
    }
    async function fileAt(handle, rel) {
        const parts = splitRel(rel), name = parts.pop();
        return (await (await dirOf(handle, parts, false)).getFileHandle(name, { create: false })).getFile();
    }

    function readOnlyBadge(text) {
        if (document.getElementById("cde-readonly-badge")) return;
        const b = document.createElement("div");
        b.id = "cde-readonly-badge";
        b.textContent = text;
        b.style.cssText = "position:fixed;right:0;bottom:16px;transform:translateX(-50%);z-index:9999;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:6px;padding:6px 12px;font:600 12px system-ui,sans-serif;";
        document.body.appendChild(b);
    }

    async function open(opts) {
        opts = opts || {};
        const p = params();
        if (!p) return null;
        const c = core();
        const txt = {
            noHandle: "This project has no linked folder on this machine. Open it from the Projects page first.",
            noAccess: "Folder access was not granted.",
            readOnly: "Read only"
        };
        Object.keys(opts.text || {}).forEach(k => { if (opts.text[k]) txt[k] = opts.text[k]; });
        const say = opts.alert || ((m) => W.alert(m));
        if (!c) { say("liteAECO core not loaded."); return { error: "no-core" }; }

        let info = await c.openProject(p.guid).catch(() => null);
        if (!info) { say(txt.noHandle); return { error: "no-handle" }; }
        if (info.permission !== "granted") {
            const go = opts.confirm ? await opts.confirm(p.open.split("/").pop()) : true;
            if (!go) return { error: "cancelled" };
            info = await c.requestAccess(p.guid).catch(() => null);
            if (!info || info.permission !== "granted") { say(txt.noAccess); return { error: "no-access" }; }
        }
        const backHref = "project-core.html?project=" + encodeURIComponent(p.guid);

        let level = { see: true, upload: true };
        try {
            if (c.access && c.access.levelForMe) level = await c.access.levelForMe(info.handle, p.guid, p.open);
        } catch (e) { console.warn("access check skipped:", e); }
        if (!level.see) { W.location.href = backHref; return { error: "hidden" }; }
        const readOnly = !level.upload;
        if (readOnly && opts.badge !== false) readOnlyBadge(txt.readOnly);

        const me = c.identity.whoAmI ? await c.identity.whoAmI(info.handle, p.guid) : { author: null };
        const appName = "app." + (String(W.location.pathname).split("/").pop() || "app").replace(/\.html?$/i, "");
        let sess = null;
        const session = () => (sess = sess || c.session(info.handle));

        const ctx = {
            guid: p.guid, path: p.open, handle: info.handle, name: info.name,
            level, readOnly, me, backHref,
            readFile: (rel) => fileAt(info.handle, rel || p.open),
            readBytes: async (rel) => new Uint8Array(await (await fileAt(info.handle, rel || p.open)).arrayBuffer()),
            hash: async (rel, mode) => c.files.contentHash(await fileAt(info.handle, rel || p.open), mode),
            canUpload: (folderRel) => c.files.canUpload(info.handle, p.guid, folderRel),
            async writeFile(rel, file, opts) {
                const parts = splitRel(rel), name = parts.pop();
                const folder = parts.join("/");
                if (!(await c.files.canUpload(info.handle, p.guid, folder))) {
                    const e = new Error("read-only folder: " + (folder || "/")); e.readOnly = true; throw e;
                }
                const dir = await dirOf(info.handle, parts, true);
                const entry = await c.files.writeSafe(info.handle, dir, parts, name, file, opts);
                await c.files.logEntries(session(), me.author, "file.upload", folder || "/", { folder: folder || "/", via: appName }, [entry]);
                return entry;
            },
            log: (type, target, payload, app) =>
                session().append(me.author, app || appName, [{ type, target: target || p.open, payload: payload || {} }])
        };
        return ctx;
    }

    W.liteAECO.app = { params, open, readOnlyBadge, BUILD: 16 };
})(typeof window !== "undefined" ? window : globalThis);
