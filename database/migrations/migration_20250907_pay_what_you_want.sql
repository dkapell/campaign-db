alter table event_addons add column pay_what_you_want boolean not null default false;
alter table event_addons add column minimum int default 0;
alter table attendance_addons add column cost int;
