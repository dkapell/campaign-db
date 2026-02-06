alter table events add column costs jsonb default '[{"cost":0}]'::jsonb;
alter table attendance add column cost int, add column ticket varchar(80);

update events set costs = ('[{"name": "Default", "default": true, "cost":' || events.cost || '}]')::jsonb;
update attendance set ticket = 'Default' where attending = true;
update attendance
    set cost = events.cost
    from events
    where events.id = attendance.event_id and attendance.ticket = 'Default';

-- deploy here

-- alter table events drop column cost;
