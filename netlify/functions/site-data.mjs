import { readSiteData } from './_shared/data.mjs';

export default async (request) => {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  try {
    const data = await readSiteData();
    return Response.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('site-data:', error);
    return Response.json({ error: 'Impossibile caricare i contenuti.' }, { status: 500 });
  }
};
