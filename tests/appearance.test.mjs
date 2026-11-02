import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBridge} from '../app/server.mjs';
import {defaultAppearance,validateAppearance} from '../app/appearance.mjs';

test('appearance validation rejects CSS injection, remote URLs and invalid opacity',()=>{
  for(const patch of [{overlayColor:'red'},{overlayOpacity:-1},{overlayOpacity:1.01},{textShadow:'true'},{backgroundColor:'red;display:none'},{lyricsColor:'url(x)'},{opacity:-1},{opacity:2},{opacity:NaN},{image:'https://example.com/x.jpg'},{image:'data:image/svg+xml;base64,AAAA'},{image:'data:image/png;base64,AAAA'}])assert.throws(()=>validateAppearance({...defaultAppearance,...patch}));
  assert.equal(validateAppearance({...defaultAppearance,opacity:0}).opacity,0);
});

test('appearance persists independently, serves local image without bloating playback state, and resets',async()=>{
  const root=await mkdtemp(join(tmpdir(),'snowline-appearance-'));
  let bridge=await createBridge({root,port:0,autoLookup:false});
  const call=(path,data)=>fetch(bridge.base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':bridge.token},body:data===undefined?undefined:JSON.stringify(data)});
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=';
  try{
    assert.equal((await fetch(bridge.base+'/api/appearance',{method:'POST',body:'{}'})).status,401);
    assert.equal((await call('/api/appearance',{backgroundColor:'#abcdef',lyricsColor:'#ffffff',opacity:0,image,overlayColor:'white',overlayOpacity:.35,textShadow:true})).status,200);
    let state=await(await call('/api/state')).json();assert.equal(state.appearance.opacity,0);assert.equal(state.appearance.image,undefined);assert.ok(state.appearance.imageVersion);
    let response=await fetch(bridge.base+'/background');assert.equal(response.headers.get('content-type'),'image/png');assert.ok((await response.arrayBuffer()).byteLength>8);
    await bridge.close();bridge=await createBridge({root,port:0,autoLookup:false});
    state=await(await call('/api/state')).json();assert.equal(state.appearance.backgroundColor,'#abcdef');assert.equal(state.appearance.overlayColor,'white');assert.equal(state.appearance.overlayOpacity,.35);assert.equal(state.appearance.textShadow,true);assert.ok(state.appearance.imageVersion);
    assert.equal((await call('/api/settings',{backupEnabled:true})).status,200);
    assert.equal((await call('/api/appearance',{opacity:5})).status,400);
    assert.equal((await call('/api/appearance',defaultAppearance)).status,200);
    assert.equal((await fetch(bridge.base+'/background')).status,204);
    state=await(await call('/api/state')).json();assert.equal(state.settings.backupEnabled,true);
  }finally{await bridge.close();await rm(root,{recursive:true,force:true});}
});
