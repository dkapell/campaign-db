ALTER TABLE glossary_tags DROP CONSTRAINT glossary_tags_name_key;

ALTER TABLE IF EXISTS glossary_tags
    ADD CONSTRAINT glossary_tags_name_key UNIQUE(campaign_id, name);
