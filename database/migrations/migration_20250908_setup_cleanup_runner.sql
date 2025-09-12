ALTER TYPE scene_element_schedule_status
    ADD VALUE 'setup' AFTER 'rejected';
ALTER TYPE scene_element_schedule_status
    ADD VALUE 'cleanup' AFTER 'setup';
