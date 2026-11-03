-- The existing notification delivery queue owns retries, preferences and transport receipts.
insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,cta_path_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash)values
('PROVIDER_BILLING_PDF',1,'ProviderBillingPdfReadyV1','PROVIDER_BILLING','fr-MA','Document de facturation disponible','Votre document {{number}} est disponible dans votre espace sécurisé. Connectez-vous pour le télécharger.','/api/provider/billing/{{kind}}/{{source_id}}?locale={{locale}}','IMPORTANT',false,array['IN_APP','EMAIL'],array['number','kind','source_id','locale'],'ACTIVE','2026-10-31',private.canonical_request_hash('{"template":"PROVIDER_BILLING_PDF","version":1,"locale":"fr-MA"}'::jsonb)),
('PROVIDER_BILLING_PDF',1,'ProviderBillingPdfReadyV1','PROVIDER_BILLING','ar-MA','وثيقة الفوترة متاحة','وثيقتكم {{number}} متاحة في فضائكم الآمن. سجلوا الدخول لتنزيلها.','/api/provider/billing/{{kind}}/{{source_id}}?locale={{locale}}','IMPORTANT',false,array['IN_APP','EMAIL'],array['number','kind','source_id','locale'],'ACTIVE','2026-10-31',private.canonical_request_hash('{"template":"PROVIDER_BILLING_PDF","version":1,"locale":"ar-MA"}'::jsonb));
create function public.enqueue_provider_billing_pdf_notification(p_artifact_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare artifact public.provider_billing_document_artifacts%rowtype;recipient uuid;
begin
 if auth.role()is distinct from'service_role'then raise exception'PROVIDER_BILLING_NOTIFICATION_DENIED'using errcode='42501';end if;
 select * into artifact from public.provider_billing_document_artifacts where id=p_artifact_id;
 if not found then raise exception'PROVIDER_BILLING_ARTIFACT_NOT_FOUND'using errcode='P0002';end if;
 -- An arbitrary accounting email never grants access. Only a verified active billing member receives the link.
 select om.user_id into recipient from public.organization_memberships om
 join auth.users u on u.id=om.user_id and u.email_confirmed_at is not null
 join public.provider_profiles p on p.provider_organization_id=om.organization_id
 where om.organization_id=artifact.provider_organization_id and om.status='ACTIVE'
 and exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code in('PROVIDER_OWNER','PROVIDER_ACCOUNTING'))
 order by (lower(u.email)=lower(p.accounting_contact_email::text))desc nulls last,
  exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code='PROVIDER_OWNER')desc,om.user_id limit 1;
 if recipient is null then raise exception'PROVIDER_BILLING_VERIFIED_RECIPIENT_REQUIRED'using errcode='55000';end if;
 return public.enqueue_notification(recipient,artifact.provider_organization_id,'PROVIDER_BILLING_PDF','ProviderBillingPdfReadyV1',artifact.locale||'-MA',jsonb_build_object('number',artifact.snapshot->>'number','kind',artifact.kind,'source_id',artifact.source_id::text,'locale',artifact.locale),'provider-billing-pdf-ready:'||artifact.id::text,'provider_billing_document_artifact',artifact.id::text,p_correlation_id);
end$$;
revoke all on function public.enqueue_provider_billing_pdf_notification(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.enqueue_provider_billing_pdf_notification(uuid,uuid)to service_role;
