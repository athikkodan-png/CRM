\set ON_ERROR_STOP off
\set QUIET on
begin;
insert into companies(id,code,name) values ('00000000-0000-0000-0000-000000000001','T','Test Co');
insert into accounts(id,company_id,code,name,type) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','1000','Cash','asset'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','4000','Sales','income');
insert into fiscal_periods(company_id,name,start_date,end_date) values
 ('00000000-0000-0000-0000-000000000001','2026','2026-01-01','2026-12-31'),
 ('00000000-0000-0000-0000-000000000001','2025','2025-01-01','2025-12-31');
update fiscal_periods set status='locked' where name='2025';
insert into journal_entries(id,company_id,entry_date) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','2026-03-01');
insert into journal_lines(entry_id,company_id,line_no,account_id,debit) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-0000000000a1',100);
insert into journal_lines(entry_id,company_id,line_no,account_id,credit) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001',2,'00000000-0000-0000-0000-0000000000a2',90);
commit;
\echo '--- 1. unbalanced post must FAIL:'
update journal_entries set status='posted' where id='00000000-0000-0000-0000-0000000000e1';
update journal_lines set credit=100 where line_no=2;
\echo '--- 2. balanced post must SUCCEED:'
update journal_entries set status='posted' where id='00000000-0000-0000-0000-0000000000e1';
select status from journal_entries;
\echo '--- 3. edit posted entry must FAIL:'
update journal_entries set memo='hack' where id='00000000-0000-0000-0000-0000000000e1';
\echo '--- 4. edit posted line must FAIL:'
update journal_lines set debit=1 where line_no=1;
\echo '--- 5. delete posted entry must FAIL:'
delete from journal_entries;
\echo '--- 6. post into locked period must FAIL:'
insert into journal_entries(id,company_id,entry_date) values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000001','2025-06-01');
insert into journal_lines(entry_id,company_id,line_no,account_id,debit) values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-0000000000a1',5);
insert into journal_lines(entry_id,company_id,line_no,account_id,credit) values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000001',2,'00000000-0000-0000-0000-0000000000a2',5);
update journal_entries set status='posted' where id='00000000-0000-0000-0000-0000000000e2';
\echo '--- 7. audit log cannot be changed (both must FAIL):'
update audit_log set action='x'; delete from audit_log;
\echo '--- 8. audit captured post action:'
select action, count(*) from audit_log where entity='journal_entries' group by 1 order by 1;
\echo '--- 9. gapless numbering (INV-00001, INV-00002, rollback, then INV-00003):'
insert into document_sequences(company_id,doc_type,prefix) values ('00000000-0000-0000-0000-000000000001','invoice','INV-');
select next_document_number('00000000-0000-0000-0000-000000000001','invoice');
select next_document_number('00000000-0000-0000-0000-000000000001','invoice');
begin; select next_document_number('00000000-0000-0000-0000-000000000001','invoice'); rollback;
select next_document_number('00000000-0000-0000-0000-000000000001','invoice');
