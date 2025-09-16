alter table tags add column display_to_pc boolean default false;
update tags set display_to_pc = true where type = 'glossary';
