import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const out=join(root,'dist',`Snowline-Lyrics-${pkg.version}-win-x64`);
await mkdir(dirname(out),{recursive:true});
await mkdir(out,{recursive:false});
await copyFile(join(root,'src-tauri/target/release/snowline-desktop.exe'),join(out,'SnowlineLyrics.exe'));
for(const file of ['LICENSE','THIRD-PARTY-NOTICES.md','PRIVACY.md','QUICKSTART.txt'])await copyFile(join(root,file),join(out,file));
const result=spawnSync('cargo',['metadata','--locked','--offline','--filter-platform','x86_64-pc-windows-msvc','--manifest-path',join(root,'src-tauri/Cargo.toml'),'--format-version','1'],{encoding:'utf8',maxBuffer:20*1024*1024});if(result.status!==0)throw Error(result.stderr);
const metadata=JSON.parse(result.stdout),licenses=[];
for(const p of metadata.packages){if(!p.source)continue;const dir=dirname(p.manifest_path),dest=join(out,'third-party-licenses',p.name+'-'+p.version);let found=false;for(const f of await readdir(dir,{withFileTypes:true})){if(f.isFile()&&/^(LICENSE|LICENCE|COPYING|NOTICE|AUTHORS)(?:$|[._-])/i.test(f.name)){await mkdir(dest,{recursive:true});await copyFile(join(dir,f.name),join(dest,f.name));found=true;}}licenses.push({name:p.name,version:p.version,license:p.license,repository:p.repository,licenseFilesIncluded:found});}
await writeFile(join(out,'third-party-licenses.json'),JSON.stringify(licenses,null,2));
await writeFile(join(out,'BUILD.json'),JSON.stringify({name:pkg.productName,version:pkg.version,platform:'win32-x64',runtime:'Tauri 2 + system WebView2',node:false,electron:false,nativeMedia:'Windows.Media.Control via Rust',profile:'release'},null,2));
console.log(out);
