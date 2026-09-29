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
// liteAECO - (ifc_viewer_audit-coo_bcf_shared.js)
// ========

var e=typeof window<`u`&&window.liteAECO&&window.liteAECO.bcf||null,t=e&&e.STATUSES||[`Active`,`In Progress`,`In Review`,`Done`,`Closed`],n=e&&e.TYPES||[`Conflict`,`Coordination`,`Comment`,`Design`,`Defect`,`Request`,`Requirement`,`Decision`,`Task`],r=e&&e.PRIORITIES||[`Low`,`Normal`,`Major`,`Critical`],i=e&&e.STAGES||[`Design`,`Tender`,`Construction`,`Handover`,`Operation`],a=e&&e.CLOSED||[`Done`,`Closed`],o=[`ARC`,`STR`,`ELE`,`HVAC`,`SAN`,`MEP`,`VOID`,`FUR`,`INT`,`FAC`,`FND`,`LAN`,`PRO`,`LAB`,`ICT`,`SEC`];function s(e,t,n){let r=(typeof window<`u`&&window.BASE_PAGE||{})[e]||t;return n?c(r,n):r}function c(e,t){return String(e).replace(/\{(\w+)\}/g,(e,n)=>t&&t[n]!=null?String(t[n]):e)}function l(e,t){let n=e=>typeof t==`function`?t(e.guid):null,r=new Set(a),i=e=>r.has(e&&e.status);function o(e){let t=e&&e.comments;return t?typeof t.values==`function`?[...t.values()]:[...t]:[]}function s({search:t=``,status:r=``,sort:i=`created-desc`}={}){let a=String(t).trim().toLowerCase(),o=e();r&&(o=o.filter(e=>e.status===r));let s=/^#?\d+$/.test(a)?Number(a.replace(`#`,``)):null;s===null?a&&(o=o.filter(e=>`${n(e)||``} ${e.title} ${e.description||``} ${e.assignedTo||``} ${e.status} ${e.type||``} ${[...e.labels||[]].join(` `)}`.toLowerCase().includes(a))):o=o.filter(e=>n(e)===s);let c=e=>e?new Date(e).getTime():0;return o.sort((e,t)=>i===`due-asc`?c(e.dueDate)-c(t.dueDate):c(t.creationDate)-c(e.creationDate)),o}function c(t){let n=e(),r={total:n.length,open:0,inProgress:0,closed:0,overdue:0},a=t||Date.now();for(let e of n)i(e)?r.closed++:e.status===`In Progress`||e.status===`In Review`?r.inProgress++:r.open++,!i(e)&&e.dueDate&&new Date(e.dueDate).getTime()<a&&r.overdue++;let o=n.map(e=>new Date(e.creationDate).getTime()).filter(e=>isFinite(e)&&e>0).sort((e,t)=>e-t),s=n.filter(i).map(e=>new Date(e.modifiedDate||e.creationDate).getTime()).filter(e=>isFinite(e)&&e>0).sort((e,t)=>e-t);if(!o.length)return{counts:r,timeline:[]};let c=864e5,l=Math.floor(o[0]/c)*c,u=Math.floor(a/c)*c,d=[],f=0,p=0;for(let e=l;e<=u;e+=c){for(;f<o.length&&o[f]<e+c;)f++;for(;p<s.length&&s[p]<e+c;)p++;d.push({t:e,created:f,closed:p})}return{counts:r,timeline:d}}return{isClosed:i,commentsOf:o,query:s,dashboard:c}}export{n as a,s as c,t as i,r as n,l as o,i as r,c as s,o as t};