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
// liteAECO - (pdf-core.js)
// ========

(function(){'use strict';const PDF_BASE=new URL((window.SITE_ROOT||'../')+'js/pdf/',document.baseURI).href;const ENGINE_URL=PDF_BASE+'pdf-6.1.200.min.js';const WORKER_URL=PDF_BASE+'pdf-worker-6.1.200.min.js';const WASM_URL=PDF_BASE+'wasm/';if(!window.pdfjsReady){let resolveReady;window.pdfjsReady=new Promise(res=>{resolveReady=res;});import(ENGINE_URL).then(pdfjsLib=>{pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER_URL;window.pdfjsLib=pdfjsLib;resolveReady(pdfjsLib);}).catch(err=>{console.error('PDF.js failed to load',err);window.pdfjsLoadError=err;});}
function engineReady(timeoutMs){if(!window.pdfjsReady){return Promise.reject(new Error('PDF engine not loaded. Check js/pdf/pdf-6.1.200.min.mjs exists.'));}
return Promise.race([window.pdfjsReady,new Promise((_,rej)=>setTimeout(()=>rej(new Error('PDF engine timed out. Check pdf-6.1.200.min.mjs and pdf.worker-6.1.200.min.mjs file names, and that the server serves .mjs as text/javascript. Does not work over file://.')),timeoutMs||8000)),]);}
function isPdfFile(file){if(!file)return false;const name=(file.name||'').toLowerCase();return name.endsWith('.pdf')||file.type==='application/pdf';}
function createLoader(){const MAX_FILE_MB=200;const state={doc:null,fileName:null,fileDate:null,numPages:0,bytes:null,};async function destroyCurrent(){if(state.doc){try{await state.doc.destroy();}catch(e){}}
state.doc=null;state.fileName=null;state.fileDate=null;state.numPages=0;state.bytes=null;}
async function openBuffer(buf,name,dateMs){const pdfjsLib=await engineReady();const originalBytes=buf.slice(0);await destroyCurrent();const task=pdfjsLib.getDocument({data:buf,isEvalSupported:false,wasmUrl:WASM_URL,});try{state.doc=await task.promise;}catch(err){const msg=/password/i.test(err&&err.message?err.message:'')
?'PDF is password protected.':'Could not read this PDF.';throw new Error(msg);}
state.fileName=name;state.fileDate=new Date(dateMs||Date.now());state.numPages=state.doc.numPages;state.bytes=originalBytes;return{doc:state.doc,numPages:state.numPages,fileName:state.fileName};}
async function openFile(file){if(!isPdfFile(file))throw new Error('Not a PDF file.');if(file.size>MAX_FILE_MB*1024*1024){throw new Error(`File too large (max ${MAX_FILE_MB} MB).`);}
const buf=await file.arrayBuffer();return openBuffer(buf,file.name,file.lastModified);}
async function getPage(pageNum){if(!state.doc)throw new Error('No document loaded.');return state.doc.getPage(pageNum);}
async function getMetadata(){if(!state.doc)return null;try{const md=await state.doc.getMetadata();return md&&md.info?md.info:null;}catch(e){return null;}}
return{state,engineReady,isPdfFile,openFile,openBuffer,getPage,getMetadata,destroyCurrent,};}
const MEM=(navigator.deviceMemory||4);const MAX_CANVAS_DIM=MEM>=8?8192:MEM>=4?6144:4096;const MAX_CANVAS_AREA=MAX_CANVAS_DIM*MAX_CANVAS_DIM;function createRenderer(){const activeTasks=new Map();let docRotation=0;function getUserRotation(){return docRotation;}
function rotateDoc(deltaDeg){docRotation=((docRotation+deltaDeg)% 360+360)% 360;return docRotation;}
function resetRotations(){docRotation=0;}
function baseViewport(page,pageNum){const rot=(page.rotate+getUserRotation(pageNum))% 360;return page.getViewport({scale:1,rotation:rot});}
function clampScale(page,pageNum,desiredScale){const vp=baseViewport(page,pageNum);let s=desiredScale;const maxByDim=MAX_CANVAS_DIM/Math.max(vp.width,vp.height);const maxByArea=Math.sqrt(MAX_CANVAS_AREA/(vp.width*vp.height));s=Math.min(s,maxByDim,maxByArea);return Math.max(s,0.05);}
async function renderPage(page,pageNum,canvas,renderScale){const prev=activeTasks.get(pageNum);if(prev){try{prev.cancel();}catch(e){}
activeTasks.delete(pageNum);}
const scale=clampScale(page,pageNum,renderScale);const rot=(page.rotate+getUserRotation(pageNum))% 360;const vp=page.getViewport({scale,rotation:rot});canvas.width=Math.floor(vp.width);canvas.height=Math.floor(vp.height);const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);const task=page.render({canvasContext:ctx,viewport:vp});activeTasks.set(pageNum,task);try{await task.promise;}catch(err){if(err&&err.name==='RenderingCancelledException')return null;throw err;}finally{if(activeTasks.get(pageNum)===task)activeTasks.delete(pageNum);}
return{scale,width:canvas.width,height:canvas.height};}
const focusTasks=new Map();async function renderRegion(page,pageNum,canvas,deviceScale,region){const prev=focusTasks.get(pageNum);if(prev){try{prev.cancel();}catch(e){}
focusTasks.delete(pageNum);}
const rot=(page.rotate+getUserRotation(pageNum))% 360;const dpr=deviceScale.dpr;const vp=page.getViewport({scale:deviceScale.zoom*dpr,rotation:rot});const w=Math.max(1,Math.floor(region.w*dpr));const h=Math.max(1,Math.floor(region.h*dpr));if(w*h>MAX_CANVAS_AREA)return null;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);const task=page.render({canvasContext:ctx,viewport:vp,transform:[1,0,0,1,-region.x*dpr,-region.y*dpr],});focusTasks.set(pageNum,task);try{await task.promise;}catch(err){if(err&&err.name==='RenderingCancelledException')return null;throw err;}finally{if(focusTasks.get(pageNum)===task)focusTasks.delete(pageNum);}
return{w,h};}
function cancelRegion(pageNum){const t=focusTasks.get(pageNum);if(t){try{t.cancel();}catch(e){}
focusTasks.delete(pageNum);}}
async function renderThumb(page,pageNum,canvas,targetWidth){const vp1=baseViewport(page,pageNum);const scale=targetWidth/vp1.width;const rot=(page.rotate+getUserRotation(pageNum))% 360;const vp=page.getViewport({scale,rotation:rot});canvas.width=Math.floor(vp.width);canvas.height=Math.floor(vp.height);const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport:vp}).promise;}
return{renderPage,renderRegion,cancelRegion,clampScale,renderThumb,baseViewport,getUserRotation,rotateDoc,resetRotations,};}
window.PDFV_CORE={version:'1.0.0',engineReady,isPdfFile,createLoader,createRenderer,limits:{MAX_CANVAS_DIM,MAX_CANVAS_AREA},};})();