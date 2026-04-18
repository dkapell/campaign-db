create type paid_type as enum(
'unpaid',
'paid',
'waived'
);

alter table attendance add column paid_new paid_type default 'unpaid' not null;
update attendance set paid_new = 'paid' where paid = true;
alter table attendance drop column paid;
alter table attendance rename column paid_new to paid;

alter table attendance_addons add column paid_new paid_type default 'unpaid' not null;
update attendance_addons set paid_new = 'paid' where paid = true;
alter table attendance_addons drop column paid;
alter table attendance_addons rename column paid_new to paid;
