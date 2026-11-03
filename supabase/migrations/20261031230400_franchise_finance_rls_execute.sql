-- A SECURITY INVOKER aggregate evaluates the finance read policies as the caller.
-- Their restricted boolean helper must be executable by that policy's role.
grant execute on function private.franchise_book_access(uuid,uuid) to authenticated;
