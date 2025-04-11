create type font_type as ENUM(
    'google',
    'user'
);

create table fonts (
    id serial,
    campaign_id int not null,
    name varchar(255),
    type font_type not null,
    upload_id int,
    size int default 24,
    vertical boolean default false,
    primary key (id),
    CONSTRAINT font_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT font_upload_id FOREIGN KEY (upload_id)
        REFERENCES "uploads" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
