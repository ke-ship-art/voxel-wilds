import {BLOCKS,SIZE,HEIGHT,HALF} from './world.js';
export const STORAGE='voxel-wilds-v1';
export const MAX_IMPORT_BYTES=35_000_000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateSave(s){
 if(!object(s)||s.version!==1||typeof s.seed!=='string'||!s.seed.length||s.seed.length>64||!Array.isArray(s.edits)||s.edits.length>SIZE*SIZE*HEIGHT)throw Error('这不是有效的原野存档');
 if(!Array.isArray(s.player)||s.player.length!==3||s.player.some((v,i)=>!Number.isFinite(v)||Math.abs(v)>(i===1?200:HALF)))throw Error('存档位置不正确');
 if(!['creative','survival'].includes(s.mode))throw Error('存档模式不正确');
 if(!Array.isArray(s.hotbar)||s.hotbar.length!==9||s.hotbar.some(b=>!Number.isInteger(b)||!BLOCKS[b]||[15,16].includes(b)))throw Error('快捷栏数据不正确');
 if(s.inventory!==undefined&&!object(s.inventory))throw Error('背包数据不正确');
 for(const[k,v]of Object.entries(s.inventory??{}))if(!/^\d+$/.test(k)||!BLOCKS[k]||!Number.isInteger(v)||v<0||v>100000)throw Error('背包数据不正确');
 const bounds={health:[0,20],hunger:[0,20],yaw:[-1e6,1e6],pitch:[-1.6,1.6],time:[0,1440],day:[1,1e7],food:[0,100000],tool:[0,2]};
 for(const[key,[min,max]]of Object.entries(bounds))if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max||(['day','food','tool'].includes(key)&&!Number.isInteger(s[key]))))throw Error('存档状态不正确：'+key);
 const edits=new Map();
 for(const pair of s.edits){if(!Array.isArray(pair)||pair.length!==2)throw Error('存档方块格式不正确');const[i,b]=pair;if(!Number.isInteger(i)||i<0||i>=SIZE*SIZE*HEIGHT||!Number.isInteger(b)||b<0||b>=BLOCKS.length)throw Error('存档方块超出范围');edits.set(i,b);}
 return {...s,inventory:{...(s.inventory??{})},edits:[...edits]};
}

// The adapter writes active+backup in one transaction. CAS also protects other tabs.
export class SaveVault{
 constructor(adapter,legacy){this.adapter=adapter;this.legacy=legacy;this.raw=null;this.original=null;this.blocked=false;this.pending=Promise.resolve();}
 async load(){
  this.raw=await this.adapter.read();this.original=this.raw??this.legacy?.getItem(STORAGE)??null;
  if(this.original===null)return null;
  try{return validateSave(JSON.parse(this.original));}catch{this.blocked=true;return null;}
 }
 block(){this.blocked=true;}
 save(value,{replace=false}={}){
  const raw=JSON.stringify(validateSave(value));
  const job=this.pending.catch(()=>{}).then(async()=>{
   if(this.blocked&&!replace)throw Error('旧存档需要恢复：请先下载原始备份，再导入或生成新世界。');
   await this.adapter.write(raw,this.raw,this.original,this.blocked?this.original:null);
   this.raw=raw;this.blocked=false;
  });this.pending=job;return job;
 }
 async backup(){if(this.blocked)return this.original;return await this.adapter.corrupt?.()??await this.adapter.backup()??this.original;}
}
export async function createSaveVault(storage=localStorage,idb=globalThis.indexedDB){
 if(!idb){
  const adapter={read:async()=>storage.getItem(STORAGE),backup:async()=>storage.getItem(STORAGE+'.backup'),corrupt:async()=>storage.getItem(STORAGE+'.corrupt'),write:async(raw,expected,original,corrupt)=>{
   const commit=()=>{const old=storage.getItem(STORAGE);if(old!==expected)throw Error('另一个页面已修改存档，请导出当前世界后刷新。');if(corrupt!==null)storage.setItem(STORAGE+'.corrupt',corrupt);if(old??original)storage.setItem(STORAGE+'.backup',old??original);storage.setItem(STORAGE,raw);};
   if(globalThis.navigator?.locks)await navigator.locks.request(STORAGE,commit);else commit();
  }};return new SaveVault(adapter,storage);
 }
 const db=await new Promise((resolve,reject)=>{const req=idb.open('voxel-wilds-saves',1);req.onupgradeneeded=()=>req.result.createObjectStore('saves');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('无法打开存档库，请检查站点存储权限；旧档未修改。'));req.onblocked=()=>reject(Error('存档库被其他页面占用，请关闭旧页面后刷新。'));});
 db.onversionchange=()=>db.close();
 const read=key=>new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly'),req=tx.objectStore('saves').get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);});
 const adapter={read:()=>read('active'),backup:()=>read('backup'),corrupt:()=>read('corrupt'),write:(raw,expected,original,corrupt)=>new Promise((resolve,reject)=>{
  const tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),req=store.get('active');let conflict=false;
  req.onsuccess=()=>{const old=req.result??null;if(old!==expected){conflict=true;tx.abort();return;}if(corrupt!==null)store.put(corrupt,'corrupt');if(old??original)store.put(old??original,'backup');store.put(raw,'active');};
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error(conflict?'另一个页面已修改存档，请导出当前世界后刷新。':'存档未写入，可能已达配额；请导出当前世界。'));
 })};return new SaveVault(adapter,storage);
}
