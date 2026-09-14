const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ID_RE = /^colanph\/[A-Za-z0-9_\-/]+$/;

function isLocalizedText(value) {
  return value && typeof value === 'object' && typeof value.it === 'string' && typeof value.en === 'string';
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
  const caption = isLocalizedText(image.caption) ? image.caption : { it: '', en: '' };
  return {
    id: publicId,
    publicId,
    width: Math.round(width),
    height: Math.round(height),
    caption: { it: caption.it.trim(), en: caption.en.trim() }
  };
}

function normalizeCollectionItem(item, type, order) {
  if (!item || typeof item !== 'object') throw new Error('Elemento non valido.');
  const slug = String(item.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) throw new Error(`Slug non valido: ${slug || '(vuoto)'}`);
  if (!isLocalizedText(item.title) || !item.title.it.trim()) throw new Error(`Titolo italiano mancante per ${slug}.`);
  const description = isLocalizedText(item.description) ? item.description : { it: '', en: '' };
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
    title: { it: item.title.it.trim(), en: item.title.en.trim() },
    description: { it: description.it.trim(), en: description.en.trim() },
    images
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

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sections,
    projects,
    home: { order: homeOrder }
  };
}

export function collectPublicIds(data) {
  return new Set([...(data.sections || []), ...(data.projects || [])]
    .flatMap(item => (item.images || []).map(image => image.publicId)));
}
