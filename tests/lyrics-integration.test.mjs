import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {join} from 'node:path';
import {createBridge} from '../app/server.mjs';

const row={id:1,trackName:'Original Test',artistName:'Tester',albumName:'Album',duration:120,syncedLyrics:'[00:00.00]原创测试\n[00:04.00]第二句'};
const sample=(trackId='youtube:one',extra={})=>({trackId,source:'tab',title:'Original Test',artist:'Tester',durationMs:120000,positionMs:1000,paused:false,capturedAt:Date.now(),...extra});
async function fixture(lookupLyrics,persist=false){
  const root=await mkdtemp(join(tmpdir(),'snowline-lookup-'));
  const b=await createBridge({root,port:0,persist,token:'d'.repeat(64),lookupLyrics});
  const api=async(path,data)=>{const r=await fetch(b.base+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':b.token},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,...await r.json()};};
  return {root,b,api,close:async()=>{await b.close();await rm(root,{recursive:true,force:true});}};
}
async function waitFor(fn){for(let i=0;i<60;i++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for lyrics');}

test('automatic lookup is nonblocking, deduplicates heartbeats and keeps a persistent per-video cache',async()=>{
  let count=0;const f=await fixture(async()=>{count++;return [row];},true);
  try{
    await f.api('playback',sample());
    const state=await waitFor(async()=>{const s=await f.api('state');return s.lines.length?s:null;});
    assert.equal(state.lyrics.source,'lrclib');assert.equal(state.lyrics.recordId,1);
    for(let i=0;i<3;i++)await f.api('playback',sample());assert.equal(count,1);
    await f.b.close();
    const again=await createBridge({root:f.root,port:0,persist:true,token:'e'.repeat(64),lookupLyrics:async()=>{throw new Error('Cache should avoid lookup');}});
    try{
      await fetch(again.base+'/api/playback',{method:'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':again.token},body:JSON.stringify(sample())});
      const state=await (await fetch(again.base+'/api/state',{headers:{'X-Lyrics-Token':again.token}})).json();assert.equal(state.lines.length,2);
    }finally{await again.close();}
  }finally{await f.close();}
});
test('late song response never shows under a different video, and manual imports win a race',async()=>{
  const pending=new Map();const f=await fixture(p=>new Promise(resolve=>pending.set(p.trackId,resolve)));
  try{
    await f.api('playback',sample('youtube:one'));
    await f.api('playback',sample('youtube:two',{capturedAt:Date.now()+1}));
    pending.get('youtube:one')([row]);
    assert.equal((await f.api('state')).lines.length,0);
    await f.api('lrc',{trackId:'youtube:two',lrc:'[00:00.00]手动\n[00:02.00]优先'});
    pending.get('youtube:two')([row]);
    await new Promise(r=>setTimeout(r,25));
    const s=await f.api('state');assert.equal(s.lines[0].text,'手动');assert.equal(s.lyrics.source,'local');
  }finally{for(const resolve of pending.values())resolve([]);await f.close();}
});
test('ambiguous versions require selection; stale selection rejects and cache avoids network errors',async()=>{
  const f=await fixture(async()=>[row,{...row,id:2,syncedLyrics:'[00:01.00]另一个版本\n[00:05.00]测试'}]);
  try{
    await f.api('playback',sample());
    const state=await waitFor(async()=>{const s=await f.api('state');return s.lyrics.status==='choose'?s:null;});
    assert.equal(state.lines.length,0);assert.equal(state.lyrics.candidates.length,2);
    assert.equal((await f.api('lyrics/select',{trackId:'wrong',id:2})).status,409);
    assert.equal((await f.api('lyrics/select',{trackId:'youtube:one',id:999})).status,400);
    assert.equal((await f.api('lyrics/select',{trackId:'youtube:one',id:2})).status,200);
    assert.equal((await f.api('state')).lyrics.recordId,2);
  }finally{await f.close();}
});
test('service failure is explicit and not retried on every heartbeat; retry endpoint can recover',async()=>{
  let calls=0,fail=true;const f=await fixture(async()=>{calls++;if(fail)throw new Error('LRCLIB 服务暂时不可用（HTTP 503）');return [row];});
  try{
    await f.api('playback',sample());
    await waitFor(async()=>{const s=await f.api('state');return s.lyrics.status==='error';});
    for(let i=0;i<4;i++)await f.api('playback',sample());assert.equal(calls,1);
    fail=false;await f.api('lyrics/search',{trackId:'youtube:one'});
    await waitFor(async()=>{const s=await f.api('state');return s.lines.length>0;});assert.equal(calls,2);
  }finally{await f.close();}
});
