create table events (
    id serial,
    campaign_id int not null,
    name varchar(255) not null,
    description text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    registration_open boolean default false,
    cost int default 0,
    location varchar(255),
    deleted boolean default false,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT events_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table attendance (
    id serial,
    campaign_id int not null,
    event_id int not null,
    user_id int not null,
    character_id int,
    paid boolean default false,
    notes text,
    data jsonb,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    unique(event_id, user_id),
    CONSTRAINT attendance_user_id FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT attendance_character_id FOREIGN KEY (character_id)
        REFERENCES "characters" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT attendance_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

alter table campaigns add column event_default_cost int,
    add column event_default_location varchar(255),
    add column event_fields jsonb;
