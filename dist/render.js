import * as T from './vendor/three.module.js';
import {BLOCKS,SIZE,HALF,HEIGHT,CHUNK,SEA} from './world.js';
export {T};
export function makeAtlas(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=48;const c=canvas.getContext('2d');
 const colors=['#7ba24a','#846445','#8d6546','#939892','#70563b','#b39159','#537d3d','#d8cc98','#b8955a','#858d87','#a2d0cd','#a96e56','#e5cf89','#92968e','#92968e','#434a48','#92968e','#4d9cae','#9a7848','#a78350','#e5ece4'];
 let s=17;const rand=()=>{s=(Math.imul(s,1664525)+1013904223)|0;return(s>>>0)/4294967296;};
 for(let tile=0;tile<colors.length;tile++){const ox=(tile%8)*16,oy=Math.floor(tile/8)*16;const base=new T.Color(colors[tile]);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){let v=(rand()-.5)*(tile===0?.08:tile===6?.15:.12);const col=base.clone().offsetHSL(0,0,v);c.fillStyle='#'+col.getHexString();c.fillRect(ox+x,oy+y,1,1);}
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(ox+x,oy+y,w,h);};
  if(tile===1){for(let x=0;x<16;x++)rect(x,0,1,3+Math.floor(rand()*3),rand()>.5?'#729b46':'#60873b');}
  if(tile===4){for(let x=1;x<16;x+=3)rect(x,0,1,16,'#4c3d2c88');for(let k=0;k<15;k++)rect(Math.floor(rand()*16),Math.floor(rand()*16),1,4,'#c49a5d55');}
  if(tile===5){c.strokeStyle='#775534';for(let k=2;k<8;k+=2)c.strokeRect(ox+k+.5,oy+k+.5,15-k*2,15-k*2);}
  if(tile===8||tile===18){for(let y=3;y<16;y+=4){rect(0,y,16,1,'#755839');rect(y%8?4:11,y-3,1,3,'#82623f');}}
  if(tile===9){c.strokeStyle='#5e6660';for(let y=0;y<16;y+=5)for(let x=-(y%2)*3;x<16;x+=7)c.strokeRect(ox+x,oy+y,7,5);}
  if(tile===10){rect(0,0,16,1,'#daf4e3');rect(0,0,1,16,'#daf4e3');rect(15,0,1,16,'#80aeb3');rect(0,15,16,1,'#80aeb3');rect(3,4,2,5,'#e2f7ea');rect(5,3,2,3,'#e2f7ea');rect(11,10,1,3,'#e2f7ea');}
  if(tile===11){for(let y=3;y<16;y+=4){rect(0,y,16,1,'#c9b99a');for(let x=y%8?3:7;x<16;x+=8)rect(x,y-3,1,3,'#c9b99a');}}
  if([12,13,14,16].includes(tile)){for(let k=0;k<14;k++){const x=Math.floor(rand()*14),y=Math.floor(rand()*14);rect(x,y,2,2,({12:'#fff2b7',13:'#343c36',14:'#c8b097',16:'#75e5d3'})[tile]);rect(x,y+2,2,1,({12:'#b99d50',13:'#555e56',14:'#8f7056',16:'#338c92'})[tile]);}}
  if(tile===19){rect(1,1,14,14,'#604d32');for(let y=2;y<14;y+=4)for(let x=2;x<14;x+=4)rect(x,y,3,3,'#ae8551');}
 }
 const tex=new T.CanvasTexture(canvas);tex.magFilter=T.NearestFilter;tex.minFilter=T.NearestMipmapNearestFilter;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
 return{canvas,tex};
}
export class View{
 constructor(canvas,world){
  this.world=world;this.scene=new T.Scene();this.scene.background=new T.Color('#9fc9d6');this.scene.fog=new T.Fog('#afcdd4',48,110);
  this.camera=new T.PerspectiveCamera(75,innerWidth/innerHeight,.06,180);this.camera.rotation.order='YXZ';
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=T.SRGBColorSpace;
  const atlas=makeAtlas();this.atlas=atlas.canvas;this.material=new T.MeshLambertMaterial({map:atlas.tex,vertexColors:true});this.glassMaterial=new T.MeshLambertMaterial({map:atlas.tex,vertexColors:true,transparent:true,opacity:.5,depthWrite:false});this.waterMaterial=new T.MeshPhongMaterial({color:'#4f9fae',transparent:true,opacity:.65,shininess:90,flatShading:true,depthWrite:false});
  this.hemi=new T.HemisphereLight('#eff5ec','#798b59',2.05);this.scene.add(this.hemi);this.sunlight=new T.DirectionalLight('#fff0d0',1.5);this.sunlight.position.set(-50,85,30);this.scene.add(this.sunlight);
  this.chunks=new Map();this.dirty=new Set();this.animals=[];this.particles=[];
  this.outline=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.006,1.006,1.006)),new T.LineBasicMaterial({color:'#23382a',transparent:true,opacity:.8}));this.outline.visible=false;this.scene.add(this.outline);
  const disc=new T.CircleGeometry(1,28);this.sun=new T.Mesh(disc,new T.MeshBasicMaterial({color:'#fff3cb',fog:false}));this.sun.scale.setScalar(9);this.scene.add(this.sun);this.moon=new T.Mesh(disc,new T.MeshBasicMaterial({color:'#d6e9e3',fog:false}));this.moon.scale.setScalar(6);this.scene.add(this.moon);
  this.clouds=new T.Group();const cloudMat=new T.MeshLambertMaterial({color:'#f5f4e7',transparent:true,opacity:.86});for(let i=0;i<30;i++){const cloud=new T.Group();for(let j=0;j<4;j++){const mesh=new T.Mesh(new T.BoxGeometry(8+j*2,1.2,6+j),cloudMat);mesh.position.set(j*5,Math.sin(j)*.6,j%2*2);cloud.add(mesh);}cloud.position.set(world.hash(i,81)*240-120,48+world.hash(i,91)*8,world.hash(i,17)*240-120);cloud.userData.baseX=cloud.position.x;cloud.userData.speed=.55+world.hash(i,7)*.9;this.clouds.add(cloud);}this.scene.add(this.clouds);
  const stars=[];for(let i=0;i<500;i++){const a=world.hash(i,1)*Math.PI*2,b=world.hash(i,2)*1.4;stars.push(Math.sin(a)*Math.cos(b)*145,Math.sin(b)*145,Math.cos(a)*Math.cos(b)*145);}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(stars,3));this.stars=new T.Points(sg,new T.PointsMaterial({color:'#ffffff',size:.35,transparent:true,opacity:0,fog:false}));this.scene.add(this.stars);
  this.hand=new T.Group();this.handCube=new T.Mesh(new T.BoxGeometry(.12,.12,.12),new T.MeshLambertMaterial({map:atlas.tex}));this.handCube.rotation.set(.25,.3,-.2);this.hand.add(this.handCube);this.hand.position.set(.40,-.20,-.55);this.camera.add(this.hand);this.scene.add(this.camera);this.camera.add(new T.PointLight('#fff7d8',.9,3));
  addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);});
 }
 setHandBlock(id){const b=BLOCKS[id],uv=this.handCube.geometry.attributes.uv;for(let f=0;f<6;f++){const t=b.tiles?.[f]??b.tile,x=(t%8)*16,y=Math.floor(t/8)*16;for(let i=0;i<4;i++)uv.setXY(f*4+i,(x+(i%2?15.8:.2))/128,1-(y+(i<2?.2:15.8))/48);}uv.needsUpdate=true;}
 icon(id){if(!this.icons)this.icons={};if(this.icons[id])return this.icons[id];const c=document.createElement('canvas');c.width=48;c.height=48;const g=c.getContext('2d');g.imageSmoothingEnabled=false;const b=BLOCKS[id];
  const face=(tile,a,b,c,d,e,f,shade)=>{g.save();g.transform(a,b,c,d,e,f);g.drawImage(this.atlas,(tile%8)*16,Math.floor(tile/8)*16,16,16,0,0,16,16);if(shade){g.fillStyle=`rgba(0,0,0,${shade})`;g.fillRect(0,0,16,16);}g.restore();};
  face(b.tiles?.[2]??b.tile,1.3,-.65,1.3,.65,3,13,0);face(b.tiles?.[1]??b.tile,1.3,.65,0,1.3,3,13,.2);face(b.tiles?.[0]??b.tile,1.3,-.65,0,1.3,23.8,23.4,.27);return this.icons[id]=c.toDataURL();
 }
 buildAll(){for(let z=-HALF;z<HALF;z+=CHUNK)for(let x=-HALF;x<HALF;x+=CHUNK)this.buildChunk(x,z);this.addAnimals();this.addPlants();}
 buildChunk(cx,cz){
  const key=cx+','+cz;const old=this.chunks.get(key);if(old){for(const m of old.children)m.geometry.dispose();this.scene.remove(old);}
  const group=new T.Group(),buffers=[{p:[],n:[],u:[],c:[]},{p:[],n:[],u:[],c:[]},{p:[],n:[],u:[],c:[]}];
  const faces=[{n:[1,0,0],v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],s:.84},{n:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],s:.72},{n:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],s:1},{n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],s:.58},{n:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],s:.9},{n:[0,0,-1],v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],s:.8}];
  for(let z=cz;z<cz+CHUNK;z++)for(let x=cx;x<cx+CHUNK;x++)for(let y=0;y<HEIGHT;y++){
   const id=this.world.get(x,y,z);if(!id)continue;const b=BLOCKS[id],buf=buffers[id===16?2:id===9?1:0];
   faces.forEach((face,fi)=>{const[nx,ny,nz]=face.n,neighbor=this.world.get(x+nx,y+ny,z+nz);if(neighbor===id||neighbor&&neighbor!==9&&neighbor!==16)return;if(id===16&&neighbor)return;
    const tile=b.tiles?.[fi]??b.tile,u0=((tile%8)*16+.2)/128,u1=((tile%8)*16+15.8)/128,v1=1-(Math.floor(tile/8)*16+.2)/48,v0=1-(Math.floor(tile/8)*16+15.8)/48,uv=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
    for(const vi of [0,1,2,0,2,3]){const v=face.v[vi];buf.p.push(x+v[0],y+v[1]-(id===16&&v[1]===1?.13:0),z+v[2]);buf.n.push(nx,ny,nz);buf.u.push(...uv[vi]);
     let occ=0;if(id!==16){const axes=[0,1,2].filter(a=>face.n[a]===0);for(const a of axes){const pos=[x+nx,y+ny,z+nz];pos[a]+=v[a]===0?-1:1;if(this.world.solid(...pos))occ++;}}
     const shade=face.s*(1-occ*.13)*(id===11?1.25:1);buf.c.push(shade,shade,shade);
    }
   });
  }
  buffers.forEach((b,i)=>{if(!b.p.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setAttribute('color',new T.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();group.add(new T.Mesh(g,[this.material,this.glassMaterial,this.waterMaterial][i]));});this.chunks.set(key,group);this.scene.add(group);
 }
 changed(x,z){for(const[dx,dz]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]])this.dirty.add(`${Math.floor((x+dx)/CHUNK)*CHUNK},${Math.floor((z+dz)/CHUNK)*CHUNK}`);}
 addAnimals(){const geo=new T.BoxGeometry(1,1,1);for(let i=0;i<12;i++){const sheep=i%3!==0,g=new T.Group();const bodyMat=new T.MeshLambertMaterial({color:sheep?'#e5e2cf':'#d9958b'}),legMat=new T.MeshLambertMaterial({color:sheep?'#7c6b51':'#a76662'});const part=(scale,pos,mat)=>{const m=new T.Mesh(geo,mat);m.scale.set(...scale);m.position.set(...pos);g.add(m);return m;};part([.75,.65,1.2],[0,.8,0],bodyMat);part([.48,.5,.5],[0,.98,-.7],sheep?legMat:bodyMat);const legs=[];for(const x of[-.24,.24])for(const z of[-.38,.38])legs.push(part([.18,.5,.18],[x,.27,z],legMat));for(const x of[-.25,.25])part([.025,.07,.08],[x,1.07,-.8],new T.MeshBasicMaterial({color:'#202621'}));g.position.set(6+this.world.hash(i,31)*32,0,12+this.world.hash(i,32)*28);g.rotation.y=this.world.hash(i,13)*6.28;this.scene.add(g);this.animals.push({g,legs,phase:i*2,origin:g.position.clone()});}}
 addPlants(){const geo=new T.BufferGeometry(),p=[],col=[];for(let i=0;i<1300;i++){const x=Math.floor(this.world.hash(i,123)*SIZE)-HALF,z=Math.floor(this.world.hash(i,456)*SIZE)-HALF,y=this.world.surface(x,z)+1;if(this.world.get(x,y-1,z)!==1||this.world.get(x,y,z)||x>=17&&x<=28&&z>=-6&&z<=6)continue;const flower=i%5===0;for(let f=0;f<2;f++){
 const quad=(lo,hi,width,color)=>{const vx=f?width:0,vz=f?0:width,pts=[[x+.5-vx,y+lo,z+.5-vz],[x+.5+vx,y+lo,z+.5+vz],[x+.5+vx,y+hi,z+.5+vz],[x+.5-vx,y+hi,z+.5-vz]],c=new T.Color(color);for(const n of[0,1,2,0,2,3]){p.push(...pts[n]);col.push(...c.toArray());}};
 if(flower){quad(0,.35,.025,'#557840');quad(.25,.37,.1,i%2?'#f1ce79':'#db8973');quad(.27,.35,.045,'#efd8a1');}else{quad(0,.22,.025,'#5c803e');quad(.04,.14,.1,'#608740');quad(.14,.3,.013,'#6f9449');}
 }}geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));this.plants=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));this.scene.add(this.plants);}
 burst(x,y,z,id){const mat=new T.MeshLambertMaterial({color:BLOCKS[id].color});for(let i=0;i<9;i++){const mesh=new T.Mesh(new T.BoxGeometry(.1,.1,.1),mat);mesh.position.set(x+.5,y+.5,z+.5);this.scene.add(mesh);this.particles.push({mesh,vel:new T.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3),life:.65});}}
 animate(dt,time,player,active){
  if(this.dirty.size){for(const key of [...this.dirty].slice(0,3)){this.dirty.delete(key);this.buildChunk(...key.split(',').map(Number));}}
  const a=time/1440*Math.PI*2-Math.PI/2,day=Math.max(.06,Math.sin(a)),blend=T.MathUtils.smoothstep(day,.02,.5);const sky=new T.Color('#162c47').lerp(new T.Color('#a3cbd6'),blend);this.scene.background.copy(sky);this.scene.fog.color.copy(sky);this.hemi.intensity=.38+blend*1.65;this.sunlight.intensity=.1+day*1.45;
  this.sun.position.set(player.x+Math.cos(a)*105,Math.sin(a)*105,player.z-65);this.sun.lookAt(this.camera.position);this.moon.position.set(player.x-Math.cos(a)*105,-Math.sin(a)*105,player.z-65);this.moon.lookAt(this.camera.position);this.sunlight.position.set(Math.cos(a)*70,Math.sin(a)*90,30);this.stars.position.set(player.x,0,player.z);this.stars.material.opacity=(1-blend)*.9;
  const drift=performance.now()*.00035;for(const cloud of this.clouds.children){const base=cloud.userData;let x=(base.baseX+drift*base.speed+120)%240;if(x<0)x+=240;cloud.position.x=x-120;}
  for(const animal of this.animals){const t=performance.now()*.00022+animal.phase;if(active){const x=animal.origin.x+Math.sin(t)*3,z=animal.origin.z+Math.cos(t*.8)*3,y=this.world.surface(x,z)+1;animal.g.position.set(x,y,z);animal.g.rotation.y=Math.atan2(Math.cos(t),-.8*Math.sin(t*.8));for(let i=0;i<4;i++)animal.legs[i].rotation.x=Math.sin(t*12+(i%2)*Math.PI)*.23;}}
  for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.vel.y-=9*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.x+=dt*3;p.mesh.scale.setScalar(Math.max(0,p.life/.65));if(p.life<=0){this.scene.remove(p.mesh);p.mesh.geometry.dispose();if(!this.particles.some((other,j)=>j!==i&&other.mesh.material===p.mesh.material))p.mesh.material.dispose();this.particles.splice(i,1);}}
  this.renderer.render(this.scene,this.camera);
 }
}
