// Minimal persistence of user preferences (currently: chosen decisions folder).
// Stored as JSON at $APPCONFIG/decision/settings.json.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Default, Serialize, Deserialize)]
pub struct Settings {
    pub decisions_dir: Option<String>,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, std::io::Error> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::NotFound, "config dir"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("settings.json"))
}

pub fn load(app: &AppHandle) -> Settings {
    let path = match settings_path(app) {
        Ok(p) => p,
        Err(_) => return Settings::default(),
    };
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Settings::default(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save_decisions_dir(app: &AppHandle, dir: &Path) -> Result<(), std::io::Error> {
    let path = settings_path(app)?;
    let mut current = load(app);
    current.decisions_dir = Some(dir.to_string_lossy().to_string());
    let json = serde_json::to_string_pretty(&current)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    fs::write(&path, json)?;
    Ok(())
}
