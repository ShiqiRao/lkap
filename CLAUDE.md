# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LKAP (Link Knowledge And Plan) is a VSCode extension for managing Markdown notes with daily note creation, bidirectional linking, and tag management. The project is inspired by tools like Obsidian and Roam Research.

## Common Commands

### Development Setup
```bash
npm install
npm run compile     # Build the extension (development mode with sourcemaps)
npm run watch       # Watch mode for development (auto-rebuild on file changes)
```

### Build & Packaging
```bash
npm run build              # Same as compile
npm run build-production   # Production build with minification
npm run package            # Alias for build-production
npm run vsce:package       # Package extension for distribution (.vsix file)
```

### Quality Checks
```bash
npm run lint               # Run ESLint on src directory
npm run pretest            # Run compile, lint, and tests
npm run test               # Run command registration tests
```

### Publishing
```bash
npm run prepare-publish    # Prepare release (updates version info)
npm run publish            # Publish extension to VSCode Marketplace
npm run vsce:publish       # Alternative publish command
```

### Debugging
- Press F5 in VSCode to start debugging the extension
- The extension runs in a new VSCode window with debugging enabled
- Check VSCode Developer Console (Help → Toggle Developer Tools) for logs and errors

## Architecture Overview

### Core Structure
```
src/
├── extension.ts              # Entry point - activates extension, registers commands
├── commands/                 # Command implementations
│   └── dailyNote.ts         # Daily note creation logic
├── utils/                   # Utility functions
│   ├── fileUtils.ts         # File operations (create, read, write)
│   └── dateUtils.ts         # Date handling using moment.js
└── types/                   # Type definitions
    └── index.ts            # Shared types
```

### Key Modules

**extension.ts (Entry Point)**
- Implements VSCode extension's `activate()` function
- Registers all commands with VSCode
- Sets up context and event listeners
- Lifecycle: activation on `*` (all events)

**commands/dailyNote.ts (Daily Note Feature)**
- Command: `lkap.createDailyNote`
- Keybinding: Ctrl+Shift+T (Windows/Linux), Cmd+Shift+T (Mac)
- Functionality:
  - Creates/opens daily notes with configurable date format
  - Supports template files with variable substitution
  - Variables: `{{date}}`, `{{dayOfWeek}}`, `{{timestamp}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{time}}`
  - Auto-creates notes directory if missing

**utils/fileUtils.ts**
- File path resolution and validation
- File creation and read/write operations
- Template processing and variable substitution

**utils/dateUtils.ts**
- Date formatting using moment.js
- Supports custom format strings (e.g., YYYY-MM-DD)
- Day-of-week extraction

### Build System

Uses **esbuild** for bundling:
- Entry: `src/extension.ts`
- Output: `out/extension.js` (CJS format)
- External dependencies: VSCode API is not bundled
- Sourcemaps: Enabled in development, disabled in production
- Minification: Only in production mode

### Configuration System

All configuration uses VSCode's settings API with resource scope (per-workspace):

- `lkap.notesPath`: Where notes are stored (default: `./notes`)
- `lkap.dailyNoteFormat`: Date format for filenames (default: `YYYY-MM-DD`)
- `lkap.dailyNoteTemplate`: Path to template file (optional)
- `lkap.autoCreateLinks`: Auto-create linked notes (default: `true`)
- `lkap.enableIndexing`: Enable note indexing (default: `true`)

### Views & UI

Registered views (in explorer sidebar):
- Tags view: Displays parsed tags from notes
- Backlinks view: Shows bidirectional link references

These are currently frameworks for Phase 2+ features.

## Development Workflow

### Adding a New Command
1. Create command handler in `src/commands/`
2. Export handler function with signature: `(context: vscode.ExtensionContext) => void`
3. Register in `extension.ts`'s activate function:
   ```typescript
   context.subscriptions.push(
     vscode.commands.registerCommand('lkap.commandName', async () => {
       // Command implementation
     })
   );
   ```
4. Update `package.json` `contributes.commands` array
5. Rebuild with `npm run compile`

### Testing Locally
1. `npm run compile` to build
2. Press F5 to open debug VSCode window
3. Open command palette (Ctrl+Shift+P) and search for "LKAP" commands
4. Check Developer Console for any errors

### Roadmap Status

**Phase 1 (Mostly Complete)**
- ✅ Daily note creation
- ✅ Template system
- 🚧 Bidirectional linking (framework in place)
- 🚧 Tag parsing (framework in place)
- 🚧 Indexing system (framework in place)

**Phase 2+ (Planned)**
- Link auto-completion and navigation
- Backlink display in sidebar
- Tag tree view with filtering
- Index persistence and caching

## Important Notes

- **TypeScript Strict Mode**: Project uses strict TypeScript checking (`strict: true`)
- **Node/VSCode Types**: Uses appropriate type packages (@types/vscode, @types/node)
- **moment.js**: Used for all date handling - check moment.js documentation for format strings
- **Glob Patterns**: Used for file discovery when indexing
- **MIT Licensed**: This is a public project - maintain license headers in files

## Dependencies

**Production**
- `moment`: Date/time handling
- `glob`: File pattern matching for note discovery

**Development**
- `esbuild`: Module bundler
- `typescript`: TypeScript compiler
- `eslint` + `@typescript-eslint/*`: Linting
- `@vscode/vsce`: VSCode package/publish tool
- `@vscode/test-electron`: VSCode extension testing

## Debugging Tips

1. **Extension not activating**: Check `extension.ts` activate function is exported
2. **Commands not found**: Run `npm run test` to verify command registration
3. **Build errors**: Check `npm run lint` output first
4. **Sourcemaps missing**: Ensure running `npm run compile` not `npm run build-production`
5. **Template variables not working**: Verify variable names match `dateUtils.ts` substitution map
