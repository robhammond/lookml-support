# LookML Auto-Completion

This document describes the auto-completion capabilities implemented in the LookML Support extension.

## Supported Contexts

The auto-completion provider is context-aware and provides different suggestions based on where your cursor is in the document:

### Top Level Elements

At the top level of a LookML file, the extension suggests:

- `view`
- `explore`
- `model`
- `include`
- `datagroup`
- `access_grant`

### View Properties

Inside a view block, the extension suggests properties like:

- `derived_table`
- `sql_table_name`
- `dimension`
- `dimension_group`
- `measure`
- `filter`
- `parameter`

### Dimension Properties

Inside a dimension block, the extension suggests:

- `type`
- `sql`
- `label`
- `description`
- `primary_key`
- And many more...

### Measure Properties

Inside a measure block, the extension suggests measure-specific properties.

### Type Suggestions

After typing `type:`, the extension suggests valid types based on the context (dimension or measure):

- `string`
- `number`
- `count`
- `sum`
- `average`
- etc.

### Field References

When typing a field reference (`${`), the extension suggests field names from the current file.

## Trigger Characters

Auto-completion is triggered by typing:

- `.` (dot)
- `:` (colon)
- `{` (open brace)
- `$` (dollar sign)

## Technical Implementation

The auto-completion provider works by:

1. Analyzing the current position in the document
2. Determining the current context (top-level, in a view, in a dimension, etc.)
3. Providing appropriate suggestions based on that context
4. Extracting field names from the document for field reference completion

### Limitations

- Field references only work for fields defined in the current file
- No support for cross-file references yet
- Limited support for SQL completion within SQL blocks
- No support for model references or explores from different files

## Future Enhancements

1. Cross-file references for fields and explores
2. SQL completion within SQL blocks
3. Snippets for common LookML patterns
4. Documentation hover information
5. Parameter value suggestions based on known valid values
