create table scenes_writers(
    scene_id int not null,
    user_id int not null,
    primary key (scene_id, user_id),
    CONSTRAINT scenes_writers_scene_fk FOREIGN KEY (scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE,
    CONSTRAINT scenes_writers_writer_fk FOREIGN KEY (user_id)
        REFERENCES "users" (id) MATCH SIMPLE
);
