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
  
  dimension_group: created {
    type: time
    timeframes: [date, week, month, year]
    sql: ${TABLE}.created_at ;;
  }
  
  dimension: age {
    type: number
    sql: ${TABLE}.age ;;
  }
  
  measure: count {
    type: count
    drill_fields: [id, name, email]
  }
  
  measure: average_age {
    type: average
    sql: ${age} ;;
    value_format_name: decimal_2
  }
}