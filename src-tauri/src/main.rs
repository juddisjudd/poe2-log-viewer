#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::Serialize;
use std::{
    fs::File,
    io::{BufRead, BufReader, Seek, SeekFrom},
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
};
use tauri::{Manager, State};

#[derive(Clone, Serialize, Debug)]
struct LogEvent {
    timestamp: String,
    category: String,
    message: String,
    raw: String,
}

#[derive(Default)]
struct AppState {
    current_file: Option<PathBuf>,
    is_watching: bool,
    processed_entries: std::collections::HashSet<u64>,
}

type SafeAppState = Arc<Mutex<AppState>>;

#[tauri::command]
async fn start_watching(
    path: String,
    app_handle: tauri::AppHandle,
    state: State<'_, SafeAppState>,
) -> Result<String, String> {
    let log_path = PathBuf::from(&path);
    println!("Attempting to watch file: {}", path);

    if !log_path.exists() {
        return Err("Log file does not exist".to_string());
    }

    {
        let mut app_state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        app_state.current_file = Some(log_path.clone());
        app_state.is_watching = true;
        app_state.processed_entries.clear();
    }

    match read_existing_logs(&log_path, state.inner().clone()) {
        Ok(existing_logs) => {
            println!("Found {} existing log entries", existing_logs.len());
            for log in existing_logs {
                if let Err(e) = app_handle.emit_all("log_event", &log) {
                    eprintln!("Failed to emit existing log: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to read existing logs: {}", e);
        }
    }

    let app_handle_clone = app_handle.clone();
    let state_clone = state.inner().clone();

    tokio::spawn(async move {
        if let Err(e) = watch_log_file(log_path, app_handle_clone, state_clone).await {
            eprintln!("Error watching file: {}", e);
        }
    });

    Ok("Started watching log file".to_string())
}

#[tauri::command]
async fn stop_watching(state: State<'_, SafeAppState>) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
    app_state.is_watching = false;
    app_state.current_file = None;
    app_state.processed_entries.clear();
    Ok("Stopped watching log file".to_string())
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    if let Err(e) = open::that(&url) {
        return Err(format!("Failed to open URL: {}", e));
    }
    Ok(())
}

fn read_existing_logs(log_path: &PathBuf, state: SafeAppState) -> Result<Vec<LogEvent>, Box<dyn std::error::Error>> {
    let mut log_entries = Vec::new();
    let mut current_entry_lines = Vec::new();

    let contents = std::fs::read_to_string(log_path)?;

    for line in contents.lines() {
        let trimmed = line.trim();
        
        if trimmed.is_empty() {
            continue;
        }

        if is_timestamp_line(&trimmed) {
            if !current_entry_lines.is_empty() {
                if let Some(entry) = process_log_entry(&current_entry_lines, &state) {
                    log_entries.push(entry);
                }
                current_entry_lines.clear();
            }
            current_entry_lines.push(trimmed.to_string());
        } else {
            if !current_entry_lines.is_empty() {
                current_entry_lines.push(trimmed.to_string());
            }
        }
    }

    if !current_entry_lines.is_empty() {
        if let Some(entry) = process_log_entry(&current_entry_lines, &state) {
            log_entries.push(entry);
        }
    }

    println!("Parsed {} log entries from existing file", log_entries.len());
    Ok(log_entries)
}

async fn watch_log_file(
    log_path: PathBuf,
    app_handle: tauri::AppHandle,
    state: SafeAppState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut file = File::open(&log_path)?;
    
    file.seek(SeekFrom::End(0))?;
    
    let mut reader = BufReader::new(file);
    println!("Started watching for new log entries...");

    let mut current_entry_lines = Vec::new();

    loop {
        {
            let app_state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
            if !app_state.is_watching {
                break;
            }
        }

        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => {
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if is_timestamp_line(&trimmed) {
                    if !current_entry_lines.is_empty() {
                        if let Some(entry) = process_log_entry(&current_entry_lines, &state) {
                            if let Err(e) = app_handle.emit_all("log_event", &entry) {
                                eprintln!("Failed to emit log event: {}", e);
                            }
                        }
                        current_entry_lines.clear();
                    }
                    current_entry_lines.push(trimmed.to_string());
                } else {
                    if !current_entry_lines.is_empty() {
                        current_entry_lines.push(trimmed.to_string());
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading log file: {}", e);
                break;
            }
        }
    }

    Ok(())
}

fn is_timestamp_line(line: &str) -> bool {
    line.len() >= 19
        && line.chars().nth(4) == Some('/')
        && line.chars().nth(7) == Some('/')
        && line.chars().nth(10) == Some(' ')
}

fn process_log_entry(lines: &[String], state: &SafeAppState) -> Option<LogEvent> {
    if lines.is_empty() {
        return None;
    }

    let first_line = &lines[0];
    let full_message = lines.join("\n");

    let entry_hash = calculate_entry_hash(&full_message);

    println!("Processing entry hash: {}, first line: {}", entry_hash, first_line);

    {
        let mut app_state = state.lock().ok()?;
        if app_state.processed_entries.contains(&entry_hash) {
            println!("Duplicate detected for hash: {}", entry_hash);
            return None;
        }
        app_state.processed_entries.insert(entry_hash);
        println!("Added new entry hash: {}, total tracked: {}", entry_hash, app_state.processed_entries.len());
    }

    let timestamp = if first_line.len() >= 19 {
        first_line.chars().take(19).collect()
    } else {
        String::new()
    };

    let category = categorize_log_entry(&full_message, first_line);

    Some(LogEvent {
        timestamp,
        category,
        message: full_message.clone(),
        raw: full_message,
    })
}

fn calculate_entry_hash(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

fn categorize_log_entry(full_message: &str, first_line: &str) -> String {
    if first_line.contains("[WARN Client") {
        return "Warnings".to_string();
    }
    if first_line.contains("[DEBUG Client") {
        if full_message.contains("Joined guild") || full_message.contains("guild named") {
            return "Guild".to_string();
        }
        return "Debug".to_string();
    }
    if first_line.contains("[CRIT Client") || first_line.contains("[ERROR Client") {
        return "Warnings".to_string();
    }

    if first_line.contains("[INFO Client") {
        if full_message.contains("has been slain") || full_message.contains("HomeDepotThemeSong has been slain") {
            return "Death".to_string();
        }
        if full_message.contains("is now level") {
            return "Level Up".to_string();
        }
        if full_message.contains("Successfully allocated passive skill") {
            return "Skill".to_string();
        }
        if full_message.contains("Trade accepted") {
            return "Trade".to_string();
        }
        if full_message.contains("Joined guild") || full_message.contains("guild named") {
            return "Guild".to_string();
        }

        if full_message.contains(": ") && (
            full_message.contains("Wounded Man:") ||
            full_message.contains("Clearfell Guard:") ||
            full_message.contains("The Bloated Miller:") ||
            full_message.contains("Una:") ||
            full_message.contains("Beira of the Rotten Pack:")
        ) {
            return "Dialogue".to_string();
        }

        if full_message.contains("[HTTP2]") || 
           full_message.contains("User agent:") ||
           full_message.contains("Using backend:") ||
           full_message.contains("Send patching protocol") ||
           full_message.contains("Web root:") ||
           full_message.contains("Backup Web root:") ||
           full_message.contains("Requesting root contents") ||
           full_message.contains("Queue file to download") || 
           full_message.contains("Got file list") ||
           full_message.contains("Requesting folder") || 
           full_message.contains(".datc64.bundle.bin") ||
           full_message.contains("Connecting to") || 
           full_message.contains("Connected to") ||
           full_message.contains("Got Instance Details") || 
           full_message.contains("Connect time to instance") ||
           full_message.contains("patch-poe") ||
           full_message.contains("poecdn.com") {
            return "Network".to_string();
        }

        if full_message.contains("[SHADER]") || full_message.contains("[TEXTURE]") ||
           full_message.contains("[RENDER]") || full_message.contains("[VULKAN]") ||
           full_message.contains("[SCENE]") || full_message.contains("Shader uses incorrect vertex layout") ||
           full_message.contains("Signature:") || full_message.contains("Metadata/") ||
           full_message.contains(".fxgraph") || full_message.contains("EngineGraphs") {
            return "Graphics".to_string();
        }

        if full_message.contains("[ENTITY]") || full_message.contains("[ENGINE]") ||
           full_message.contains("[JOB]") || full_message.contains("[STORAGE]") ||
           full_message.contains("[BUNDLE]") || full_message.contains("[WINDOW]") ||
           full_message.contains("Client-Safe Instance ID") || full_message.contains("Generating level") {
            return "Engine".to_string();
        }

        if full_message.contains("[SOUND]") || full_message.contains("[AUDIO]") {
            return "Audio".to_string();
        }

        if full_message.contains("[Item Filter]") {
            return "Item Filter".to_string();
        }

        return "System".to_string();
    }

    if full_message.contains("Signature:") || full_message.contains("Metadata/") || full_message.contains(".fxgraph") {
        return "Graphics".to_string();
    }

    if full_message.contains("Joined guild") || full_message.contains("guild named") {
        return "Guild".to_string();
    }

    if full_message.contains("[HTTP2]") || 
       full_message.contains("User agent:") ||
       full_message.contains("Using backend:") ||
       full_message.contains("Send patching protocol") ||
       full_message.contains("Web root:") ||
       full_message.contains("Backup Web root:") ||
       full_message.contains("Requesting root contents") ||
       full_message.contains("patch-poe") ||
       full_message.contains("poecdn.com") {
        return "Network".to_string();
    }

    "System".to_string()
}

fn main() {
    tauri::Builder::default()
        .manage(SafeAppState::default())
        .invoke_handler(tauri::generate_handler![start_watching, stop_watching, open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}