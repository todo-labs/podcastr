mod exa;
mod openai;
mod utils;

use std::fs;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Pre-create the media output directories on first launch so that
            // the audio and image generation commands can write files immediately
            // without needing to check for directory existence on every call.
            let app_data_dir = app.path().app_local_data_dir()?;
            fs::create_dir_all(app_data_dir.join("generated-audio"))?;
            fs::create_dir_all(app_data_dir.join("generated-images"))?;
            Ok(())
        })
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            exa::search_episode_research,
            openai::generate_podcast_script,
            openai::generate_podcast_voice,
            openai::generate_episode_graphic
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
