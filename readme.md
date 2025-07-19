# Link Knowledge And Plan (LKAP)

A powerful VSCode extension for managing Markdown notes with daily note creation, bidirectional linking, and tag management.

**🌏 [中文文档](./README-CN.md)**

## 🚀 Features

### ✅ Implemented Features

#### 📝 Quick Daily Note Creation
- **Shortcut**: `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac)
- **Command**: "Create Today's Note"
- Automatically creates note files named with today's date
- Supports custom date formats
- Smart template system with variable substitution
- Opens existing notes directly if they already exist

### 🔧 Configuration Options

Search for "lkap" in VSCode settings to find the following configuration options:

- **Notes Storage Path** (`lkap.notesPath`): Default `./notes`
- **Date Format** (`lkap.dailyNoteFormat`): Default `YYYY-MM-DD`
- **Daily Note Template** (`lkap.dailyNoteTemplate`): Custom template file path
- **Auto Create Links** (`lkap.autoCreateLinks`): Default `true`
- **Enable Indexing** (`lkap.enableIndexing`): Default `true`

## 📋 Usage Guide

### Creating Daily Notes

1. **Method 1**: Use shortcut `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac)
2. **Method 2**: Open command palette (`Ctrl+Shift+P`), type "Create Today's Note"
3. The extension will automatically create today's note file in the configured notes directory

### Custom Templates

1. Create a template file in your workspace, e.g., `templates/daily-note.md`
2. Set `lkap.dailyNoteTemplate` in settings to your template file path
3. Templates support the following variables:
   - `{{date}}`: Date (YYYY-MM-DD)
   - `{{dayOfWeek}}`: Day of week (Monday, Tuesday, ...)
   - `{{timestamp}}`: Full timestamp
   - `{{year}}`: Year
   - `{{month}}`: Month
   - `{{day}}`: Day
   - `{{time}}`: Time (HH:mm:ss)

### Example Template

```markdown
# {{date}} - {{dayOfWeek}}

## 🎯 Today's Goals
- [ ] 

## 📝 Work Log


## 📚 Learning Notes


## 💭 Random Thoughts


---
*Created at: {{time}}*
```

## 🛠️ Development

### Environment Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Compile code: `npm run compile`
4. Press F5 to start debugging

### Project Structure

```
src/
├── extension.ts              # Extension entry point
├── commands/                 # Command implementations
│   └── dailyNote.ts         # Daily note commands
├── utils/                   # Utility functions
│   ├── fileUtils.ts         # File operations
│   └── dateUtils.ts         # Date handling
└── types/                   # Type definitions
    └── index.ts            # Common types
```

## 🗓️ Development Roadmap

### Phase 1: Basic Features ✅
- [x] Project setup and environment configuration
- [x] Quick daily note creation feature
- [ ] Basic bidirectional linking support
- [ ] Simple tag parsing
- [ ] Basic indexing system design
- [ ] File discovery and parser implementation

### Phase 2: Core Features (In Progress)
- [ ] Link auto-completion and navigation
- [ ] Backlink display
- [ ] Tag tree view
- [ ] Configuration management interface
- [ ] Complete index manager implementation
- [ ] Incremental index updates
- [ ] Index persistence and caching

### Phase 3: Advanced Features (Planned)
- [ ] Link preview and hover display
- [ ] Tag batch operations
- [ ] Template system
- [ ] Search and filtering
- [ ] Index performance optimization
- [ ] Concurrent processing and memory management
- [ ] Index integrity validation

### Phase 4: Optimization and Release (Planned)
- [ ] Performance optimization
- [ ] User experience improvements
- [ ] Documentation completion
- [ ] Extension marketplace release
- [ ] Index performance benchmarking
- [ ] Large-scale note library testing

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📞 Support

If you encounter any issues while using this extension:
1. Check the FAQ section in this documentation
2. Submit an Issue on GitHub
3. Check the VSCode Developer Console output

## 🌟 Acknowledgments

This project is inspired by popular note-taking tools like Obsidian and Roam Research, aiming to bring similar functionality to the VSCode environment.

---

**Like this extension? Give us a ⭐ on GitHub!** 