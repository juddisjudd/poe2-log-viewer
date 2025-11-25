#[derive(Debug, Clone)]
pub struct LogCategory {
    pub name: String,
    pub priority: u8, // Lower number = higher priority
    pub patterns: CategoryPatterns,
}

#[derive(Debug, Clone)]
pub struct CategoryPatterns {
    pub required_contains: Vec<String>,
    pub any_contains: Vec<String>,
    pub excluded_contains: Vec<String>,
    pub custom_validator: Option<fn(&str) -> bool>,
}

impl CategoryPatterns {
    pub fn new() -> Self {
        Self {
            required_contains: Vec::new(),
            any_contains: Vec::new(),
            excluded_contains: Vec::new(),
            custom_validator: None,
        }
    }

    pub fn required(mut self, patterns: Vec<&str>) -> Self {
        self.required_contains = patterns.iter().map(|s| s.to_string()).collect();
        self
    }

    pub fn any_of(mut self, patterns: Vec<&str>) -> Self {
        self.any_contains = patterns.iter().map(|s| s.to_string()).collect();
        self
    }

    pub fn exclude(mut self, patterns: Vec<&str>) -> Self {
        self.excluded_contains = patterns.iter().map(|s| s.to_string()).collect();
        self
    }

    pub fn custom(mut self, validator: fn(&str) -> bool) -> Self {
        self.custom_validator = Some(validator);
        self
    }

    pub fn matches(&self, message: &str) -> bool {
        for exclude in &self.excluded_contains {
            if message.contains(exclude) {
                return false;
            }
        }

        for required in &self.required_contains {
            if !message.contains(required) {
                return false;
            }
        }

        if !self.any_contains.is_empty() {
            let found_any = self.any_contains.iter().any(|pattern| message.contains(pattern));
            if !found_any {
                return false;
            }
        }

        if let Some(validator) = self.custom_validator {
            if !validator(message) {
                return false;
            }
        }

        true
    }
}

pub struct LogCategorizer {
    categories: Vec<LogCategory>,
}

impl LogCategorizer {
    pub fn new() -> Self {
        Self {
            categories: Self::define_categories(),
        }
    }

    pub fn categorize(&self, full_message: &str, _first_line: &str) -> String {
        let mut sorted_categories = self.categories.clone();
        sorted_categories.sort_by_key(|cat| cat.priority);

        for category in sorted_categories {
            if category.patterns.matches(full_message) {
                return category.name;
            }
        }

        "Engine".to_string()
    }

