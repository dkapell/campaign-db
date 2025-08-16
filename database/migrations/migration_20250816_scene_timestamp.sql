alter table scenes 
    add column created timestamp with time zone DEFAULT now(),
    add column updated timestamp with time zone DEFAULT now();
