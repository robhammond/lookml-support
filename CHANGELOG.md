# Change Log

All notable changes to the "lookml-support" extension will be documented in this file.

## [0.0.3] - 2024-05-22

### Added
- Advanced formatting options:
  - Group fields by type (filters, parameters, dimensions, measures) into separate sections with header comments
  - Sort fields alphabetically within their type sections
  - Preserves comments associated with fields
  - Organized field order: filters, parameters, dimensions, measures
  - Configurable settings to control grouping and sorting behavior:
    - `lookml.formatter.groupFieldsByType` - Group fields by type (default: true)
    - `lookml.formatter.sortFields` - Sort fields alphabetically (default: true)

## [0.0.2] - 2024-05-21

### Added
- Hover documentation feature for LookML elements
  - Documentation for properties, block types, and field types
  - Examples and links to official Looker documentation
  - Context-aware documentation based on cursor position

## [0.0.1] - 2024-05-01

### Added
- Initial release with:
  - Basic syntax highlighting
  - SQL highlighting in derived tables
  - Auto-completion for LookML properties
  - Basic code formatting
  - LAMS-based linting