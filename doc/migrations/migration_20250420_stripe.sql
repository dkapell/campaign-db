alter table campaigns
    add column stripe_account_id varchar(80),
    add column stripe_account_ready boolean default false;

create table orders(
    id serial,
    campaign_id int not null,
    user_id int not null,
    status varchar(20),
    checkout_id varchar,
    charge_id varchar,
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
    name varchar(255),
    cost_in_cents int,
    quantity int not null default 1,
    created timestamp with time zone default now(),
    primary key(id),
    CONSTRAINT orders_items_order_fk FOREIGN KEY (order_id)
        REFERENCES "orders" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE CASCADE
);
