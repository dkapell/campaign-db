alter table campaigns_users
    add column data jsonb,
    add column last_login timestamp with time zone;

alter table campaigns add column allow_player_dark_mode boolean default false;
