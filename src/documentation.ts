import * as vscode from 'vscode';

// Documentation for LookML elements
export interface LookMLDocumentation {
    description: string;
    example?: string;
    url?: string;
}

// Map of LookML elements to their documentation
export const LOOKML_DOCS: Record<string, LookMLDocumentation> = {
    // Top-level elements
    "view": {
        description: "A view defines a database table and the fields it contains.",
        example: "view: orders {\n  sql_table_name: public.orders ;;\n}",
        url: "https://docs.looker.com/reference/view-params/view"
    },
    "explore": {
        description: "An explore represents a view that users can query in the Looker UI.",
        example: "explore: orders {\n  join: users {\n    sql_on: ${orders.user_id} = ${users.id} ;;\n  }\n}",
        url: "https://docs.looker.com/reference/explore-params/explore"
    },
    "model": {
        description: "A model defines the explores that users can access in the Looker UI.",
        example: "model: ecommerce {\n  label: \"E-Commerce\"\n}",
        url: "https://docs.looker.com/reference/model-params/model"
    },
    "include": {
        description: "Imports view files or model files into the current file.",
        example: "include: \"views/*.view.lkml\"",
        url: "https://docs.looker.com/reference/model-params/include"
    },
    
    // View properties
    "sql_table_name": {
        description: "Specifies the database table that this view represents.",
        example: "sql_table_name: public.orders ;;",
        url: "https://docs.looker.com/reference/view-params/sql_table_name"
    },
    "derived_table": {
        description: "Defines a view using a SQL query rather than a database table.",
        example: "derived_table: {\n  sql: SELECT * FROM orders ;;\n}",
        url: "https://docs.looker.com/reference/view-params/derived_table"
    },
    "dimension": {
        description: "A field that represents a column in the underlying table or a calculation.",
        example: "dimension: id {\n  primary_key: yes\n  type: number\n}",
        url: "https://docs.looker.com/reference/field-params/dimension"
    },
    "measure": {
        description: "An aggregate calculation across multiple rows, such as a sum or count.",
        example: "measure: total_revenue {\n  type: sum\n  sql: ${revenue} ;;\n}",
        url: "https://docs.looker.com/reference/field-params/measure"
    },
    
    // Field properties
    "type": {
        description: "Specifies the data type for a field.",
        example: "type: string",
        url: "https://docs.looker.com/reference/field-params/type"
    },
    "sql": {
        description: "The SQL expression that defines this field.",
        example: "sql: ${TABLE}.user_id ;;",
        url: "https://docs.looker.com/reference/field-params/sql"
    },
    "label": {
        description: "The user-facing name for this field in the Looker UI.",
        example: "label: \"Customer Name\"",
        url: "https://docs.looker.com/reference/field-params/label"
    },
    "group_label": {
        description: "Groups this field with other fields under a common heading in the field picker.",
        example: "group_label: \"Customer Info\"",
        url: "https://docs.looker.com/reference/field-params/group_label"
    },
    "hidden": {
        description: "When set to yes, hides this field from the field picker.",
        example: "hidden: yes",
        url: "https://docs.looker.com/reference/field-params/hidden"
    },
    "primary_key": {
        description: "Marks this dimension as a primary key for the view.",
        example: "primary_key: yes",
        url: "https://docs.looker.com/reference/field-params/primary_key"
    },
    "description": {
        description: "A description of this field that appears when hovering over it in the Looker UI.",
        example: "description: \"The unique identifier for this order.\"",
        url: "https://docs.looker.com/reference/field-params/description"
    },
    
    // Type values
    "string": {
        description: "Represents text data.",
        url: "https://docs.looker.com/reference/field-params/dimension-type"
    },
    "number": {
        description: "Represents numeric data.",
        url: "https://docs.looker.com/reference/field-params/dimension-type"
    },
    "count": {
        description: "Counts the number of rows in a table.",
        url: "https://docs.looker.com/reference/field-params/measure-type"
    },
    "sum": {
        description: "Adds up all values of a dimension.",
        url: "https://docs.looker.com/reference/field-params/measure-type"
    },
    "average": {
        description: "Calculates the average of a dimension.",
        url: "https://docs.looker.com/reference/field-params/measure-type"
    },
    "yesno": {
        description: "Represents boolean (true/false) data.",
        url: "https://docs.looker.com/reference/field-params/dimension-type"
    },
    "date": {
        description: "Represents date data.",
        url: "https://docs.looker.com/reference/field-params/dimension-type"
    },
    "time": {
        description: "Represents time data.",
        url: "https://docs.looker.com/reference/field-params/dimension-type"
    },
    "datetime": {
        description: "Represents date and time data.",
        url: "https://docs.looker.com/reference/field-params/dimension-type"
    }
};

/**
 * Formats documentation for hover information
 */
export function formatDocumentation(element: string): vscode.MarkdownString | undefined {
    const doc = LOOKML_DOCS[element];
    if (!doc) return undefined;

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`### ${element}\n\n`);
    markdown.appendMarkdown(`${doc.description}\n\n`);
    
    if (doc.example) {
        markdown.appendMarkdown(`**Example:**\n\`\`\`lookml\n${doc.example}\n\`\`\`\n\n`);
    }
    
    if (doc.url) {
        markdown.appendMarkdown(`[Documentation](${doc.url})`);
    }
    
    markdown.isTrusted = true;
    
    return markdown;
}