export const SIZE=160, HALF=SIZE/2, HEIGHT=64, SEA=12, CHUNK=16;
export const BLOCKS=[null,
 {name:'草方块',color:'#6f9b45',tiles:[1,1,0,2,1,1],time:.45},
 {name:'泥土',color:'#896344',tile:2,time:.4},
 {name:'石头',color:'#8e9591',tile:3,time:1.8,drop:8},
 {name:'橡木原木',color:'#725437',tiles:[4,4,5,5,4,4],time:1},
 {name:'橡树树叶',color:'#4e7e3e',tile:6,time:.25},
 {name:'沙子',color:'#d9ca90',tile:7,time:.4},
 {name:'橡木木板',color:'#b18c51',tile:8,time:.6},
 {name:'圆石',color:'#7e8983',tile:9,time:1.4},
 {name:'玻璃',color:'#a3d1d0',tile:10,time:.3,transparent:true},
 {name:'红砖',color:'#a5674f',tile:11,time:1.2},
 {name:'萤石',color:'#eed99a',tile:12,time:.5},
 {name:'煤矿石',color:'#626760',tile:13,time:1.8},
 {name:'铁矿石',color:'#a29782',tile:14,time:2.2},
 {name:'钻石矿石',color:'#68b9b4',tile:16,time:2.7},
 {name:'基岩',color:'#3d4242',tile:15,time:Infinity},
 {name:'水',color:'#549fbb',tile:17,transparent:true,time:Infinity},
 {name:'木制平台',color:'#947049',tiles:[18,18,19,8,18,18],time:1},
 {name:'雪块',color:'#e1e9e2',tile:20,time:.35}
];
export function seedNumber(str){let h=2166136261;for(const c of String(str))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export class World{
 constructor(seed='WILDS-2026'){this.seed=seed;this.s=seedNumber(seed);this.data=new Uint8Array(SIZE*SIZE*HEIGHT);this.heights=new Uint8Array(SIZE*SIZE);this.edits=new Map();this.ready=false;}
 hash(x,z,y=0){let h=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(y,1274126177)^this.s;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
 noise(x,z){const ix=Math.floor(x),iz=Math.floor(z);let a=x-ix,b=z-iz;a=a*a*(3-2*a);b=b*b*(3-2*b);return (this.hash(ix,iz)*(1-a)+this.hash(ix+1,iz)*a)*(1-b)+(this.hash(ix,iz+1)*(1-a)+this.hash(ix+1,iz+1)*a)*b;}
 index(x,y,z){return y*SIZE*SIZE+(z+HALF)*SIZE+x+HALF;}
 inside(x,y,z){return x>=-HALF&&x<HALF&&z>=-HALF&&z<HALF&&y>=0&&y<HEIGHT;}
 get(x,y,z){return this.inside(x,y,z)?this.data[this.index(x,y,z)]:0;}
 solid(x,y,z){const b=this.get(x,y,z);return b!==0&&b!==16;}
 set(x,y,z,b,record=false){if(!this.inside(x,y,z))return false;const i=this.index(x,y,z);this.data[i]=b;if(record)this.edits.set(i,b);if(this.ready)this.updateHeight(x,z);return true;}
 updateHeight(x,z){if(!this.inside(x,0,z))return;let h=0;for(let y=HEIGHT-1;y>=0;y--){const b=this.data[this.index(x,y,z)];if(b&&b!==16){h=y;break;}}this.heights[(z+HALF)*SIZE+x+HALF]=h;}
 surface(x,z){x=Math.max(-HALF,Math.min(HALF-1,Math.floor(x)));z=Math.max(-HALF,Math.min(HALF-1,Math.floor(z)));return this.heights[(z+HALF)*SIZE+x+HALF];}
 generate(){
  for(let z=-HALF;z<HALF;z++)for(let x=-HALF;x<HALF;x++){
   const river=Math.abs(x-(Math.sin(z*.045)*10-10));
   const mountain=Math.max(0,1-Math.hypot((x-7)/47,(z+43)/32));
   let h=Math.floor(14+this.noise(x*.032,z*.032)*8+this.noise(x*.12,z*.12)*2+mountain*mountain*25);
   if(river<8)h=Math.floor(9+river*.7+this.noise(x*.13,z*.13));
   if(x>=17&&x<=28&&z>=-6&&z<=6)h=19;
   this.heights[(z+HALF)*SIZE+x+HALF]=h;
   for(let y=0;y<=Math.max(h,SEA);y++){
    let b=y>h?16:y===0?15:y===h?(h<=SEA+1?6:h>35?18:1):y>=h-3?(h<=SEA+1?6:2):3;
    if(b===3){const r=this.hash(x,z,y);if(r>.965)b=12;if(y<12&&r>.985)b=13;if(y<7&&r>.995)b=14;if(y>2&&y<h-5&&this.noise(x*.13+y*.24,z*.13-y*.17)>.79)b=0;}
    this.set(x,y,z,b);
   }
  }
  for(let z=-HALF+4;z<HALF-4;z+=5)for(let x=-HALF+4;x<HALF-4;x+=5){
   const tx=x+Math.floor(this.hash(x,z,44)*3),tz=z+Math.floor(this.hash(x,z,55)*3),h=this.surface(tx,tz);
   if(this.hash(x,z,77)<.44||h<=SEA+1||h>32||(tx>8&&tx<35&&tz>-13&&tz<37))continue;
   const trunk=4+Math.floor(this.hash(x,z,5)*3);
   for(let y=h+1;y<=h+trunk;y++)this.set(tx,y,tz,4);
   for(let dy=-2;dy<=1;dy++){const radius=dy===1?1:2;for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.abs(dx)===radius&&Math.abs(dz)===radius&&this.hash(tx+dx,tz+dz,dy)>.45)continue;
    if(!this.get(tx+dx,h+trunk+dy,tz+dz))this.set(tx+dx,h+trunk+dy,tz+dz,5);
   }}
  }
  // A small inhabitable woodland shelter gives the first vista a destination.
  for(let z=-3;z<=3;z++)for(let x=19;x<=25;x++){
   this.set(x,20,z,7);
   for(let y=21;y<=24;y++)if(x===19||x===25||z===-3||z===3){let b=(x===19||x===25)&&(z===-3||z===3)?4:7;if(y===22&&(x===19||x===25)&&Math.abs(z)<=1)b=9;if(z===3&&x===22&&y<=22)b=0;this.set(x,y,z,b);}
  }
  for(let layer=0;layer<4;layer++)for(let z=-4;z<=4;z++)for(let x=18+layer;x<=26-layer;x++)this.set(x,25+layer,z,4);
  this.set(20,21,-2,17);this.set(24,23,-2,11);
  this.ready=true;
  return this;
 }
 applyEdits(edits){for(const pair of edits??[]){if(!Array.isArray(pair)||pair.length!==2)throw Error('存档方块格式不正确');const[i,b]=pair;if(!Number.isInteger(i)||i<0||i>=this.data.length||!Number.isInteger(b)||b<0||b>=BLOCKS.length)throw Error('存档方块数据超出范围');this.data[i]=b;this.edits.set(i,b);this.updateHeight(i%SIZE-HALF,Math.floor(i/SIZE)%SIZE-HALF);}}
}
export function raycast(world,origin,dir,max=7){
 let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z),dist=0,normal={x:0,y:0,z:0};
 const sx=dir.x>=0?1:-1,sy=dir.y>=0?1:-1,sz=dir.z>=0?1:-1;
 const dx=Math.abs(1/dir.x),dy=Math.abs(1/dir.y),dz=Math.abs(1/dir.z);
 let tx=(dir.x>=0?x+1-origin.x:origin.x-x)*dx,ty=(dir.y>=0?y+1-origin.y:origin.y-y)*dy,tz=(dir.z>=0?z+1-origin.z:origin.z-z)*dz;
 if(!Number.isFinite(tx))tx=Infinity;if(!Number.isFinite(ty))ty=Infinity;if(!Number.isFinite(tz))tz=Infinity;
 for(let n=0;n<80&&dist<=max;n++){
  const b=world.get(x,y,z);if(b&&b!==16)return{x,y,z,b,normal,distance:dist};
  if(tx<ty&&tx<tz){x+=sx;dist=tx;tx+=dx;normal={x:-sx,y:0,z:0};}else if(ty<tz){y+=sy;dist=ty;ty+=dy;normal={x:0,y:-sy,z:0};}else{z+=sz;dist=tz;tz+=dz;normal={x:0,y:0,z:-sz};}
 }return null;
}
