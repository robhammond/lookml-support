view: derived_table_example {
  derived_table: {
    sql: 
      SELECT
        orders.id as order_id,
        orders.created_at as order_date,
        users.id as user_id,
        users.name as user_name,
        SUM(order_items.sale_price) as total_amount
      FROM orders
      LEFT JOIN users ON orders.user_id = users.id
      LEFT JOIN order_items ON order_items.order_id = orders.id
      WHERE {% condition date_filter %} orders.created_at {% endcondition %}
      AND ${TABLE}.status = 'complete'
      GROUP BY 1, 2, 3, 4
      ;;
    sql_trigger_value: SELECT MAX(created_at) FROM orders ;;
    persist_for: "24 hours"
    indexes: ["order_id", "user_id"]
  }

  dimension: order_id {
    type: number
    primary_key: yes
    sql: ${TABLE}.order_id ;;
  }

  dimension_group: order {
    type: time
    timeframes: [date, week, month, year]
    sql: ${TABLE}.order_date ;;
  }

  dimension: user_id {
    type: number
    sql: ${TABLE}.user_id ;;
  }

  dimension: user_name {
    type: string
    sql: ${TABLE}.user_name ;;
  }

  measure: total_amount {
    type: sum
    sql: ${TABLE}.total_amount ;;
    value_format_name: usd
  }

  measure: average_order_amount {
    type: average
    sql: ${TABLE}.total_amount ;;
    value_format_name: usd
  }

  filter: date_filter {
    type: date
  }
}