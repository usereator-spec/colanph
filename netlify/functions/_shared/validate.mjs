const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ID_RE = /^colanph\/[A-Za-z0-9_\-/]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const THEMES = new Set(['white', 'dark', 'retro', 'inherit']);

function isLocalizedText(value) {
  return value && typeof value === 'object' && typeof value.it === 'string' && typeof value.en === 'string';
}

function normalizeLocalized(value, fallback = { it: '', en: '' }) {
  const source = isLocalizedText(value) ? value : fallback;
  return { it: String(source.it || '').trim(), en: String(source.en || '').trim() };
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  if (!color) return '';
  if (!HEX_RE.test(color)) throw new Error(`Colore non valido: ${color}. Usa il formato #RRGGBB.`);
  return color.toUpperCase();
}

function normalizeAppearance(value, { allowInherit = true, fallbackTheme = 'white' } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  let theme = String(source.theme || fallbackTheme).trim();
  if (!THEMES.has(theme) || (!allowInherit && theme === 'inherit')) theme = fallbackTheme;
  return {
    theme,
    backgroundColor: normalizeColor(source.backgroundColor),
    titleColor: normalizeColor(source.titleColor),
    captionColor: normalizeColor(source.captionColor)
  };
}

function normalizeImage(image) {
  if (!image || typeof image !== 'object') throw new Error('Immagine non valida.');
  const publicId = String(image.publicId || image.id || '').trim();
  if (!PUBLIC_ID_RE.test(publicId)) throw new Error(`Public ID Cloudinary non valido: ${publicId || '(vuoto)'}`);
  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`Dimensioni immagine non valide per ${publicId}.`);
  }
  const caption = normalizeLocalized(image.caption);
  return {
    id: publicId,
    publicId,
    width: Math.round(width),
    height: Math.round(height),
    caption
  };
}

function normalizeCollectionItem(item, type, order) {
  if (!item || typeof item !== 'object') throw new Error('Elemento non valido.');
  const slug = String(item.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) throw new Error(`Slug non valido: ${slug || '(vuoto)'}`);
  if (!isLocalizedText(item.title) || !item.title.it.trim()) throw new Error(`Titolo italiano mancante per ${slug}.`);
  const description = normalizeLocalized(item.description);
  const images = Array.isArray(item.images) ? item.images.map(normalizeImage) : [];
  const seen = new Set();
  for (const image of images) {
    if (seen.has(image.publicId)) throw new Error(`Foto duplicata in ${slug}: ${image.publicId}`);
    seen.add(image.publicId);
  }
  return {
    id: String(item.id || `${type}-${slug}`),
    type,
    slug,
    order,
    title: normalizeLocalized(item.title),
    description,
    appearance: normalizeAppearance(item.appearance, { allowInherit: true, fallbackTheme: 'inherit' }),
    images
  };
}

function normalizeAbout(value) {
  const source = value && typeof value === 'object' ? value : {};
  const services = source.services && typeof source.services === 'object' ? source.services : {};
  const list = lang => Array.isArray(services[lang])
    ? services[lang].map(entry => String(entry || '').trim()).filter(Boolean).slice(0, 30)
    : [];

  const backgroundPublicId = String(source.backgroundPublicId || 'colanph/hero/ritratti-fabio-18').trim();
  const profilePublicId = String(source.profilePublicId || 'colanph/profile/profile').trim();
  if (!PUBLIC_ID_RE.test(backgroundPublicId)) throw new Error('Public ID sfondo About non valido.');
  if (!PUBLIC_ID_RE.test(profilePublicId)) throw new Error('Public ID profilo About non valido.');

  return {
    label: normalizeLocalized(source.label, { it: 'About', en: 'About' }),
    intro: normalizeLocalized(source.intro),
    detail: normalizeLocalized(source.detail),
    services: { it: list('it'), en: list('en') },
    contactTitle: normalizeLocalized(source.contactTitle),
    contactEmphasis: normalizeLocalized(source.contactEmphasis),
    phone: String(source.phone || '').trim(),
    phoneHref: String(source.phoneHref || '').trim(),
    email: String(source.email || '').trim(),
    instagram: String(source.instagram || '').trim(),
    instagramUrl: String(source.instagramUrl || '').trim(),
    availability: normalizeLocalized(source.availability),
    backgroundPublicId,
    profilePublicId
  };
}

export function normalizeSiteData(input) {
  if (!input || typeof input !== 'object') throw new Error('Dati del sito non validi.');
  const sectionsRaw = Array.isArray(input.sections) ? input.sections : [];
  const projectsRaw = Array.isArray(input.projects) ? input.projects : [];
  const sections = sectionsRaw.map((item, index) => normalizeCollectionItem(item, 'section', index));
  const projects = projectsRaw.map((item, index) => normalizeCollectionItem(item, 'project', index));

  for (const list of [sections, projects]) {
    const slugs = new Set();
    for (const item of list) {
      if (slugs.has(item.slug)) throw new Error(`Slug duplicato: ${item.slug}`);
      slugs.add(item.slug);
    }
  }

  const allImages = new Set([...sections, ...projects].flatMap(item => item.images.map(image => image.publicId)));
  const requestedHome = Array.isArray(input.home?.order) ? input.home.order.map(String) : [];
  const homeOrder = [];
  const homeSeen = new Set();
  for (const publicId of requestedHome) {
    if (allImages.has(publicId) && !homeSeen.has(publicId)) {
      homeSeen.add(publicId);
      homeOrder.push(publicId);
    }
  }

  const pageSettingsRaw = input.pageSettings && typeof input.pageSettings === 'object' ? input.pageSettings : {};
  const pageSettings = {
    home: normalizeAppearance(pageSettingsRaw.home, { allowInherit: false, fallbackTheme: 'white' }),
    works: normalizeAppearance(pageSettingsRaw.works, { allowInherit: false, fallbackTheme: 'dark' }),
    about: normalizeAppearance(pageSettingsRaw.about, { allowInherit: false, fallbackTheme: 'dark' }),
    work: normalizeAppearance(pageSettingsRaw.work, { allowInherit: false, fallbackTheme: 'white' })
  };

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    sections,
    projects,
    home: { order: homeOrder },
    pageSettings,
    about: normalizeAbout(input.about)
  };
}

export function collectPublicIds(data) {
  return new Set([...(data.sections || []), ...(data.projects || [])]
    .flatMap(item => (item.images || []).map(image => image.publicId)));
}
