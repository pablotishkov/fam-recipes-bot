import { createClient } from 'jsr:@supabase/supabase-js@2';

// --- CORS для вызова с фронтенда ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const { initData, familyName } = await req.json();
    if (!initData) return json({ error: 'initData missing' }, 400);

    const user = await validateInitData(initData);
    if (!user) return json({ error: 'invalid initData signature' }, 401);

    // --- Единый auth-аккаунт на основе telegram_id ---
    const email = `tg_${user.id}@telegram.local`;
    let authId: string;

    const { data: existing } = await supabase.auth.admin.getUserByEmail(email);
    if (existing?.user) {
      authId = existing.user.id;
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { telegram_id: user.id },
      });
      if (createErr) return json({ error: createErr.message }, 500);
      authId = created!.user.id;
    }

    // --- Профиль и семья ---
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Гость';

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('id', authId)
      .maybeSingle();

    let familyId = profile?.family_id ?? null;
    if (!familyId) {
      familyId = await ensureFamily(supabase, user.start_param ?? null, familyName);
    }
    await supabase.from('profiles').upsert(
      { id: authId, telegram_id: user.id, name, family_id: familyId },
      { onConflict: 'id' },
    );

    // --- Токен доступа для клиента ---
    const { data: session, error: tokErr } = await supabase.auth.admin.createSessionToken(authId);
    if (tokErr) return json({ error: tokErr.message }, 500);

    return json({ access_token: session.token, user: { id: authId, name, family_id: familyId } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// --- Валидация initData по схеме Telegram Bot API ---
interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}
interface ParsedInit {
  user: TgUser;
  start_param?: string;
}

async function validateInitData(initData: string): Promise<ParsedInit | null> {
  const botToken = Deno.env.get('BOT_TOKEN');
  if (!botToken) throw new Error('BOT_TOKEN not configured');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
  const secretKey = await hmac('WebAppData', botToken);
  const computed = await hex(await hmac(secretKey, dataCheckString));

  // Защита от повторного использования (допускаем расхождение до 1 часа).
  const authDate = Number(params.get('auth_date') ?? 0);
  if (Date.now() / 1000 - authDate > 3600) return null;

  if (computed !== hash) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;
  return { user: JSON.parse(rawUser) as TgUser, start_param: params.get('start_param') ?? undefined };
}

async function hmac(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function hex(bytes: Uint8Array): Promise<string> {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- Создание/вступление в семью ---
async function ensureFamily(
  supabase: ReturnType<typeof createClient>,
  startParam: string | null,
  familyName?: string,
): Promise<string | null> {
  // start_param = код-приглашение, переданный из бота (/start?startapp=CODE)
  if (startParam) {
    const { data: fam } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', startParam.toUpperCase())
      .maybeSingle();
    if (fam) return fam.id;
  }
  // Нет семьи — создаём новую с именем и кодом-приглашением.
  const code = generateCode();
  const { data: created } = await supabase
    .from('families')
    .insert({ invite_code: code, name: familyName?.trim() || 'Моя семья' })
    .select('id')
    .single();
  return created?.id ?? null;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}