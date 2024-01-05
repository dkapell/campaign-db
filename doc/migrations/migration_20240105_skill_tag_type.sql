create type skill_tag_type as enum(
    'delivery',
    'activation',
    'effect',
    'campaign',
    'meta'
);
alter table skill_tags add column type skill_tag_type not null default 'campaign';
