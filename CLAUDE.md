# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This VS Code extension provides language support for LookML files, including syntax highlighting, formatting, auto-completion, and linting. LookML is the language used by Looker for defining data models.

## Development Commands

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile

# Watch for changes during development
npm run watch

# Run the extension in a new VS Code window
npm run dev

# Package the extension for distribution
npm run package
```

## Architecture

### Core Components

1. **Extension Entry Point** (`src/extension.ts`): 
   - Activates the extension and registers all providers
   - Sets up all language features
   - Registers commands and event listeners
   - Defines completion item arrays for different LookML contexts

2. **Formatter** (`src/formatter.ts`):
   - Implements the LookMLFormatter class for advanced code formatting
   - Handles block-aware indentation, property spacing
   - Provides special handling for SQL blocks and Liquid templates
   - Formats SQL keywords and operators

3. **Linter** (`src/linter/`):
   - Implements LAMS (Look At Me Sideways) rules for LookML validation
   - Contains diagnostics, parsing, rules, and actions implementations
   - Displays issues in the editor and provides quick-fix actions
   - Configurable through VS Code settings

4. **Hover Provider** (`src/hover.ts`):
   - Provides context-sensitive documentation when hovering over LookML elements
   - Shows information about properties, block types, and field types

5. **TextMate Grammar** (`syntaxes/lookml.tmLanguage.json`):
   - Defines the syntax highlighting rules for LookML
   - Handles nested blocks, SQL sections, and Liquid templates

6. **Language Configuration** (`language-configuration.json`):
   - Configures editor behaviors like auto-closing pairs and indentation rules

### Language Feature Flow

1. **Auto-Completion**: 
   - Context is determined by checking cursor position and surrounding code
   - Different completion sets are provided based on block type
   - Field references are extracted from the document for autocomplete

2. **Formatting**:
   - LookML document is parsed line by line
   - Block structure is tracked with an indentation stack
   - Special handling for SQL blocks and properties
   - SQL keywords are capitalized and operators spaced properly

3. **Linting**:
   - Active on document change and save
   - Parses LookML to detect issues based on LAMS rules
   - Creates VSCode diagnostics for issues
   - Provides quick-fix actions through the CodeActionProvider

## Working with This Codebase

- When adding new LookML language features, follow the existing patterns for registration in `extension.ts`
- For supporting new LookML elements, update the appropriate arrays in `extension.ts`
- New formatter capabilities should be added to the `LookMLFormatter` class in `formatter.ts`
- When adding linting rules, implement them in `linter/rules.ts` and make sure to add them to the available configurations

## Testing the Extension

### Manual Testing

The primary method of testing is running the extension in a development instance of VS Code:

```bash
# Start a dev instance with the extension loaded
npm run dev
```

Then open LookML files (there are examples in the `example/` directory) to verify features are working properly.

### Automated Testing

Automated tests are being developed but are not yet fully functional:

```bash
# Run unit tests
npm test
```

The test fixtures are located in `/src/test/fixtures/` and test specific aspects of the formatter and other components.

### Known Formatting Issues

The formatter has been fixed to address several issues:

1. **Model Files** - Model files now format correctly with proper indentation for explores and joins
2. **SQL in Derived Tables** - SQL blocks in derived tables now indent correctly with columns indented one level deeper
3. **Comment Separators** - Comment separators (like `# ----- Dimensions -----`) are now only added once, even when formatting multiple times

See the `ACCEPTANCE_CRITERIA.md` file for specific criteria to verify these fixes are working properly.