// Regenerates the static character thumbnails in public/characters/<id>.webp from the live 3D engine.
// The app shows these instead of loading three.js on first paint (see app/avatar.tsx).
// WebGL is needed, so the rendering happens in a browser tab of the dev server:
//   1. npm run dev                                  (http://localhost:5173)
//   2. node scripts/render-character-thumbs.mjs     (starts a tiny save server on 127.0.0.1:5199)
//   3. open http://localhost:5173 and paste the printed snippet into the browser console
//   4. node scripts/render-agent-cards.mjs          (the link-preview panels are made from these pictures)
// Run again after changing presets or the engine's look. Every character gets two pictures from ONE render of
// 900x1200: public/characters/hd/<id>.webp at that size (the large stage on the home page, sharp on a 2x screen) and
// public/characters/<id>.webp at 450x600 (everything else), scaled down in the page, so the result does not depend on
// the screen it was made on.
import http from 'node:http';
import {writeFileSync,mkdirSync} from 'node:fs';

const PORT=Number(process.env.THUMB_PORT||5199);const OUT='public/characters';mkdirSync(OUT+'/hd',{recursive:true});
let saved=0;
http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:5173');res.setHeader('Access-Control-Allow-Headers','content-type');
 if(req.method==='OPTIONS'){res.end();return;}
 const q=new URL(req.url,'http://x').searchParams;const id=q.get('id')||'';const dir=q.get('hd')?OUT+'/hd':OUT;
 if(req.method!=='POST'||!/^[a-z0-9-]{2,24}$/.test(id)){res.statusCode=400;res.end('bad request');return;}
 const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{
  const m=/^data:image\/webp;base64,(.+)$/.exec(Buffer.concat(chunks).toString());
  if(!m){res.statusCode=400;res.end('expected a webp data URL');return;}
  const buf=Buffer.from(m[1],'base64');writeFileSync(`${dir}/${id}.webp`,buf);saved++;
  console.log(`saved ${dir}/${id}.webp (${(buf.length/1024).toFixed(1)} KB)`);res.end('ok');
 });
}).listen(PORT,'127.0.0.1',()=>console.log(`Save server on http://127.0.0.1:${PORT}. Paste this in the console of http://localhost:5173:

(async()=>{const {loadEngine}=await import('/app/avatar.tsx');const R=await loadEngine();
const {characters,lookFor}=await import('/lib/characters.ts');
const pic=(img,w,h,q)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);return c.toDataURL('image/webp',q);};
for(const c of characters){const img=await createImageBitmap(await (await fetch(await R.renderThumbAsync(lookFor(c.id),900,1200))).blob());
 await fetch('http://127.0.0.1:${PORT}/save?hd=1&id='+c.id,{method:'POST',body:pic(img,900,1200,0.9)});
 await fetch('http://127.0.0.1:${PORT}/save?id='+c.id,{method:'POST',body:pic(img,450,600,0.9)});}
return characters.length+' characters sent (two pictures each)';})()
`));
