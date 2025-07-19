# Change Log

All notable changes to the "lkap" extension will be documented in this file.

## [0.1.1] - 2024-01-20

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

## [0.1.0] - 2024-01-20

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