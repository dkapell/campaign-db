alter table events add column hide_attendees boolean default false;
alter table campaigns add column user_type_map jsonb;
