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
// liteAECO - (meetings-issues.js)
// ========























(function (W) {
    "use strict";
    W.liteAECO = W.liteAECO || {};
    const M = W.liteAECO.meetings = W.liteAECO.meetings || {};
    const APP = "meetings";

    const PRIORITY = { low: "Low", medium: "Normal", high: "Major" };

    const cde = () => W.liteAECO.cde;
    const bcf = () => {
        const L = W.liteAECO.bcf;
        if (!L || typeof L.saveTopic !== "function") throw new Error("issue library not loaded (js/liteaeco-bcf.js)");
        return L;
    };
    const t = (k, d) => (W.BASE_PAGE && W.BASE_PAGE[k]) || d;
    function esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    
    function firstLine(text) {
        return String(text || "").split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
    }
    function titleFor(threadTitle, text) {
        const a = String(threadTitle || "").trim(), b = firstLine(text);
        const s = a && b ? a + " - " + b : (a || b || t("issUntitled", "Action item"));
        return s.length > 200 ? s.slice(0, 199) + "…" : s;
    }
    function priorityFor(p) { return PRIORITY[String(p || "").toLowerCase()] || "Normal"; }
    const isMail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
    


    function assigneeValue(p) {
        if (!p) return "";
        if (p.company && !p.name) return String(p.company).trim();
        return isMail(p.contactInfo) ? String(p.contactInfo).trim() : String(p.name || "").trim();
    }

    
    const parts = (rel) => String(rel || "").split("/").filter(Boolean);
    async function dirOf(handle, list, create) {
        let d = handle;
        for (const p of list) d = await d.getDirectoryHandle(p, { create: !!create });
        return d;
    }
    function io(env) {
        const C = cde();
        return {
            list: (folder) => C.scanFolder(env.handle, folder, 1),
            read: async (rel) => {
                const p = parts(rel), name = p.pop();
                try {
                    const f = await (await (await dirOf(env.handle, p, false)).getFileHandle(name, { create: false })).getFile();
                    return new Uint8Array(await f.arrayBuffer());
                } catch (e) {
                    if (e && (e.name === "NotFoundError" || e.name === "TypeMismatchError")) return null;
                    throw e;
                }
            },
            write: async (rel, bytes, opts) => {
                const p = parts(rel), name = p.pop(), folder = p.join("/");
                if (!(await C.files.canUpload(env.handle, env.projectGuid, folder))) {
                    const e = new Error("read-only folder: " + folder); e.readOnly = true; throw e;
                }
                const dir = await dirOf(env.handle, p, true);
                const entry = await C.files.writeSafe(env.handle, dir, p, name, new Blob([bytes]), opts);
                await C.files.logEntries(env.session, env.author, "file.upload", folder, { folder: folder, via: APP }, [entry]);
                return entry;
            },
            append: (events) => env.session.append(env.author, APP, events)
        };
    }
    
    async function folders(env) {
        if (env.__folders) return env.__folders;
        const C = cde();
        let m = null;
        try { m = await C.readManifest(env.handle); } catch (e) { m = null; }
        if (!m || m.__readError) m = null;
        const own = C.paths.issuesFolder(m, APP);
        const all = [own];
        [C.paths.issuesFolder(m, "model_viewer")].concat(C.paths.issueFolders ? C.paths.issueFolders(m) : [])
            .forEach(f => { if (f && all.indexOf(f) < 0) all.push(f); });
        env.__folders = { own: own, all: all };
        return env.__folders;
    }
    async function nextNumber(env) {
        const L = bcf();
        const f = await folders(env);
        if (!env.cache) env.cache = new Map();
        return L.numbering(await L.collectNumbers(io(env), f.all, env.cache)).next;
    }

    
    async function create(env, input) {
        const L = bcf();
        const f = await folders(env);
        const next = await nextNumber(env);
        const labels = [String(env.meetingTitle || "").trim()].filter(Boolean);
        const pack = L.create({
            index: next, title: input.title || t("issUntitled", "Action item"), author: env.author || "unknown",
            status: "Active", type: "Task",
            priority: input.priority || "", assignedTo: input.assignedTo || "", dueDate: dueNoon(input.dueDate),
            description: input.description || "", labels: labels
        });
        const g = pack.guid;
        L.setExtras(pack, g, {
            v: 1, app: APP, topic: g, savedAt: new Date().toISOString(), savedBy: env.author || "",
            federation: null, models: [], marker: null, context: null,
            
            meeting: {
                guid: env.meetingGuid || "", file: env.filePath || "", title: env.meetingTitle || "",
                session: env.sessionNo || null, item: (input.item && input.item.guid) || "", ref: (input.item && input.item.ref) || ""
            }
        });
        const rel = f.own + "/" + g + ".bcf";
        const res = await L.saveTopic(io(env), { rel: rel, guid: g, local: pack, dirty: new Set(["__new", "index"]), app: APP });
        const number = L.topic(res.pack, g).index || next;
        if (env.cache) env.cache.set(rel, { size: -1, lastModified: -1, entries: [{ guid: g, index: number, creationDate: new Date().toISOString(), rel: rel }] });
        return { guid: g, number: number, rel: rel };
    }

    

    function dueNoon(d) {
        const v = String(d || "").trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T12:00:00Z" : v;
    }

    async function readOne(env, guid) {
        const L = bcf();
        const f = await folders(env);
        const rel = f.own + "/" + String(guid).replace(/[^A-Za-z0-9-]/g, "") + ".bcf";
        const bytes = await io(env).read(rel);
        if (!bytes) return { missing: true, rel: rel };
        const pk = L.read(bytes);
        const list = L.topics(pk);
        const g = list.indexOf(guid) >= 0 ? guid : list[0];
        if (!g) return { missing: true, rel: rel };
        const x = L.topic(pk, g);
        return {
            guid: g, rel: rel, number: x.index || null, title: x.title, status: x.status, closed: L.isClosed(x.status),
            priority: x.priority, assignedTo: x.assignedTo, dueDate: x.dueDate ? String(x.dueDate).slice(0, 10) : "",
            comments: x.comments.slice(-3).map(c => ({ author: c.author, date: c.date, text: c.text })), commentCount: x.comments.length
        };
    }

    function hubHref(env, guid) {
        return "project-core.html?project=" + encodeURIComponent(env.projectGuid) + "&tab=issues&app=" + APP + "&topic=" + encodeURIComponent(guid);
    }

    
    function modal(inner, onClose) {
        const box = W.document.createElement("div");
        box.className = "fixed inset-0 bg-slate-900/40 z-[150] flex items-center justify-center p-4 att-noprint";
        box.dataset.mtgIssue = "1";
        box.innerHTML = `<div class="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">${inner}</div>`;
        const close = () => { W.document.removeEventListener("keydown", onKey); box.remove(); if (onClose) onClose(); };
        const onKey = (e) => { if (e.key === "Escape") close(); };
        W.document.addEventListener("keydown", onKey);
        box.addEventListener("click", (e) => { if (e.target === box) close(); });
        W.document.body.appendChild(box);
        if (W.lucide) try { W.lucide.createIcons({ root: box }); } catch (e) { }
        return { box: box, close: close };
    }
    const head = (icon, title, extra) => `
        <div class="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <h3 class="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <i data-lucide="${icon}" class="w-4 h-4 text-indigo-600"></i> ${esc(title)} ${extra || ""}
            </h3>
            <button type="button" data-x class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>`;
    const lbl = (s) => `<label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">${esc(s)}</label>`;
    const inputCls = "w-full border border-slate-200 bg-white rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500";

    

    function openCreatePanel(opts) {
        const d = opts.defaults || {};
        const prios = (W.liteAECO.bcf && W.liteAECO.bcf.PRIORITIES) || ["Low", "Normal", "Major", "Critical"];
        const people = (opts.assignees || []).filter(a => a.group !== "company");
        const comps = (opts.assignees || []).filter(a => a.group === "company");
        const opt = (a) => `<option value="${esc(a.value)}" ${a.value === d.assignee ? "selected" : ""}>${esc(a.label)}</option>`;
        const m = modal(`
            ${head("message-square-warning", t("issCreateTitle", "Create issue"), `<span data-num class="text-indigo-500 normal-case tracking-normal"></span>`)}
            <form class="p-5 flex flex-col gap-4 overflow-y-auto">
                <div>${lbl(t("issFieldTitle", "Title"))}<input name="title" required maxlength="200" class="${inputCls}" value="${esc(d.title)}"></div>
                <div>${lbl(t("issFieldDescription", "Description"))}<textarea name="description" rows="4" class="${inputCls} resize-y">${esc(d.description)}</textarea></div>
                <div>${lbl(t("issFieldAssignee", "Assigned to"))}
                    <select name="assignee" class="${inputCls}">
                        <option value="">${esc(t("issNobody", "Nobody"))}</option>
                        ${people.map(opt).join("")}
                        ${comps.length ? `<optgroup label="${esc(t("titleCompanies", "Companies"))}">${comps.map(opt).join("")}</optgroup>` : ""}
                    </select></div>
                <div class="flex gap-3">
                    <div class="flex-1">${lbl(t("issFieldPriority", "Priority"))}
                        <select name="priority" class="${inputCls}">${prios.map(p => `<option ${p === d.priority ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
                    <div class="flex-1">${lbl(t("issFieldDue", "Due date"))}<input type="date" name="due" class="${inputCls}" value="${esc(d.dueDate)}"></div>
                </div>
                <p data-err class="hidden text-xs text-red-600"></p>
                <p class="text-[11px] text-slate-400">${esc(t("issCreateHint", "Status and comments are followed in the project hub (Issues)."))}</p>
                <div class="flex justify-end gap-2">
                    <button type="button" data-x class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200">${esc(t("btnCancel", "Cancel"))}</button>
                    <button type="submit" data-ok class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">${esc(t("issCreate", "Create"))}</button>
                </div>
            </form>`, opts.onClose);
        const box = m.box, form = box.querySelector("form"), num = box.querySelector("[data-num]"), err = box.querySelector("[data-err]");
        box.querySelectorAll("[data-x]").forEach(b => { b.onclick = m.close; });
        
        nextNumber(opts.env).then(n => { num.textContent = "#" + n; }).catch(() => { });
        let busy = false;
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (busy) return;
            busy = true;
            const okBtn = box.querySelector("[data-ok]");
            okBtn.disabled = true;
            err.classList.add("hidden");
            try {
                const f = form.elements;   
                const res = await create(opts.env, {
                    title: f.namedItem("title").value.trim(), description: f.namedItem("description").value,
                    priority: f.namedItem("priority").value, dueDate: f.namedItem("due").value, assignedTo: f.namedItem("assignee").value, item: opts.item
                });
                m.close();
                if (opts.onCreated) opts.onCreated(res);
            } catch (ex) {
                console.warn("[meetings] issue not created", ex);
                err.textContent = ex && ex.readOnly
                    ? t("issNoRight", "Not created: no write right on the issues folder.")
                    : t("issFailed", "The issue could not be created:") + " " + (ex && ex.message ? ex.message : ex);
                err.classList.remove("hidden");
                okBtn.disabled = false;
                busy = false;
            }
        });
        setTimeout(() => { try { form.elements.namedItem("title").focus(); } catch (e) { } }, 30);
        return m;
    }

    
    function openViewPanel(opts) {
        const m = modal(`${head("message-square-warning", t("issViewTitle", "Issue"), opts.number ? "#" + esc(opts.number) : "")}
            <div data-body class="p-5 overflow-y-auto text-sm text-slate-500 italic">${esc(t("issLoading", "Loading..."))}</div>
            <div class="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                <a data-hub target="_blank" rel="noopener" href="${esc(hubHref(opts.env, opts.guid))}" class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5"><i data-lucide="external-link" class="w-3.5 h-3.5"></i> ${esc(t("issOpenHub", "Open in hub"))}</a>
                <button type="button" data-x class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200">${esc(t("btnClose", "Close"))}</button>
            </div>`);
        m.box.querySelectorAll("[data-x]").forEach(b => { b.onclick = m.close; });
        const body = m.box.querySelector("[data-body]");
        const done = readOne(opts.env, opts.guid).then((r) => {
            if (r.missing) {
                body.textContent = t("issMissing", "The issue file was not found (moved or deleted).");
                return r;
            }
            if (r.number && r.number !== opts.number && opts.onNumber) opts.onNumber(r.number);
            const row = (k, v) => `<div class="py-1.5 flex gap-3"><dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28 shrink-0 pt-0.5">${esc(k)}</dt><dd class="text-xs text-slate-700 flex-1 break-words">${esc(v || "—")}</dd></div>`;
            body.className = "p-5 overflow-y-auto";
            body.innerHTML = `
                <p class="text-base font-bold text-slate-800 mb-2">${r.number ? "#" + esc(r.number) + " " : ""}${esc(r.title)}</p>
                <dl class="divide-y divide-slate-100">
                    ${row(t("issFieldStatus", "Status"), r.status)}
                    ${row(t("issFieldAssignee", "Assigned to"), r.assignedTo)}
                    ${row(t("issFieldDue", "Due date"), r.dueDate)}
                    ${row(t("issFieldPriority", "Priority"), r.priority)}
                </dl>
                ${r.comments.length ? `<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">${esc(t("issLastComments", "Last comments"))} (${r.commentCount})</p>
                    ${r.comments.map(c => `<div class="text-xs text-slate-600 py-1 border-b border-slate-50"><b>${esc(c.author)}</b> <span class="text-slate-400">${esc(String(c.date || "").slice(0, 10))}</span><br>${esc(c.text)}</div>`).join("")}` : ""}`;
            return r;
        }).catch((e) => {
            console.warn("[meetings] issue not read", e);
            body.textContent = t("issReadFailed", "The issue could not be read:") + " " + (e && e.message ? e.message : e);
            return { error: e };
        });
        m.done = done;
        return m;
    }

    M.issues = {
        BUILD: 2, PRIORITY: PRIORITY, dueNoon: dueNoon,   
        firstLine: firstLine, titleFor: titleFor, priorityFor: priorityFor, assigneeValue: assigneeValue,
        io: io, folders: folders, nextNumber: nextNumber, create: create, readOne: readOne, hubHref: hubHref,
        openCreatePanel: openCreatePanel, openViewPanel: openViewPanel
    };
})(typeof window !== "undefined" ? window : globalThis);
