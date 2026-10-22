import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=dirname(dirname(fileURLToPath(import.meta.url))),require=createRequire(import.meta.url);
const packaged=process.argv[2]?resolve(process.argv[2]):null;
const exe=packaged||process.env.SNOWLINE_ELECTRON||require('electron');
const results=join(root,'test-results');await mkdir(results,{recursive:true});await mkdir(join(root,'.local'),{recursive:true});
const data=await mkdtemp(join(root,'.local','board-test-'));
const port=Number(process.env.SNOWLINE_TEST_PORT||18748);
const env={...process.env,SNOWLINE_LYRICS_TEST_DATA:data,SNOWLINE_LYRICS_TEST_DEBUG_PORT:String(port),SNOWLINE_LYRICS_TEST_QUIT_MS:'22000',SNOWLINE_LYRICS_TEST_FIXTURE:'1'};
delete env.ELECTRON_RUN_AS_NODE;if(packaged)env.PATH=join(process.env.WINDIR,'System32');
const child=spawn(exe,packaged?[]:[root],{cwd:packaged?dirname(packaged):root,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
let log='',browser;child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
child.on('error',e=>{log+=e.stack;});const exit=new Promise(resolve=>child.once('exit',resolve));
async function retry(fn){let e;for(let n=0;n<40;n++){try{return await fn();}catch(error){e=error;await new Promise(r=>setTimeout(r,350));}}throw e;}
try{
 browser=await retry(()=>chromium.connectOverCDP(`http://127.0.0.1:${port}`));
 const board=await retry(async()=>{const p=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().endsWith('/board'));if(!p)throw new Error('No board');return p;});
 const settings=await retry(async()=>{const p=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().endsWith('/settings'));if(!p)throw new Error('No settings');return p;});
 const errors=[];for(const p of [board,settings])p.on('pageerror',e=>errors.push(e.message));
 await board.evaluate(async()=>{const b=await(await fetch('/api/bootstrap')).json();const r=await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':b.token},body:JSON.stringify({positionMs:4000,paused:true})});if(!r.ok)throw new Error('Demo failed');});
 await board.waitForFunction(()=>document.querySelector('#current')?.textContent==='让每一句祝福，跟着音乐靠近');
 await board.waitForFunction(()=>document.querySelector('#status')?.textContent==='已暂停');
 assert.equal(await board.evaluate(()=>typeof window.require),'undefined');
 await board.locator('#pin').click();assert.equal(await board.locator('#pin').getAttribute('aria-pressed'),'false');
 await board.locator('#pin').click();assert.equal(await board.locator('#pin').getAttribute('aria-pressed'),'true');
 await board.locator('#settings').click();await settings.bringToFront();
 await settings.waitForFunction(()=>document.querySelector('#current')?.textContent==='让每一句祝福，跟着音乐靠近');
 await settings.locator('#lrc-file').setInputFiles({name:'original-test.lrc',mimeType:'text/plain',buffer:Buffer.from('[00:00.00]让音乐，留在眼前。\n[00:08.00]下一句，是你喜欢的风景。')});
 await board.waitForFunction(()=>document.querySelector('#current')?.textContent==='让音乐，留在眼前。');
 await settings.locator('#offset').fill('1000');await settings.locator('#offset').dispatchEvent('change');
 await board.evaluate(async()=>{const b=await(await fetch('/api/bootstrap')).json();await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':b.token},body:JSON.stringify({positionMs:12000,paused:true})});});
 await board.waitForFunction(()=>document.querySelector('#current')?.textContent==='拖动进度，去下一段风景');
 await board.evaluate(async()=>{const b=await(await fetch('/api/bootstrap')).json();await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':b.token},body:JSON.stringify({positionMs:4000,paused:true})});});
 await board.waitForFunction(()=>document.querySelector('#current')?.textContent==='让每一句祝福，跟着音乐靠近');
 await board.screenshot({path:join(results,packaged?'portable-board.png':'board.png'),omitBackground:true});
 await settings.screenshot({path:join(results,packaged?'portable-settings.png':'settings.png')});
 const metrics=await board.evaluate(()=>{const s=document.querySelector('section');return{height:innerHeight,sectionHeight:s.clientHeight,scrollHeight:s.scrollHeight};});assert.ok(metrics.sectionHeight>30);assert.deepEqual(errors,[]);
 console.log('Desktop passed: standalone board, settings, pause/seek, pin IPC, local LRC import, timing offset, sandbox, original-text screenshots.');
 assert.equal(await exit,0);console.log('Clean normal shutdown.');
}finally{
 if(child.exitCode===null){await Promise.race([exit,new Promise(r=>setTimeout(r,26000))]);if(child.exitCode===null)child.kill();}
 await browser?.close().catch(()=>{});await writeFile(join(results,packaged?'portable-log.txt':'desktop-log.txt'),log);
}
