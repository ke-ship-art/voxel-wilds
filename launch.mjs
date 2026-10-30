import {spawn} from 'node:child_process';
import http from 'node:http';

const url='http://127.0.0.1:4178/';
function probe(){return new Promise(resolve=>{const req=http.get(url,res=>{res.resume();resolve(res.statusCode===200&&res.headers['x-voxel-wilds']==='local-game');});req.setTimeout(1500,()=>req.destroy());req.on('error',()=>resolve(false));});}
async function openBrowser(){
 if(process.argv.includes('--no-open'))return;
 const child=spawn('explorer.exe',[url],{stdio:'ignore',windowsHide:true});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
 child.unref();
}
try{
 if(await probe())console.log('The game is already running. Opening it again.');
 else{const {ready}=await import('./serve.mjs');await ready;console.log('Keep this window open while playing. Close it to stop the local server.');}
 await openBrowser();
 console.log('Game: '+url);
}catch(err){console.error('Could not launch the game: '+err.message);process.exitCode=1;}
