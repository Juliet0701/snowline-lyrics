import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));let count=0;
for(const dir of ['app','desktop','web','scripts','tests'])for(const file of await readdir(join(root,dir))){
 if(!/\.(?:mjs|cjs|js)$/.test(file))continue;
 const r=spawnSync(process.execPath,['--check',join(root,dir,file)],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);count++;
}
JSON.parse(await readFile(join(root,'package.json'),'utf8'));console.log(`Syntax OK: ${count} JavaScript files.`);
