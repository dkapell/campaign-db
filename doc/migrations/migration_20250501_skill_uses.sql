alter table skill_usages
    add column display_uses boolean default false,
    add column usage_format varchar(80);
alter table skills add column uses int not null default 1;
