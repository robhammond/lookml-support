import { LookMLFormatter, createLookMLFormattingProvider } from "../formatter";
import * as vscode from "./vscode.mock";

// Mock the vscode module entirely for this test
jest.mock("vscode", () => {
    const mockVscode = jest.requireActual("./vscode.mock");
    return {
        ...mockVscode,
        workspace: {
            getConfiguration: jest.fn().mockImplementation((section) => {
                return {
                    get: jest.fn().mockImplementation((key, defaultValue) => {
                        if (key === "formatter.groupFieldsByType") return true;
                        if (key === "formatter.sortFields") return true;
                        return defaultValue;
                    }),
                };
            }),
        },
    };
}, { virtual: true });

describe("LookMLFormatter", () => {
    const options: vscode.FormattingOptions = {
        tabSize: 4,
        insertSpaces: true,
    };

    // Helper function to create a TextDocument from a string
    function createDocument(content: string): vscode.TextDocument {
        return new vscode.TextDocument(content);
    }

    // Helper function to apply formatting and get the result
    function formatDocument(document: vscode.TextDocument): string {
        const formatter = new LookMLFormatter(options, { groupFieldsByType: true, sortFields: true });

        try {
            const edits = formatter.format(document as any);

            if (edits.length === 0) {
                return document.getText();
            }

            // Apply the edits to get the formatted content
            // Just take the first edit since our implementation returns a single edit
            const edit = edits[0];
            const originalText = document.getText();
            return (
                originalText.substring(0, document.offsetAt(edit.range.start)) +
                edit.newText +
                originalText.substring(document.offsetAt(edit.range.end))
            );
        } catch (error) {
            console.error("Error formatting document:", error);
            return document.getText();
        }
    }

    describe("Basic Formatting", () => {
        test("should correctly format indentation and property spacing", () => {
            const input = `view: basic_test {
dimension: id {
type:number
primary_key:yes
sql:\$\{TABLE}.id;;
}
}`;

            const expected = `view: basic_test {

    # ----- Dimensions -----

    dimension: id {
        type: number
        primary_key: yes
        sql: \$\{TABLE}.id ;;
    }
    # ----- End of Dimensions -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });

        test("should handle empty lines and comments properly", () => {
            const input = `view: comment_test {
# This is a comment
dimension: id {
# This is a field comment
type:number

sql:\$\{TABLE}.id;;
}
}`;

            const expected = `view: comment_test {
    # This is a comment

    # ----- Dimensions -----

    # This is a field comment
    dimension: id {
        type: number
        sql: \$\{TABLE}.id ;;
    }
    # ----- End of Dimensions -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });
    });

    describe("Model File Formatting", () => {
        test("should correctly format model files", () => {
            const input = `connection:"your_connection_name"
include:"derived_table_example.view.lkml"
include:"*.view.lkml"

explore:users {
join:orders {
sql_on:\$\{users.id} = \$\{orders.user_id};;
type:left_outer
relationship:one_to_many
}
}`;

            const expected = `connection: "your_connection_name"
include: "derived_table_example.view.lkml"
include: "*.view.lkml"

explore: users {
    join: orders {
        sql_on: \$\{users.id} = \$\{orders.user_id} ;;
        type: left_outer
        relationship: one_to_many
    }
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });

        test("should properly format complex model files with multiple explores", () => {
            const input = `connection: "your_connection_name"
include:"*.view.lkml"

datagroup:daily_refresh {
sql_trigger:SELECT CURRENT_DATE;;
max_cache_age:"24 hours"
}

explore:users {
label:"User Data"
description:"Explore user information"

join:orders {
type:left_outer
sql_on:\$\{users.id} = \$\{orders.user_id};;
relationship:one_to_many
}

always_filter:{
filters:[users.created_date: "1 year"]
}
}

explore:orders {
join:users {
type:left_outer
sql_on:\$\{orders.user_id} = \$\{users.id};;
relationship:many_to_one
}
}`;

            const expected = `connection: "your_connection_name"
include: "*.view.lkml"

datagroup: daily_refresh {
    sql_trigger: SELECT CURRENT_DATE ;;
    max_cache_age: "24 hours"
}

explore: users {
    label: "User Data"
    description: "Explore user information"

    join: orders {
        type: left_outer
        sql_on: \$\{users.id} = \$\{orders.user_id} ;;
        relationship: one_to_many
    }

    always_filter: {
        filters: [users.created_date: "1 year"]
    }
}

explore: orders {
    join: users {
        type: left_outer
        sql_on: \$\{orders.user_id} = \$\{users.id} ;;
        relationship: many_to_one
    }
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });
    });

    describe("Multiple Formatting Operations", () => {
        test("should not duplicate comment separators when formatting multiple times", () => {
            const input = `view: duplicate_test {
dimension: id {
type:number
primary_key:yes
sql:\$\{TABLE}.id;;
}
}`;

            // First format
            const document = createDocument(input);
            let result = formatDocument(document);

            // Second format - should not introduce duplicate comment separators
            const secondDocument = createDocument(result);
            const secondResult = formatDocument(secondDocument);

            // Third format - should still not introduce more duplicates
            const thirdDocument = createDocument(secondResult);
            const thirdResult = formatDocument(thirdDocument);

            expect(secondResult).toBe(result);
            expect(thirdResult).toBe(result);
        });

        test("should maintain consistent formatting across multiple operations", () => {
            const input = `view: multiple_format_test {
measure: count {
type:count
}
dimension: id {
type:number
}
}`;

            // Expectation for a properly formatted document
            const expected = `view: multiple_format_test {

    # ----- Dimensions -----

    dimension: id {
        type: number
    }
    # ----- End of Dimensions -----

    # ----- Measures -----

    measure: count {
        type: count
    }
    # ----- End of Measures -----
}`;

            // First format
            const document = createDocument(input);
            const result = formatDocument(document);

            // Second format - should be identical to first result
            const secondDocument = createDocument(result);
            const secondResult = formatDocument(secondDocument);

            expect(result).toBe(expected);
            expect(secondResult).toBe(expected);
        });
    });

    describe("SQL Formatting in Derived Tables", () => {
        test("should properly indent SQL in derived tables", () => {
            const input = `view: derived_table_test {
derived_table: {
sql:
SELECT
id,
created_at,
user_id
FROM orders
WHERE created_at > '2020-01-01'
GROUP BY 1,2,3
;;
}

dimension: id {
type: number
primary_key: yes
sql: \$\{TABLE}.id ;;
}
}`;

            const expected = `view: derived_table_test {
    derived_table: {
        sql:
            SELECT
                id,
                created_at,
                user_id
            FROM orders
            WHERE created_at > '2020-01-01'
            GROUP BY 1,2,3
        ;;
    }

    # ----- Dimensions -----

    dimension: id {
        type: number
        primary_key: yes
        sql: \$\{TABLE}.id ;;
    }
    # ----- End of Dimensions -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });

        test("should handle SQL with LookML variables", () => {
            const input = `view: sql_vars_test {
derived_table: {
sql:
select
orders.id,
\$\{user_id_param} as user_id
from orders
where \$\{TABLE}.status = 'complete'
;;
}

dimension: id {
type: number
sql: \$\{TABLE}.id ;;
}
}`;

            const expected = `view: sql_vars_test {
    derived_table: {
        sql:
            SELECT
                orders.id,
                \$\{user_id_param} as user_id
            FROM orders
            WHERE \$\{TABLE}.status = 'complete'
        ;;
    }

    # ----- Dimensions -----

    dimension: id {
        type: number
        sql: \$\{TABLE}.id ;;
    }
    # ----- End of Dimensions -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });

        test("should handle SQL with Liquid templates", () => {
            const input = `view: liquid_template_test {
derived_table: {
sql:
select
orders.id,
orders.created_at
from orders
where 
{% if order_date._is_filtered %}
\$\{TABLE}.created_at >= {% date_start order_date %} 
and \$\{TABLE}.created_at <= {% date_end order_date %}
{% else %}
\$\{TABLE}.created_at >= dateadd(month, -1, current_date())
{% endif %}
;;
}

dimension: id {
type: number
sql: \$\{TABLE}.id ;;
}
}`;

            const expected = `view: liquid_template_test {
    derived_table: {
        sql:
            SELECT
                orders.id,
                orders.created_at
            FROM orders
            WHERE
            {% if order_date._is_filtered %}
                \$\{TABLE}.created_at >= {% date_start order_date %} 
                AND \$\{TABLE}.created_at <= {% date_end order_date %}
            {% else %}
                \$\{TABLE}.created_at >= dateadd(month, -1, current_date())
            {% endif %}
        ;;
    }

    # ----- Dimensions -----

    dimension: id {
        type: number
        sql: \$\{TABLE}.id ;;
    }
    # ----- End of Dimensions -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });
    });

    describe("Complex Formatting Test Cases", () => {
        test("should correctly handle nested blocks in dimensions", () => {
            const input = `view: nested_blocks_test {
dimension: complex_html {
type: string
html:
{% if value > 0 %}
<span style="color:green">{{ value }}</span>
{% else %}
<span style="color:red">{{ value }}</span>
{% endif %}
;;
}
}`;

            const expected = `view: nested_blocks_test {

    # ----- Dimensions -----

    dimension: complex_html {
        type: string
        html:
            {% if value > 0 %}
                <span style="color:green">{{ value }}</span>
            {% else %}
                <span style="color:red">{{ value }}</span>
            {% endif %}
        ;;
    }
    # ----- End of Dimensions -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });

        test("should handle multiple SQL blocks within a view", () => {
            const input = `view: multiple_sql_test {
derived_table: {
sql:
SELECT id, user_id FROM orders
;;
}

dimension: order_count {
type: number
sql:
SELECT COUNT(*)
FROM order_items
WHERE order_id = \$\{TABLE}.id
;;
}

measure: total_orders {
type: sum
sql: \$\{order_count} ;;
}
}`;

            const expected = `view: multiple_sql_test {
    derived_table: {
        sql:
            SELECT id, user_id FROM orders
        ;;
    }

    # ----- Dimensions -----

    dimension: order_count {
        type: number
        sql:
            SELECT COUNT(*)
            FROM order_items
            WHERE order_id = \$\{TABLE}.id
        ;;
    }
    # ----- End of Dimensions -----

    # ----- Measures -----

    measure: total_orders {
        type: sum
        sql: \$\{order_count} ;;
    }
    # ----- End of Measures -----
}`;

            const document = createDocument(input);
            const result = formatDocument(document);
            expect(result).toBe(expected);
        });
    });
});

describe("LookMLFormattingProvider", () => {
    test("should create a formatter provider", () => {
        const provider = createLookMLFormattingProvider();
        expect(provider).toBeDefined();
        expect(provider.provideDocumentFormattingEdits).toBeDefined();
    });
});
