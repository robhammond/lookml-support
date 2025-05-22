view: derived_table_with_bugs {
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
sql: ${TABLE}.id ;;
}
}