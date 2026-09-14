import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin } from './_shared/auth.mjs';
import { collectPublicIds, normalizeSiteData } from './_shared/validate.mjs';
import { readSiteData, writeSiteData } from './_shared/data.mjs';

function configureCloudinary() {
  const existing = cloudinary.config();
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || existing.cloud_name;
  const api_key = process.env.CLOUDINARY_API_KEY || existing.api_key;
  const api_secret = process.env.CLOUDINARY_API_SECRET || existing.api_secret;
  if (!cloud_name || !api_key || !api_secret) return false;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return true;
}

export default async (request) => {
  const auth = await requireAdmin(request, { verifyOrigin: request.method !== 'GET' });
  if (auth.response) return auth.response;

  if (request.method === 'GET') {
    const current = await readSiteData({ withMetadata: true });
    return Response.json({ data: current.data, etag: current.etag, source: current.source, user: { email: auth.user.email } });
  }

  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const payload = await request.json();
    const nextData = normalizeSiteData(payload.data);
    const expectedEtag = payload.etag || null;
    const previous = await readSiteData({ withMetadata: true });

    if ((previous.etag || null) !== expectedEtag) {
      return Response.json({ error: 'I contenuti sono cambiati in un’altra sessione. Ricarica la pagina prima di pubblicare.' }, { status: 409 });
    }

    const result = await writeSiteData(nextData, expectedEtag);
    if (!result.modified) {
      return Response.json({ error: 'Conflitto durante la pubblicazione. Ricarica i dati e riprova.' }, { status: 409 });
    }

    const previousIds = collectPublicIds(previous.data);
    const nextIds = collectPublicIds(nextData);
    const removed = [...previousIds].filter(publicId => !nextIds.has(publicId));
    const warnings = [];

    if (removed.length && configureCloudinary()) {
      const results = await Promise.allSettled(removed.map(publicId => cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' })));
      results.forEach((settled, index) => {
        if (settled.status === 'rejected') warnings.push(`Foto non eliminata da Cloudinary: ${removed[index]}`);
      });
    } else if (removed.length) {
      warnings.push('Contenuti pubblicati, ma le credenziali Cloudinary non sono configurate: le foto rimosse restano archiviate su Cloudinary.');
    }

    return Response.json({ ok: true, data: nextData, etag: result.etag ?? null, warnings });
  } catch (error) {
    console.error('admin-data:', error);
    return Response.json({ error: error?.message || 'Errore durante la pubblicazione.' }, { status: 400 });
  }
};
