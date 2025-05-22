view: sql_format_test {
derived_table: {
sql: 
SELECT
user_id,
first_name,
last_name,
SUM(amount) as total_amount,
COUNT(*) as order_count,
CASE
WHEN SUM(amount) > 1000 THEN 'High Value'
WHEN SUM(amount) > 500 THEN 'Medium Value'
ELSE 'Low Value'
END as customer_segment
FROM orders
JOIN users ON orders.user_id = users.id
WHERE orders.status = 'complete'
AND orders.created_at >= DATEADD(day, -90, CURRENT_DATE())
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1
ORDER BY total_amount DESC
;;
}

dimension: user_id {
type: number
primary_key: yes
sql: ${TABLE}.user_id ;;
}

measure: total_amount {
type: sum
sql: ${TABLE}.total_amount ;;
value_format_name: usd
}
}