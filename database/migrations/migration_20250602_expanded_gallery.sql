ALTER TYPE public.image_type
    ADD VALUE 'gallery' AFTER 'custom field response';

alter table images add column display_to_pc boolean not null default true;
