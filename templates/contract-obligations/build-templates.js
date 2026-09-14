/**
 * liteAECO – Contract Obligations
 * Regenerates dictionaries.json (catalogue) and contract-templates.js (offline
 * bundle) from every *.json dictionary in this folder.
*
 * Never edit dictionaries.json or contract-templates.js by hand.
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const MANIFEST = 'dictionaries.json';
const BUNDLE = 'contract-templates.js';
const DEFAULT_ID = process.env.DEFAULT_DICT || 'de-CH';

const APP = 'liteAECO-contract-dictionary';
const KNOWN_FIELDS = ['landlord', 'tenant', 'address', 'purpose', 'area', 'netRent',
    'totalRent', 'serviceCharges', 'deposit', 'vatNumber', 'vat', 'startDate',
    'term', 'noticePeriod', 'exclusivity', 'sublease'];

function validate(d, file) {
    const e = [];
    if (!d || typeof d !== 'object') e.push('not an object');
    else {
        if (d.app !== APP) e.push(`"app" must be "${APP}"`);
        if (d.schema !== 1) e.push(`unsupported schema ${d.schema}`);
        if (!d.id) e.push('missing "id"');
        if (!d.name) e.push('missing "name"');
        if (!Array.isArray(d.fields)) e.push('"fields" must be an array');
        else d.fields.forEach((f, i) => {
            if (!KNOWN_FIELDS.includes(f.id)) e.push(`fields[${i}]: unknown id "${f.id}"`);
            if (!f.pattern) e.push(`fields[${i}] (${f.id}): missing "pattern"`);
            else { try { new RegExp(f.pattern, (f.flags || '') + 'g'); } catch (err) { e.push(`fields[${i}] (${f.id}): bad regex – ${err.message}`); } }
            if (f.fallback) { try { new RegExp(f.fallback, (f.flags || '') + 'g'); } catch (err) { e.push(`fields[${i}] (${f.id}): bad fallback regex – ${err.message}`); } }
        });
        if (d.id && path.basename(file, '.json') !== d.id) e.push(`filename should be ${d.id}.json`);
    }
    return e;
}

const files = fs.readdirSync(DIR)
    .filter(f => f.endsWith('.json') && f !== MANIFEST)
    .sort();

if (!files.length) { console.error('No dictionary *.json files found in ' + DIR); process.exit(1); }

const dicts = [];
let failed = 0;

for (const f of files) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
    catch (err) { console.error(`✗ ${f}: invalid JSON – ${err.message}`); failed++; continue; }
    const errs = validate(d, f);
    if (errs.length) { console.error(`✗ ${f}:\n   - ` + errs.join('\n   - ')); failed++; continue; }
    dicts.push({ file: f, d });
    console.log(`✓ ${f}  (${d.fields.length} fields, ${(d.clauses || []).length} clauses, ${(d.baselines || []).length} baselines)`);
}

if (!dicts.length) { console.error('\nNothing valid to build.'); process.exit(1); }

const def = dicts.some(x => x.d.id === DEFAULT_ID) ? DEFAULT_ID : dicts[0].d.id;

const manifest = {
    app: 'liteAECO-contract-dictionaries',
    schema: 1,
    generated: new Date().toISOString(),
    default: def,
    dictionaries: dicts.map(({ file, d }) => ({
        id: d.id,
        file,
        name: d.name,
        language: d.language || '',
        country: d.country || '',
        category: d.category || 'General',
        description: d.description || '',
        author: d.author || '',
        license: d.license || '',
        source: d.source || '',
        version: d.version != null ? d.version : 1,
        tags: Array.isArray(d.tags) ? d.tags : [],
        counts: {
            fields: d.fields.length,
            clauses: (d.clauses || []).length,
            baselines: (d.baselines || []).length
        }
    }))
};

fs.writeFileSync(path.join(DIR, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');

const bundle =
    '// liteAECO – Contract Obligations dictionaries (offline bundle)\n' +
    '// GENERATED FILE – do not edit. Run: node build-templates.js\n' +
    '// Loaded as a plain <script> and used only when fetch() is blocked,\n' +
    '// i.e. when the tool is opened directly from disk (file://).\n' +
    'window.LITEAECO_CONTRACT_DICTS = ' + JSON.stringify({
        default: def,
        dictionaries: dicts.map(x => x.d)
    }, null, 2) + ';\n';

fs.writeFileSync(path.join(DIR, BUNDLE), bundle);

console.log(`\nWrote ${MANIFEST} and ${BUNDLE} – ${dicts.length} dictionary/ies, default "${def}".`);
if (failed) { console.error(`${failed} file(s) skipped.`); process.exit(1); }
