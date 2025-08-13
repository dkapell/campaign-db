create table schedule_reports(
    id serial,
    campaign_id int not null,
    name varchar(20) not null,
    config jsonb,
    unique(campaign_id, name),
    primary key (id),
    CONSTRAINT schedule_report_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
);
