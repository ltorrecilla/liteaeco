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
// liteAECO - (ifc_viewer_audit-coo_excel_info.js)
// ========

import{n as e,t}from"./ifc_viewer_audit-coo_project.js";function n(e){let t=Number(e);return!isFinite(t)||t<=0?``:t<1048576?(t/1024).toFixed(0)+` KB`:(t/1048576).toFixed(1)+` MB`}function r(){let t=window.__cooProject,r=t?.getInfo?.()||{};t?.ensureGuid&&(r.number||r.title||r.client||r.address||r.type)&&(r.guid=t.ensureGuid()||r.guid);let i=window.__cooModels?.list?.()||[],a=e=>e&&String(e).trim()?String(e).trim():`-`,o=[[`--- PROJECT ---`,``],[e.number,a(r.number)],[e.title,a(r.title)],[e.client,a(r.client)],[e.address,a(r.address)],[e.type,a(r.type)],[e.guid,a(r.guid)],[``,``]],s=t?.getMeId?.()||``,c=s?(t?.listContacts?.()||[]).find(e=>e.id===s):null;o.push([`Exported by:`,c?c.name+(c.mail?` <`+c.mail+`>`:``):`-`]),o.push([`Export date:`,new Date().toISOString().replace(`T`,` `).slice(0,16)]),o.push([``,``]);for(let e of t?.expectedModelRows?.()||[])o.push(e);o.push([`Models in project`,``]),o.push([`File name`,`Discipline | Size | Schema`]);for(let e of i)o.push([e.fileName||``,[String(e.tag||`-`).toUpperCase(),n(e.size)||`-`,e.schema||`-`].join(` | `)]);return i.length||o.push([`(no models loaded)`,``]),o.push([``,``]),o}function i(e,n){if(!e||!n||e.Sheets.CONTACTS)return e;let r=window.__cooProject,i=r?.listContacts?.({includeArchived:!0})||[],a=r?.contactToRow?e=>r.contactToRow(e):e=>{let n=Array(t.length).fill(`-`);return n[0]=e.id||`-`,n[3]=e.name||`-`,n[4]=e.company||`-`,n[6]=e.role||`-`,n[7]=(e.disciplines||e.teams||[]).join(`, `)||`-`,n[8]=e.mail||`-`,n[28]=`No`,n[30]=`Active`,n},o=[t.slice()];for(let e of i)o.push(a(e));let s=n.utils.aoa_to_sheet(o);return s[`!cols`]=t.map((e,t)=>t===0?{wch:38}:t===3?{wch:24}:t===8||t===12?{wch:28}:t===4||t===6||t===7?{wch:22}:{wch:Math.max(10,e.length+2)}),n.utils.book_append_sheet(e,s,`CONTACTS`),e}export{r as n,i as t};