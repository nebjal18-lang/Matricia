// The matrix describes required acceptance; none of these rows is a pass receipt.
export const widths=[375,390,768,1440];
export const locales=['fr','ar'];
export const ownerRoutes=[
 'tableau-de-bord','sous-traitant/identite','sous-traitant/qualification','sous-traitant/services',
 'sous-traitant/questionnaires','sous-traitant/documents','sous-traitant/consultations','sous-traitant/devis',
 'sous-traitant/contrats','sous-traitant/missions','sous-traitant/planning','sous-traitant/facturation',
 'sous-traitant/facturation/pre-releve','sous-traitant/facturation/echeancier','sous-traitant/litiges','sous-traitant/messages','sous-traitant/entreprise','sous-traitant/parametres',
 'sous-traitant/achats','sous-traitant/reputation','sous-traitant/marketing','sous-traitant/mode-client','organisation/roles','notifications',
];
export const requiredFlows=[
 {id:'native-entry',actor:'provider-owner',assertions:['native_otp_verified','native_totp_aal2_verified','native_provider_organization_created','no_client_membership_or_trial']},
 {id:'legal-identity',actor:'provider-owner',assertions:['ui_full_legal_profile_persisted','same_organization_documents_uploaded','trusted_demo_scan_recorded','exact_profile_submitted','independent_admin_aal2_review','current_identity_verified','self_review_denied']},
 {id:'qualification-questionnaire',actor:'provider-owner',assertions:['service_requested','published_provider_questionnaire_started','conditional_required_fields','offline_queue_reconnect','native_reload','server_missing_required_denied','submitted_read_only','independent_service_qualification']},
 {id:'quotes',actor:'provider-owner',assertions:['canonical_consultation_accepted','one_time_quote_persisted','recurring_quote_schedule_persisted','exact_minor_units_and_governed_tax','optional_item_persisted','private_attachment_current_clean','client_requests_revision','provider_revision_replaces_draft','quote_submitted']},
 {id:'contract-delivery',actor:'provider-owner',assertions:['native_demo_signature_verified','canonical_contract_downloaded','technician_assigned_by_native_command','delivery_proof_uploaded','client_rejection_persisted','correction_creates_new_version','client_acceptance_independent','unassigned_technician_upload_denied']},
 {id:'finance',actor:'provider-accounting',assertions:['current_statement_read','scoped_invoice_draft_persisted','canonical_document_downloaded','dated_payment_plan_requested','independent_review_required','immutable_closure_retained','sales_and_viewer_mutation_denied']},
 {id:'messaging',actor:'provider-owner',assertions:['canonical_dossier_thread','native_message_persisted','clean_private_attachment_downloaded','fr_ar_context_retained','competitor_thread_and_attachment_denied']},
];
export const requiredActors=['provider-owner','provider-manager','provider-accounting','technician-assigned','technician-unassigned','technician-viewer','provider-viewer','provider-sales','foreign-provider','client-owner','compliance-reviewer','governance-author','governance-reviewer','finance-author','finance-reviewer'];
export const evidenceTags=['wcag2a','wcag2aa','wcag21a','wcag21aa'];
