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
// liteAECO - (ifc_viewer_audit-rel_file.js)
// ========

var e=`REL_META`,t=[{scenario:`s1`,group:`S1 Opening usage`,suffix:`OpeningUsage`},{scenario:`s3`,group:`S3 Pipe check`,suffix:`WallOpeningCheck`},{scenario:`s2`,group:`Inherit attributes`,suffix:`InheritAttributes`},{scenario:`s4`,group:`S4 Inherit from rooms`,suffix:`InheritFromRooms`},{scenario:`s5`,group:`S5 Inject into rooms`,suffix:`InjectIntoRooms`}];function n(e){return t.find(t=>t.scenario===e)||null}function r(e,t){let n=String(e||`Sheet`).replace(/[\\/?*[\]:]/g,` `).replace(/\s+/g,` `).trim().slice(0,31)||`Sheet`,r=2;for(;t.has(n.toUpperCase());){let e=` `+r++;n=n.slice(0,31-e.length)+e}return t.add(n.toUpperCase()),n}function i(e){let t=(e.attributes||[]).filter(e=>e&&e.system===`rel`),n=new Map((e.disciplines||[]).map(e=>[e.id,e.name])),r=new Map((e.groups||[]).map(e=>[e.id,e.name])),i=new Map;for(let e of t){let t=e.ifcClass+``+e.groupId;i.has(t)||i.set(t,{ifcClass:e.ifcClass,discipline:n.get(e.disciplineId)||`COO`,group:r.get(e.groupId)||``,attrs:[]}),i.get(t).attrs.push(e)}let a=[];for(let t of i.values()){let n=(e.lists||{})[t.ifcClass],r=[];for(let e of Object.values(n&&n.rows||{})){let n=e.values||{};if(!t.attrs.some(e=>n[e.id]!==void 0&&n[e.id]!==``))continue;let i={};for(let e of t.attrs)i[e.name]=n[e.id]??``;r.push({guid:e.globalId||e.key,modelFileName:e.modelId||``,values:i})}r.length&&a.push({ifcClass:t.ifcClass,discipline:t.discipline,group:t.group,columns:t.attrs.map(e=>e.name),rows:r})}return a.sort((e,t)=>e.group+e.ifcClass<t.group+t.ifcClass?-1:1)}function a(t,n,a={},o={}){let s=Array.isArray(o.groups)?new Set(o.groups):null,c=i(t).filter(e=>!s||s.has(e.group));if(!c.length)return null;let l=n.utils.book_new(),u=new Set([`REL_META`]),d={version:1,federation:a.federation||``,generatedAt:a.generatedAt||new Date().toISOString(),author:a.author||``,sheets:[]};for(let e of c){let t=r(e.group+` `+e.ifcClass,u),i=[[`GlobalId`,`Model`,...e.columns]];for(let t of e.rows)i.push([t.guid,t.modelFileName,...e.columns.map(e=>t.values[e]??``)]);let a=n.utils.aoa_to_sheet(i);a[`!cols`]=[{wch:24},{wch:28},...e.columns.map(()=>({wch:16}))],n.utils.book_append_sheet(l,a,t),d.sheets.push({sheet:t,ifcClass:e.ifcClass,discipline:e.discipline,group:e.group,columns:e.columns})}return n.utils.book_append_sheet(l,n.utils.aoa_to_sheet([[JSON.stringify(d)]]),e),l.Workbook=l.Workbook||{},l.Workbook.Sheets=l.SheetNames.map(e=>({name:e,Hidden:+(e===`REL_META`)})),{wb:l,blocks:c.length,rows:c.reduce((e,t)=>e+t.rows.length,0)}}function o(t,n){let r=n.read(t,{type:`array`}),i=r.Sheets[e];if(!i)return[];let a=null;try{a=JSON.parse(String(i.A1&&i.A1.v||``))}catch{return[]}let o=[];for(let e of a&&a.sheets||[]){let t=r.Sheets[e.sheet];if(!t||!e.ifcClass||!Array.isArray(e.columns))continue;let i=n.utils.sheet_to_json(t,{header:1,defval:``}),a=i[0]||[],s=e.columns.map(e=>a.indexOf(e)),c=[];for(let t of i.slice(1)){if(!t[0])continue;let n={};e.columns.forEach((e,r)=>{s[r]>=0&&(n[e]=t[s[r]])}),c.push({guid:String(t[0]),modelFileName:String(t[1]||``),values:n})}c.length&&o.push({ifcClass:e.ifcClass,discipline:e.discipline||`COO`,group:e.group,columns:e.columns,rows:c})}return o}export{n as i,a as n,o as r,t};