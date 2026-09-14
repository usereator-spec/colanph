import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin } from './_shared/auth.mjs';

const ALLOWED_PUBLIC_ID = /^colanph\/(sections|projects)\/[a-z0-9-]+\/[A-Za-z0-9_-]+$/;

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const auth = await requireAdmin(request, { verifyOrigin: true });
  if (auth.response) return auth.response;

  const configured = cloudinary.config();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || configured.cloud_name;
  const apiKey = process.env.CLOUDINARY_API_KEY || configured.api_key;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || configured.api_secret;
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json({ error: 'Cloudinary non configurato nelle variabili d’ambiente Netlify.' }, { status: 503 });
  }

  try {
    const { publicId } = await request.json();
    if (!ALLOWED_PUBLIC_ID.test(String(publicId || ''))) {
      return Response.json({ error: 'Public ID non consentito.' }, { status: 400 });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp }, apiSecret);
    return Response.json({ cloudName, apiKey, timestamp, signature, publicId });
  } catch (error) {
    console.error('cloudinary-sign:', error);
    return Response.json({ error: 'Impossibile generare la firma di upload.' }, { status: 400 });
  }
};
