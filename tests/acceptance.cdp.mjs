import {ensureChrome,startChrome,CDP_URL} from './support/chrome-cdp.mjs';
import {connectNative} from './support/native-cdp.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const targetUrl='http://localhost:4178/?acceptance=20261030';
await ensureChrome({start:()=>startChrome({url:targetUrl})});
const c=await connectNative({browserURL:CDP_URL,targetUrl});
const results=[],exceptions=[],badResponses=[];let original;
const check=(name,condition)=>{assert.ok(condition,name);results.push(name);console.log('PASS '+name);};
const ready=async()=>{for(let i=0;i<100;i++){if(await c.evaluate(()=>!!window.__voxel&&window.__voxel.state.renderCalls>0))return;await wait(150);}throw Error('Game initialization timed out');};
const reload=async()=>{await c.send('Page.reload',{ignoreCache:true});await wait(400);await ready();await wait(150);};
const click=async selector=>{
 for(let i=0;i<30;i++){if(await c.evaluate(()=>!document.pointerLockElement))break;await wait(50);}
 await c.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),selector);
 await c.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const p=await c.evaluate(s=>{const el=document.querySelector(s),r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},selector);
 await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await wait(80);
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await wait(150);
};
const key=async(code,key,type)=>{if(type)await c.send('Input.dispatchKeyEvent',{type,code,key});else{await c.send('Input.dispatchKeyEvent',{type:'keyDown',code,key});await c.send('Input.dispatchKeyEvent',{type:'keyUp',code,key});}await wait(60);};
const state=()=>c.evaluate(()=>window.__voxel.state);
const exit=()=>c.evaluate(()=>document.getElementById('exit-btn').click());
const fixture=async options=>{await exit();await c.evaluate(o=>{const w=window.__voxel.world;const s={version:1,seed:'WILDS-2026',edits:[],player:[14.5,23,28.5],yaw:-.18,pitch:-.6,mode:'creative',hotbar:[1,2,3,4,7,9,8,10,11],inventory:{4:3},tool:0,health:15,hunger:12,food:3,time:480,day:1,...o};localStorage.setItem('voxel-wilds-v1',JSON.stringify(s));},options??{});await reload();};
try{
 await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
 c.socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived'&&m.params.response.url.startsWith('http://localhost:4178')&&m.params.response.status>=400)badResponses.push(m.params.response);if(m.method==='Page.javascriptDialogOpening')c.send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});});
 await c.send('Page.bringToFront');await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await ready();await mkdir('audit-shots/acceptance',{recursive:true});
 original=await c.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 await exit();await c.evaluate(()=>localStorage.clear());await reload();
 for(const[width,height,touch]of[[1440,900,false],[1024,600,false],[844,390,true],[390,844,true],[320,568,true]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});await c.send('Emulation.setTouchEmulationEnabled',{enabled:touch});await wait(150);
  const layout=await c.evaluate(()=>{const el=document.getElementById('play');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{reachable:r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el,overflow:document.documentElement.scrollWidth>innerWidth,touch:matchMedia('(pointer:coarse)').matches};});
  check(`menu accessible ${width}x${height}`,layout.reachable&&!layout.overflow);
  await click('#play');await wait(150);
  check(`world playable ${width}x${height}`,(await state()).playing);
  if(touch){check('touch controls enabled '+width,await c.evaluate(()=>getComputedStyle(document.getElementById('mobile-controls')).display==='flex'));const wasFlying=(await state()).flying;await click('#touch-fly');check('touch flight '+width,(await state()).flying!==wasFlying);await click('#touch-bag');await click('[data-pick="3"]');check('touch slot selection '+width,(await state()).selected===3);await click('#inventory [data-close]');}
  const hud=await c.evaluate(()=>{const r=document.getElementById('hotbar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});check('hotbar fits '+width,hud);
  await writeFile(`audit-shots/acceptance/${width}x${height}.png`,Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));await exit();
 }
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await fixture();
 await click('#options-btn');
 await c.evaluate(()=>{for(const[id,v]of[['fov',96],['sensitivity',22]]){const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input'));}for(const[id,v]of[['sound',false],['daycycle',false],['autojump',true]]){const el=document.getElementById(id);el.checked=v;el.dispatchEvent(new Event('change'));}});
 await reload();check('settings persisted',await c.evaluate(()=>document.getElementById('fov').value==='96'&&document.getElementById('sensitivity').value==='22'&&!document.getElementById('sound').checked&&!document.getElementById('daycycle').checked&&document.getElementById('autojump').checked));
 await click('#play');await click('#pause-btn');await click('#pause-settings');
 await c.evaluate(()=>document.getElementById('seed').focus());await key('Escape','Escape');check('Escape in text field returns to pause',await c.evaluate(()=>!document.getElementById('pause').classList.contains('hidden')&&document.getElementById('settings').classList.contains('hidden')));
 await click('#pause-settings');await c.evaluate(()=>document.getElementById('autojump').focus());await key('Tab','Tab');check('Tab from input remains in dialog',await c.evaluate(()=>document.getElementById('settings').contains(document.activeElement)));
 // Simulate a quota error only for world writes; the previous game must remain usable.
 await c.evaluate(()=>{window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='voxel-wilds-v1')throw new DOMException('Quota','QuotaExceededError');return window.__storageSet.call(this,k,v);};document.getElementById('seed').value='SHOULD-NOT-LOAD';});
 await click('#new-world');await c.evaluate(()=>Storage.prototype.setItem=window.__storageSet);await key('Escape','Escape');await click('#resume');
 check('failed new-world write preserves current session',(await state()).playing&&await c.evaluate(()=>window.__voxel.world.seed==='WILDS-2026'));
 await key('Escape','Escape');await click('#pause-settings');await c.evaluate(()=>document.getElementById('seed').value='ACCEPT-NEW-WORLD');await click('#new-world');await wait(400);await ready();
 check('new world survives unload',await c.evaluate(()=>window.__voxel.world.seed==='ACCEPT-NEW-WORLD'&&JSON.parse(localStorage.getItem('voxel-wilds-v1')).seed==='ACCEPT-NEW-WORLD'));
 const imported={version:1,seed:'ACCEPT-IMPORT',edits:[],player:[14.5,35,28.5],yaw:-.18,pitch:-.6,mode:'survival',hotbar:[1,2,3,4,7,9,8,10,11],inventory:{4:3},health:15,hunger:12,food:3};
 await mkdir('.sites-runtime',{recursive:true});const file=path.resolve('.sites-runtime/acceptance-import.json');await writeFile(file,JSON.stringify(imported));
 await click('#play');await click('#pause-btn');await click('#pause-settings');const dom=await c.send('DOM.getDocument');const node=await c.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#import-file'});await c.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[file]});await wait(500);await ready();
 check('in-game import survives unload',await c.evaluate(()=>window.__voxel.world.seed==='ACCEPT-IMPORT'));
 await fixture({mode:'survival'});await click('#play');await key('KeyE','e');await click('[data-craft="0"]');await click('[data-craft="0"]');await click('[data-craft="2"]');check('survival crafting consumes materials',(await state()).tool===1&&(await state()).inventory[7]===3);await click('#eat-apple');check('food recovery',(await state()).hunger===17);await key('Escape','Escape');
 await key('Escape','Escape');await click('#save-btn');await reload();check('tool and inventory restored',(await state()).tool===1&&(await state()).inventory[7]===3);
 await fixture();await click('#play');await key('KeyE','e');check('creative recipes disabled',await c.evaluate(()=>[...document.querySelectorAll('[data-craft]')].every(b=>b.disabled)));await key('Escape','Escape');
 // Deny pointer lock deliberately to reproduce embedded browser conditions.
 await c.evaluate(()=>{document.getElementById('world').requestPointerLock=()=>Promise.reject(new Error('test denied'));if(document.pointerLockElement)document.exitPointerLock();});await wait(120);await c.evaluate(()=>{document.getElementById('resume').click();});await wait(120);
 await c.evaluate(()=>{const w=window.__voxel.world;const s=window.__voxel.state;const x=Math.floor(s.player[0]),z=Math.floor(s.player[2])-2;const y=Math.floor(s.player[1]);w.set(x,y,z,3,true);window.__voxel.view.changed(x,z);});
 // Aim downward to ensure a nearby terrain target.
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:720,y:450,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:720,y:600,buttons:1,movementY:150,movementX:0});const beforeDrag=(await state()).edits;await wait(450);await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:720,y:600,button:'left',clickCount:1});check('drag look does not mine',(await state()).edits===beforeDrag);
 const beforeMine=(await state()).edits;await key('KeyQ','q','keyDown');await wait(450);await key('KeyQ','q','keyUp');check('unlocked keyboard mining works',(await state()).edits>beforeMine);const tgt=(await state()).target;check('placement target exists',!!tgt);await key('KeyG','g');check('unlocked keyboard placing works',await c.evaluate(t=>window.__voxel.world.get(t.x+t.normal.x,t.y+t.normal.y,t.z+t.normal.z)===1,tgt));
 await key('Escape','Escape');await c.evaluate(()=>{window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Quota','QuotaExceededError');};});await click('#save-btn');check('quota failure visible',await c.evaluate(()=>document.getElementById('save-status').textContent.includes('存储不可用')&&document.getElementById('toast').textContent.includes('无法保存')));await c.evaluate(()=>Storage.prototype.setItem=window.__storageSet);
 await click('#resume');const animals=await c.evaluate(()=>window.__voxel.view.animals.length);await c.evaluate(()=>window.__voxel.view.renderer.forceContextLoss());await wait(250);check('WebGL loss shows recovery UI',await c.evaluate(()=>!document.getElementById('loading').classList.contains('hidden')));await c.evaluate(()=>window.__voxel.view.renderer.forceContextRestore());await wait(600);check('WebGL restoration avoids duplicated scene',await c.evaluate(n=>window.__voxel.view.animals.length===n&&document.getElementById('loading').classList.contains('hidden'),animals));
 // Controlled terrain fixtures exercise movement without depending on random hills.
 await exit();
 const terrain=await c.evaluate(()=>{const w=window.__voxel.world,edits=[];for(let z=32;z<=46;z++)for(let x=37;x<=43;x++){for(let y=11;y<64;y++)edits.push([w.index(x,y,z),0]);edits.push([w.index(x,10,z),3]);if(z<=40)edits.push([w.index(x,11,z),3]);}return edits;});
 await fixture({player:[40.5,11.02,42.5],yaw:0,edits:terrain});await click('#play');await key('KeyW','w','keyDown');await wait(1400);await key('KeyW','w','keyUp');
 check('automatic jump clears one-block ledge',(await state()).player[2]<40&&(await state()).player[1]>=11.9);
 await exit();
 const shore=await c.evaluate(()=>{const w=window.__voxel.world,edits=[];for(let z=32;z<=46;z++)for(let x=37;x<=43;x++){for(let y=10;y<64;y++)edits.push([w.index(x,y,z),0]);edits.push([w.index(x,9,z),3]);edits.push([w.index(x,10,z),z<=40?3:16]);}return edits;});
 await fixture({player:[40.5,10.02,42.5],yaw:0,edits:shore});await click('#play');await key('KeyW','w','keyDown');await key('Space',' ','keyDown');await wait(1600);await key('KeyW','w','keyUp');await key('Space',' ','keyUp');
 check('swimming climbs one-block shore',(await state()).player[2]<40&&(await state()).player[1]>=10.99);
 check('no runtime exceptions',exceptions.length===0);check('no failed local assets',badResponses.length===0);
 console.log(JSON.stringify({passed:results.length,exceptions,badResponses}));
}catch(err){console.log('FAIL STATE',await c.evaluate(()=>({state:window.__voxel?.state,body:document.body.className,focus:document.hasFocus(),modal:[...document.querySelectorAll('.modal:not(.hidden)')].map(el=>el.id)})));await writeFile('audit-shots/acceptance/failure.png',Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));throw err;}finally{
 await writeFile('audit-shots/acceptance/results.json',JSON.stringify({results,exceptions,badResponses},null,2));
 if(original){await exit();await c.evaluate(s=>{localStorage.clear();for(const[k,v]of Object.entries(s))localStorage.setItem(k,v);},original);await c.send('Page.reload',{ignoreCache:true});}
 await c.disconnect();
}
