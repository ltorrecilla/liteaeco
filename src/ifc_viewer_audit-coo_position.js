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
// liteAECO - (ifc_viewer_audit-coo_position.js)
// ========

var e=5,t=180/Math.PI;function n(e){let t=e%360;return t>180&&(t-=360),t<=-180&&(t+=360),t}function r(e,n,r){let i=r/t,a=Math.cos(i),o=Math.sin(i);return[e*a-n*o,e*o+n*a]}function i(e,i,a,o,s,{flip:c=!1}={}){let l={x:+e?.x||0,y:+e?.y||0,z:+e?.z||0,rot:+e?.rot||0},u=[a.x-i.x,a.y-i.y],d=[s.x-o.x,s.y-o.y],f=Math.hypot(u[0],u[1]),p=Math.hypot(d[0],d[1]);if(f<1e-6||p<1e-6)return null;let m=n((Math.atan2(d[1],d[0])-Math.atan2(u[1],u[0]))*t);c&&(m=n(m+180));let h=(u[0]*d[0]+u[1]*d[1])/(f*p)<0,[g,_]=r(i.x-l.x,i.y-l.y,-l.rot),v=i.z-l.z,y=n(l.rot+m),[b,x]=r(g,_,y),S=e=>Math.round(e*1e6)/1e6;return{pose:{x:S(o.x-b),y:S(o.y-x),z:S(o.z-v),rot:S(y)},dtheta:S(m),opposite:h}}function a(e,i,a,o,s,{flip:c=!1}={}){if(!a||!s)return null;let l=[a.x,a.y],u=[s.x,s.y],d=Math.hypot(l[0],l[1]),f=Math.hypot(u[0],u[1]);if(d<.2||f<.2)return null;let p=n((Math.atan2(u[1],u[0])-Math.atan2(l[1],l[0]))*t);c&&(p=n(p+180));let m={x:+e?.x||0,y:+e?.y||0,z:+e?.z||0,rot:+e?.rot||0},[h,g]=r(i.x-m.x,i.y-m.y,-m.rot),_=i.z-m.z,v=n(m.rot+p),[y,b]=r(h,g,v),x=e=>Math.round(e*1e6)/1e6;return{pose:{x:x(o.x-y),y:x(o.y-b),z:x(o.z-_),rot:x(v)},dtheta:x(p),opposite:!1}}var o=e=>{let t=Number(String(e??``).replace(`,`,`.`));return Number.isFinite(t)?t:0},s=e=>Math.abs(e)<1e-9?`0`:String(Math.round(e*1e3)/1e3);function c(){let e=document.getElementById(`coo-pos-dock`);return e||(e=document.createElement(`div`),e.id=`coo-pos-dock`,e.className=`clash-nav-popup closed`,e.innerHTML=`
    <div class="properties-popup-header shrink-0">
      <span class="text-sm font-bold text-slate-800">Model position</span>
      <button data-close title="Close" class="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
    </div>
    <div class="px-3 py-2 border-b border-slate-100 shrink-0 space-y-2 text-[11px]">
      <label class="block">
        <span class="text-slate-500 font-medium">Model</span>
        <select data-model class="mt-0.5 w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white"></select>
      </label>
      <div class="flex rounded border border-slate-200 overflow-hidden w-max" title="Gizmo mode">
        <button data-gmode="translate" class="px-2 py-0.5">Move</button>
        <button data-gmode="rotate" class="px-2 py-0.5 border-l border-slate-200">Rotate</button>
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        ${[`x`,`y`,`z`].map(e=>`
        <label class="flex flex-col gap-0.5 min-w-0">
          <span class="text-slate-500">${e.toUpperCase()} (m)</span>
          <input data-f="${e}" type="number" step="0.001" class="w-full px-1.5 py-1 border border-slate-200 rounded text-right text-xs">
        </label>`).join(``)}
        <label class="flex flex-col gap-0.5 min-w-0">
          <span class="text-slate-500">Rot Z (°)</span>
          <input data-f="rot" type="number" step="0.01" class="w-full px-1.5 py-1 border border-slate-200 rounded text-right text-xs">
        </label>
      </div>
      <div class="flex items-center gap-1.5">
        <button data-apply class="flex-1 px-2 py-1.5 rounded border border-indigo-300 text-indigo-700 font-semibold hover:bg-indigo-50">Apply</button>
        <button data-reset class="flex-1 px-2 py-1.5 rounded border border-red-300 text-red-700 font-semibold hover:bg-red-50" title="Back to the model's native placement">Reset</button>
      </div>
      <div class="flex items-center gap-1.5">
        <button data-view class="w-full px-2 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50" title="Translate this model so its centre lands on the other loaded models (or the camera target)">Move into view</button>
      </div>
      <div class="flex items-center gap-1.5">
        <button data-corner class="flex-1 px-2 py-1.5 rounded border border-teal-300 text-teal-700 font-semibold hover:bg-teal-50" title="Pick a corner on this model, then the goal corner. Translation only; corners snap while hovering.">Move - Corner</button>
        <button data-twopt class="flex-1 px-2 py-1.5 rounded border border-teal-300 text-teal-700 font-semibold hover:bg-teal-50" title="Pick a face on this model, then the goal face. The model rotates in plan so the faces align; the picked points meet. Vertical-ish faces only.">Align - 2 faces</button>
      </div>
      <div class="flex items-center gap-1.5">
        <div data-hint class="flex-1 text-slate-600 min-h-[16px]"></div>
        <button data-flip class="hidden px-2 py-1 rounded border border-amber-300 text-amber-700 font-semibold hover:bg-amber-50" title="Rotate the result by 180° (align facing walls instead of parallel ones)">Flip 180</button>
        <button data-pickcancel class="hidden px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
      </div>
    </div>
    <div class="px-3 py-2 shrink-0 text-[11px]">
      <button data-export class="w-full px-2 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50" title="Project workbook: INFO, EXPECTED MODELS (with X Y Z Rotation), CONTACTS">Export project configuration file</button>
      <p class="mt-2 text-slate-400 leading-snug">Moves are previews until Apply. Apply stores the position in the project (re-applied on load); closing the panel discards unsaved moves. Clash results of moved pairs rerun automatically.</p>
    </div>`,document.body.appendChild(e),e)}function l(){if(window.__cooTogglePosition)return window.__cooTogglePosition;let e=c(),t=t=>e.querySelector(t),n=t(`[data-model]`),r=t(`[data-hint]`),i=t(`[data-flip]`),l=t(`[data-pickcancel]`),u=null,d=`translate`,f=null,p=!1,m=null,h=(e,t)=>!e||!t?!!e!=!!t:[`x`,`y`,`z`,`rot`].some(n=>Math.abs((+e[n]||0)-(+t[n]||0))>1e-6),g=()=>{if(!u||!m)return;let e=window.__cooPose?.get?.(u);e&&h(e,m)&&window.__cooPose?.stage?.(u,m)},_=()=>!e.classList.contains(`closed`),v=e=>{r.textContent=e||``},y=()=>{let e=document.getElementById(`coo-btn-position`);e&&e.toggleAttribute(`active`,_())},b=()=>window.__cooModels?.list?.()||[];function x(){let e=b(),t=u;n.innerHTML=``;for(let t of e){let e=document.createElement(`option`);e.value=t.id,e.textContent=`[${t.tag||`-`}] - ${t.fileName||t.id}`,n.appendChild(e)}if(!e.length){u=null;return}u=(e.find(e=>e.id===t)||e.find(e=>e.active)||e[0]).id,n.value=u}function S(){let n=u?window.__cooPose?.get?.(u):null;for(let e of[`x`,`y`,`z`,`rot`]){let r=t(`[data-f="${e}"]`);r&&document.activeElement!==r&&(r.value=n?s(n[e]):``),r&&(r.disabled=!n)}e.querySelectorAll(`[data-apply],[data-reset],[data-view],[data-twopt],[data-corner]`).forEach(e=>{e.disabled=!u})}function C(){e.querySelectorAll(`[data-gmode]`).forEach(e=>{let t=e.dataset.gmode===d;e.classList.toggle(`bg-slate-800`,t),e.classList.toggle(`text-white`,t)})}function w(){let e={};for(let n of[`x`,`y`,`z`,`rot`])e[n]=o(t(`[data-f="${n}"]`)?.value);return e}function T(){_()&&window.__cooPose?.gizmo?.(u||null,d)}function E(e){g(),u=e||null,m=u?window.__cooPose?.get?.(u):null,n.value!==String(u||``)&&(n.value=u||``),f=null,i.classList.add(`hidden`),S(),T()}let D=()=>{document.getElementById(`nav-viewer`)?.click(),window.__leftDock?.claim?.(`position`,O),e.classList.remove(`closed`),x(),m=u?window.__cooPose?.get?.(u):null,C(),S(),T(),v(u?`Moves are previews. Apply to save.`:`Load a model first.`),y()},O=()=>{p&&A(),g(),e.classList.add(`closed`),window.__cooPose?.gizmo?.(null),window.__leftDock?.release?.(`position`),S(),y()},k=document.getElementById(`viewer-3d-section`);if(k&&`MutationObserver`in window){let e=()=>k.classList.contains(`hidden`)||k.style.display===`none`;new window.MutationObserver(()=>{_()&&e()&&O()}).observe(k,{attributes:!0,attributeFilter:[`class`,`style`]})}window.__cooTogglePosition=()=>_()?(O(),!1):(D(),!0);function A(){p=!1,window.__cooPose?.pickCancel?.(),l.classList.add(`hidden`),v(`Alignment cancelled.`),T()}async function j(){if(!u||p)return;let e=window.__cooPose;if(!e?.pickPoints){v(`Picking unavailable.`);return}p=!0,f=null,i.classList.add(`hidden`),l.classList.remove(`hidden`);try{v(`Pick a face on the model to move.`);let[t]=await e.pickPoints(1);if(!p)return;v(`Pick the goal face.`);let[n]=await e.pickPoints(1);if(!p)return;if(!t?.normal||!n?.normal){v(`No face normal at that pick, try again.`);return}let r=e.get(u);f={A:t.ifc,n1:t.normal,C:n.ifc,n2:n.normal,basePose:r},N(!1)}catch(e){p&&v(e?.message===`escape`?`Alignment cancelled.`:`Alignment failed: `+(e?.message||e))}finally{p=!1,l.classList.add(`hidden`),T()}}async function M(){if(!u||p)return;let e=window.__cooPose;if(!e?.pickPoints){v(`Picking unavailable.`);return}p=!0,f=null,i.classList.add(`hidden`),l.classList.remove(`hidden`);try{v(`Pick a corner on the model to move (corners snap).`);let[t]=await e.pickPoints(1,{snap:!0});if(!p)return;v(`Pick the goal corner.`);let[n]=await e.pickPoints(1,{snap:!0});if(!p)return;let r=e.get(u),i=e=>Math.round(e*1e6)/1e6;e.stage(u,{x:i(r.x+(n.ifc.x-t.ifc.x)),y:i(r.y+(n.ifc.y-t.ifc.y)),z:i(r.z+(n.ifc.z-t.ifc.z)),rot:r.rot}),S(),v(`Corner moved onto the goal (preview). Apply to save.`)}catch(e){p&&v(e?.message===`escape`?`Move cancelled.`:`Move failed: `+(e?.message||e))}finally{p=!1,l.classList.add(`hidden`),T()}}function N(e){if(!f||!u)return;let{A:t,n1:n,C:r,n2:o,basePose:c}=f,l=a(c,t,n,r,o,{flip:e});if(!l){v(`Faces too horizontal for a plan rotation, pick vertical faces.`);return}window.__cooPose.stage(u,l.pose),S(),v(`Rotated ${s(l.dtheta)}° to align the faces (preview). Apply to save.`),i.classList.remove(`hidden`),i.dataset.flipped=e?`1`:``}return t(`[data-close]`).addEventListener(`click`,O),n.addEventListener(`change`,()=>E(n.value)),e.querySelectorAll(`[data-gmode]`).forEach(e=>e.addEventListener(`click`,()=>{d=e.dataset.gmode,C(),window.__cooPose?.gizmoMode?.(d)})),t(`[data-apply]`).addEventListener(`click`,()=>{u&&(m=window.__cooPose?.set?.(u,w())||w(),S(),v(`Position saved to the project.`))}),t(`[data-reset]`).addEventListener(`click`,()=>{u&&(window.__cooPose?.stage?.(u,{x:0,y:0,z:0,rot:0}),S(),v(`Native placement (preview). Apply to save.`))}),t(`[data-view]`).addEventListener(`click`,()=>{if(!u)return;let e=window.__cooPose?.moveIntoView?.(u);S(),v(e?`Moved into view (preview). Apply to save.`:`Nothing to align to yet.`)}),t(`[data-twopt]`).addEventListener(`click`,j),t(`[data-corner]`).addEventListener(`click`,M),l.addEventListener(`click`,A),i.addEventListener(`click`,()=>N(i.dataset.flipped!==`1`)),e.querySelectorAll(`[data-f]`).forEach(e=>e.addEventListener(`keydown`,e=>{e.key===`Enter`&&t(`[data-apply]`).click()})),t(`[data-export]`).addEventListener(`click`,()=>{let e=window.__cooProject,t=window.XLSX;if(!t||!e?.currentName){v(`No project open yet.`);return}try{let n=e.exportProjectWorkbook(t);if(!n){v(`Export failed.`);return}let r=e.getInfo?.()||{},i=String(r.number||e.currentName||`project`).replace(/[^\w.-]+/g,`_`);t.writeFile(n,`${i}_project.xlsx`),v(`Project configuration exported.`)}catch(e){v(`Export failed: `+(e?.message||e))}}),window.addEventListener(`coo-pose-live`,e=>{if(!_()||!e.detail||e.detail.id!==u)return;let n=e.detail.pose;for(let e of[`x`,`y`,`z`,`rot`]){let r=t(`[data-f="${e}"]`);r&&document.activeElement!==r&&(r.value=s(n[e]))}}),window.addEventListener(`coo-pose-changed`,()=>{_()&&S()}),window.addEventListener(`coo-models-changed`,()=>{_()&&(x(),S(),T())}),window.__cooTogglePosition}if(typeof window<`u`&&typeof document<`u`&&!window.__cooPositionNoAuto)try{l()}catch(e){console.warn(`[coo] position panel init failed`,e)}export{e as COO_BUILD,l as initCooPosition,a as solveTwoFace,i as solveTwoPoint};