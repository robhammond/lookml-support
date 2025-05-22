view: complex_derived_table {
  derived_table: {
    sql: 
SELECT
users.id as user_id,
users.first_name,
users.last_name,
COUNT(orders.id) as order_count,
SUM(order_items.sale_price) as total_revenue,
MIN(orders.created_at) as first_order_date,
MAX(orders.created_at) as latest_order_date,
CASE
  WHEN COUNT(orders.id) > 10 THEN 'High-Value'
  WHEN COUNT(orders.id) > 5 THEN 'Medium-Value'
  ELSE 'Low-Value'
END as customer_type
FROM users
LEFT JOIN orders ON orders.user_id = users.id
LEFT JOIN order_items ON order_items.order_id = orders.id
WHERE users.created_at >= DATEADD(year, -1, CURRENT_DATE())
AND orders.status = 'complete'
GROUP BY 1, 2, 3
HAVING COUNT(orders.id) > 0
ORDER BY total_revenue DESC
;;
    sql_trigger_value: SELECT MAX(created_at) FROM orders ;;
    partition_keys: ["created_date"]
    cluster_keys: ["user_id"]
    distribution: "user_id"
    indexes: ["user_id", "first_order_date"]
  }

  dimension: user_id {
    type: number
    primary_key: yes
    sql: ${TABLE}.user_id ;;
  }

  dimension: first_name {
    type: string
    sql: ${TABLE}.first_name ;;
  }

  dimension: last_name {
    type: string
    sql: ${TABLE}.last_name ;;
  }

  dimension: customer_type {
    type: string
    sql: ${TABLE}.customer_type ;;
  }

  dimension: full_name {
    type: string
    sql: CONCAT(${first_name}, ' ', ${last_name}) ;;
  }

  dimension_group: first_order {
    type: time
    timeframes: [date, week, month, quarter, year]
    sql: ${TABLE}.first_order_date ;;
  }

  dimension_group: latest_order {
    type: time
    timeframes: [date, week, month, quarter, year]
    sql: ${TABLE}.latest_order_date ;;
  }

  dimension: days_since_last_order {
    type: number
    sql: DATEDIFF(DAY, ${TABLE}.latest_order_date, CURRENT_DATE()) ;;
  }

  measure: order_count {
    type: sum
    sql: ${TABLE}.order_count ;;
  }

  measure: total_revenue {
    type: sum
    sql: ${TABLE}.total_revenue ;;
    value_format_name: usd
  }

  measure: average_revenue_per_order {
    type: number
    sql: ${total_revenue} / NULLIF(${order_count}, 0) ;;
    value_format_name: usd
  }
}