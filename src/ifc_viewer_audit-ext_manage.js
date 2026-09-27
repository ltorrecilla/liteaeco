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
// liteAECO - (ifc_viewer_audit-ext_manage.js)
// ========

var e=11;function t(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function n(e){let t=document.createElement(`template`);return t.innerHTML=e.trim(),t.content.firstElementChild}var r=`px-2 py-0.5 text-[11px] font-semibold rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40`;function i(e,r,i,a){let o=n(`<button class="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent" title="${t(r)}"${a?` disabled`:``}><i data-lucide="${t(e)}" class="w-3.5 h-3.5"></i></button>`);return o.addEventListener(`click`,i),o}var a=`border border-slate-300 rounded px-1 py-0.5 text-[11px] bg-white text-slate-700 outline-none min-w-0`,o=`flex-1 min-w-0 border border-slate-300 rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-indigo-400`;function s(e){let s=()=>Object.keys(e.state.lists||{}),c={cls:e.state.activeClass||s()[0]||``,disc:e.state.disciplines[0]?.id||``,group:e.state.groups[0]?.id||``,search:``},l=null,u=n(`
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40">
      <div class="bg-white rounded-md shadow-2xl w-[860px] max-w-[95vw] h-[660px] max-h-[88vh] flex flex-col p-4 gap-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
          <h3 class="text-sm font-bold text-slate-800">Data Structure, disciplines, groups &amp; attributes</h3>
          <button data-x class="text-slate-400 hover:text-slate-700">&#10005;</button>
        </div>
        <div data-body class="flex-1 min-h-0 grid grid-cols-[1fr_1fr_1.7fr] gap-3"></div>
        <div class="flex justify-between items-center pt-2 border-t border-slate-100 shrink-0">
          <span class="text-[11px] text-slate-400 italic">Disciplines and groups are shared by all IFC classes. Attributes belong to one class. All changes are undoable from the toolbar.</span>
          <button data-close class="${r}">Close</button>
        </div>
      </div>
    </div>
  `),d=u.querySelector(`[data-body]`),f=()=>u.remove();u.querySelector(`[data-x]`).addEventListener(`click`,f),u.querySelector(`[data-close]`).addEventListener(`click`,f),u.addEventListener(`mousedown`,e=>{e.target===u&&f()});function p({title:e,items:a,deleteWarning:s,onAdd:c,onRename:l,onDelete:u,onMove:d,addPlaceholder:f}){let p=n(`
      <div class="flex flex-col min-h-0 border border-slate-200 rounded-lg overflow-hidden">
        <div class="px-2 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 shrink-0">${t(e)}</div>
        <div data-list class="flex-1 min-h-0 overflow-y-auto scrollbar-thin"></div>
      </div>
    `),m=p.querySelector(`[data-list]`);a.forEach((e,r)=>{let o=n(`
        <div class="flex items-center gap-1 px-2 h-7 shrink-0 border-b border-slate-50 group">
          <span class="flex-1 min-w-0 truncate text-xs text-slate-700" title="${t(e.name)}">${t(e.name)}</span>
          <span data-tools class="hidden group-hover:flex items-center gap-0.5 shrink-0"></span>
        </div>
      `),c=o.querySelector(`[data-tools]`);c.appendChild(i(`chevron-up`,`Move up`,()=>{d(e.id,`up`),_()},r===0)),c.appendChild(i(`chevron-down`,`Move down`,()=>{d(e.id,`down`),_()},r===a.length-1)),c.appendChild(i(`pencil`,`Rename`,()=>{let t=window.prompt(`New name:`,e.name);t&&t.trim()&&(l(e.id,t.trim()),_())})),c.appendChild(i(`trash-2`,s,()=>{window.confirm(`Delete "${e.name}"?\n\n${s}`)&&(u(e.id),_())})),m.appendChild(o)}),a.length||m.appendChild(n(`<p class="text-[11px] text-slate-400 italic text-center py-4">Empty</p>`));let h=n(`
      <div class="p-1.5 border-t border-slate-100 flex gap-1 shrink-0">
        <input data-add-input class="${o}" placeholder="${t(f)}" />
        <button data-add-btn class="${r}">Add</button>
      </div>
    `),g=h.querySelector(`[data-add-input]`),v=()=>{let e=g.value.trim();e&&(c(e),_())};return h.querySelector(`[data-add-btn]`).addEventListener(`click`,v),g.addEventListener(`keydown`,e=>{e.key===`Enter`&&v()}),p.appendChild(h),p}function m(){let i=e.state,l=s();c.cls&&!l.includes(c.cls)&&(c.cls=l[0]||``),i.disciplines.some(e=>e.id===c.disc)||(c.disc=i.disciplines[0]?.id||``),i.groups.some(e=>e.id===c.group)||(c.group=i.groups[0]?.id||``);let u=n(`
      <div class="flex flex-col min-h-0 border border-slate-200 rounded-lg overflow-hidden">
        <div class="px-2 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 shrink-0">Attributes</div>
        <div class="p-1.5 border-b border-slate-100 flex flex-col gap-1 shrink-0 bg-slate-50/50">
          <div class="flex gap-1 items-center">
            <span class="text-[10px] font-semibold text-slate-400 w-14 shrink-0">IFC class</span>
            <select data-f-cls class="${a} flex-1">${l.map(e=>`<option value="${t(e)}"${e===c.cls?` selected`:``}>${t(e)}</option>`).join(``)||`<option value="">- link a class first -</option>`}</select>
          </div>
          <div class="flex gap-1 items-center">
            <span class="text-[10px] font-semibold text-slate-400 w-14 shrink-0">Discipline</span>
            <select data-f-disc class="${a} flex-1">${i.disciplines.map(e=>`<option value="${t(e.id)}"${e.id===c.disc?` selected`:``}>${t(e.name)}</option>`).join(``)||`<option value="">- add a discipline -</option>`}</select>
          </div>
          <div class="flex gap-1 items-center">
            <span class="text-[10px] font-semibold text-slate-400 w-14 shrink-0">Group</span>
            <select data-f-grp class="${a} flex-1">${i.groups.map(e=>`<option value="${t(e.id)}"${e.id===c.group?` selected`:``}>${t(e.name)}</option>`).join(``)||`<option value="">- add a group -</option>`}</select>
          </div>
          <div class="flex gap-1 items-center">
            <input data-f-name class="${o}" placeholder="New attribute name" />
            <button data-f-add class="${r}">Add attribute</button>
          </div>
        </div>
        <div class="px-1.5 py-1 border-b border-slate-100 flex gap-1 items-center shrink-0">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
          <input data-f-search class="${o}" placeholder="Search attributes (name, class, discipline, group)" value="${t(c.search)}" />
        </div>
        <div data-list class="flex-1 min-h-0 overflow-y-auto scrollbar-thin"></div>
      </div>
    `),d=u.querySelector(`[data-f-search]`);d.addEventListener(`input`,()=>{c.search=d.value,h(u.querySelector(`[data-list]`))}),u.querySelector(`[data-f-cls]`).addEventListener(`change`,e=>c.cls=e.target.value),u.querySelector(`[data-f-disc]`).addEventListener(`change`,e=>c.disc=e.target.value),u.querySelector(`[data-f-grp]`).addEventListener(`change`,e=>c.group=e.target.value);let f=u.querySelector(`[data-f-name]`),p=()=>{let t=f.value.trim();if(t){if(!c.cls){window.alert(`Link an IFC class in the table first.`);return}if(!c.disc){window.alert(`Add a discipline first.`);return}if(!c.group){window.alert(`Add a group first.`);return}e.addAttribute({name:t,ifcClass:c.cls,disciplineId:c.disc,groupId:c.group})&&(f.value=``,_())}};return u.querySelector(`[data-f-add]`).addEventListener(`click`,p),f.addEventListener(`keydown`,e=>{e.key===`Enter`&&p()}),h(u.querySelector(`[data-list]`)),u}function h(r){r.innerHTML=``;let a=c.search.trim().toLowerCase(),o=e.listAttributes(),s=a?o.filter(({attr:e,discipline:t,group:n})=>e.name.toLowerCase().includes(a)||e.ifcClass.toLowerCase().includes(a)||(t?.name||``).toLowerCase().includes(a)||(n?.name||``).toLowerCase().includes(a)):o;s.forEach(({attr:o,discipline:c,group:u},d)=>{if(l===o.id){r.appendChild(g(o));return}let f=n(`
        <div class="flex items-center gap-1 px-2 h-7 shrink-0 border-b border-slate-50 group">
          <span class="min-w-0 truncate text-xs text-slate-700 font-medium" title="${t(o.name)}">${t(o.name)}</span>
          <span class="text-[9px] font-bold text-slate-500 border border-slate-300 rounded px-1 shrink-0" title="IFC class">${t(o.ifcClass)}</span>
          <span class="text-[9px] text-indigo-500 border border-indigo-200 rounded px-1 shrink-0 truncate max-w-[80px]" title="Discipline">${t(c?.name||`?`)}</span>
          <span class="text-[9px] text-emerald-600 border border-emerald-200 rounded px-1 shrink-0 truncate max-w-[80px]" title="Group">${t(u?.name||`?`)}</span>
          <span class="flex-1"></span>
          <span data-tools class="hidden group-hover:flex items-center gap-0.5 shrink-0"></span>
        </div>
      `),p=f.querySelector(`[data-tools]`);p.appendChild(i(`chevron-up`,`Move up`,()=>{e.moveAttribute(o.id,`up`),_()},!!a||d===0)),p.appendChild(i(`chevron-down`,`Move down`,()=>{e.moveAttribute(o.id,`down`),_()},!!a||d===s.length-1)),p.appendChild(i(`pencil`,`Rename or relink class / discipline / group`,()=>{l=o.id,_()})),p.appendChild(i(`trash-2`,`Deletes the attribute and its values everywhere`,()=>{window.confirm(`Delete attribute "${o.name}"?\n\nIts values are removed from all rows. Undoable from the toolbar.`)&&(e.deleteAttribute(o.id),_())})),r.appendChild(f)}),s.length||r.appendChild(n(`<p class="text-[11px] text-slate-400 italic text-center py-4">${a?`No attributes match the search.`:`No attributes yet - use the form above.`}</p>`)),window.lucide?.createIcons&&window.lucide.createIcons()}function g(i){let c=e.state,u=s(),d=n(`
      <div class="flex flex-col gap-1 px-2 py-1.5 border-b border-slate-100 bg-indigo-50/40">
        <input data-e-name class="${o}" value="${t(i.name)}" />
        <div class="flex gap-1">
          <select data-e-cls class="${a} flex-1">${u.map(e=>`<option value="${t(e)}"${e===i.ifcClass?` selected`:``}>${t(e)}</option>`).join(``)}</select>
          <select data-e-disc class="${a} flex-1">${c.disciplines.map(e=>`<option value="${t(e.id)}"${e.id===i.disciplineId?` selected`:``}>${t(e.name)}</option>`).join(``)}</select>
          <select data-e-grp class="${a} flex-1">${c.groups.map(e=>`<option value="${t(e.id)}"${e.id===i.groupId?` selected`:``}>${t(e.name)}</option>`).join(``)}</select>
        </div>
        <div class="flex gap-1 justify-end">
          <button data-e-cancel class="${r}">Cancel</button>
          <button data-e-ok class="${r}">Save</button>
        </div>
      </div>
    `);return d.querySelector(`[data-e-cancel]`).addEventListener(`click`,()=>{l=null,_()}),d.querySelector(`[data-e-ok]`).addEventListener(`click`,()=>{e.updateAttribute(i.id,{name:d.querySelector(`[data-e-name]`).value.trim()||i.name,ifcClass:d.querySelector(`[data-e-cls]`).value,disciplineId:d.querySelector(`[data-e-disc]`).value,groupId:d.querySelector(`[data-e-grp]`).value}),l=null,_()}),d}function _(){d.innerHTML=``,d.appendChild(p({title:`Disciplines`,items:e.state.disciplines,deleteWarning:`Its attributes and their values are deleted everywhere. Undoable from the toolbar.`,onAdd:t=>e.addDiscipline(t),onRename:(t,n)=>e.renameDiscipline(t,n),onDelete:t=>e.deleteDiscipline(t),onMove:(t,n)=>e.moveDiscipline(t,n),addPlaceholder:`New discipline`})),d.appendChild(p({title:`Groups (shared)`,items:e.state.groups,deleteWarning:`Its attributes and their values are deleted everywhere. Undoable from the toolbar.`,onAdd:t=>e.addGroup(t),onRename:(t,n)=>e.renameGroup(t,n),onDelete:t=>e.deleteGroup(t),onMove:(t,n)=>e.moveGroup(t,n),addPlaceholder:`New group`})),d.appendChild(m()),window.lucide?.createIcons&&window.lucide.createIcons()}_(),document.body.appendChild(u)}export{e as EXT_BUILD,s as openManageDialog};