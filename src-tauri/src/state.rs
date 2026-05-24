use parking_lot::Mutex;
use std::collections::HashSet;
use std::path::PathBuf;

/// Process-wide state: the current decisions folder, and a set of content-hashes
/// the app wrote itself (used to suppress chokidar-style echo events).
#[derive(Default)]
pub struct AppState {
    pub decisions_dir: Mutex<PathBuf>,
    pub self_writes: Mutex<HashSet<String>>,
    pub watcher: Mutex<Option<crate::watcher::WatcherHandle>>,
}
