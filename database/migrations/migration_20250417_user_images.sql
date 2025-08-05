create type permission_level as ENUM(
    'admin',
    'gm',
    'contrib',
    'event',
    'player',
    'private'
);

alter table uploads add permission permission_level not null default 'contrib';

alter table campaigns_users add column image_id int;

alter table campaigns
    add column display_gallery boolean default false,
    add column player_gallery boolean default false;
