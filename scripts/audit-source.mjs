import {readdir,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
export const directories=['web','rust','src-tauri','scripts','docs','.github'];
export const files=['package.json','package-lock.json','README.md','README.zh-CN.md','LICENSE','THIRD-PARTY-NOTICES.md','PRIVACY.md','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md','QUICKSTART.txt','.gitignore','.gitattributes'];
export async function sourceFiles(){const list=[...files];async function walk(dir){for(const e of await readdir(join(root,dir),{withFileTypes:true})){if(['target','gen','node_modules','.local'].includes(e.name))continue;const path=dir+'/'+e.name;if(e.isDirectory())await walk(path);else list.push(path);}}for(const dir of directories)await walk(dir);return list;}
export async function auditSource(){const list=await sourceFiles();for(const file of list){if(/(?:^|\/)(?:pairing|appearance|library|settings|window)\.json$|\.(?:exe|dll|lrc|mp3|wav|flac)$/i.test(file))throw Error('Private or binary runtime file: '+file);if(/\.(?:mjs|js|rs|json|md|toml|txt|ya?ml)$/.test(file)){const s=await readFile(join(root,file),'utf8');if(/[A-Z]:[\\/]Users[\\/]/i.test(s))throw Error('Personal path: '+file);if(/(?:github_pat_|ghp_|sk-proj-)[A-Za-z0-9_-]{20,}/.test(s))throw Error('Possible secret: '+file);}}return list;}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(`Source audit passed: ${(await auditSource()).length} files.`);
