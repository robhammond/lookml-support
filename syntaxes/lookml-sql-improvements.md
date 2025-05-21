# SQL Syntax Highlighting Improvements for LookML

This document contains detailed suggestions for enhancing SQL syntax highlighting in LookML derived tables.

## Current Limitations

The current implementation has these limitations:
- No special handling for derived_table blocks and their SQL content
- Basic SQL highlighting that doesn't account for LookML-specific SQL patterns
- Limited support for nested SQL statements across multiple lines
- No specific handling for persistent derived tables vs ephemeral derived tables

## Proposed Grammar Changes

### 1. Enhanced Derived Table Detection

Add a specific pattern to detect derived_table blocks:

```json
{
  "name": "meta.derived-table.lookml",
  "begin": "\\b(derived_table)\\s*:\\s*\\{",
  "end": "\\}",
  "beginCaptures": {
    "1": { "name": "keyword.control.lookml" }
  },
  "patterns": [
    { "include": "#derived_table_contents" }
  ]
}
```

### 2. Specific SQL Block Pattern for Derived Tables

Create a dedicated pattern for SQL within derived tables:

```json
"derived_table_contents": {
  "patterns": [
    {
      "name": "meta.embedded.sql.derived-table.lookml",
      "begin": "\\b(sql)\\s*:\\s*",
      "end": ";;",
      "beginCaptures": {
        "1": {"name": "support.type.property-name.lookml"}
      },
      "endCaptures": {
        "0": { "name": "punctuation.terminator.sql-block.lookml" }
      },
      "contentName": "source.sql.embedded.lookml",
      "patterns": [
        { "include": "source.sql" },
        { "include": "#liquid" }
      ]
    },
    { "include": "#parameters" }
  ]
}
```

### 3. Improved SQL Keywords Recognition

Add LookML-specific SQL keywords:

```json
"sql_keywords": {
  "patterns": [
    {
      "name": "keyword.other.looker-sql.lookml",
      "match": "\\b(${TABLE}|${EXTENDED}|${SQL_TABLE_NAME})\\b"
    }
  ]
}
```

### 4. Better Handling of SQL Parameter Types

Add recognition of SQL-related parameters in derived tables:

```json
"parameters": {
  "patterns": [
    {
      "name": "variable.parameter.sql-related.lookml",
      "match": "\\b(sql_trigger_value|persist_for|cluster_keys|distribution|indexes|sortkeys|partition_keys|create_process|sql_create|sql_where|datagroup_trigger)\\s*:"
    }
  ]
}
```

## Implementation Notes

1. These improvements will provide better visual distinction between:
   - Regular LookML code
   - SQL code within derived tables
   - Special Looker SQL syntax elements

2. The enhanced grammar will help with:
   - Code navigation within large SQL blocks
   - Error identification in SQL syntax
   - Better readability with proper color highlighting

3. All SQL blocks should include the Liquid template patterns to ensure proper highlighting of Liquid tags within SQL.