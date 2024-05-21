alter table campaigns
    add column display_cp boolean default false,
    add column cp_base int,
    add column cp_cap int,
    add column cp_factor float,
    add column cp_approval boolean default true;


create table cp_grant (
    id serial,
    campaign_id int not null,
    user_id int not null,
    content varchar(255) not null,
    amount float not null,
    approved boolean default false,
    created timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT cp_campaign_fk FOREIGN KEY (campaign_id)
        REFERENCES "campaigns" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT cp_user_id FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
