create TYPE function_status as ENUM (
    'disabled',
    'private',
    'public'
);

alter table campaigns
    alter column display_glossary drop default,
    alter column display_glossary set data type function_status using (
        case display_glossary
            when true  then 'private'::function_status
            when false then 'disabled'::function_status
            else            'disabled'::function_status
        end
    ),
    alter column display_glossary set default 'private',

    alter column display_map drop default,
    alter column display_map set data type function_status using (
        case display_map
            when true  then 'private'::function_status
            when false then 'disabled'::function_status
            else            'disabled'::function_status
        end
    ),
    alter column display_map set default 'disabled',
    add column display_skill_doc function_status default 'private'
;

alter table pages add column menu varchar(80);
