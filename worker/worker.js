// Cloudflare Worker: a small proxy that keeps your Gemini API key secret.
// The web app sends { system, contents } here; this Worker adds the key and calls Gemini.
//
// Settings (Worker > Settings > Variables and Secrets):
//   GEMINI_API_KEY  (Secret, required)  key from aistudio.google.com
//   ALLOWED_ORIGIN  (Text, recommended) your GitHub Pages address, e.g. https://yourname.github.io
//   GEMINI_MODEL    (Text, optional)    defaults to gemini-2.5-flash

const MAX_TURNS = 60;
const MAX_BODY_CHARS = 60000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((s) => s.trim().replace(/\/$/, ''));
    const originOk = allowed.includes('*') || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') return json({ ok: true, message: 'Language Buddy worker is running' });
    if (!originOk) return json({ error: 'This website is not allowed to use the worker (check ALLOWED_ORIGIN)' }, 403);
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY is not set on the worker' }, 500);

    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: 'Request too large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Bad JSON' }, 400); }

    const { system, contents } = body;
    if (typeof system !== 'string' || !Array.isArray(contents) || !contents.length || contents.length > MAX_TURNS) {
      return json({ error: 'Expected { system: string, contents: [...] }' }, 400);
    }
    const clean = contents.map((c) => ({
      role: c.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(c.parts?.[0]?.text ?? '').slice(0, 4000) }],
    }));

    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: clean,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 1024 },
      }),
    });

    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) return json({ error: data.error?.message || `Gemini error ${res.status}` }, res.status);

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) return json({ error: 'Gemini returned an empty answer (maybe blocked by safety filters)' }, 502);
    return json({ text });
  },
};
