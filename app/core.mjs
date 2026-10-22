export function parseLrc(input) {
  const lines = [];
  let offset = 0;
  for (const row of String(input).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const off = row.match(/^\s*\[offset:([+-]?\d+)\]/i);
    if (off) { offset = Number(off[1]); continue; }
    const stamps = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = row.replace(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g, '').trim();
    for (const stamp of stamps) {
      const timeMs = Number(stamp[1]) * 60000 + Number(stamp[2]) * 1000 + Number((stamp[3] || '').padEnd(3, '0'));
      lines.push({ timeMs, text });
    }
  }
  // LRC offset > 0 means display earlier. Merge same-time translations.
  const grouped = new Map();
  for (const line of lines) {
    const time = Math.max(0, line.timeMs - offset);
    const texts = grouped.get(time) || [];
    if (!texts.includes(line.text)) texts.push(line.text);
    grouped.set(time, texts);
  }
  return [...grouped].sort((a, b) => a[0] - b[0]).map(([timeMs, texts]) => ({ timeMs, text: texts.filter(Boolean).join('\n') }));
}

export function positionAt(playback, now = Date.now()) {
  if (!playback) return 0;
  const elapsed = playback.paused || playback.seeking ? 0 : Math.max(0, Math.min(now - playback.receivedAt, 6000));
  const value = playback.positionMs + elapsed * playback.rate;
  return Math.max(0, playback.durationMs > 0 ? Math.min(value, playback.durationMs) : value);
}

export function locateLyric(lines, positionMs, offsetMs = 0) {
  let low = 0, high = lines.length - 1, index = -1;
  const target = positionMs + offsetMs;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= target) { index = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return { index, current: index < 0 ? '' : lines[index].text, next: lines[index + 1]?.text || '' };
}

export function normalizePlayback(value, receivedAt = Date.now()) {
  if (!value || typeof value !== 'object' || !Number.isFinite(value.positionMs) || value.positionMs < 0) throw new Error('Invalid playback position');
  if (typeof value.trackId !== 'string' || !value.trackId || value.trackId.length > 300) throw new Error('Missing track ID');
  if (typeof value.source !== 'string' || !value.source || value.source.length > 160) throw new Error('Missing source');
  if (typeof value.paused !== 'boolean') throw new Error('Invalid paused flag');
  const rate = Number(value.rate ?? 1);
  if (!Number.isFinite(rate) || rate < 0 || rate > 4) throw new Error('Invalid playback rate');
  if (!Number.isFinite(value.capturedAt) || Math.abs(receivedAt - value.capturedAt) > 10000) throw new Error('Stale playback sample');
  return {
    trackId: value.trackId, source: value.source,
    title: String(value.title || '').slice(0, 250), artist: String(value.artist || '').slice(0, 250),
    positionMs: Math.min(value.positionMs, 24 * 3600000),
    durationMs: Number.isFinite(value.durationMs) ? Math.max(0, Math.min(value.durationMs, 24 * 3600000)) : 0,
    rate, paused: value.paused, seeking: value.seeking === true, ad: value.ad === true,
    capturedAt: value.capturedAt, receivedAt
  };
}
