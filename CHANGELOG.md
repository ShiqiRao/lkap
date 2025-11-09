# Change Log

All notable changes to the "lkap" extension will be documented in this file.

## [0.1.5] - 2025-11-09

### Fixed
- **Critical**: Fixed bug in quick link creation command where `FileUtils.ensureDir()` was incorrectly called instead of `FileUtils.ensureDirectory()`
- This bug prevented the "Create Note from Link" feature from working when the notes directory didn't exist

## [0.1.4] - 2025-11-08

### Added
- **Bidirectional Linking System**: Complete implementation of wiki-style `[[note-name]]` links
- **Link Navigation**: Press `F12` to jump to linked notes from current cursor position
- **Link Hover Preview**: Hover over links to preview target file content
- **Quick Link Creation**: Create missing notes directly from unresolved links
- **Backlinks View**: Sidebar panel showing all files that link to the current file
- **Tag Management**: Parse and display `#tags` from notes in dedicated sidebar view
- **Tag Tree View**: Hierarchical display of all tags with usage counts and file grouping
- **Link Validation Command**: Validate all links in workspace (`lkap.validateLinks`)
- **Index Rebuild Command**: Manually rebuild link index (`lkap.rebuildIndex`)
- **Real-time Indexing**: Automatic index updates as files are edited

### Technical
- New module: `services/linkIndexService.ts` - Core indexing and parsing engine
- New module: `services/linkResolver.ts` - Link target resolution logic
- New module: `services/backlinksProvider.ts` - Backlinks query API
- New module: `utils/linkUtils.ts` - Link parsing utilities
- New module: `views/backlinksView.ts` - Backlinks sidebar implementation
- New module: `views/tagsView.ts` - Tags sidebar implementation
- New module: `commands/linkNavigation.ts` - F12 navigation handler
- New module: `commands/quickLinkCreate.ts` - Quick note creation from links
- Extended TypeScript type definitions for links, tags, and indices
- Implemented TreeDataProvider for VSCode sidebar views

### Changed
- Updated README with comprehensive Phase 2 feature documentation
- Simplified ARCHITECTURE_LINKING.md to reflect Phase 2 completion status
- Enhanced configuration system with `autoCreateLinks` and `enableIndexing` settings

## [0.1.1] - 2025-07-19

### Fixed
- **Critical**: Fixed "Cannot find module 'moment'" error in published extension
- **Critical**: Fixed "command 'lkap.createDailyNote' not found" error
- **Performance**: Switched from TypeScript compilation to esbuild bundling
- **Size**: Significantly reduced extension package size (from 607 files to 11 files)

### Changed
- Extension now activates on VSCode startup (activationEvents: "*") for better user experience
- All dependencies are now bundled into a single file
- Improved error handling and debugging information
- Enhanced extension activation logging

### Technical
- Integrated esbuild for bundling dependencies
- Updated build process to use bundling instead of individual file compilation
- Improved .vscodeignore configuration

## [0.1.0] - 2025-07-19

### Added
- **Quick Daily Note Creation**: Create daily notes with `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac)
- **Smart Template System**: Support for custom templates with variable substitution
- **File Management**: Automatic directory creation and file handling
- **Date Utilities**: Flexible date formatting and parsing
- **Configuration Options**: Customizable notes path, date format, and template settings

### Features
- Support for custom date formats (default: YYYY-MM-DD)
- Template variables: `{{date}}`, `{{dayOfWeek}}`, `{{time}}`, etc.
- Intelligent file opening (create new or open existing)
- Cross-platform compatibility

### Technical
- TypeScript implementation
- VSCode Extension API integration
- Moment.js for date handling
- Comprehensive error handling and user feedback

## [Unreleased]

### Planned Features
- Bidirectional linking with `[[title]]` syntax
- Tag management system
- Backlink visualization
- Search and filtering capabilities
- Graph view for note relationships 