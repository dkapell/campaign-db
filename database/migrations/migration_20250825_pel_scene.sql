
create table scenes_feedbacks (
    id          serial,
    survey_response_id int not null,
    scene_id    int not null,
    gm_feedback text,
    npc_feedback text,
    skipped     boolean default false,
    created     timestamp with time zone DEFAULT now(),
    primary key (id),
    CONSTRAINT scene_feedback_survey_response_fk FOREIGN KEY (survey_response_id)
        REFERENCES survey_response(id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scene_feedback_scene_fk FOREIGN KEY (scene_id)
        REFERENCES scenes(id) match simple
        ON UPDATE NO ACTION ON DELETE CASCADE
);
