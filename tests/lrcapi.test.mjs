import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLrcApiClient} from '../app/lrcapi.mjs';
import {rankCandidates,chooseAutomatic} from '../app/lyrics.mjs';
import {createBridge} from '../app/server.mjs';
const lrc='[00:00]原创第二源第一句\n[00:10]原创第二源下一句';
const raw={id:'upstream-id',title:'Example',artist:'Tester',album:'Album',duration:120,lrc};
const sample=()=>({source:'test',trackId:'one',title:'Example',artist:'Tester',durationMs:120000,positionMs:0,paused:false,capturedAt:Date.now()});
test('second synced client uses one documented fixed-host request, keeps response metadata and ignores remote paths',async()=>{
 let calls=0;const client=createLrcApiClient({fetchImpl:async(url,options)=>{calls++;assert.equal(url.origin,'https://api.lrc.cx');assert.equal(url.pathname,'/jsonapi');assert.deepEqual([...url.searchParams.keys()],['title','artist']);assert.equal(url.searchParams.get('title'),'Query / &');assert.equal(options.redirect,'error');return Response.json([{...raw,lyric_path:'https://private.invalid/never-follow'},raw,{title:'Plain',lrc:'普通文本'}, {...raw,lrc:null}, {...raw,lyrics:lrc,lrc:undefined}]);}});
 const rows=await client({title:'Query / &',artist:'A/B'});assert.equal(calls,1);assert.equal(rows.length,1);assert.equal(rows[0].trackName,'Example');assert.equal(rows[0].artistName,'Tester');assert.equal(rows[0].provider,'lrcapi');assert.equal(rows[0].manualOnly,true);
 const ranked=rankCandidates(rows,sample());assert.equal(ranked[0].kind,'synced');assert.equal(chooseAutomatic(ranked),null);
});
test('second synced client handles documented older lyrics field, missing auth, throttling and invalid bodies explicitly',async()=>{
 const older=createLrcApiClient({fetchImpl:async()=>Response.json([{...raw,lrc:undefined,lyrics:lrc}])});assert.equal((await older(sample())).length,1);
 const missing=createLrcApiClient({fetchImpl:async()=>new Response('',{status:404})});assert.deepEqual(await missing(sample()),[]);
 for(const status of [403,429,503]){const failed=createLrcApiClient({fetchImpl:async()=>new Response('',{status,headers:{'Retry-After':'120'}})});await assert.rejects(()=>failed(sample()),e=>e.message.includes(String(status))&&e.retryAfterMs===120000);}
 const invalid=createLrcApiClient({fetchImpl:async()=>Response.json({error:'wrong shape'})});await assert.rejects(()=>invalid(sample()),/列表/);
});
async function setup(options){const root=await mkdtemp(join(tmpdir(),'snowline-second-'));const b=await createBridge({root,port:0,persist:false,token:'d'.repeat(64),...options});const api=async(path,data)=>{const r=await fetch(b.base+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':b.token},body:data===undefined?undefined:JSON.stringify(data)});return{http:r.status,...await r.json()};};return{api,close:async()=>{await b.close();await rm(root,{recursive:true,force:true});}};}
async function wait(fn){for(let i=0;i<80;i++){const x=await fn();if(x)return x;await new Promise(r=>setTimeout(r,10));}throw new Error('Timeout');}
const syncRow={id:'lrcapi:'+'a'.repeat(24),provider:'lrcapi',trackName:'Example',artistName:'Tester',albumName:'Album',duration:120,syncedLyrics:lrc,manualOnly:true};
test('opt-in synced fallback precedes ordinary fallback and confirms a source before automatic playback',async()=>{
 let syncCalls=0,plainCalls=0;const f=await setup({lookupLyrics:async()=>[],lookupSyncBackup:async()=>{syncCalls++;return[syncRow];},lookupBackup:async()=>{plainCalls++;return[];}});
 try{
  await f.api('playback',sample());await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='not-found';});assert.equal(syncCalls,0);
  await f.api('settings',{backupEnabled:true});await f.api('settings',{syncBackupEnabled:true});assert.equal((await f.api('state')).settings.backupEnabled,true);
  await f.api('playback',{...sample(),trackId:'second'});await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='choose';});assert.equal(syncCalls,1);assert.equal(plainCalls,0);
  assert.equal((await f.api('state')).lyrics.candidates[0].provider,'lrcapi');
  await f.api('lyrics/select',{trackId:'second',id:syncRow.id});const s=await f.api('state');assert.equal(s.mode,'automatic');assert.equal(s.lyrics.source,'lrcapi');assert.equal(s.lines.length,2);
 }finally{await f.close();}
});
test('LRCLIB plain text does not suppress the second timestamped source; a strong primary synced match skips it',async()=>{
 let isSynced=false,calls=0;const f=await setup({lookupLyrics:async()=>[{id:1,trackName:'Example',artistName:'Tester',duration:120,plainLyrics:'原创普通全文',syncedLyrics:isSynced?lrc:null}],lookupSyncBackup:async()=>{calls++;return[syncRow];}});
 try{
  await f.api('settings',{syncBackupEnabled:true});await f.api('playback',sample());await wait(async()=>{const s=await f.api('state');return s.lyrics.status==='choose';});assert.equal(calls,1);
  const c=(await f.api('state')).lyrics.candidates;assert.ok(c.some(x=>x.provider==='lrcapi'&&x.kind==='synced'));assert.ok(c.some(x=>x.provider==='lrclib'&&x.kind==='plain'));
  isSynced=true;await f.api('playback',{...sample(),trackId:'strong'});await wait(async()=>{const s=await f.api('state');return s.mode==='automatic';});assert.equal(calls,1);assert.equal((await f.api('state')).lyrics.source,'lrclib');
 }finally{await f.close();}
});
test('failed secondary lookup keeps usable primary plain lyrics and reports the problem',async()=>{
 const f=await setup({lookupLyrics:async()=>[{id:1,trackName:'Example',artistName:'Tester',duration:120,plainLyrics:'原创可用全文'}],lookupSyncBackup:async()=>{throw new Error('LrcApi HTTP 503');}});
 try{await f.api('settings',{syncBackupEnabled:true});await f.api('playback',sample());await wait(async()=>{const s=await f.api('state');return s.mode==='plain';});const s=await f.api('state');assert.equal(s.text,'原创可用全文');assert.match(s.lyrics.warning,/503/);}finally{await f.close();}
});
