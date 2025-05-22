# LookML Support for VS Code

This extension provides comprehensive language support for LookML files in VS Code, making it easier to write and maintain Looker data models.

## Features

### Syntax Highlighting

* Full syntax highlighting for LookML files (.lookml, .lkml, .view.lkml, .model.lkml, .explore.lkml)
* Enhanced SQL highlighting in derived tables
* Support for Liquid templating in SQL blocks
* Highlighting for Looker-specific SQL patterns (like `${TABLE}`)

![Syntax Highlighting](images/syntax-highlighting.png)

### Auto-Completion

* Context-aware suggestions for LookML properties
* Field reference completion using `${...}` syntax
* Intelligent type suggestions
* Block-specific property suggestions

![Auto Completion](images/auto-completion.png)

### Code Formatting

* Automatic spacing after colons in properties
* SQL keyword capitalization
* Proper indentation based on block nesting
* Preserves template expressions
* Groups fields by type (filters, parameters, dimensions, measures) into separate sections with comments
* Sorts fields alphabetically within their sections
* Preserves comments associated with fields
* Configurable grouping and sorting options

### Linting

* LookML code linting based on the [Look At Me Sideways (LAMS)](https://github.com/looker-open-source/look-at-me-sideways) rule set
* Built-in rules for primary keys, join references, and cross-view references
* Quick-fix suggestions for common issues
* Configurable rule sets

### Hover Documentation

* Detailed information about LookML elements when hovering
* Documentation for properties, block types, and field types
* Examples and links to official Looker documentation
* Context-aware documentation based on cursor position

## Requirements

* VS Code 1.70.0 or higher

## Extension Settings

This extension contributes the following settings:

### Linter Settings

* `lookml.linter.enabled`: Enable/disable the LookML linter
* `lookml.linter.rules`: List of enabled linting rules
* `lookml.linter.disabledRules`: List of specific rules to disable

### Formatter Settings

* `lookml.formatter.groupFieldsByType`: When enabled, groups fields by type (filters, parameters, dimensions, measures) into separate sections with comments (default: `true`)
* `lookml.formatter.sortFields`: When enabled, sorts fields alphabetically within their type sections (default: `true`)

### Available Linting Rules

* **K1**: Primary keys should be explicitly defined and follow naming conventions
* **E1**: Explore joins should use substitution operators instead of direct table references
* **F1**: Fields should not reference other views directly

## Known Issues

* This extension is in development and might have bugs
* Advanced SQL formatting might not handle all edge cases
* Auto-completion might not cover all possible LookML syntax elements
* Linting is based on a simplified parser and may miss some complex patterns

## Release Notes

### 0.0.1

Initial release with:

* Basic syntax highlighting
* SQL highlighting in derived tables
* Auto-completion for LookML properties
* Basic code formatting
* LAMS-based linting
* Hover documentation for LookML elements

## Development

1. Clone the repository
2. Run `npm install`
3. Make changes
4. Press F5 to run the extension in development mode

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

* Linting rules based on [Look At Me Sideways (LAMS)](https://github.com/looker-open-source/look-at-me-sideways) by Looker
