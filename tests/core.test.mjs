import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, positionAt, locateLyric, normalizePlayback } from '../app/core.mjs';

test('LRC handles BOM, metadata, repeated timestamps, fractions, translation and blank instrumental cues', () => {
  const lines = parseLrc('\uFEFF[ar:作者]\n[offset:+100]\n[00:02.50][00:04.500]原文\n[00:02.500]翻译\n[00:03.00]\n[00:01.1]开始');
  assert.deepEqual(lines, [{ timeMs: 1000, text:'开始' },{timeMs:2400,text:'原文\n翻译'},{timeMs:2900,text:''},{timeMs:4400,text:'原文'}]);
});
test('timeline handles pre-roll, exact boundaries, backward seeking, offset and empty instrumental line', () => {
  const lines = parseLrc('[00:01.00]一\n[00:03.00]二\n[00:04.00]');
  assert.equal(locateLyric(lines,0).current,'');
  assert.equal(locateLyric(lines,3000).current,'二');
  assert.equal(locateLyric(lines,1500).current,'一');
  assert.equal(locateLyric(lines,2500,500).current,'二');
  assert.equal(locateLyric(lines,4000).current,'');
});
test('pause/seek freeze, rate interpolates, duration clamps, lost heartbeat stops extrapolation', () => {
  const p = {positionMs:2000,receivedAt:1000,rate:2,durationMs:20000,paused:false};
  assert.equal(positionAt(p,2000),4000);
  assert.equal(positionAt({...p,paused:true},2000),2000);
  assert.equal(positionAt({...p,seeking:true},2000),2000);
  assert.equal(positionAt(p,20000),14000);
  assert.equal(positionAt({...p,durationMs:3000},2000),3000);
});
test('samples require valid identifiers, bounded rate, fresh time and boolean paused', () => {
  const p = {source:'test',trackId:'youtube:abc',positionMs:2,paused:false,capturedAt:1000};
  assert.equal(normalizePlayback(p,1000).receivedAt,1000);
  assert.throws(()=>normalizePlayback({...p,positionMs:-1},1000));
  assert.throws(()=>normalizePlayback({...p,rate:Infinity},1000));
  assert.throws(()=>normalizePlayback(p,12000));
  assert.throws(()=>normalizePlayback({...p,paused:'false'},1000));
});
