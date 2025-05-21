view: orders {
  sql_table_name: public.orders ;;
  
  dimension: id {
    primary_key: yes
    type: number
    sql: ${TABLE}.id ;;
  }
  
  dimension: user_id {
    type: number
    sql: ${TABLE}.user_id ;;
  }
  
  dimension_group: created {
    type: time
    timeframes: [
      raw,
      time,
      date,
      week,
      month,
      quarter,
      year
    ]
    sql: ${TABLE}.created_at ;;
  }
  
  measure: count {
    type: count
    drill_fields: [id, user_id]
  }
}

view: users {
  sql_table_name: public.users ;;
  
  dimension: id {
    primary_key: yes
    type: number
    sql: ${TABLE}.id ;;
  }
  
  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }
  
  dimension: email {
    type: string
    sql: ${TABLE}.email ;;
  }
  
  measure: count {
    type: count
    drill_fields: [id, name, email]
  }
  
  # This would trigger the F1 rule
  dimension: order_count {
    type: number
    sql: ${orders.count} ;;
  }
}

explore: orders {
  join: users {
    # This would trigger the E1 rule
    sql_on: orders.user_id = users.id ;;
    relationship: many_to_one
  }
}