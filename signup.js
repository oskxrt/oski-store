import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = window.OSKI_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);

$('#signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#signupStatus').textContent = 'Creando cuenta...';
  const email = $('#email').value.trim().toLowerCase();
  const password = $('#password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    $('#signupStatus').textContent = error.message;
    return;
  }
  $('#signupStatus').textContent = 'Cuenta creada. Si Supabase pide confirmación, revisa tu correo. Luego entra al panel.';
});
