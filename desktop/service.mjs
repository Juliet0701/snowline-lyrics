import {createBridge} from '../app/server.mjs';
import {createSystemAdapter} from '../app/system-media.mjs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot=process.env.SNOWLINE_LYRICS_DATA;
if(!dataRoot)throw new Error('Missing application data directory');
let adapter,closing=false;
const fixture=process.env.SNOWLINE_LYRICS_TEST_FIXTURE==='1'&&!!process.env.SNOWLINE_LYRICS_TEST_DATA;
const bridge=await createBridge({root,port:0,dataRoot,autoLookup:!fixture,getMediaState:()=>adapter?.getState(),selectMediaSource:id=>adapter.select(id)});
adapter=fixture?{getState:()=>({status:'ready',message:'原创演示测试',preferred:'auto',sessions:[]}),select:()=>{},close:()=>{}}:createSystemAdapter({executable:join(root,'native/bin/Snowline.MediaReader.exe'),onPlayback:p=>bridge.ingestPlayback(p),onClear:()=>bridge.clearPlayback()});
process.send?.({type:'ready',base:bridge.base});
async function stop(){if(closing)return;closing=true;adapter.close();await bridge.close();process.exit(0);}
process.on('message',m=>{if(m==='shutdown')void stop();});
process.on('disconnect',()=>void stop());process.on('SIGTERM',()=>void stop());
