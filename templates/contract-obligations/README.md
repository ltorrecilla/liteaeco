# Contract Obligations — dictionaries

Dictionaries teach the **Contract Obligations** tool how to read a contract in one
language and jurisdiction. One file = one language/jurisdiction. All keys are
English so anyone can adapt them.

They are plain JSON. No build step is needed to write one, and you can test it in
the browser before opening a pull request.

---

## Files in this folder

| File | What it is |
|---|---|
| `de-CH.json`, `en-GB.json`, … | The dictionaries. **Edit these.** |
| `dictionaries.json` | Catalogue the tool fetches first. Lists every dictionary with the metadata shown in the picker. **Generated.** |
| `contract-templates.js` | Offline bundle. Used only when the tool is opened from disk (`file://`), where `fetch()` is blocked. **Generated.** |
| `build-templates.js` | Regenerates the two generated files. |
| `README.md` | This file. |

The tool loads `dictionaries.json` on startup and fetches a dictionary file only
when it is selected, so adding many dictionaries does not slow the page down.

---

## Adding a dictionary

1. Copy the closest existing file to `<id>.json`. The filename must match the `id`.
2. Edit it (see the reference below).
3. Run the build:
   ```bash
   node build-templates.js
   ```
   This validates every file, then rewrites `dictionaries.json` and
   `contract-templates.js`. It refuses to build if a regex is broken or a field
   id is unknown.
4. Commit all changed files, including the two generated ones.

To test without a build, open the tool, use **Import dictionary** and pick your
JSON file. If it loads and analyses correctly, it will pass the build.

> The tool must be served over `http://` or `https://`. Opening the HTML file
> directly from disk works only because of `contract-templates.js`.

---

## Top-level keys

| Key | Required | Meaning |
|---|---|---|
| `app` | yes | Must be `"liteAECO-contract-dictionary"`. Identifies the file. |
| `schema` | yes | Dictionary format version. Currently `1`. |
| `id` | yes | Unique short id, e.g. `de-CH`, `en-GB`, `fr-CH`. Must match the filename. |
| `name` | yes | Shown in the dictionary picker. |
| `fields` | yes | Structured values extracted into cards. See below. |
| `savedAt` | no | ISO timestamp, set on export. Ignored when comparing dictionaries. |
| `version` | no | Your revision number. Defaults to `1`. |
| `language`, `country` | no | ISO codes, e.g. `de` / `CH`. Drives the language filter in the picker. |
| `category` | no | Grouping in the picker, e.g. `Commercial lease`. Defaults to `General`. |
| `description` | no | One or two sentences shown on the picker card. |
| `author`, `license`, `source` | no | Credit and provenance. Shown on the card. |
| `tags` | no | Array of keywords. Searched by the picker, so put domain terms here. |
| `defaults` | no | Config applied when the dictionary is selected. See below. |
| `tocHeaders` | no | Lines that mark a table of contents. The block after them is removed before analysis. |
| `clauses` | no | Keywords highlighted blue (clause heatmap). Word boundary at start, case-insensitive. |
| `baselines` | no | Keywords highlighted purple (baseline / REFM check). |
| `coreAudit` | no | Baselines that MUST appear. Missing ones are listed in red. |

### `defaults`

| Key | Meaning |
|---|---|
| `currency` | e.g. `CHF`, `GBP`. |
| `dateLocale` | `dach`, `us`, `uk` or `iso`. Picks the date regex. |
| `vatRate` | Percentage, e.g. `8.1`. |
| `rentPeriod` | `monthly` or `annual` — how rent figures are stated in this jurisdiction. |
| `highlightDates`, `highlightClauses`, `highlightBaselines` | Booleans. Initial toggle state. |

---

## `fields`

Order matters: it is the evaluation order. **Field ids are fixed by the app** —
you may reorder, relabel or omit them, but you cannot invent new ones.

```
landlord, tenant, address, purpose, area, netRent, totalRent, serviceCharges,
deposit, vatNumber, vat, startDate, term, noticePeriod, exclusivity, sublease
```

| Key | Meaning |
|---|---|
| `id` | One of the fixed ids above. |
| `label` | Label used on the card, in exports and in dropdowns. |
| `description` | Free text for humans. Ignored by the app. |
| `type` | `text`, `money`, `number`, `date`, `area` or `flag`. Drives the derived panel. |
| `pattern` | JavaScript regex as a JSON string. Escape backslashes: `\\d`, not `\d`. |
| `flags` | Regex flags. `i` ignore case, `m` `^` matches line start, `s` dot matches newline. `g` is added automatically. |
| `group` | Capture group index to keep. `0` = whole match. |
| `fallback` | Second pattern, tried only when `pattern` finds nothing. |
| `suffix` | Text appended on the card, e.g. `" CHF"`. |
| `maxLen` | Truncate the displayed value. |
| `yes` / `no` | `flag` type only: text shown when found / not found. |

Example:

```json
{
  "id": "deposit",
  "label": "Kaution (CHF)",
  "type": "money",
  "description": "First CHF amount after Mietzinsdepot / Kaution. Same line.",
  "pattern": "(?:Mietzinsdepot|Kaution|Sicherheit)[^\\n]*?(?:CHF|Fr\\.)\\s*([\\d\\.']+)",
  "flags": "i",
  "group": 1,
  "suffix": " CHF"
}
```

---

## Regex cheat sheet

Remember every backslash is doubled inside JSON.

| Goal | Pattern | Captures |
|---|---|---|
| Money | `(?:CHF\|Fr\\.)\\s*([\\d'’.,]+)` | `3'600.00` |
| Money (GBP) | `(?:£\|GBP)\\s*([\\d,\\.]+)` | `45,000` |
| Date | `(\\d{1,2}\\.\\d{1,2}\\.\\d{2,4})` | `01.06.2026` |
| ISO date | `(\\d{4}-\\d{2}-\\d{2})` | `2026-06-01` |
| Number + unit | `(\\d+)\\s*(?:Jahr\|Jahre)` | `5` |
| Area | `([\\d'.]+)\\s*(?:m2\|m²)` | `120` |
| Rest of line | `Keyword[: \\t]*([^\\n]+)` | everything after the keyword |
| Whole sentence | `Keyword[^.]*\\.?` with `"group": 0` | the sentence |
| Same line only | use `[^\\n]` instead of `.` or `\\s` | — |
| Start of line | `^Keyword` with flags `"im"` | — |
| Nearest match after a keyword | `Keyword.*?CHF` | lazy skip |

Common mistakes:

- Writing `\d` instead of `\\d`. The JSON parser eats the single backslash.
- Using `.*` across lines and swallowing half the contract. Use `[^\n]*`.
- Forgetting that `Mieter` also matches inside `Vermieter`. Anchor or use case
  sensitivity, as `de-CH.json` does.
- Setting `"group": 1` on a pattern with no capture group.

---

## Licensing

Dictionaries contributed here are published under the licence named in their
`license` key. If you copy wording from a commercial source, say so in `source`
and make sure you have the right to redistribute it.
