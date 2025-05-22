import { applyRules } from "../linter/rules";
import { ParsedLookML } from "../linter/types";

describe("LookML Linter Rules", () => {
    describe("K1 Rule - Primary Key Validation", () => {
        it("should pass when view has properly named primary key", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            pk: {
                                name: "pk",
                                type: "number",
                                primary_key: true,
                                sql: "${TABLE}.id",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["k1"]);
            expect(violations).toHaveLength(0);
        });

        it("should flag view missing primary key", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            name: {
                                name: "name",
                                type: "string",
                                sql: "${TABLE}.name",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["k1"]);
            expect(violations).toHaveLength(1);
            expect(violations[0].ruleId).toBe("k1");
            expect(violations[0].message).toContain("missing a primary key");
        });

        it("should flag poorly named primary key", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            user_id: {
                                name: "user_id",
                                type: "number",
                                primary_key: true,
                                sql: "${TABLE}.id",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["k1"]);
            expect(violations).toHaveLength(1);
            expect(violations[0].ruleId).toBe("k1");
            expect(violations[0].message).toContain("naming convention");
        });

        it("should accept pk1, pk2 naming variations", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            pk1: {
                                name: "pk1",
                                type: "number",
                                primary_key: true,
                                sql: "${TABLE}.id",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["k1"]);
            expect(violations).toHaveLength(0);
        });

        it("should skip views without table definition", () => {
            const lookml: ParsedLookML = {
                views: {
                    temp_view: {
                        name: "temp_view",
                        // No sql_table_name or derived_table
                        dimensions: {
                            name: {
                                name: "name",
                                type: "string",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["k1"]);
            expect(violations).toHaveLength(0);
        });
    });

    describe("E1 Rule - Join Reference Validation", () => {
        it("should pass with proper LookML substitution", () => {
            const lookml: ParsedLookML = {
                explores: {
                    orders: {
                        name: "orders",
                        joins: {
                            users: {
                                sql_on: "${orders.user_id} = ${users.id}",
                                relationship: "many_to_one",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["e1"]);
            expect(violations).toHaveLength(0);
        });

        it("should flag direct table references", () => {
            const lookml: ParsedLookML = {
                explores: {
                    orders: {
                        name: "orders",
                        joins: {
                            users: {
                                sql_on: "orders.user_id = users.id",
                                relationship: "many_to_one",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["e1"]);
            expect(violations).toHaveLength(2); // Both orders.user_id and users.id
            expect(violations[0].ruleId).toBe("e1");
            expect(violations[0].message).toContain("direct table reference");
        });

        it("should ignore safe. prefixed references", () => {
            const lookml: ParsedLookML = {
                explores: {
                    orders: {
                        name: "orders",
                        joins: {
                            users: {
                                sql_on: "${orders.user_id} = safe.users.id",
                                relationship: "many_to_one",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["e1"]);
            expect(violations).toHaveLength(0);
        });

        it("should handle liquid template tags", () => {
            const lookml: ParsedLookML = {
                explores: {
                    orders: {
                        name: "orders",
                        joins: {
                            users: {
                                sql_on: "{% if condition %} ${orders.user_id} = ${users.id} {% endif %}",
                                relationship: "many_to_one",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["e1"]);
            expect(violations).toHaveLength(0);
        });
    });

    describe("F1 Rule - Cross-View Reference Validation", () => {
        it("should pass with same-view references", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            full_name: {
                                name: "full_name",
                                type: "string",
                                sql: "concat(${users.first_name}, ${users.last_name})",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["f1"]);
            expect(violations).toHaveLength(0);
        });

        it("should flag cross-view references in SQL", () => {
            const lookml: ParsedLookML = {
                views: {
                    orders: {
                        name: "orders",
                        sql_table_name: "public.orders",
                        dimensions: {
                            user_name: {
                                name: "user_name",
                                type: "string",
                                sql: "${users.name}",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["f1"]);
            expect(violations).toHaveLength(1);
            expect(violations[0].ruleId).toBe("f1");
            expect(violations[0].message).toContain("references another view");
        });

        it("should flag cross-view references in HTML", () => {
            const lookml: ParsedLookML = {
                views: {
                    orders: {
                        name: "orders",
                        sql_table_name: "public.orders",
                        dimensions: {
                            order_link: {
                                name: "order_link",
                                type: "string",
                                html: '<a href="/user/${users.id}">View User</a>',
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["f1"]);
            expect(violations).toHaveLength(1);
            expect(violations[0].message).toContain("references another view in HTML");
        });

        it("should ignore TABLE references", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            id: {
                                name: "id",
                                type: "number",
                                sql: "${TABLE}.id",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["f1"]);
            expect(violations).toHaveLength(0);
        });

        it("should handle multiple field types", () => {
            const lookml: ParsedLookML = {
                views: {
                    orders: {
                        name: "orders",
                        sql_table_name: "public.orders",
                        dimensions: {
                            bad_dim: {
                                name: "bad_dim",
                                sql: "${users.name}",
                            },
                        },
                        measures: {
                            bad_measure: {
                                name: "bad_measure",
                                sql: "${products.price}",
                            },
                        },
                        filters: {
                            bad_filter: {
                                name: "bad_filter",
                                sql: "${customers.region}",
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["f1"]);
            expect(violations).toHaveLength(3);
            expect(violations.map((v) => v.message)).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('dimension "bad_dim"'),
                    expect.stringContaining('measure "bad_measure"'),
                    expect.stringContaining('filter "bad_filter"'),
                ]),
            );
        });
    });

    describe("Multiple Rules", () => {
        it("should apply multiple rules and return all violations", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            bad_ref: {
                                name: "bad_ref",
                                sql: "${orders.total}", // F1 violation
                            },
                            // Missing primary key - K1 violation
                        },
                    },
                },
                explores: {
                    users: {
                        name: "users",
                        joins: {
                            orders: {
                                sql_on: "users.id = orders.user_id", // E1 violation
                            },
                        },
                    },
                },
            };

            const violations = applyRules(lookml, ["k1", "e1", "f1"]);
            expect(violations.length).toBeGreaterThan(2);

            const ruleIds = violations.map((v) => v.ruleId);
            expect(ruleIds).toContain("k1");
            expect(ruleIds).toContain("e1");
            expect(ruleIds).toContain("f1");
        });

        it("should only apply enabled rules", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                        dimensions: {
                            bad_ref: {
                                name: "bad_ref",
                                sql: "${orders.total}",
                            },
                        },
                    },
                },
            };

            // Only enable F1 rule
            const violations = applyRules(lookml, ["f1"]);
            expect(violations).toHaveLength(1);
            expect(violations[0].ruleId).toBe("f1");
        });

        it("should handle empty LookML", () => {
            const lookml: ParsedLookML = {};
            const violations = applyRules(lookml, ["k1", "e1", "f1"]);
            expect(violations).toHaveLength(0);
        });

        it("should handle unknown rule IDs gracefully", () => {
            const lookml: ParsedLookML = {
                views: {
                    users: {
                        name: "users",
                        sql_table_name: "public.users",
                    },
                },
            };

            // Include an invalid rule ID
            const violations = applyRules(lookml, ["k1", "invalid_rule", "f1"]);

            // Should not throw and should process valid rules
            expect(() => violations).not.toThrow();
        });
    });
});
