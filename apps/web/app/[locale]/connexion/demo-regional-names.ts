/** Noms d’entreprises fictifs réalistes (démo) — jamais de vraies sociétés. */

export type DemoBrandName = { fr: string; ar: string };

export type DemoCityBrands = {
  franchise: DemoBrandName;
  providers: [DemoBrandName, DemoBrandName, DemoBrandName];
  clients: [DemoBrandName, DemoBrandName, DemoBrandName, DemoBrandName, DemoBrandName, DemoBrandName];
};

/** Clé = ville DEMO_BOX_TERRITORIES.city */
export const DEMO_CITY_BRANDS: Record<string, DemoCityBrands> = {
  Tanger: {
    franchise: { fr: "Nour Atlas Franchise", ar: "نور أطلس فرانشايز" },
    providers: [
      { fr: "Détroit Soft Services", ar: "ديترويت سوفت سيرفيس" },
      { fr: "Port Phare Consulting", ar: "بور فـار كونسولتينغ" },
      { fr: "Médina Tech Ops", ar: "مدينة تك أوبس" },
    ],
    clients: [
      { fr: "Hôtel Bayt Al Bahar", ar: "فندق بيت البحر" },
      { fr: "Clinique Ibn Battuta", ar: "عيادة ابن بطوطة" },
      { fr: "Souk Logistics Nord", ar: "سوق لوجستيك نور" },
      { fr: "Café des Remparts", ar: "مقهى الأسوار" },
      { fr: "École Horizon Tanger", ar: "مدرسة أفق طنجة" },
      { fr: "Atelier Kasbah Design", ar: "ورشة قصبة ديزاين" },
    ],
  },
  Oujda: {
    franchise: { fr: "Orient Horizon Franchise", ar: "أورينت هورايزون فرانشايز" },
    providers: [
      { fr: "Zayane Digital", ar: "زيان ديجيتال" },
      { fr: "Frontière Pro Services", ar: "فرونتيير برو سيرفيس" },
      { fr: "Angad Maintenance IT", ar: "أنجاد مانتنانس آي تي" },
    ],
    clients: [
      { fr: "Pharmacie Al Maghrib", ar: "صيدلية المغرب" },
      { fr: "Trans-Est Fret", ar: "ترانس إيست فريت" },
      { fr: "Université Est Campus", ar: "جامعة الشرق كامبوس" },
      { fr: "Boulangerie Sidi Yahya", ar: "مخبزة سيدي يحيى" },
      { fr: "Cabinet Juridique Rif", ar: "مكتب قانوني الريف" },
      { fr: "Agri Oued Isly", ar: "أغري وادي إيسلي" },
    ],
  },
  Fès: {
    franchise: { fr: "Fès Médina Franchise", ar: "فاس مدينة فرانشايز" },
    providers: [
      { fr: "Artisan Cloud Solutions", ar: "آرتيزان كلاود سوليوشنز" },
      { fr: "Saïss Data Lab", ar: "سايس داتا لاب" },
      { fr: "Borj Expertise Comptable", ar: "برج إكسبيرتيز كومتابل" },
    ],
    clients: [
      { fr: "Riad Al Andalous", ar: "رياض الأندلس" },
      { fr: "Tanneries Moderne", ar: "دباغة مودرن" },
      { fr: "Université Al Karaouine Services", ar: "خدمات جامعة القرويين" },
      { fr: "Parfums de Fès", ar: "عطور فاس" },
      { fr: "Clinique Atlas Fès", ar: "عيادة أطلس فاس" },
      { fr: "Café Clock Medina", ar: "مقهى كلوك المدينة" },
    ],
  },
  Rabat: {
    franchise: { fr: "Capitale Conseil Franchise", ar: "كابيتال كونساي فرانشايز" },
    providers: [
      { fr: "Bouregreg Systems", ar: "أبي رقراق سيستمز" },
      { fr: "Hassan Tower Digital", ar: "حسن تاور ديجيتال" },
      { fr: "Agdal Business Ops", ar: "أكدال بيزنس أوبس" },
    ],
    clients: [
      { fr: "Ministère Pilotage Démo", ar: "وزارة القيادة التجريبية" },
      { fr: "Banque Al Amal Partenaires", ar: "بنك الأمل بارتنيرز" },
      { fr: "Clinique Souissi Care", ar: "عيادة السويسي كير" },
      { fr: "Éditions Rabat Presse", ar: "إصدارات الرباط بريس" },
      { fr: "Restaurant Oudayas", ar: "مطعم الوداية" },
      { fr: "Startup Garage Salé", ar: "ستارتاب غاراج سلا" },
    ],
  },
  "Béni Mellal": {
    franchise: { fr: "Moyen Atlas Franchise", ar: "مويان أطلس فرانشايز" },
    providers: [
      { fr: "Bin El Ouidane Tech", ar: "بين الويدان تك" },
      { fr: "Tadla Soft Services", ar: "تادلة سوفت سيرفيس" },
      { fr: "Kasba Agro Support", ar: "قصبة أغرو سبورت" },
    ],
    clients: [
      { fr: "Coopérative Olives Tadla", ar: "تعاونية زيتون تادلة" },
      { fr: "Hôtel Bin El Ouidane", ar: "فندق بين الويدان" },
      { fr: "Clinique Béni Mellal Centre", ar: "عيادة بني ملال سنتر" },
      { fr: "Transport Moyen Atlas", ar: "نقل مويان أطلس" },
      { fr: "École Oued Zem Plus", ar: "مدرسة وادي زم بلوس" },
      { fr: "Fromagerie Ain Asserdoun", ar: "مصنع جبن عين أسردون" },
    ],
  },
  Casablanca: {
    franchise: { fr: "Anfa Business Franchise", ar: "أنفا بيزنس فرانشايز" },
    providers: [
      { fr: "Casa Cloud Partners", ar: "كازا كلاود بارتنرز" },
      { fr: "Maarif Digital Studio", ar: "معاريف ديجيتال ستوديو" },
      { fr: "Aïn Sebaâ Ops", ar: "عين السبع أوبس" },
    ],
    clients: [
      { fr: "Groupe Twin Center Retail", ar: "مجموعة توين سنتر ريتيل" },
      { fr: "Clinique Californie Casa", ar: "عيادة كاليفورنيا كازا" },
      { fr: "Port Commerce Atlantique", ar: "بور كومرس أتلانتيك" },
      { fr: "Café Corniche Anfa", ar: "مقهى كورنيش أنفا" },
      { fr: "École Internationale Maarif", ar: "مدرسة دولية معاريف" },
      { fr: "Atelier Design Gauthier", ar: "ورشة ديزاين غوتييه" },
    ],
  },
  Marrakech: {
    franchise: { fr: "Jemaa Prestige Franchise", ar: "جامع بريستيج فرانشايز" },
    providers: [
      { fr: "Palmerie Soft Labs", ar: "بالميري سوفت لابس" },
      { fr: "Médina Creative Hub", ar: "مدينة كرياتيف هب" },
      { fr: "Gueliz Tech Services", ar: "كيليز تك سيرفيس" },
    ],
    clients: [
      { fr: "Riad Bahia Palace", ar: "رياض باهية بالاس" },
      { fr: "Spa Atlas Wellness", ar: "سبا أطلس ويلنس" },
      { fr: "Agence Desert Tours", ar: "وكالة ديزرت تورز" },
      { fr: "Restaurant Nomad Gueliz", ar: "مطعم نوماد كيليز" },
      { fr: "Clinique Hivernage", ar: "عيادة الإفيرناج" },
      { fr: "Galerie Art Medina", ar: "غاليري آرت مدينة" },
    ],
  },
  Errachidia: {
    franchise: { fr: "Tafilalet Horizon Franchise", ar: "تافيلالت هورايزون فرانشايز" },
    providers: [
      { fr: "Ziz Valley Digital", ar: "زيز فالي ديجيتال" },
      { fr: "Erfoud Data Services", ar: "أرفود داتا سيرفيس" },
      { fr: "Oasis Support IT", ar: "واحة سبورت آي تي" },
    ],
    clients: [
      { fr: "Hôtel Kasbah Ziz", ar: "فندق قصبة زيز" },
      { fr: "Coopérative Dattes Erfoud", ar: "تعاونية تمور أرفود" },
      { fr: "Clinique Errachidia Sud", ar: "عيادة الرشيدية سود" },
      { fr: "Agence Sahara Trips", ar: "وكالة صحراء تريبس" },
      { fr: "École Oasis Plus", ar: "مدرسة واحة بلوس" },
      { fr: "Atelier Fossiles Erfoud", ar: "ورشة أحافير أرفود" },
    ],
  },
  Agadir: {
    franchise: { fr: "Souss Atlantique Franchise", ar: "سوس أتلانتيك فرانشايز" },
    providers: [
      { fr: "Taghazout Surf Tech", ar: "تغازوت سيرف تك" },
      { fr: "Anza Port Services", ar: "أنزا بور سيرفيس" },
      { fr: "Souss Agro Digital", ar: "سوس أغرو ديجيتال" },
    ],
    clients: [
      { fr: "Resort Marina Agadir", ar: "منتجع مارينا أكادير" },
      { fr: "Export Agrumes Souss", ar: "تصدير حمضيات سوس" },
      { fr: "Clinique Al Massira", ar: "عيادة المسيرة" },
      { fr: "Restaurant La Scala", ar: "مطعم لا سكالا" },
      { fr: "École Internationale Agadir", ar: "مدرسة دولية أكادير" },
      { fr: "Atelier Surfboards Taghazout", ar: "ورشة ألواح تغازوت" },
    ],
  },
  Guelmim: {
    franchise: { fr: "Oued Noun Franchise", ar: "وادي نون فرانشايز" },
    providers: [
      { fr: "Sahara Gateway IT", ar: "صحراء غيتواي آي تي" },
      { fr: "Noun Digital Desk", ar: "نون ديجيتال ديسك" },
      { fr: "Tantan Support Services", ar: "طانطان سبورت سيرفيس" },
    ],
    clients: [
      { fr: "Hôtel Oasis Guelmim", ar: "فندق واحة كلميم" },
      { fr: "Coopérative Camélidés Noun", ar: "تعاونية إبل نون" },
      { fr: "Clinique Guelmim Centre", ar: "عيادة كلميم سنتر" },
      { fr: "Agence Routes Sud", ar: "وكالة رووت سود" },
      { fr: "École Plaines du Draa", ar: "مدرسة سهول درعة" },
      { fr: "Atelier Cuir Sahara", ar: "ورشة جلد الصحراء" },
    ],
  },
  Laâyoune: {
    franchise: { fr: "Sakia El Hamra Franchise", ar: "الساقية الحمراء فرانشايز" },
    providers: [
      { fr: "Phos Boucraa Tech", ar: "فوس بوكراع تك" },
      { fr: "Laâyoune Port Digital", ar: "العيون بور ديجيتال" },
      { fr: "Dakhla Corridor Ops", ar: "الداخلة كوريدور أوبس" },
    ],
    clients: [
      { fr: "Hôtel Parador Laâyoune", ar: "فندق بارادور العيون" },
      { fr: "Pêche Atlantique Sud", ar: "صيد أتلانتيك سود" },
      { fr: "Clinique Laâyoune Care", ar: "عيادة العيون كير" },
      { fr: "Agence Désert Express", ar: "وكالة ديزير إكسبريس" },
      { fr: "École Sakia Plus", ar: "مدرسة الساقية بلوس" },
      { fr: "Atelier Phosphate Supply", ar: "ورشة فوسفات سبلاي" },
    ],
  },
  Dakhla: {
    franchise: { fr: "Oued Ed-Dahab Franchise", ar: "وادي الذهب فرانشايز" },
    providers: [
      { fr: "Lagune Wind Tech", ar: "لاغون ويند تك" },
      { fr: "Dakhla Bay Digital", ar: "الداخلة باي ديجيتال" },
      { fr: "White Dune Services", ar: "وايت ديون سيرفيس" },
    ],
    clients: [
      { fr: "Resort Lagune Dakhla", ar: "منتجع لاغون الداخلة" },
      { fr: "École de Kitesurf Atlantique", ar: "مدرسة كايت سيرف أتلانتيك" },
      { fr: "Clinique Dakhla Sud", ar: "عيادة الداخلة سود" },
      { fr: "Pêche Oued Ed-Dahab", ar: "صيد وادي الذهب" },
      { fr: "Café White Dune", ar: "مقهى وايت ديون" },
      { fr: "Atelier Nautique Lagune", ar: "ورشة ناوتيك لاغون" },
    ],
  },
};

export function demoCityBrands(city: string): DemoCityBrands | null {
  return DEMO_CITY_BRANDS[city] ?? null;
}
