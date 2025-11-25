# POE2 Log Viewer - AI Coding Agent Instructions

## Project Overview
POE2 Log Viewer is a real-time log monitoring desktop application for Path of Exile 2, built with a Rust/Tauri backend and React/TypeScript frontend. It watches log files, categorizes events, and provides real-time UI updates with smart filtering.

**Tech Stack:**
- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** Rust, Tauri 2.0 (IPC bridge), Tokio async runtime
- **Build Tool:** Bun (preferred over npm/yarn)
- **CI/CD:** GitHub Actions (Windows-only, MSI installer)

## Architecture Patterns

### Frontend-Backend Communication
The app uses **Tauri IPC commands** for frontend↔backend communication via `@tauri-apps/api/core`:
- **Commands** (`invoke`): Frontend calls Rust functions (`#[tauri::command]`)
  - `start_watching(path)` - Begin monitoring a log file
  - `stop_watching()` - Stop monitoring
  - Examples in `src/App.tsx` lines 50-80+
- **Events** (`listen`, `emit`): Bidirectional event streaming
  - Backend emits `log_event` with `LogEvent` structs after categorizing
  - Frontend subscribes with `listen("log_event")`
  - Used for real-time log updates without polling

### Log Processing Pipeline
1. **Rust Backend** (`src-tauri/src/main.rs`):
   - `start_watching()` → `read_existing_logs()` → emit all historical logs
   - `watch_log_file()` (async task) → polls file changes, reads new lines
   - `LogCategorizer::categorize()` determines log category
   - Deduplication via `processedLogIds` hashset (hash of raw line content)
   
2. **Log Categorizer** (`src-tauri/src/log_categorizer.rs`):
   - `CategoryPatterns` builder pattern with required/excluded/any-of pattern matching
   - Categories have **priority** (lower = higher, checked in order)
   - Supports custom validator functions for complex logic
   - Maps to frontend categories: Death, Level Up, Trade, Skill, Guild, Network, etc.

3. **React Frontend** (`src/App.tsx`):
   - Maintains log state array, applies filters and search
   - `LogViewer` component renders with auto-scroll, highlighting, emojis
   - `FilterPanel` provides quick presets ("Gameplay Only", "System Only")
   - Settings persisted to localStorage (last file path, auto-load preference)

## Key Development Workflows

### Run Development Server
```bash
bun install
bunx tauri dev  # Launches Vite dev server + Rust backend + dev window
```
- Frontend hot-reloads on TypeScript/React changes
- Rust changes require manual restart
- Dev window: http://localhost:5173 (Tauri proxies to this)

### Build for Production
```bash
bun run tauri:build  # Creates MSI installer + standalone exe
```
- Outputs to `src-tauri/target/release/`
- MSI bundled in `src-tauri/target/release/bundle/msi/`
- GitHub Actions workflow automates this on version tags

### Version & Release
```bash
npm version patch  # Updates package.json + git tag
git push && git push --tags  # Triggers GitHub Actions release workflow
```
- Workflow: `.github/workflows/release.yml`
- Copies MSI + exe to GitHub releases
- Version synced: `package.json` + `src-tauri/Cargo.toml`

## Important Conventions & Patterns

### Tauri Configuration
- `src-tauri/tauri.conf.json` is the source of truth for app metadata
- Window: 1400×900 min (adjustable via `minWidth`/`minHeight`)
- Capabilities: `default.json` grants file/dialog/shell permissions
- Only targets Windows (MSI + portable exe)

### Styling
- **Tailwind CSS** only - no custom CSS files except `src/index.css`
- `postcss.config.js` chains Tailwind → Autoprefixer
- Dark theme: `bg-black`, `bg-gray-950` base, emerald/blue/red accent colors
- Responsive: Use Tailwind flex/grid utilities, NOT media queries

### Component Patterns
- Functional components with hooks (useState, useEffect, useCallback, useRef)
- Shared types in component files (interfaces like `LogEvent`, `AppSettings`)
- Props destructuring with TypeScript interfaces
- No external state management (Context would be over-engineered for this size)

### Rust Patterns
- `SafeAppState = Arc<Mutex<AppState>>` for shared mutable state
- Commands spawn long-running tasks via `tokio::spawn()`
- File I/O: `BufReader` with `Seek` for incremental reading
- Error handling: `Result<T, String>` (convert errors to strings for frontend)

### Naming & Structure
- **Commands** (Rust): snake_case, descriptive (`start_watching`, `stop_watching`)
- **Components** (React): PascalCase, one per file (`LogViewer.tsx`, `FilterPanel.tsx`)
- **State variables**: Clear prefixes (`is*`, `current*`, `update*`)
- **Colors/Icons**: Centralized in `getColor()` and `getCategoryIcon()` functions

## Testing & Debugging

### No Unit Tests Currently
- Project is small; integration testing via dev mode sufficient
- Add tests to `src-tauri/src/` if you add complex Rust logic

### Common Debug Points
- **File watching not updating?** Check `processed_entries` deduplication in Rust
- **Events not emitting?** Verify Tauri capability in `src-tauri/capabilities/default.json`
- **Styling broken?** Rebuild Tailwind (`bun run build` or restart dev server)
- **Rust build fails?** Ensure `rust-analyzer.linkedProjects` in `.vscode/settings.json`

## Integration Points & Dependencies

### External Crates
- **notify 6.1**: File system watcher (for log file changes)
- **tokio 1.37**: Async runtime (required by Tauri 2)
- **serde/serde_json**: Serialization for IPC
- **tauri 2.0, tauri-plugin-***: Window, dialog, FS, shell APIs

### File Permissions
- `fs:allow-read-file`, `fs:allow-exists`: Read log files
- `dialog:allow-open`: File picker for log selection
- `shell:allow-open`: Open URLs (release notes, URLs)
- Defined in `src-tauri/capabilities/default.json`

### No Backend API
- Everything is local file I/O + desktop APIs
- No network calls except GitHub releases check (handled separately in frontend)

## Adding New Features

### New Log Category
1. Add category to `LogCategorizer::new()` in `log_categorizer.rs`
2. Define `CategoryPatterns` with matching logic
3. Add color + icon to `getColor()`, `getCategoryIcon()` in `LogViewer.tsx`
4. Update `gameplayCategories` or `systemCategories` in `FilterPanel.tsx`

### New Tauri Command
1. Add `#[tauri::command]` function in `src-tauri/src/main.rs`
2. Register in `.setup()` closure: `.invoke_handler(tauri::generate_handler![cmd_name])`
3. Call from React: `const result = await invoke('cmd_name', { param: value })`

### UI Changes
- Edit components in `src/components/` or `src/App.tsx`
- Use Tailwind classes (no new CSS files)
- Test in dev mode (hot reload works for React)

## Files to Know

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Main React component, Tauri IPC setup, settings management |
| `src/components/LogViewer.tsx` | Log display with formatting, icons, search highlighting |
| `src/components/FilterPanel.tsx` | Filter UI, quick presets |
| `src-tauri/src/main.rs` | Tauri setup, `start_watching`, file polling, event emission |
| `src-tauri/src/log_categorizer.rs` | Pattern matching logic, category definitions |
| `src-tauri/tauri.conf.json` | App metadata, window size, capabilities |
| `tailwind.config.js`, `postcss.config.js` | Styling pipeline |
| `.github/workflows/release.yml` | Build + publish automation |
