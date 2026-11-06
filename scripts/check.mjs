import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const dir of ['web','scripts'])for(const file of await readdir(dir)){if(!/\.(mjs|js)$/.test(file))continue;const r=spawnSync(process.execPath,['--check',`${dir}/${file}`],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
const r=spawnSync('cargo',['check','--locked','--manifest-path','src-tauri/Cargo.toml'],{stdio:'inherit'});process.exitCode=r.status??1;
