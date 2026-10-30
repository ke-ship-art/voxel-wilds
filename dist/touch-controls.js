// Screen-space displacement becomes a circular, analog movement input.
export function joystickVector(dx,dy,radius,deadzone=.14){
 const length=Math.hypot(dx,dy);
 if(!(radius>0)||!length)return{x:0,y:0,knobX:0,knobY:0};
 const distance=Math.min(length,radius),amount=Math.max(0,(distance/radius-deadzone)/(1-deadzone));
 return{x:dx/length*amount,y:-dy/length*amount,knobX:dx/length*distance,knobY:dy/length*distance};
}

export class TouchControls{
 constructor({stick,knob,canvas,buttons,isPlaying,onLook,onPlace,onAction=()=>{}}){
  Object.assign(this,{stick,knob,isPlaying,onLook,onPlace});this.buttons=[...buttons];
  this.vector={x:0,y:0};this.keys=new Set();this.mining=false;this.placing=false;
  this.stickId=null;this.lookId=null;this.actions=new Map();
  stick.addEventListener('pointerdown',e=>{
   if(!isPlaying()||this.stickId!==null)return;
   e.preventDefault();this.stickId=e.pointerId;
   const r=stick.getBoundingClientRect();this.center={x:r.x+r.width/2,y:r.y+r.height/2};
   this.radius=(r.width-knob.offsetWidth)/2;stick.setPointerCapture(e.pointerId);stick.classList.add('active');this.moveStick(e);
  });
  stick.addEventListener('pointermove',e=>{if(e.pointerId===this.stickId){e.preventDefault();this.moveStick(e);}});
  for(const name of['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,e=>{if(e.pointerId===this.stickId)this.endStick();});
  canvas.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch'||!isPlaying()||this.lookId!==null)return;
   e.preventDefault();this.lookId=e.pointerId;this.lookPoint={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
   if(e.pointerId!==this.lookId||!isPlaying())return;
   e.preventDefault();onLook(e.clientX-this.lookPoint.x,e.clientY-this.lookPoint.y);this.lookPoint={x:e.clientX,y:e.clientY};
  });
  for(const name of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(e.pointerId===this.lookId)this.lookId=null;});
  for(const button of this.buttons){
   const action=button.dataset.key||button.id;
   button.addEventListener('pointerdown',e=>{
    if(!isPlaying())return;e.preventDefault();button.setPointerCapture(e.pointerId);
    this.actions.set(e.pointerId,{button,action});this.refreshActions();
    if(action==='touch-place')onPlace();else if(!button.dataset.key&&action!=='touch-mine')onAction(action);
   });
   button.addEventListener('click',e=>{if(e.detail===0&&isPlaying()&&!button.dataset.key&&!['touch-mine','touch-place'].includes(action))onAction(action);});
   for(const name of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,e=>{if(this.actions.get(e.pointerId)?.button===button){this.actions.delete(e.pointerId);this.refreshActions();}});
  }
  addEventListener('resize',()=>this.reset());
 }
 moveStick(e){const v=joystickVector(e.clientX-this.center.x,e.clientY-this.center.y,this.radius);this.vector={x:v.x,y:v.y};this.knob.style.transform=`translate(${v.knobX}px,${v.knobY}px)`;}
 endStick(){const id=this.stickId;this.stickId=null;this.vector={x:0,y:0};this.knob.style.transform='translate(0,0)';this.stick.classList.remove('active');if(id!==null&&this.stick.hasPointerCapture(id))this.stick.releasePointerCapture(id);}
 refreshActions(){this.keys.clear();this.mining=false;this.placing=false;for(const{action}of this.actions.values()){if(action==='touch-mine')this.mining=true;else if(action==='touch-place')this.placing=true;else if(action.startsWith('Key')||action==='Space'||action.startsWith('Shift'))this.keys.add(action);}for(const b of this.buttons)b.classList.toggle('is-held',[...this.actions.values()].some(a=>a.button===b));}
 reset(){this.endStick();this.lookId=null;for(const[id,{button}]of this.actions){if(button.hasPointerCapture(id))button.releasePointerCapture(id);}this.actions.clear();this.refreshActions();}
}
