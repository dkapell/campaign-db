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
    font_id int,
    body_font_id int,
    header_font_id int,
    body_font_scale float default 1,
    header_font_scale float default 1,
    status varchar(80),
    preview int default 0,
    updated timestamp with time zone default now(),
    primary key (id),
    CONSTRAINT translation_font_id FOREIGN KEY (font_id)
        REFERENCES "fonts" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT translation_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
);

CREATE INDEX translations_idx
    ON translations USING btree
    (doc_id ASC NULLS LAST);

alter table campaigns
    add column translation_drive_folder varchar(255),
    add column display_translations boolean default false,
    add column default_translation_body_font_id int,
    add column default_translation_header_font_id int,
    add column character_sheet_header_font_id int,
    add column character_sheet_body_font_id int;
    add column character_sheet_body_font_scale float default 1,
    add column character_sheet_header_font_scale float default 1,
    add column translation_scale float default 1;
