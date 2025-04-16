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
