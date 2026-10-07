// Regenerates every picture that is derived from the character pictures: the panels of the agent link previews
// (public/characters/card/<id>.jpg, 480x630), the transparent deck pictures and the invite pair (see below).
// /api/og/agent/<id> draws the preview with satori, which reads PNG and JPEG but not WebP, so each character picture
// (public/characters/<id>.webp) is composed once onto the card's dark panel with its yellow glow and saved as a JPEG.
//   node scripts/render-agent-cards.mjs
// Run it after scripts/render-character-thumbs.mjs whenever the character pictures change. Uses sharp, which is
// installed with next (no extra dependency); nothing is sent anywhere.
import {readdirSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';

const SRC='public/characters',OUT='public/characters/card',W=480,H=630,TALL=600;
mkdirSync(OUT,{recursive:true});
const panel=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="56%" r="50%">
<stop offset="0" stop-color="#ffe600" stop-opacity=".26"/><stop offset=".5" stop-color="#ffe600" stop-opacity=".08"/><stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/></radialGradient></defs>
<rect width="100%" height="100%" fill="#0a0a0a"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
const files=readdirSync(SRC).filter(f=>/^[a-z0-9-]{2,24}\.webp$/.test(f)).sort();
for(const f of files){
 const id=f.replace(/\.webp$/,'');
 const figure=await sharp(`${SRC}/${f}`).resize({height:TALL,width:W,fit:'inside'}).toBuffer({resolveWithObject:true});
 const out=await sharp(panel).composite([{input:figure.data,left:Math.round((W-figure.info.width)/2),top:H-figure.info.height}]).jpeg({quality:88,mozjpeg:true}).toFile(`${OUT}/${id}.jpg`);
 console.log(`saved ${OUT}/${id}.jpg (${(out.size/1024).toFixed(1)} KB)`);
}
console.log(`${files.length} cards written`);

// The transparent pictures the deck cards use (public/characters/deck/<id>.png, 390x520), the copies some page cards
// read under their own names, and the two characters of the invite card on the dark panel (pair-invite.jpg, 640x630).
const DECK='public/characters/deck';mkdirSync(DECK,{recursive:true});
for(const f of files)await sharp(`${SRC}/${f}`).resize(390,520).png({compressionLevel:9}).toFile(`${DECK}/${f.replace(/\.webp$/,'.png')}`);
for(const [from,to] of [['echo','deck-echo'],['juno','deck-juno'],['lumi','deck-lumi'],['atlas','team-atlas'],['nova','team-nova']])await sharp(`${DECK}/${from}.png`).toFile(`${OUT}/${to}.png`);
const PW=640,wide=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="56%" r="50%">
<stop offset="0" stop-color="#ffe600" stop-opacity=".26"/><stop offset=".5" stop-color="#ffe600" stop-opacity=".08"/><stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/></radialGradient></defs>
<rect width="100%" height="100%" fill="#0a0a0a"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
const pair=await Promise.all([['juno',470,60,598],['nova',500,300,560]].map(async([id,tall,left,foot])=>{const p=await sharp(`${SRC}/${id}.webp`).resize({height:tall}).toBuffer();return {input:p,left,top:foot-tall};}));
await sharp(wide).composite(pair).jpeg({quality:88,mozjpeg:true}).toFile(`${OUT}/pair-invite.jpg`);
console.log(`${files.length} deck pictures, 5 copies and pair-invite.jpg written`);

// The real Harvex logo (mark + wordmark) for the card header: public/harvex-logo.png is yellow on a black field, so its
// brightness becomes the alpha of a yellow image. The result sits on any dark background without a visible box.
const LOGO_W=330,LOGO_H=100;
const mark=await sharp('public/harvex-logo.png').trim({threshold:40}).resize({width:LOGO_W,height:LOGO_H,fit:'contain',position:'left',background:{r:10,g:10,b:10}}).toBuffer();
const alpha=await sharp(mark).greyscale().linear(255/(224-14),-14*255/(224-14)).raw().toBuffer();
const logo=await sharp({create:{width:LOGO_W,height:LOGO_H,channels:3,background:'#ffe600'}}).joinChannel(alpha,{raw:{width:LOGO_W,height:LOGO_H,channels:1}}).png({compressionLevel:9}).toFile('public/brands/harvex-logo-lime.png');
console.log(`saved public/brands/harvex-logo-lime.png (${LOGO_W}x${LOGO_H}, ${(logo.size/1024).toFixed(1)} KB)`);
