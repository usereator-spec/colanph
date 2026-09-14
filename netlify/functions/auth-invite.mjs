import { acceptInvite, verifyRequestOrigin } from '@netlify/identity';

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyRequestOrigin(request);
    const { token, password } = await request.json();
    const user = await acceptInvite(String(token || ''), String(password || ''));
    return Response.json({ ok: true, email: user.email, isAdmin: Boolean(user?.roles?.includes('admin')) });
  } catch (error) {
    console.error('auth-invite:', error);
    return Response.json({ error: 'Invito non valido o scaduto.' }, { status: 400 });
  }
};
