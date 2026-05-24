// Tauri commands invoked from the React renderer via `invoke()`.
// These are the canonical seams between the UI and the filesystem.

use crate::state::AppState;
use crate::watcher;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

#[derive(thiserror::Error, Debug)]
pub enum CmdError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("notify error: {0}")]
    Notify(#[from] notify::Error),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("conflict: file changed externally")]
    BaseHashMismatch,
}

impl serde::Serialize for CmdError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Serialize)]
pub struct SessionListEntry {
    pub slug: String,
    pub path: String,
    pub modified: Option<u64>,
}

#[derive(Serialize)]
pub struct LoadedSession {
    pub slug: String,
    pub path: String,
    pub raw_markdown: String,
    pub content_hash: String,
}

#[derive(Deserialize)]
pub struct SaveRequest {
    pub slug: String,
    pub raw_markdown: String,
    pub base_hash: String,
}

fn hash(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex::encode(h.finalize())
}

fn slug_to_path(dir: &Path, slug: &str) -> PathBuf {
    dir.join(format!("{slug}.md"))
}

#[tauri::command]
pub fn list_sessions(state: State<AppState>) -> Result<Vec<SessionListEntry>, CmdError> {
    let dir = state.decisions_dir.lock().clone();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let slug = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| CmdError::InvalidPath(path.display().to_string()))?
            .to_string();
        let modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());
        out.push(SessionListEntry {
            slug,
            path: path.to_string_lossy().to_string(),
            modified,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn load_session(slug: String, state: State<AppState>) -> Result<LoadedSession, CmdError> {
    let dir = state.decisions_dir.lock().clone();
    let path = slug_to_path(&dir, &slug);
    let raw = fs::read_to_string(&path)?;
    let content_hash = hash(&raw);
    Ok(LoadedSession {
        slug,
        path: path.to_string_lossy().to_string(),
        raw_markdown: raw,
        content_hash,
    })
}

#[tauri::command]
pub fn save_session(req: SaveRequest, state: State<AppState>) -> Result<LoadedSession, CmdError> {
    let dir = state.decisions_dir.lock().clone();
    let path = slug_to_path(&dir, &req.slug);

    // Optimistic concurrency: compare the on-disk hash against the client's base_hash.
    if path.exists() {
        let current = fs::read_to_string(&path)?;
        let current_hash = hash(&current);
        if current_hash != req.base_hash {
            return Err(CmdError::BaseHashMismatch);
        }
    }

    // Echo suppression: stash the hash we're about to write so the watcher can drop its event.
    let new_hash = hash(&req.raw_markdown);
    state.self_writes.lock().insert(new_hash.clone());

    // Atomic write: tmp + rename.
    let tmp_path = path.with_extension("md.tmp");
    fs::write(&tmp_path, &req.raw_markdown)?;
    fs::rename(&tmp_path, &path)?;

    Ok(LoadedSession {
        slug: req.slug,
        path: path.to_string_lossy().to_string(),
        raw_markdown: req.raw_markdown,
        content_hash: new_hash,
    })
}

#[tauri::command]
pub async fn pick_decisions_dir(app: AppHandle) -> Result<Option<String>, CmdError> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
pub fn get_decisions_dir(state: State<AppState>) -> Result<String, CmdError> {
    Ok(state.decisions_dir.lock().to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_decisions_dir(
    app: AppHandle,
    path: String,
    state: State<AppState>,
) -> Result<(), CmdError> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        fs::create_dir_all(&p)?;
    }
    *state.decisions_dir.lock() = p.clone();
    // Drop any existing watcher; the caller can re-start with the new dir.
    *state.watcher.lock() = None;
    // Persist choice across launches.
    let _ = crate::settings::save_decisions_dir(&app, &p);
    Ok(())
}

#[tauri::command]
pub fn import_image(
    slug: String,
    source_path: String,
    state: State<AppState>,
) -> Result<String, CmdError> {
    let dir = state.decisions_dir.lock().clone();
    let images_dir = dir.join("images").join(&slug);
    if !images_dir.exists() {
        fs::create_dir_all(&images_dir)?;
    }
    let source = PathBuf::from(&source_path);
    let file_name = source
        .file_name()
        .ok_or_else(|| CmdError::InvalidPath(source_path.clone()))?;
    let mut dest = images_dir.join(file_name);
    // If a file with the same name already exists, suffix with a short hash.
    if dest.exists() {
        let stem = source.file_stem().and_then(|s| s.to_str()).unwrap_or("img");
        let ext = source.extension().and_then(|s| s.to_str()).unwrap_or("");
        let suffix = &hash(&source_path)[..8];
        let new_name = if ext.is_empty() {
            format!("{stem}-{suffix}")
        } else {
            format!("{stem}-{suffix}.{ext}")
        };
        dest = images_dir.join(new_name);
    }
    fs::copy(&source, &dest)?;
    // Return a relative path the renderer can embed in markdown.
    let rel = format!(
        "./images/{}/{}",
        slug,
        dest.file_name().unwrap().to_string_lossy()
    );
    Ok(rel)
}

#[tauri::command]
pub fn start_watching(app: AppHandle, state: State<AppState>) -> Result<(), CmdError> {
    let dir = state.decisions_dir.lock().clone();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    let handle = watcher::watch(dir, app)?;
    *state.watcher.lock() = Some(handle);
    Ok(())
}

#[tauri::command]
pub fn stop_watching(state: State<AppState>) -> Result<(), CmdError> {
    *state.watcher.lock() = None;
    Ok(())
}
