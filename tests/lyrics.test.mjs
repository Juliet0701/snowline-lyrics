import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle,rankCandidates,chooseAutomatic,createLrclibClient } from '../app/lyrics.mjs';
const playback={title:'Example Song (Official Audio)',artist:'Aimer',durationMs:303000};
const row={id:1,trackName:'Example Song',artistName:'Aimer',albumName:'Album',duration:303,syncedLyrics:'[00:00.00]原创测试\n[00:04.00]下一句'};
test('matching strips technical labels, requires artist/duration agreement, preserves live variants',()=>{
  assert.equal(cleanTitle(playback.title),'Example Song');
  const candidates=rankCandidates([row,{...row,id:2,artistName:'Someone Else'},{...row,id:3,duration:340},{...row,id:4,trackName:'Example Song (Live)'}],playback);
  assert.equal(candidates[0].id,1);assert.equal(chooseAutomatic(candidates).id,1);
  assert.ok(candidates.slice(1).every(c=>!c.safe));
  assert.equal(chooseAutomatic(rankCandidates([row],{...playback,durationMs:0})),null);
});
test('plain lyrics cannot masquerade as synced; conflicting same-recording timelines need selection',()=>{
  const plain=rankCandidates([{...row,syncedLyrics:null,plainLyrics:'只有文字'}],playback);assert.equal(plain[0].kind,'plain');assert.deepEqual(plain[0].lines,[]);assert.equal(plain[0].text,'只有文字');
  assert.equal(rankCandidates([{...row,syncedLyrics:'[00:00.00]全部歌词'}],playback).length,0);
  assert.equal(chooseAutomatic(rankCandidates([row,{...row,id:2,syncedLyrics:'[00:01.00]版本二\n[00:05.00]下一句'}],playback)),null);
  assert.equal(chooseAutomatic(rankCandidates([row,{...row,id:2,albumName:'Greatest Hits'}],playback)).id,1);
});
test('LRCLIB overload retries are bounded; service errors stay distinct from empty results',async()=>{
  let requests=0;
  const client=createLrclibClient({sleep:async()=>{},fetchImpl:async url=>{
    requests++;assert.equal(url.origin,'https://lrclib.net');
    return new Response('{}',{status:503});
  }});
  await assert.rejects(()=>client(playback),/503/);assert.equal(requests,3);
});
test('provider retry success and fallback query preserve synced candidates',async()=>{
  let requests=0;
  const client=createLrclibClient({sleep:async()=>{},fetchImpl:async url=>{
    requests++;
    if(requests===1)return new Response('{}',{status:429,headers:{'retry-after':'1'}});
    if(url.pathname.endsWith('/get')||url.searchParams.has('track_name'))return Response.json([]);
    return Response.json([row]);
  }});
  assert.equal((await client(playback))[0].id,1);assert.equal(requests,4);
});
test('Retry-After is honored by deferring rather than hammering a rate-limited service',async()=>{
  let count=0;
  const client=createLrclibClient({sleep:async()=>{},fetchImpl:async()=>{count++;return new Response('{}',{status:429,headers:{'retry-after':'120'}});}});
  await assert.rejects(()=>client(playback),e=>e.retryAfterMs===120000);assert.equal(count,1);
});
