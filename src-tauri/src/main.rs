#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod log_categorizer;

use log_categorizer::LogCategorizer;
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
use tauri::{Emitter, State};

#[derive(Clone, Serialize, Debug)]
struct LogEvent {
    timestamp: String,
    category: String,
    message: String,
    raw: String,
    // Optional extracted fields for enhanced display
    #[serde(skip_serializing_if = "Option::is_none")]
    player_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    character_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    level: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chat_sender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chat_channel: Option<String>,
}

/// Extracts player name from death messages
/// Pattern: ": PlayerName has been slain."
fn extract_death_info(message: &str) -> Option<String> {
    // Look for the pattern after the log prefix
    let message_part = if let Some(bracket_pos) = message.rfind("] ") {
        &message[bracket_pos + 2..]
    } else {
        message
    };
    
    // Death messages start with ": " followed by player name
    if message_part.starts_with(": ") && message_part.contains(" has been slain") {
        let content = &message_part[2..]; // Skip ": "
        if let Some(end_pos) = content.find(" has been slain") {
            let player_name = &content[..end_pos];
            if !player_name.is_empty() && player_name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                return Some(player_name.to_string());
            }
        }
    }
    None
}

/// Extracts character info from level-up messages
/// Pattern: ": CharName (ClassName) is now level N"
/// Returns: (character_name, class_name, level_number)
fn extract_level_up_info(message: &str) -> Option<(String, String, u32)> {
    // Look for the pattern after the log prefix
    let message_part = if let Some(bracket_pos) = message.rfind("] ") {
        &message[bracket_pos + 2..]
    } else {
        message
    };
    
    // Level-up messages start with ": " followed by character info
    if message_part.starts_with(": ") && message_part.contains(" is now level ") {
        let content = &message_part[2..]; // Skip ": "
        
        // Find character name (before the parenthesis)
        if let Some(paren_start) = content.find(" (") {
            let char_name = &content[..paren_start];
            
            // Find class name (inside parentheses)
            if let Some(paren_end) = content.find(") is now level ") {
                let class_name = &content[paren_start + 2..paren_end];
                
                // Find level number
                let level_start = paren_end + ") is now level ".len();
                let level_str: String = content[level_start..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect();
                
                if let Ok(level) = level_str.parse::<u32>() {
                    if !char_name.is_empty() && !class_name.is_empty() {
                        return Some((char_name.to_string(), class_name.to_string(), level));
                    }
                }
            }
        }
    }
    None
}

/// Extracts sender name and channel from chat messages
/// Patterns: 
///   "$SenderName: message" -> ("SenderName", "global")
///   "#SenderName: message" -> ("SenderName", "local")  
///   "&SenderName: message" -> ("SenderName", "guild")
///   "&: SYSTEM_MESSAGE" -> (None, "guild_system")
/// Returns: (sender_name, channel_type)
fn extract_chat_info(message: &str) -> Option<(Option<String>, String)> {
    // Look for the message part after the log prefix
    let message_part = if let Some(bracket_pos) = message.rfind("] ") {
        &message[bracket_pos + 2..]
    } else {
        message
    };
    
    // Check for @From whispers
    if message.contains("@From ") {
        // Pattern: "@From SenderName: message"
        if let Some(from_pos) = message.find("@From ") {
            let after_from = &message[from_pos + 6..];
            if let Some(colon_pos) = after_from.find(':') {
                let sender = &after_from[..colon_pos];
                if !sender.is_empty() {
                    return Some((Some(sender.to_string()), "whisper".to_string()));
                }
            }
        }
        return Some((None, "whisper".to_string()));
    }
    
    // Trade actions
    if message.contains("Trade accepted") || message.contains("Trade cancelled") {
        return Some((None, "trade".to_string()));
    }
    
    // Guild system messages: "&: MESSAGE"
    if message_part.starts_with("&: ") {
        return Some((None, "guild_system".to_string()));
    }
    
    // Global chat: "$SenderName: message"
    if message_part.starts_with('$') {
        if let Some(colon_pos) = message_part.find(": ") {
            let sender = &message_part[1..colon_pos];
            if !sender.is_empty() {
                return Some((Some(sender.to_string()), "global".to_string()));
            }
        }
    }
    
    // Local chat: "#SenderName: message"
    if message_part.starts_with('#') {
        if let Some(colon_pos) = message_part.find(": ") {
            let sender = &message_part[1..colon_pos];
            if !sender.is_empty() {
                return Some((Some(sender.to_string()), "local".to_string()));
            }
        }
    }
    
    // Guild chat: "&SenderName: message"
    if message_part.starts_with('&') && !message_part.starts_with("&: ") {
        if let Some(colon_pos) = message_part.find(": ") {
            let sender = &message_part[1..colon_pos];
            if !sender.is_empty() {
                return Some((Some(sender.to_string()), "guild".to_string()));
            }
        }
    }
    
    None
}

#[derive(Default)]
struct AppState {
    current_file: Option<PathBuf>,
    is_watching: bool,
    processed_entries: std::collections::HashSet<u64>,
    categorizer: Option<LogCategorizer>,
}

type SafeAppState = Arc<Mutex<AppState>>;

#[tauri::command]
async fn start_watching(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, SafeAppState>,
) -> Result<String, String> {
    let log_path = PathBuf::from(&path);
    println!("Attempting to watch file: {}", path);

    if !log_path.exists() {
        return Err("Log file does not exist".to_string());
    }

    {
        let mut app_state = state
            .lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?;
        app_state.current_file = Some(log_path.clone());
        app_state.is_watching = true;
        app_state.processed_entries.clear();
        
        if app_state.categorizer.is_none() {
            app_state.categorizer = Some(LogCategorizer::new());
        }
    }

    match read_existing_logs(&log_path, state.inner().clone()) {
        Ok(existing_logs) => {
            println!("Found {} existing log entries", existing_logs.len());
            for log in existing_logs {
                if let Err(e) = app.emit("log_event", &log) {
                    eprintln!("Failed to emit existing log: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to read existing logs: {}", e);
        }
    }

    let app_clone = app.clone();
    let state_clone = state.inner().clone();

    tokio::spawn(async move {
        if let Err(e) = watch_log_file(log_path, app_clone, state_clone).await {
            eprintln!("Error watching file: {}", e);
        }
    });

    Ok("Started watching log file".to_string())
}

#[tauri::command]
async fn stop_watching(state: State<'_, SafeAppState>) -> Result<String, String> {
    let mut app_state = state
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
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

fn read_existing_logs(
    log_path: &PathBuf,
    state: SafeAppState,
) -> Result<Vec<LogEvent>, Box<dyn std::error::Error>> {
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
    app: tauri::AppHandle,
    state: SafeAppState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut file = File::open(&log_path)?;

    file.seek(SeekFrom::End(0))?;
    let mut reader = BufReader::new(file);

    println!("Started watching for new log entries...");

    let mut current_entry_lines = Vec::new();

    loop {
        {
            let app_state = state
                .lock()
                .map_err(|e| format!("Failed to lock state: {}", e))?;
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
                            if let Err(e) = app.emit("log_event", &entry) {
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

    {
        let mut app_state = state.lock().ok()?;
        if app_state.processed_entries.contains(&entry_hash) {
            return None;
        }
        app_state.processed_entries.insert(entry_hash);

        let timestamp = if first_line.len() >= 19 {
            first_line.chars().take(19).collect()
        } else {
            String::new()
        };

        let category = if let Some(ref categorizer) = app_state.categorizer {
            categorizer.categorize(&full_message, first_line)
        } else {
            "System".to_string()
        };

        // Extract additional info based on category
        let mut player_name = None;
        let mut character_class = None;
        let mut level = None;
        let mut chat_sender = None;
        let mut chat_channel = None;

        match category.as_str() {
            "Death" => {
                player_name = extract_death_info(&full_message);
            }
            "Level Up" => {
                if let Some((name, class, lvl)) = extract_level_up_info(&full_message) {
                    player_name = Some(name);
                    character_class = Some(class);
                    level = Some(lvl);
                }
            }
            "Trade" | "Guild" => {
                if let Some((sender, channel)) = extract_chat_info(&full_message) {
                    chat_sender = sender;
                    chat_channel = Some(channel);
                }
            }
            _ => {}
        }

        Some(LogEvent {
            timestamp,
            category,
            message: full_message.clone(),
            raw: full_message,
            player_name,
            character_class,
            level,
            chat_sender,
            chat_channel,
        })
    }
}

fn calculate_entry_hash(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(SafeAppState::default())
        .invoke_handler(tauri::generate_handler![start_watching, stop_watching, open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}