#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod media;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, State,
};
struct StateData {
    pinned: AtomicBool,
}
#[tauri::command]
async fn media_snapshot() -> Result<media::Snapshot, String> {
    tauri::async_runtime::spawn_blocking(media::read)
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
fn board_action(
    app: tauri::AppHandle,
    state: State<StateData>,
    name: String,
) -> Result<bool, String> {
    let board = app.get_webview_window("board").ok_or("Missing board")?;
    match name.as_str() {
        "show" => {
            board.show().map_err(|e| e.to_string())?;
            board.set_focus().map_err(|e| e.to_string())?;
        }
        "hide" => board.hide().map_err(|e| e.to_string())?,
        "settings" => {
            let w = app
                .get_webview_window("settings")
                .ok_or("Missing settings")?;
            w.show().map_err(|e| e.to_string())?;
            w.set_focus().map_err(|e| e.to_string())?;
        }
        "pin" => {
            let pinned = !state.pinned.load(Ordering::Relaxed);
            board.set_always_on_top(pinned).map_err(|e| e.to_string())?;
            state.pinned.store(pinned, Ordering::Relaxed);
        }
        "state" => {}
        _ => return Err("Unknown action".into()),
    }
    Ok(state.pinned.load(Ordering::Relaxed))
}
fn main() {
    if std::env::args().any(|a| a == "--media-check") {
        match media::read() {
            Ok(value) => println!(
                "Native media check: {} sessions, {} errors",
                value.sessions.len(),
                value.errors.len()
            ),
            Err(e) => {
                eprintln!("Media check failed: {}", e);
                std::process::exit(1);
            }
        }
        return;
    }

    tauri::Builder::default()
        .manage(StateData {
            pinned: AtomicBool::new(true),
        })
        .invoke_handler(tauri::generate_handler![media_snapshot, board_action])
        .setup(|app| {
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
                .tooltip("Snowline Rust Preview")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("board") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "settings" => {
                        if let Some(w) = app.get_webview_window("settings") {
                            let _ = w.show();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Unable to start Snowline Rust Preview");
}
