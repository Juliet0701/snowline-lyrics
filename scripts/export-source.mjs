import {auditSource} from './audit-source.mjs';
import {cp,mkdir,stat,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const out=join(root,'dist',`snowline-lyrics-${pkg.version}-source`);
try{await stat(out);throw new Error('Source export already exists; review the previous export.');}catch(e){if(e.code!=='ENOENT')throw e;}
const list=await auditSource();
for(const file of list){const dest=join(out,file);await mkdir(dirname(dest),{recursive:true});await cp(join(root,file),dest);}
console.log(`GitHub-ready source export: ${out}\n${list.length} files.`);
