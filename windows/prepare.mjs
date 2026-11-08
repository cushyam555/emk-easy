import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
let html=readFileSync(new URL('index.html',root),'utf8');
html=html.replace('<meta name="viewport"',`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none';"><meta name="viewport"`);
html=html.replace('EMK → NCN · ทำงานบนเครื่องคุณ','Windows · EMK → NCN').replace('ประมวลผลในเบราว์เซอร์ ไฟล์เพลงไม่ถูกอัปโหลด','ประมวลผลในเครื่อง ไฟล์เพลงไม่ถูกอัปโหลด').replace('แนะนำ Chrome หรือ Edge รุ่นปัจจุบัน · ผลลัพธ์รวมต่อชุดไม่เกิน 128 MB','ผลลัพธ์รวมต่อชุดไม่เกิน 128 MB');
html=html.replace('<button id="offline">บันทึกโปรแกรมไว้ใช้แบบออฟไลน์ (.html)</button>','');
html=html.replace("$('offline').onclick=()=>save(new Blob(['<!doctype html>\\n'+document.documentElement.outerHTML],{type:'text/html;charset=utf-8'}),'EMK-Easy.html');",'');
const bridge=`$('download').textContent='บันทึก ZIP';
$('download').onclick=async()=>{
 if(!archive||busy)return;busy=true;controls();say('กำลังเตรียมบันทึก ZIP…');
 try {
  const bytes=new Uint8Array(await archive.arrayBuffer()),parts=[];
  for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  const path=await window.nativeSaveZip(btoa(parts.join('')));
  say(path?'บันทึกสำเร็จ · '+path:'ยกเลิกการบันทึก · กดบันทึก ZIP เพื่อเลือกตำแหน่งใหม่ได้');
 }catch(e){say('บันทึกไม่สำเร็จ: '+(e.message||String(e)));}finally{busy=false;controls();}
};`;
const original="$('download').onclick=()=>{if(archive)save(archive,'EMK-Easy-NCN.zip');};";
if(!html.includes(original))throw new Error('Missing native download bridge insertion point');
html=html.replace(original,bridge);
if(html.includes("$('offline')"))throw new Error('Offline HTML action must not be included in native app');
writeFileSync(new URL('app.html',import.meta.url),html);
console.log('Prepared native Windows UI');
