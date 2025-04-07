-- Pre-deploy code

create type upload_type as ENUM(
    'image',
    'font',
    'document'
);

create table uploads (
    id              serial,
    campaign_id     int not null,
    user_id         int,
    name            varchar(255) not null,
    display_name    varchar(255),
    description     text,
    status          varchar(20) default 'new' not null,
    type            upload_type,
    size            int,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT uploads_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT uploads_user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

alter table images add COLUMN upload_id int,
    add column for_cms boolean not null default false,
    add CONSTRAINT images_upload_fk FOREIGN KEY (upload_id)
        REFERENCES "uploads" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE

update images set for_cms = true;

insert into uploads (campaign_id, name, display_name, description, status, size, type)
    select campaign_id, name, display_name, description, status, size, 'image' from images;

update images i
    set upload_id = u.id
    from uploads u
    where u.name = i.name and
        u.campaign_id = i.campaign_id and
        u.display_name = i.display_name;

alter type image_type add value 'survey';
alter type image_type add value 'custom field response';

-- deploy code here

alter table images
    drop column size,
    drop column name,
    drop column display_name,
    drop column description,
    drop column status;

