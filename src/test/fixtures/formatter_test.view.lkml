view: formatter_test {
  sql_table_name: public.test_table ;;
  
  # Dimensions in random order to test sorting
  dimension: zebra {
    type: string
    sql: ${TABLE}.zebra ;;
  }
  
  measure: total_sales {
    type: sum
    sql: ${TABLE}.sales ;;
    value_format_name: usd
  }
  
  dimension: apple {
    type: string
    sql: ${TABLE}.apple ;;
  }
  
  # A measure in the middle to test grouping
  measure: count {
    type: count
    drill_fields: [id, name]
  }
  
  dimension: banana {
    type: string
    sql: ${TABLE}.banana ;;
  }
  
  dimension_group: created {
    type: time
    timeframes: [date, week, month, year]
    sql: ${TABLE}.created_at ;;
  }
  
  dimension: xray {
    type: number
    sql: ${TABLE}.xray ;;
  }
  
  # Another measure to test sorting of measures
  measure: average_value {
    type: average
    sql: ${TABLE}.value ;;
  }
  
  # Some non-dimension/measure fields to test they're preserved
  parameter: date_granularity {
    type: string
    allowed_values: {
      value: "Day"
    }
    allowed_values: {
      value: "Month"
    }
  }
  
  filter: date_filter {
    type: date
    sql: ${created_date} ;;
  }
  
  dimension_group: updated {
    type: time
    timeframes: [date, week, month]
    sql: ${TABLE}.updated_at ;;
  }
}