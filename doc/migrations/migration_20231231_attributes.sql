create table attributes(
    id serial,
    campaign_id int not null,
    name varchar(80) not null,
    description text,
    initial int default 0,
    display_order   int,
    primary key (id),
    CONSTRAINT attributes_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
