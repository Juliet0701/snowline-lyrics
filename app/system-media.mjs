import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

export function chooseSession(sessions,preferred='auto') {
  const available=sessions.filter(s=>s && s.playbackStatus!=='Closed'&&typeof s.id==='string' && typeof s.title==='string' && s.title.trim());
  if(preferred!=='auto')return available.find(s=>s.id===preferred)||null;
  return available.find(s=>!s.paused && s.artist) || available.find(s=>!s.paused && s.timelineValid)||available.find(s=>!s.paused)
    ||available.find(s=>s.isCurrent && s.timelineValid && s.artist)||available.find(s=>s.timelineValid && s.artist)
    ||available.find(s=>s.isCurrent)||available[0]||null;
}
export function mediaSample(session,now=Date.now()) {
  let title=String(session.title||'').trim(),artist=String(session.artist||'').trim();
  // Chromium sometimes appends an exact repeat of the artist to its media title.
  for(const [open,close] of [['(',')'],['（','）']]){
    const suffix=`${open}${artist}${close}`;
    if(artist && title.endsWith(suffix))title=title.slice(0,-suffix.length).trim();
  }
  const signature=JSON.stringify([title.toLowerCase(),artist.toLowerCase(),Math.round(session.durationMs/1000)]);
  return {source:`system:${session.id}`.slice(0,160),trackId:`system:${createHash('sha256').update(signature).digest('hex').slice(0,32)}`,
    title,artist,durationMs:Number.isFinite(session.durationMs)?session.durationMs:0,positionMs:session.timelineValid?session.positionMs:0,
    timelineAvailable:!!session.timelineValid,pauseKnown:session.pauseKnown===true||['Playing','Paused','Stopped'].includes(session.playbackStatus)||(!session.playbackStatus&&session.pauseKnown!==false),
    paused:!!session.paused,rate:session.rate>0?session.rate:1,seeking:false,ad:false,capturedAt:now};
}
function label(appId){
  if(/spotify/i.test(appId))return 'Spotify';
  if(/cloudmusic/i.test(appId))return '网易云音乐';
  if(/qqmusic/i.test(appId))return 'QQ 音乐';
  if(/chrome\._crx_/i.test(appId))return 'Chrome 网页应用';
  if(/chrome/i.test(appId))return 'Chrome';
  if(/msedge/i.test(appId))return 'Microsoft Edge';
  return appId;
}
export function createSystemAdapter({onPlayback,onClear,executable,preferred='auto',spawnImpl=spawn}) {
  let child,closing=false,lastFrameAt=0;
  const state={status:'starting',message:'正在连接 Windows 播放器…',sessions:[],selectedId:null,preferred};
  function apply(frame){
    lastFrameAt=Date.now();
    state.sessions=(Array.isArray(frame.sessions)?frame.sessions:[]).map(s=>({...s,label:label(String(s.appId||''))}));
    const current=chooseSession(state.sessions,state.preferred);state.selectedId=current?.id||null;
    if(frame.status==='error'){state.status='error';state.message=frame.message||'Windows 媒体读取失败';onClear();return;}
    if(!current){state.status='empty';state.message=state.preferred==='auto'?'打开任意播放器并播放音乐，即可自动连接。':'所选播放器已关闭，可切回自动选择。';onClear();return;}
    state.status=current.timelineValid?'ready':'metadata-only';state.message=!current.timelineValid?'已读取歌曲；播放器未提供进度，可在设置中点选歌词手动对齐。':current.artist?'已连接系统媒体会话':'播放器未提供歌手信息，歌词可能需要手动确认版本。';
    onPlayback(mediaSample(current));
  }
  try{
    child=spawnImpl(executable,['--parent',String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    const lines=createInterface({input:child.stdout});
    lines.on('line',line=>{if(line.length>512*1024)return;try{apply(JSON.parse(line));}catch(e){state.status='error';state.message='媒体信息格式错误：'+e.message;onClear();}});
    child.stderr.on('data',()=>{});
    child.on('error',e=>{state.status='error';state.message='系统媒体组件启动失败：'+e.message;onClear();});
    child.on('exit',()=>{if(!closing){state.status='error';state.message='系统媒体读取已停止，请重新打开应用。';onClear();}});
  }catch(e){state.status='error';state.message=e.message;}
  const timer=setInterval(()=>{if(lastFrameAt && Date.now()-lastFrameAt>6500){state.status='error';state.message='系统媒体读取超时，等待恢复。';onClear();}},2000);timer.unref();
  return {getState:()=>structuredClone(state),select:id=>{if(id!=='auto'&&!state.sessions.some(s=>s.id===id))throw new Error('播放器已关闭，请重新选择');state.preferred=id;apply({status:'ready',sessions:state.sessions});},close:()=>{closing=true;clearInterval(timer);child?.kill();}};
}
