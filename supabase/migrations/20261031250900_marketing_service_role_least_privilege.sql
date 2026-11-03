-- Supabase installations may grant new public tables to service_role by default.
-- Workers use narrow SECURITY DEFINER commands; direct table mutations bypass their gates.
revoke all on
 public.marketing_consents,public.brand_kits,public.brand_kit_versions,public.marketing_templates,
 public.marketing_template_versions,public.social_connections,public.marketing_campaigns,public.marketing_content,
 public.marketing_content_versions,public.marketing_content_sources,public.marketing_calendar_items,public.marketing_exceptions,
 public.social_publication_jobs,public.social_publication_results,public.marketing_attribution_events,public.marketing_metric_events
from service_role;
notify pgrst,'reload schema';
