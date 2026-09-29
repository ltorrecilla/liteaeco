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
// liteAECO - (ifc_viewer_audit-coo_bcf_board.js)
// ========

import{c as e,i as t,o as n,s as r}from"./ifc_viewer_audit-coo_bcf_shared.js";import{a as i,d as a,f as o,i as s,l as c,o as l,p as u,t as d,u as f}from"./ifc_viewer_audit-coo_bcf_detail.js";var p=12,m=6;function h(p,m={}){if(!p||p.dataset.bcfBoard)return null;let g=m.core||window.__cooBcf;if(!g)return setTimeout(()=>h(p,m),500),null;p.dataset.bcfBoard=`1`;let _=()=>m.access||window.__cooBcfCde||null,v=m.no3d!==!0,y=e=>typeof g.numberOf==`function`?g.numberOf(e.guid):null,b=()=>m.scope||_()?.scope||null,x=e=>{let t=b();return!t||t.test(e)},S=()=>g.topics().filter(x),C=e=>String(e??``).trim().toLowerCase();function ee(){if(typeof m.me==`function`)return(m.me()||[]).filter(Boolean);if(typeof g.meAliases==`function`)return(g.meAliases()||[]).filter(Boolean);let e=window.__cdeCtx;return e?[e.author,e.me&&e.me.memberId,e.me&&e.me.name,e.me&&e.me.mail].filter(Boolean):[g.author].filter(Boolean)}function w(e){let t=(typeof g.contacts==`function`?g.contacts():null)||window.__cooProject?.listContacts?.()||[],n=C(e),r=t.find(e=>C(e.mail)===n||C(e.name)===n||e.id&&C(e.id)===n);return r?r.name||r.mail:e}let T=()=>({isClosed:e=>g.isClosed(e),me:ee(),personName:w,now:Date.now()}),E=m.filterStore||a(m.filterKey||(()=>{try{return`viewer:`+(new URLSearchParams(window.location.search).get(`project`)||`local`)}catch{return`viewer:local`}})(),window),D=()=>{let e=E.get(),t=T();return S().filter(n=>u(n,e,t))},O=null,k=n(D,e=>typeof g.numberOf==`function`?g.numberOf(e):null),te=e=>typeof g.onChange==`function`?g.onChange(e):window.addEventListener(`coo-bcf-changed`,e),A=``,j=`created`,M=-1,N=null,P=null,F=`liteaeco_issues_dash_open`,I=!1;try{I=localStorage.getItem(F)===`1`}catch{}let L=m.hubStyle||null,R=L?`bg-white rounded border border-slate-200`:`bg-white rounded border border-slate-200 shadow-sm`,z=L?`px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[12px] font-bold uppercase tracking-widest transition flex items-center gap-1.5`:`px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed`,B=L?`px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-[12px] font-bold uppercase tracking-widest transition flex items-center gap-1.5`:`px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`,V=e=>L?`<i data-lucide="${e}" class="w-3.5 h-3.5 pointer-events-none"></i>`:``,H=l(m.title||e(`issBoardTitle`,`Issue Management`)),ne=L?`<div>
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="${l(L.icon||`layers`)}" class="w-4 h-4 text-slate-500 shrink-0"></i>
            <span class="text-sm font-bold text-slate-500 uppercase tracking-widest">${H}</span>
            ${L.folder?`<span class="font-mono text-[11px] text-slate-400 truncate">/${l(L.folder)}</span>`:``}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button data-publish-local class="hidden ${B}"></button>
            <button data-import class="${B}">${V(`upload`)}<span>${l(e(`issImport`,`Import .bcf`))}</span></button>
            <button data-export class="${B}">${V(`download`)}<span>${l(e(`issExport`,`Export .bcf`))}</span></button>
            ${typeof m.onNew==`function`?`<button data-new class="${z}">${V(`plus`)}<span>${l(e(`issNew`,`New issue`))}</span></button>`:``}
          </div>
        </div>
        ${L.hint?`<p class="text-[11px] text-slate-500">${l(L.hint)}</p>`:``}
      </div>`:`<div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800">${H}</h2>
        <div class="flex items-center gap-2">
          ${typeof m.onNew==`function`?`<button data-new class="${z}">${l(e(`issNew`,`New issue`))}</button>`:``}
          <button data-publish-local class="hidden px-3 py-1.5 rounded border border-indigo-300 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"></button>
          <button data-import class="${B}">${l(e(`issImport`,`Import .bcf`))}</button>
          <button data-export class="${B}">${l(e(`issExport`,`Export .bcf`))}</button>
        </div>
      </div>`;p.innerHTML=`
  <div class="flex-1 min-h-0 overflow-y-auto w-full">
    <div class="${L?`w-full`:m.wide?`max-w-7xl mx-auto py-1`:`max-w-5xl mx-auto p-6`} space-y-4">
      ${ne}

      <div data-bcf-noright class="hidden px-3 py-2 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-800"></div>
      <div data-cards class="grid grid-cols-2 md:grid-cols-5 gap-3"></div>

      <div class="${R} p-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-bold text-slate-600">${l(e(`issProgress`,`Resolution progress`))}</p>
          <p data-progress-label class="text-xs font-semibold text-slate-500"></p>
        </div>
        <div class="w-full h-4 rounded-full bg-slate-100 overflow-hidden">
          <div data-progress-bar class="h-full bg-emerald-500 transition-all duration-500" style="width:0%"></div>
        </div>
        <p class="text-[10px] text-slate-400 mt-1">${l(e(`issProgressHint`,`100% = all issues, filled = closed`))}</p>
      </div>

      <!-- dashboard (collapsed by default, remembered): click any bar to filter the table below -->
      <details data-dash class="group ${R}"${I?` open`:``}>
        <summary class="cursor-pointer select-none list-none flex items-center gap-2 px-4 py-2.5">
          <span class="text-slate-400 text-[10px] transition-transform group-open:rotate-90">&#9654;</span>
          <span class="${L?`text-sm font-bold text-slate-500 uppercase tracking-widest`:`text-xs font-bold text-slate-600`}">${l(e(`issDashboard`,`Dashboard`))}</span>
        </summary>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 pt-1">
        <div class="${R} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${l(e(`issChartDisc`,`Issues by discipline`))} <span class="font-normal text-slate-400">${l(e(`issChartDiscHint`,`(open / in progress / closed)`))}</span></p>
          <div data-chart-disc class="space-y-1.5"></div>
        </div>
        <div class="${R} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${l(e(`issChartDue`,`Open issues by due date`))}</p>
          <div data-chart-due class="space-y-1.5"></div>
        </div>
        <div class="${R} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${l(e(`issChartPrio`,`Open issues by priority`))}</p>
          <div data-chart-prio class="space-y-1.5"></div>
        </div>
        <div class="${R} p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">${l(e(`issChartAssignee`,`Open issues by assignee`))} <span class="font-normal text-slate-400">${l(e(`issChartAssigneeHint`,`(top 8)`))}</span></p>
          <div data-chart-assignee class="space-y-1.5"></div>
        </div>
        <div class="${R} p-4 md:col-span-2">
          <p class="text-xs font-bold text-slate-600 mb-2">${l(e(`issChartTimeline`,`Created vs closed over time`))}</p>
          <div data-chart-timeline></div>
        </div>
      </div>
      </details>
      <div data-active-filters class="hidden flex items-center gap-2 flex-wrap text-[11px]"></div>

      <div>
        <div class="${R} min-w-0">
          <div class="flex items-center gap-2 p-3 border-b border-slate-100">
            <input data-search placeholder="${l(e(`issSearch`,`Search issues...`))}" spellcheck="false"
              class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-indigo-300"/>
            <select data-scope class="hidden bg-white text-xs px-2 py-1.5 border border-slate-200 rounded max-w-[14rem]"></select>
          </div>
          <div data-filterbar class="px-3 py-2 border-b border-slate-100"></div>
          <div data-table class="overflow-x-auto"></div>
        </div>
      </div>
    </div>
  </div>
  <!-- issue panel: slides in from the right over the page (like the 3D dock),
       below the top navigation bar; the table keeps its size, nothing moves -->
  <div data-drawer data-open="0" role="dialog" aria-hidden="true"
    class="fixed right-0 z-[60] w-full max-w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col translate-x-full transition-transform duration-200 ease-out">
    <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
      <span data-drawer-title class="text-sm font-semibold text-slate-800 truncate">${l(e(`issDrawerTitle`,`Issue`))}</span>
      <button data-drawer-close class="shrink-0 p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100" title="${l(e(`issClose`,`Close (Esc)`))}" aria-label="${l(e(`issClose`,`Close (Esc)`))}">
        <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
      </button>
    </div>
    <div data-drawer-body class="flex-1 min-h-0 overflow-y-auto"></div>
  </div>`;let U=e=>p.querySelector(e);J(),window.lucide?.createIcons?.();function W(e,t,n){return`<div class="${R} p-3">
      <p class="text-[10px] font-semibold text-slate-400 uppercase">${e}</p>
      <p class="text-xl font-bold ${n}">${t}</p></div>`}document.addEventListener(`languageLoaded`,()=>{p.isConnected&&G()});function G(){ce();let{counts:n}=k.dashboard();U(`[data-cards]`).innerHTML=W(l(e(`issCardTotal`,`Total`)),n.total,`text-slate-800`)+W(l(e(`issCardOpen`,`Open`)),n.open,`text-amber-600`)+W(l(e(`issCardInProgress`,`In progress`)),n.inProgress,`text-sky-600`)+W(l(e(`issCardClosed`,`Closed`)),n.closed,`text-emerald-600`)+W(l(e(`issCardOverdue`,`Overdue`)),n.overdue,n.overdue?`text-red-600`:`text-slate-300`);let a=n.total?Math.round(n.closed/n.total*100):0;U(`[data-progress-bar]`).style.width=a+`%`,U(`[data-progress-label]`).textContent=n.total?r(e(`issProgressLabel`,`{closed} of {total} closed ({pct}%)`),{closed:n.closed,total:n.total,pct:a}):e(`issNone`,`No issues yet`);let o=Date.now(),s=D(),c=e=>!g.isClosed(e),u=864e5;re(s,c,e=>{if(!e.dueDate)return`none`;let t=new Date(e.dueDate).getTime()-o;return t<0?`overdue`:t<7*u?`week`:t<14*u?`twoweeks`:`later`});let f=k.query({search:A});ae(),O?.render(),L&&queueMicrotask(()=>window.lucide?.createIcons?.());let p={Critical:0,Major:1,Normal:2,Low:3},m=e=>({no:y(e)||1/0,title:String(e.title||``).toLowerCase(),status:t.indexOf(e.status),priority:p[e.priority]??9,assigned:String(e.assignedTo||``).toLowerCase(),created:e.creationDate?new Date(e.creationDate).getTime():0,due:e.dueDate?new Date(e.dueDate).getTime():1/0})[j];f.sort((e,t)=>{let n=m(e),r=m(t);return n<r?-M:n>r?M:0});let h=(e,t,n=``)=>`<th class="px-3 py-2 ${n}"><button data-sort="${e}" class="uppercase tracking-wide hover:text-slate-700 ${j===e?`text-slate-700`:``}">${t}${j===e?M>0?` ▲`:` ▼`:``}</button></th>`;U(`[data-table]`).innerHTML=f.length?`<table class="w-full text-xs">
        <thead>
          <tr class="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
            ${h(`no`,l(e(`issColNo`,`No.`)),`w-14`)}${h(`title`,l(e(`issColTitle`,`Title`)))}${h(`status`,l(e(`issStatus`,`Status`)))}${h(`priority`,l(e(`issPriority`,`Priority`)))}
            <th class="px-3 py-2">${l(e(`issLabels`,`Labels`))}</th>${h(`assigned`,l(e(`issColAssigned`,`Assigned`)))}
            ${h(`created`,l(e(`issColCreated`,`Created`)))}${h(`due`,l(e(`issColDue`,`Due`)))}<th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
        ${f.map(n=>{let r=!g.isClosed(n)&&n.dueDate&&new Date(n.dueDate).getTime()<o,a=n.guid===N;return`<tr data-row="${l(n.guid)}" class="border-b border-slate-50 cursor-pointer ${a?`bg-indigo-50/60`:`hover:bg-slate-50`}">
              <td class="px-3 py-2 text-slate-500 font-semibold tabular-nums">${y(n)||`-`}</td>
              <td class="px-3 py-2 font-semibold text-slate-700 max-w-[260px]"><div class="truncate">${l(n.title)}</div>
                <div class="text-[10px] font-normal text-slate-400 truncate">${l(n.description||``)}</div></td>
              <td class="px-3 py-2">
                <select data-row-status class="text-[10px] font-bold rounded px-1 py-0.5 border-0 ${d(n.status)} cursor-pointer disabled:cursor-not-allowed" title="${l(e(`issChangeStatus`,`Change status`))}"${le()?``:` disabled`}>
                  ${t.map(e=>`<option ${e===n.status?`selected`:``}>${e}</option>`).join(``)}
                </select></td>
              <td class="px-3 py-2 text-slate-500">${l(n.priority||`-`)}</td>
              <td class="px-3 py-2">${[...n.labels||[]].map(e=>`<span class="inline-block px-1 mr-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold">${l(e)}</span>`).join(``)||`<span class="text-slate-300">-</span>`}</td>
              <td class="px-3 py-2 text-slate-500 max-w-[140px] truncate">${l(n.assignedTo||`-`)}</td>
              <td class="px-3 py-2 text-slate-500">${i(n.creationDate)}</td>
              <td class="px-3 py-2 ${r?`text-red-600 font-bold`:`text-slate-500`}">${i(n.dueDate)}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">${v?`
                <button data-open3d="${l(n.guid)}"
                  class="${L?`px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-widest transition inline-flex items-center gap-1`:`px-2 py-1 rounded border border-slate-300 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50`}">${L?`<i data-lucide="box" class="w-3 h-3 pointer-events-none"></i>`:``}${l(e(`issOpen3d`,`Open in 3D`))}</button>`:``}
              </td>
            </tr>`}).join(``)}
        </tbody></table>`:`<p class="text-slate-400 italic text-center py-6 text-xs">${l(e(`issNoMatch`,`No issues match.`))}</p>`,se()}function K(t,n,r,i,a,o,s){let c=n.reduce((e,t)=>e+t.n,0),u=e=>r?Math.round(e/r*100):0;return`<button ${i}="${l(a)}" class="w-full text-left group ${o?`ring-1 ring-indigo-300 rounded`:``}" title="${l(e(`issBarFilter`,`Click to filter the list`))}">
      <div class="flex items-center gap-2">
        <span class="w-28 shrink-0 text-[11px] ${o?`text-indigo-700 font-bold`:`text-slate-600`} truncate">${l(t)}</span>
        <div class="flex-1 h-3.5 rounded bg-slate-100 overflow-hidden flex">
          ${n.map(e=>e.n?`<div class="${e.cls} h-full" style="width:${u(e.n)}%" title="${l(e.title)}: ${e.n}"></div>`:``).join(``)}
        </div>
        <span class="w-10 text-right text-[11px] font-semibold text-slate-600 tabular-nums">${s??c}</span>
      </div></button>`}function re(t,n,r){let i=e=>g.isClosed(e)?`closed`:e.status===`In Progress`||e.status===`In Review`?`prog`:`open`,a=e(`issCardOpen`,`Open`),o=e(`issSegProgress`,`In progress / review`),s=e(`issCardClosed`,`Closed`),u=new Map;for(let e of t){let t=e.labels&&e.labels.size?[...e.labels]:[`__none`];for(let n of t){let t=u.get(n)||{open:0,prog:0,closed:0};t[i(e)]++,u.set(n,t)}}let d=[...u.entries()].sort((e,t)=>t[1].open+t[1].prog-(e[1].open+e[1].prog)||e[0].localeCompare(t[0])),f=Math.max(1,...d.map(([,e])=>e.open+e.prog+e.closed));U(`[data-chart-disc]`).innerHTML=d.length?d.map(([t,n])=>K(t===`__none`?e(`issUnlabelled`,`Unlabelled`):t,[{n:n.open,cls:`bg-amber-400`,title:a},{n:n.prog,cls:`bg-sky-400`,title:o},{n:n.closed,cls:`bg-emerald-400`,title:s}],f,`data-f-label`,t,q(`labels`,t),`${n.open+n.prog}/${n.open+n.prog+n.closed}`)).join(``):`<p class="text-slate-300 italic text-[11px]">${l(e(`issNone`,`No issues yet`))}.</p>`;let p=[[`overdue`,e(`issCardOverdue`,`Overdue`),`bg-red-500`],[`week`,e(`issDueWeek`,`Due this week`),`bg-amber-400`],[`twoweeks`,e(`issDue2Weeks`,`Due in 2 weeks`),`bg-yellow-300`],[`later`,e(`issDueLater`,`Later`),`bg-sky-300`],[`none`,e(`issDueNone`,`No due date`),`bg-slate-300`]],m=Object.fromEntries(p.map(([e])=>[e,0]));for(let e of t)n(e)&&m[r(e)]++;let h=Math.max(1,...Object.values(m));U(`[data-chart-due]`).innerHTML=p.map(([e,t,n])=>K(t,[{n:m[e],cls:n,title:t}],h,`data-f-due`,e,q(`due`,e===`none`?c:e))).join(``);let _=[[`Critical`,`bg-red-500`],[`Major`,`bg-orange-400`],[`Normal`,`bg-sky-400`],[`Low`,`bg-slate-300`],[`__none`,`bg-slate-200`]],v=Object.fromEntries(_.map(([e])=>[e,0]));for(let e of t)n(e)&&v[e.priority&&v[e.priority]!==void 0?e.priority:`__none`]++;let y=Math.max(1,...Object.values(v));U(`[data-chart-prio]`).innerHTML=_.map(([t,n])=>K(t===`__none`?e(`issUnset`,`Unset`):t,[{n:v[t],cls:n,title:t}],y,`data-f-prio`,t,q(`priority`,t))).join(``);let b=new Map;for(let e of t)if(n(e)){let t=e.assignedTo||`__none`;b.set(t,(b.get(t)||0)+1)}let x=[...b.entries()].filter(([e])=>e!==`__none`).sort((e,t)=>t[1]-e[1]).slice(0,8);b.has(`__none`)&&x.push([`__none`,b.get(`__none`)]);let S=Math.max(1,...x.map(([,e])=>e));U(`[data-chart-assignee]`).innerHTML=x.length?x.map(([t,n])=>K(t===`__none`?e(`issUnassigned`,`Unassigned`):w(t),[{n,cls:t===`__none`?`bg-slate-300`:`bg-indigo-400`,title:a}],S,`data-f-assignee`,t,q(`assignee`,t))).join(``):`<p class="text-slate-300 italic text-[11px]">${l(e(`issNoOpen`,`No open issues.`))}</p>`;let{timeline:C}=k.dashboard();U(`[data-chart-timeline]`).innerHTML=ie(C)}function ie(t){if(!t||t.length<2)return`<p class="text-slate-300 italic text-[11px]">${l(e(`issNoHistory`,`Not enough history yet.`))}</p>`;let n=Math.max(1,...t.map(e=>e.created)),r=e=>24+e/(t.length-1)*592,i=e=>100-e/n*72,a=e=>t.map((t,n)=>`${n?`L`:`M`}${r(n).toFixed(1)},${i(t[e]).toFixed(1)}`).join(` `),o=new Date(t[0].t).toLocaleDateString(),s=new Date(t[t.length-1].t).toLocaleDateString();return`<svg viewBox="0 0 640 120" class="w-full h-28">
      <line x1="24" y1="${i(0)}" x2="616" y2="${i(0)}" stroke="#e2e8f0"/>
      <line x1="24" y1="${i(n)}" x2="616" y2="${i(n)}" stroke="#f1f5f9" stroke-dasharray="3 3"/>
      <path d="${a(`created`)}" fill="none" stroke="#f59e0b" stroke-width="2"/>
      <path d="${a(`closed`)}" fill="none" stroke="#10b981" stroke-width="2"/>
      <text x="24" y="116" font-size="9" fill="#94a3b8">${l(o)}</text>
      <text x="616" y="116" font-size="9" fill="#94a3b8" text-anchor="end">${l(s)}</text>
      <text x="24" y="${i(n)-3}" font-size="9" fill="#94a3b8">${n}</text>
      <g font-size="9"><rect x="490" y="6" width="8" height="8" fill="#f59e0b"/><text x="502" y="13" fill="#64748b">${l(e(`issLegendCreated`,`created`))}</text>
      <rect x="560" y="6" width="8" height="8" fill="#10b981"/><text x="572" y="13" fill="#64748b">${l(e(`issLegendClosed`,`closed`))}</text></g>
    </svg>`}let q=(e,t)=>(E.get()[e]||[]).includes(t);function ae(){let t=U(`[data-active-filters]`),n=o(E.get(),T()).map(t=>`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">${l(t.text)} <button data-f-remove="${l(t.field)}" data-f-value="${l(t.value)}" class="font-bold hover:text-indigo-900" title="${l(e(`issClear`,`Clear`))}">×</button></span>`);t.classList.toggle(`hidden`,!n.length),t.innerHTML=n.length?`<span class="text-slate-500">${l(e(`issFilteredBy`,`Filtered by`))}</span> `+n.join(` `)+` <button data-f-clear class="text-slate-500 underline">${l(e(`issClearAll`,`clear all`))}</button>`:``}function oe(){if(typeof m.top==`number`)return m.top;try{return parseFloat(getComputedStyle(document.body).paddingTop)||0}catch{return 0}}function J(){let e=U(`[data-drawer]`),t=oe();e.style.top=t+`px`,e.style.height=`calc(100% - ${t}px)`}function Y(e){let t=U(`[data-drawer]`);e&&J(),t.dataset.open=e?`1`:`0`,t.classList.toggle(`translate-x-full`,!e),t.classList.toggle(`translate-x-0`,e),t.setAttribute(`aria-hidden`,e?`false`:`true`),t.inert=!e}function se(){let t=U(`[data-drawer-body]`);if(!N||!g.bcf.list.get(N)){N=null,Y(!1);return}Y(!0);let n=typeof g.numberOf==`function`?g.numberOf(N):null;if(U(`[data-drawer-title]`).textContent=n?r(e(`issDrawerTitleN`,`Issue {n}`),{n}):e(`issDrawerTitle`,`Issue`),!P||!t.contains(P.mount)){t.innerHTML=``;let e=document.createElement(`div`);t.appendChild(e),P=s(g,e,{key:`board`,onOpen3d:v?e=>X(e):void 0,actions:{}}),P.mount=e}P.render(N)}function X(e){if(typeof m.onOpen3d==`function`){m.onOpen3d(e);return}document.getElementById(`nav-viewer`)?.click(),setTimeout(()=>{window.dispatchEvent(new CustomEvent(`coo-bcf-open-topic`,{detail:{guid:e}}))},150)}p.addEventListener(`click`,t=>{if(t.target.closest(`[data-drawer-close]`)){N=null,G();return}if(t.target.closest(`[data-drawer]`))return;let n=t.target.closest(`[data-open3d]`);if(n){n.dataset.open3d&&X(n.dataset.open3d);return}let i=t.target.closest(`[data-sort]`);if(i){let e=i.dataset.sort;j===e?M=-M:(j=e,M=e===`title`||e===`assigned`?1:-1),G();return}let a=t.target.closest(`[data-f-label],[data-f-due],[data-f-prio],[data-f-assignee]`);if(a){let e=a.dataset,[t,n,r]=e.fLabel===void 0?e.fDue===void 0?e.fPrio===void 0?[`assignee`,e.fAssignee,!0]:[`priority`,e.fPrio,!0]:[`due`,e.fDue===`none`?c:e.fDue,!0]:[`labels`,e.fLabel,!1],i=!q(t,n);E.toggle(t,n,i),i&&r&&!E.get().openOnly&&E.toggle(`openOnly`,void 0,!0);return}let o=t.target.closest(`[data-f-remove]`);if(o){E.toggle(o.dataset.fRemove,o.dataset.fValue,!1);return}if(t.target.closest(`[data-f-clear]`)){E.clear();return}let s=t.target.closest(`[data-row]`);if(s&&!t.target.closest(`select`)&&!t.target.closest(`button`)){N=s.dataset.row===N?null:s.dataset.row,G();return}if(t.target.closest(`[data-export]`)){g.exportBcfFile();return}if(t.target.closest(`[data-new]`)){Promise.resolve(m.onNew()).then(e=>{e&&g.bcf.list.get(e)&&(N=e,G())}).catch(e=>console.warn(`[bcf-board] new issue failed`,e));return}if(t.target.closest(`[data-publish-local]`)){_()?.publishLocal?.().then($);return}if(t.target.closest(`[data-import]`)){let t=document.createElement(`input`);t.type=`file`,t.accept=`.bcf,.bcfzip`,t.addEventListener(`change`,async()=>{let n=t.files?.[0];if(n)try{let t=await g.importBcfFile(n);if(t?.refused)return;if(t?.sampled>0&&t.matched/t.sampled<.25&&!confirm(r(e(`issImportWeak`,`This BCF references {sampled} element(s); only {matched} found in the loaded models.
