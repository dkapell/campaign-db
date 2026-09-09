alter table scenes 
    add column repeater boolean default false,
    add column repeater_primary_scene_id int,
    add CONSTRAINT scenes_repeater_primary_scene_fk FOREIGN KEY (repeater_primary_scene_id)
        REFERENCES "scenes" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL
