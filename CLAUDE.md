# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This VS Code extension provides language support for LookML files, including syntax highlighting and basic formatting capabilities. LookML is the language used by Looker for defining data models.

## Development Commands

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile

# Watch for changes during development
npm run watch

# Package the extension
npm run package

# Run the extension in a new VS Code window
# Note: add this to package.json scripts if needed:
# "dev": "code --extensionDevelopmentPath=`pwd`"
```

## Architecture

- **extension.ts**: Main entry point that activates the extension and registers the LookML formatting provider
- **lookml.tmLanguage.json**: TextMate grammar definition for syntax highlighting
- **language-configuration.json**: Configuration for language features like brackets, comments, and auto-indentation

The extension currently provides:
1. Syntax highlighting for LookML files (*.lookml, *.lkml, *.view.lkml, *.model.lkml, *.explore.lkml)
2. Embedding of SQL syntax highlighting in SQL blocks
3. A basic document formatter that enforces spacing after parameter colons

## Key Components

1. **Formatter**: The extension implements a simple formatter that ensures space after colons for parameters (e.g., "type:number" → "type: number"). The current implementation is basic and could be enhanced with a proper parser.

2. **Grammar Definition**: The TextMate grammar defines the syntax highlighting rules for LookML, including support for:
   - Comments (# style)
   - Liquid templating tags ({% %} and {{ }})
   - Block definitions
   - Keywords 
   - Strings, numbers, and boolean values
   - SQL blocks
   - Parameter definitions

3. **Language Configuration**: Defines editor behaviors like auto-closing pairs, indentation rules, and comment tokens.

## Recent Improvements

1. **Enhanced SQL Highlighting in Derived Tables**: Improved SQL syntax highlighting in derived tables:
   - Added special detection of `derived_table: { sql: ... }` blocks
   - Added support for proper SQL highlighting within these blocks
   - Added highlighting for Looker-specific SQL keywords like `${TABLE}` and `${EXTENDED}`
   - Improved handling of SQL blocks with ";;" terminators

2. **Liquid Template Integration**: Enhanced handling of Liquid templating within SQL blocks for better syntax highlighting of mixed SQL and Liquid content.

3. **Advanced Code Formatter**: Implemented a robust formatting engine for LookML:
   - Block-aware formatting with proper indentation based on nesting
   - Consistent property spacing and alignment
   - SQL keyword capitalization and operator spacing
   - Special handling for SQL blocks and Liquid templates
   - Preservation of document structure and empty lines
   - Respects VS Code editor settings (tabs vs spaces)

4. **Auto-Completion**: Implemented context-aware auto-completion for LookML:
   - Suggests top-level elements (view, explore, model, etc.)
   - Context-aware property suggestions within blocks (view, dimension, measure, etc.)
   - Smart completion for dimension types after `type:` property
   - Field reference completion for `${...}` syntax
   - Documentation for common properties
   - Triggered on `.`, `:`, `{`, and `$` characters

## Future Improvement Areas

1. **Enhanced Auto-Completion**: Improve the auto-completion features:
   - Add support for cross-file references
   - Include SQL auto-completion within SQL blocks
   - Add snippets for common LookML patterns