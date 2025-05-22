view:complex_example{
derived_table:{
sql:
select
users.id as user_id,
users.name as user_name,
count(*) as order_count,
sum(orders.amount) as total_amount,
max(orders.created_at) as latest_order
from users
left join orders on users.id = orders.user_id
where ${TABLE}.status = 'complete'
and orders.created_at >= dateadd(day, -90, current_date())
group by 1,2
having count(*) > 0
order by total_amount desc
;;
sql_trigger_value:select current_date;;
persist_for:"24 hours"
}

dimension:user_id {
  type:number
  primary_key:yes
  sql:${TABLE}.user_id;;
  description:"Unique identifier for the user"
}

dimension:user_name{
type:string
sql:${TABLE}.user_name ;;
}

dimension:order_count{
type:number
sql:${TABLE}.order_count;;
}

measure:total_order_count{
type:sum
sql:${order_count};;
}

dimension:total_amount{
type:number
sql:${TABLE}.total_amount;;
value_format_name:"usd"
}

dimension_group:latest_order{
type:time
timeframes:[date,week,month,quarter,year]
sql:${TABLE}.latest_order;;
}

measure:average_order_value{
type:average
sql:${total_amount};;
value_format_name:"usd"
drill_fields:[user_id,user_name,total_amount]
}

filter:date_range{
type:date
}
}