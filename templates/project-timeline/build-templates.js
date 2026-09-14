/**
 * liteAECO – Project Timeline template
 *
 * Reads every  <locale>/<id>.json  under this folder,
 * validates the header, strips runtime fields,
 * writes  templates.js  (single script tag, file:// safe).
*
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "templates.js");
const CHECK = process.argv.includes("--check");

const RUNTIME_TASK_KEYS = ["ES", "EF", "LS", "LF", "TF", "isCritical"];
const CATEGORIES = ["generic", "bim", "preproject", "construction", "renovation", "infrastructure"];

const errors = [];
const templates = [];

function fail(file, msg) { errors.push(`${file}: ${msg}`); }

function validate(file, t) {
  if (t.app !== "liteAECO-timeline") fail(file, 'app must be "liteAECO-timeline"');
  if (t.kind !== "template") fail(file, 'kind must be "template"');
  if (!Number.isInteger(t.schema) || t.schema < 2) fail(file, "schema must be integer >= 2");
  const h = t.template || {};
  for (const k of ["id", "version", "locale", "name", "category", "author", "minAppSchema"])
    if (h[k] === undefined || h[k] === "") fail(file, `template.${k} missing`);
  if (h.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(h.id)) fail(file, "template.id must be kebab-case");
  if (h.version && !/^\d+\.\d+\.\d+$/.test(h.version)) fail(file, "template.version must be semver");
  if (h.locale && !/^[a-z]{2}(-[a-z]{2})?$/.test(h.locale)) fail(file, "template.locale invalid");
  if (h.category && !CATEGORIES.includes(h.category)) fail(file, `template.category not in ${CATEGORIES.join("|")}`);
  const dir = path.basename(path.dirname(file));
  if (h.locale && h.locale !== dir) fail(file, `template.locale "${h.locale}" != folder "${dir}"`);
  if (h.id && path.basename(file, ".json") !== h.id) fail(file, `filename != template.id "${h.id}"`);
  if (!["calendar", "working"].includes(t.durationMode)) fail(file, "durationMode invalid");
  if (t.meta && t.meta.guid) fail(file, "meta.guid must not be present");
  const tl = t.timeline || {};
  if (!Array.isArray(tl.phases) || !tl.phases.length) fail(file, "timeline.phases empty");
  if (!Array.isArray(tl.tasks)) fail(file, "timeline.tasks missing");
  if (tl.startDate !== undefined) fail(file, "timeline.startDate must not be present");
  const phaseIds = new Set((tl.phases || []).map(p => p.id));
  const taskIds = new Set((tl.tasks || []).map(x => x.id));
  for (const task of tl.tasks || []) {
    if (!phaseIds.has(task.phaseId)) fail(file, `task ${task.id}: unknown phaseId ${task.phaseId}`);
    for (const d of task.dependsOn || []) {
      const id = typeof d === "string" ? d : d && d.id;
      if (!taskIds.has(id)) fail(file, `task ${task.id}: unknown dependency ${id}`);
    }
    for (const k of RUNTIME_TASK_KEYS) if (k in task) fail(file, `task ${task.id}: runtime key ${k}`);
  }
}

function clean(t) {
  const c = JSON.parse(JSON.stringify(t));
  delete c.savedAt;
  if (c.meta) delete c.meta.guid;
  if (c.timeline) {
    delete c.timeline.startDate;
    delete c.timeline.displayTitle;
    c.timeline.tasks = (c.timeline.tasks || []).map(task => {
      for (const k of RUNTIME_TASK_KEYS) delete task[k];
      return task;
    });
  }
  return c;
}

for (const locale of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!locale.isDirectory()) continue;
  const dir = path.join(ROOT, locale.name);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const file = path.join(dir, f);
    let data;
    try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { fail(file, `invalid JSON – ${e.message}`); continue; }
    validate(file, data);
    templates.push(clean(data));
  }
}

const seen = new Set();
for (const t of templates) {
  const key = `${t.template.locale}/${t.template.id}`;
  if (seen.has(key)) fail(key, "duplicate locale/id");
  seen.add(key);
}

if (errors.length) {
  console.error("Template validation failed:\n  " + errors.join("\n  "));
  process.exit(1);
}

templates.sort((a, b) =>
  a.template.locale.localeCompare(b.template.locale) ||
  a.template.category.localeCompare(b.template.category) ||
  a.template.name.localeCompare(b.template.name));

if (CHECK) {
  console.log(`OK – ${templates.length} template(s) valid`);
  process.exit(0);
}

const banner =
`/* liteAECO – Project Timeline templates (GENERATED – do not edit)
 * Built ${new Date().toISOString()} from ${templates.length} JSON file(s).
 * Rebuild:  node templates/Project_Timeline/build-templates.js
 */
`;
const body =
`(function (g) {
  g.LITEAECO_TEMPLATES = g.LITEAECO_TEMPLATES || {};
  g.LITEAECO_TEMPLATES["Project_Timeline"] = ${JSON.stringify(templates, null, 0)};
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(OUT, banner + body);
console.log(`Wrote ${path.relative(process.cwd(), OUT)} – ${templates.length} template(s)`);
