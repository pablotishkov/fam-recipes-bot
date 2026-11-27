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
    const { initData, familyName, joinCode } = await req.json();
    if (!initData) return json({ error: 'initData missing' }, 400);

    const validated = await validateInitData(initData);
    if (!validated) return json({ error: 'invalid initData signature' }, 401);
    const tg = validated.user; // собственно Telegram-пользователь
    const startParam = validated.start_param;

    // --- Единый auth-аккаунт на основе telegram_id ---
    const email = `tg_${tg.id}@telegram.local`;
    // Детерминированный пароль (секретный: зависит от BOT_TOKEN), чтобы
    // можно было входить в один и тот же аккаунт при каждом входе.
    const password = await hex(await hmac(`fam:${tg.id}`, Deno.env.get('BOT_TOKEN')!));
    let authId: string;

    const existing = await findUserByEmail(supabase, email);
    if (existing) {
      authId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { telegram_id: tg.id },
      });
      if (createErr) return json({ error: createErr.message }, 500);
      authId = created!.user.id;
    }

    // --- Профиль и семья ---
    const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ').trim() || 'Гость';

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('id', authId)
      .maybeSingle();

    let familyId = profile?.family_id ?? null;
    if (!familyId) {
      // Приоритет: код из startapp-ссылки, затем явный ввод кода, затем создание по имени.
      const codeToJoin = startParam ?? joinCode ?? null;
      if (codeToJoin) {
        familyId = await findFamilyIdByCode(supabase, codeToJoin);
        if (!familyId && joinCode) {
          // Пользователь явно ввёл неверный код — сообщаем.
          return json({ error: 'Семья с таким кодом не найдена' }, 404);
        }
      }
      if (!familyId && familyName) {
        familyId = await createFamily(supabase, familyName);
      }
    }
    await supabase.from('profiles').upsert(
      { id: authId, telegram_id: tg.id, name, family_id: familyId },
      { onConflict: 'id' },
    );

    // --- Токен доступа для клиента ---
    // sign-in делаем через анонимный ключ: GoTrue не выдаёт пользовательскую
    // сессию в контексте service_role-клиента.
    const anonKey =
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const authClient = anonKey
      ? createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : supabase;
    const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) return json({ error: signInErr.message }, 500);
    const accessToken = signInData.session?.access_token;

    return json({ access_token: accessToken, user: { id: authId, name, family_id: familyId } });
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

/**
 * Поиск auth-пользователя по email через admin API.
 * Метод getUserByEmail удалён из современного supabase-js, поэтому
 * ищем по listUsers (для семейного приложения число пользователей мало).
 */
async function findUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const found = (data?.users ?? []).find((u) => u.email === email);
  return found ? { id: found.id } : null;
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

async function hmac(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  // Ключ может быть строкой ("WebAppData") либо сырыми байтами (secret_key
  // из первого HMAC). TextEncoder.encode() строкифицирует Uint8Array в
  // "184,198,…", что ломает подпись — поэтому байты используем как есть.
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
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

/** Поиск семьи по коду-приглашению. */
async function findFamilyIdByCode(
  supabase: ReturnType<typeof createClient>,
  code: string,
): Promise<string | null> {
  const { data: fam } = await supabase
    .from('families')
    .select('id')
    .eq('invite_code', code.trim().toUpperCase())
    .maybeSingle();
  return fam?.id ?? null;
}

/** Создание новой семьи с именем и кодом-приглашением. */
async function createFamily(
  supabase: ReturnType<typeof createClient>,
  familyName: string,
): Promise<string | null> {
  const code = generateCode();
  const { data: created } = await supabase
    .from('families')
    .insert({ invite_code: code, name: familyName.trim() || 'Моя семья' })
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