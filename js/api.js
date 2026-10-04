import { CONFIG } from './config.js';

function configured() {
  return CONFIG.API_URL && !CONFIG.API_URL.startsWith('PASTE_') && CONFIG.GOOGLE_CLIENT_ID && !CONFIG.GOOGLE_CLIENT_ID.startsWith('PASTE_');
}

export function assertConfigured() {
  if (!configured()) throw new Error('Konfigurasi belum selesai. Isi API_URL dan GOOGLE_CLIENT_ID di js/config.js.');
}

export async function api(action, payload = {}, sessionToken = '') {
  assertConfigured();
  if (!navigator.onLine) throw new Error('Tidak ada koneksi internet.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, sessionToken }),
      signal: controller.signal
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { throw new Error('Respons backend tidak valid. Pastikan URL deployment Apps Script menggunakan /exec.'); }
    if (!json.success) throw new Error(json.message || 'Permintaan gagal.');
    return json.data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Server terlalu lama merespons. Silakan coba lagi.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
