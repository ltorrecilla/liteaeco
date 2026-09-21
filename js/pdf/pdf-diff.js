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
// liteAECO - (pdf_diff.js)
// ========

(function(){'use strict';function diffCore(msg){const a=new Uint8ClampedArray(msg.A),b=new Uint8ClampedArray(msg.B);const w=msg.w,h=msg.h;const inkTol=msg.inkTol,colorTol=msg.colorTol;const cell=msg.cell,radius=msg.radius,minPx=msg.minPx;const cw=Math.ceil(w/cell),ch=Math.ceil(h/cell);const cnt=new Uint32Array(cw*ch*3);const totals=[0,0,0];for(let y=0;y<h;y++){const cy=(y/cell)|0;for(let x=0;x<w;x++){const i=(y*w+x)*4;const ia=255 -((a[i]*77+a[i+1]*150+a[i+2]*29)>>8);const ib=255 -((b[i]*77+b[i+1]*150+b[i+2]*29)>>8);const d=ib - ia;let cls=-1;if(ia>inkTol&&ib>inkTol){if(Math.max(Math.abs(a[i]- b[i]),Math.abs(a[i+1]- b[i+1]),Math.abs(a[i+2]- b[i+2]))>colorTol)cls=2;}
else if(d<-inkTol)cls=0;else if(d>inkTol)cls=1;if(cls<0)continue;cnt[(cy*cw+((x/cell)|0))*3+cls]++;totals[cls]++;}}
const seen=new Uint8Array(cw*ch);const active=(k)=>cnt[k*3]+cnt[k*3+1]+cnt[k*3+2]>0;const boxes=[];const stack=[];for(let k0=0;k0<cw*ch;k0++){if(seen[k0]||!active(k0))continue;seen[k0]=1;stack.push(k0);let x0=cw,y0=ch,x1=-1,y1=-1;const n=[0,0,0];while(stack.length){const k=stack.pop();const cx=k % cw,cy=(k/cw)|0;if(cx<x0)x0=cx;if(cx>x1)x1=cx;if(cy<y0)y0=cy;if(cy>y1)y1=cy;n[0]+=cnt[k*3];n[1]+=cnt[k*3+1];n[2]+=cnt[k*3+2];for(let dy=-radius;dy<=radius;dy++){const ny=cy+dy;if(ny<0||ny>=ch)continue;for(let dx=-radius;dx<=radius;dx++){const nx=cx+dx;if(nx<0||nx>=cw)continue;const nk=ny*cw+nx;if(seen[nk]||!active(nk))continue;seen[nk]=1;stack.push(nk);}}}
const px=n[0]+n[1]+n[2];if(px<minPx)continue;const mix=Math.min(n[0],n[1])/Math.max(1,Math.max(n[0],n[1]));let kind;if(n[2]>=Math.max(n[0],n[1])||mix>0.2)kind='modified';else kind=n[0]>n[1]?'removed':'added';boxes.push({kind,px,n,x:x0*cell,y:y0*cell,w:Math.min(w,(x1+1)*cell)- x0*cell,h:Math.min(h,(y1+1)*cell)- y0*cell,});}
const band=cell*8;boxes.sort((p,q)=>(Math.floor(p.y/band)- Math.floor(q.y/band))||(p.x - q.x));return{id:msg.id,boxes,totals};}
let worker=null,workerBroken=false,seq=0;const pending=new Map();function getWorker(){if(worker||workerBroken)return worker;try{const src='const diffCore = '+diffCore.toString()+';\n'+'onmessage = (e) => { try { postMessage(diffCore(e.data)); } catch (err) { postMessage({ id: e.data.id, error: String(err && err.message || err) }); } };';const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=(e)=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);if(e.data.error)p.reject(new Error(e.data.error));else p.resolve(e.data);};worker.onerror=(e)=>{console.warn('PDF diff worker failed, using main thread:',e.message||e);workerBroken=true;worker=null;pending.forEach(p=>p.retry());pending.clear();};}catch(e){console.warn('PDF diff worker unavailable, using main thread:',e);workerBroken=true;worker=null;}
return worker;}
const pixels=(c)=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;function analyze(canvasA,canvasB,opts){opts=opts||{};const w=canvasB.width,h=canvasB.height;if(canvasA.width!==w||canvasA.height!==h)return Promise.reject(new Error('Raster sizes differ.'));const A=pixels(canvasA),B=pixels(canvasB);const base={w,h,inkTol:opts.inkTol||48,colorTol:opts.colorTol||96,cell:opts.cell||8,radius:opts.radius||2,minPx:opts.minPx||6,};const inThread=()=>Promise.resolve(diffCore(Object.assign({id:0,A:A.buffer,B:B.buffer},base)));const wk=getWorker();if(!wk)return inThread();const msg=Object.assign({id:++seq,A:A.slice().buffer,B:B.slice().buffer},base);return new Promise((resolve,reject)=>{pending.set(msg.id,{resolve,reject,retry:()=>inThread().then(resolve,reject)});wk.postMessage(msg,[msg.A,msg.B]);});}
window.PDF_DIFF={analyze,diffCore};})();