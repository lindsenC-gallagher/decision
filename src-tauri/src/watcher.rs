use crate::state::AppState;
use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// A handle to the active watcher; dropping it stops watching.
pub struct WatcherHandle {
    _debouncer: notify_debouncer_full::Debouncer<
        notify::RecommendedWatcher,
        notify_debouncer_full::FileIdMap,
    >,
}

fn hash(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex::encode(h.finalize())
}

/// Spawn a watcher over `dir`. Emits `decisions://changed { path: string }` events
/// whenever a markdown file inside the folder changes, *unless* the file's
/// current content hash matches a recent self-write (set in commands::save_session).
pub fn watch(dir: PathBuf, app: AppHandle) -> Result<WatcherHandle, notify::Error> {
    let mut debouncer = new_debouncer(
        Duration::from_millis(120),
        None,
        move |result: DebounceEventResult| {
            let Ok(events) = result else {
                return;
            };
            for ev in events {
                for path in &ev.paths {
                    if path.extension().and_then(|s| s.to_str()) != Some("md") {
                        continue;
                    }
                    // Echo suppression: if this file's current content matches a hash
                    // we wrote ourselves, drop the event and consume the marker.
                    if let Ok(content) = std::fs::read_to_string(path) {
                        let h = hash(&content);
                        let state = app.state::<AppState>();
                        let mut sw = state.self_writes.lock();
                        if sw.remove(&h) {
                            continue;
                        }
                    }
                    let _ = app.emit("decisions://changed", path.to_string_lossy().to_string());
                }
            }
        },
    )?;

    debouncer.watch(&dir, RecursiveMode::NonRecursive)?;

    Ok(WatcherHandle {
        _debouncer: debouncer,
    })
}
