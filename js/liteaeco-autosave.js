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
// liteAECO - (liteaeco-autosave.js)
// ========

(function(){"use strict";window.liteAECO=window.liteAECO||{};function tt(key,fallback){try{if(typeof window.i18n==="function"){const v=window.i18n(key);if(v&&v!==key)return v;}
if(window.PAGE_I18N&&window.PAGE_I18N[key])return window.PAGE_I18N[key];}catch(e){}
return fallback;}
liteAECO.createAutosave=function(cfg){const DB="liteaeco-as-"+cfg.toolId;const OPTOUT="liteaeco_as_off_"+cfg.toolId;const debounceMs=cfg.debounceMs||2000;const historyEvery=cfg.historyEvery||10;const historyMax=cfg.historyMax||20;const historySkipBytes=cfg.historySkipBytes||10*1024*1024;const toast=cfg.toast||function(){};function db(){return new Promise((res)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore("kv");req.onsuccess=()=>res(req.result);req.onerror=()=>res(null);});}
async function kvSet(k,v){const d=await db();if(!d)return;return new Promise(res=>{const t=d.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res();t.onerror=()=>res();});}
async function kvGet(k){const d=await db();if(!d)return undefined;return new Promise(res=>{const r=d.transaction("kv","readonly").objectStore("kv").get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>res(undefined);});}
async function kvDel(k){const d=await db();if(!d)return;return new Promise(res=>{const t=d.transaction("kv","readwrite");t.objectStore("kv").delete(k);t.oncomplete=()=>res();t.onerror=()=>res();});}
const ns="las-"+cfg.toolId;function ensureModals(){if(document.getElementById(ns+"-resume"))return;const wrap=document.createElement("div");wrap.innerHTML=`
<div id="${ns}-resume" class="fixed inset-0 modal-overlay hidden z-[80] items-center justify-center" style="background:rgba(15,23,42,.35)">
  <div class="bg-white/95 backdrop-blur-xl border border-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[380px] overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
      <h2 class="font-bold text-sm uppercase tracking-widest text-slate-900">${tt("resumeSession", "Continue where you left off?")}</h2>
    </div>
    <div class="p-6">
      <p class="text-xs text-slate-500 mb-1">${tt("resumeDetail", "A previous session was found:")}</p>
      <p id="${ns}-resume-name" class="text-xs font-bold text-slate-700 truncate"></p>
    </div>
    <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
      <button id="${ns}-fresh" class="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 transition">${tt("startFresh", "Start Fresh")}</button>
      <button id="${ns}-continue" class="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 transition">${tt("continueBtn", "Continue")}</button>
    </div>
  </div>
</div>
<div id="${ns}-history" class="fixed inset-0 modal-overlay hidden z-[80] items-center justify-center" style="background:rgba(15,23,42,.35)">
  <div class="bg-white/95 backdrop-blur-xl border border-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-[440px] max-h-[80vh] flex flex-col overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
      <h2 class="font-bold text-sm uppercase tracking-widest text-slate-900">${tt("planHistory", "Plan History")}</h2>
      <button id="${ns}-history-close" class="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none">&#10005;</button>
    </div>
    <div id="${ns}-history-list" class="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-1.5"></div>
  </div>
</div>`;document.body.appendChild(wrap);document.getElementById(ns+"-history-close").addEventListener("click",()=>hide(ns+"-history"));}
function show(id){const m=document.getElementById(id);m.classList.remove("hidden");m.classList.add("flex");}
function hide(id){const m=document.getElementById(id);m.classList.add("hidden");m.classList.remove("flex");}
const A={adapter:null,dirty:false,timer:null,paused:false,writing:false,lastSavedAt:null,writeCount:0,channel:("BroadcastChannel"in window)?new BroadcastChannel(DB):null,sessionId:Math.random().toString(36).slice(2),optedOut(){try{return localStorage.getItem(OPTOUT)==="1";}catch(e){return false;}},setOptOut(v){try{v?localStorage.setItem(OPTOUT,"1"):localStorage.removeItem(OPTOUT);}catch(e){}},supportsFS(){return"showSaveFilePicker"in window;},_snapshotAdapter(){return{kind:"snapshot",name:tt("browserSnapshot","browser snapshot"),write:(t)=>kvSet("snapshot",t)};},markDirty(){if(!this.adapter||this.paused){this.renderStatus(this.adapter?"dirty":"off");return;}
this.dirty=true;this.renderStatus("dirty");clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),debounceMs);},async flush(){if(!this.adapter||!this.dirty||this.paused)return;this.writing=true;try{const text=JSON.stringify(cfg.buildPayload(),null,2);await this.adapter.write(text);this.dirty=false;this.lastSavedAt=new Date();this.writeCount++;if(this.writeCount % historyEvery===1&&text.length<historySkipBytes){const hist=(await kvGet("history"))||[];hist.unshift({at:new Date().toISOString(),label:(cfg.describe?cfg.describe(JSON.parse(text)):""),text});if(hist.length>historyMax)hist.length=historyMax;await kvSet("history",hist);}
this.renderStatus("saved");}catch(e){this.renderStatus("error");}
finally{this.writing=false;}},async connectFile(){this.setOptOut(false);try{if(this.supportsFS()){const handle=await showSaveFilePicker({suggestedName:"project"+(cfg.fileSuffix||".json"),types:[{description:"liteAECO",accept:{"application/json":[".json"]}}]});this.adapter={kind:"fs",handle,name:handle.name,write:async(t)=>{const w=await handle.createWritable();await w.write(t);await w.close();}};await kvSet("handle",handle);if(this.channel)this.channel.postMessage({type:"claim",session:this.sessionId});}else{this.adapter=this._snapshotAdapter();toast(tt("snapshotMode","Autosaving to this browser. Use Save to keep a file."));}
this.dirty=true;await this.flush();}catch(e){}},async disconnect(){this.setOptOut(true);clearTimeout(this.timer);this.adapter=null;this.dirty=false;await kvDel("handle");await kvDel("snapshot");this.renderStatus("off");},async boot(){ensureModals();if(this.channel){this.channel.onmessage=(ev)=>{if(ev.data&&ev.data.type==="claim"&&ev.data.session!==this.sessionId&&this.adapter){this.paused=true;this.renderStatus("error");toast(tt("multiTabWarning","This session is now autosaving in another tab \u2013 autosave here is paused."),true);}};}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&this.dirty)this.flush();});window.addEventListener("beforeunload",(e)=>{try{if(typeof cfg.hasPendingInput==="function"&&cfg.hasPendingInput()
&&typeof cfg.commitPendingInput==="function"){cfg.commitPendingInput();}}catch(err){}
if(this.adapter&&!this.paused){if(this.dirty||this.writing){this.flush();e.preventDefault();e.returnValue=tt("unsavedLeaveMessage","You have unsaved changes. Are you sure you want to leave?");return e.returnValue;}
return;}
if(typeof cfg.hasUnsaved==="function"&&cfg.hasUnsaved()){e.preventDefault();e.returnValue=tt("unsavedLeaveMessage","You have unsaved changes. Are you sure you want to leave?");return e.returnValue;}});if(this.supportsFS()){const handle=await kvGet("handle");if(handle){document.getElementById(ns+"-resume-name").textContent=handle.name||"project"+(cfg.fileSuffix||".json");show(ns+"-resume");await new Promise((resolve)=>{document.getElementById(ns+"-continue").onclick=async()=>{hide(ns+"-resume");try{const perm=await handle.requestPermission({mode:"readwrite"});if(perm!=="granted")throw new Error("perm");const file=await handle.getFile();const data=JSON.parse(await file.text());if(cfg.applyPayload(data)){this.adapter={kind:"fs",handle,name:handle.name,write:async(t)=>{const w=await handle.createWritable();await w.write(t);await w.close();}};this.lastSavedAt=new Date();this.renderStatus("saved");if(this.channel)this.channel.postMessage({type:"claim",session:this.sessionId});}}catch(e){toast(tt("resumeFailed","Could not reopen the last session file."),true);await kvDel("handle");}
resolve();};document.getElementById(ns+"-fresh").onclick=async()=>{hide(ns+"-resume");await kvDel("handle");await kvDel("snapshot");resolve();};});if(this.adapter)return;}}
if(!this.optedOut()){const snap=await kvGet("snapshot");if(snap!==undefined&&snap!==null){try{const data=typeof snap==="string"?JSON.parse(snap):snap;if(cfg.applyPayload(data)){this.adapter=this._snapshotAdapter();this.lastSavedAt=new Date();this.renderStatus("saved");return;}}catch(e){await kvDel("snapshot");}}
this.adapter=this._snapshotAdapter();this.dirty=true;setTimeout(()=>this.flush(),1500);return;}
this.renderStatus("off");},async openHistory(){ensureModals();const list=document.getElementById(ns+"-history-list");list.innerHTML=`<p class="text-xs text-slate-400">${tt("loading", "Loading\u2026")}</p>`;show(ns+"-history");const hist=(await kvGet("history"))||[];if(hist.length===0){list.innerHTML=`<p class="text-xs text-slate-400">${tt("noHistory", "No snapshots yet \u2013 they are created automatically while autosave is active.")}</p>`;return;}
list.innerHTML="";hist.forEach((h,i)=>{const row=document.createElement("div");row.className="flex items-center justify-between px-3 py-2 border border-slate-100 rounded-lg hover:bg-slate-50";row.innerHTML=`<span class="text-xs text-slate-600">${new Date(h.at).toLocaleString()} <span class="text-slate-400">${h.label ? "\u00B7 " + h.label : ""}</span></span>
                        <button class="text-[10px] px-2 py-1 border border-slate-200 rounded hover:border-indigo-400 hover:text-indigo-600 transition uppercase font-bold">${tt("restore", "Restore")}</button>`;row.querySelector("button").addEventListener("click",async()=>{try{if(cfg.applyPayload(JSON.parse(hist[i].text))){hide(ns+"-history");this.markDirty();}}catch(e){toast(tt("resumeFailed","Could not reopen the last session file."),true);}});list.appendChild(row);});},_toastEl:null,_toastTimer:null,_toastArmed:false,toastNotify(state){if(state==="off"){clearTimeout(this._toastTimer);this._toastArmed=false;if(this._toastEl){this._toastEl.remove();this._toastEl=null;}
return;}
if(state==="saved"&&!this._toastArmed)return;if(state==="dirty"||state==="error")this._toastArmed=true;let wrap=document.getElementById("las-toasts");if(!wrap){wrap=document.createElement("div");wrap.id="las-toasts";wrap.style.cssText="position:fixed;bottom:1rem;right:1rem;z-index:90;display:flex;flex-direction:column;gap:.5rem;align-items:flex-end;pointer-events:none;";document.body.appendChild(wrap);}
if(!this._toastEl){const t=document.createElement("div");t.style.cssText="display:flex;align-items:center;gap:.5rem;background:#fff;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,.08);border-radius:.5rem;padding:.6rem 1rem;font-size:13px;font-weight:600;color:#334155;transition:opacity .5s;";t.innerHTML='<span data-ic style="display:inline-flex;width:16px;height:16px;flex-shrink:0"></span><span data-tx></span>';wrap.appendChild(t);this._toastEl=t;}
clearTimeout(this._toastTimer);const el=this._toastEl;const ic=el.querySelector("[data-ic]");const tx=el.querySelector("[data-tx]");el.style.opacity="1";const SPIN='<svg style="animation:las-spin 1s linear infinite" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#94a3b8" stroke-width="3" opacity=".25"></circle><path d="M22 12a10 10 0 0 1-10 10" stroke="#6366f1" stroke-width="3" stroke-linecap="round"></path></svg>';const CHECK='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';const WARN='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>';if(!document.getElementById("las-spin-kf")){const st=document.createElement("style");st.id="las-spin-kf";st.textContent="@keyframes las-spin{to{transform:rotate(360deg)}}";document.head.appendChild(st);}
if(state==="dirty"){ic.innerHTML=SPIN;tx.textContent=tt("toastSaving","Saving...");}else if(state==="saved"){ic.innerHTML=CHECK;tx.textContent=tt("toastSaved","Saved");this._toastArmed=false;const self=this;this._toastTimer=setTimeout(function(){el.style.opacity="0";self._toastTimer=setTimeout(function(){el.remove();if(self._toastEl===el)self._toastEl=null;},600);},1800);}else if(state==="error"){ic.innerHTML=WARN;tx.textContent=tt("toastSaveError","Not saved - check the Save menu");}},_pickIcons(v){if(!v)return[];const ids=Array.isArray(v)?v:String(v).split(",");const out=[];for(const raw of ids){const id=String(raw).trim();if(!id)continue;const el=document.getElementById(id);if(el&&out.indexOf(el)===-1)out.push(el);}
return out;},renderStatus(state){this.toastNotify(state);const offs=this._pickIcons(cfg.iconOffId);const ons=this._pickIcons(cfg.iconOnId);const disc=cfg.disconnectBtnId?document.getElementById(cfg.disconnectBtnId):null;if(!offs.length||!ons.length)return;const COLORS=["text-white","text-green-600","text-slate-600","text-amber-500","text-rose-500"];const setTitle=(title)=>{offs.forEach((o)=>{const b=o.closest("button");if(b)b.title=title;});ons.forEach((o)=>{const b=o.closest("button");if(b)b.title=title;});};const setOn=(color,title)=>{offs.forEach((o)=>o.classList.add("hidden"));ons.forEach((o)=>{o.classList.remove("hidden");COLORS.forEach((c)=>o.classList.remove(c));o.classList.add(color);});setTitle(title);if(disc)disc.classList.remove("hidden");};if(state==="saved"){const t=this.lastSavedAt;setOn("text-slate-600",tt("autosaved","Autosaved")+" "+String(t.getHours()).padStart(2,"0")+":"+String(t.getMinutes()).padStart(2,"0"));}else if(state==="dirty"){setOn("text-amber-500",tt("autosaveDirty","Autosave: unsaved changes\u2026"));}else if(state==="error"){setOn("text-rose-500",tt("autosaveReconnectShort","Autosave: reconnect needed \u2013 open the Save menu"));}else{ons.forEach((o)=>{o.classList.add("hidden");COLORS.forEach((c)=>o.classList.remove(c));});offs.forEach((o)=>o.classList.remove("hidden"));setTitle(tt("autosaveOff","Autosave off \u2013 enable it in this menu"));if(disc)disc.classList.add("hidden");}
if(window.lucide)try{lucide.createIcons();}catch(e){}}};return A;};})();