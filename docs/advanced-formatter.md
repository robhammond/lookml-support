# LookML Advanced Formatter

This document describes the advanced formatting capabilities implemented in the LookML Support extension.

## Features

The advanced formatter provides the following capabilities:

### 1. Indentation

* Properly indents LookML blocks based on nesting level
* Maintains consistent indentation based on user preferences (spaces vs tabs)
* Preserves empty lines for readability

### 2. Property Formatting

* Ensures consistent spacing around property colons (e.g., `type: string` not `type:string`)
* Maintains alignment of property values within blocks
* Doesn't modify property values unless necessary

### 3. SQL Formatting

* Capitalizes SQL keywords (SELECT, FROM, WHERE, etc.)
* Properly indents SQL blocks within LookML
* Adds spaces around SQL operators for readability
* Preserves SQL blocks that contain Liquid templates or LookML variables

### 4. Block Structure

* Ensures proper placement of opening and closing braces
* Maintains consistent block structure according to LookML conventions
* Preserves SQL terminators (`;;`) with proper spacing

## Technical Implementation

The formatter works by parsing the LookML document line by line and tracking context:

1. **Block Tracking**: The formatter maintains a stack of block contexts to understand the current nesting level. This allows it to properly indent based on the block type and depth.

2. **SQL Block Detection**: The formatter detects SQL blocks (those ending with `;;`) and applies special SQL formatting rules within these blocks.

3. **Liquid Template Preservation**: Special care is taken to not reformat Liquid template tags (`{% %}` and `{{ }}`) or LookML variables (`${...}`), as these need to maintain their exact structure.

4. **Line-by-Line Processing**: Each line is processed individually while maintaining context from previous lines, allowing for efficient and targeted formatting.

## Customization

The formatter respects VS Code's editor settings for:

* Tab size
* Use of spaces vs tabs for indentation
* End of line character (LF vs CRLF)

## Improvements in the Updated Formatter

The formatter was improved to address several issues:

1. **Block Tracking**: Uses a stack to track block types and maintain proper indentation context

2. **SQL Keyword Handling**: Improved regex patterns for SQL keywords to ensure consistent capitalization of keywords like "WHERE" and "AND"

3. **Property Formatting**: Enhanced handling of property-value pairs with special handling for complex values (quoted strings, arrays)

4. **SQL Block Termination**: Better handling of SQL blocks ending with ";;" to ensure consistent placement

5. **Indentation Management**: More robust tracking of code blocks to maintain proper indentation

## Limitations

* The formatter does not perform deep SQL query restructuring
* For complex SQL with multiple nested subqueries, only basic formatting is applied
* The formatter may not handle extremely large files (10,000+ lines) efficiently
* SQL keywords within string literals may be incorrectly capitalized

## Future Enhancements

1. **AST-based Parsing**: Replace the line-by-line approach with a proper Abstract Syntax Tree parser for more accurate formatting

2. **SQL Query Restructuring**: Add support for restructuring complex SQL queries with proper line breaks and indentation

3. **Format Selection**: Add support for formatting only selected text rather than the entire document

4. **Format Configuration**: Add user-configurable settings for formatter behavior