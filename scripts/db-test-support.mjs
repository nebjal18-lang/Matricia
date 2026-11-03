// pgTAP RPCs are deliberately revoked by the application security migrations.
// Tests that switch role may use the framework only inside their own rollback.
const transactionStart = /^\s*(?:(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*begin\s*;/i;
const frameworkGrants = `
do $matricia_pgtap_fixture_grants$
declare framework_signatures text;
begin
    select string_agg(function_record.oid::regprocedure::text, ', ')
    into framework_signatures
    from pg_proc function_record
    join pg_depend dependency
      on dependency.classid='pg_proc'::regclass
     and dependency.objid=function_record.oid
     and dependency.deptype='e'
    join pg_extension extension_record on extension_record.oid=dependency.refobjid
    where extension_record.extname='pgtap';
  if framework_signatures is null then
    raise exception 'PGTAP_TEST_FRAMEWORK_MISSING';
  end if;
  execute format('grant execute on function %s to authenticated, service_role', framework_signatures);
end;
$matricia_pgtap_fixture_grants$;
`;

export function prepareSqlTest(source) {
  const match = transactionStart.exec(source);
  if (!match || !/rollback\s*;\s*$/i.test(source) || /^\s*commit\s*;/im.test(source)) {
    throw new Error('SQL_TEST_REQUIRES_BEGIN_AND_FINAL_ROLLBACK_WITHOUT_COMMIT');
  }
  return source.slice(0, match[0].length) + frameworkGrants + source.slice(match[0].length);
}
