import {positionAt,locateLyric} from '/core.mjs';
const $=id=>document.getElementById(id);
let state,boot,busy=false,disconnected=false,querying=false,notice='',noticeUntil=0,textKey='',watchedQuery=null;
const time=ms=>{const n=Math.floor(ms/1000);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
async function poll(){if(busy)return;busy=true;try{
 boot||=await(await fetch('/api/bootstrap')).json();
 const r=await fetch('/api/state',{headers:{'X-Lyrics-Token':boot.token},signal:AbortSignal.timeout(2200)});if(!r.ok)throw new Error('Service unavailable');
 state=await r.json();disconnected=false;
 if(watchedQuery&&state.playback?.trackId!==watchedQuery)watchedQuery=null;
 if(watchedQuery&&state.lyrics?.status!=='searching'){notice=state.lyrics.warning||state.lyrics.message;noticeUntil=Date.now()+6500;watchedQuery=null;}
}catch{disconnected=true;}finally{busy=false;}}
function paint(){
 const p=state?.playback,display=state?.displayPlayback,lines=state?.lines||[],pos=positionAt(display),lyric=locateLyric(lines,pos,state?.offsetMs||0),mode=state?.mode;
 $('track').textContent=p?[p.title,p.artist].filter(Boolean).join(' · '):'SNOWLINE LYRICS';
 const plain=mode==='plain';$('full-text').hidden=!plain;$('current').hidden=plain;$('next').hidden=plain;
 const key=JSON.stringify([p?.trackId,state?.text]);if(key!==textKey){textKey=key;$('full-text').textContent=state?.text||'';$('full-text').scrollTop=0;}
 $('current').textContent=mode==='align-required'?'请选择当前唱到的歌词':lyric.current||(lines.length?'♪':!p?'等待音乐响起':state.lyrics?.status==='searching'?'正在查找歌词…':'♫');
 $('next').textContent=mode==='align-required'?'打开设置，点选歌词后开始手动对齐':lyric.next||(!lines.length?(state?.lyrics?.status==='choose'?'打开设置，确认歌曲版本':state?.lyrics?.message||'播放一首歌，让歌词陪着你。'):'');
 const source=state?.lyrics?.source==='lyrics.ovh'?' · lyrics.ovh':state?.lyrics?.source==='lrclib'?' · LRCLIB':state?.lyrics?.source==='lrcapi'?' · LrcApi':'';
 $('status').textContent=Date.now()<noticeUntil?notice:disconnected?'连接已断开，正在重试':state?.stale?'等待播放器':mode==='plain'?'全文阅读 · 滚动查看'+source:mode==='manual'?`手动对齐 · ${display?.paused?'已暂停':'计时中'} · 可重新选句`:mode==='align-required'?'无系统进度 · 等待手动对齐':p?.timelineAvailable===false?'已读取歌曲 · 等待歌词':p?.paused?'已暂停':p?'自动同步 · 拖动顶部可移动'+source:'拖动顶部可移动 · 设置中可选择播放器';
 $('clock').textContent=plain?'全文':mode==='align-required'?'待对齐':time(pos);
 $('progress').max=display?.durationMs||Math.max(pos,1);$('progress').value=display?pos:0;
 const loading=querying||state?.lyrics?.status==='searching';$('reload').disabled=!p||loading||!!state?.demo;$('reload').classList.toggle('loading',loading);$('reload').setAttribute('aria-busy',String(loading));
}
async function action(name){try{const s=await window.boardHost?.action(name);if(s)$('pin').setAttribute('aria-pressed',String(s.pinned));}catch{notice='窗口控制暂时不可用';noticeUntil=Date.now()+5000;}}
for(const name of ['pin','settings','hide'])$(name).onclick=()=>void action(name);
$('reload').onclick=async()=>{
 if(querying||!state?.playback)return;querying=true;paint();
 try{const trackId=state.playback.trackId;const r=await fetch('/api/lyrics/search',{method:'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':boot.token},body:JSON.stringify({trackId})});const result=await r.json();if(!r.ok)throw new Error(result.error);watchedQuery=trackId;notice='已开始重新查找歌词';}
 catch(e){notice=e.message;}finally{noticeUntil=Date.now()+5000;querying=false;await poll();paint();}
};
void action('state');await poll();paint();setInterval(poll,500);setInterval(paint,100);
