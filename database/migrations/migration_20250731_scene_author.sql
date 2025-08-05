alter table scenes add column writer_id int,
    add column runner_id int, 
    add CONSTRAINT scenes_writer_fk FOREIGN KEY (writer_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL,
    add CONSTRAINT scenes_runner_fk FOREIGN KEY (runner_id)
        REFERENCES "users" (id) MATCH SIMPLE
        ON UPDATE NO ACTION ON DELETE SET NULL;
