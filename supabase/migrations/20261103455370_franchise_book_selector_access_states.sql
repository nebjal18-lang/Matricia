begin;
-- The selector must explain missing MFA to an actually assigned Finance actor.
-- Identity classification never replaces the original complete authorization.
do $$declare definition text;needle text;replacement text;begin
 definition:=pg_get_functiondef('public.franchise_book_opening_context_v1(uuid)'::regprocedure);
 needle:='if actor is null or private.has_platform_role(array[''SUPER_ADMIN'',''FINANCE_MANAGER''],actor)is distinct from true then raise exception''FRANCHISE_BOOK_DENIED''using errcode=''42501'';end if;';
 if strpos(definition,needle)=0 then raise exception'FRANCHISE_BOOK_SELECTOR_ROLE_SOURCE_CHANGED';end if;
 replacement:='if actor is null or private.finance_cost_role_identity_v1(true)is distinct from true then raise exception''FRANCHISE_BOOK_DENIED''using errcode=''42501'';end if;';
 definition:=replace(definition,needle,replacement);
 needle:='if auth.jwt()->>''aal''is distinct from''aal2''then raise exception''AAL2_REQUIRED''using errcode=''42501'';end if;';
 if strpos(definition,needle)=0 then raise exception'FRANCHISE_BOOK_SELECTOR_MFA_SOURCE_CHANGED';end if;
 execute replace(definition,needle,needle||E'\n if private.has_platform_role(array[''SUPER_ADMIN'',''FINANCE_MANAGER''],actor)is distinct from true then raise exception''FRANCHISE_BOOK_DENIED''using errcode=''42501'';end if;');
end$$;
commit;
