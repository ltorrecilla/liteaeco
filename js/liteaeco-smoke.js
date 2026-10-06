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
// liteAECO - (liteaeco-smoke.js)
// ========

(async function liteaecoSmoke(opts) {
  opts = opts || {};
  const W = opts.win || window;
  const importer = opts.importer || ((u) => import(u));
  const rows = [];
  const add = (area, check, status, detail) => rows.push({ area, check, status, detail: detail == null ? "" : String(detail) });
  const pass = (a, c, d) => add(a, c, "PASS", d);
  const failR = (a, c, d) => add(a, c, "FAIL", d);
  const warn = (a, c, d) => add(a, c, "WARN", d);
  const skip = (a, c, d) => add(a, c, "SKIP", d);
  const expect = (a, c, cond, okD, badD) => (cond ? pass(a, c, okD) : failR(a, c, badD));
  const fn = (o, k) => !!o && typeof o[k] === "function";
  const page = /ifc-(viewer-)?audit/i.test(W.location.pathname) ? "viewer"
    : /project-core/i.test(W.location.pathname) ? "hub" : "other";
  const url = (rel) => new URL(rel, W.location.href).href;
  const L = W.liteAECO || {};
  const cde = L.cde;
  const D = L.disciplines;

  expect("core", "liteAECO.cde loaded", !!cde, "", "js/liteaeco-cde.js missing");
  if (cde) {
    expect("core", "core build >= 20", cde.CDE_BUILD >= 20, "build " + cde.CDE_BUILD, "build " + cde.CDE_BUILD + " (deploy js/liteaeco-cde.js)");
    expect("core", "issues folder per app (build 20)", !!cde.paths && fn(cde.paths, "issuesFolder") && cde.paths.issuesFolder(null, "model_viewer") === "issues/coordination", "", "cde.paths.issuesFolder missing");
    expect("core", "folder paths API (build 19)", !!cde.paths && fn(cde.paths, "rewrite") && fn(cde.paths, "structureDirs"), "", "cde.paths missing");
    expect("core", "file ops (archive, writeSafe, logEntries)", !!cde.files && ["archive", "writeSafe", "logEntries", "canUpload"].every((k) => fn(cde.files, k)), "", "cde.files incomplete");
    expect("core", "identity + trusted state", fn(cde.identity, "whoAmI") && fn(cde, "loadStateTrusted"), "", "whoAmI / loadStateTrusted missing");
    expect("core", "federation file API", !!cde.ltf && fn(cde.ltf, "read") && fn(cde.ltf, "write"), "", "cde.ltf missing");
  }
  if (D) {
    const models = D.models(), roles = D.roles();
    expect("disciplines", "16 model codes", models.length === 16, models.map((d) => d.code).join(" "), models.length + " codes");
    expect("disciplines", "5 role codes, kept out of models()", roles.length === 5 && !models.some((d) => d.role), roles.map((d) => d.code).join(" "), "roles: " + roles.length);
    const g1 = D.infer("B2_ARC_VOIDS.ifc"), g2 = D.infer("ARCHIVE.ifc"), g3 = D.infer("mechanical electrical plumbing.ifc");
    expect("disciplines", "guess rule (VOID, no match inside words, multi-word first)", g1 === "VOID" && g2 === "" && g3 === "MEP", "VOID / '' / MEP", `${g1} / ${g2} / ${g3}`);
  } else failR("disciplines", "liteAECO.disciplines loaded", "js/common.js is old or missing");
  expect("vendor", "SheetJS (XLSX) loaded", !!W.XLSX && fn(W.XLSX, "write"), W.XLSX && W.XLSX.version, "js/vendor/xlsx-1.2.0.bundle.js not loaded");
  const LB = L.bcf;
  if (page === "viewer" || LB) {
    expect("bcf", "BCF file library (js/liteaeco-bcf.js)", !!LB && fn(LB, "saveTopic") && LB.BCF_BUILD >= 2, LB && "build " + LB.BCF_BUILD, LB ? "build " + LB.BCF_BUILD + " (deploy js/liteaeco-bcf.js)" : "js/liteaeco-bcf.js not loaded");
    expect("bcf", "fflate (js/vendor/index-0.8.3.js)", !!W.fflate && fn(W.fflate, "unzipSync"), "", "fflate not loaded");
    if (LB && W.fflate) {
      try {
        const p = LB.create({ title: "smoke", author: "smoke" });
        const g = p.guid;
        LB.addComment(p, g, { text: "c", author: "smoke" });
        const back = LB.topic(LB.read(LB.write(p)), g);
        expect("bcf", "BCF create / write / read (in memory)", back.title === "smoke" && back.comments.length === 1, "", "round trip failed");
      } catch (e) { failR("bcf", "BCF create / write / read (in memory)", e.message); }
    }
  }
  expect("vendor", "Lucide loaded", !!W.lucide && fn(W.lucide, "createIcons"), "", "js/vendor/lucide-1.45.0.min.js not loaded");
  const scripts = [...W.document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
  expect("vendor", "no CDN lucide@latest", !scripts.some((s) => /unpkg\.com\/lucide@latest/.test(s)), "", "page still loads unpkg lucide@latest");
  expect("vendor", "SheetJS from js/vendor/", scripts.some((s) => /js\/vendor\/xlsx-1\.2\.0\.bundle\.js$/.test(s)), "", "old xlsx path: " + (scripts.find((s) => /xlsx/i.test(s)) || "none"));

  if (page === "hub") {
    const P = W.BASE_PAGE || {};
    const n = Object.keys(P).length;
    expect("hub", "English keys (lang/en/project-core.js)", n >= 631 && !!P.colDiscipline && !!P.confirmRenameImpact, n + " keys", n + " keys (deploy lang/en/project-core.js)");
    const g = (name) => typeof W[name] === "function";
    expect("hub", "Models: discipline column (hub-models.js)", g("mvDisciplineCell") && g("mvSetDiscipline"), "", "hub-models.js is old");
    expect("hub", "Models: archive delete, admin rules", g("mvFedDelete") && g("mvAdminOr") && g("mvCanCreateFed"), "", "hub-models.js is old");
    expect("hub", "Files: rename safety (hub-files.js)", g("ftRenameImpact") && g("ftRenameApply"), "", "hub-files.js is old");
    expect("hub", "Access: issues folder from project.json (hub-access.js)", g("accAppFolders"), "", "hub-access.js is old");
    expect("hub", "Issues tab (hub-issues.js)", g("hubIssuesShow") && !!W.document.getElementById("tab-issues"), "", "hub-issues.js or the tab-issues panel missing (project-core.html)");
    try {
      const hm = await importer(url("../src/hub-bcf.js") + "?smoke=" + Date.now());
      expect("hub", "issues module (src/hub-bcf.js)", fn(hm, "createFileCore") && fn(hm, "initBcfBoard") && fn(hm, "createTopicDetail") && hm.BCF_HUB_BUILD >= 1,
        "build " + hm.BCF_HUB_BUILD, "exports missing (vite.config.js preserveEntrySignatures)");
    } catch (e) { failR("hub", "issues module (src/hub-bcf.js)", "not found: " + e.message + " (npm run build, copy dist/src)"); }
    let cur = null;
    try { cur = W.eval("typeof current !== 'undefined' ? current : null"); } catch (e) { cur = null; }
    if (cur && cur.manifest) {
      const m = cur.manifest;
      expect("hub", "project.json cdeBuild follows the core", !cde || m.cdeBuild === cde.CDE_BUILD, "cdeBuild " + m.cdeBuild, "cdeBuild " + m.cdeBuild + " (reload the hub once)");
      const mv = (m.apps && m.apps.model_viewer) || {};
      expect("hub", "project.json has federations + reports folders", !!mv.federations && !!mv.reports, mv.federations + " | " + mv.reports, "model_viewer folders missing");
      expect("hub", "project.json has the coordination issues folder", !!mv.issues, mv.issues, "apps.model_viewer.issues missing (reload the hub once)");
      if (cde && cde.paths) pass("hub", "folders created from project.json", cde.paths.structureDirs(m).map((p) => p.join("/")).filter((p) => p[0] !== ".").join(", "));
      pass("hub", "you are", (cur.isAdmin ? "admin" : "member") + " " + (cur.memberId || ""));
    } else skip("hub", "project checks", "no project open");
  }

  if (page === "viewer") {
    expect("viewer", "app helper (js/liteaeco-cde-app.js)", !!L.app && fn(L.app, "open"), "", "liteaeco-cde-app.js not loaded");
    const P = W.EN_PAGE || W.BASE_PAGE || {};
    expect("viewer", "English keys (lang/en/ifc-viewer-audit.js)", !!P.cdeSomeHidden && !!P.bcfNoLib, Object.keys(P).length + " keys", "keys missing (deploy lang/en/ifc-viewer-audit.js)");
    expect("viewer", "English fallback loaded in the page head (EN_PAGE)", !!W.EN_PAGE && Object.isFrozen(W.EN_PAGE), "", "ifc-viewer-audit.html is old (static lang/en script + EN_PAGE)");
    expect("viewer", "common.js: t(key, fallback, vars) + applyI18n", fn(W, "applyI18n") && W.t && W.t("__smoke_missing__", "ok {n}", { n: 1 }) === "ok 1", "", "js/common.js is old");
    const lang = (W.document.documentElement.lang || "en").toLowerCase();
    if (W.EN_PAGE && lang !== "en") {
      const cur = W.PAGE_I18N || {};
      const miss = Object.keys(W.EN_PAGE).filter((k) => !Object.prototype.hasOwnProperty.call(cur, k));
      (miss.length ? warn : pass)("viewer", "translation complete (" + lang + ")", miss.length
        ? miss.length + " key(s) shown in English: " + miss.slice(0, 12).join(", ") + (miss.length > 12 ? ", ..." : "")
        : Object.keys(cur).length + " keys");
    } else skip("viewer", "translation complete", "English is shown (switch language to check another one)");
    const picker = typeof W.__cooDisciplines === "function" ? W.__cooDisciplines() : null;
    if (picker) expect("viewer", "discipline picker: shared list, no role codes (main.js)", picker.length === 16 && !picker.some((d) => d.role), picker.length + " codes", picker.length + " codes, roles: " + picker.filter((d) => d.role).map((d) => d.code).join(" "));
    else warn("viewer", "discipline picker", "window.__cooDisciplines not found");
    expect("viewer", "leave-page guard", !!W.__appDirty && fn(W.__appDirty, "any"), "", "__appDirty missing");

    const resources = (W.performance && fn(W.performance, "getEntriesByType") ? W.performance.getEntriesByType("resource") : []).map((e) => e.name);
    const chunks = resources.filter((u) => /\/src\/ifc_(viewer_)?audit-[^/?]+\.js(\?|$)/.test(u));
    const isBuilt = chunks.length > 0 || !!W.document.querySelector('script[type="module"][src*="/src/ifc_"]');
    const chunkOf = (base) => chunks.find((u) => new RegExp("/src/ifc_(viewer_)?audit-" + base + "(-[A-Za-z0-9_-]{8})?\\.js(\\?|$)").test(u));
    const mod = async (f) => {
      const base = f.replace(/\.js$/, "");
      const u = isBuilt ? chunkOf(base) : url("../js/webifc/" + f);
      if (!u) return { __skip: true };
      try { return await importer(u); } catch (e) { return { __err: e }; }
    };
    const check = (m, name, cond, okD, badD) => (m && m.__skip
      ? skip("viewer", name, "bundled into another chunk or not loaded yet")
      : expect("viewer", name, cond, okD, m && m.__err ? "not found: " + m.__err.message : badD));
    pass("viewer", "page code", isBuilt ? "built bundle, " + chunks.length + " chunk(s) loaded" : "source modules (unbuilt page)");
    const ext = {};
    for (const f of ["ext_store", "ext_panel", "ext_infopanel", "ext_filter", "ext_match", "ext_textsource", "ext_excel", "ext_manage"]) ext[f] = await mod(f + ".js");
    const extLoaded = Object.values(ext).filter((m) => m && !m.__skip && !m.__err);
    const builds = extLoaded.map((m) => m.EXT_BUILD || 0);
    if (!extLoaded.length) skip("viewer", "ext_* modules same build", "External Data not loaded yet");
    else expect("viewer", "ext_* modules same build", builds.every((b) => b && b === builds[0]), "EXT_BUILD " + builds[0] + " (" + extLoaded.length + " loaded)", "builds " + builds.join("/") + " (replace all ext_ files together)");
    check(ext.ext_excel, "External Data: project file + no derived data (ext_excel.js)", fn(ext.ext_excel, "projectWorkbookBuffer") && fn(ext.ext_excel, "withoutSystemData"), "", "ext_excel.js is old");
    const cd = await mod("cls_decisions.js");
    check(cd, "clash decisions module (cls_decisions.js)", fn(cd, "initClsDecisions"), "", "old");
    const cl = await mod("cls_ltf.js");
    check(cl, "shared disciplines in clash (cls_ltf.js)", fn(cl, "ltfDisciplineMap") && fn(cl, "basenameCollisions"), "", "cls_ltf.js is old");
    const cs = await mod("cls_store.js");
    check(cs, "decision replay (cls_store.js)", fn(cs, "replayDecisions"), "", "cls_store.js is old");
    const rf = await mod("rel_file.js");
    check(rf, "relationships file (rel_file.js)", fn(rf, "buildRelationshipsWorkbook") && fn(rf, "readRelationshipsWorkbook"), "", "old");
    const bcl = W.__cooBcfCde;
    if (bcl) expect("viewer", "issues in the project folder (coo_bcf_cde.js)", bcl.BUILD >= 2, "build " + bcl.BUILD, "build " + bcl.BUILD + " (coo_bcf_cde.js is old)");
    else {
      const bc = await mod("coo_bcf_cde.js");
      check(bc, "issues in the project folder (coo_bcf_cde.js)", fn(bc, "initBcfCde") && bc.BCF_CDE_BUILD >= 2, "build " + bc.BCF_CDE_BUILD, "old");
    }
    const rp = await mod("rel_panel.js");
    check(rp, "relationships save after a run (rel_panel.js)", fn(rp, "saveRelationshipsFile"), "", "rel_panel.js is old");
    if (D && W.XLSX && fn(rf, "buildRelationshipsWorkbook")) {
      const probe = rf.buildRelationshipsWorkbook({ attributes: [{ id: "a", name: "Check", ifcClass: "IFCPIPESEGMENT", disciplineId: "d", groupId: "g", system: "rel" }],
        disciplines: [{ id: "d", name: "COO" }], groups: [{ id: "g", name: "S3 Pipe check" }],
        lists: { IFCPIPESEGMENT: { rows: { r: { modelId: "m.ifc", globalId: "G1", values: { a: "Pass" } } } } } }, W.XLSX);
      const back = probe && rf.readRelationshipsWorkbook(W.XLSX.write(probe.wb, { bookType: "xlsx", type: "array" }), W.XLSX);
      expect("viewer", "relationships workbook round trip (in memory)", back && back[0] && back[0].rows[0].values.Check === "Pass", "", "round trip failed");
    }
    const panel = W.__extOverlay && W.__extOverlay.panel;
    if (panel) {
      expect("viewer", "External Data panel: Save to project", fn(panel, "_saveCentral") && !!(panel.el && panel.el.btnSaveProject), "", "ext_panel.js is old");
      expect("viewer", "External Data panel: relationships read-back", fn(panel, "_loadRelationships") && fn(panel, "writeSystemRows"), "", "ext_panel.js is old");
    } else warn("viewer", "External Data panel", "window.__extOverlay not ready yet");

    const ctx = W.__cdeCtx;
    if (ctx) {
      pass("project", "opened", ctx.kind + " " + (ctx.path || ctx.openRel) + (ctx.readOnly ? " (view-only)" : ""));
      const need = ["disciplineFor", "dataFile", "relationshipsFile", "readFile", "hash", "writeFile", "appendEvents", "reportsFolder", "issuesFolder"];
      const miss = need.filter((k) => !fn(ctx, k));
      expect("project", "ctx functions (coo_cde.js)", !miss.length, need.length + " present", "missing: " + miss.join(", ") + " (coo_cde.js is old)");
      expect("project", "ctx access fields", typeof ctx.readOnly === "boolean" && typeof ctx.isAdmin === "boolean" && !!ctx.level, "readOnly " + ctx.readOnly + ", admin " + ctx.isAdmin, "readOnly / isAdmin / level missing");
      expect("project", "author from whoAmI", !!ctx.author && !/^device:unknown$/.test(ctx.author), ctx.author, "author " + ctx.author);
      if (ctx.kind === "federation" && fn(ctx, "dataFile")) {
        const df = ctx.dataFile(), rf2 = fn(ctx, "relationshipsFile") ? ctx.relationshipsFile("InheritFromRooms") : "";
        expect("project", "External Data file", /\/data\/[^/]+_ExternalData\.xlsx$/.test(df || ""), df, "dataFile: " + df);
        expect("project", "Relationships files (one per use case)", /\/data\/[^/]+_Relationships_InheritFromRooms\.xlsx$/.test(rf2 || ""), rf2.replace("InheritFromRooms", "<use case>"), "relationshipsFile: " + rf2 + " (coo_cde.js is old)");
        const logged = (ctx.logState && ctx.logState.disciplines) || {};
        const models = ctx.models || [];
        const noDisc = models.filter((m) => !ctx.disciplineFor(m.path)).map((m) => m.path.split("/").pop());
        if (noDisc.length) warn("project", "every model has a discipline", "none for: " + noDisc.join(", "));
        else pass("project", "every model has a discipline", models.map((m) => m.path.split("/").pop() + "=" + ctx.disciplineFor(m.path)).join(", "));
        pass("project", "disciplines recorded in the log", Object.keys(logged).length + " model(s)");
        if (fn(ctx, "canUpload")) {
          const folder = df.split("/").slice(0, -1).join("/");
          try { const can = await ctx.canUpload(folder); (can ? pass : warn)("project", "write access to " + folder, can ? "yes" : "no: External Data and relationships stay local"); }
          catch (e) { warn("project", "write access to " + folder, e.message); }
        }
      }
      const B = W.__cooBcfCde;
      if (B) {
        try { await B.ready(); } catch (e) {  }
        pass("project", "issues folder", B.folder + (B.canWrite ? " (write)" : " (see only: no upload right)"));
        const lo = fn(B, "localOnly") ? B.localOnly().length : 0;
        (lo ? warn : pass)("project", "issues only in this browser", lo ? lo + " (open Issue Management to publish)" : "none");
        const pend = fn(B, "pending") ? B.pending().length : 0;
        (pend ? warn : pass)("project", "issue saves pending", pend || "none");
      } else warn("project", "issues in the project folder", "window.__cooBcfCde missing (coo_bcf.js / coo_bcf_cde.js old, or the BCF core not ready yet)");
    } else skip("project", "project checks", "scratch mode (open a federation from the hub)");
  }
  if (page === "other") skip("page", "page", "open project-core.html or ifc-viewer-audit.html");

  const n = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
  rows.forEach((r) => n[r.status]++);
  const out = { page, when: new Date().toISOString(), summary: n, rows };
  W.__liteaecoSmoke = out;
  if (!opts.quiet) {
    (W.console.table ? W.console.table(rows) : W.console.log(rows));
    W.console.log(`%cliteAECO smoke (${page}): ${n.PASS} pass, ${n.FAIL} fail, ${n.WARN} warn, ${n.SKIP} skip`,
      "font-weight:bold;color:" + (n.FAIL ? "#dc2626" : n.WARN ? "#d97706" : "#059669"));
  }
  return out;
})(typeof window !== "undefined" ? window.__liteaecoSmokeOpts : undefined);
