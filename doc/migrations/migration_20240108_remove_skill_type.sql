alter table skills drop constraint type_fk, 
    drop column type_id;
ALTER TYPE public.skill_tag_type
    ADD VALUE 'category' BEFORE 'delivery';
