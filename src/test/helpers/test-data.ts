import { ParsedLookML } from '../../linter/types';

/**
 * Test data helpers for creating mock LookML objects
 */

export function createMockView(overrides: any = {}): any {
  return {
    name: 'test_view',
    sql_table_name: 'public.test_table',
    dimensions: {},
    measures: {},
    filters: {},
    ...overrides
  };
}

export function createMockDimension(overrides: any = {}): any {
  return {
    name: 'test_dimension',
    type: 'string',
    sql: '${TABLE}.test_field',
    ...overrides
  };
}

export function createMockMeasure(overrides: any = {}): any {
  return {
    name: 'test_measure',
    type: 'count',
    sql: '${TABLE}.id',
    ...overrides
  };
}

export function createMockExplore(overrides: any = {}): any {
  return {
    name: 'test_explore',
    view_name: 'test_view',
    joins: {},
    ...overrides
  };
}

export function createMockJoin(overrides: any = {}): any {
  return {
    sql_on: '${view1.id} = ${view2.foreign_id}',
    relationship: 'many_to_one',
    ...overrides
  };
}

export function createMockLookML(overrides: Partial<ParsedLookML> = {}): ParsedLookML {
  return {
    views: {},
    explores: {},
    models: {},
    ...overrides
  };
}

/**
 * Sample LookML content for testing
 */
export const SAMPLE_LOOKML_CONTENT = {
  SIMPLE_VIEW: `
    view: users {
      sql_table_name: public.users ;;
      
      dimension: id {
        primary_key: yes
        type: number
        sql: \${TABLE}.id ;;
      }
      
      dimension: name {
        type: string
        sql: \${TABLE}.name ;;
      }
      
      measure: count {
        type: count
      }
    }
  `,

  DERIVED_TABLE_VIEW: `
    view: user_summary {
      derived_table: {
        sql: SELECT 
               user_id,
               COUNT(*) as order_count,
               SUM(amount) as total_spent
             FROM orders
             GROUP BY 1 ;;
        sql_trigger_value: SELECT MAX(updated_at) FROM orders ;;
      }
      
      dimension: user_id {
        type: number
        primary_key: yes
        sql: \${TABLE}.user_id ;;
      }
      
      measure: total_orders {
        type: sum
        sql: \${TABLE}.order_count ;;
      }
    }
  `,

  EXPLORE_WITH_JOINS: `
    explore: orders {
      join: users {
        sql_on: \${orders.user_id} = \${users.id} ;;
        relationship: many_to_one
      }
      
      join: products {
        sql_on: \${orders.product_id} = \${products.id} ;;
        relationship: many_to_one
      }
    }
  `,

  MALFORMED_LOOKML: `
    view: broken {
      dimension: missing_closing {
        type: string
        sql: \${TABLE}.field
      // Missing closing brace
      
      dimension: another_field {
        type: number
      }
    // Missing view closing brace
  `,

  COMPLEX_FORMATTING: `
view:complex_example{
derived_table:{
sql:
select
users.id as user_id,
users.name as user_name,
count(*) as order_count
from users
left join orders on users.id = orders.user_id
where users.status = 'active'
group by 1,2
;;
}

dimension:user_id {
  type:number
  primary_key:yes
  sql:\${TABLE}.user_id;;
}

measure:total_orders{
type:sum
sql:\${order_count};;
}
}
  `,

  WITH_VIOLATIONS: `
    view: users {
      sql_table_name: public.users ;;
      
      # Missing primary key - K1 violation
      dimension: user_id {
        type: number
        sql: \${TABLE}.id ;;
      }
      
      # Cross-view reference - F1 violation
      dimension: order_count {
        type: number
        sql: \${orders.count} ;;
      }
    }
    
    explore: users {
      join: orders {
        # Direct table reference - E1 violation
        sql_on: users.id = orders.user_id ;;
        relationship: one_to_many
      }
    }
  `
};

/**
 * Expected formatted results for testing
 */
export const EXPECTED_FORMATTED_CONTENT = {
  SIMPLE_PROPERTY: 'type: string',
  SIMPLE_BLOCK: `view: users {
  dimension: id {
    type: number
  }
}`,
  
  SQL_KEYWORDS: 'SELECT * FROM users WHERE id = 1',
  
  COMPLEX_FORMATTED: `view: complex_example {
  derived_table: {
    sql:
      SELECT
      users.id as user_id,
      users.name as user_name,
      COUNT(*) as order_count
      FROM users
      LEFT JOIN orders ON users.id = orders.user_id
      WHERE users.status = 'active'
      GROUP BY 1, 2
    ;;
  }

  dimension: user_id {
    type: number
    primary_key: yes
    sql: \${TABLE}.user_id;;
  }

  measure: total_orders {
    type: sum
    sql: \${order_count};;
  }
}`
};

/**
 * Test violations for linter rule testing
 */
export const TEST_VIOLATIONS = {
  K1_MISSING_PK: {
    ruleId: 'k1',
    message: 'View "users" is missing a primary key dimension',
    severity: 'warning',
    path: ['views', 'users']
  },
  
  K1_BAD_NAMING: {
    ruleId: 'k1',
    message: 'Primary key dimension "user_id" in view "users" should follow naming convention (pk)',
    severity: 'warning',
    path: ['views', 'users', 'dimensions', 'user_id']
  },
  
  E1_DIRECT_REF: {
    ruleId: 'e1',
    message: 'Join "orders" in explore "users" uses direct table reference "users.id" - use ${} substitution instead',
    severity: 'warning',
    path: ['explores', 'users', 'joins', 'orders', 'sql_on']
  },
  
  F1_CROSS_VIEW: {
    ruleId: 'f1',
    message: 'dimension "order_count" in view "users" references another view via "orders.count"',
    severity: 'warning',
    path: ['views', 'users', 'dimensions', 'order_count', 'sql']
  }
};