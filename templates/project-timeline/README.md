# Project Timeline – Templates

Start files for `Project_Timeline.html`.
Community contributions welcome.

## Layout

```
templates/Project_Timeline/
  schema.json          JSON Schema (validation)
  build-templates.js   bundler → templates.js
  templates.js             GENERATED – loaded by the app
  README.md
  en/                  locale folders
    office-move.json
  de-ch/
  fr-ch/
```

- One folder per locale: `en`, `de`, `de-ch`, `fr-ch`, …
- One file per template. Filename = `template.id`.
- Localized templates are **not translations**.
  Swiss SIA phases ≠ RIBA ≠ HOAI. Author local content.

## File format

Same as a `.timeline.json` save file, plus a header.
Runtime fields removed.

```json
{
  "app": "liteAECO-timeline",
  "kind": "template",
  "schema": 2,
  "template": {
    "id": "office-move",
    "version": "1.0.0",
    "locale": "en",
    "country": "",
    "name": "Office Move & Relocation",
    "category": "generic",
    "description": "One-line summary.",
    "author": "Your name / org",
    "license": "CC-BY-4.0",
    "source": "https://github.com/...",
    "minAppSchema": 2
  },
  "durationMode": "working",
  "calendar": { "workweek": [false,true,true,true,true,true,false], "holidays": [] },
  "meta": { "title": "OFFICE MOVE", "number": "", "client": "", "address": "", "type": "" },
  "timeline": { "phases": [...], "tasks": [...] }
}
```

### Rules

| Field | Rule |
|---|---|
| `app` | must be `liteAECO-timeline` |
| `kind` | must be `template` |
| `template.id` | kebab-case, equals filename |
| `template.locale` | equals folder name |
| `template.version` | semver `x.y.z` |
| `template.category` | `generic` `bim` `preproject` `construction` `renovation` `infrastructure` |
| `meta.guid` | **not allowed** – minted on load |
| `timeline.startDate` | **not allowed** – set on load |
| task `ES EF LS LF TF isCritical` | **not allowed** – computed |
| task `start` | day offset from project start |

## Contribute

1. Build your plan in the app.
2. File → Export as template.
3. Edit header fields.
4. Save to `<locale>/<id>.json`.
5. Run `node build-templates.js --check`.
6. Open a pull request.

CI rebuilds `templates.js` on merge.

## Build

```
node templates/Project_Timeline/build-templates.js
```
