import { parseLookMLSync } from "../linter/parser";
import { ParsedLookML } from "../linter/types";

describe("LookML Parser", () => {
    describe("parseLookMLSync", () => {
        it("should parse a simple view", () => {
            const lookml = `
        view: users {
          sql_table_name: public.users ;;
          
          dimension: id {
            type: number
            primary_key: yes
            sql: \${TABLE}.id ;;
          }
          
          dimension: name {
            type: string
            sql: \${TABLE}.name ;;
          }
        }
      `;

            const result = parseLookMLSync(lookml);

            expect(result.views).toBeDefined();
            expect(result.views!.users).toBeDefined();
            expect(result.views!.users.name).toBe("users");
            expect(result.views!.users.sql_table_name).toContain("public.users");

            expect(result.views!.users.dimensions).toBeDefined();
            expect(result.views!.users.dimensions!.id).toBeDefined();
            expect(result.views!.users.dimensions!.id.type).toBe("number");
            expect(result.views!.users.dimensions!.id.primary_key).toBe(true);

            expect(result.views!.users.dimensions!.name).toBeDefined();
            expect(result.views!.users.dimensions!.name.type).toBe("string");
        });

        it("should parse derived tables", () => {
            const lookml = `
        view: user_summary {
          derived_table: {
            sql: SELECT id, name, COUNT(*) as order_count
                 FROM users u
                 JOIN orders o ON u.id = o.user_id
                 GROUP BY 1, 2 ;;
            sql_trigger_value: SELECT MAX(updated_at) FROM users ;;
          }
          
          dimension: id {
            type: number
            sql: \${TABLE}.id ;;
          }
        }
      `;

            const result = parseLookMLSync(lookml);

            expect(result.views!.user_summary).toBeDefined();
            expect(result.views!.user_summary.derived_table).toBeDefined();
            expect(result.views!.user_summary.derived_table!.sql).toContain("SELECT");
            expect(result.views!.user_summary.derived_table!.sql).toContain("COUNT(*)");
        });

        it("should parse explores with joins", () => {
            const lookml = `
        explore: orders {
          view_name: orders
          
          join: users {
            sql_on: \${orders.user_id} = \${users.id} ;;
            relationship: many_to_one
            view_label: "Customer"
          }
          
          join: products {
            sql_on: \${orders.product_id} = \${products.id} ;;
            relationship: many_to_one
          }
        }
      `;

            const result = parseLookMLSync(lookml);

            expect(result.explores).toBeDefined();
            expect(result.explores!.orders).toBeDefined();
            expect(result.explores!.orders.view_name).toContain("orders");

            expect(result.explores!.orders.joins).toBeDefined();
            expect(result.explores!.orders.joins!.users).toBeDefined();
            expect(result.explores!.orders.joins!.users.sql_on).toContain("orders.user_id");
            expect(result.explores!.orders.joins!.users.relationship).toContain("many_to_one");

            expect(result.explores!.orders.joins!.products).toBeDefined();
        });

        it("should parse models", () => {
            const lookml = `
        model: ecommerce {
          connection: "my_db"
          
          explore: orders {}
          explore: users {}
        }
      `;

            const result = parseLookMLSync(lookml);

            expect(result.models).toBeDefined();
            expect(result.models!.ecommerce).toBeDefined();
            expect(result.models!.ecommerce.connection).toContain("my_db");
        });

        it("should parse multiple field types", () => {
            const lookml = `
        view: orders {
          dimension: id {
            type: number
            primary_key: yes
          }
          
          dimension_group: created {
            type: time
            timeframes: [date, week, month]
          }
          
          measure: count {
            type: count
          }
          
          measure: total_amount {
            type: sum
            sql: \${amount} ;;
          }
          
          filter: date_filter {
            type: date
          }
        }
      `;

            const result = parseLookMLSync(lookml);
            const view = result.views!.orders;

            expect(view.dimensions!.id).toBeDefined();
            expect(view.dimension_groups!.created).toBeDefined();
            expect(view.measures!.count).toBeDefined();
            expect(view.measures!.total_amount).toBeDefined();
            expect(view.filters!.date_filter).toBeDefined();
        });

        it("should handle complex nested structures", () => {
            const lookml = `
        view: complex_view {
          sql_table_name: schema.complex_table ;;
          
          dimension: complex_field {
            type: string
            sql: CASE 
                   WHEN \${TABLE}.status = 'A' THEN 'Active'
                   WHEN \${TABLE}.status = 'I' THEN 'Inactive'
                   ELSE 'Unknown'
                 END ;;
            label: "Status Description"
            description: "Human readable status"
          }
        }
        
        explore: complex_explore {
          join: related_view {
            sql_on: \${complex_view.id} = \${related_view.complex_id} ;;
            relationship: one_to_many
          }
        }
      `;

            const result = parseLookMLSync(lookml);

            expect(result.views!.complex_view).toBeDefined();
            expect(result.explores!.complex_explore).toBeDefined();

            const field = result.views!.complex_view.dimensions!.complex_field;
            expect(field.sql).toContain("CASE");
            expect(field.label).toBeDefined();
        });

        it("should handle malformed LookML gracefully", () => {
            const malformedLookml = `
        view: broken {
          dimension: missing_type {
            sql: \${TABLE}.field
          }
          
          // Missing closing brace for dimension
          dimension: another_field {
            type: string
            
        // Missing closing brace for view
      `;

            expect(() => {
                const result = parseLookMLSync(malformedLookml);
                expect(result).toBeDefined();
                expect(result.views).toBeDefined();
            }).not.toThrow();
        });

        it("should handle empty input", () => {
            const result = parseLookMLSync("");

            expect(result).toBeDefined();
            expect(result.views).toBeDefined();
            expect(result.explores).toBeDefined();
            expect(result.models).toBeDefined();
            expect(Object.keys(result.views!)).toHaveLength(0);
        });

        it("should handle whitespace and comments", () => {
            const lookml = `
        # This is a comment
        
        view: users {
          # Another comment
          sql_table_name: public.users ;;
          
          dimension: id {
            # Field comment
            type: number
            primary_key: yes
          }
        }
        
        # Final comment
      `;

            const result = parseLookMLSync(lookml);

            expect(result.views!.users).toBeDefined();
            expect(result.views!.users.dimensions!.id).toBeDefined();
        });

        it("should handle includes (basic recognition)", () => {
            const lookml = `
        include: "*.view.lkml"
        include: "/shared/common.lkml"
        
        model: test {
          connection: "db"
        }
      `;

            const result = parseLookMLSync(lookml);

            // Parser might not extract includes to models, but should not crash
            expect(result).toBeDefined();
            expect(result.models!.test).toBeDefined();
        });

        it("should preserve field names with underscores and numbers", () => {
            const lookml = `
        view: test_view_123 {
          dimension: field_name_1 {
            type: string
          }
          
          measure: count_distinct_users_2024 {
            type: count_distinct
            sql: \${user_id} ;;
          }
        }
      `;

            const result = parseLookMLSync(lookml);

            expect(result.views!.test_view_123).toBeDefined();
            expect(result.views!.test_view_123.dimensions!.field_name_1).toBeDefined();
            expect(result.views!.test_view_123.measures!.count_distinct_users_2024).toBeDefined();
        });

        it("should handle SQL with special characters and operators", () => {
            const lookml = `
        view: users {
          dimension: computed_field {
            type: string
            sql: CONCAT(\${TABLE}.first_name, ' - ', \${TABLE}.last_name, ' (', \${TABLE}.id, ')') ;;
          }
          
          dimension: is_active {
            type: yesno
            sql: \${TABLE}.status = 'active' AND \${TABLE}.deleted_at IS NULL ;;
          }
        }
      `;

            const result = parseLookMLSync(lookml);

            const computedField = result.views!.users.dimensions!.computed_field;
            expect(computedField.sql).toContain("CONCAT");
            expect(computedField.sql).toContain("'");

            const activeField = result.views!.users.dimensions!.is_active;
            expect(activeField.sql).toContain("AND");
            expect(activeField.sql).toContain("IS NULL");
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle very large content without performance issues", () => {
            // Generate a large LookML file
            const largeLookml = Array.from(
                { length: 100 },
                (_, i) => `
        view: view_${i} {
          dimension: field_${i} {
            type: string
            sql: \${TABLE}.field_${i} ;;
          }
        }
      `,
            ).join("\n");

            const startTime = Date.now();
            const result = parseLookMLSync(largeLookml);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(Object.keys(result.views!)).toHaveLength(100);
        });

        it("should handle special characters in names", () => {
            const lookml = `
        view: view_with_123 {
          dimension: field_with_underscores_and_123 {
            type: string
          }
        }
      `;

            const result = parseLookMLSync(lookml);
            expect(result.views!.view_with_123).toBeDefined();
            expect(result.views!.view_with_123.dimensions!.field_with_underscores_and_123).toBeDefined();
        });
    });
});
