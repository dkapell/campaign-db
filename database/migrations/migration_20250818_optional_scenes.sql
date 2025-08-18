alter table scenes 
    add column for_anyone boolean default false,
    add column non_exclusive boolean default false,
    add column coreqs json;
    
