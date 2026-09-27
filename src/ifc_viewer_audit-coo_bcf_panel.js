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
// liteAECO - (ifc_viewer_audit-coo_bcf_panel.js)
// ========

import{a as e,c as t,i as n,n as r,r as i}from"./ifc_viewer_audit-coo_bcf_shared.js";import{BCF_MARKER_COLORS as a,t as o}from"./ifc_viewer_audit-coo_bcf.js";import{a as s,c,d as l,i as ee,n as u,o as d,p as f,r as te,s as ne,u as re}from"./ifc_viewer_audit-coo_bcf_detail.js";function p(e){return e===`Closed`||e===`Done`?`bg-emerald-100 text-emerald-700`:e===`In Progress`||e===`In Review`?`bg-sky-100 text-sky-700`:`bg-amber-100 text-amber-700`}function m({buttonId:h=`coo-btn-bcf`}={}){let g=document.getElementById(h),_=document.getElementById(`prop-popup`)?.parentElement;if(!g||!_||g.dataset.bcfWired)return null;let v=window.__cooBcf;if(!v)return setTimeout(()=>m({buttonId:h}),500),null;g.dataset.bcfWired=`1`;let y=``,b=e=>String(e??``).trim().toLowerCase(),x=()=>{let e=window.__cdeCtx,t=e?[e.author,e.me&&e.me.memberId,e.me&&e.me.name,e.me&&e.me.mail].filter(Boolean):[v.author].filter(Boolean),n=(typeof v.contacts==`function`?v.contacts():null)||window.__cooProject?.listContacts?.()||[];return{isClosed:e=>v.isClosed(e),me:t,personName:e=>{let t=b(e),r=n.find(e=>b(e.mail)===t||b(e.name)===t||e.id&&b(e.id)===t);return r?r.name||r.mail:e},now:Date.now()}},S=`viewer:local`;try{S=`viewer:`+(new URLSearchParams(window.location.search).get(`project`)||`local`)}catch{}let C=l(S,window),w=null,T=null,E=!1;function D(e){O.querySelectorAll(`[data-tab]`).forEach(t=>t.classList.toggle(`active`,t.dataset.tab===e)),O.querySelector(`[data-pane-list]`).classList.toggle(`hidden`,e!==`list`),O.querySelector(`[data-pane-list]`).classList.toggle(`flex`,e===`list`),O.querySelector(`[data-pane-detail]`).classList.toggle(`hidden`,e!==`detail`)}document.getElementById(`coo-bcf-dock`)?.remove();let O=document.createElement(`div`);O.id=`coo-bcf-dock`,O.className=`properties-popup closed`,O.style.width=`380px`,O.style.zIndex=`26`,O.innerHTML=`
    <div class="properties-popup-header">
      <span class="text-sm font-semibold">Issue Management</span>
      <div class="flex items-center gap-1">
        <button data-new class="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">New issue</button>
        <button data-close class="prop-popup-close" title="Close">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
    <div class="prop-popup-tabs shrink-0" data-tabs>
      <button type="button" class="prop-tab active" data-tab="list">Issue list</button>
      <button type="button" class="prop-tab" data-tab="detail">Details</button>
    </div>
    <div data-bcf-noright class="hidden shrink-0 px-3 py-2 border-b border-amber-200 bg-amber-50 text-[11px] text-amber-800"></div>
    <div data-pane-list class="flex-1 min-h-0 flex flex-col">
      <div class="px-3 py-2 border-b border-slate-100 shrink-0 flex items-center gap-1.5">
        <input data-author list="bcf-contacts-me" title="Your name or mail. Written as the standard BCF Author on every topic and comment you create."
          class="flex-1 min-w-0 text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-300" placeholder="your name / mail"/>
        <datalist id="bcf-contacts-me"></datalist>
        <div class="relative shrink-0">
          <button data-mvis-btn type="button" title="Show or hide issue markers by status"
            class="flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 rounded bg-white hover:border-slate-400">
            <i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i>
            Markers <span data-mvis-count class="text-slate-400"></span> ▾
          </button>
          <div data-mvis-pop
            class="hidden absolute z-30 mt-1 right-0 w-44 bg-white border border-slate-200 rounded shadow-lg p-1.5 space-y-0.5">
          </div>
        </div>
      </div>
      <div class="px-3 py-2 border-b border-slate-100 shrink-0 space-y-2">
        <div class="flex items-center gap-1">
          <input data-search placeholder="Search issues…" spellcheck="false"
            class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-indigo-300"/>
          <select data-scope class="hidden shrink-0 bg-white text-[11px] px-1 py-1.5 border border-slate-200 rounded"></select>
        </div>
        <div data-filterbar></div>
      </div>
      <div data-list class="flex-1 min-h-0 overflow-y-auto"></div>
    </div>
    <div data-pane-detail class="hidden flex-1 min-h-0 overflow-y-auto overflow-x-hidden"></div>`,_.appendChild(O);for(let e of[`pointerdown`,`pointerup`,`pointermove`,`pointercancel`,`mousedown`,`mouseup`,`mousemove`,`click`,`dblclick`,`wheel`,`touchstart`,`touchmove`,`touchend`])O.addEventListener(e,e=>e.stopPropagation());let k=e=>O.querySelector(e);O.addEventListener(`click`,e=>{for(let t of O.querySelectorAll(`[data-mvis-pop], [data-ldd-pop]`)){if(t.classList.contains(`hidden`))continue;let n=t.dataset.lddPop,r=n==null?O.querySelector(`[data-mvis-btn]`):O.querySelector(`[data-ldd-btn="${n}"]`);!t.contains(e.target)&&!(r&&r.contains(e.target))&&t.classList.add(`hidden`)}},!0);let A=(e,t,n)=>c(v,e,t,n,()=>X()),j=te,M=(e,t)=>`<label class="flex flex-col gap-1 min-w-0"><span class="text-[10px] font-semibold text-slate-500 uppercase">${e}</span>${t}</label>`,ie=ne,N=null,P=null,F=new Set,I=null;function L(e){let t=window.__cooBcfCtx,n=t?.world?.renderer?.three?.domElement;if(!n||typeof t.raycastPoint!=`function`){alert(`Marker placement needs the 3D viewer.`);return}I=e,n.style.cursor=`crosshair`;let r=O.querySelector(`[data-marker-state]`);r&&(r.textContent=`Click on the model surface to place the marker. Esc cancels.`);let i=()=>{n.style.cursor=``,n.removeEventListener(`pointerdown`,o,!0),window.removeEventListener(`keydown`,a,!0),I=null},a=t=>{if(t.key===`Escape`){if(i(),e===`new`){let e=O.querySelector(`[data-marker-state]`);e&&(e.textContent=P?`Marker placed (dashed circle). Click Reposition Marker to adjust; it is saved with the issue.`:``)}else X()}},o=async e=>{if(e.button!==0)return;e.stopPropagation(),e.preventDefault();let n=I;i();try{let r=await t.raycastPoint(e.clientX,e.clientY);if(!r?.point){if(n===`new`){let e=O.querySelector(`[data-marker-state]`);e&&(e.textContent=`No surface hit. Click Place marker again.`)}else X();return}let i={x:r.point.x,y:r.point.y,z:r.point.z};n===`new`?(P=i,ae(i)):v.setMarker(n,i)}catch(e){console.warn(`[coo-bcf] marker pick failed`,e)}if(n===`new`){let e=O.querySelector(`[data-place-marker]`);e&&(e.textContent=P?`Reposition Marker`:`Place marker on model`);let t=O.querySelector(`[data-marker-state]`);t&&(t.textContent=P?`Marker placed (dashed circle). Click Reposition Marker to adjust; it is saved with the issue.`:``)}else X(),H()};n.addEventListener(`pointerdown`,o,!0),window.addEventListener(`keydown`,a,!0)}let R=[],z=null,B=new Set(n.filter(e=>e!==`Done`&&e!==`Closed`));function V(){let e=window.__cooBcfCtx;if(!e?.components||!e?.OBF?.Marker)return null;try{let t=e.components.get(e.OBF.Marker);return t.threshold=10,t}catch{return null}}function H(){let e=window.__cooBcfCtx,t=V();if(t&&e?.world){for(let e of R)try{t.delete?.(e)}catch{}R=[];try{!R.length&&typeof t.dispose==`function`&&t.list?.size&&!v.allMarkers().length&&t.dispose()}catch{}for(let{guid:n,x:r,y:i,z:o}of v.allMarkers()){let s=v.bcf.list.get(n);if(!s)continue;let c=a[s.status]||`#94a3b8`;if(!B.has(s.status))continue;let l=document.createElement(`div`);l.title=s.title,l.style.cssText=`width:20px;height:20px;border-radius:50%;border:2.5px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.45);cursor:pointer;background:`+c+`;`,l.addEventListener(`click`,e=>{e.stopPropagation(),T=n,E=!1,Z(),D(`detail`),X()});try{let n=t.create(e.world,l,new e.THREE.Vector3(r,i,o));n!==void 0&&R.push(n)}catch(e){console.warn(`[coo-bcf] marker create failed`,e)}}}}function ae(e){let t=window.__cooBcfCtx,n=V();if(!n||!t?.world)return;U();let r=document.createElement(`div`);r.title=`New issue marker (not saved yet)`,r.style.cssText=`width:20px;height:20px;border-radius:50%;background:rgba(99,102,241,0.85);border:2.5px dashed #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.45);`;try{z=n.create(t.world,r,new t.THREE.Vector3(e.x,e.y,e.z))}catch(e){console.warn(`[coo-bcf] preview marker failed`,e)}}function U(){if(z!=null){try{V()?.delete?.(z)}catch{}z=null}}async function W(e){try{let t=window.__cooBcfCtx,n=t?.world?.camera,r=n?.three?.position;if(n?.controls?.setLookAt&&r){let i=new t.THREE.Vector3(r.x-e.x,r.y-e.y,r.z-e.z).normalize().multiplyScalar(8);await n.controls.setLookAt(e.x+i.x,e.y+i.y,e.z+i.z,e.x,e.y,e.z,!0),t.components.get(t.OBC.FragmentsManager)?.core?.update?.(!0)}}catch(e){console.warn(`[coo-bcf] fly to marker failed`,e)}}window.addEventListener(`coo-bcf-changed`,()=>H());function G(){let e=k(`[data-mvis-pop]`),t=k(`[data-mvis-count]`);e&&t&&(t.textContent=B.size===n.length?``:`(${B.size}/${n.length})`,e.innerHTML=n.map((e,t)=>`<label class="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
        <input type="checkbox" data-mvis-idx="${t}" ${B.has(e)?`checked`:``} class="accent-indigo-600 shrink-0">
        <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style="background:${a[e]||`#94a3b8`}"></span>
        <span class="truncate text-[11px]">${d(e)}</span></label>`).join(``))}O.addEventListener(`click`,e=>{e.target.closest(`[data-mvis-btn]`)&&(e.stopPropagation(),G(),k(`[data-mvis-pop]`).classList.toggle(`hidden`))}),O.addEventListener(`change`,e=>{let t=e.target.closest(`[data-mvis-idx]`);if(!t)return;e.stopPropagation();let r=n[Number(t.dataset.mvisIdx)];r&&(t.checked?B.add(r):B.delete(r),G(),H())}),document.addEventListener(`click`,e=>{!e.target.closest(`[data-mvis-pop]`)&&!e.target.closest(`[data-mvis-btn]`)&&k(`[data-mvis-pop]`)?.classList.add(`hidden`)});function K(){let e=window.__cooBcfCde?.scope||null,t=C.get(),n=x(),r=v.query({search:y}).filter(r=>(!e||e.test(r))&&f(r,t,n));k(`[data-list]`).innerHTML=r.length?r.map(e=>`
        <div data-open="${d(e.guid)}"
          class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-b border-slate-50 ${T===e.guid?`bg-indigo-50`:`hover:bg-slate-50`}">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${p(e.status)}">${d(e.status)}</span>
          <div class="flex-1 min-w-0">
            <div class="truncate font-medium text-slate-700">${v.numberOf?.(e.guid)?`<span class="text-slate-400 font-semibold tabular-nums mr-1">${v.numberOf(e.guid)}</span>`:``}${d(e.title)}</div>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="text-[9px] text-slate-400 font-semibold">${d(e.type||``)}</span>
              ${[...e.labels||[]].map(e=>`<span class="px-1 rounded bg-slate-100 text-slate-500 text-[8px] font-bold">${d(e)}</span>`).join(``)}
            </div>
          </div>
          <span class="text-[9px] shrink-0 ${!v.isClosed(e)&&e.dueDate&&new Date(e.dueDate)<new Date?`text-red-600 font-bold`:`text-slate-400`}">${s(e.dueDate)}</span>
        </div>`).join(``):`<p class="text-slate-400 italic text-center py-4 text-xs">No issues match.</p>`}let q=null,J=[`title`,`description`,`assignedTo`,`dueDate`,`type`,`priority`,`stage`],Y=null;function oe(){if(!E)return;let e={};for(let t of J){let n=O.querySelector(`[data-f="${t}"]`);n&&(e[t]=n.value)}Object.keys(e).length&&(Y=e)}function se(){if(E&&Y)for(let e of J){let t=O.querySelector(`[data-f="${e}"]`);t&&Y[e]!==void 0&&(t.value=Y[e])}}function ce(){let n=k(`[data-pane-detail]`);if(E){let a=A(`new`,F),o=q||{};n.innerHTML=`
      <div class="p-3 space-y-2 text-xs">
        <p class="font-bold text-slate-700">New issue${o.clash?` <span class="font-normal text-slate-400">(from clash)</span>`:``}</p>
        <input data-f="title" placeholder="Title" value="${d(o.title||``)}" class="w-full px-2 py-1.5 border border-slate-200 rounded"/>
        <textarea data-f="description" placeholder="Description" rows="3"
          class="w-full px-2 py-1.5 border border-slate-200 rounded resize-none">${d(o.description||``)}</textarea>
        <input data-f="assignedTo" list="bcf-contacts-new" placeholder="${d(t(`issAssignedToPh`,`Assigned to`))}" autocomplete="off" class="w-full px-2 py-1.5 border border-slate-200 rounded"/>
        ${j(`bcf-contacts-new`,[...F],v)}
        <!-- 2 columns, label ABOVE the field: a date field keeps its calendar icon inside the dock -->
        <div class="grid grid-cols-2 gap-x-2 gap-y-2">
          ${M(`Type`,`<select data-f="type" class="w-full min-w-0 bg-white px-2 py-1 border border-slate-200 rounded">
            ${e.map(e=>`<option>${e}</option>`).join(``)}</select>`)}
          ${M(`Priority`,`<select data-f="priority" class="w-full min-w-0 bg-white px-2 py-1 border border-slate-200 rounded">
            ${r.map(e=>`<option ${e===`Normal`?`selected`:``}>${e}</option>`).join(``)}</select>`)}
          ${M(`Stage`,`<select data-f="stage" class="w-full min-w-0 bg-white px-2 py-1 border border-slate-200 rounded">
            <option value=""></option>${i.map(e=>`<option>${e}</option>`).join(``)}</select>`)}
          ${M(`Due date`,`<input data-f="dueDate" type="date" class="w-full min-w-0 px-2 py-1 border border-slate-200 rounded"/>`)}
        </div>
        ${ie(`Labels`,a.html)}
        <button data-place-marker
          class="w-full px-2 py-1.5 rounded border border-dashed border-indigo-300 text-indigo-600 font-semibold hover:bg-indigo-50">
          ${P?`Reposition Marker`:`Place marker on model`}
        </button>
        <p data-marker-state class="text-[10px] text-slate-400">${P?`Marker placed (dashed circle). Click Reposition Marker to adjust; it is saved with the issue.`:``}</p>
        <p class="text-[10px] text-slate-400">Camera, current selection and a screenshot are attached automatically.</p>
        <div class="flex gap-2">
          <button data-create class="px-3 py-1.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Create</button>
          <button data-cancel class="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </div>`,a.wire(n);return}if(!(T&&v.bcf.list.get(T))){n.innerHTML=`<p class="text-slate-400 italic text-center py-8 text-xs">Select an issue above, or create one.</p>`,N=null;return}if(!N||!n.contains(N.mount)){n.innerHTML=``;let e=document.createElement(`div`);n.appendChild(e),N=ee(v,e,{key:`dock`,actions:{goTo:e=>v.goToViewpoint(e),resnap:e=>v.updateSnapshot(e),markerMove:e=>L(e),markerDel:e=>{v.setMarker(e,null),H(),X()},markerGoto:e=>{let t=v.markerOf(e);t&&W(t)}}}),N.mount=e}N.render(T)}function le(){let e=k(`[data-scope]`),t=window.__cooBcfCde?.scope||null;if(!e||(e.classList.toggle(`hidden`,!t),!t))return;let n=t.get();e.innerHTML=t.options().map(e=>`<option value="${d(e.id)}"${e.id===n?` selected`:``}>${d(e.label)}</option>`).join(``)}function X(){oe(),le(),w?.render(),K(),ce(),se(),window.lucide?.createIcons?.()}O.addEventListener(`click`,async e=>{let t=e.target.closest(`[data-tab]`);if(t){D(t.dataset.tab);return}let n=e.target.closest(`[data-open]`);if(n){T=n.dataset.open,E=!1,D(`detail`),X();return}if(e.target.closest(`[data-new]`)){E=!0,Y=null,q=null,D(`detail`),X();return}if(e.target.closest(`[data-cancel]`)){E=!1,q=null,Y=null,P=null,U(),D(`list`),X();return}if(e.target.closest(`[data-create]`)){let e=e=>O.querySelector(`[data-f="${e}"]`)?.value?.trim(),t=await v.createTopic({title:e(`title`),description:e(`description`),assignedTo:e(`assignedTo`),dueDate:e(`dueDate`),type:e(`type`),priority:e(`priority`),stage:e(`stage`),labels:[...F],marker:P,clash:q?.clash||null});if(!t)return;q=null,Y=null,P=null,F=new Set,U(),H(),E=!1,T=t.guid,D(`detail`),X();return}if(e.target.closest(`[data-place-marker]`)){L(`new`);return}e.target.closest(`[data-close]`)&&Q()}),O.addEventListener(`change`,e=>{e.target.closest(`[data-author]`)&&v.setAuthor(e.target.value)}),k(`[data-search]`).addEventListener(`input`,e=>{y=e.target.value,K()}),window.addEventListener(`coo-bcf-changed`,()=>{O.classList.contains(`closed`)||O.querySelector(`[data-ldd-pop]:not(.hidden)`)||X()});let Z=()=>{window.__closePropertiesPanel?window.__closePropertiesPanel():document.getElementById(`prop-popup`)?.classList.add(`closed`),window.__closeClassifierPanel?window.__closeClassifierPanel():document.getElementById(`classifier-popup`)?.classList.add(`closed`),document.getElementById(`settings-popup`)?.classList.add(`closed`),O.classList.remove(`closed`),g.setAttribute(`active`,``);let e=k(`[data-author]`);e&&!e.value&&(e.value=v.author||``),$(),window.__cooBcfCde?.offerPublish?.();let t=k(`#bcf-contacts-me`);t&&(t.innerHTML=u().map(e=>`<option value="${d(e.value)}">${d(e.label)}</option>`).join(``)),X(),H()},Q=()=>{O.classList.add(`closed`),g.removeAttribute(`active`)};function $(){let e=window.__cooBcfCde,t=!!e&&!e.canWrite,n=k(`[data-bcf-noright]`);n&&(n.classList.toggle(`hidden`,!t),n.textContent=t?o(`noRight`):``);let r=k(`[data-new]`);r&&(r.disabled=t,t?r.title=o(`noRight`):r.removeAttribute(`title`));let i=k(`[data-author]`);i&&e&&(i.value=v.author||``,i.readOnly=!0)}window.addEventListener(`coo-bcf-access`,$),window.addEventListener(`coo-bcf-project`,()=>{$(),X()});{let e=[`prop-popup`,`classifier-popup`,`settings-popup`].map(e=>document.getElementById(e)).filter(Boolean);if(e.length&&`MutationObserver`in window){let t=new MutationObserver(()=>{e.some(e=>!e.classList.contains(`closed`))&&!O.classList.contains(`closed`)&&Q()});e.forEach(e=>t.observe(e,{attributes:!0,attributeFilter:[`class`]}))}}return g.addEventListener(`click`,()=>{O.classList.contains(`closed`)?Z():Q()}),window.addEventListener(`coo-bcf-new-from-clash`,e=>{let t=e.detail||{};q={title:t.title||``,description:t.description||``,clash:t.clash||null},Y=null,P=t.marker&&isFinite(t.marker.x)?{x:t.marker.x,y:t.marker.y,z:t.marker.z}:null,E=!0,Z(),D(`detail`),X()}),O.addEventListener(`change`,e=>{let t=e.target.closest?.(`[data-scope]`);t&&window.__cooBcfCde?.scope?.set(t.value)}),window.addEventListener(`coo-bcf-scope-changed`,()=>X()),w=re(k(`[data-filterbar]`),{store:C,compact:!0,ctx:x,getTopics:()=>{let e=window.__cooBcfCde?.scope||null;return v.topics().filter(t=>!e||e.test(t))}}),C.subscribe(()=>X()),window.addEventListener(`coo-bcf-open-topic`,e=>{let t=e.detail?.guid;t&&(T=t,E=!1,Z(),D(`detail`),X(),v.goToViewpoint(t))}),{open:Z,close:Q,render:X}}export{m as initBcfDock};