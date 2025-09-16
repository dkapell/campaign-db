create table community_cp_grant (
    id serial,
    campaign_id int not null,
    user_id int not null,
    content varchar(255) not null,
    amount float not null,
    status cp_grant_status default 'pending',
    created timestamp with time zone DEFAULT now(),
    updated timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT community_cp_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT community_cp_user_id FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);

alter table campaigns add column display_community_cp boolean default false;
