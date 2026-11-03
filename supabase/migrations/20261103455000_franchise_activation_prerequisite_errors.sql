begin;
-- Keep both prerequisites and their ordering. A pending legal passport is not
-- repaired by asking an already-AAL2 user to enroll another authentication factor.
do $$
declare definition text;
 marker text := $marker$if p_activation_mode='CONTRACTUAL'and(coalesce(auth.jwt()->>'aal','')<>'aal2'or org_status<>'ACTIVE')then raise exception 'FRANCHISE_ACTIVATION_MFA_REQUIRED'using errcode='42501';end if;$marker$;
 replacement text := $replacement$if p_activation_mode='CONTRACTUAL'and coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_ACTIVATION_MFA_REQUIRED'using errcode='42501';end if;
 if p_activation_mode='CONTRACTUAL'and org_status<>'ACTIVE'then raise exception 'FRANCHISE_ACTIVATION_ORGANIZATION_NOT_ACTIVE'using errcode='42501';end if;$replacement$;
begin
 select pg_get_functiondef('private.accept_franchise_activation_v1(uuid,text,integer,uuid,text,text,boolean,text,uuid)'::regprocedure) into definition;
 if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'FRANCHISE_ACTIVATION_PREREQUISITE_SOURCE_MISMATCH';end if;
 execute replace(definition,marker,replacement);
end$$;
commit;
