import {createBridge} from '../app/server.mjs';
import {createSystemAdapter} from '../app/system-media.mjs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {positionAt} from '../app/core.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot=process.env.SNOWLINE_LYRICS_DATA;
if(!dataRoot)throw new Error('Missing application data directory');
let adapter,closing=false;
const fixture=process.env.SNOWLINE_LYRICS_TEST_FIXTURE==='1'&&!!process.env.SNOWLINE_LYRICS_TEST_DATA;
const fixtureLookup=async p=>{await new Promise(r=>setTimeout(r,220));return [{id:902,trackName:p.title,artistName:p.artist,duration:120,syncedLyrics:p.title.includes('普通')?null:'[00:00]原创第一句\n[00:10]原创第二句\n[00:20]原创第三句',plainLyrics:'原创普通歌词\n'+Array.from({length:35},(_,i)=>`这是原创阅读演示的第 ${i+1} 行`).join('\n')}];};
const bridge=await createBridge({root,port:0,dataRoot,...(fixture?{lookupLyrics:fixtureLookup,lookupBackup:async()=>[],lookupSyncBackup:async p=>[{id:'lrcapi:'+'c'.repeat(24),provider:'lrcapi',trackName:p.title,artistName:p.artist,albumName:'原创第二源测试',duration:120,syncedLyrics:'[00:00]原创第二源第一句\n[00:10]原创第二源下一句',manualOnly:true}]}:{}),getMediaState:()=>adapter?.getState(),selectMediaSource:id=>adapter.select(id)});
adapter=fixture?{getState:()=>({status:'ready',message:'原创演示测试',preferred:'auto',sessions:[]}),select:()=>{},close:()=>{}}:createSystemAdapter({executable:join(root,'native/bin/Snowline.MediaReader.exe'),onPlayback:p=>bridge.ingestPlayback(p),onClear:()=>bridge.clearPlayback()});
// Test-only liveness samples mirror the native reader without inventing progress.
const fixtureHeartbeat=fixture?setInterval(()=>{const p=bridge.state.playback;if(p&&!bridge.state.demo)bridge.ingestPlayback({...p,positionMs:p.timelineAvailable?positionAt(p):0,capturedAt:Date.now()});},750):null;
fixtureHeartbeat?.unref();
process.send?.({type:'ready',base:bridge.base});
async function stop(){if(closing)return;closing=true;clearInterval(fixtureHeartbeat);adapter.close();await bridge.close();process.exit(0);}
process.on('message',m=>{if(m==='shutdown')void stop();});
process.on('disconnect',()=>void stop());process.on('SIGTERM',()=>void stop());
