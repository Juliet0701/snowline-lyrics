import test from 'node:test';
import assert from 'node:assert/strict';
import {ManualTimeline} from '../app/manual-timeline.mjs';
test('manual clock survives metadata heartbeats, follows known pause, and resets on source/song/timeline change',()=>{
 let now=1000;const clock=new ManualTimeline(()=>now);
 let p={trackId:'one',source:'qq',timelineAvailable:false,positionMs:0,receivedAt:now,durationMs:120000,paused:false,pauseKnown:true,rate:1};
 clock.align(p,10000);now+=1000;assert.equal(clock.position(p),11000);
 let next={...p,receivedAt:now};clock.sync(p,next);p=next;now+=2000;assert.equal(clock.position(p),13000);
 next={...p,receivedAt:now,paused:true};clock.sync(p,next);p=next;now+=1000;assert.equal(clock.position(p),13000);
 next={...p,receivedAt:now,paused:false};clock.sync(p,next);p=next;now+=500;assert.equal(clock.position(p),13500);
 clock.running(p,false);now+=500;assert.equal(clock.position(p),13500);clock.running(p,true);now+=500;assert.equal(clock.position(p),14000);
 now+=20000;assert.ok(clock.position(p)<=19000,'Missing heartbeats stop lyric extrapolation');
 clock.sync(p,{...p,trackId:'two'});assert.equal(clock.anchor,null);
 clock.align(p,100);clock.sync(p,{...p,source:'other'});assert.equal(clock.anchor,null);
 clock.align(p,100);clock.sync(p,{...p,timelineAvailable:true});assert.equal(clock.anchor,null);
});
test('unknown media pause state does not prevent manual lyric playback',()=>{
 let now=0;const clock=new ManualTimeline(()=>now),p={trackId:'one',source:'qq',timelineAvailable:false,receivedAt:0,durationMs:0,paused:true,pauseKnown:false,rate:1};
 clock.align(p,0);now=1000;assert.equal(clock.display(p).positionMs,1000);assert.equal(clock.display(p).paused,false);
});
