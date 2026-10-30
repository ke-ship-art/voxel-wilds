import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{const route=decodeURIComponent(req.url.split('?')[0]);const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);});});
server.listen(4178,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4178'));
