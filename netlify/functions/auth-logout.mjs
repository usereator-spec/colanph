import { logout, verifyRequestOrigin } from '@netlify/identity';

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyRequestOrigin(request);
    await logout();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: 'Impossibile uscire.' }, { status: 400 });
  }
};
