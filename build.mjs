import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const page=readFileSync(new URL('src/page.html',import.meta.url),'utf8');
const core=readFileSync(new URL('src/core.js',import.meta.url),'utf8');
if(!page.includes('/* CORE */'))throw new Error('Missing core insertion marker');
const html=page.replace('/* CORE */',core);
mkdirSync(new URL('downloads/',import.meta.url),{recursive:true});
writeFileSync(new URL('index.html',import.meta.url),html);
writeFileSync(new URL('downloads/EMK-Easy.html',import.meta.url),html);
console.log('Built index.html and downloads/EMK-Easy.html');

await import('./windows/prepare.mjs');
