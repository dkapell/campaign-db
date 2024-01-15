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
    required boolean default false,
    configuration jsonb,
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

alter table characters drop column notes, drop column gm_notes;
