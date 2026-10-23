import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {chooseSession,mediaSample,createSystemAdapter} from '../app/system-media.mjs';

const song={id:'player#0',appId:'Chrome._crx_music',title:'Song (Artist)',artist:'Artist',durationMs:240000,positionMs:30000,paused:false,rate:1,timelineValid:true};
test('system session selection favors playing music and honors explicit selection',()=>{
 const paused={...song,id:'other',title:'Background video',artist:'',paused:true,isCurrent:true};
 assert.equal(chooseSession([paused,song]).id,song.id);
 assert.equal(chooseSession([paused,song],'other').id,'other');
 assert.equal(chooseSession([song],'gone'),null);
 assert.equal(chooseSession([]),null);
 assert.equal(chooseSession([{...song,playbackStatus:'Closed'}]),null);
 assert.equal(mediaSample({...song,paused:true,playbackStatus:'Stopped',pauseKnown:false}).pauseKnown,true);
});
test('same song keeps its lyric binding across applications, progress and pause',()=>{
 const one=mediaSample(song),two=mediaSample({...song,id:'spotify#0',positionMs:70000,paused:true});
 assert.equal(one.title,'Song');assert.equal(one.artist,'Artist');assert.equal(one.trackId,two.trackId);
 assert.notEqual(one.source,two.source);assert.equal(two.paused,true);
 assert.notEqual(one.trackId,mediaSample({...song,durationMs:260000}).trackId);
 assert.equal(mediaSample({...song,title:'Song (Live)'}).title,'Song (Live)');
});
test('native adapter forwards pause and seek and clears unavailable playback',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();let killed=false;child.kill=()=>{killed=true;};
 const samples=[];let clears=0;
 const adapter=createSystemAdapter({executable:'test',spawnImpl:()=>child,onPlayback:p=>samples.push(p),onClear:()=>clears++});
 const frame=sessions=>child.stdout.write(JSON.stringify({status:'ready',sessions})+'\n');
 try{
  frame([song]);assert.equal(samples.at(-1).positionMs,30000);
  frame([{...song,positionMs:5000,paused:true}]);assert.equal(samples.at(-1).positionMs,5000);assert.equal(samples.at(-1).paused,true);
  frame([{...song,timelineValid:false}]);assert.equal(adapter.getState().status,'metadata-only');assert.equal(clears,0);assert.equal(samples.at(-1).timelineAvailable,false);assert.equal(samples.at(-1).title,'Song');
  frame([]);assert.equal(adapter.getState().status,'empty');assert.equal(clears,1);
  assert.throws(()=>adapter.select('gone'));
 }finally{adapter.close();child.stdout.end();child.stderr.end();}
 assert.equal(killed,true);
});
