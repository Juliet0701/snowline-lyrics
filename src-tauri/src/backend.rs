use crate::media;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::Read,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
pub type Shared = Arc<Mutex<Backend>>;
static BACKOFF: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);
static JOBS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

pub fn hash(s: &str) -> String {
    format!("{:x}", Sha256::digest(s.as_bytes()))
}
fn text(v: &Value, k: &str) -> String {
    v[k].as_str().unwrap_or("").to_owned()
}
fn num(v: &Value, k: &str) -> i64 {
    v[k].as_i64().unwrap_or(0)
}
fn flag(v: &Value, k: &str) -> bool {
    v[k].as_bool().unwrap_or(false)
}
pub fn defaults() -> Value {
    json!({"backgroundColor":"#14232e","lyricsColor":"#def4e7","opacity":0.95,"image":null,"imageName":"","overlayColor":"black","overlayOpacity":0.0,"textShadow":false})
}
fn lines(raw: &str) -> Value {
    json!(snowline_core::parse_lrc(raw)
        .into_iter()
        .map(|l| json!({"timeMs":l.time_ms,"text":l.text}))
        .collect::<Vec<_>>())
}
fn plain(raw: &str) -> String {
    raw.trim_start_matches('\u{feff}')
        .lines()
        .filter(|s| {
            !s.trim().starts_with("[ti:")
                && !s.trim().starts_with("[ar:")
                && !s.trim().starts_with("[al:")
                && !s.trim().starts_with("[offset:")
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_owned()
}
pub fn position(p: &Value, now: i64) -> i64 {
    let elapsed = if flag(p, "paused") {
        0
    } else {
        (now - num(p, "receivedAt")).clamp(0, 6000)
    };
    let rate = p["rate"].as_f64().unwrap_or(1.0);
    (num(p, "positionMs") + (elapsed as f64 * rate) as i64).clamp(
        0,
        if num(p, "durationMs") > 0 {
            num(p, "durationMs")
        } else {
            86400000
        },
    )
}
pub struct Backend {
    pub dir: PathBuf,
    pub appearance: Value,
    pub settings: Value,
    pub library: Value,
    pub playback: Value,
    pub media: Value,
    pub preferred: String,
    pub lookup: Value,
    pub manual: Value,
    pub offset: i64,
    pub generation: u64,
    pub last_query: i64,
    pub demo: bool,
}
impl Backend {
    pub fn new(dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        let load = |name: &str, default: Value| -> Value {
            std::fs::read(dir.join(name))
                .ok()
                .and_then(|b| serde_json::from_slice(&b).ok())
                .unwrap_or(default)
        };
        let mut appearance = defaults();
        let old = load("appearance.json", json!({}));
        for (k, v) in old.as_object().into_iter().flatten() {
            if appearance.get(k).is_some() {
                appearance[k] = v.clone();
            }
        }
        if validate_appearance(&appearance).is_err() {
            appearance = defaults();
        }
        let raw_settings = load("settings.json", json!({}));
        let settings = json!({"backupEnabled":flag(&raw_settings,"backupEnabled"),"syncBackupEnabled":flag(&raw_settings,"syncBackupEnabled")});
        let mut library = load("library.json", json!({}));
        if !library.is_object() {
            library = json!({});
        }
        Self {
            settings,
            library,
            dir,
            appearance,
            playback: Value::Null,
            media: json!({"status":"starting","sessions":[],"message":"正在连接 Windows 播放器…"}),
            preferred: "auto".into(),
            lookup: json!({"status":"idle","candidates":[]}),
            manual: Value::Null,
            offset: 0,
            generation: 0,
            last_query: 0,
            demo: false,
        }
    }
    fn save(&self, file: &str, v: &Value) -> Result<(), String> {
        let path = self.dir.join(file);
        let tmp = self.dir.join(format!("{}.tmp", file));
        std::fs::write(&tmp, serde_json::to_vec(v).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        std::fs::rename(tmp, path).map_err(|e| e.to_string())
    }
    fn entry(&self) -> Value {
        self.library
            .get(text(&self.playback, "trackId"))
            .cloned()
            .unwrap_or(Value::Null)
    }
    fn manual_position(&self, now: i64) -> i64 {
        let until = now.min(num(&self.playback, "receivedAt") + 6000);
        let elapsed = if flag(&self.manual, "paused") {
            0
        } else {
            (until - num(&self.manual, "at")).max(0)
        };
        (num(&self.manual, "positionMs")
            + (elapsed as f64 * self.playback["rate"].as_f64().unwrap_or(1.0)) as i64)
            .clamp(
                0,
                if num(&self.playback, "durationMs") > 0 {
                    num(&self.playback, "durationMs")
                } else {
                    86400000
                },
            )
    }
    pub fn ingest(&mut self, mut p: Value) {
        let now = media::now_ms();
        if text(&p, "trackId") != text(&self.playback, "trackId")
            || text(&p, "source") != text(&self.playback, "source")
            || flag(&p, "timelineAvailable")
        {
            self.manual = Value::Null;
        } else if !self.manual.is_null() {
            self.manual["positionMs"] = json!(self.manual_position(now));
            self.manual["at"] = json!(now);
            self.manual["paused"] = json!(
                flag(&self.manual, "userPaused") || (flag(&p, "pauseKnown") && flag(&p, "paused"))
            );
        }
        if text(&p, "trackId") != text(&self.playback, "trackId") {
            self.generation += 1;
            self.lookup = json!({"status":"idle","candidates":[]});
            self.last_query = 0;
        }
        p["receivedAt"] = json!(now);
        self.playback = p;
    }
    pub fn snapshot(&self) -> Value {
        let now = media::now_ms();
        let p = &self.playback;
        let entry = self.entry();
        let lyric_lines = entry["lines"].as_array().cloned().unwrap_or_default();
        let body = entry["text"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| {
                lyric_lines
                    .iter()
                    .map(|l| text(l, "text"))
                    .collect::<Vec<_>>()
                    .join("\n")
            });
        let mut display = if flag(p, "timelineAvailable") {
            p.clone()
        } else {
            Value::Null
        };
        if !self.manual.is_null() {
            display = p.clone();
            display["positionMs"] = json!(self.manual_position(now));
            display["receivedAt"] = json!(now);
            display["paused"] = self.manual["paused"].clone();
        }
        let mode = if !entry.is_null() && lyric_lines.is_empty() {
            "plain"
        } else if !lyric_lines.is_empty() {
            if flag(p, "timelineAvailable") {
                "automatic"
            } else if !display.is_null() {
                "manual"
            } else {
                "align-required"
            }
        } else {
            "waiting"
        };
        let mut lyrics = self.lookup.clone();
        if !entry.is_null() {
            lyrics["source"] = entry["source"].clone();
            lyrics["recordId"] = entry["recordId"].clone();
            lyrics["revision"] = json!(hash(&entry.to_string()));
            if text(&lyrics, "status") != "searching" {
                lyrics["status"] = json!("ready");
                lyrics["message"] = json!(format!(
                    "已加载 {}{}",
                    entry["source"].as_str().unwrap_or("本地"),
                    if lyric_lines.is_empty() {
                        "普通歌词 · 全文阅读"
                    } else {
                        "同步歌词"
                    }
                ));
            }
        }
        if let Some(all) = lyrics["candidates"].as_array() {
            lyrics["candidates"] = json!(all
                .iter()
                .map(|c| {
                    let mut c = c.clone();
                    if let Some(o) = c.as_object_mut() {
                        o.remove("lines");
                        o.remove("text");
                        o.remove("score");
                    }
                    c
                })
                .collect::<Vec<_>>());
        }
        let mut appearance = self.appearance.clone();
        appearance["imageVersion"] = json!(self.appearance["image"]
            .as_str()
            .map(hash)
            .unwrap_or_default());
        appearance.as_object_mut().unwrap().remove("image");
        json!({"playback":p,"displayPlayback":display,"settings":self.settings,"appearance":appearance,"mode":mode,"manualAligned":!self.manual.is_null(),"media":self.media,"lines":lyric_lines,"text":body,"offsetMs":self.offset,"lyrics":lyrics,"stale":p.is_null()||now-num(p,"receivedAt")>6000,"serverNow":now,"demo":self.demo})
    }
}
pub fn apply_media(shared: &Shared, snapshot: Result<media::Snapshot, String>) {
    let mut b = shared.lock().unwrap();
    if b.demo {
        return;
    }
    let now = media::now_ms();
    match snapshot {
        Err(e) => {
            b.playback = Value::Null;
            b.manual = Value::Null;
            b.generation += 1;
            b.media = json!({"status":"error","message":e,"sessions":[],"preferred":b.preferred});
        }
        Ok(frame) => {
            let all: Vec<Value> = frame
                .sessions
                .iter()
                .map(|s| {
                    let mut v = serde_json::to_value(s).unwrap();
                    v["label"] = json!(s.app_id);
                    v
                })
                .filter(|v| !text(v, "title").trim().is_empty())
                .collect();
            let selected = if b.preferred != "auto" {
                all.iter().find(|s| text(s, "id") == b.preferred)
            } else {
                all.iter()
                    .find(|s| !flag(s, "paused") && !text(s, "artist").is_empty())
                    .or_else(|| all.iter().find(|s| !flag(s, "paused")))
                    .or_else(|| all.iter().find(|s| flag(s, "isCurrent")))
                    .or(all.first())
            };
            if let Some(s) = selected {
                let artist = text(s, "artist").trim().to_owned();
                let mut title = text(s, "title").trim().to_owned();
                for (open, close) in [("(", ")"), ("（", "）")] {
                    let suffix = format!("{}{}{}", open, artist, close);
                    if !artist.is_empty() && title.ends_with(&suffix) {
                        title = title[..title.len() - suffix.len()].trim().into();
                    }
                }
                let signature = json!([
                    title.to_lowercase(),
                    artist.to_lowercase(),
                    (s["durationMs"].as_f64().unwrap_or(0.0) / 1000.0).round() as i64
                ])
                .to_string();
                let p = json!({"trackId":format!("system:{}",&hash(&signature)[..32]),"source":format!("system:{}",text(s,"id")),"title":title,"artist":artist,"durationMs":s["durationMs"],"positionMs":s["positionMs"],"timelineAvailable":s["timelineAvailable"],"pauseKnown":s["pauseKnown"],"paused":s["paused"],"rate":s["rate"],"capturedAt":now});
                b.ingest(p);
                b.media = json!({"status":if flag(s,"timelineAvailable"){"ready"}else{"metadata-only"},"message":if flag(s,"timelineAvailable"){"已连接 Windows 媒体会话"}else{"已读取歌曲，播放器未提供进度；可手动对齐歌词。"},"sessions":all,"preferred":b.preferred});
            } else {
                b.playback = Value::Null;
                b.manual = Value::Null;
                b.generation += 1;
                b.media = json!({"status":"empty","message":"打开播放器并播放音乐","sessions":all,"preferred":b.preferred});
            }
        }
    }
}
fn norm(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}
fn clean(s: &str) -> String {
    let re=regex::Regex::new(r"(?i)[\[（(【](?:official\s*)?(?:music\s*video|audio|lyrics?(?:\s*video)?|mv|pv|hd|4k|公式[^\]）)】]*)[\]）)】]").unwrap();
    re.replace_all(s, "").trim().to_owned()
}
fn candidates(rows: Vec<Value>, p: &Value) -> Vec<Value> {
    let mut out = Vec::new();
    for r in rows.into_iter().take(100) {
        let provider = r["provider"].as_str().unwrap_or("lrclib");
        if provider == "lrclib" && r["id"].as_u64().unwrap_or(0) == 0 {
            continue;
        }

        let lrc = text(&r, "syncedLyrics");
        if lrc.len() > 400 * 1024 {
            continue;
        }
        let parsed = lines(&lrc);
        let ll = parsed.as_array().unwrap();
        let valid = ll.len() >= 2 && ll.len() <= 20000 && ll.iter().any(|l| num(l, "timeMs") > 0);
        let lyric_lines = if valid { parsed } else { json!([]) };
        let body = if !text(&r, "plainLyrics").is_empty() {
            plain(&text(&r, "plainLyrics"))
        } else {
            lyric_lines
                .as_array()
                .unwrap()
                .iter()
                .map(|l| text(l, "text"))
                .collect::<Vec<_>>()
                .join("\n")
        };
        if body.trim().is_empty() || body.len() > 400 * 1024 {
            continue;
        }
        let title = text(&r, "trackName");
        let artist = text(&r, "artistName");
        let duration = r["duration"].as_f64().unwrap_or(0.0);
        let delta = if num(p, "durationMs") > 0 && duration > 0.0 {
            Some((duration - num(p, "durationMs") as f64 / 1000.0).abs())
        } else {
            None
        };
        let ts = norm(&clean(&title)) == norm(&clean(&text(p, "title"))) && !title.is_empty();
        let ars = norm(&artist) == norm(&text(p, "artist")) && !artist.is_empty();
        let safe = ts && ars && delta.map(|d| d <= 3.0).unwrap_or(false) && !flag(&r, "manualOnly");
        let score = if ts { 60.0 } else { 0.0 }
            + if ars { 25.0 } else { 0.0 }
            + delta.map(|d| (15.0 - d * 2.0).max(0.0)).unwrap_or(0.0)
            + if valid { 5.0 } else { 0.0 };
        out.push(json!({"id":r["id"],"title":title,"artist":artist,"album":r["albumName"],"duration":duration,"deltaSeconds":delta,"safe":safe,"score":score,"lines":lyric_lines,"text":body,"kind":if valid{"synced"}else{"plain"},"provider":r["provider"].as_str().unwrap_or("lrclib")}));
    }
    out.sort_by(|a, b| {
        b["score"]
            .as_f64()
            .unwrap()
            .total_cmp(&a["score"].as_f64().unwrap())
    });
    out.dedup_by(|a, b| a["id"] == b["id"]);
    out.truncate(8);
    out
}
fn automatic(all: &[Value]) -> Option<Value> {
    let synced = all.iter().any(|v| text(v, "kind") == "synced");
    let safe: Vec<_> = all
        .iter()
        .filter(|v| flag(v, "safe") && (!synced || text(v, "kind") == "synced"))
        .collect();
    let first = *safe.first()?;
    if safe
        .iter()
        .all(|c| c["lines"] == first["lines"] && c["text"] == first["text"])
    {
        Some(first.clone())
    } else {
        None
    }
}
fn entry(c: &Value, selected: bool) -> Value {
    json!({"name":format!("{} · {}",text(c,"artist"),text(c,"title")),"lines":c["lines"],"text":c["text"],"source":c["provider"],"recordId":c["id"],"selectedManually":selected})
}
fn request(client: &reqwest::blocking::Client, url: reqwest::Url) -> Result<Value, String> {
    for attempt in 0..3 {
        let response = client
            .get(url.clone())
            .send()
            .map_err(|_| "无法连接歌词服务，请检查网络后重试".to_owned())?;
        let status = response.status().as_u16();
        if status == 404 {
            return Ok(json!([]));
        }
        if !response.status().is_success() {
            let retry = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| {
                    s.parse::<u64>().ok().or_else(|| {
                        httpdate::parse_http_date(s).ok().map(|d| {
                            d.duration_since(std::time::SystemTime::now())
                                .unwrap_or_default()
                                .as_secs()
                        })
                    })
                })
                .unwrap_or(0);
            if retry > 0 {
                BACKOFF.fetch_max(
                    media::now_ms() + (retry as i64).saturating_mul(1000),
                    std::sync::atomic::Ordering::Relaxed,
                );
            }
            if attempt < 2 && [429, 500, 502, 503, 504].contains(&status) && retry <= 4 {
                std::thread::sleep(Duration::from_secs(retry.max(1)));
                continue;
            }
            return Err(format!(
                "歌词服务 HTTP {}，请稍后重试{}",
                status,
                if retry > 0 {
                    format!("（等待 {} 秒）", retry)
                } else {
                    String::new()
                }
            ));
        }
        let mut data = Vec::new();
        response
            .take(3 * 1024 * 1024 + 1)
            .read_to_end(&mut data)
            .map_err(|e| e.to_string())?;
        if data.len() > 3 * 1024 * 1024 {
            return Err("歌词响应过大".into());
        }
        return serde_json::from_slice(&data).map_err(|_| "歌词服务返回了无效数据".into());
    }
    Err("歌词服务暂不可用".into())
}
fn url(base: &str, query: &[(&str, String)]) -> reqwest::Url {
    let mut u = reqwest::Url::parse(base).unwrap();
    for (k, v) in query {
        if !v.is_empty() {
            u.query_pairs_mut().append_pair(k, v);
        }
    }
    u
}
fn lookup(p: &Value, settings: &Value, force: bool) -> (Vec<Value>, String) {
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(18))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Snowline-Lyrics/0.5.0")
        .build()
    {
        Ok(c) => c,
        Err(e) => return (vec![], e.to_string()),
    };
    let mut rows = Vec::new();
    let mut warnings = Vec::new();
    let title = clean(&text(p, "title"));
    let artist = text(p, "artist");
    let query = [
        ("track_name", title.clone()),
        ("artist_name", artist.clone()),
    ];
    if !artist.is_empty() && num(p, "durationMs") > 0 {
        let mut q = query.to_vec();
        q.push((
            "duration",
            (num(p, "durationMs") as f64 / 1000.0).to_string(),
        ));
        match request(&client, url("https://lrclib.net/api/get", &q)) {
            Ok(v) => {
                if v.is_object() {
                    rows.push(v);
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    if force
        || automatic(&candidates(rows.clone(), p))
            .map(|c| text(&c, "kind") != "synced")
            .unwrap_or(true)
    {
        match request(&client, url("https://lrclib.net/api/search", &query)) {
            Ok(v) => {
                if let Some(a) = v.as_array() {
                    rows.extend(a.iter().cloned())
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    if candidates(rows.clone(), p).is_empty() && !artist.is_empty() {
        match request(
            &client,
            url(
                "https://lrclib.net/api/search",
                &[("q", format!("{} {}", title, artist))],
            ),
        ) {
            Ok(v) => {
                if let Some(a) = v.as_array() {
                    rows.extend(a.iter().cloned())
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    if flag(settings, "syncBackupEnabled")
        && automatic(&candidates(rows.clone(), p))
            .map(|c| text(&c, "kind") != "synced")
            .unwrap_or(true)
    {
        match request(
            &client,
            url(
                "https://api.lrc.cx/jsonapi",
                &[("title", title.clone()), ("artist", artist.clone())],
            ),
        ) {
            Ok(mut v) => {
                if let Some(s) = v.as_str() {
                    v = serde_json::from_str(s).unwrap_or(Value::Null);
                }
                for r in v.as_array().into_iter().flatten().take(30) {
                    let lrc = r["lrc"].as_str().or(r["lyrics"].as_str()).unwrap_or("");
                    let artist_name = if let Some(a) = r["artist"].as_array() {
                        a.iter()
                            .filter_map(Value::as_str)
                            .collect::<Vec<_>>()
                            .join(" / ")
                    } else {
                        text(r, "artist")
                    };
                    if text(r, "title").is_empty() {
                        continue;
                    }
                    rows.push(json!({"id":format!("lrcapi:{}",&hash(&r.to_string())[..24]),"provider":"lrcapi","manualOnly":true,"trackName":r["title"],"artistName":artist_name,"albumName":r["album"],"duration":r["duration"],"syncedLyrics":lrc}));
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    if flag(settings, "backupEnabled")
        && candidates(rows.clone(), p).is_empty()
        && !artist.is_empty()
    {
        let mut u = reqwest::Url::parse("https://api.lyrics.ovh/v1/").unwrap();
        {
            u.path_segments_mut()
                .unwrap()
                .pop_if_empty()
                .push(&artist)
                .push(&title);
        }
        match request(&client, u) {
            Ok(v) => {
                let body = text(&v, "lyrics");
                if !body.is_empty() {
                    rows.push(json!({"id":format!("ovh:{}",&hash(&format!("{}{}",artist,title))[..24]),"provider":"lyrics.ovh","manualOnly":true,"trackName":title,"artistName":artist,"plainLyrics":body}));
                }
            }
            Err(e) => warnings.push(e),
        }
    }
    (candidates(rows, p), warnings.join("；"))
}
pub fn start_search(shared: &Shared, force: bool) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    let until = BACKOFF.load(Ordering::Relaxed);
    if until > media::now_ms() {
        return if force {
            Err(format!(
                "服务要求等待，请在 {} 秒后重试",
                (until - media::now_ms() + 999) / 1000
            ))
        } else {
            Ok(())
        };
    }
    if JOBS.load(Ordering::Relaxed) >= 2 {
        return if force {
            Err("查询正在完成，请稍后重试".into())
        } else {
            Ok(())
        };
    }

    let (p, settings, generation) = {
        let mut b = shared.lock().unwrap();
        let now = media::now_ms();
        if b.playback.is_null() || (b.demo && !fixture()) {
            return Ok(());
        }
        if text(&b.lookup, "status") == "searching" {
            return Ok(());
        }
        if now - b.last_query < if force { 3000 } else { 120000 } {
            return if force {
                Err("请稍后再重新查找".into())
            } else {
                Ok(())
            };
        }
        if !force && !b.entry().is_null() {
            return Ok(());
        }
        b.last_query = now;
        b.generation += 1;
        b.lookup = json!({"status":"searching","message":"正在查找歌词…","candidates":[]});
        (b.playback.clone(), b.settings.clone(), b.generation)
    };
    let shared = shared.clone();
    JOBS.fetch_add(1, Ordering::Relaxed);
    std::thread::spawn(move || {
        struct Job;
        impl Drop for Job {
            fn drop(&mut self) {
                JOBS.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
            }
        }
        let _job = Job;
        let (all, warning) = if fixture() {
            std::thread::sleep(Duration::from_millis(300));
            (
                candidates(
                    vec![
                        json!({"id":1,"trackName":p["title"],"artistName":p["artist"],"duration":30,"syncedLyrics":"[00:00]原创第一句\n[00:10]原创第二句"}),
                    ],
                    &p,
                ),
                String::new(),
            )
        } else {
            lookup(&p, &settings, force)
        };
        let mut b = shared.lock().unwrap();
        if b.generation != generation || text(&b.playback, "trackId") != text(&p, "trackId") {
            return;
        }
        let existing = b.entry();
        let selected = automatic(&all);
        b.lookup = json!({"status":if all.is_empty(){if warning.is_empty(){"not-found"}else{"error"}}else{"choose"},"message":if all.is_empty(){"未找到歌词，可重试、开启备用源或导入自己的文件"}else{"找到歌词，请确认版本"},"warning":warning,"candidates":all});
        if !existing.is_null()
            && (text(&existing, "source") == "local" || flag(&existing, "selectedManually"))
        {
            return;
        }
        if let Some(c) = selected {
            let id = text(&p, "trackId");
            b.library[&id] = entry(&c, false);
            b.manual = Value::Null;
            let _ = b.save("library.json", &b.library);
        }
    });
    Ok(())
}
pub fn route(shared: &Shared, path: &str, data: Value) -> Result<Value, String> {
    if path == "__test/playback" && fixture() {
        let mut b = shared.lock().unwrap();
        b.demo = true;
        b.ingest(data);
        return Ok(json!({"ok":true}));
    }

    if path == "lyrics/search" {
        let b = shared.lock().unwrap();
        if data["trackId"] != b.playback["trackId"] {
            return Err("歌曲已切换".into());
        }
        drop(b);
        start_search(shared, true)?;
        return Ok(json!({"ok":true}));
    }
    let mut b = shared.lock().unwrap();
    let now = media::now_ms();
    match path {
        "bootstrap" => return Ok(json!({"token":"native-ipc","version":"0.5.0"})),
        "state" => {
            if !b.demo && !b.playback.is_null() && now - num(&b.playback, "receivedAt") > 6500 {
                b.playback = Value::Null;
                b.manual = Value::Null;
                b.generation += 1;
                b.media["status"] = json!("error");
                b.media["message"] = json!("媒体读取超时，等待恢复");
            }
            return Ok(b.snapshot());
        }
        "background" => return Ok(b.appearance["image"].clone()),
        "media/source" => {
            let id = text(&data, "id");
            if id != "auto"
                && !b.media["sessions"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|s| text(s, "id") == id)
            {
                return Err("播放器已关闭".into());
            }
            b.preferred = id;
            b.playback = Value::Null;
            b.manual = Value::Null;
            b.generation += 1;
        }
        "offset" => {
            let value = data["offsetMs"].as_i64().ok_or("无效时间偏移")?;
            if value.abs() > 30000 {
                return Err("时间偏移超出范围".into());
            }
            b.offset = value;
        }
        "settings" => {
            let mut next = b.settings.clone();
            for key in ["backupEnabled", "syncBackupEnabled"] {
                if let Some(v) = data.get(key) {
                    if !v.is_boolean() {
                        return Err("无效开关".into());
                    }
                    next[key] = v.clone();
                }
            }
            b.save("settings.json", &next)?;
            b.settings = next;
            b.generation += 1;
            b.lookup = json!({"status":"idle","candidates":[]});
        }
        "appearance" => {
            let mut next = b.appearance.clone();
            for (k, v) in data.as_object().ok_or("无效外观")? {
                if next.get(k).is_some() {
                    next[k] = v.clone();
                }
            }
            validate_appearance(&next)?;
            if next["image"].is_null() {
                next["imageName"] = json!("");
            }
            b.save("appearance.json", &next)?;
            b.appearance = next;
        }
        "lrc" => {
            let id = text(&data, "trackId");
            if id != text(&b.playback, "trackId") {
                return Err("歌曲已切换".into());
            }
            let raw = text(&data, "lrc");
            if raw.len() > 400 * 1024 || raw.trim().is_empty() {
                return Err("歌词文件为空或超过 400 KiB".into());
            }
            let ll = lines(&raw);
            let body = if ll.as_array().unwrap().is_empty() {
                plain(&raw)
            } else {
                ll.as_array()
                    .unwrap()
                    .iter()
                    .map(|l| text(l, "text"))
                    .collect::<Vec<_>>()
                    .join("\n")
            };
            if body.trim().is_empty() || ll.as_array().unwrap().len() > 20000 {
                return Err("没有可用歌词".into());
            }
            let mut library = b.library.clone();
            library[&id] = json!({"name":text(&data,"name").chars().take(160).collect::<String>(),"lines":ll,"text":body,"source":"local"});
            b.save("library.json", &library)?;
            b.library = library;
            b.manual = Value::Null;
            b.generation += 1;
            b.lookup = json!({"status":"ready","candidates":[]});
        }
        "lyrics/select" => {
            if data["trackId"] != b.playback["trackId"] {
                return Err("歌曲已切换".into());
            }
            let c = b.lookup["candidates"]
                .as_array()
                .into_iter()
                .flatten()
                .find(|v| v["id"] == data["id"])
                .ok_or("请选择本次查询结果")?
                .clone();
            let id = text(&b.playback, "trackId");
            let mut library = b.library.clone();
            library[&id] = entry(&c, true);
            b.save("library.json", &library)?;
            b.library = library;
            b.manual = Value::Null;
            b.generation += 1;
        }
        "manual/align" => {
            let entry = b.entry();
            if data["trackId"] != b.playback["trackId"]
                || data["recordId"] != entry["recordId"]
                || data["revision"] != hash(&entry.to_string())
            {
                return Err("歌曲或歌词已切换，请重新选句".into());
            }
            if flag(&b.playback, "timelineAvailable") || now - num(&b.playback, "receivedAt") > 6000
            {
                return Err("当前播放器不适用手动对齐".into());
            }
            let index = data["index"].as_u64().ok_or("请选择歌词句")? as usize;
            let line = entry["lines"].get(index).ok_or("无效歌词句")?;
            b.manual = json!({"positionMs":num(line,"timeMs")-b.offset,"at":now,"paused":flag(&b.playback,"pauseKnown")&&flag(&b.playback,"paused"),"userPaused":false});
        }
        "manual/control" => {
            if data["trackId"] != b.playback["trackId"] {
                return Err("歌曲已切换".into());
            }
            let action = text(&data, "action");
            if action == "reset" {
                b.manual = Value::Null;
            } else {
                if b.manual.is_null() || !["pause", "resume"].contains(&action.as_str()) {
                    return Err("请先对齐歌词".into());
                }
                let paused = action == "pause";
                b.manual = json!({"positionMs":b.manual_position(now),"at":now,"userPaused":paused,"paused":paused||(flag(&b.playback,"pauseKnown")&&flag(&b.playback,"paused"))});
            }
        }
        _ => return Err("未知操作".into()),
    }
    Ok(json!({"ok":true}))
}
fn validate_appearance(a: &Value) -> Result<(), String> {
    for k in ["backgroundColor", "lyricsColor"] {
        let v = text(a, k);
        if v.len() != 7 || !v.starts_with('#') || !v[1..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("无效颜色".into());
        }
    }
    for k in ["opacity", "overlayOpacity"] {
        if !a[k]
            .as_f64()
            .map(|v| v.is_finite() && (0.0..=1.0).contains(&v))
            .unwrap_or(false)
        {
            return Err("无效透明度".into());
        }
    }
    if !["black", "white"].contains(&text(a, "overlayColor").as_str())
        || !a["textShadow"].is_boolean()
        || text(a, "imageName").len() > 640
    {
        return Err("无效外观".into());
    }
    if !a["image"].is_null() {
        use base64::Engine;
        let v = a["image"].as_str().ok_or("无效图片")?;
        if v.len() > 1400 * 1024 {
            return Err("图片过大".into());
        }
        let (prefix, raw) = v.split_once(',').ok_or("无效图片")?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(raw)
            .map_err(|_| "图片编码无效")?;
        if !(prefix == "data:image/png;base64"
            && bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10])
            || prefix == "data:image/jpeg;base64" && bytes.starts_with(&[255, 216, 255]))
        {
            return Err("图片格式无效".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn make() -> Shared {
        static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "snowline-rust-test-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        Arc::new(Mutex::new(Backend::new(dir)))
    }
    fn playback(timeline: bool) -> Value {
        json!({"trackId":"test","source":"test","title":"原创","artist":"原创","durationMs":30000,"positionMs":0,"rate":1,"paused":false,"pauseKnown":true,"timelineAvailable":timeline})
    }
    #[test]
    fn appearance_rejects_remote_and_css() {
        for patch in [
            json!({"backgroundColor":"red"}),
            json!({"opacity":2}),
            json!({"image":"https://example.com/x"}),
            json!({"textShadow":"yes"}),
        ] {
            let mut a = defaults();
            for (k, v) in patch.as_object().unwrap() {
                a[k] = v.clone();
            }
            assert!(validate_appearance(&a).is_err());
        }
    }
    #[test]
    fn import_align_pause_reset_and_stale_revision() {
        let s = make();
        s.lock().unwrap().ingest(playback(false));
        route(
            &s,
            "lrc",
            json!({"trackId":"test","lrc":"[00:00]原创一\n[00:10]原创二"}),
        )
        .unwrap();
        let state = route(&s, "state", Value::Null).unwrap();
        assert_eq!(state["mode"], "align-required");
        let data = json!({"trackId":"test","recordId":null,"revision":state["lyrics"]["revision"],"index":1});
        route(&s, "manual/align", data.clone()).unwrap();
        let state = route(&s, "state", Value::Null).unwrap();
        assert_eq!(state["mode"], "manual");
        assert!(num(&state["displayPlayback"], "positionMs") >= 10000);
        route(
            &s,
            "manual/control",
            json!({"trackId":"test","action":"pause"}),
        )
        .unwrap();
        s.lock().unwrap().ingest(playback(false));
        assert!(flag(
            &route(&s, "state", Value::Null).unwrap()["displayPlayback"],
            "paused"
        ));
        route(
            &s,
            "lrc",
            json!({"trackId":"test","lrc":"[00:00]新一\n[00:20]新二"}),
        )
        .unwrap();
        assert!(route(&s, "manual/align", data).is_err());
    }
    #[test]
    fn plain_and_persistence() {
        let s = make();
        s.lock().unwrap().ingest(playback(true));
        route(&s, "lrc", json!({"trackId":"test","lrc":"完整原创歌词"})).unwrap();
        assert_eq!(route(&s, "state", Value::Null).unwrap()["mode"], "plain");
        route(
            &s,
            "appearance",
            json!({"overlayOpacity":0.35,"textShadow":true}),
        )
        .unwrap();
        let b = Backend::new(s.lock().unwrap().dir.clone());
        assert_eq!(b.appearance["overlayOpacity"], 0.35);
        assert_eq!(b.library["test"]["text"], "完整原创歌词");
    }
    #[test]
    fn safe_matching_requires_duration_and_ambiguity_confirmation() {
        let p = playback(true);
        let rows = vec![
            json!({"id":1,"trackName":"原创","artistName":"原创","duration":30,"syncedLyrics":"[00:00]一\n[00:10]二"}),
        ];
        assert!(automatic(&candidates(rows.clone(), &p)).is_some());
        let mut unknown = p.clone();
        unknown["durationMs"] = json!(0);
        assert!(automatic(&candidates(rows.clone(), &unknown)).is_none());
        let mut both = rows.clone();
        let mut other = rows[0].clone();
        other["id"] = json!(2);
        other["syncedLyrics"] = json!("[00:00]一\n[00:11]二");
        both.push(other);
        assert!(automatic(&candidates(both, &p)).is_none());
    }
}

pub fn fixture() -> bool {
    std::env::var("SNOWLINE_RUST_FIXTURE").as_deref() == Ok("1")
        && std::env::var_os("SNOWLINE_RUST_TEST_DATA").is_some()
}
pub fn network_check() -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(18))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Snowline-Lyrics/0.5.0")
        .build()
        .map_err(|e| e.to_string())?;
    for (name, u) in [
        (
            "LRCLIB",
            url(
                "https://lrclib.net/api/search",
                &[
                    ("track_name", "Yellow".into()),
                    ("artist_name", "Coldplay".into()),
                ],
            ),
        ),
        (
            "LrcApi",
            url(
                "https://api.lrc.cx/jsonapi",
                &[("title", "Yellow".into()), ("artist", "Coldplay".into())],
            ),
        ),
        (
            "lyrics.ovh",
            reqwest::Url::parse("https://api.lyrics.ovh/v1/Coldplay/Yellow").unwrap(),
        ),
    ] {
        match request(&client, u) {
            Ok(v) => println!(
                "{}: valid JSON, {} records",
                name,
                v.as_array().map(Vec::len).unwrap_or(1)
            ),
            Err(e) => println!("{}: {}", name, e),
        }
    }
    Ok(())
}
#[cfg(test)]
mod protocol_tests {
    use super::*;
    #[test]
    fn retry_after_stops_immediate_retries() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let t = std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let mut buf = [0; 4096];
            let _ = s.read(&mut buf);
            s.write_all(b"HTTP/1.1 429 Too Many Requests\r\nRetry-After: 120\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
        });
        let c = reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap();
        assert!(request(
            &c,
            reqwest::Url::parse(&format!("http://{}/", address)).unwrap()
        )
        .is_err());
        assert!(BACKOFF.load(std::sync::atomic::Ordering::Relaxed) > media::now_ms() + 115000);
        BACKOFF.store(0, std::sync::atomic::Ordering::Relaxed);
        t.join().unwrap();
    }
    #[test]
    fn missing_duration_and_secondary_sources_require_confirmation() {
        let p = json!({"title":"Song","artist":"Artist","durationMs":30000});
        let row = json!({"id":"lrcapi:0123456789abcdef01234567","provider":"lrcapi","trackName":"Song","artistName":"Artist","duration":30,"manualOnly":true,"syncedLyrics":"[00:00]Original one\n[00:10]Original two"});
        assert!(automatic(&candidates(vec![row], &p)).is_none());
    }
    #[test]
    fn corrupt_saved_settings_do_not_break_startup() {
        let dir = std::env::temp_dir().join(format!("snowline-corrupt-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("appearance.json"), "{\"opacity\":5}").unwrap();
        std::fs::write(dir.join("library.json"), "[]").unwrap();
        std::fs::write(dir.join("settings.json"), "false").unwrap();
        let b = Backend::new(dir);
        assert_eq!(b.appearance, defaults());
        assert!(b.library.is_object());
        assert_eq!(b.settings["backupEnabled"], false);
    }
}
