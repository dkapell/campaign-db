alter table campaigns add column timezone varchar(80) default ('America/New_York');
alter table events add column hidden_fields jsonb default '[]'::jsonb;
