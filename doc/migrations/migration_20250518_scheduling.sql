create type day_of_week as enum (
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
);
create type timeslot_type as enum (
    'regular', 'special', 'meal'
);
create table timeslots(
    id serial,
    campaign_id int not null,
    day day_of_week not null,
    start_hour int not null,
    start_minute int not null default 0,
    length int,
    type timeslot_type not null default 'regular',
    primary key(id),
    CONSTRAINT timeslot_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table locations(
    id serial,
    campaign_id int not null,
    name varchar(80),
    display_order int,
    multiple_scenes boolean default false,
    combat boolean default false,
    primary key(id),
    CONSTRAINT locations_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type tag_type as enum(
    'glossary',
    'scene',
    'user',
    'location'
);

alter table glossary_tags rename to tags;
alter table tags add column type tag_type default 'glossary';

create type scene_status as enum(
    'new',
    'ready',
    'scheduled',
    'confirmed',
    'postponed'
);

create table scenes (
    id serial,
    campaign_id int not null,
    event_id int,
    name varchar(80) not null,
    player_name varchar(80),
    status scene_status not null default 'new',
    schedule_notes text,
    description text,
    timeslot_count int not null default 1,
    display_to_pc boolean default true,
    prereqs jsonb,
    player_count_min int,
    player_count_max int,
    staff_count_min int,
    staff_count_max int,
    combat_staff_count_min int,
    combat_staff_count_max int,
    locations_count int default 1,
    staff_url varchar(255),
    player_url varchar(255),
    priority jsonb,
    primary key (id),
    CONSTRAINT scenes_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_event_fk FOREIGN KEY (event_id)
        REFERENCES "events" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type scene_element_request_status as enum(
    'none',
    'requested',
    'required',
    'rejected'
);

create type scene_element_schedule_status as enum(
    'unscheduled',
    'suggested',
    'confirmed',
    'rejected'
);

create table scenes_locations(
    scene_id int not null,
    location_id int not null,
    request_status scene_element_request_status not null default 'none',
    schedule_status scene_element_schedule_status not null default 'unscheduled',
    primary key(scene_id, location_id),
    CONSTRAINT scenes_locations_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_locations_location_fk FOREIGN KEY (location_id)
        REFERENCES "locations" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table scenes_timeslots(
    scene_id int not null,
    timeslot_id int not null,
    request_status scene_element_request_status not null default 'none',
    schedule_status scene_element_schedule_status not null default 'unscheduled',
    primary key(scene_id, timeslot_id),
    CONSTRAINT scenes_timeslots_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_timeslots_timeslot_fk FOREIGN KEY (timeslot_id)
        REFERENCES "timeslots" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table scenes_users(
    scene_id int not null,
    user_id int not null,
    request_status scene_element_request_status not null default 'none',
    schedule_status scene_element_schedule_status not null default 'unscheduled',
    primary key(scene_id, user_id),
    CONSTRAINT scenes_users_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_users_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table scenes_sources(
    scene_id int not null,
    source_id int not null,
    request_status scene_element_request_status not null default 'none',
    schedule_status scene_element_schedule_status not null default 'unscheduled',
    primary key(scene_id, source_id),
    CONSTRAINT scenes_sources_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_sources_source_fk FOREIGN KEY (source_id)
        REFERENCES "skill_sources" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table scenes_skills(
    scene_id int not null,
    skill_id int not null,
    request_status scene_element_request_status not null default 'none',
    schedule_status scene_element_schedule_status not null default 'unscheduled',
    primary key(scene_id, skill_id),
    CONSTRAINT scenes_skill_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_skills_source_fk FOREIGN KEY (skill_id)
        REFERENCES "skills" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table scenes_tags(
    scene_id int not null,
    tag_id int not null,
    primary key(scene_id, tag_id),
    CONSTRAINT scenes_tags_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_tags_user_fk FOREIGN KEY (tag_id)
        REFERENCES "tags" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table locations_tags(
    location_id int not null,
    tag_id int not null,
    primary key(location_id, tag_id),
    CONSTRAINT locations_tags_scene_fk FOREIGN KEY (location_id)
        REFERENCES "locations" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_tags_user_fk FOREIGN KEY (tag_id)
        REFERENCES "tags" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table campaign_users_tags(
    user_id int not null,
    campaign_id int not null,
    tag_id int not null,
    primary key(user_id, campaign_id, tag_id),
    CONSTRAINT campaign_users_tags_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT campaign_users_tags_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scenes_tags_user_fk FOREIGN KEY (tag_id)
        REFERENCES "tags" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table schedule_busy_types(
    id serial,
    campaign_id int not null,
    name varchar(80) not null,
    description text,
    display_to_player boolean,
    available_to_player boolean,
    available_to_staff boolean,
    primary key (id),
    unique(campaign_id, name),
    CONSTRAINT schedule_busy_types_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table schedule_busies(
    id serial,
    campaign_id int not null,
    timeslot_id int not null,
    user_id int not null,
    event_id int not null,
    type_id int not null,
    unique(user_id, event_id, timeslot_id, type_id),
    primary key (id),
    CONSTRAINT schedule_busies_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT schedule_busies_timeslot_fk FOREIGN KEY (timeslot_id)
        REFERENCES "timeslots" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT schedule_busies_user_fk FOREIGN KEY (campaign_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT schedule_busies_event_fk FOREIGN KEY (campaign_id)
        REFERENCES "events" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT schedule_busies_type_fk FOREIGN KEY (type_id)
        REFERENCES "schedule_busy_types" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type scene_issue_level as ENUM(
    'warning',
    'info'
);

create table scene_issues(
    id serial,
    scene_id int not null,
    level scene_issue_level not null,
    code varchar(20) not null,
    text varchar(255) not null,
    ignored boolean default false,
    resolved boolean default false,
    created timestamp with time zone default now(),
    unique(scene_id, code, text),
    primary key (id),
    CONSTRAINT scene_issues_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type event_schedule_status as ENUM(
    'private',
    'staff only',
    'player visible'
);

alter table events add column schedule_status event_schedule_status default 'private';
alter table campaigns add column display_schedule boolean default true;
alter table campaigns add column schedule_players boolean default true;
