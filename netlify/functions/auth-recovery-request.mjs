import { requestPasswordRecovery, verifyRequestOrigin } from '@netlify/identity';

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyRequestOrigin(request);
    const { email } = await request.json();
    await requestPasswordRecovery(String(email || '').trim());
    return Response.json({ ok: true });
  } catch (error) {
    console.error('auth-recovery-request:', error);
    return Response.json({ error: 'Impossibile inviare l’email di recupero.' }, { status: 400 });
  }
};
