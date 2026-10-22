import {positionAt,locateLyric} from '/core.mjs';
const $=id=>document.getElementById(id);
let state,boot,busy=false,disconnected=false;
const time=ms=>{const n=Math.floor(ms/1000);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
async function poll(){if(busy)return;busy=true;try{
 boot||=await(await fetch('/api/bootstrap')).json();
 const r=await fetch('/api/state',{headers:{'X-Lyrics-Token':boot.token},signal:AbortSignal.timeout(2200)});if(!r.ok)throw new Error('Service unavailable');
 state=await r.json();disconnected=false;
}catch{disconnected=true;}finally{busy=false;}}
function paint(){
 const p=state?.playback,lines=state?.lines||[],pos=positionAt(p),lyric=locateLyric(lines,pos,state?.offsetMs||0);
 const stale=disconnected||state?.stale;
 $('track').textContent=p?[p.title,p.artist].filter(Boolean).join(' · '):'SNOWLINE LYRICS';
 $('current').textContent=lyric.current||(lines.length?'♪':!p?'等待音乐响起':state.lyrics?.status==='searching'?'正在查找同步歌词…':'♫');
 $('next').textContent=lyric.next||(!lines.length?(state?.lyrics?.status==='choose'?'打开设置，确认歌曲版本':state?.lyrics?.message||'播放一首歌，让歌词陪着你。'):'');
 $('status').textContent=disconnected?'连接已断开，正在重试':state?.media?.status==='unsupported'?state.media.message:stale?'等待播放器':p?.paused?'已暂停':p?'正在播放 · 拖动顶部可移动':'拖动顶部可移动 · 设置中可选择播放器';
 $('clock').textContent=time(pos);$('progress').max=p?.durationMs||1;$('progress').value=pos;
}
async function action(name){try{const s=await window.boardHost?.action(name);if(s)$('pin').setAttribute('aria-pressed',String(s.pinned));}catch{$('status').textContent='窗口控制暂时不可用';}}
for(const name of ['pin','settings','hide'])$(name).onclick=()=>void action(name);
void action('state');await poll();paint();setInterval(poll,500);setInterval(paint,100);
