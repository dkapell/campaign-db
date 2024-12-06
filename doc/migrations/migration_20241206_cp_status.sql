create type cp_grant_status as ENUM (
    'pending',
    'denied',
    'approved'
);

alter table cp_grant 
    add column status cp_grant_status default 'pending',
    add column updated timestamp with time zone DEFAULT now();

update cp_grant set status = 'approved' where approved = true;
alter table cp_grant drop column approved;
