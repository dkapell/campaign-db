CREATE EXTENSION IF NOT EXISTS citext;


CREATE TYPE user_type as ENUM
(
    'admin',
    'core staff',
    'contributing staff',
    'event staff',
    'player',
    'none'
);

create table users (
    id          serial,
    name        varchar(80),
    email       varchar(100),
    google_id   varchar(500),
    user_type   user_type default 'none',
    drive_folder varchar(255),
    staff_drive_folder varchar(255),
    notes       text,
    PRIMARY KEY (id)
);

create table skill_source_types(
    id              serial,
    name            varchar(80) not null,
    display_order   int not null,
    num_free        int default 0,
    primary key (id)
);

create table skill_sources(
    id              serial,
    name            varchar(80) not null,
    description     text,
    notes           text,
    type_id         int not null,
    cost            int default 0,
    provides        jsonb,
    requires        jsonb,
    require_num     int,
    conflicts       jsonb,
    required        boolean default false,
    display_to_pc   boolean default false,
    primary key (id),
    CONSTRAINT type_fk FOREIGN KEY (type_id)
        REFERENCES "skill_source_types" (id) MATCH SIMPLE
        on update no action on delete cascade
);

create table skill_types(
    id              serial,
    name            varchar(80) not null,
    description     text,
    primary key (id)
);

create table skill_usages(
    id              serial,
    name            varchar(80),
    display_name    boolean default true,
    display_order   int,
    description     text,
    primary key (id)
);

create table skill_tags(
    id              serial,
    name            varchar(80),
    description     text,
    display_to_pc   boolean default true,
    on_sheet        boolean default true,
    color           varchar(80),
    primary key (id)
);

create table skill_statuses(
    id              serial,
    name            varchar(80),
    display_to_pc   boolean default true,
    display_order   int,
    description     text,
    advanceable     boolean default true,
    purchasable     boolean default false,
    class           varchar(20) default 'secondary',
    primary key (id)
);

create table skills(
    id              serial,
    name            varchar(80) not null,
    summary         varchar(255),
    description     text,
    notes           text,
    cost            varchar(80),
    source_id       int not null,
    usage_id        int,
    type_id         int,
    status_id       int,
    provides        jsonb,
    requires        jsonb,
    require_num     int,
    conflicts       jsonb,
    updated         timestamp with time zone default now(),
    primary key(id),
    CONSTRAINT source_fk FOREIGN KEY (source_id)
        REFERENCES "skill_sources" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT usage_fk FOREIGN KEY (usage_id)
        REFERENCES "skill_usages" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT type_fk FOREIGN KEY (type_id)
        REFERENCES "skill_types" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT status_fk FOREIGN KEY (status_id)
        REFERENCES "skill_statuses" (id) MATCH SIMPLE
        on update no action on delete cascade
);

CREATE INDEX status_idx
    ON skills USING btree
    (status_id ASC NULLS LAST);

CREATE INDEX source_idx
    ON skills USING btree
    (source_id ASC NULLS LAST);

create table skill_tags_xref(
    skill_id int not null,
    tag_id int not null,
    primary key (skill_id, tag_id),
    CONSTRAINT skill_fk FOREIGN KEY (skill_id)
        REFERENCES "skills" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT tag_fk FOREIGN KEY (tag_id)
        REFERENCES "skill_tags" (id) MATCH SIMPLE
        on update no action on delete cascade
);

create table audits(
    id              serial,
    user_id         int not null,
    object_type     varchar(80),
    object_id       int,
    action          varchar(80),
    data            jsonb,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        on update no action on delete no action
);

create index audit_idx
    on audits using btree
    (object_type, object_id asc);

create type card_type as ENUM(
    'early',
    'mid',
    'late'
);

create table glossary_statuses(
    id              serial,
    name            varchar(80),
    display_to_pc   boolean default true,
    display_order   int,
    description     text,
    class           varchar(20) default 'secondary',
    primary key (id)
);

create table glossary_tags(
    id serial,
    name citext not null unique,
    primary key(id)
);

create type glossary_type as enum(
    'in character',
    'out of character'
);

create table glossary_entries(
    id serial,
    name citext not null unique,
    content text,
    type glossary_type not null,
    created timestamp with time zone DEFAULT now(),
    status_id int,
    primary key(id),
    CONSTRAINT status_fk FOREIGN KEY (status_id)
        REFERENCES "glossary_statuses" (id) MATCH SIMPLE
        on update no action on delete set null
);

create table glossary_entry_tag(
    entry_id int not null,
    tag_id int not null,
    primary key(entry_id, tag_id),
    constraint entry_fk foreign key (entry_id)
        references "glossary_entries" (id) match simple
        on update no action on delete cascade,
    constraint tag_fk foreign key (tag_id)
        references "glossary_tags" (id) match simple
        on update no action on delete cascade
);

create table characters(
    id serial,
    user_id int not null,
    name varchar(255),
    active boolean default false,
    cp int default 0,
    foreordainment varchar(80),
    extra_traits varchar(255),
    updated timestamp with time zone default now(),
    primary key(id),
    constraint user_fk FOREIGN key (user_id)
        references "users" (id) match simple
        on update no action on delete cascade
);

create table character_skill_sources(
    character_id int not null,
    skill_source_id int not null,
    cost    int default 0,
    updated timestamp with time zone default now(),
    primary key(character_id, skill_source_id),
    CONSTRAINT skill_source_fk FOREIGN KEY (skill_source_id)
        REFERENCES "skill_sources" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT character_fk FOREIGN KEY (character_id)
        REFERENCES "characters" (id) MATCH SIMPLE
        on update no action on delete cascade
);

create table character_skills(
    id serial,
    character_id int not null,
    skill_id int not null,
    details jsonb,
    cost    int default 0,
    updated timestamp with time zone default now(),
    primary key(id),
    CONSTRAINT skill_fk FOREIGN KEY (skill_id)
        REFERENCES "skills" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT character_fk FOREIGN KEY (character_id)
        REFERENCES "characters" (id) MATCH SIMPLE
        on update no action on delete cascade
);

create table skill_reviews(
    id serial,
    skill_id int not null,
    user_id int not null,
    content text,
    approved boolean default false,
    created timestamp with time zone default now(),
    primary key(id),
    CONSTRAINT skill_fk FOREIGN key (skill_id)
        REFERENCES "skills" (id) MATCH SIMPLE
        on update no action on delete cascade,
    constraint user_fk FOREIGN key (user_id)
        references "users" (id) match simple
        on update no action on delete cascade
);

CREATE INDEX skill_review_idx
    ON skill_comment USING btree
    (skill_id ASC NULLS LAST);
