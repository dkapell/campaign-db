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
    site_admin  boolean default false,
    PRIMARY KEY (id)
);

create table campaigns (
    id serial,
    name varchar(80) not null,
    description text,
    image_id int,
    favicon_id int,
    site varchar(255) unique,
    theme varchar(80),
    css text,
    created_by int,
    default_site boolean default false,
    default_to_player boolean default false,
    display_map boolean default false,
    display_glossary boolean default true,
    display_gallery boolean default false,
    staff_drive_folder varchar(255),
    npc_drive_folder varchar(255),
    player_drive_folder varchar(255),
    menu_dark boolean default true,
    created timestamp with time zone DEFAULT now(),
    updated timestamp with time zone DEFAULT now(),
    google_client_id varchar(80),
    google_client_secret varchar(80),
    body_font varchar(255),
    header_font varchar(255),
    display_cp boolean default false,
    cp_base int,
    cp_cap int,
    cp_factor float,
    cp_approval boolean default true,
    cp_requests boolean default true,
    event_default_cost int,
    event_default_location varchar(255),
    post_event_survey_cp float not null default 0,
    post_event_survey_hide_days int,
    event_attendance_cp float not null default 0,
    timezone varchar(80) default ('America/New_York'),
    user_type_map jsonb,
    rename_map jsonb,
    translation_drive_folder varchar(255),
    display_translations boolean default false,
    default_translation_body_font_id int,
    default_translation_header_font_id int,
    default_translation_title_font_id int,
    character_sheet_body_font_id int,
    character_sheet_header_font_id int,
    character_sheet_title_font_id int,
    character_sheet_body_font_scale float default 1,
    character_sheet_header_font_scale float default 1,
    character_sheet_title_font_scale float default 1,
    player_gallery boolean default false,
    stripe_account_id varchar(80),
    stripe_account_ready boolean default false
    primary key (id),
    CONSTRAINT campaigns_created_fk FOREIGN KEY (created_by)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,

);

create index campaigns_site_idx ON campaigns (site);

