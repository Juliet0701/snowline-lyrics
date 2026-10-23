import {createHash} from 'node:crypto';
import {parseLrc} from './core.mjs';

// Public documented service only. No upstream server code, credentials, media,
// user file paths, TTML tooling or translation endpoints are incorporated.
export function createLrcApiClient({fetchImpl=globalThis.fetch}={}){
 return async function lookup(p,{signal}={}){
  const title=String(p.title||'').trim(),artist=String(p.artist||'').trim();
  if(!title)return [];
  const url=new URL('https://api.lrc.cx/jsonapi');url.searchParams.set('title',title);if(artist)url.searchParams.set('artist',artist);
  const r=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'Snowline-Lyrics/0.3.0'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000),redirect:'error'});
  if(r.status===404)return [];
  if(!r.ok){const e=new Error(`LrcApi 公共同步源不可用（HTTP ${r.status}）`),raw=r.headers.get('retry-after');const retry=raw?(Number.isFinite(Number(raw))?Number(raw)*1000:Date.parse(raw)-Date.now()):0;e.retryAfterMs=Number.isFinite(retry)?Math.max(0,retry):0;throw e;}
  const raw=await r.text();if(raw.length>3*1024*1024)throw new Error('LrcApi 响应过大');
  let rows;try{rows=JSON.parse(raw);if(typeof rows==='string')rows=JSON.parse(rows);}catch{throw new Error('LrcApi 响应不是有效的歌词列表');}
  if(!Array.isArray(rows))throw new Error('LrcApi 响应不是有效的歌词列表');
  const records=[],ids=new Set();
  for(const row of rows.slice(0,30)){
   if(!row||typeof row!=='object')continue;
   const lrc=typeof row.lyrics==='string'?row.lyrics:typeof row.lrc==='string'?row.lrc:'';
   if(!lrc||lrc.length>400*1024)continue;
   const lines=parseLrc(lrc);if(lines.length<2||lines.length>20000||!lines.some(l=>l.timeMs>0))continue;
   // Keep returned metadata rather than presenting our query as a verified match.
   const trackName=String(row.title||'').slice(0,250),artistName=Array.isArray(row.artist)?row.artist.map(String).join(' / ').slice(0,250):String(row.artist||'').slice(0,250);
   if(!trackName)continue;
   const albumName=String(row.album||'').slice(0,250);
   const id='lrcapi:'+createHash('sha256').update(JSON.stringify([row.id,trackName,artistName,albumName,lrc])).digest('hex').slice(0,24);
   if(ids.has(id))continue;ids.add(id);
   const duration=Number(row.duration);
   records.push({id,provider:'lrcapi',trackName,artistName,albumName,duration:Number.isFinite(duration)&&duration>0&&duration<=86400?duration:0,syncedLyrics:lrc,manualOnly:true});
  }
  return records;
 };
}
