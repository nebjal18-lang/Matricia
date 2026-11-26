-- Reject unsafe names only when a new internal-message upload is reserved.
-- Existing uploads remain usable, including later scan and bind updates.
begin;

create or replace function private.reject_unsafe_internal_message_filename_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if position('/' in new.original_file_name) > 0
     or position(chr(92) in new.original_file_name) > 0
     or new.original_file_name ~ '[[:cntrl:]]' then
    raise exception 'INVALID_MESSAGE_ATTACHMENT' using errcode = '22023';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.internal_message_attachment_uploads'::regclass
      and tgname = 'internal_message_upload_filename_guard'
      and not tgisinternal
  ) then
    create trigger internal_message_upload_filename_guard
      before insert on public.internal_message_attachment_uploads
      for each row execute function private.reject_unsafe_internal_message_filename_v1();
  end if;
end;
$$;

commit;