create table campaigns_users(
    user_id             int not null,
    campaign_id         int not null,
    name                varchar(80),
    drive_folder varchar(255),
    staff_drive_folder varchar(255),
    notes              text,
    type                user_type not null default 'none',
    permissions         jsonb default [],
    image_id            int,
    created             timestamp with time zone DEFAULT now(),
    primary key(user_id, campaign_id),
    CONSTRAINT campaigns_users_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT campaigns_users_game_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table skill_source_types(
    id              serial,
    campaign_id     int not null,
    name            varchar(80) not null,
    display_order   int not null,
    num_free        int default 0,
    max_sources     int,
    display_on_sheet  boolean default true,
    display_in_header  boolean default false,
    primary key (id),
    CONSTRAINT skill_source_types_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table skill_sources(
    id              serial,
    campaign_id     int not null,
    name            varchar(80) not null,
    description     text,
    notes           text,
    type_id         int not null,
    cost            int default 0,
    provides        jsonb,
    requires        jsonb,
    require_num     int,
    max_skills      int,
    conflicts       jsonb,
    required        boolean default false,
    display_to_pc   boolean default false,
    display_to_staff boolean default true,
    primary key (id),
    CONSTRAINT type_fk FOREIGN KEY (type_id)
        REFERENCES "skill_source_types" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT skill_source_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table skill_usages(
    id              serial,
    campaign_id     int not null,
    name            varchar(80),
    display_name    boolean default true,
    display_order   int,
    description     text,
    display_uses    boolean default false,
    usage_format    varchar(80),
    primary key (id),
    CONSTRAINT skill_usages_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type skill_tag_type as enum(
    'category',
    'delivery',
    'activation',
    'effect',
    'campaign',
    'meta'
);

create table skill_tags(
    id              serial,
    campaign_id     int not null,
    name            varchar(80),
    description     text,
    display_to_pc   boolean default true,
    on_sheet        boolean default true,
    color           varchar(80),
    type            skill_tag_type not null default 'campaign',
    primary key (id),
    CONSTRAINT skill_tags_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table skill_statuses(
    id              serial,
    campaign_id     int not null,
    name            varchar(80),
    display_to_pc   boolean default true,
    display_order   int,
    description     text,
    advanceable     boolean default true,
    purchasable     boolean default false,
    reviewable      boolean default false,
    complete        boolean default false,
    class           varchar(20) default 'secondary',
    primary key (id),
    CONSTRAINT skill_statuses_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table skills(
    id              serial,
    campaign_id     int not null,
    name            varchar(80) not null,
    summary         varchar(255),
    description     text,
    notes           text,
    cost            varchar(80),
    source_id       int not null,
    usage_id        int,
    status_id       int,
    uses            int not null default 1,
    provides        jsonb,
    requires        jsonb,
    require_num     int,
    conflicts       jsonb,
    required        boolean default false,
    updated         timestamp with time zone default now(),
    primary key(id),
    CONSTRAINT source_fk FOREIGN KEY (source_id)
        REFERENCES "skill_sources" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT usage_fk FOREIGN KEY (usage_id)
        REFERENCES "skill_usages" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT status_fk FOREIGN KEY (status_id)
        REFERENCES "skill_statuses" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT skills_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
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
    campaign_id     int not null,
    user_id         int not null,
    object_type     varchar(80),
    object_id       int,
    action          varchar(80),
    data            jsonb,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        on update no action on delete no action,
    CONSTRAINT audits_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create index audit_idx
    on audits using btree
    (object_type, object_id asc);


create table glossary_statuses(
    id              serial,
    campaign_id     int not null,
    name            varchar(80),
    display_to_pc   boolean default true,
    display_order   int,
    description     text,
    reviewable      boolean default false,
    class           varchar(20) default 'secondary',
    primary key (id),
    CONSTRAINT glossary_statuses_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table glossary_tags(
    id serial,
    campaign_id     int not null,
    name citext not null unique,
    primary key(id),
    CONSTRAINT glossary_tags_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type glossary_type as enum(
    'in character',
    'out of character'
);

create table glossary_entries(
    id serial,
    campaign_id     int not null,
    name citext not null unique,
    content text,
    type glossary_type not null,
    created timestamp with time zone DEFAULT now(),
    status_id int,
    primary key(id),
    CONSTRAINT status_fk FOREIGN KEY (status_id)
        REFERENCES "glossary_statuses" (id) MATCH SIMPLE
        on update no action on delete set null,
    CONSTRAINT glossary_entries_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
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
    campaign_id     int not null,
    user_id int not null,
    name varchar(255),
    pronouns varchar(128),
    active boolean default false,
    cp int default 0,
    extra_traits varchar(255),
    updated timestamp with time zone default now(),
    primary key(id),
    constraint user_fk FOREIGN key (user_id)
        references "users" (id) match simple
        on update no action on delete cascade,
    CONSTRAINT characters_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
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
    campaign_id int not null,
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
        on update no action on delete cascade,
    CONSTRAINT skill_reviews_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table attributes(
    id serial,
    campaign_id int not null,
    name varchar(80) not null,
    description text,
    initial int default 0,
    display_order   int,
    toughness boolean default false,
    calculated boolean default false,
    calculation jsonb,
    primary key (id),
    CONSTRAINT attributes_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX skill_review_idx
    ON skill_reviews USING btree
    (skill_id ASC NULLS LAST);

create table rulebooks(
    id serial,
    campaign_id int not null,
    name varchar(255),
    description text,
    display_order int not null,
    drive_folder varchar(255),
    data jsonb,
    excludes jsonb,
    generated timestamp with time zone,
    primary key(id),
    CONSTRAINT rulebooks_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type upload_type as ENUM(
    'image',
    'font',
    'document'
);

create type permission_level as ENUM(
    'admin',
    'gm',
    'contrib',
    'event',
    'player',
    'private'
);

create table uploads (
    id              serial,
    campaign_id     int not null,
    user_id         int,
    name            varchar(255) not null,
    display_name    varchar(255),
    description     text,
    status          varchar(20) default 'new' not null,
    size            int,
    type            upload_type,
    is_public       boolean default false,
    permission      permission_level not null default 'contrib'
    primary key (id),
    CONSTRAINT uploads_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT uploads_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type image_type as ENUM(
    'favicon',
    'website',
    'content',
    'map',
    'survey',
    'custom field response'
);

create table images (
    id              serial,
    campaign_id     int not null,
    type            image_type default 'content' not null,
    width           int,
    height          int,
    upload_id       int,
    for_cms         boolean not null default false,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT images_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT images_upload_fk FOREIGN KEY (upload_id)
        REFERENCES "uploads" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table maps (
    id              serial,
    uuid            uuid,
    campaign_id     int not null,
    name            varchar(255) not null,
    description     text,
    display_to_pc   boolean default false,
    image_id        int,
    status          varchar default 'new',
    primary key (id),
    CONSTRAINT maps_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);


create type custom_field_type as ENUM(
    'text',
    'longtext',
    'boolean',
    'dropdown'
);

create type custom_field_location as ENUM(
    'character'
);

create table custom_fields (
    id serial,
    campaign_id int not null,
    name varchar(255) not null,
    description text,
    type custom_field_type not null,
    location custom_field_location not null,
    display_order int not null,
    display_to_pc boolean default false,
    editable_by_pc boolean default false,
    configuration jsonb,
    required boolean default false,
    primary key(id),
    CONSTRAINT custom_fields_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table character_custom_fields (
    id serial,
    character_id int not null,
    custom_field_id int not null,
    value jsonb,
    updated timestamp with time zone default now(),
    primary key(id),
    unique(character_id, custom_field_id),
     CONSTRAINT custom_field_fk FOREIGN KEY (custom_field_id)
        REFERENCES "custom_fields" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT character_fk FOREIGN KEY (character_id)
        REFERENCES "characters" (id) MATCH SIMPLE
        on update no action on delete cascade
);

create table pages (
    id serial,
    campaign_id int not null,
    name varchar(255) not null,
    path varchar(255) not null,
    show_full_menu boolean default false,
    content text,
    permission varchar(80),
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT pages_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table page_codes (
    id serial,
    page_id int not null,
    code varchar(255) not null,
    primary key (id),
    CONSTRAINT page_codes_page_fk FOREIGN KEY (page_id)
        REFERENCES "pages" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create type cp_grant_status as ENUM (
    'pending',
    'denied',
    'approved'
);

create table cp_grant (
    id serial,
    campaign_id int not null,
    user_id int not null,
    content varchar(255) not null,
    amount float not null,
    status cp_grant_status default 'pending',
    created timestamp with time zone DEFAULT now(),
    updated timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT cp_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT cp_user_id FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

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
    default boolean default false,
    definition jsonb,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT survey_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

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
    pre_event_survey_id int,
    post_event_survey_id int,
    hide_attendees boolean default false,
    post_event_survey_deadline timestamp with time zone,
    primary key (id),
    CONSTRAINT events_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE

    CONSTRAINT events_pre_event_survey_fk FOREIGN KEY (event_registration_survey_id)
        REFERENCES "surveys" (id ) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT events_post_event_survey_fk FOREIGN KEY (post_event_survey_id)
        REFERENCES "surveys" (id ) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
);

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

create table survey_response (
    id serial,
    campaign_id int not null,
    user_id int not null,
    event_id int,
    survey_id int,
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

create table attendance (
    id serial,
    campaign_id int not null,
    event_id int not null,
    user_id int not null,
    character_id int,
    paid boolean default false,
    notes text,
    pre_event_survey_response_id int,
    post_event_survey_response_id int,
    --pre_event_data jsonb,
    --post_event_data jsonb,
    --post_event_submitted boolean default false,
    attending boolean default true,
    checked_in boolean default false,
    created timestamp with time zone DEFAULT now(),
    attendance_cp_granted boolean default false,
    post_event_cp_granted boolean default false,
    post_event_hidden boolean default false,
    --post_event_addendums jsonb default '[]',
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
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT attendance_pre_event_survey_response_fk FOREIGN KEY (pre_event_survey_response_id)
        REFERENCES "survey_response" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT attendance_post_event_survey_response_fk FOREIGN KEY (post_event_survey_response_id)
        REFERENCES "survey_response" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
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

create type font_type as ENUM(
    'google',
    'user'
);

create type font_transformation as ENUM(
    'none',
    'uppercase',
    'lowercase'
);

create table fonts (
    id serial,
    campaign_id int not null,
    name varchar(255),
    type font_type not null,
    upload_id int,
    size int default 24,
    language varchar(128),
    vertical boolean default false,
    lettersonly boolean default false,
    transformation font_transformation default 'none',
    primary key (id),
    CONSTRAINT font_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT font_upload_id FOREIGN KEY (upload_id)
        REFERENCES "uploads" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table translations(
    id serial,
    campaign_id int not null,
    doc_id varchar(255),
    name varchar(255),
    border boolean default true,
    label boolean default true,
    runes_only boolean default false,
    font_id int,
    body_font_id int,
    header_font_id int,
    title_font_id int,
    body_font_scale float default 1,
    header_font_scale float default 1,
    title_font_scale float default 1,
    status varchar(80),
    preview int default 0,
    updated timestamp with time zone default now(),
    primary key (id),
    CONSTRAINT translation_font_id FOREIGN KEY (font_id)
        REFERENCES "fonts" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT translation_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX translations_idx
    ON translations USING btree
    (doc_id ASC NULLS LAST);

create table documentations(
    id serial,
    campaign_id int not null,
    name varchar(80) not null,
    description text,
    on_checkin boolean default false,
    valid_from timestamp with time zone,
    staff_only boolean default false,
    display_order int not null,
    primary key (id),
    CONSTRAINT documentation_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table documentations_users(
    id serial,
    campaign_id int not null,
    documentation_id int not null,
    user_id int not null,
    notes text,
    valid_date timestamp with time zone default now(),
    primary key (id),
    unique(user_id, documentation_id),
    CONSTRAINT documentations_user_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT documentations_user_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table orders(
    id serial,
    campaign_id int not null,
    user_id int not null,
    status varchar(20),
    checkout_id varchar,
    charge_id varchar,
    client_secret varchar,
    payment_amount_cents int,
    payment_note text,
    created timestamp with time zone default now(),
    updated timestamp with time zone,
    submitted timestamp with time zone,
    paid timestamp with time zone,
    primary key(id),
    CONSTRAINT orders_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT orders_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table orders_items(
    id serial,
    order_id int not null,
    object_type varchar(20),
    object_id int,
    cost_in_cents int,
    quantity int not null default 1,
    created timestamp with time zone default now(),
    primary key(id),
    CONSTRAINT orders_items_order_fk FOREIGN KEY (order_id)
        REFERENCES "orders" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

create table skill_sources_users(
    user_id int not null,
    source_id int not null,
    created timestamp with time zone default now(),
    primary key (source_id, user_id),
    CONSTRAINT source_fk FOREIGN KEY (source_id)
        REFERENCES "skill_sources" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        on update no action on delete cascade
);

create table skills_users(
    user_id int not null,
    skill_id int not null,
    created timestamp with time zone default now(),
    primary key (skill_id, user_id),
    CONSTRAINT skill_fk FOREIGN KEY (skill_id)
        REFERENCES "skills" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        on update no action on delete cascade
);