It may belong to a different project.

Keep the import?`),{sampled:t.sampled,matched:t.matched}))){g.removeTopics(t.imported);return}t?.imported?.length&&g.markDirty?.(t.imported,[`__new`])}catch(t){alert(e(`issImportFailed`,`BCF import failed:`)+` `+(t?.message||t))}}),t.click();return}}),U(`[data-search]`).addEventListener(`input`,e=>{A=e.target.value,G()}),U(`[data-dash]`).addEventListener(`toggle`,e=>{try{localStorage.setItem(F,e.target.open?`1`:`0`)}catch{}}),O=f(U(`[data-filterbar]`),{store:E,getTopics:S,ctx:T}),E.subscribe(()=>G());function ce(){let e=U(`[data-scope]`),t=b();if(!e||(e.classList.toggle(`hidden`,!t),!t))return;let n=t.get();e.innerHTML=t.options().map(e=>`<option value="${l(e.id)}"${e.id===n?` selected`:``}>${l(e.label)}</option>`).join(``)}U(`[data-scope]`).addEventListener(`change`,e=>{let t=b();t&&(t.set(e.target.value),t.event||G())});let Z=null,Q=()=>{let e=b();e&&e.event&&Z!==e.event&&(Z=e.event,window.addEventListener(e.event,()=>G()))};Q(),window.addEventListener(`coo-bcf-project`,()=>{Q(),G()}),p.addEventListener(`change`,e=>{let t=e.target.closest(`[data-row-status]`);if(!t)return;let n=e.target.closest(`[data-row]`);n&&g.updateTopic(n.dataset.row,{status:t.value})}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&N&&!p.classList.contains(`hidden`)&&(N=null,G())}),te(()=>{P?.hasOpenPopup?.()||(G(),$())});function $(){let t=_(),n=!le(),r=e(`bcfNoUploadRight`,`You can see the issues of this project but not add or change them: no upload right on the issues folder.`),i=U(`[data-bcf-noright]`);i&&(i.classList.toggle(`hidden`,!n),i.textContent=n?r:``);for(let e of[U(`[data-import]`),U(`[data-new]`)])e&&(e.disabled=n,n?e.title=r:e.removeAttribute(`title`));let a=U(`[data-publish-local]`),o=t&&t.canWrite&&typeof t.localOnly==`function`?t.localOnly().length:0;a&&(a.classList.toggle(`hidden`,!o),a.textContent=o?`${e(`bcfLocalOnly`,`Publish local issues`)} (${o})`:``)}function le(){let e=_();return!e||e.canWrite!==!1}window.addEventListener(`coo-bcf-access`,()=>{$(),G()}),window.addEventListener(`coo-bcf-project`,$),G(),$();let ue=()=>{G(),$(),_()?.offerPublish?.()?.then?.($)};return p.__bcfBoardRender=ue,{render:G,show:ue,applyAccess:$,open:e=>e&&g.bcf.list.get(e)?(N=e,G(),!0):!1}}export{p as COO_BUILD,m as COO_BUILD_V6,h as initBcfBoard};