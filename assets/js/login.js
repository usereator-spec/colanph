(() => {
  'use strict';

  const loginForm = document.getElementById('login-form');
  const tokenForm = document.getElementById('token-form');
  const recoveryRequestForm = document.getElementById('recovery-request-form');
  const forgotButton = document.getElementById('forgot-password');
  const help = document.getElementById('auth-help');
  const status = document.getElementById('auth-status');
  const tokenSubmit = document.getElementById('token-submit');

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const inviteToken = hash.get('invite_token');
  const recoveryToken = hash.get('recovery_token');

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  };

  async function post(path, data) {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Operazione non riuscita.');
    return payload;
  }

  if (inviteToken || recoveryToken) {
    loginForm.hidden = true;
    forgotButton.hidden = true;
    tokenForm.hidden = false;
    help.textContent = inviteToken ? 'Completa l’invito impostando una password.' : 'Imposta una nuova password.';
    tokenSubmit.textContent = inviteToken ? 'Attiva account' : 'Aggiorna password';
  }

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('Accesso in corso…');
    try {
      await post('/.netlify/functions/auth-login', {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      });
      window.location.assign('/admin/');
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  tokenForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('token-password').value;
    setStatus('Salvataggio…');
    try {
      const payload = inviteToken
        ? await post('/.netlify/functions/auth-invite', { token: inviteToken, password })
        : await post('/.netlify/functions/auth-reset', { token: recoveryToken, password });
      history.replaceState(null, '', '/login.html');
      if (payload.isAdmin) window.location.assign('/admin/');
      else {
        tokenForm.hidden = true;
        loginForm.hidden = false;
        forgotButton.hidden = false;
        help.textContent = 'Account pronto. Se non puoi entrare nell’admin, assegna il ruolo “admin” all’utente in Netlify Identity e poi accedi.';
        setStatus('Password impostata correttamente.');
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  forgotButton?.addEventListener('click', () => {
    recoveryRequestForm.hidden = !recoveryRequestForm.hidden;
  });

  recoveryRequestForm?.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('Invio email…');
    try {
      await post('/.netlify/functions/auth-recovery-request', {
        email: document.getElementById('recovery-email').value
      });
      recoveryRequestForm.hidden = true;
      setStatus('Se l’account esiste, riceverai un’email con il link per reimpostare la password.');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
})();
