import { parseLrc, plainLyrics } from './core.mjs';
import {createHash} from 'node:crypto';

export function cleanTitle(value) {
  return String(value || '').normalize('NFKC')
    .replace(/[\[【(（](?:official\s*)?(?:music\s*video|audio|lyric(?:s)?(?:\s*video)?|mv|pv|hd|4k|公式[^\]】)）]*)[\]】)）]/gi, '')
    .replace(/\s*[-–—|]\s*(?:official\s*)?(?:music\s*video|audio|lyrics?|mv|pv)\s*$/i, '').trim();
}
function norm(value) { return cleanTitle(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
function words(value) { return new Set(cleanTitle(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []); }
function similarity(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const aa = words(a), bb = words(b);
  const intersection = [...aa].filter(w => bb.has(w)).length;
  return Math.max(intersection / Math.max(aa.size, bb.size, 1), (x.includes(y) || y.includes(x)) ? Math.min(x.length,y.length) / Math.max(x.length,y.length) : 0);
}
const variants = /\b(live|remix|acoustic|instrumental|karaoke|cover|sped\s*up|slowed|edit|version)\b|ライブ|カバー|现场|翻唱/gi;
function versionSet(text) { return new Set(String(text).toLowerCase().match(variants) || []); }
function versionConflict(a, b) { const aa=versionSet(a),bb=versionSet(b); return [...aa].some(v=>!bb.has(v)) || [...bb].some(v=>!aa.has(v)); }

export function rankCandidates(records, playback) {
  const ranked=[];
  for (const row of Array.isArray(records) ? records.slice(0,100) : []) {
    if (!row || !(Number.isSafeInteger(row.id)&&row.id>0 || row.provider==='lyrics.ovh'&&/^ovh:[a-f0-9]{24}$/.test(row.id)||row.provider==='lrcapi'&&/^lrcapi:[a-f0-9]{24}$/.test(row.id))) continue;
    if (typeof row.syncedLyrics === 'string' && row.syncedLyrics.length>400*1024) continue;
    const parsed=parseLrc(row.syncedLyrics||'');
    const lines=parsed.length>=2&&parsed.length<=20000&&parsed.some(l=>l.timeMs>0)?parsed:[];
    const text=plainLyrics(row.plainLyrics|| (lines.length?lines.map(l=>l.text).join('\n'):''));
    if(!lines.length&&!text)continue;
    const title=String(row.trackName || row.name || '').slice(0,250);
    const artist=String(row.artistName || '').slice(0,250);
    const duration=Number(row.duration), delta=Number.isFinite(duration) && playback.durationMs>0 ? Math.abs(duration-playback.durationMs/1000) : null;
    const titleScore=similarity(playback.title,title),artistScore=similarity(playback.artist,artist);
    const mismatch=versionConflict(playback.title,title);
    const safe=titleScore>=.98 && artistScore>=.98 && delta!==null && delta<=3 && !mismatch && !row.manualOnly;
    ranked.push({id:row.id,title,artist,album:String(row.albumName||'').slice(0,250),duration:Number.isFinite(duration)?duration:0,
      deltaSeconds:delta===null?null:Math.round(delta*10)/10,safe,
      score:titleScore*60+artistScore*25+(delta===null?0:Math.max(0,15-delta*2))-(mismatch?30:0)+(lines.length?5:0),lines,text,kind:lines.length?'synced':'plain',provider:row.provider||'lrclib'});
  }
  return ranked.sort((a,b)=>b.score-a.score || a.id-b.id).slice(0,8);
}
export function chooseAutomatic(candidates) {
  const synced=candidates.filter(c=>c.kind==='synced');
  const safe=(synced.length?synced:candidates).filter(c=>c.safe);
  if (!safe.length) return null;
  if (safe.length===1) return safe[0];
  // Multiple albums may contain the same recording/lyrics; accept only identical timelines.
  const timeline=JSON.stringify([safe[0].lines,safe[0].text]);
  return safe.every(c=>JSON.stringify([c.lines,c.text])===timeline) ? safe[0] : null;
}
export function publicCandidate(c) {
  return {id:c.id,title:c.title,artist:c.artist,album:c.album,duration:c.duration,deltaSeconds:c.deltaSeconds,safe:c.safe,kind:c.kind,provider:c.provider};
}

export function createLrclibClient({ fetchImpl=globalThis.fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms)) }={}) {
  async function request(path, params, signal) {
    const url=new URL(`https://lrclib.net/api/${path}`);
    for(const [key,value] of Object.entries(params)) if(value!==undefined && value!=='') url.searchParams.set(key,String(value));
    for(let attempt=0;attempt<3;attempt++) {
      signal?.throwIfAborted();
      let response;
      try { response=await fetchImpl(url,{headers:{'User-Agent':'Snowline-Lyrics/0.3.0 (Windows desktop lyric board)','Accept':'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)}); }
      catch(e) {
        if(signal?.aborted) throw e;
        if(attempt===2) throw new Error('无法连接 LRCLIB，请检查网络后重试');
        await sleep(1000*(attempt+1));continue;
      }
      if(response.status===404)return [];
      if([429,500,502,503,504].includes(response.status)) {
        const rawRetry=response.headers.get('retry-after');
        const retry=rawRetry?(Number.isFinite(Number(rawRetry))?Number(rawRetry)*1000:Math.max(0,Date.parse(rawRetry)-Date.now())):0;
        if(attempt===2 || retry>4000){
          const error=new Error(`LRCLIB 服务暂时不可用（HTTP ${response.status}），稍后重试`);
          error.retryAfterMs=Number.isFinite(retry)?retry:0;throw error;
        }
        await sleep(retry>0?retry:1000*(attempt+1));continue;
      }
      if(!response.ok)throw new Error(`LRCLIB 查询失败（HTTP ${response.status}）`);
      const text=await response.text();
      if(text.length>3*1024*1024)throw new Error('LRCLIB 响应过大');
      const data=JSON.parse(text);
      return Array.isArray(data)?data:[data];
    }
  }
  return async function lookup(playback,{signal,includeAlternatives=false}={}) {
    const title=cleanTitle(playback.title), artist=String(playback.artist||'').trim();
    if(!title)return [];
    const seconds=playback.durationMs/1000;
    const all=artist && seconds>=1 && seconds<=3600 ? await request('get',{track_name:title,artist_name:artist,duration:seconds},signal) : [];
    if(!includeAlternatives && chooseAutomatic(rankCandidates(all,playback))?.kind==='synced')return all;
    try{all.push(...await request('search',{track_name:title,artist_name:artist},signal));}
    catch(e){if(rankCandidates(all,playback).length)return all;throw e;}
    // Only widen if no usable synced record; preserve exact-query results for ranking.
    if(!rankCandidates(all,playback).length && artist) all.push(...await request('search',{q:`${title} ${artist}`},signal));
    const unique=new Map();for(const row of all)if(row?.id)unique.set(row.id,row);
    return [...unique.values()];
  };
}

export function createOvhClient({fetchImpl=globalThis.fetch}={}){
 return async function lookup(p,{signal}={}){
  if(!p.title.trim()||!p.artist.trim())return [];
  const url=`https://api.lyrics.ovh/v1/${encodeURIComponent(p.artist.trim())}/${encodeURIComponent(cleanTitle(p.title))}`;
  const r=await fetchImpl(url,{headers:{'Accept':'application/json','User-Agent':'Snowline-Lyrics/0.3.0'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  if(r.status===404)return [];
  if(!r.ok){const e=new Error(`lyrics.ovh 备用服务暂时不可用（HTTP ${r.status}）`);const raw=r.headers.get('retry-after');const retry=raw?(Number.isFinite(Number(raw))?Number(raw)*1000:Date.parse(raw)-Date.now()):0;e.retryAfterMs=Number.isFinite(retry)?Math.max(0,retry):0;throw e;}
  const raw=await r.text();if(raw.length>600*1024)throw new Error('备用歌词响应过大');
  const text=plainLyrics(JSON.parse(raw).lyrics);if(!text)return [];
  return [{id:'ovh:'+createHash('sha256').update(JSON.stringify([p.artist,p.title])).digest('hex').slice(0,24),provider:'lyrics.ovh',trackName:p.title,artistName:p.artist,plainLyrics:text,manualOnly:true}];
 };
}
