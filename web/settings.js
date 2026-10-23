import {positionAt,locateLyric} from '/core.mjs';
const $=id=>document.getElementById(id),boot=await(await fetch('/api/bootstrap')).json();
let state,busy=false,sourcesKey='',versionsKey='',linesKey='',selected=-1;
const labels={automatic:'自动同步',manual:'手动对齐',plain:'全文阅读','align-required':'等待对齐',waiting:'等待歌词'};
const time=ms=>{const n=Math.floor(ms/1000);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
async function api(path,data){const r=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Lyrics-Token':boot.token},body:data===undefined?undefined:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}
async function poll(){
 if(busy)return;busy=true;
 try{
  state=await api('state');const p=state.playback,m=state.media;
  $('title').textContent=p?.title||'等待音乐响起';$('artist').textContent=p?.artist||'打开播放器并播放音乐，即可自动连接。';
  $('status').textContent=p?`${labels[state.mode]}${p.paused?' · 已暂停':''}`:m?.status==='error'?'连接遇到问题':'等待播放器';
  $('media-status').textContent=m?.message||'正在连接 Windows 媒体会话…';
  $('lyrics-status').textContent=[state.lyrics?.message,state.lyrics?.warning].filter(Boolean).join('；');
  $('retry').disabled=!p||state.demo||state.lyrics?.status==='searching';$('duration').textContent=p?.durationMs?time(p.durationMs):'未知时长';
  $('backup').checked=state.settings.backupEnabled;
  $('sync-backup').checked=state.settings.syncBackupEnabled;
  const key=JSON.stringify([m?.preferred,m?.sessions?.map(s=>[s.id,s.label,s.title,s.paused])]);
  if(key!==sourcesKey){sourcesKey=key;$('source').replaceChildren(new Option('自动选择正在播放的音乐','auto'));for(const s of m?.sessions||[])$('source').append(new Option(`${s.label} · ${s.title}${s.paused?'（已暂停）':''}`,s.id));$('source').value=m?.preferred||'auto';}
  const vk=JSON.stringify([p?.trackId,state.lyrics]);
  if(vk!==versionsKey){versionsKey=vk;$('versions').replaceChildren();for(const c of state.lyrics?.candidates||[]){const b=document.createElement('button');b.className='version';b.textContent=`${state.lyrics.recordId===c.id?'✓ ':''}${c.title} · ${c.artist}\n${c.provider} · ${c.kind==='synced'?'时间戳歌词':'普通歌词'} · ${c.duration?time(c.duration*1000):'未知时长'} · ${c.album||'未知专辑'}`;const trackId=p.trackId;b.onclick=async()=>{try{await api('lyrics/select',{trackId,id:c.id});await poll();}catch(e){$('lyrics-status').textContent=e.message;}};$('versions').append(b);}}
  const lk=JSON.stringify([p?.trackId,state.lyrics.recordId,state.lines]);
  if(lk!==linesKey){linesKey=lk;selected=-1;$('manual-lines').replaceChildren();state.lines.forEach((line,index)=>{const b=document.createElement('button');b.className='lyric-choice';b.textContent=`${time(line.timeMs)}  ${line.text||'♪'}`;b.disabled=!line.text;b.onclick=()=>{selected=index;for(const row of $('manual-lines').children)row.setAttribute('aria-pressed',String(row===b));$('align-start').disabled=false;$('manual-message').textContent='已选当前句，点击下方按钮开始歌词计时。';};$('manual-lines').append(b);});$('align-start').disabled=true;}
  $('manual-panel').hidden=!(state.lines.length&&p?.timelineAvailable===false);
  $('manual-controls').hidden=!state.manualAligned;
  $('manual-toggle').textContent=state.displayPlayback?.paused?'继续歌词计时':'暂停歌词计时';
  $('plain-panel').hidden=state.mode!=='plain';if($('full-text').textContent!==state.text)$('full-text').textContent=state.text;
  $('manual-hint').textContent=p?.pauseKnown?'歌词计时会跟随系统暂停状态；音乐跳转后请重新选句。':'播放器未提供可靠暂停状态；暂停音乐时请同时暂停歌词计时。';
 }catch(e){$('status').textContent='连接遇到问题';$('media-status').textContent=e.message;}
 finally{busy=false;}
}
function paint(){if(!state)return;const p=state.displayPlayback,ms=positionAt(p),line=locateLyric(state.lines,ms,state.offsetMs);$('time').textContent=p?time(ms):'待对齐';$('progress').max=p?.durationMs||Math.max(ms,1);$('progress').value=p?ms:0;$('current').textContent=state.mode==='align-required'?'请在下方点选当前句':state.mode==='plain'?'全文阅读':line.current||(state.lines.length?'♪':state.lyrics?.status==='searching'?'正在查找歌词…':'♫');$('next').textContent=state.mode==='plain'?'歌词没有时间戳，可在歌词板或下方滚动阅读。':line.next||(!state.lines.length?state.lyrics?.message||'':'');}
$('source').onchange=async()=>{try{await api('media/source',{id:$('source').value});await poll();}catch(e){$('media-status').textContent=e.message;}};
$('retry').onclick=async()=>{const b=$('retry');b.disabled=true;try{await api('lyrics/search',{trackId:state.playback.trackId});await poll();}catch(e){$('lyrics-status').textContent=e.message;}finally{b.disabled=state?.lyrics?.status==='searching';}};
$('offset').oninput=()=>{$('offset-value').textContent=$('offset').value+' ms';};
$('offset').onchange=async()=>{try{await api('offset',{offsetMs:Number($('offset').value)});await poll();}catch(e){$('lyrics-status').textContent=e.message;}};
$('backup').onchange=async()=>{try{await api('settings',{backupEnabled:$('backup').checked});$('backup-result').textContent=$('backup').checked?'已启用；下一次查询无结果时尝试备用源。':'备用源已关闭。';await poll();}catch(e){$('backup-result').textContent=e.message;}};
$('sync-backup').onchange=async()=>{try{await api('settings',{syncBackupEnabled:$('sync-backup').checked});$('sync-backup-result').textContent=$('sync-backup').checked?'已开启免费第二同步源，点击 ↻ 重新查找；候选版本需要确认。':'第二同步源已关闭。';await poll();}catch(e){$('sync-backup-result').textContent=e.message;}};
$('align-start').onclick=async()=>{try{await api('manual/align',{trackId:state.playback.trackId,recordId:state.lyrics.recordId||null,revision:state.lyrics.revision,index:selected});$('manual-message').textContent='已对齐。仅启动歌词计时，不控制音乐播放。';await poll();}catch(e){$('manual-message').textContent=e.message;}};
for(const [id,action] of [['manual-toggle',null],['manual-reset','reset']])$(id).onclick=async()=>{try{await api('manual/control',{trackId:state.playback.trackId,action:action||(state.displayPlayback?.paused?'resume':'pause')});await poll();}catch(e){$('manual-message').textContent=e.message;}};
$('show-board').onclick=()=>void window.boardHost?.action('show');
$('lrc-file').onchange=async()=>{
 const file=$('lrc-file').files[0],trackId=state?.playback?.trackId;if(!file)return;
 try{if(!trackId)throw new Error('请先播放一首歌');if(file.size>400*1024)throw new Error('文件过大，请选择小于 400 KiB 的歌词文件');const lrc=await file.text();if(state?.playback?.trackId!==trackId)throw new Error('歌曲已切换，请重新导入');await api('lrc',{trackId,name:file.name,lrc});$('import-status').textContent='已导入当前歌曲';await poll();}catch(e){$('import-status').textContent=e.message;}finally{$('lrc-file').value='';}
};
await poll();paint();setInterval(poll,500);setInterval(paint,100);
