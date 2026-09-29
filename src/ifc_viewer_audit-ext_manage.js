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

var e=11,t=(e,t,n)=>typeof window<`u`&&typeof window.t==`function`?window.t(e,t,n):n?String(t).replace(/\{(\w+)\}/g,(e,t)=>n[t]==null?e:String(n[t])):t;function n(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function r(e){let t=document.createElement(`template`);return t.innerHTML=e.trim(),t.content.firstElementChild}var i=`px-2 py-0.5 text-[11px] font-semibold rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40`,a=`p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent`;function o(e,t,i,o){let s=r(`<button class="${a}" title="${n(t)}"${o?` disabled`:``}><i data-lucide="${n(e)}" class="w-3.5 h-3.5"></i></button>`);return s.addEventListener(`click`,i),s}var s=`border border-slate-300 rounded px-1 py-0.5 text-[11px] bg-white text-slate-700 outline-none min-w-0`,c=`flex-1 min-w-0 border border-slate-300 rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-indigo-400`;function l(e){let a=()=>Object.keys(e.state.lists||{}),l={cls:e.state.activeClass||a()[0]||``,disc:e.state.disciplines[0]?.id||``,group:e.state.groups[0]?.id||``,search:``},u=null,d=r(`
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40">
      <div class="bg-white rounded-md shadow-2xl w-[860px] max-w-[95vw] h-[660px] max-h-[88vh] flex flex-col p-4 gap-3">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
          <h3 class="text-sm font-bold text-slate-800" data-i18n="extMgTitle">${n(t(`extMgTitle`,`Data Structure, disciplines, groups & attributes`))}</h3>
          <button data-x class="text-slate-400 hover:text-slate-700">&#10005;</button>
        </div>
        <div data-body class="flex-1 min-h-0 grid grid-cols-[1fr_1fr_1.7fr] gap-3"></div>
        <div class="flex justify-between items-center pt-2 border-t border-slate-100 shrink-0">
          <span class="text-[11px] text-slate-400 italic" data-i18n="extMgFooter">${n(t(`extMgFooter`,`Disciplines and groups are shared by all IFC classes. Attributes belong to one class. All changes are undoable from the toolbar.`))}</span>
          <button data-close class="${i}" data-i18n="extClose">${n(t(`extClose`,`Close`))}</button>
        </div>
      </div>
    </div>
  `),f=d.querySelector(`[data-body]`),p=()=>{d.isConnected&&y()},m=()=>{d.remove(),document.removeEventListener(`languageLoaded`,p)};d.querySelector(`[data-x]`).addEventListener(`click`,m),d.querySelector(`[data-close]`).addEventListener(`click`,m),d.addEventListener(`mousedown`,e=>{e.target===d&&m()}),document.addEventListener(`languageLoaded`,p);function h({title:e,items:a,deleteWarning:s,onAdd:l,onRename:u,onDelete:d,onMove:f,addPlaceholder:p}){let m=r(`
      <div class="flex flex-col min-h-0 border border-slate-200 rounded-lg overflow-hidden">
        <div class="px-2 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 shrink-0">${n(e)}</div>
        <div data-list class="flex-1 min-h-0 overflow-y-auto scrollbar-thin"></div>
      </div>
    `),h=m.querySelector(`[data-list]`);a.forEach((e,i)=>{let c=r(`
        <div class="flex items-center gap-1 px-2 h-7 shrink-0 border-b border-slate-50 group">
          <span class="flex-1 min-w-0 truncate text-xs text-slate-700" title="${n(e.name)}">${n(e.name)}</span>
          <span data-tools class="hidden group-hover:flex items-center gap-0.5 shrink-0"></span>
        </div>
      `),l=c.querySelector(`[data-tools]`);l.appendChild(o(`chevron-up`,t(`extMgMoveUp`,`Move up`),()=>{f(e.id,`up`),y()},i===0)),l.appendChild(o(`chevron-down`,t(`extMgMoveDown`,`Move down`),()=>{f(e.id,`down`),y()},i===a.length-1)),l.appendChild(o(`pencil`,t(`extMgRename`,`Rename`),()=>{let n=window.prompt(t(`extMgNewName`,`New name:`),e.name);n&&n.trim()&&(u(e.id,n.trim()),y())})),l.appendChild(o(`trash-2`,s,()=>{window.confirm(t(`extMgCfDelete`,`Delete "{name}"?`,{name:e.name})+`

`+s)&&(d(e.id),y())})),h.appendChild(c)}),a.length||h.appendChild(r(`<p class="text-[11px] text-slate-400 italic text-center py-4">${n(t(`extMgEmpty`,`Empty`))}</p>`));let g=r(`
      <div class="p-1.5 border-t border-slate-100 flex gap-1 shrink-0">
        <input data-add-input class="${c}" placeholder="${n(p)}" />
        <button data-add-btn class="${i}">${n(t(`loadAdd`,`Add`))}</button>
      </div>
    `),_=g.querySelector(`[data-add-input]`),v=()=>{let e=_.value.trim();e&&(l(e),y())};return g.querySelector(`[data-add-btn]`).addEventListener(`click`,v),_.addEventListener(`keydown`,e=>{e.key===`Enter`&&v()}),m.appendChild(g),m}function g(){let o=e.state,u=a();l.cls&&!u.includes(l.cls)&&(l.cls=u[0]||``),o.disciplines.some(e=>e.id===l.disc)||(l.disc=o.disciplines[0]?.id||``),o.groups.some(e=>e.id===l.group)||(l.group=o.groups[0]?.id||``);let d=r(`
      <div class="flex flex-col min-h-0 border border-slate-200 rounded-lg overflow-hidden">
        <div class="px-2 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 shrink-0">${n(t(`extMgAttributes`,`Attributes`))}</div>
        <div class="p-1.5 border-b border-slate-100 flex flex-col gap-1 shrink-0 bg-slate-50/50">
          <div class="flex gap-1 items-center">
            <span class="text-[10px] font-semibold text-slate-400 w-14 shrink-0">${n(t(`vfltIfcClass`,`IFC class`))}</span>
            <select data-f-cls class="${s} flex-1">${u.map(e=>`<option value="${n(e)}"${e===l.cls?` selected`:``}>${n(e)}</option>`).join(``)||`<option value="">${n(t(`extMgLinkClassFirst`,`- link a class first -`))}</option>`}</select>
          </div>
          <div class="flex gap-1 items-center">
            <span class="text-[10px] font-semibold text-slate-400 w-14 shrink-0">${n(t(`extDiscipline`,`Discipline`))}</span>
            <select data-f-disc class="${s} flex-1">${o.disciplines.map(e=>`<option value="${n(e.id)}"${e.id===l.disc?` selected`:``}>${n(e.name)}</option>`).join(``)||`<option value="">${n(t(`extMgAddDisciplineOpt`,`- add a discipline -`))}</option>`}</select>
          </div>
          <div class="flex gap-1 items-center">
            <span class="text-[10px] font-semibold text-slate-400 w-14 shrink-0">${n(t(`extGroup`,`Group`))}</span>
            <select data-f-grp class="${s} flex-1">${o.groups.map(e=>`<option value="${n(e.id)}"${e.id===l.group?` selected`:``}>${n(e.name)}</option>`).join(``)||`<option value="">${n(t(`extMgAddGroupOpt`,`- add a group -`))}</option>`}</select>
          </div>
          <div class="flex gap-1 items-center">
            <input data-f-name class="${c}" placeholder="${n(t(`extMgNewAttribute`,`New attribute name`))}" />
            <button data-f-add class="${i}">${n(t(`extMgAddAttribute`,`Add attribute`))}</button>
          </div>
        </div>
        <div class="px-1.5 py-1 border-b border-slate-100 flex gap-1 items-center shrink-0">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
          <input data-f-search class="${c}" placeholder="${n(t(`extMgSearchAttrs`,`Search attributes (name, class, discipline, group)`))}" value="${n(l.search)}" />
        </div>
        <div data-list class="flex-1 min-h-0 overflow-y-auto scrollbar-thin"></div>
      </div>
    `),f=d.querySelector(`[data-f-search]`);f.addEventListener(`input`,()=>{l.search=f.value,_(d.querySelector(`[data-list]`))}),d.querySelector(`[data-f-cls]`).addEventListener(`change`,e=>l.cls=e.target.value),d.querySelector(`[data-f-disc]`).addEventListener(`change`,e=>l.disc=e.target.value),d.querySelector(`[data-f-grp]`).addEventListener(`change`,e=>l.group=e.target.value);let p=d.querySelector(`[data-f-name]`),m=()=>{let n=p.value.trim();if(n){if(!l.cls){window.alert(t(`extMgAlertClass`,`Link an IFC class in the table first.`));return}if(!l.disc){window.alert(t(`extMgAlertDiscipline`,`Add a discipline first.`));return}if(!l.group){window.alert(t(`extMgAlertGroup`,`Add a group first.`));return}e.addAttribute({name:n,ifcClass:l.cls,disciplineId:l.disc,groupId:l.group})&&(p.value=``,y())}};return d.querySelector(`[data-f-add]`).addEventListener(`click`,m),p.addEventListener(`keydown`,e=>{e.key===`Enter`&&m()}),_(d.querySelector(`[data-list]`)),d}function _(i){i.innerHTML=``;let a=l.search.trim().toLowerCase(),s=e.listAttributes(),c=a?s.filter(({attr:e,discipline:t,group:n})=>e.name.toLowerCase().includes(a)||e.ifcClass.toLowerCase().includes(a)||(t?.name||``).toLowerCase().includes(a)||(n?.name||``).toLowerCase().includes(a)):s;c.forEach(({attr:s,discipline:l,group:d},f)=>{if(u===s.id){i.appendChild(v(s));return}let p=r(`
        <div class="flex items-center gap-1 px-2 h-7 shrink-0 border-b border-slate-50 group">
          <span class="min-w-0 truncate text-xs text-slate-700 font-medium" title="${n(s.name)}">${n(s.name)}</span>
          <span class="text-[9px] font-bold text-slate-500 border border-slate-300 rounded px-1 shrink-0" title="${n(t(`vfltIfcClass`,`IFC class`))}">${n(s.ifcClass)}</span>
          <span class="text-[9px] text-indigo-500 border border-indigo-200 rounded px-1 shrink-0 truncate max-w-[80px]" title="${n(t(`extDiscipline`,`Discipline`))}">${n(l?.name||`?`)}</span>
          <span class="text-[9px] text-emerald-600 border border-emerald-200 rounded px-1 shrink-0 truncate max-w-[80px]" title="${n(t(`extGroup`,`Group`))}">${n(d?.name||`?`)}</span>
          <span class="flex-1"></span>
          <span data-tools class="hidden group-hover:flex items-center gap-0.5 shrink-0"></span>
        </div>
      `),m=p.querySelector(`[data-tools]`);m.appendChild(o(`chevron-up`,t(`extMgMoveUp`,`Move up`),()=>{e.moveAttribute(s.id,`up`),y()},!!a||f===0)),m.appendChild(o(`chevron-down`,t(`extMgMoveDown`,`Move down`),()=>{e.moveAttribute(s.id,`down`),y()},!!a||f===c.length-1)),m.appendChild(o(`pencil`,t(`extMgRelinkTip`,`Rename or relink class / discipline / group`),()=>{u=s.id,y()})),m.appendChild(o(`trash-2`,t(`extMgDeleteAttrTip`,`Deletes the attribute and its values everywhere`),()=>{window.confirm(t(`extMgCfDeleteAttr`,`Delete attribute "{name}"?

Its values are removed from all rows. Undoable from the toolbar.`,{name:s.name}))&&(e.deleteAttribute(s.id),y())})),i.appendChild(p)}),c.length||i.appendChild(r(`<p class="text-[11px] text-slate-400 italic text-center py-4">${n(a?t(`extMgNoMatch`,`No attributes match the search.`):t(`extMgNoAttrs`,`No attributes yet - use the form above.`))}</p>`)),window.lucide?.createIcons&&window.lucide.createIcons()}function v(o){let l=e.state,d=a(),f=r(`
      <div class="flex flex-col gap-1 px-2 py-1.5 border-b border-slate-100 bg-indigo-50/40">
        <input data-e-name class="${c}" value="${n(o.name)}" />
        <div class="flex gap-1">
          <select data-e-cls class="${s} flex-1">${d.map(e=>`<option value="${n(e)}"${e===o.ifcClass?` selected`:``}>${n(e)}</option>`).join(``)}</select>
          <select data-e-disc class="${s} flex-1">${l.disciplines.map(e=>`<option value="${n(e.id)}"${e.id===o.disciplineId?` selected`:``}>${n(e.name)}</option>`).join(``)}</select>
          <select data-e-grp class="${s} flex-1">${l.groups.map(e=>`<option value="${n(e.id)}"${e.id===o.groupId?` selected`:``}>${n(e.name)}</option>`).join(``)}</select>
        </div>
        <div class="flex gap-1 justify-end">
          <button data-e-cancel class="${i}">${n(t(`btnCancel`,`Cancel`))}</button>
          <button data-e-ok class="${i}">${n(t(`extSave`,`Save`))}</button>
        </div>
      </div>
    `);return f.querySelector(`[data-e-cancel]`).addEventListener(`click`,()=>{u=null,y()}),f.querySelector(`[data-e-ok]`).addEventListener(`click`,()=>{e.updateAttribute(o.id,{name:f.querySelector(`[data-e-name]`).value.trim()||o.name,ifcClass:f.querySelector(`[data-e-cls]`).value,disciplineId:f.querySelector(`[data-e-disc]`).value,groupId:f.querySelector(`[data-e-grp]`).value}),u=null,y()}),f}function y(){f.innerHTML=``;let n=t(`extMgDeleteWarn`,`Its attributes and their values are deleted everywhere. Undoable from the toolbar.`);f.appendChild(h({title:t(`extMgDisciplines`,`Disciplines`),items:e.state.disciplines,deleteWarning:n,onAdd:t=>e.addDiscipline(t),onRename:(t,n)=>e.renameDiscipline(t,n),onDelete:t=>e.deleteDiscipline(t),onMove:(t,n)=>e.moveDiscipline(t,n),addPlaceholder:t(`extMgNewDiscipline`,`New discipline`)})),f.appendChild(h({title:t(`extMgGroupsShared`,`Groups (shared)`),items:e.state.groups,deleteWarning:n,onAdd:t=>e.addGroup(t),onRename:(t,n)=>e.renameGroup(t,n),onDelete:t=>e.deleteGroup(t),onMove:(t,n)=>e.moveGroup(t,n),addPlaceholder:t(`extMgNewGroup`,`New group`)})),f.appendChild(g()),window.lucide?.createIcons&&window.lucide.createIcons()}y(),document.body.appendChild(d)}export{e as EXT_BUILD,l as openManageDialog};