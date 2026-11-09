import { z } from "zod";

export const configurationSections = ["COMPANY", "RESEND", "PAYPAL", "YOUSIGN", "SCANNER"] as const;
export type ConfigurationSection = typeof configurationSections[number];
export const configurationSectionSchema = z.enum(configurationSections);
export const configurationEnvironmentSchema = z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION"]);
export type ConfigurationEnvironment = z.infer<typeof configurationEnvironmentSchema>;
export type ConfigurationActionState = { status: "idle" | "success" | "error"; reason?: string; probeCode?: string };
export type ConfigurationField = {key: string; labelFr: string; labelAr: string; secret: boolean; type: string; required: boolean};
const field = (key: string, labelFr: string, labelAr: string, type = "text", required = true, secret = false): ConfigurationField => ({key,labelFr,labelAr,type,required,secret});
export const sectionFields: Record<ConfigurationSection, readonly ConfigurationField[]> = {
  COMPANY: [
    field("legalName","Raison sociale","الاسم القانوني"), field("displayName","Nom commercial","الاسم التجاري"),
    field("ice","ICE","المعرف الموحد للمقاولة","text",false), field("rc","Registre du commerce","السجل التجاري","text",false), field("ifNumber","Identifiant fiscal","المعرف الضريبي","text",false),
    field("address","Adresse","العنوان"), field("city","Ville","المدينة"), field("country","Pays (code ISO)","البلد (رمز ISO)"), field("currency","Monnaie (code ISO)","العملة (رمز ISO)"),
    field("supportEmail","Email de contact","بريد الاتصال","email"), field("supportPhone","Téléphone de contact","هاتف الاتصال","tel",false), field("websiteUrl","Site web","الموقع الإلكتروني","url",false),
    field("defaultLocale","Langue par défaut (fr / ar)","اللغة الافتراضية (fr / ar)"), field("timezone","Fuseau horaire","المنطقة الزمنية"),
  ],
  RESEND: [field("RESEND_FROM_EMAIL","Adresse d’expédition vérifiée","عنوان المرسل المعتمد","email"),field("RESEND_FROM_NAME","Nom de l’expéditeur","اسم المرسل","text",false),field("EMAIL_RECIPIENT_ALLOWLIST","Destinataires autorisés (emails ou @domaine, séparés par virgules)","المستلمون المسموحون (بريد أو ‎@نطاق مفصول بفواصل)"),field("RESEND_API_KEY","Clé API Resend","مفتاح Resend API","password",true,true),field("RESEND_WEBHOOK_SECRET","Secret webhook Resend","سر إشعارات Resend","password",true,true)],
  PAYPAL: [field("PAYPAL_ENV","Environnement PayPal (sandbox / live)","بيئة PayPal (sandbox / live)"),field("PAYPAL_CLIENT_ID","Identifiant client PayPal","معرف عميل PayPal"),field("PAYPAL_WEBHOOK_ID","Identifiant du webhook","معرف الإشعارات"),field("PAYPAL_WEBHOOK_CERT_URL","URL du certificat PayPal","رابط شهادة PayPal","url"),field("PAYPAL_ALLOWED_CURRENCIES","Monnaies autorisées, séparées par virgules","العملات المسموحة مفصولة بفواصل"),field("PAYPAL_CLIENT_SECRET","Secret client PayPal","سر عميل PayPal","password",true,true),field("PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64","Certificat PEM PayPal encodé en Base64","شهادة PayPal PEM بترميز Base64","password",true,true)],
  YOUSIGN: [field("YOUSIGN_ENVIRONMENT","Environnement YouSign (sandbox / live)","بيئة YouSign (sandbox / live)"),field("YOUSIGN_WORKSPACE_ID","Identifiant de l’espace YouSign","معرف مساحة YouSign","text",false),field("YOUSIGN_API_KEY","Clé API YouSign","مفتاح YouSign API","password",true,true),field("YOUSIGN_WEBHOOK_SECRET","Secret webhook YouSign","سر إشعارات YouSign","password",true,true)],
  SCANNER: [field("MALWARE_SCANNER_URL","URL HTTPS du scanner autorisé","رابط HTTPS للماسح المسموح","url"),field("MALWARE_SCANNER_ALLOWED_HOSTS","Hôtes scanner autorisés par l’hébergeur","مضيفو الماسح المسموحون لدى المستضيف"),field("MALWARE_SCANNER_TOKEN","Secret d’accès au scanner","سر الوصول إلى الماسح","password",true,true)],
};
const text = z.string().trim().max(1000).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v));
const short = text.pipe(z.string().max(240));
const email = z.string().trim().max(254).email();
const https = z.string().trim().max(2000).url().refine(raw => {try {const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==="443");}catch{return false;}});
const secret = z.string().min(16).max(4000).refine(v => !/[\r\n\u0000]/u.test(v));
const blankOptional = (schema: z.ZodType<string>) => z.union([schema,z.literal("")]);
const allowlist = text.pipe(z.string().min(3)).refine(value => value.split(",").every(raw => {const v=raw.trim();return v.startsWith("@")?/^@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/iu.test(v):email.safeParse(v).success;}));
export const sectionSettingsSchemas = {
  COMPANY: z.object({legalName:short.pipe(z.string().min(2)),displayName:short.pipe(z.string().min(2)),ice:blankOptional(z.string().regex(/^\d{15}$/u)),rc:short,ifNumber:short,address:text.pipe(z.string().min(3)),city:short.pipe(z.string().min(2)),country:z.string().regex(/^[A-Z]{2}$/u),currency:z.string().regex(/^[A-Z]{3}$/u),supportEmail:email,supportPhone:short,websiteUrl:blankOptional(https),defaultLocale:z.enum(["fr","ar"]),timezone:short.pipe(z.string().min(1)).refine(value=>{try{new Intl.DateTimeFormat("fr",{timeZone:value});return true;}catch{return false;}})}).strict(),
  RESEND:z.object({RESEND_FROM_EMAIL:email,RESEND_FROM_NAME:short.refine(v=>!/[\r\n<>]/u.test(v)),EMAIL_RECIPIENT_ALLOWLIST:allowlist}).strict(),
  PAYPAL:z.object({PAYPAL_ENV:z.enum(["sandbox","live"]),PAYPAL_CLIENT_ID:z.string().trim().min(8).max(512),PAYPAL_WEBHOOK_ID:z.string().trim().min(6).max(100),PAYPAL_WEBHOOK_CERT_URL:https.refine(raw=>{const u=new URL(raw);return ["api.paypal.com","api.sandbox.paypal.com"].includes(u.hostname)&&/^\/v1\/notifications\/certs\/[A-Za-z0-9_-]+$/u.test(u.pathname)&&!u.search;}),PAYPAL_ALLOWED_CURRENCIES:z.string().trim().max(300).refine(v=>v.split(",").every(c=>/^[A-Z]{3}$/u.test(c.trim())))}).strict(),
  YOUSIGN:z.object({YOUSIGN_ENVIRONMENT:z.enum(["sandbox","live"]),YOUSIGN_WORKSPACE_ID:blankOptional(z.string().uuid())}).strict(),
  SCANNER:z.object({MALWARE_SCANNER_URL:https,MALWARE_SCANNER_ALLOWED_HOSTS:z.string().trim().min(3).max(1000).refine(v=>v.split(",").every(h=>/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/iu.test(h.trim())))}).strict(),
} as const;
export const sectionSecretsSchemas = {
  COMPANY:z.object({}).strict(),
  RESEND:z.object({RESEND_API_KEY:secret,RESEND_WEBHOOK_SECRET:secret}).strict(),
  PAYPAL:z.object({PAYPAL_CLIENT_SECRET:secret,PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64:z.string().min(100).max(48000).regex(/^[A-Za-z0-9+/]+={0,2}$/u)}).strict(),
  YOUSIGN:z.object({YOUSIGN_API_KEY:secret,YOUSIGN_WEBHOOK_SECRET:secret}).strict(),
  SCANNER:z.object({MALWARE_SCANNER_TOKEN:secret}).strict(),
} as const;
export function parseConfigurationValues(section:ConfigurationSection,settings:Record<string,string>,secrets:Record<string,string>){
  return {settings:sectionSettingsSchemas[section].parse(settings) as Record<string,string>,secrets:sectionSecretsSchemas[section].parse(secrets) as Record<string,string>};
}
const revisionSchema = z.object({id:z.string().uuid(),section:configurationSectionSchema,environment:configurationEnvironmentSchema,settings:z.record(z.string(),z.string()),secret_keys:z.array(z.string()),content_hash:z.string().regex(/^[a-f0-9]{64}$/u),status:z.enum(["DRAFT","ACTIVE","REJECTED","RETIRED"]),created_by:z.string().uuid(),created_at:z.string(),approved_by:z.string().uuid().nullable(),approved_at:z.string().nullable(),probe:z.object({status:z.enum(["PASS","FAIL"]),code:z.string(),checked_at:z.string(),valid_until:z.string()}).nullable()}).strict();
export const configurationDashboardSchema=z.object({environment:configurationEnvironmentSchema,actor_id:z.string().uuid(),can_write:z.boolean(),sections:z.array(z.object({section:configurationSectionSchema,active_revision_id:z.string().uuid().nullable(),latest_revision_id:z.string().uuid().nullable(),revisions:z.array(revisionSchema)}).strict())}).strict();
export type ConfigurationRevision=z.infer<typeof revisionSchema>;
export type ConfigurationDashboard=z.infer<typeof configurationDashboardSchema>;
