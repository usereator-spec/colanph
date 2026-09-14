import { recoverPassword, verifyRequestOrigin } from '@netlify/identity';

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyRequestOrigin(request);
    const { token, password } = await request.json();
    const user = await recoverPassword(String(token || ''), String(password || ''));
    return Response.json({ ok: true, email: user.email, isAdmin: Boolean(user?.roles?.includes('admin')) });
  } catch (error) {
    console.error('auth-reset:', error);
    return Response.json({ error: 'Token di recupero non valido o scaduto.' }, { status: 400 });
  }
};
