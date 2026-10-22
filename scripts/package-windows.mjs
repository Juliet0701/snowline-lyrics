import {cp,mkdir,readFile,writeFile,rename,readdir,stat} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),require=createRequire(import.meta.url);
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Build this portable package on Windows x64.');
const runtime=process.argv[2]?resolve(process.argv[2]):dirname(require('electron'));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const out=join(root,'dist',`Snowline-Lyrics-${pkg.version}-win-x64`);
try{await stat(out);throw new Error('Output already exists. Review or move the previous build before rebuilding.');}catch(e){if(e.code!=='ENOENT')throw e;}
await stat(join(root,'native/bin/Snowline.MediaReader.exe'));
const version=(await readFile(join(runtime,'version'),'utf8')).trim();if(version!==pkg.devDependencies.electron)throw new Error(`Expected Electron ${pkg.devDependencies.electron}, found ${version}`);
await mkdir(out,{recursive:true});
for(const f of await readdir(runtime,{withFileTypes:true})){
 if(f.name==='resources')continue;
 await cp(join(runtime,f.name),join(out,f.name),{recursive:true});
}
await rename(join(out,'electron.exe'),join(out,'SnowlineLyrics.exe'));
const dest=join(out,'resources/app');await mkdir(dest,{recursive:true});
for(const dir of ['app','desktop','web','native/bin'])await cp(join(root,dir),join(dest,dir),{recursive:true});
await writeFile(join(dest,'package.json'),JSON.stringify({name:pkg.name,productName:pkg.productName,version:pkg.version,license:pkg.license,type:'module',main:pkg.main},null,2));
for(const name of ['LICENSE','THIRD-PARTY-NOTICES.md','PRIVACY.md','QUICKSTART.txt'])await cp(join(root,name),join(out,name==='LICENSE'?'LICENSE-Snowline-Lyrics.txt':name));
const forbidden=new Set(['.local','pairing.json','library.json','window.json','vendor','node_modules','.git']);
let count=0;
async function audit(dir){for(const f of await readdir(dir,{withFileTypes:true})){
 if(forbidden.has(f.name))throw new Error('Unexpected packaged content: '+f.name);
 if(f.isDirectory())await audit(join(dir,f.name));else count++;
}}
await audit(out);await writeFile(join(out,'BUILD.json'),JSON.stringify({app:pkg.productName,version:pkg.version,electron:version,platform:'win32-x64',files:count,personalDataIncluded:false},null,2));
console.log(`Portable package: ${out}\n${count} files; no production npm dependencies or personal state.`);
