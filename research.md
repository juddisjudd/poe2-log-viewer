# POE2 Log Viewer - Log Analysis Research

## Sample Log File Structure Analysis

### Log Format
```
YYYY/MM/DD HH:MM:SS {MONOTONIC_COUNTER} {THREAD_ID} [{LOG_LEVEL} {SOURCE} {PID}] [SYSTEM_TAG] {MESSAGE}
```

**Example:**
```
2025/11/04 19:20:50 187967859 3ef232c2 [INFO Client 7776] $The_Abyss_Guy: BUYING RITUAL PRECUSOR TABLET (all mods except unique) : 2 Tablet = 1 Divine Orbs now)
```

### Key Observations

#### 1. **Character Names - NOT Hardcoded, But Dynamic**
- **Player names appear in brackets or prefixed with special symbols:**
  - `$Kekius_Maxymus:` - Trade/global channel prefix
  - `#DoppleZon:` - Local/area channel prefix  
  - `&BrickToast:` - Guild chat prefix
  - `: TomHanksIndexFinger has been slain.` - Death messages (colon + space prefix)
  - `: TomHanksIndexFinger (Mercenary) is now level 2` - Level up messages

- **NPC Names (dialogue):**
  - `Wounded Man:`, `Mortimer:`, `The Bloated Miller:`, `Siora, Blade of the Mists:`
  - `Una:`, `Beira of the Rotten Pack:`, `Ghostly Voice:`

- **No player-specific hardcoding needed** - the log contains the actual character names

#### 2. **Death Events**
```
2025/11/04 19:22:13 188051531 3ef232c2 [INFO Client 7776] : TomHanksIndexFinger has been slain.
2025/11/04 20:43:13 192911046 3ef232c2 [INFO Client 31400] : BrickToast has been slain.
2025/11/04 20:56:52 193729921 3ef232c2 [INFO Client 31400] : BrickToast has been slain.
2025/11/04 21:00:31 193948687 3ef232c2 [INFO Client 31400] : BrickToast has been slain.
```
- **Pattern:** `: {CHARACTER_NAME} has been slain.`
- Current categorizer correctly identifies this

#### 3. **Level Up Events**
```
2025/11/04 19:24:34 188191812 3ef232c2 [INFO Client 7776] : TomHanksIndexFinger (Mercenary) is now level 2
```
- **Pattern:** `: {CHARACTER_NAME} ({CLASS}) is now level {NUMBER}`
- Current categorizer correctly identifies this

#### 4. **Chat Messages - Multiple Channels**
```
$The_Abyss_Guy: BUYING RITUAL PRECUSOR TABLET...    [Global/Trade]
#Julekuk: you were wrong                            [Local/Area]
&BrickToast: anyone on that can help...             [Guild]
&: GUILD UPDATE: Final FTK is done...               [Guild Announcement]
```
- **Prefixes are important for categorization:**
  - `$` = Global/Trade chat
  - `#` = Local/Area chat
  - `&` = Guild chat (with special `&:` for automated updates)

#### 5. **NPC Dialogue Issues in Current Code**
The current `is_valid_npc_dialogue()` has hardcoded NPC names like:
```rust
let known_npcs = [
    "Wounded Man:", "Clearfell Guard:", "The Bloated Miller:",
    "Una:", "Beira of the Rotten Pack:", "Ghostly Voice:",
    // ... more hardcoded names
];
```

**PROBLEM:** This won't scale. New NPCs added in expansions won't be recognized.

**Evidence from log:**
```
Siora, Blade of the Mists: The King in the Mists claims this wood...
Mortimer: Well done! Please come inside.
Isolde of the White Shroud: Ice rends the earth!
Heldra of the Black Pyre: Flames consume all!
```

These are boss dialogue with proper capitalization and punctuation - clearly legitimate dialogue.

#### 6. **Warnings and Critical Messages**
```
2025/11/04 19:19:58 187916000 64a60fe5 [WARN Client 7776] Failed to create effect graph node...
2025/11/04 20:55:06 193624140 faf1c1bf [CRIT Client 31400] [RENDER] Shader uses incorrect...
2025/11/04 20:43:29 192926937 273632b5 [CRIT Client 31400] TakeHit animation cannot be a looping...
```
- **Patterns:** `[WARN`, `[CRIT`, `[ERROR`
- Current categorizer handles these as "Warnings"

