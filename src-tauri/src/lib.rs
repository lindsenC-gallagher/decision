mod commands;
mod settings;
mod state;
mod watcher;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::load_session,
            commands::save_session,
            commands::pick_decisions_dir,
            commands::get_decisions_dir,
            commands::set_decisions_dir,
            commands::start_watching,
            commands::stop_watching,
            commands::import_image,
        ])
        .setup(|app| {
            // Load persisted preference, fall back to $HOME/decisions.
            let persisted = settings::load(&app.handle()).decisions_dir;
            let chosen = persisted
                .map(std::path::PathBuf::from)
                .or_else(|| dirs::home_dir().map(|d| d.join("decisions")))
                .unwrap_or_else(|| std::path::PathBuf::from("./decisions"));
            let state: tauri::State<state::AppState> = app.state();
            *state.decisions_dir.lock() = chosen;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
