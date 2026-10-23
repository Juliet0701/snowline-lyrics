import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBridge} from '../app/server.mjs';
import {createOvhClient,rankCandidates,chooseAutomatic} from '../app/lyrics.mjs';
const song=()=>({trackId:'system:test',source:'qq',title:'Original',artist:'Tester',durationMs:0,positionMs:0,timelineAvailable:false,pauseKnown:false,paused:false,capturedAt:Date.now()});
const row={id:22,trackName:'Original',artistName:'Tester',duration:120,syncedLyrics:'[00:00]原创第一句\n[00:10]原创第二句\n[00:20]原创第三句'};
async function fixture(options){const root=await mkdtemp(join(tmpdir(),'snowline-modes-'));const b=await createBridge({root,port:0,persist:false,token:'c'.repeat(64),...options});const api=async(path,data)=>{const r=await fetch(b.base+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':b.token},body:data===undefined?undefined:JSON.stringify(data)});return{http:r.status,...await r.json()};};return{b,api,close:async()=>{await b.close();await rm(root,{recursive:true,force:true});}};}
async function wait(fn){for(let i=0;i<60;i++){const x=await fn();if(x)return x;await new Promise(r=>setTimeout(r,15));}throw new Error('Timed out');}
test('metadata-only lookup, version confirmation, manual alignment, pause and song reset',async()=>{
 let queried=0;const f=await fixture({lookupLyrics:async p=>{queried++;assert.equal(p.durationMs,0);return[row];}});
 try{
  await f.api('playback',song());await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='choose';});assert.equal(queried,1);
  await f.api('lyrics/select',{trackId:'system:test',id:22});assert.equal((await f.api('state')).mode,'align-required');
  assert.equal((await f.api('manual/align',{trackId:'old',recordId:22,index:1})).http,409);
  const revision=(await f.api('state')).lyrics.revision;
  assert.equal((await f.api('manual/align',{trackId:'system:test',recordId:22,revision,index:1})).http,200);
  let s=await f.api('state');assert.equal(s.mode,'manual');assert.ok(s.displayPlayback.positionMs>=10000);
  await f.api('playback',song());assert.equal((await f.api('state')).mode,'manual');
  await f.api('manual/control',{trackId:'system:test',action:'pause'});assert.equal((await f.api('state')).displayPlayback.paused,true);
  await f.api('playback',{...song(),trackId:'second',title:'Second'});assert.equal((await f.api('state')).manualAligned,false);
 }finally{await f.close();}
});
test('plain text is readable and never fabricated into a timestamped timeline',async()=>{
 const f=await fixture({lookupLyrics:async()=>[{...row,syncedLyrics:null,plainLyrics:'原创全文\n第二行'}]});
 try{await f.api('playback',{...song(),durationMs:120000,timelineAvailable:true});await wait(async()=>{const s=await f.api('state');return s.mode==='plain';});const s=await f.api('state');assert.equal(s.text,'原创全文\n第二行');assert.deepEqual(s.lines,[]);assert.equal((await f.api('manual/align',{trackId:'system:test',recordId:22,revision:s.lyrics.revision,index:0})).http,400);}finally{await f.close();}
});
test('backup requires opt-in, is labeled and manually confirmed; fallback errors remain explicit',async()=>{
 let calls=0;const candidate={id:'ovh:'+'a'.repeat(24),provider:'lyrics.ovh',trackName:'Original',artistName:'Tester',plainLyrics:'原创备用全文',manualOnly:true};
 const f=await fixture({lookupLyrics:async()=>[],lookupBackup:async()=>{calls++;return[candidate];}});
 try{
  await f.api('playback',song());await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='not-found';});assert.equal(calls,0);
  await f.api('settings',{backupEnabled:true});await f.api('playback',{...song(),trackId:'backup'});
  await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='choose';});assert.equal(calls,1);
  const s=await f.api('state');assert.equal(s.lyrics.candidates[0].provider,'lyrics.ovh');assert.equal(s.lyrics.candidates[0].kind,'plain');
  await f.api('lyrics/select',{trackId:'backup',id:candidate.id});assert.equal((await f.api('state')).mode,'plain');assert.equal((await f.api('state')).lyrics.source,'lyrics.ovh');
 }finally{await f.close();}
});
test('backup request uses encoded exact metadata, bounded failure and no arbitrary host',async()=>{
 const client=createOvhClient({fetchImpl:async url=>{const parsed=new URL(url);assert.equal(parsed.origin,'https://api.lyrics.ovh');assert.equal(parsed.pathname,'/v1/A%2FB/One%20%26%20Two');return Response.json({lyrics:'原创文本'});}});
 const records=await client({artist:'A/B',title:'One & Two'});assert.equal(records[0].provider,'lyrics.ovh');assert.equal(chooseAutomatic(rankCandidates(records,{artist:'A/B',title:'One & Two',durationMs:120000})),null);
 const failed=createOvhClient({fetchImpl:async()=>new Response('{}',{status:503})});await assert.rejects(()=>failed({artist:'A',title:'B'}),/503/);
 const limited=createOvhClient({fetchImpl:async()=>new Response('{}',{status:429,headers:{'Retry-After':new Date(Date.now()+120000).toUTCString()}})});await assert.rejects(()=>limited({artist:'A',title:'B'}),e=>e.retryAfterMs>110000&&e.retryAfterMs<=120000);
});
test('changed local lyrics reject stale line selection even when record ID is null',async()=>{
 const f=await fixture({autoLookup:false});
 try{
  await f.api('playback',song());await f.api('lrc',{trackId:'system:test',lrc:'[00:00]旧句\n[00:10]旧下一句'});
  const revision=(await f.api('state')).lyrics.revision;
  await f.api('lrc',{trackId:'system:test',lrc:'[00:00]新句\n[00:10]新下一句'});
  assert.equal((await f.api('manual/align',{trackId:'system:test',recordId:null,revision,index:1})).http,409);
  const s=await f.api('state');assert.equal((await f.api('manual/align',{trackId:'system:test',recordId:null,revision:s.lyrics.revision,index:1})).http,200);
 }finally{await f.close();}
});
test('enabled backup can recover primary service failure, and both failures stay visible',async()=>{
 let backupFails=false;const f=await fixture({lookupLyrics:async()=>{throw new Error('Primary unavailable');},lookupBackup:async()=>{if(backupFails)throw new Error('Backup unavailable');return[{id:'ovh:'+'b'.repeat(24),provider:'lyrics.ovh',trackName:'Original',artistName:'Tester',plainLyrics:'原创恢复文本',manualOnly:true}];}});
 try{
  await f.api('settings',{backupEnabled:true});await f.api('playback',song());
  await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='choose';});assert.match((await f.api('state')).lyrics.warning,/Primary/);
  backupFails=true;await f.api('playback',{...song(),trackId:'failure'});await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='error';});assert.match((await f.api('state')).lyrics.warning,/Backup/);
 }finally{await f.close();}
});
