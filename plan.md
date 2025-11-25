# POE2 Log Viewer - Implementation Plan

## Overview
This plan addresses the critical issue of hardcoded NPC names and provides a roadmap for improving log categorization and data extraction.

## Phase 1: Critical Fix - Remove Hardcoded NPC Names

### 1.1 Refactor Dialogue Detection
**File:** `src-tauri/src/log_categorizer.rs`  
**Current Code:** Lines ~240-280 in `is_valid_npc_dialogue()`  
**Issue:** 19 hardcoded NPC names won't scale  
**Solution:** Replace hardcoded list with heuristic-based pattern detection

**Implementation Approach:**

```
Old Logic:
  - Check if message contains any known NPC name from hardcoded list
  - If yes, do pattern validation
  - If no, fail

New Logic:
  - Check if message matches dialogue pattern: "SomeName: DialogueText"
  - Validate the "SomeName" part looks like a character name
  - Validate "DialogueText" looks like legitimate speech
  - Accept if both pass (no hardcoded list needed)
```

**Validation Criteria for Character Name:**
- Contains at least one letter
- Contains only alphanumeric, spaces, commas, apostrophes, hyphens
- Doesn't match known system keywords (Has, is, been, now, level)
- Proper capitalization (starts with uppercase)
- Not "Client" or other process names

**Validation Criteria for Dialogue Text:**
- At least 3 characters after the colon
- Contains mostly alphabetic characters (allows punctuation)
- Not wrapped in brackets (system tags)
- Not a timestamp or ID pattern

**Difficulty:** Medium - Requires regex refinement and testing

---

### 1.2 Separate Chat Channel Detection
**File:** `src-tauri/src/log_categorizer.rs`  
**Current Handling:** Incomplete chat detection  
**Solution:** Create explicit handlers for each channel type

**Implementation Details:**

| Prefix | Channel | Current Status | Needed |
|--------|---------|--------|--------|
| `$` | Global/Trade | Partial | Extract sender name |
| `#` | Local/Area | Partial | Extract sender name |
| `&:` | Guild System | Handled | Verify working |
| `&{name}` | Guild Player | Partial | Extract sender name |
| `@From` | Whisper | Handled | Keep as-is |

**Specific Changes:**
1. Add new function: `parse_chat_channel(message: &str) -> Option<ChatChannel>`
2. Enum: `enum ChatChannel { Global, Local, Guild, GuildSystem, Whisper }`
3. Return channel info alongside message content
4. Update `LogEvent` struct to include optional `chat_channel` field (see Phase 2)

**Difficulty:** Easy - Straightforward pattern matching

---

## Phase 2: Data Extraction Enhancements

### 2.1 Player Name Extraction from Deaths
**File:** `src-tauri/src/main.rs` (entry parsing)  
**Current:** Death events identified, names buried in message  
**Goal:** Extract player name for potential future features (death tracking)

**Implementation:**
```rust
fn extract_player_name_from_death(message: &str) -> Option<String> {
    // Pattern: ": PlayerName has been slain."
    // Using regex: ^: ([A-Za-z_\d]+) has been slain
}
```

