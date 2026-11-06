#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod backend;
mod media;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, State,
};
struct StateData {
    pinned: AtomicBool,
    backend: backend::Shared,
    stopping: AtomicBool,
}
#[tauri::command]
async fn api(
    state: State<'_, StateData>,
    path: String,
    data: Option<Value>,
) -> Result<Value, String> {
    let backend = state.backend.clone();
    tauri::async_runtime::spawn_blocking(move || {
        backend::route(&backend, &path, data.unwrap_or(Value::Null))
    })
    .await
    .map_err(|e| e.to_string())?
}
fn show_settings(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    } else {
        tauri::WebviewWindowBuilder::new(
            app,
            "settings",
            tauri::WebviewUrl::App("settings.html".into()),
        )
        .title("Snowline Lyrics · 设置")
        .inner_size(960.0, 780.0)
        .min_inner_size(720.0, 550.0)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn save_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("board") {
        if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
            let state = app.state::<StateData>();
            let b = state.backend.lock().unwrap();
            let data = json!({"boardLayoutVersion":2,"pinned":state.pinned.load(Ordering::Relaxed),"bounds":{"x":pos.x,"y":pos.y,"width":size.width,"height":size.height}});
            let _ = std::fs::write(b.dir.join("window.json"), data.to_string());
        }
    }
}
#[tauri::command]
async fn board_action(app: tauri::AppHandle, name: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || perform_action(app, name))
        .await
        .map_err(|e| e.to_string())?
}
fn perform_action(app: tauri::AppHandle, name: String) -> Result<bool, String> {
    let state = app.state::<StateData>();
    let board = app.get_webview_window("board").ok_or("Missing board")?;
    match name.as_str() {
        "show" => {
            board.show().map_err(|e| e.to_string())?;
            board.set_focus().map_err(|e| e.to_string())?;
        }
        "hide" => board.hide().map_err(|e| e.to_string())?,
        "settings" => {
            show_settings(&app)?;
        }
        "close-settings" => {
            if let Some(w) = app.get_webview_window("settings") {
                w.close().map_err(|e| e.to_string())?;
            }
        }
        "pin" => {
            let pinned = !state.pinned.load(Ordering::Relaxed);
            board.set_always_on_top(pinned).map_err(|e| e.to_string())?;
            state.pinned.store(pinned, Ordering::Relaxed);
            save_window(&app);
        }
        "quit-test" if backend::fixture() => {
            app.exit(0);
        }
        "state" => {}
        _ => return Err("Unknown action".into()),
    }
    Ok(state.pinned.load(Ordering::Relaxed))
}
fn main() {
    if std::env::args().any(|a| a == "--network-check") {
        if let Err(e) = backend::network_check() {
            eprintln!("{}", e);
            std::process::exit(1);
        }
        return;
    }
    if std::env::args().any(|a| a == "--media-check") {
        match media::read() {
            Ok(v) => println!(
                "Native media check: {} sessions, {} errors",
                v.sessions.len(),
                v.errors.len()
            ),
            Err(e) => {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
        return;
    }
    let data_dir = std::env::var_os("SNOWLINE_RUST_TEST_DATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            std::path::PathBuf::from(std::env::var_os("APPDATA").unwrap())
                .join("SnowlineLyricsRust")
        });
    let _ = std::fs::create_dir_all(&data_dir);
    // A read-only copy from the old profile gives the Rust edition an independent rollback path.
    if !data_dir.join("migration-v1.json").exists()
        && std::env::var_os("SNOWLINE_RUST_TEST_DATA").is_none()
    {
        let old =
            std::path::PathBuf::from(std::env::var_os("APPDATA").unwrap()).join("SnowlineLyrics");
        for file in [
            "appearance.json",
            "settings.json",
            "library.json",
            "window.json",
        ] {
            let target = data_dir.join(file);
            if !target.exists() && old.join(file).is_file() {
                let _ = std::fs::copy(old.join(file), target);
            }
        }
        let _ = std::fs::write(
            data_dir.join("migration-v1.json"),
            "{\"source\":\"SnowlineLyrics\",\"readOnlyCopy\":true}",
        );
    }
    use std::os::windows::fs::OpenOptionsExt;
    let _instance = match std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .share_mode(0)
        .open(data_dir.join("instance.lock"))
    {
        Ok(f) => f,
        Err(_) => return,
    };
    let prefs: Value = std::fs::read(data_dir.join("window.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(json!({}));
    let pinned = prefs["pinned"].as_bool().unwrap_or(true);
    let backend = Arc::new(Mutex::new(backend::Backend::new(data_dir)));
    tauri::Builder::default()
        .manage(StateData {
            pinned: AtomicBool::new(pinned),
            backend: backend.clone(),
            stopping: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![api, board_action])
        .setup(move |app| {
            let board = app.get_webview_window("board").unwrap();
            let _ = board.set_always_on_top(pinned);
            if let (Some(x), Some(y), Some(width), Some(height)) = (
                prefs["bounds"]["x"].as_i64(),
                prefs["bounds"]["y"].as_i64(),
                prefs["bounds"]["width"].as_u64(),
                prefs["bounds"]["height"].as_u64(),
            ) {
                if (400..=3200).contains(&width)
                    && (160..=1800).contains(&height)
                    && board.available_monitors()?.iter().any(|m| {
                        let p = m.position();
                        let s = m.size();
                        x + 80 > p.x as i64
                            && x < p.x as i64 + s.width as i64 - 80
                            && y + 40 > p.y as i64
                            && y < p.y as i64 + s.height as i64 - 40
                    })
                {
                    let _ = board.set_size(tauri::PhysicalSize::new(width as u32, height as u32));
                    let _ = board.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                }
            }
            // Repair cramped legacy default heights once, without replacing larger custom layouts.
            if prefs["boardLayoutVersion"].as_u64().unwrap_or(0) < 2 {
                let scale = board.scale_factor().unwrap_or(1.0);
                if let Ok(size) = board.inner_size() {
                    if size.height as f64 / scale < 260.0 {
                        let _ = board.set_size(tauri::LogicalSize::new(600.0, 310.0));
                    }
                }
            }
            let _ = board.show();
            let show = MenuItem::with_id(app, "show", "显示歌词板", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &quit])?;
            let mut rgba = vec![0u8; 32 * 32 * 4];
            for pixel in rgba.chunks_exact_mut(4) {
                pixel.copy_from_slice(&[110, 200, 170, 255]);
            }
            TrayIconBuilder::new()
                .icon(tauri::image::Image::new_owned(rgba, 32, 32))
                .tooltip("Snowline Lyrics")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        save_window(app);
                        app.state::<StateData>()
                            .stopping
                            .store(true, Ordering::Relaxed);
                        app.exit(0)
                    }
                    "show" => {
                        if let Some(w) = app.get_webview_window("board") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "settings" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            let _ = show_settings(&app);
                        });
                    }
                    _ => {}
                })
                .build(app)?;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while !handle.state::<StateData>().stopping.load(Ordering::Relaxed) {
                    if backend::fixture() {
                        let mut b = backend.lock().unwrap();
                        if !b.playback.is_null() {
                            let mut p = b.playback.clone();
                            if p["timelineAvailable"].as_bool() == Some(true) {
                                p["positionMs"] = json!(backend::position(&p, media::now_ms()));
                            }
                            p["capturedAt"] = json!(media::now_ms());
                            b.ingest(p);
                        }
                    } else {
                        backend::apply_media(&backend, media::read());
                        let _ = backend::start_search(&backend, false);
                    }
                    std::thread::sleep(std::time::Duration::from_millis(750));
                }
            });
            Ok(())
        })
        .on_window_event(|w, e| match e {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if w.label() == "board" {
                    api.prevent_close();
                    let _ = w.hide();
                }
            }
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                if w.label() == "board" {
                    save_window(w.app_handle());
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("Unable to start Snowline Lyrics");
}
