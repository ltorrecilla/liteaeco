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
// liteAECO - (liteaeco-contacts.js)
// ========

(function(root,factory){var api=factory(root);if(typeof module==="object"&&module.exports)module.exports=api;if(root){root.liteAECO=root.liteAECO||{};root.liteAECO.contacts=api;}})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:this),function(W){"use strict";var VERSION=1;var HEADERS=["ID","Employee Code","Employee Number","Name","Company","Employee Type","Role","Teams","Contact Mail","Contact Phone","Department","Reporting to","Manager Mail","Assistant","Location","Campus","Building","Floor","Hood","Starting Date","Percentage","Cost Center","Cost / Hour","Skills","In contact with","Influence","Engagement","Meeting participation","RASCI Matrix","Comments","Status"];var LABELS={"id":"id","name":"name","company":"company","employee code":"employeeCode","employee number":"employeeNumber","empno":"employeeNumber","employee type":"type","role":"role","teams":"teams","contact mail":"mail","contact info":"mail","mail":"mail","email":"mail","e-mail":"mail","contact phone":"phone","phone":"phone","department":"department","reporting to":"reportingTo","manager mail":"managerMail","assistant":"assistant","location":"location","campus":"campus","building":"building","floor":"floor","hood":"hood","starting date":"startingDate","percentage":"percentage","cost center":"costCenter","cost / hour":"costPerHour","cost/hour":"costPerHour","skills":"skills","in contact with":"inContactWith","influence":"influence","engagement":"engagement","meeting participation":"participation","participation":"participation","rasci matrix":"rasciMatrix","comments":"comments","status":"status"};function str(v){return String(v==null?"":v).trim();}
function cell(v){var s=str(v);return s==="-"?"":s;}
function normMail(v){return cell(v).toLowerCase();}
function normName(v){return cell(v).toLowerCase().replace(/\s+/g," ");}
function label(v){return str(v).toLowerCase().replace(/\s+/g," ");}
function randomUuid(){var c=(W&&W.crypto)||(typeof crypto!=="undefined"?crypto:null);if(c&&typeof c.randomUUID==="function"){try{return c.randomUUID();}catch(e){}}
if(!c||typeof c.getRandomValues!=="function")throw new Error("No secure random source for IDs");var b=new Uint8Array(16);c.getRandomValues(b);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;var h="";for(var i=0;i<16;i++)h+=(b[i]<16?"0":"")+b[i].toString(16);return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);}
function newId(){var cde=W&&W.liteAECO&&W.liteAECO.cde;if(cde&&typeof cde.newPersonId==="function")return cde.newPersonId();return randomUuid();}
function tempId(key){var s=cell(key).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");return s?"m-"+s:null;}
function isTempId(id){return/^m-[a-z0-9-]+$/.test(str(id));}
function parseAoa(aoa,rowOffset){aoa=aoa||[];var header=(aoa[0]||[]).map(str);var col={};header.forEach(function(h,i){var k=LABELS[label(h)];if(k&&col[k]===undefined)col[k]=i;});if(col.name===undefined)return{ok:false,reason:"no-name-column",header:header,contacts:[]};var out=[];for(var r=1;r<aoa.length;r++){var row=aoa[r]||[];var fields={};Object.keys(col).forEach(function(k){fields[k]=cell(row[col[k]]);});if(!fields.name)continue;var values={};header.forEach(function(h,i){if(h)values[label(h)]=row[i]===undefined?"":row[i];});out.push({id:fields.id||"",name:fields.name,mail:fields.mail||"",company:fields.company||"",type:fields.type||"",role:fields.role||"",archived:(fields.status||"").toLowerCase()==="archived",fields:fields,values:values,rowIndex:r+(rowOffset||0)});}
return{ok:true,header:header,contacts:out};}
function parseWorkbook(wb,X){if(!wb||!X)return{ok:false,reason:"no-workbook",contacts:[]};var names=wb.SheetNames||[];var cn=null,i;for(i=0;i<names.length;i++)if(str(names[i]).toUpperCase()==="CONTACTS"){cn=names[i];break;}
if(cn){var res=parseAoa(X.utils.sheet_to_json(wb.Sheets[cn],{header:1,defval:"",raw:true}));res.source="CONTACTS";res.sheetName=cn;return res;}
var info=null;for(i=0;i<names.length;i++)if(str(names[i]).toUpperCase()==="INFO"){info=wb.Sheets[names[i]];break;}
if(info){var ia=X.utils.sheet_to_json(info,{header:1,defval:"",raw:true});var at=-1;for(i=0;i<ia.length;i++)if(ia[i]&&str(ia[i][0])==="--- CONTACTS ---"){at=i;break;}
if(at>-1){var block=[];for(i=at+1;i<ia.length;i++){if(ia[i]&&/^---.*---$/.test(str(ia[i][0]))&&i>at+1)break;block.push(ia[i]||[]);}
var lr=parseAoa(block,at+1);lr.source="INFO";return lr;}}
return{ok:false,reason:"no-contacts",contacts:[]};}
function samePerson(a,b){if(a.id&&b.id&&a.id===b.id)return true;var am=normMail(a.mail),bm=normMail(b.mail);if(am&&bm)return am===bm;if(!am&&!bm)return normName(a.name)===normName(b.name);return false;}
function plan(incoming,existing){var add=[],skip=[],clashes=[];var pool=existing.slice();incoming.forEach(function(p){var same=null,i;for(i=0;i<pool.length;i++)if(samePerson(p,pool[i])){same=pool[i];break;}
if(same){var mailsDiffer=normMail(p.mail)&&normMail(same.mail)&&normMail(p.mail)!==normMail(same.mail);var namesDiffer=!normMail(p.mail)&&!normMail(same.mail)&&normName(p.name)!==normName(same.name);if(p.id&&same.id===p.id&&(mailsDiffer||namesDiffer))clashes.push({incoming:p,existing:same});else skip.push(p);return;}
var taken=null;if(p.id)for(i=0;i<pool.length;i++)if(pool[i].id===p.id){taken=pool[i];break;}
if(taken){clashes.push({incoming:p,existing:taken});return;}
add.push(p);pool.push(p);});return{add:add,skip:skip,clashes:clashes};}
function reconcile(local,roster,opts){opts=opts||{};var fields=opts.fields||["name","company","role","mail"];var byId={},used={};local.forEach(function(p){if(p.id)byId[p.id]=p;});var res={adopt:[],update:[],add:[],clashes:[],ambiguous:[]};var claimedIds={};roster.forEach(function(r){var rid=cell(r.id);var rm=normMail(r.mail),rn=normName(r.name);var match=null,candidates;if(rid&&byId[rid]&&!used[rid])match=byId[rid];if(!match&&!rid){var tid=tempId(r.mail||r.name);if(tid&&byId[tid]&&!used[tid])match=byId[tid];}
if(!match&&rm){candidates=local.filter(function(p){return!used[p.id]&&normMail(p.mail)===rm;});if(candidates.length===1)match=candidates[0];else if(candidates.length>1){res.ambiguous.push({roster:r,candidates:candidates});return;}}
if(!match&&rn){candidates=local.filter(function(p){if(used[p.id]||normName(p.name)!==rn)return false;var pm=normMail(p.mail);return!(rm&&pm&&rm!==pm);});if(candidates.length===1)match=candidates[0];else if(candidates.length>1){res.ambiguous.push({roster:r,candidates:candidates});return;}}
if(!match){var id=rid||(opts.blankId?opts.blankId(r):(tempId(r.mail||r.name)||newId()));if(claimedIds[id]||(byId[id]&&used[id])){res.clashes.push({roster:r,local:byId[id]||null,reason:"duplicate-roster-id"});return;}
if(byId[id]&&!used[id]){res.clashes.push({roster:r,local:byId[id],reason:"id-held-by-other"});return;}
claimedIds[id]=true;res.add.push({roster:r,id:id});return;}
used[match.id]=true;if(rid&&match.id!==rid){var holder=byId[rid];if(holder&&holder!==match){res.clashes.push({roster:r,local:holder,reason:"id-held-by-other"});return;}
if(claimedIds[rid]){res.clashes.push({roster:r,local:match,reason:"duplicate-roster-id"});return;}
claimedIds[rid]=true;res.adopt.push({from:match.id,to:rid,local:match,roster:r});}else if(rid){claimedIds[rid]=true;}
var changes={},any=false;fields.forEach(function(k){var rv=cell(r[k]!==undefined?r[k]:(r.fields&&r.fields[k]));if(rv&&cell(match[k])!==rv){changes[k]=rv;any=true;}});if(any)res.update.push({local:match,roster:r,changes:changes});});return res;}
function resolve(id,aliases){var cur=str(id);if(!cur||!aliases)return cur;var seen={};for(var hops=0;hops<64;hops++){if(seen[cur])return cur;seen[cur]=true;var nx=Object.prototype.hasOwnProperty.call(aliases,cur)?aliases[cur]:null;if(!nx||nx===cur)return cur;cur=String(nx);}
return cur;}
function mapGet(map,id){return map&&Object.prototype.hasOwnProperty.call(map,id)?map[id]:null;}
function remapString(s,map){if(s==null)return s;var text=String(s);if(!text)return text;var whole=mapGet(map,text.trim());if(whole)return whole;var out=text.replace(/\[([^\]]+)\]/g,function(m0,id){var to=mapGet(map,id.trim());return to?"["+to+"]":m0;});if(out!==text)return out;if(text.indexOf(",")!==-1){var changed=false;var parts=text.split(",").map(function(part){var t=part.trim(),to=mapGet(map,t);if(to){changed=true;return part.replace(t,to);}
return part;});if(changed)return parts.join(",");}
return text;}
function remapArray(arr,map){if(!Array.isArray(arr))return arr;var seen={},out=[];arr.forEach(function(v){var nv=typeof v==="string"?(mapGet(map,v)||v):v;var key=typeof nv==="string"?"s:"+nv:null;if(key&&seen[key])return;if(key)seen[key]=true;out.push(nv);});return out;}
function remapKeys(obj,map,conflicts){if(!obj||typeof obj!=="object")return obj;Object.keys(map||{}).forEach(function(from){if(!Object.prototype.hasOwnProperty.call(obj,from))return;var to=map[from];if(!to||to===from)return;if(Object.prototype.hasOwnProperty.call(obj,to)&&obj[to]!==""&&obj[to]!=null){if(obj[from]!==obj[to]&&conflicts)conflicts.push({from:from,to:to,kept:obj[to],dropped:obj[from]});}else{obj[to]=obj[from];}
delete obj[from];});return obj;}
function tagOf(v){return Object.prototype.toString.call(v);}
function toBytes(buf){if(!buf)return new Uint8Array(0);var t=tagOf(buf);if(t==="[object Uint8Array]")return buf;if(t==="[object ArrayBuffer]"||t==="[object SharedArrayBuffer]")return new Uint8Array(buf);if(buf.buffer&&/ArrayBuffer\]$/.test(tagOf(buf.buffer)))return new Uint8Array(buf.buffer,buf.byteOffset||0,buf.byteLength);return new Uint8Array(0);}
function fnv1a(bytes){var h=0x811c9dc5;for(var i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,0x01000193)>>>0;}
return("0000000"+h.toString(16)).slice(-8);}
function hash(buf){var bytes=toBytes(buf);var c=(W&&W.crypto)||(typeof crypto!=="undefined"?crypto:null);if(c&&c.subtle&&typeof c.subtle.digest==="function"){return c.subtle.digest("SHA-256",bytes).then(function(d){return Array.prototype.map.call(new Uint8Array(d),function(b){return("0"+b.toString(16)).slice(-2);}).join("");}).catch(function(){return"fnv1a:"+fnv1a(bytes)+"-"+bytes.length;});}
return Promise.resolve("fnv1a:"+fnv1a(bytes)+"-"+bytes.length);}
function hashMatches(stamp,buf){if(!stamp)return Promise.resolve(false);return hash(buf).then(function(h){return h===String(stamp);});}
return{VERSION:VERSION,HEADERS:HEADERS,newId:newId,tempId:tempId,isTempId:isTempId,cell:cell,normMail:normMail,normName:normName,parseAoa:parseAoa,parseWorkbook:parseWorkbook,samePerson:samePerson,plan:plan,reconcile:reconcile,resolve:resolve,remapString:remapString,remapArray:remapArray,remapKeys:remapKeys,hash:hash,hashMatches:hashMatches,_fnv1a:fnv1a};});