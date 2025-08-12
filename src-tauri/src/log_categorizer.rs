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

fn is_trade_or_chat_message(message: &str) -> bool {
    if message.contains("@From ") {
        return true;
    }
    
    if message.contains("Trade accepted") || message.contains("Trade cancelled") {
        return true;
    }
    
    if message.contains("#") && message.contains(": ") {
        let parts: Vec<&str> = message.split("] ").collect();
        if parts.len() > 1 {
            let message_part = parts[1];
            if message_part.starts_with("#") {
                return true;
            }
        }
    }
    
    false
}

fn is_valid_npc_dialogue(message: &str) -> bool {
    // Known NPC names (expanded list)
    let known_npcs = [
        "Wounded Man:", "Clearfell Guard:", "The Bloated Miller:",
        "Una:", "Beira of the Rotten Pack:", "Ghostly Voice:",
        "The Rust King:", "Lachmann the Lost:", "Lachlann the Lost:",
        "Finn:", "Renly:", "Alva:", "Zana:", "The Hooded One:",
        "Count Geonor:", "Asala:", "Doryani:", "Dread Thicket Witch:",
        "Trialmaster:", "Sacrifice Altar:",
    ];

    // Check for known NPCs first
    for npc in &known_npcs {
        if message.contains(npc) {
            return true;
        }
    }

    // Restrictive pattern detection for unknown NPCs
    let parts: Vec<&str> = message.split(": ").collect();
    if parts.len() >= 2 {
        let speaker = parts[0];
        let speech = parts[1];
        
        if let Some(speaker_name) = speaker.split_whitespace().last() {
            return !speaker_name.starts_with("@")
                && !speaker_name.starts_with("#")
                && !speaker_name.starts_with("[")
                && !speaker_name.starts_with("&")
                && !speaker_name.contains("Client")
                && !speaker_name.contains("INFO")
                && !speaker_name.contains("DEBUG")
                && !speaker_name.contains("ERROR")
                && !speaker_name.contains("WARN")
                && speaker_name.chars().any(|c| c.is_uppercase())
                && !speech.trim().is_empty()
                && !speech.contains("Client")
                && !speech.contains("INFO")
                && !speech.contains("DEBUG")
                && !speech.contains("ERROR")
                && !speech.contains("WARN")
                && !speech.contains("ON")
                && !speech.contains("OFF")
                && !speech.contains("=")
                && !speech.contains("Version")
                && !speech.contains("Build")
                && !speech.contains("family")
                && !speech.contains("count")
                && !speech.contains("flags")
                && !speech.contains("true")
                && !speech.contains("false")
                && !speech.contains("accepted")
                && !speech.contains("cancelled")
                && !speech.contains("Failed to apply")
                && speech.len() > 5
                && speech.chars().any(|c| c.is_alphabetic());
        }
    }

    false
}