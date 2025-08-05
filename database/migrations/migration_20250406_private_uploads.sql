alter table uploads add column is_public boolean default false;
update uploads set is_public = true;
