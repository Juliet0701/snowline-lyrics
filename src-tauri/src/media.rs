use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub position_ms: i64,
    pub paused: bool,
    pub pause_known: bool,
    pub timeline_available: bool,
    pub rate: f64,
    pub captured_at: i64,
    pub is_current: bool,
}
#[derive(Clone, Default, Serialize)]
pub struct Snapshot {
    pub sessions: Vec<Session>,
    pub errors: Vec<String>,
}
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
pub fn read() -> Result<Snapshot, String> {
    use windows::Win32::System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED};
    unsafe {
        RoInitialize(RO_INIT_MULTITHREADED).map_err(|e| e.to_string())?;
    }
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                RoUninitialize();
            }
        }
    }
    let _apartment = Apartment;

    let operation = Manager::RequestAsync().map_err(|e| e.to_string())?;
    let started = std::time::Instant::now();
    while operation.Status().map_err(|e| e.to_string())?.0 == 0 {
        if started.elapsed() > std::time::Duration::from_millis(2500) {
            let _ = operation.Cancel();
            return Err("Windows 媒体接口响应超时".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    let manager = operation.GetResults().map_err(|e| e.to_string())?;
    let current = manager.GetCurrentSession().ok();
    let sessions = manager.GetSessions().map_err(|e| e.to_string())?;
    let mut result = Snapshot::default();
    let mut counts = std::collections::HashMap::<String, usize>::new();
    for session in sessions.into_iter().take(12) {
        let value = (|| -> windows::core::Result<Session> {
            let app_id = session.SourceAppUserModelId()?.to_string();
            let ordinal = counts.entry(app_id.clone()).or_default();
            let id = format!("{}#{}", app_id, ordinal);
            *ordinal += 1;
            let operation = session.TryGetMediaPropertiesAsync()?;
            let started = std::time::Instant::now();
            while operation.Status()?.0 == 0 {
                if started.elapsed() > std::time::Duration::from_millis(2500) {
                    let _ = operation.Cancel();
                    return Err(windows::core::Error::new(
                        windows::core::HRESULT(0x800705B4u32 as i32),
                        "媒体信息读取超时",
                    ));
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            let props = operation.GetResults()?;
            let info = session.GetPlaybackInfo()?;
            let timeline = session.GetTimelineProperties()?;
            let now = now_ms();
            let status = info.PlaybackStatus()?;
            let playing = status == Status::Playing;
            let rate = info.PlaybackRate().and_then(|v| v.Value()).unwrap_or(1.0);
            let duration = (timeline.EndTime()?.Duration - timeline.StartTime()?.Duration) / 10_000;
            let raw = (timeline.Position()?.Duration - timeline.StartTime()?.Duration) / 10_000;
            let updated = timeline.LastUpdatedTime()?.UniversalTime / 10_000 - 11_644_473_600_000;
            let valid = duration > 0
                && duration <= 86_400_000
                && raw >= 0
                && raw <= duration + 2000
                && updated > 0
                && updated <= now + 5000;
            let pos = if valid {
                (raw + if playing {
                    ((now - updated).max(0) as f64 * rate) as i64
                } else {
                    0
                })
                .clamp(0, duration)
            } else {
                0
            };
            Ok(Session {
                id,
                app_id,
                title: props.Title()?.to_string().chars().take(250).collect(),
                artist: props.Artist()?.to_string().chars().take(250).collect(),
                album: props.AlbumTitle()?.to_string().chars().take(250).collect(),
                duration_ms: if duration > 0 && duration <= 86_400_000 {
                    duration
                } else {
                    0
                },
                position_ms: pos,
                paused: !playing,
                pause_known: playing || status == Status::Paused || status == Status::Stopped,
                timeline_available: valid,
                rate,
                captured_at: now,
                is_current: current.as_ref() == Some(&session),
            })
        })();
        match value {
            Ok(value) => result.sessions.push(value),
            Err(e) => result.errors.push(e.to_string()),
        }
    }
    Ok(result)
}