#### 7. **Trade/Chat Message Variations**
```
@From syntax not found in this log
# messages are local chat: "#Julekuk: you were wrong"
$ messages are global: "$Kekius_Maxymus: BUYING..."
& messages are guild: "&BrickToast: anyone on..."
&: messages are guild system: "&: GUILD UPDATE:..."
Trade accepted/cancelled not seen in sample
```

#### 8. **Item Filter Messages**
```
2025/11/04 19:20:51 187969250 bf08f15c [INFO Client 7776] [Item Filter] Preparing to download online filter XVEokZIq
2025/11/04 19:20:51 187969250 bf08f196 [INFO Client 7776] [Item Filter] Hash for online filter XVEokZIq is: bcfe77484ea1b4865aa2106ec733a86d
```
- Already handled by `[Item Filter]` prefix

#### 9. **System Information (Non-Gameplay)**
- Timestamps and thread IDs
- GPU/Hardware enumeration
- File system operations
- Memory/buffer management
- Shader compilation info

#### 10. **Missing/Incomplete Categories**
Looking at the log, there are patterns NOT yet captured:
- **Skill Allocation** - "Successfully allocated passive skill" ✅ Handled
- **Equipment/Item Actions** - Not clearly seen in sample
- **Chat Detection** - Currently only checks for `@From` and hardcoded patterns
- **Movement/Portals** - Not captured in sample
- **Inventory Actions** - Not seen
- **Passive Allocations** - ✅ Handled

## Critical Issues Found

### 1. **Hardcoded NPC Names** 
- `is_valid_npc_dialogue()` uses a static list
- Won't work for new NPCs, bosses, or rare encounters
- Should use pattern-based detection instead

### 2. **Character Name Handling**
- No character name appears to be hardcoded in categorizer
- But the hardcoded NPC list needs to be removed/replaced

### 3. **Chat Message Categorization**
- Current logic looks for `@From` (not in this log)
- Should also support `$`, `#`, `&` prefixes more explicitly
- `&:` format (guild system messages) might not be properly detected

### 4. **Dialogue Detection Logic**
The current regex/validation is overly complex:
```rust
fn is_valid_npc_dialogue(message: &str) -> bool {
    // Check against known_npcs list (BAD)
    // Then does pattern matching on the remaining text
    // Too many exclusions that might catch legitimate dialogue
}
```

This needs to be **inverted logic**: Detect what looks like DIALOGUE, not what looks like SYSTEM OUTPUT.

## Real Event Examples from Log

### Gameplay Events
1. **Death:** `: BrickToast has been slain.`
2. **Level Up:** `: BrickToast (Mercenary) is now level 2`
3. **Skill:** `Successfully allocated passive skill id: projectiles18`
4. **NPC Dialogue:** `Siora, Blade of the Mists: The King in the Mists claims...`
5. **Boss Fight Dialogue:** Multiple exchanges between `Isolde of the White Shroud` and `Heldra of the Black Pyre`
6. **Guild Announcement:** `&: GUILD UPDATE: Final FTK is done for the season...`
7. **Trade Chat:** `$The_Abyss_Guy: BUYING RITUAL PRECUSOR TABLET...`
8. **Local Chat:** `#Julekuk: you were wrong`
9. **Guild Chat:** `&BrickToast: anyone on that can help...`

### System Events  
1. **Warnings:** `[WARN Client] Failed to create effect graph node...`
2. **Critical Errors:** `[CRIT Client] [RENDER] Shader uses incorrect...`
3. **Scene Changes:** `[SCENE] Set Source [Stones of Serle]`
4. **Network:** `Connected to sjc.login.pathofexile2.com in 16ms`
5. **Item Filter:** `[Item Filter] Preparing to download online filter`

## Recommendations

1. **Remove hardcoded NPC list** - Replace with dynamic pattern detection
2. **Improve dialogue detection** - Use heuristics like:
   - Contains`: ` (colon-space separator)
   - Starts with capitalized word(s)
   - Not in system tag brackets
   - Speech has reasonable length (5+ chars)
   - Contains alphabetic characters
   - Doesn't match known system patterns

3. **Add chat channel detection**:
   - `^#` = Local/Area chat
   - `^$` = Global/Trade chat
   - `^&:` = Guild system message
   - `^&[^:]` = Guild player message
   - `^@From` = Whisper/Trade interaction

4. **Add missing categories**:
   - Equipment/Inventory interactions (if needed)
   - Movement/Zone transitions (partially covered by SCENE)

5. **Enhance the Dialogue category** to be more inclusive of legitimate NPC speech
