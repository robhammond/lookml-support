connection:"your_connection_name"
include:"derived_table_example.view.lkml"
include:"*.view.lkml"

explore:users {
join:orders {
sql_on:${users.id} = ${orders.user_id};;
type:left_outer
relationship:one_to_many
}
}