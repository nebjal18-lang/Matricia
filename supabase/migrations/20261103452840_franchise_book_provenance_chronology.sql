begin;
-- Serialize fee liability across distinct books/rule versions of the same
-- franchise, and validate chronological acceptance rather than only a hash.
do $$declare definition text;old text;begin
 definition:=pg_get_functiondef('private.guard_franchise_bound_financial_write_v1()'::regprocedure);
 old:='elsif tg_table_name=''franchise_entry_fee_schedules''then';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_FEE_LOCK_SOURCE_MISMATCH';end if;
 execute replace(definition,old,old||E'\n  perform pg_advisory_xact_lock(hashtextextended(''franchise.entry_fee.liability.''||(source->>''franchise_id''),0));');

 definition:=pg_get_functiondef('private.franchise_book_active_basis_v1(uuid)'::regprocedure);
 old:='environment text;';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_ACTIVATION_DECLARATION_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old,old||'invitation public.franchise_invitations%rowtype;');
 old:=' select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;';
 if strpos(definition,old)=0 then raise exception'FRANCHISE_ACTIVATION_CHRONOLOGY_SOURCE_MISMATCH';end if;
 definition:=replace(definition,old,$source$
 select*into invitation from public.franchise_invitations where id=evidence.invitation_id;
 if(select count(*)from public.franchise_activation_evidence other where other.franchise_id=binding.franchise_id and other.approved_mandate_version_id=approved.id)<>1
  or invitation.id is null or invitation.franchise_id is distinct from binding.franchise_id
  or invitation.status is distinct from'ACCEPTED'or invitation.accepted_by is distinct from evidence.actor_user_id
  or invitation.accepted_at is null or invitation.accepted_at<invitation.created_at or invitation.accepted_at>invitation.expires_at
  or evidence.recorded_at<invitation.accepted_at or evidence.recorded_at<active.created_at
  or active.created_at<approved.created_at
  or approved.created_at>(source#>>'{approval,decided_at}')::timestamptz
  or active.effective_from<(source#>>'{approval,decided_at}')::timestamptz
 then raise exception'FRANCHISE_BOOK_ACTIVATION_CHRONOLOGY_REQUIRED'using errcode='55000';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
$source$);
 execute definition;
end$$;
commit;