    fn define_categories() -> Vec<LogCategory> {
        vec![
            // Priority 1: Warnings (highest priority - catch all warning levels)
            LogCategory {
                name: "Warnings".to_string(),
                priority: 1,
                patterns: CategoryPatterns::new()
                    .any_of(vec!["[WARN", "[CRIT", "[ERROR"]),
            },

            // Priority 2: Trade and chat messages
            LogCategory {
                name: "Trade".to_string(),
                priority: 2,
                patterns: CategoryPatterns::new()
                    .custom(is_trade_or_chat_message),
            },

            // Priority 3: Player actions
            LogCategory {
                name: "Death".to_string(),
                priority: 3,
                patterns: CategoryPatterns::new()
                    .required(vec!["has been slain"]),
            },

            LogCategory {
                name: "Level Up".to_string(),
                priority: 3,
                patterns: CategoryPatterns::new()
                    .required(vec!["is now level"]),
            },

            LogCategory {
                name: "Skill".to_string(),
                priority: 3,
                patterns: CategoryPatterns::new()
                    .any_of(vec!["have received", "Successfully allocated passive skill"]),
            },

            // Priority 4: Game mechanics and interactions
            LogCategory {
                name: "Gameplay".to_string(),
                priority: 4,
                patterns: CategoryPatterns::new()
                    .any_of(vec![
                        "Failed to apply item:",
                        "Item has no space for more Mods",
                        "Cannot use that item",
                        "You cannot",
                        "Not enough"
                    ]),
            },

            // Priority 5: Guild activities
            LogCategory {
                name: "Guild".to_string(),
                priority: 5,
                patterns: CategoryPatterns::new()
                    .any_of(vec!["Joined guild", "guild named", "&: GUILD UPDATE:", "GUILD UPDATE"]),
            },

            // Priority 6: System categories
            LogCategory {
                name: "Item Filter".to_string(),
                priority: 6,
                patterns: CategoryPatterns::new()
                    .required(vec!["[Item Filter]"]),
            },

            LogCategory {
                name: "Graphics".to_string(),
                priority: 6,
                patterns: CategoryPatterns::new()
                    .any_of(vec![
                        "[SHADER]", "[TEXTURE]", "[RENDER]", "[VULKAN]", "[SCENE]",
                        "Shader uses incorrect vertex layout", "Signature:",
                        "Metadata/", ".fxgraph", "EngineGraphs", "[MESH]", "[MAT]",
                        "[TRAILS]", "[GRAPH]", "[VIDEO]", "[PARTICLE]", "[STREAMLINE]"
                    ]),
            },

            LogCategory {
                name: "Engine".to_string(),
                priority: 6,
                patterns: CategoryPatterns::new()
                    .any_of(vec![
                        "[ENTITY]", "[ENGINE]", "[JOB]", "[STORAGE]", "[BUNDLE]",
                        "[WINDOW]", "Client-Safe Instance ID", "Generating level",
                        "[RESOURCE]"
                    ]),
            },

            LogCategory {
                name: "Audio".to_string(),
                priority: 6,
                patterns: CategoryPatterns::new()
                    .any_of(vec!["[SOUND]", "[AUDIO]"]),
            },

            LogCategory {
                name: "Network".to_string(),
                priority: 6,
                patterns: CategoryPatterns::new()
                    .any_of(vec![
                        "[HTTP2]", "User agent:", "Using backend:", "Send patching protocol",
                        "Web root:", "Backup Web root:", "Requesting root contents",
                        "Queue file to download", "Got file list", "Requesting folder",
                        ".datc64.bundle.bin", "Connecting to", "Connected to",
                        "Got Instance Details", "Connect time to instance",
                        "patch-poe", "poecdn.com", "Async connecting to",
                        "pathofexile2.com", "login.pathofexile2.com"
                    ]),
            },

            // Priority 7: Dialogue (after system exclusions)
            LogCategory {
                name: "Dialogue".to_string(),
                priority: 7,
                patterns: CategoryPatterns::new()
                    .required(vec![": "])
                    .exclude(vec![
                        "[SHADER]", "[TEXTURE]", "[RENDER]", "[VULKAN]", "[SCENE]",
                        "[ENTITY]", "[ENGINE]", "[JOB]", "[STORAGE]", "[BUNDLE]",
                        "[WINDOW]", "[SOUND]", "[AUDIO]", "[Item Filter]", "[HTTP2]",
                        "[MESH]", "[MAT]", "[TRAILS]", "[GRAPH]", "[VIDEO]",
                        "[PARTICLE]", "[RESOURCE]", "[STREAMLINE]", "@From ",
                        "User agent:", "Using backend:", "Web root:", "Queue :",
                        "family =", "Driver Version:", "Windows Version:", "OS:",
                        "Enabled:", "Result:", "Hash:", "count =", "flags =",
                        "#", "&: GUILD UPDATE:", "Trade accepted", "Trade cancelled",
                        "Failed to apply item", "[WARN", "[CRIT", "[ERROR"
                    ])
                    .custom(is_valid_npc_dialogue),
            },
        ]
    }
}

/// Chat channel types for categorization
#[derive(Debug, Clone, PartialEq)]
pub enum ChatChannel {
    Global,      // $ prefix - global/trade chat
    Local,       // # prefix - local/area chat  
    Guild,       // & prefix - guild player message
    GuildSystem, // &: prefix - guild system announcement
    Whisper,     // @From - whisper/trade interaction
    Trade,       // Trade accepted/cancelled
}

/// Detects if a message is a chat message and returns the channel type
fn detect_chat_channel(message: &str) -> Option<ChatChannel> {
    // Check for @From whispers
    if message.contains("@From ") {
        return Some(ChatChannel::Whisper);
    }
    
    // Check for trade actions
    if message.contains("Trade accepted") || message.contains("Trade cancelled") {
        return Some(ChatChannel::Trade);
    }
    
    // Extract the message part after the log prefix (after "] ")
    let message_part = if let Some(bracket_pos) = message.rfind("] ") {
        &message[bracket_pos + 2..]
    } else {
        message
    };
    
    // Check prefixes for different chat channels
    if message_part.starts_with("$") && message_part.contains(": ") {
        return Some(ChatChannel::Global);
    }
    
    if message_part.starts_with("#") && message_part.contains(": ") {
        return Some(ChatChannel::Local);
    }
    
    if message_part.starts_with("&: ") {
        return Some(ChatChannel::GuildSystem);
    }
    
    if message_part.starts_with("&") && message_part.contains(": ") {
        return Some(ChatChannel::Guild);
    }
    
    None
}

