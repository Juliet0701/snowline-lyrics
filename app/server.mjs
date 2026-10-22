import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { parseLrc, normalizePlayback, positionAt } from './core.mjs';
import { createLrclibClient, rankCandidates, chooseAutomatic, publicCandidate } from './lyrics.mjs';

const demoLrc = '[ti:同步演示]\n[00:00.00]雪夜里，星光轻轻亮起\n[00:04.00]让每一句祝福，跟着音乐靠近\n[00:08.00]暂停一下，文字也会等你\n[00:12.00]拖动进度，去下一段风景\n[00:16.00]\n[00:20.00]愿你今天也有好心情';

async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512 * 1024) { const e = new Error('Body exceeds 512 KiB'); e.status = 413; throw e; }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export async function createBridge({ root, port = 18743, token: suppliedToken, persist = true, lookupLyrics=createLrclibClient(), autoLookup=true, dataRoot, getMediaState, selectMediaSource } = {}) {
  const local = dataRoot || join(root, '.local');
  await mkdir(local, { recursive: true });
  let token = suppliedToken;
  if (!token) {
    try { token = JSON.parse(await readFile(join(local, 'pairing.json'), 'utf8')).token; } catch {}
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) token = randomBytes(32).toString('hex');
  }
  let library = Object.create(null);
  if (persist) { try { library = Object.assign(Object.create(null), JSON.parse(await readFile(join(local, 'library.json'), 'utf8'))); } catch {} }
  const state = { playback: null, offsetMs: 0, demo: false };
  const lookups=new Map();
  const inFlight=new Map();
  let libraryWrite=Promise.resolve(),closed=false;
  function saveLibrary() {
    if(!persist)return Promise.resolve();
    const data=JSON.stringify(library,null,2);
    libraryWrite=libraryWrite.catch(()=>{}).then(()=>writeFile(join(local,'library.json'),data));
    return libraryWrite;
  }
  function statusFor(trackId) {
    const entry=library[trackId];
    if(entry)return {status:lookups.get(trackId)?.status==='searching'?'searching':'ready',message:lookups.get(trackId)?.status==='searching'?'正在重新查找同步歌词…':entry.source==='lrclib'?'已加载 LRCLIB 同步歌词':'已加载本地歌词',source:entry.source||'local',recordId:entry.recordId||null,candidates:lookups.get(trackId)?.candidates?.map(publicCandidate)||[]};
    const hit=lookups.get(trackId);
    return hit?{status:hit.status,message:hit.message,candidates:(hit.candidates||[]).map(publicCandidate)}:{status:'idle',message:'等待歌曲信息',candidates:[]};
  }
  async function searchLyrics(playback,force=false) {
    const id=playback.trackId,previous=lookups.get(id);
    if(closed||!autoLookup||playback.ad||id.startsWith('demo:')||!playback.title.trim()||playback.durationMs<=0)return;
    if(inFlight.has(id))return inFlight.get(id).promise;
    if(!force && library[id])return;
    if(previous?.retryAt>Date.now() || (!force && previous && Date.now()-previous.at<120000))return;
    // A later track supersedes this search; abort to keep the local request queue bounded.
    for(const [other,job] of inFlight)if(other!==id)job.controller.abort();
    const controller=new AbortController();
    const hit={status:'searching',message:'正在自动查找同步歌词…',candidates:previous?.candidates||[],at:Date.now()};lookups.set(id,hit);
    const promise=(async()=>{
      await Promise.resolve(); // Register the job before an injected lookup can synchronously fail.
      try{
        const records=await lookupLyrics({...playback},{signal:controller.signal,includeAlternatives:force});
        if(closed||controller.signal.aborted){hit.status='idle';hit.at=0;hit.message='查询已暂停';return;}
        const candidates=rankCandidates(records,playback);hit.candidates=candidates;hit.at=Date.now();
        const selected=chooseAutomatic(candidates);
        // A manual import/choice made during a request always wins, including on forced retry.
        if(library[id] && (library[id].source!=='lrclib'||library[id].selectedManually))return;
        if(selected){
          library[id]={name:`${selected.artist} · ${selected.title}`,lines:selected.lines,source:'lrclib',recordId:selected.id,selectedManually:false};
          hit.status='ready';hit.message='已自动匹配同步歌词';await saveLibrary();
        }else if(candidates.length){hit.status='choose';hit.message='找到同步歌词，请确认歌曲版本';}
        else{hit.status='not-found';hit.message='未找到可用的同步歌词；可重试或手动导入';}
      }catch(e){
        if(controller.signal.aborted){hit.status='idle';hit.at=0;hit.message='查询已暂停';}
        else{hit.status='error';hit.message=e.message||'歌词查询失败，稍后重试';hit.at=Date.now();hit.retryAt=e.retryAfterMs?Date.now()+e.retryAfterMs:0;}
      }finally{if(inFlight.get(id)?.controller===controller)inFlight.delete(id);}
    })();
    inFlight.set(id,{controller,promise});
    if(lookups.size>150){for(const key of lookups.keys()){if(!inFlight.has(key)&&key!==id){lookups.delete(key);break;}}}
    return promise;
  }
  const staticFiles = new Map([
    ['/', ['web/settings.html', 'text/html; charset=utf-8']],
    ['/settings', ['web/settings.html', 'text/html; charset=utf-8']],
    ['/settings.js', ['web/settings.js', 'text/javascript; charset=utf-8']],
    ['/settings.css', ['web/settings.css', 'text/css; charset=utf-8']],
    ['/core.mjs', ['app/core.mjs', 'text/javascript; charset=utf-8']],
    ['/board', ['web/board.html', 'text/html; charset=utf-8']],
    ['/board.js', ['web/board.js', 'text/javascript; charset=utf-8']],
    ['/board.css', ['web/board.css', 'text/css; charset=utf-8']]
  ]);
  let base = '';
  function validToken(candidate) {
    return typeof candidate === 'string' && Buffer.byteLength(candidate) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
  }
  function ingestPlayback(value){
    const next=normalizePlayback(value),prev=state.playback;
    if(prev && next.source===prev.source && next.capturedAt<prev.capturedAt)throw new Error('Out-of-order playback');
    state.playback=next;state.demo=false;void searchLyrics(next);return next;
  }
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      // Reject DNS rebinding, cross-site admin access, and arbitrary web origins.
      if (req.headers.host !== new URL(base).host) return json(403, { error: 'Invalid host' });
      const origin = req.headers.origin;
      if (origin && origin !== base) return json(403, { error: 'Origin denied' });
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Lyrics-Token');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.writeHead(204); return res.end();
      }
      const path = new URL(req.url, base).pathname;
      const admin = (!origin || origin === base) && !['cross-site', 'same-site'].includes(req.headers['sec-fetch-site']);
      if (path === '/api/bootstrap' && req.method === 'GET') {
        if (!admin) return json(403, { error: 'Open the local dashboard to pair' });
        return json(200, { token, base, version: '0.1.0' });
      }
      if (path === '/health' && req.method === 'GET') return json(200, { ok: true, app: 'snowline-lyrics' });
      if (path === '/engine.js' && req.method === 'GET' && admin) {
        const source = (await readFile(join(root, 'app/core.mjs'), 'utf8')).replaceAll('export function ', 'function ');
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        return res.end(source + '\nwindow.LyricsCore = {positionAt, locateLyric};');
      }
      if (staticFiles.has(path) && req.method === 'GET') {
        if (!admin) return json(403, { error: 'Dashboard origin denied' });
        const [file, mime] = staticFiles.get(path);
        const data = await readFile(join(root, file));
        res.writeHead(200, { 'Content-Type': mime }); return res.end(data);
      }
      if (!validToken(req.headers['x-lyrics-token'])) return json(401, { error: 'Pairing token required' });
      if (path === '/api/state' && req.method === 'GET') {
        const playback = state.playback;
        const entry = playback && !playback.ad ? library[playback.trackId] : null;
        return json(200, { ...state, media:getMediaState?.()||null, lines: entry?.lines || [], lrcName: entry?.name || '', lyrics:playback?statusFor(playback.trackId):{status:'idle',message:'等待音乐响起',candidates:[]}, stale: !playback || Date.now() - playback.receivedAt > 6000, serverNow: Date.now() });
      }
      if (path === '/api/playback' && req.method === 'POST') {
        const next = normalizePlayback(await body(req));
        const prev = state.playback;
        if (prev && next.source === prev.source && next.capturedAt < prev.capturedAt) return json(409, { error: 'Out-of-order playback' });
        if (prev && next.source !== prev.source && !prev.paused && Date.now() - prev.receivedAt < 3500 && next.paused) return json(409, { error: 'Another playing tab is active' });
        state.playback = next; state.demo = false;
        void searchLyrics(next);
        return json(200, { ok: true });
      }
      if(path==='/api/lyrics/search' && req.method==='POST'){
        const data=await body(req),p=state.playback;
        if(!p||p.ad||p.trackId.startsWith('demo:')||data.trackId!==p.trackId)return json(409,{error:'歌曲已切换，请对当前歌曲重新查询'});
        const retryAt=lookups.get(p.trackId)?.retryAt;
        if(retryAt>Date.now())return json(429,{error:`歌词服务要求等待，请在 ${Math.ceil((retryAt-Date.now())/1000)} 秒后重试`});
        void searchLyrics(p,true);return json(200,{ok:true});
      }
      if(path==='/api/media/source' && req.method==='POST'){
        if(!selectMediaSource)return json(400,{error:'当前不是系统媒体模式'});
        const data=await body(req);if(typeof data.id!=='string')return json(400,{error:'请选择播放器'});
        await selectMediaSource(data.id);return json(200,{ok:true});
      }
      if(path==='/api/lyrics/select' && req.method==='POST'){
        const data=await body(req),p=state.playback;
        if(!p||p.ad||data.trackId!==p.trackId)return json(409,{error:'歌曲已切换，请重新选择版本'});
        const chosen=lookups.get(data.trackId)?.candidates?.find(c=>c.id===data.id);
        if(!chosen)return json(400,{error:'请选择本次查询返回的同步歌词版本'});
        library[data.trackId]={name:`${chosen.artist} · ${chosen.title}`,lines:chosen.lines,source:'lrclib',recordId:chosen.id,selectedManually:true};
        await saveLibrary();return json(200,{ok:true});
      }
      if (path === '/api/lrc' && req.method === 'POST') {
        const data = await body(req);
        if (typeof data.trackId !== 'string' || !data.trackId || data.trackId.length > 300) return json(400, { error: 'Choose a playing track first' });
        if (typeof data.lrc !== 'string') return json(400, { error: 'Missing LRC text' });
        const lines = parseLrc(data.lrc);
        if (!lines.length || lines.length > 20000) return json(400, { error: 'No valid timestamped lyrics' });
        inFlight.get(data.trackId)?.controller.abort();
        library[data.trackId] = { name: String(data.name || '本地 LRC').slice(0, 160), lines, source:'local' };
        await saveLibrary();
        return json(200, { ok: true, count: lines.length });
      }
      if (path === '/api/offset' && req.method === 'POST') {
        const { offsetMs } = await body(req);
        if (!Number.isFinite(offsetMs) || Math.abs(offsetMs) > 30000) return json(400, { error: 'Offset must be within ±30000 ms' });
        state.offsetMs = offsetMs; return json(200, { ok: true });
      }
      if (path === '/api/demo' && req.method === 'POST') {
        const data = await body(req);
        const now = Date.now();
        library['demo:original'] = { name: '原创演示.lrc', lines: parseLrc(demoLrc) };
        state.playback = normalizePlayback({ trackId: 'demo:original', source: 'demo', title: '歌词同步演示', artist: '原创测试文案 · 不播放音频', positionMs: Number(data.positionMs) || 0, durationMs: 26000, paused: data.paused === true, rate: 1, capturedAt: now }, now);
        state.demo = true; return json(200, { ok: true });
      }
      return json(404, { error: 'Not found' });
    } catch (e) { if (!res.headersSent) json(e.status || 400, { error: e.message }); else res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  const demoTimer = setInterval(() => {
    if (!state.demo || !state.playback) return;
    const p = state.playback, now = Date.now();
    p.positionMs = positionAt(p, now); p.receivedAt = now;
    if (p.positionMs >= p.durationMs) p.paused = true;
  }, 500);
  demoTimer.unref();
  if (persist) await writeFile(join(local, 'pairing.json'), JSON.stringify({ base, token }, null, 2));
  return { server, base, token, state, ingestPlayback, clearPlayback:()=>{state.playback=null;state.demo=false;}, close: async () => {
    closed=true;clearInterval(demoTimer);for(const job of inFlight.values())job.controller.abort();
    await Promise.allSettled([...inFlight.values()].map(j=>j.promise));await libraryWrite.catch(()=>{});
    await new Promise(resolve => {server.close(resolve);server.closeIdleConnections();});
  } };
}
