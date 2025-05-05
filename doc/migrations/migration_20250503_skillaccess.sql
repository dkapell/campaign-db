alter table skill_sources add column display_to_staff boolean default true;
alter table skill_statuses add column complete boolean default true;

create table skill_sources_users(
    user_id int not null,
    source_id int not null,
    created timestamp with time zone default now(),
    primary key (source_id, user_id),
    CONSTRAINT source_fk FOREIGN KEY (source_id)
        REFERENCES "skill_sources" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        on update no action on delete cascade
);


create table skills_users(
    user_id int not null,
    skill_id int not null,
    created timestamp with time zone default now(),
    primary key (skill_id, user_id),
    CONSTRAINT skill_fk FOREIGN KEY (skill_id)
        REFERENCES "skills" (id) MATCH SIMPLE
        on update no action on delete cascade,
    CONSTRAINT user_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
        on update no action on delete cascade
)
