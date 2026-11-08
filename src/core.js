'use strict';
const LIMIT=128*1024*1024, KEY=Uint8Array.from([175,242,76,156,233,234,153,67]);
class FormatError extends Error {}
function eq(b,p,s){return p>=0&&p+s.length<=b.length&&[...s].every((c,i)=>b[p+i]===c.charCodeAt(0));}
class Reader {
 constructor(b){this.b=b;this.p=0;}
 take(n){if(!Number.isSafeInteger(n)||n<0||this.p+n>this.b.length)throw new FormatError('ข้อมูลส่วนหัวไม่ครบหรือไฟล์เสียหาย');const x=this.b.subarray(this.p,this.p+n);this.p+=n;return x;}
 uint(n){const b=this.take(n);let x=0;for(let i=n-1;i>=0;i--)x=x*256+b[i];if(!Number.isSafeInteger(x))throw new FormatError('ตัวเลขในส่วนหัวใหญ่เกินไป');return x;}
 num(){const t=this.uint(1);if(t===2)return this.uint(1);if(t===3)return this.uint(2);if(t===4)return this.uint(4);throw new FormatError('รูปแบบตัวเลขที่ยังไม่รองรับ: '+t);}
 str(){if(this.uint(1)!==6)throw new FormatError('รูปแบบชื่อข้อมูลที่ยังไม่รองรับ');const b=this.take(this.uint(1));return new TextDecoder('windows-874').decode(b);}
 skip(){const t=this.uint(1),sizes={2:1,3:2,4:4,5:4,7:8,8:8,9:1};let n;if(t===6)n=this.uint(1);else if(t===10)n=this.uint(4);else n=sizes[t];if(n===undefined)throw new FormatError('ชนิดข้อมูลส่วนหัวที่ยังไม่รองรับ: '+t);this.take(n);}
}
function midiInfo(b){
 if(!eq(b,0,'MThd')||b.length<14)throw new FormatError('ข้อมูล MIDI ไม่มีส่วนหัวที่ถูกต้อง');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),h=v.getUint32(4),format=v.getUint16(8),tracks=v.getUint16(10);if(h<6||h+8>b.length||format>2||tracks<1||(format===0&&tracks!==1)||v.getUint16(12)===0)throw new FormatError('ส่วนหัว MIDI ไม่ถูกต้อง');
 let p=8+h;for(let i=0;i<tracks;i++){if(!eq(b,p,'MTrk')||p+8>b.length)throw new FormatError('แทร็ก MIDI ไม่ครบ');const n=v.getUint32(p+4);p+=8+n;if(p>b.length)throw new FormatError('ข้อมูลแทร็ก MIDI ขาดหาย');}if(p!==b.length)throw new FormatError('มีข้อมูลเกินขอบเขต MIDI');return {format,tracks};
}
async function inflate(b,size){
 if(size>LIMIT)throw new FormatError('ข้อมูลที่คลายแล้วเกินขนาด 128 MB');
 if(typeof DecompressionStream==='undefined')throw new FormatError('กรุณาเปิดด้วย Chrome หรือ Edge รุ่นปัจจุบัน');
 const reader=new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();const chunks=[];let total=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>size||total>LIMIT){await reader.cancel();throw new FormatError('ขนาดข้อมูลหลังคลายไม่ตรงกับส่วนหัว');}chunks.push(value);}}catch(e){throw e instanceof FormatError?e:new FormatError('คลายข้อมูลเพลงไม่ได้: ไฟล์อาจเสียหายหรือเป็นรุ่นที่ยังไม่รองรับ');}
 if(total!==size)throw new FormatError('ขนาดข้อมูลหลังคลายไม่ตรงกับส่วนหัว');const out=new Uint8Array(total);let p=0;for(const c of chunks){out.set(c,p);p+=c.length;}return out;
}
async function unpackEMK(input){
 if(eq(input,0,'XSTM'))throw new FormatError('ไฟล์นี้ใช้โครงสร้างข้อมูลที่โปรแกรมรุ่นนี้ยังอ่านไม่ได้');
 if(input.length>LIMIT)throw new FormatError('ไฟล์ใหญ่เกิน 128 MB');let b=new Uint8Array(input);
 if(!eq(b,0,'.SFDS')){b=Uint8Array.from(b,(x,i)=>x^KEY[i%8]);if(!eq(b,0,'.SFDS'))throw new FormatError('ไม่ใช่ไฟล์ EMK รูปแบบที่โปรแกรมอ่านได้');}
 if(b.length<46)throw new FormatError('ไฟล์สั้นเกินไป');const dv=new DataView(b.buffer,b.byteOffset,b.byteLength),start=dv.getUint32(34,true),end=dv.getUint32(42,true);
 if(start>=end||end>b.length)throw new FormatError('ขอบเขตสารบัญไม่ถูกต้อง');const r=new Reader(b.subarray(start,end)),records=[];
 while(r.p<r.b.length){
  if(!eq(r.b,r.p,'SFDS'))throw new FormatError('สารบัญเพลงไม่ตรงกับรูปแบบที่รองรับ');r.take(4);const name=r.str(),size=r.num();r.num();const a=r.num(),z=r.num();r.skip();r.skip();r.take(16);r.skip();r.skip();
  if(a>=z||z>b.length||size>LIMIT)throw new FormatError('ตำแหน่งหรือขนาดข้อมูลเพลงไม่ถูกต้อง');records.push({name,size,start:a,end:z});if(records.length>100)throw new FormatError('จำนวนข้อมูลย่อยมากเกินไป');
 }
 const wanted={MIDI_DATA:['Song','.mid'],LYRIC_DATA:['Lyrics','.lyr'],CURSOR_DATA:['Cursor','.cur']},result=[];let total=0;
 for(const rec of records){if(!wanted[rec.name])continue;total+=rec.size;if(total>LIMIT)throw new FormatError('ผลรวมข้อมูลเพลงใหญ่เกินไป');const data=await inflate(b.subarray(rec.start,rec.end),rec.size);let info=null;if(rec.name==='MIDI_DATA')info=midiInfo(data);result.push({...rec,folder:wanted[rec.name][0],ext:wanted[rec.name][1],data,info});}
 if(!result.some(x=>x.ext==='.mid'))throw new FormatError('ไม่พบ MIDI_DATA ในไฟล์นี้');const unique=new Set(result.map(x=>x.ext));if(unique.size!==result.length)throw new FormatError('พบส่วนข้อมูลซ้ำในไฟล์เพลง');return result;
}
function safeName(s){let n=s.replace(/\.[^.]+$/,'').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,120)||'song';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(n))n='_'+n;return n;}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zipStore(files){const parts=[],central=[];let offset=0,total=0;const enc=new TextEncoder();const seen=new Set();
 for(const {name,data} of files){if(seen.has(name))throw new Error('ชื่อไฟล์ซ้ำ');seen.add(name);total+=data.length;if(total>LIMIT)throw new Error('ผลรวมไฟล์เกิน 128 MB กรุณาแปลงเป็นชุดเล็กลง');const n=enc.encode(name),crc=crc32(data),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);parts.push(h,data);
 const c=new Uint8Array(46+n.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=h.length+data.length;}
 const size=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
if(typeof module!=='undefined')module.exports={unpackEMK,midiInfo,zipStore,safeName,KEY,Reader};
