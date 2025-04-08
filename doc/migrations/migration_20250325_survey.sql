create type survey_type as ENUM(
    'registration',
    'post event',
    'other'
);

create table surveys (
    id serial,
    campaign_id int not null,
    name varchar(255) not null,
    type survey_type not null,
    is_default boolean default false,
    definition jsonb,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT survey_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

insert into surveys (campaign_id, name, type, definition, "is_default") select id, 'registration', 'registration', event_fields, true from campaigns

create table survey_response (
    id serial,
    campaign_id int not null,
    user_id int not null,
    survey_id int,
    event_id int,
    survey_definition jsonb,
    data jsonb,
    submitted boolean default false,
    submitted_at timestamp with time zone,
    created timestamp with time zone default now(),
    updated timestamp with time zone default now(),
    primary key (id),
    CONSTRAINT survey_response_user_id FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT survey_response_survey_id FOREIGN KEY (survey_id)
        REFERENCES "surveys" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT survey_response_event_id FOREIGN KEY (event_id)
        REFERENCES "events" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT survey_response_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

-- migrate to survey_response here
-- pre_event_survey
-- insert into survey_response (campaign_id, survey_id, event_id, user_id, data, submitted, submitted_at)
-- select campaign_id, {ID}, event_id, user_id, pre_event_data, true, now() from attendance where pre_event_data is not null;


alter table campaigns
    add COLUMN post_event_survey_cp float not null default 0,
    add COLUMN post_event_survey_hide_days int not null default 0,
    add COLUMN event_attendance_cp float not null default 0,
    add COLUMN rename_map jsonb;

alter table events
    add column post_event_survey_deadline timestamp with time zone,
    add COLUMN pre_event_survey_id int,
    add COLUMN post_event_survey_id int,
    add CONSTRAINT events_pre_event_survey_fk FOREIGN KEY (pre_event_survey_id)
        REFERENCES "surveys" (id ) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    add CONSTRAINT events_post_event_survey_fk FOREIGN KEY (post_event_survey_id)
        REFERENCES "surveys" (id ) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL;

alter table attendance
    add column pre_event_survey_response_id int,
    add column post_event_survey_response_id int,

    add column checked_in boolean default false
    add column attendance_cp_granted boolean default false,
    add column post_event_cp_granted boolean default false,
    add column post_event_hidden boolean default false,
    add CONSTRAINT attendance_pre_event_survey_response_fk FOREIGN KEY (pre_event_survey_response_id)
        REFERENCES "survey_response" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    add CONSTRAINT attendance_post_event_survey_response_fk FOREIGN KEY (post_event_survey_response_id)
        REFERENCES "survey_response" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL;


create table event_addons (
    id serial,
    campaign_id int not null,
    event_id int not null,
    name varchar(255),
    cost int default 0,
    available_to_player boolean not null default true,
    available_to_staff boolean not null default true,
    charge_player boolean not null default true,
    charge_staff boolean not null default false,
    on_checkin boolean not null default false,
    primary key (id),
    CONSTRAINT event_addons_event_fk FOREIGN KEY (event_id)
        REFERENCES "events" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table attendance_addons (
    id serial,
    campaign_id int not null,
    attendance_id int not null,
    event_addon_id int not null,
    paid boolean default false,
    primary key (id),
    CONSTRAINT attendance_addons_attendance_fk FOREIGN KEY (attendance_id)
        REFERENCES "attendance" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT attendance_addons_event_addon_fk FOREIGN KEY (event_addon_id)
        REFERENCES "event_addons" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table post_event_addendum (
    id serial,
    campaign_id int not null,
    user_id int not null,
    attendance_id int,
    content text,
    submitted boolean default false,
    submitted_at timestamp with time zone,
    created timestamp with time zone default now(),
    updated timestamp with time zone default now(),
    primary key (id),
    CONSTRAINT survey_response_user_id FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT aurvey_response_attendance_fk FOREIGN KEY (attendance_id)
        REFERENCES "attendance" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT survey_response_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

-- alter table campaigns drop column event_fields;

alter table campaigns_users add column permissions jsonb default [];
