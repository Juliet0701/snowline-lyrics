import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBridge } from '../app/server.mjs';
import http from 'node:http';

test('authenticated integration: pair, song-bind LRC, pause, seek, switch, reject late sample and cross-site writes', async () => {
  const root=await mkdtemp(join(tmpdir(),'snowline-test-'));
  const b=await createBridge({root,port:0,persist:false,token:'a'.repeat(64),autoLookup:false});
  const call=(path,data,headers={})=>fetch(b.base+path,{method:data===undefined?'GET':'POST',headers:{'X-Lyrics-Token':b.token,'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});
  try {
    assert.equal((await fetch(b.base+'/api/state')).status,401);
    assert.equal((await fetch(b.base+'/api/bootstrap',{headers:{Origin:'chrome-extension://'+'a'.repeat(32)}})).status,403);
    assert.equal((await call('/api/offset',{offsetMs:500},{Origin:'https://evil.example'})).status,403);
    const p={source:'tab:1',trackId:'youtube:one',title:'第一首',artist:'作者',positionMs:5000,paused:false,capturedAt:Date.now()};
    assert.equal((await call('/api/playback',p)).status,200);
    assert.equal((await call('/api/lrc',{trackId:p.trackId,lrc:'[00:00.00]一\n[00:04.00]二'})).status,200);
    let state=await (await call('/api/state')).json(); assert.equal(state.lines.length,2);
    assert.equal((await call('/api/playback',{...p,positionMs:1000,paused:true,capturedAt:p.capturedAt+1})).status,200);
    state=await (await call('/api/state')).json(); assert.equal(state.playback.positionMs,1000); assert.equal(state.playback.paused,true);
    assert.equal((await call('/api/playback',{...p,capturedAt:p.capturedAt-1})).status,409);
    assert.equal((await call('/api/playback',{...p,trackId:'youtube:two',capturedAt:p.capturedAt+2})).status,200);
    state=await (await call('/api/state')).json(); assert.deepEqual(state.lines,[]);
    assert.equal((await call('/api/lrc',{trackId:'youtube:two',lrc:'没有时间戳'})).status,400);
    assert.equal((await call('/api/offset',{offsetMs:Infinity})).status,400);
    assert.equal((await call('/api/demo',{})).status,200);
    state=await (await call('/api/state')).json(); assert.equal(state.demo,true); assert.ok(state.lines.length);
    const hostStatus = await new Promise((resolve,reject) => {
      const req=http.get(b.base+'/health',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);
    });
    assert.equal(hostStatus,403);
  } finally {await b.close(); await rm(root,{recursive:true,force:true});}
});
