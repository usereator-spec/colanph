import { getUser, verifyRequestOrigin } from '@netlify/identity';

export async function requireAdmin(request, { verifyOrigin = false } = {}) {
  if (verifyOrigin) {
    try {
      verifyRequestOrigin(request);
    } catch {
      return { response: Response.json({ error: 'Origine della richiesta non valida.' }, { status: 403 }) };
    }
  }

  const user = await getUser();
  if (!user) {
    return { response: Response.json({ error: 'Non autenticato.' }, { status: 401 }) };
  }
  if (!Array.isArray(user.roles) || !user.roles.some(role => String(role).toLowerCase() === 'admin')) {
    return { response: Response.json({ error: 'Accesso riservato agli amministratori.' }, { status: 403 }) };
  }
  return { user };
}