fn is_trade_or_chat_message(message: &str) -> bool {
    detect_chat_channel(message).is_some()
}

/// Validates if a speaker name looks like a legitimate character/NPC name
/// No hardcoded names - uses heuristic pattern detection
fn is_valid_speaker_name(name: &str) -> bool {
    let name = name.trim();
    
    // Must have content but not be too long
    if name.is_empty() || name.len() > 100 {
        return false;
    }
    
    // Must start with an uppercase letter (proper name)
    if !name.chars().next().map_or(false, |c| c.is_uppercase()) {
        return false;
    }
    
    // Must not be a system keyword or log level
    let forbidden_starts = [
        "Has", "Is", "Been", "Now", "Level", "Client", "Server", 
        "INFO", "DEBUG", "WARN", "ERROR", "CRIT",
        "Using", "User", "Web", "Queue", "Hash", "Driver",
        "Windows", "OS", "Enabled", "Result", "Connecting",
        "Connected", "Got", "Send", "Requesting", "Backup",
    ];
    
    if forbidden_starts.iter().any(|&kw| name.starts_with(kw)) {
        return false;
    }
    
    // Must not contain system indicators
    let forbidden_contains = [
        "Client", "Server", "INFO", "DEBUG", "WARN", "ERROR", "CRIT",
        "=", "[", "]", "{", "}", "<", ">", "//", "\\", ".exe", ".dll",
        "Version", "Build", "family", "count", "flags", "poecdn",
        "pathofexile", "http", "://", "0x",
    ];
    
    if forbidden_contains.iter().any(|&kw| name.contains(kw)) {
        return false;
    }
    
    // Only allow alphanumeric, spaces, commas, apostrophes, hyphens in names
    // Examples: "The Bloated Miller", "Siora, Blade of the Mists", "O'Brien"
    name.chars().all(|c| {
        c.is_alphanumeric() || c.is_whitespace() || 
        c == '\'' || c == '-' || c == ','
    })
}

/// Validates if text looks like legitimate dialogue content
fn is_valid_dialogue_text(text: &str) -> bool {
    let text = text.trim();
    
    // Must have meaningful content
    if text.is_empty() || text.len() < 3 {
        return false;
    }
    
    // Must not be wrapped in brackets (system tag)
    if text.starts_with('[') || text.starts_with('{') {
        return false;
    }
    
    // Must contain alphabetic characters (actual speech)
    let letter_count = text.chars().filter(|c| c.is_alphabetic()).count();
    if letter_count < 2 {
        return false;
    }
    
    // Must not contain obvious system patterns
    let forbidden = [
        "=", "ON", "OFF", "true", "false", "null", "NULL",
        "Version", "Build", "family", "count", "flags",
        "accepted", "cancelled", "Failed to apply",
        "INFO", "DEBUG", "WARN", "ERROR", "CRIT",
        "Client", "Server", ".dll", ".exe", "0x",
        "://", "poecdn", "pathofexile",
    ];
    
    if forbidden.iter().any(|&kw| text.contains(kw)) {
        return false;
    }
    
    true
}

/// Validates NPC dialogue using heuristic pattern detection
/// No hardcoded character/NPC names - dynamically detects dialogue patterns
fn is_valid_npc_dialogue(message: &str) -> bool {
    // Extract the message part after the log prefix
    let message_part = if let Some(bracket_pos) = message.rfind("] ") {
        &message[bracket_pos + 2..]
    } else {
        message
    };
    
    // Skip if it looks like a chat message (already handled by Trade category)
    if message_part.starts_with('$') || message_part.starts_with('#') || 
       message_part.starts_with('&') || message_part.starts_with('@') ||
       message_part.starts_with(':') {
        return false;
    }
    
    // Look for dialogue pattern: "SpeakerName: Dialogue text"
    if let Some(colon_pos) = message_part.find(": ") {
        let speaker = &message_part[..colon_pos];
        let dialogue = &message_part[colon_pos + 2..];
        
        // Validate both speaker name and dialogue content
        if is_valid_speaker_name(speaker) && is_valid_dialogue_text(dialogue) {
            return true;
        }
    }
    
    false
}