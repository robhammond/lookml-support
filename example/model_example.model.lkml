connection: "your_connection_name"

include: "derived_table_example.view.lkml"
include: "*.view.lkml"

explore: derived_table_example {
  label: "Orders Analysis"
  description: "Use this explore to analyze order data"
  
  join: users {
    type: left_outer
    sql_on: ${derived_table_example.user_id} = ${users.id} ;;
    relationship: many_to_one
  }
  
  join: products {
    type: left_outer
    sql_on: ${derived_table_example.product_id} = ${products.id} ;;
    relationship: many_to_one
  }
  
  always_filter: {
    filters: [derived_table_example.order_date: "30 days"]
  }
}