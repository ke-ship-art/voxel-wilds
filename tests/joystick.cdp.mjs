import {ensureChrome,startChrome,CDP_URL} from './support/chrome-cdp.mjs';
import {connectNative} from './support/native-cdp.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import {setTimeout as wait} from 'node:timers/promises';import assert from 'node:assert/strict';
const targetUrl='http://localhost:4178/?joystick-test=20261030';
await ensureChrome({start:()=>startChrome({url:targetUrl})});const c=await connectNative({browserURL:CDP_URL,targetUrl});let original;const errors=[],checks=[];let points=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name);};
const ready=async()=>{for(let i=0;i<100;i++){if(await c.evaluate(()=>!!window.__voxel&&window.__voxel.state.renderCalls>0))return;await wait(150);}throw Error('Not ready');};
const center=s=>c.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},s);
const state=()=>c.evaluate(()=>({p:window.__voxel.state.player,yaw:window.__voxel.view.camera.rotation.y}));
const distance=(a,b)=>Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2]);
const send=async type=>{await c.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});};
const down=async(id,p)=>{points.push({id,...p});await send('touchStart');};
const move=async(id,p)=>{Object.assign(points.find(t=>t.id===id),p);await send('touchMove');};
const up=async id=>{const ended=points.find(p=>p.id===id);await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{...ended,radiusX:2,radiusY:2,force:1}]});points=points.filter(p=>p.id!==id);};
const tap=async s=>{await down(9,await center(s));await up(9);await wait(120);};
const screenshot=async name=>writeFile('audit-shots/joystick/'+name+'.png',Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
try{
 await mkdir('audit-shots/joystick',{recursive:true});await c.send('Page.enable');await c.send('Runtime.enable');c.socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});await c.send('Page.bringToFront');await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.reload',{ignoreCache:true});await wait(400);await ready();
 original=await c.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 await c.evaluate(()=>{document.getElementById('exit-btn').click();localStorage.clear();localStorage.setItem('voxel-wilds-v1',JSON.stringify({version:1,seed:'WILDS-2026',edits:[],player:[14.5,55,28.5],yaw:0,pitch:-.2,mode:'creative',hotbar:[1,2,3,4,7,9,8,10,11],inventory:{},health:20,hunger:20,time:480,day:1}));});await c.send('Page.reload',{ignoreCache:true});await wait(400);await ready();
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});await wait(200);await c.evaluate(()=>{window.__touchLog=[];for(const name of['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,e=>window.__touchLog.push({type:name,id:e.pointerId,target:e.target.id}));});await tap('#play');await tap('#touch-fly');check('touch flight enabled',await c.evaluate(()=>window.__voxel.state.flying));
 const stick=await center('#joystick');const radius=await c.evaluate(()=>{const e=document.getElementById('joystick');return(e.getBoundingClientRect().width-document.getElementById('joystick-knob').offsetWidth)/2;});
 let a=await state();await down(1,stick);await wait(250);check('center deadzone keeps player still',distance(a,await state())<.03);
 await move(1,{x:stick.x,y:stick.y-radius*.5});a=await state();await wait(350);const slow=distance(a,await state());
 await move(1,{x:stick.x,y:stick.y-radius});a=await state();await wait(350);const fast=distance(a,await state());check('push strength changes speed',slow>.3&&fast>slow*1.5);
 await up(1);a=await state();await wait(250);check('release stops movement',distance(a,await state())<.03);check('release recenters knob',await c.evaluate(()=>new DOMMatrix(getComputedStyle(document.getElementById('joystick-knob')).transform).e===0&&new DOMMatrix(getComputedStyle(document.getElementById('joystick-knob')).transform).f===0));
 await down(1,stick);await move(1,{x:stick.x,y:stick.y-radius});const flightBefore=await c.evaluate(()=>window.__voxel.state.flying);await tap('#touch-fly');check('flight toggle works with joystick held',await c.evaluate(v=>window.__voxel.state.flying!==v,flightBefore));await tap('#touch-fly');await up(1);
 await down(1,stick);await move(1,{x:stick.x+radius,y:stick.y-radius});a=await state();await wait(300);let b=await state();check('diagonal movement changes both axes',b.p[0]>a.p[0]+.5&&b.p[2]<a.p[2]-.5);
 await down(2,{x:240,y:410});a=await state();await move(2,{x:285,y:420});await wait(200);b=await state();check('second finger looks while walking',Math.abs(b.yaw-a.yaw)>.1&&distance(a,b)>.5);
 await up(2);a=await state();await wait(200);check('releasing look finger keeps joystick moving',distance(a,await state())>.5);
 await down(3,await center('[data-key="Space"]'));const y=(await state()).p[1];await wait(200);check('third control can ascend while walking',(await state()).p[1]>y+.5);await up(3);a=await state();await wait(180);check('releasing jump keeps movement',distance(a,await state())>.4);await up(1);
 await down(1,stick);await move(1,{x:stick.x-radius,y:stick.y});await down(2,{x:230,y:400});await up(1);a=await state();await move(2,{x:265,y:400});await wait(200);b=await state();check('releasing joystick stops only movement',distance(a,b)<.03&&Math.abs(b.yaw-a.yaw)>.1);await up(2);
 await down(1,stick);await move(1,{x:stick.x,y:stick.y-radius});await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});points=[];a=await state();await wait(200);check('touch cancel stops movement',distance(a,await state())<.03);
 // Pause via a second finger while the stick is held, then verify neutral resume.
 await down(1,stick);await move(1,{x:stick.x,y:stick.y-radius});await down(2,await center('#pause-btn'));await up(2);await up(1);await tap('#resume');a=await state();await wait(200);check('pause resets joystick',distance(a,await state())<.03);
 // Verify every action with the joystick held, including tap-only controls.
 const plant=async()=>{const p=await c.evaluate(()=>{const {camera}=window.__voxel.view,yaw=camera.rotation.y,pitch=camera.rotation.x;const d=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];const p=[camera.position.x,camera.position.y,camera.position.z].map((n,i)=>Math.floor(n+d[i]*3));window.__voxel.world.set(...p,3,true);window.__voxel.view.changed(p[0],p[2]);return p;});await wait(100);return p;};
 let block=await plant();await down(1,stick);await move(1,{x:stick.x,y:stick.y-radius*.25});a=await state();await down(3,await center('#touch-mine'));check('mining button shows held feedback',await c.evaluate(()=>document.getElementById('touch-mine').classList.contains('is-held')));await wait(350);check('mining works while walking',await c.evaluate(p=>window.__voxel.world.get(...p)===0,block)&&distance(a,await state())>.2);await up(3);a=await state();await wait(160);check('releasing mining keeps walking',distance(a,await state())>.08);await up(1);
 await plant();const aimed=await c.evaluate(()=>window.__voxel.state.target);check('placed test block is targetable',!!aimed);await down(1,stick);await move(1,{x:stick.x,y:stick.y-radius*.25});await tap('#touch-place');check('placing works while walking',await c.evaluate(t=>window.__voxel.world.get(t.x+t.normal.x,t.y+t.normal.y,t.z+t.normal.z)===1,aimed));
 const beforeDown=(await state()).p[1];await down(3,await center('#touch-down'));await wait(180);check('descending works with joystick held',(await state()).p[1]<beforeDown-.4);await up(3);await tap('#touch-bag');check('inventory opens with joystick held',await c.evaluate(()=>!document.getElementById('inventory').classList.contains('hidden')));await up(1);await tap('#inventory [data-close]');a=await state();await wait(180);check('closing inventory leaves controls neutral',distance(a,await state())<.03);
 for(const[width,height]of[[320,568],[390,844],[844,390]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await wait(180);const layout=await c.evaluate(()=>{const j=document.getElementById('joystick').getBoundingClientRect(),a=document.querySelector('.touch-actions').getBoundingClientRect(),h=document.getElementById('hotbar').getBoundingClientRect();return j.left>=0&&j.right<a.left&&a.right<=innerWidth&&j.top>=0&&j.bottom<h.top;});check(`joystick layout fits ${width}x${height}`,layout);await screenshot(`${width}x${height}`);
 }
 check('no runtime exceptions',errors.length===0);console.log(JSON.stringify({passed:checks.length}));
}catch(err){console.log('Touch diagnostic',await c.evaluate(()=>({events:window.__touchLog,active:document.getElementById('joystick').className,knob:document.getElementById('joystick-knob').style.transform,state:window.__voxel.state})));throw err;}finally{
 if(points.length)await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});
 await writeFile('audit-shots/joystick/results.json',JSON.stringify({checks,errors},null,2));
 if(original)await c.evaluate(s=>{document.getElementById('exit-btn').click();localStorage.clear();for(const[k,v]of Object.entries(s))localStorage.setItem(k,v);},original);
 await c.send('Page.reload',{ignoreCache:true});await c.disconnect();
}
