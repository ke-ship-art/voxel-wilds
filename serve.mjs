import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{res.setHeader('X-Voxel-Wilds','local-game');let route;try{route=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);res.end('Bad request');return;}const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',TYPES[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);});});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'Port 4178 is already in use. Close the other service and retry.':err.message);process.exitCode=1;});
export const ready=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4178,'127.0.0.1',()=>{console.log('Local: http://127.0.0.1:4178');resolve(server);});});
// Direct server use should also report startup errors without an unhandled rejection.
ready.catch(()=>{});
