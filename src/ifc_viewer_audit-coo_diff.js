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
// liteAECO - (ifc_viewer_audit-coo_diff.js)
// ========

import{c as e,d as t,l as n,u as r}from"./ifc_viewer_audit-script.js";var i=new Set([`IFCPROJECT`,`IFCPROPERTYSET`,`IFCELEMENTQUANTITY`,`IFCPROPERTYSETDEFINITIONSET`]);function a(e){if(!e?.type||e.type.startsWith(`IFCREL`)||i.has(e.type))return!1;let t=r(e.argsString)[0];return!!(t&&t[0]===`'`&&t.length===24)}function o(i){let{entities:o,allRels:s}=t(i),c=new Map;for(let e of s){let t=o.get(e);if(!t)continue;let i=r(t.argsString);if(i.length<6)continue;let a=i[4].replace(/[()]/g,``).split(`,`).map(e=>parseInt(e.replace(/[^0-9]/g,``))).filter(e=>!isNaN(e)),s=parseInt(i[5].replace(/[^0-9]/g,``)),l=o.get(s),u=[];if(l){if(l.type===`IFCPROPERTYSET`||l.type===`IFCELEMENTQUANTITY`)u.push(l);else if(l.type===`IFCPROPERTYSETDEFINITIONSET`){let e=r(l.argsString);e.length>=1&&e[0].replace(/[()]/g,``).split(`,`).map(e=>parseInt(e.replace(/[^0-9]/g,``))).filter(e=>!isNaN(e)).forEach(e=>{let t=o.get(e);t&&(t.type===`IFCPROPERTYSET`||t.type===`IFCELEMENTQUANTITY`)&&u.push(t)})}}if(!u.length)continue;let d=[];for(let e of u){let t=r(e.argsString),i=t[2]?t[2].replace(/^'|'$/g,``):``,a=n(e,i,o);for(let[e,t]of Object.entries(a))d.push(`${e}=${t}`)}if(d.length)for(let e of a)c.has(e)||c.set(e,[]),c.get(e).push(...d)}let l=new Map;for(let[t,n]of o){if(!a(n))continue;let r=e(n),i=r[`Attributes:::GlobalId`];if(!i)continue;let o=r[`Attributes:::Name`]||``,s=[];for(let[e,t]of Object.entries(r))e!==`Attributes:::GlobalId`&&s.push(`${e}=${t}`);s.push(...c.get(t)||[]),s.sort(),l.set(i,{cls:n.type,name:o,sig:s.join(``),lines:s})}return l}function s(e,t){let n=[],r=[],i=[],a=0;for(let[r,o]of t){let t=e.get(r);if(!t){n.push({guid:r,cls:o.cls,name:o.name});continue}if(t.sig===o.sig){a++;continue}let s=e=>{let t=new Map;for(let n of e){let e=n.indexOf(`=`);t.set(n.slice(0,e),n.slice(e+1))}return t},c=s(t.lines),l=s(o.lines),u=[],d=new Set([...c.keys(),...l.keys()]);for(let e of d){let t=c.has(e)?c.get(e):null,n=l.has(e)?l.get(e):null;if(t!==n&&(u.push({path:e,a:t,b:n}),u.length>=25))break}i.push({guid:r,cls:o.cls,name:o.name||t.name,changes:u,truncated:u.length>=25})}for(let[n,i]of e)t.has(n)||r.push({guid:n,cls:i.cls,name:i.name});let o=e=>{let t={};for(let n of e)t[n.cls]=(t[n.cls]||0)+1;return t};return{added:n,removed:r,modified:i,counts:{added:n.length,removed:r.length,modified:i.length,unchanged:a},byClass:{added:o(n),removed:o(r),modified:o(i)}}}async function c(e,t,{onProgress:n}={}){n?.(`Parsing A: ${e.name}`);let r=o(await e.text());n?.(`Parsing B: ${t.name}`);let i=o(await t.text());n?.(`Comparing…`);let a=s(r,i);return a.a={fileName:e.name,elements:r.size},a.b={fileName:t.name,elements:i.size},n?.(``),a}var l=()=>window.__cooModels?.ghostMaterial?.(.05)||{color:`#ffffff`,opacity:.05,transparent:!0,renderedFaces:1,depthTest:!0,depthWrite:!1},u=e=>window.__cooModels?.material?.({color:e,opacity:1,transparent:!1,renderedFaces:1,depthTest:!0,depthWrite:!0})||{color:e,opacity:1,transparent:!1,renderedFaces:1},d=`#16a34a`,f=`#dc2626`,p=`#eab308`;function m(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}async function h(e){let t=await e.getItemsOfCategories([/^IFC/i]);return Object.values(t||{}).flat()}async function g(e,t){if(!t.length)return[];try{if(typeof e.getLocalIdsByGuids==`function`)return(await e.getLocalIdsByGuids(t)||[]).filter(e=>e!=null)}catch(e){console.warn(`[coo-diff] getLocalIdsByGuids failed`,e)}return[]}var _=null;async function v(){if(_){for(let{model:e,ids:t}of _.entries)try{typeof e.resetHighlight==`function`&&await e.resetHighlight(t)}catch(e){console.warn(`[coo-diff] resetHighlight failed`,e)}_=null,window.__cooModels?.refresh?.()}}async function y(e,t,n){let r=window.__cooModels,i=r?.raw?.(t),a=r?.raw?.(n);if(!i?.model||!a?.model)return!1;await v();let o=i.model,s=a.model,c=await h(o),m=await h(s),y=e.modified.map(e=>e.guid),[b,x,S,C]=await Promise.all([g(o,e.removed.map(e=>e.guid)),g(s,e.added.map(e=>e.guid)),g(o,y),g(s,y)]),w=async(e,t,n)=>{if(t.length&&typeof e.highlight==`function`)try{await e.highlight(t,n)}catch(e){console.warn(`[coo-diff] highlight failed`,e)}},T=l();return await w(o,c,T),await w(s,m,T),await w(o,b,u(f)),await w(s,x,u(d)),await w(o,S,u(p)),await w(s,C,u(p)),_={entries:[{model:o,ids:c},{model:s,ids:m}]},r.refresh?.(),!0}var b=(e,t,n)=>typeof window<`u`&&typeof window.t==`function`?window.t(e,t,n):n?String(t).replace(/\{(\w+)\}/g,(e,t)=>n[t]==null?e:String(n[t])):t;function x(){let e=window.__cooModels,t=e?.list?.()||[];if(t.length<2){alert(b(`diffNeedTwo`,`Load at least two models (IFC Coordination mode) to compare.`));return}document.getElementById(`coo-diff-dialog`)?.remove();let n=e=>t.map((t,n)=>`<option value="${m(t.id)}" ${n===(e===`a`?0:1)?`selected`:``}>${m(t.fileName)}${t.tag?` [`+t.tag+`]`:``}</option>`).join(``),r=document.createElement(`div`);r.id=`coo-diff-dialog`,r.className=`fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40`,r.innerHTML=`
    <div class="bg-white rounded-xl shadow-2xl w-[720px] max-w-[95vw] max-h-[88vh] flex flex-col">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div class="text-sm font-bold text-slate-700">${m(b(`diffTitle`,`Compare models`))}</div>
        <button data-close class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700">&times;</button>
      </div>
      <div class="px-4 py-3 flex items-center gap-2 border-b border-slate-100 shrink-0 text-xs">
        <span class="font-semibold text-slate-500">A</span>
        <select data-a class="flex-1 min-w-0 bg-white border border-slate-300 rounded p-1 text-xs">${n(`a`)}</select>
        <span class="text-slate-400">${m(b(`diffVs`,`vs`))}</span>
        <span class="font-semibold text-slate-500">B</span>
        <select data-b class="flex-1 min-w-0 bg-white border border-slate-300 rounded p-1 text-xs">${n(`b`)}</select>
        <button data-run class="px-3 py-1.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700">${m(b(`diffCompare`,`Compare`))}</button>
      </div>
      <div data-status class="px-4 py-1 text-[11px] text-slate-400 shrink-0"></div>
      <div data-results class="flex-1 min-h-0 overflow-y-auto px-4 py-3 hidden"></div>
      <div class="px-4 py-2 border-t border-slate-100 shrink-0 flex items-center justify-between text-xs">
        <span class="text-slate-400">${m(b(`diffLegend`,`Yellow = changed · Red = removed (only in A) · Green = new (only in B)`))}</span>
        <button data-clear class="px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50" disabled>${m(b(`diffClear3d`,`Clear 3D colors`))}</button>
      </div>
    </div>`,document.body.appendChild(r);let i=e=>r.querySelector(e),a=()=>{r.remove()};i(`[data-close]`).addEventListener(`click`,a),r.addEventListener(`click`,e=>{e.target===r&&a()}),document.addEventListener(`keydown`,function e(t){t.key===`Escape`&&(a(),document.removeEventListener(`keydown`,e))}),i(`[data-clear]`).addEventListener(`click`,async()=>{await v(),i(`[data-clear]`).disabled=!0}),i(`[data-run]`).addEventListener(`click`,async()=>{let t=i(`[data-a]`).value,n=i(`[data-b]`).value;if(t===n){i(`[data-status]`).textContent=b(`diffPickTwo`,`Pick two different models.`);return}let r=e.raw(t),a=e.raw(n);if(!r?.file||!a?.file){i(`[data-status]`).textContent=b(`diffNoFile`,`File contents unavailable for one of the models (loaded from .frag?).`);return}i(`[data-run]`).disabled=!0;try{let e=await c(r.file,a.file,{onProgress:e=>{i(`[data-status]`).textContent=e}});o(i(`[data-results]`),e,t,n),i(`[data-results]`).classList.remove(`hidden`),i(`[data-status]`).textContent=b(`diffCounts`,`{a} elements in A, {b} in B.`,{a:e.a.elements,b:e.b.elements});let s=await y(e,t,n);i(`[data-clear]`).disabled=!s}catch(e){console.error(`[coo-diff] compare failed`,e),i(`[data-status]`).textContent=b(`diffFailed`,`Compare failed: {msg}`,{msg:e?.message||e})}finally{i(`[data-run]`).disabled=!1}});function o(t,n,r,i){let a=(e,t,n)=>`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${n}">${e} ${t}</span>`,o=(e,t,n,r)=>{let i=t.slice(0,500).map((e,t)=>`
        <div class="flex items-center gap-2 px-2 py-1 text-xs border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
          data-kind="${n}" data-i="${t}">
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${r}"></span>
          <span class="text-[10px] text-slate-400 shrink-0 w-28 truncate">${m(e.cls)}</span>
          <span class="flex-1 min-w-0 truncate font-medium text-slate-700">${m(e.name||b(`diffUnnamed`,`(unnamed)`))}</span>
          ${n===`modified`?`<span class="text-[10px] text-slate-400 shrink-0">${m(b(`diffNChanges`,`{n} change(s)`,{n:e.changes.length+(e.truncated?`+`:``)}))}</span>`:``}
        </div>
        ${n===`modified`?`<div class="hidden pl-8 pr-2 pb-1" data-detail="${t}">${s(e)}</div>`:``}`);return`
      <details class="mb-2" ${t.length&&t.length<60?`open`:``}>
        <summary class="text-xs font-bold text-slate-600 cursor-pointer select-none py-1">
          ${m(e)} (${t.length}${t.length>500?`, `+m(b(`diffShowing`,`showing {n}`,{n:500})):``})
        </summary>
        <div class="rounded border border-slate-100">${i.join(``)||`<p class="text-slate-400 italic text-xs px-2 py-2">${m(b(`diffNone`,`None.`))}</p>`}</div>
      </details>`},s=e=>`
      <table class="w-full text-[10px] text-slate-600">
        ${e.changes.map(e=>`
          <tr class="border-b border-slate-50">
            <td class="py-0.5 pr-2 font-medium">${m(String(e.path).replace(`:::`,` // `))}</td>
            <td class="py-0.5 pr-2 text-red-600 line-through">${m(e.a??`—`)}</td>
            <td class="py-0.5 text-emerald-700">${m(e.b??`—`)}</td>
          </tr>`).join(``)}
        ${e.truncated?`<tr><td colspan="3" class="text-slate-400 italic py-0.5">${m(b(`diffMoreChanges`,`…more changes not shown`))}</td></tr>`:``}
      </table>`;t.innerHTML=`
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        ${a(m(b(`diffAdded`,`Added`)),n.counts.added,`bg-emerald-100 text-emerald-700`)}
        ${a(m(b(`diffRemoved`,`Removed`)),n.counts.removed,`bg-red-100 text-red-700`)}
        ${a(m(b(`diffModified`,`Modified`)),n.counts.modified,`bg-amber-100 text-amber-700`)}
        ${a(m(b(`diffUnchanged`,`Unchanged`)),n.counts.unchanged,`bg-slate-100 text-slate-500`)}
      </div>
      ${o(b(`diffAddedB`,`Added (only in B)`),n.added,`added`,`#16a34a`)}
      ${o(b(`diffRemovedA`,`Removed (only in A)`),n.removed,`removed`,`#dc2626`)}
      ${o(b(`diffModified`,`Modified`),n.modified,`modified`,`#eab308`)}`,t.onclick=async a=>{let o=a.target.closest(`[data-kind]`);if(!o)return;let s=o.dataset.kind,c=Number(o.dataset.i),l=n[s][c];if(!l)return;s===`modified`&&t.querySelector(`[data-detail="${c}"]`)?.classList.toggle(`hidden`);let u=s===`removed`?r:i,d=e.raw(u);if(!d?.model)return;let f=await g(d.model,[l.guid]);f.length&&e.focus(u,f)}}}typeof window<`u`&&(window.__cooDiff={openDiffDialog:x,paintDiff:y,clearDiffPaint:v});