**Integration Points:**
- Call after death event is detected
- Store in optional field (Phase 2 only; don't change LogEvent yet)
- Makes future enhancements easier (death counter, player stats)

**Difficulty:** Easy - Simple regex capture group

---

### 2.2 Player Name & Level Extraction from Level-Ups
**File:** `src-tauri/src/main.rs` (entry parsing)  
**Current:** Level-up events identified, data buried in message  
**Goal:** Extract character name, class, and level number

**Implementation:**
```rust
fn extract_level_up_info(message: &str) -> Option<(String, String, u32)> {
    // Pattern: ": CharName (ClassName) is now level N"
    // Regex: ^: ([A-Za-z_\d]+) \(([^)]+)\) is now level (\d+)
    // Returns: (character_name, class_name, level_number)
}
```

**Integration Points:**
- Call after level-up event is detected
- Makes future UI enhancements possible (character progression tracking)
- Could display "CharName leveled to N (Class)" in UI

**Difficulty:** Easy - Regex with multiple capture groups

---

### 2.3 Chat Message Sender Extraction
**File:** `src-tauri/src/main.rs` (entry parsing)  
**Current:** Chat messages identified, senders not extracted  
**Goal:** Extract sender name from all chat formats

**Implementation:**
```rust
fn extract_chat_sender(message: &str) -> Option<(String, String)> {
    // Pattern matching by prefix:
    // "$SenderName: message" -> ("SenderName", "message")
    // "#SenderName: message" -> ("SenderName", "message")
    // "&SenderName: message" -> ("SenderName", "message")
    // "&: SYSTEM_MESSAGE" -> (None, "SYSTEM_MESSAGE")
    // Returns: (sender_name, message_content)
}
```

**Difficulty:** Easy - Pattern matching by prefix

---

## Phase 3: Data Structure Enhancements (Optional)

### 3.1 Extend LogEvent Structure
**File:** `src-tauri/src/main.rs` and `src/App.tsx`  
**Current:** `LogEvent { timestamp, category, message, raw }`  
**Enhancement:** Add optional extracted fields

```rust
pub struct LogEvent {
    pub timestamp: String,
    pub category: String,
    pub message: String,
    pub raw: String,
    
    // New optional fields:
    #[serde(skip_serializing_if = "Option::is_none")]
    pub player_name: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_class: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<u32>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat_channel: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat_sender: Option<String>,
}
```

**Frontend Update:** `src/components/LogViewer.tsx`
- Display extracted data where available
- Example: "BrickToast (Mercenary) leveled to 2" instead of raw message
- Only in phase 3+ when UI needs to be changed

**Difficulty:** Medium - Requires schema changes and serialization updates

---

## Phase 4: Timestamp Parsing (Optional)

**File:** `src-tauri/src/main.rs`  
**Current:** Timestamps kept as strings  
**Benefit:** Better sorting, filtering by time range

**Implementation:**
```rust
use chrono::{DateTime, NaiveDateTime};

pub struct LogEvent {
    pub timestamp: String,
    pub timestamp_parsed: Option<DateTime<Local>>,
    // ...
}
```

**Difficulty:** Easy - Use `chrono` crate (likely already available via Tauri)

---

## Implementation Order & Priority

### Priority 1: CRITICAL (Do First)
- [x] Analyze log file structure and hardcoding issue *(COMPLETED)*
- [ ] **Phase 1.1:** Remove hardcoded NPC names, implement heuristic dialogue detection
  - Estimated effort: **2-3 hours**
  - Files: `src-tauri/src/log_categorizer.rs` only
  - Impact: Unlocks future content without code changes

### Priority 2: HIGH (Do Second)
- [ ] **Phase 1.2:** Implement chat channel detection
  - Estimated effort: **30-60 minutes**
  - Files: `src-tauri/src/log_categorizer.rs` only
  - Impact: Better categorization of player interactions

### Priority 3: MEDIUM (Do Third)
- [ ] **Phase 2.1:** Extract player names from deaths
- [ ] **Phase 2.2:** Extract character name/class/level from level-ups
- [ ] **Phase 2.3:** Extract chat senders
  - Combined estimated effort: **1-2 hours**
  - Files: `src-tauri/src/main.rs` only
  - Impact: Foundation for future UI enhancements

### Priority 4: LOW (Future)
- [ ] **Phase 3:** Update LogEvent structure with optional fields
  - Only needed if UI wants to display extracted data
- [ ] **Phase 4:** Parse timestamps to DateTime
  - Only needed if time-based filtering required

---

## Detailed Implementation: Phase 1.1 (Dialogue Detection)

### Current Code to Replace
**File:** `src-tauri/src/log_categorizer.rs` (around lines 230-280)

**Current Pattern:**
```rust
fn is_valid_npc_dialogue(message: &str) -> bool {
    let known_npcs = [
        "Wounded Man:", "Clearfell Guard:", "The Bloated Miller:",
        // ... 16 more hardcoded names
    ];
    
    if let Some(npc) = known_npcs.iter().find(|&&npc| message.contains(npc)) {
        // do validation
    }
    // else fail
}
```

### Proposed Solution
```rust
fn is_valid_dialogue(message: &str) -> bool {
    // Pattern: "SomeName: Dialogue text here"
    // where SomeName is not a system keyword
    
    if let Some(colon_pos) = message.find(':') {
        let speaker_part = &message[..colon_pos].trim();
        let dialogue_part = &message[colon_pos + 1..].trim();
        
        // Validate speaker looks like a character name
        if !is_valid_speaker_name(speaker_part) {
            return false;
        }
        
        // Validate dialogue looks like speech
        if !is_valid_dialogue_text(dialogue_part) {
            return false;
        }
        
        return true;
    }
    false
}

fn is_valid_speaker_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 100 {
        return false;
    }
    
    // Must start with uppercase letter
    if !name.chars().next().map_or(false, |c| c.is_uppercase()) {
        return false;
    }
    
    // Must not be a system keyword
    let forbidden = ["Has", "Is", "Been", "Now", "Level", "Client", "Server"];
    if forbidden.iter().any(|&kw| name.starts_with(kw)) {
        return false;
    }
    
    // Only allow alphanumeric, spaces, commas, apostrophes, hyphens
    name.chars().all(|c| {
        c.is_alphanumeric() || c.is_whitespace() || 
        c == '\'' || c == '-' || c == ','
    })
}

fn is_valid_dialogue_text(text: &str) -> bool {
    if text.is_empty() || text.len() > 500 {
        return false;
    }
    
    // Must contain mostly letters (not just numbers/symbols)
    let letter_count = text.chars().filter(|c| c.is_alphabetic()).count();
    let total_count = text.len();
    
    if letter_count < (total_count / 2) {
        return false;
    }
    
    // Must not be wrapped in brackets (system tag)
    if text.starts_with('[') || text.ends_with(']') {
        return false;
    }
    
    true
}
```

**Validation:**
- Test against sample log: Should correctly identify all boss/NPC dialogue
- Test against system messages: Should reject non-dialogue entries
- Test with new content: No code changes needed for new NPCs

---

## Validation Checklist

After each phase, verify:

- [ ] Phase 1.1: All dialogue in sample log identified, no false positives on system messages
- [ ] Phase 1.2: Chat messages correctly categorized by channel (global/local/guild)
- [ ] Phase 2.1-2.3: Character/player names correctly extracted from deaths/level-ups
- [ ] Phase 3: New LogEvent fields properly serialized and displayed
- [ ] Phase 4: Timestamps parse without errors

---

## No Hardcoded Character Names Guarantee

With this plan:
- ✅ No character/player names hardcoded
- ✅ No NPC names hardcoded (replaced with pattern detection)
- ✅ Dynamic detection works with new game content
- ✅ Future-proof: Expansion content automatically supported

---

## Files Modified by Phase

| Phase | Files | Type |
|-------|-------|------|
| 1.1 | `src-tauri/src/log_categorizer.rs` | Code refactor |
| 1.2 | `src-tauri/src/log_categorizer.rs` | New function |
| 2.1-2.3 | `src-tauri/src/main.rs` | New helper functions |
| 3 | `src-tauri/src/main.rs`, `src/App.tsx`, `src/components/LogViewer.tsx` | Schema + UI |
| 4 | `src-tauri/src/main.rs`, `Cargo.toml` | Parsing + dependency |
