import {readdir,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
// The same allowlist is used by the source export script; never zip the whole working directory.
export const directories=['app','desktop','web','native','scripts','tests','docs','.github'];
export const files=['package.json','package-lock.json','README.md','LICENSE','THIRD-PARTY-NOTICES.md','PRIVACY.md','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md','QUICKSTART.txt','.gitignore','.gitattributes'];
export async function sourceFiles(){
 const list=[...files];
 async function walk(dir){for(const entry of await readdir(join(root,dir),{withFileTypes:true})){
  if(dir==='native'&&entry.name==='bin')continue;
  const path=dir+'/'+entry.name;
  if(entry.isDirectory())await walk(path);else list.push(path);
 }}
 for(const dir of directories)await walk(dir);return list;
}
export async function auditSource(){
 const list=await sourceFiles();
 for(const file of list){
  if(/(?:^|\/)(?:vendor|node_modules|\.local|test-results|pairing\.json|library\.json)(?:\/|$)|\.(?:lrc|mp3|flac|wav|m4a|exe|dll)$/i.test(file))throw new Error('Forbidden source file: '+file);
  if(/\.(?:mjs|cjs|js|cs|ps1|json|md|txt|ya?ml)$/.test(file)){
   const text=await readFile(join(root,file),'utf8');
   if(/[A-Z]:[\\/]Users[\\/]/i.test(text))throw new Error('Private absolute path: '+file);
   if(/(?:sk-proj-|github_pat_|ghp_)[A-Za-z0-9_-]{20,}/.test(text))throw new Error('Possible credential: '+file);
  }
 }
 return list;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const list=await auditSource();console.log(`Source export audit OK: ${list.length} allowlisted files. Review new content before publishing; pattern checks cannot detect every secret.`);}
