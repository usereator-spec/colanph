import { login, logout, verifyRequestOrigin } from '@netlify/identity';

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyRequestOrigin(request);
    const { email, password } = await request.json();
    const user = await login(String(email || '').trim(), String(password || ''));
    if (!user?.roles?.includes('admin')) {
      await logout();
      return Response.json({ error: 'L’account non ha il ruolo admin.' }, { status: 403 });
    }
    return Response.json({ ok: true, email: user.email });
  } catch (error) {
    console.error('auth-login:', error);
    return Response.json({ error: 'Email o password non valide.' }, { status: 401 });
  }
};
