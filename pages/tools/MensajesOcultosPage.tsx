import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Copy, Check, Eye, EyeOff, Lock, Unlock, ShieldAlert, KeyRound } from 'lucide-react';
import { argon2id } from 'hash-wasm';
import { WORDS_ES } from './wordlists';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Esteganografía text-to-text: AES-256-GCM + Argon2id, ocultando el mensaje
   cifrado en caracteres de ancho cero detrás de un emoji visible.
   Todo se ejecuta en el navegador; nada se envía por la red.
---------------------------------------------------------------------------- */

const MAX_CHARS = 280;
const EMOJIS = ['🚀', '🥑', '🔒', '😀', '👍', '🎉', '📎', '🌐', '💬', '🔥', '✨', '📌'];

// Bit 0 → U+200B (zero-width space), Bit 1 → U+200C (zero-width non-joiner).
// Son los más compatibles y NO son el ZWJ (U+200D) que compone emojis.
const ZW0 = '​';
const ZW1 = '‌';

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------- codificación de ancho cero ---------- */
function bytesToZeroWidth(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) out += (b >> i) & 1 ? ZW1 : ZW0;
  }
  return out;
}

function zeroWidthToBytes(text: string): Uint8Array {
  const bits: number[] = [];
  for (const ch of text) {
    if (ch === ZW0) bits.push(0);
    else if (ch === ZW1) bits.push(1);
  }
  const len = Math.floor(bits.length / 8);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    out[i] = b;
  }
  return out;
}

/* ---------- criptografía: Argon2id → AES-256-GCM ---------- */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 19456, // 19 MiB (recomendación OWASP)
    hashLength: 32,
    outputType: 'binary',
  });
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToPayload(text: string, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  );
  const payload = new Uint8Array(16 + 12 + ct.length);
  payload.set(salt, 0);
  payload.set(iv, 16);
  payload.set(ct, 28);
  return payload;
}

async function decryptPayload(payload: Uint8Array, password: string): Promise<string | null> {
  if (payload.length < 29) return null;
  const salt = payload.slice(0, 16);
  const iv = payload.slice(16, 28);
  const ct = payload.slice(28);
  const key = await deriveKey(password, salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return dec.decode(pt);
  } catch {
    return null; // tag inválido → contraseña incorrecta
  }
}

/* ---------- modo señuelo: texto plausible y determinista ---------- */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function decoyText(password: string, payload: Uint8Array): Promise<string> {
  // Semilla determinista: misma contraseña + mismo mensaje → mismo señuelo.
  const seedInput = new Uint8Array(enc.encode(password).length + payload.length);
  seedInput.set(enc.encode(password), 0);
  seedInput.set(payload, enc.encode(password).length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', seedInput));
  const seed = (hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3];
  const rng = mulberry32(seed >>> 0);

  const n = 8 + Math.floor(rng() * 22); // 8–29 palabras
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(WORDS_ES[Math.floor(rng() * WORDS_ES.length)]);
  let s = words.join(' ');
  s = s.charAt(0).toUpperCase() + s.slice(1) + '.';
  return s;
}

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copiar' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {}
        );
      }}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 text-slate-200 font-semibold px-4 py-2.5 hover:border-cyber-400 transition-colors"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copiado' : label}
    </button>
  );
};

export const MensajesOcultosPage: React.FC = () => {
  const [mode, setMode] = useState<'ocultar' | 'revelar'>('ocultar');

  // Ocultar
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [emoji, setEmoji] = useState('🚀');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorHide, setErrorHide] = useState('');

  // Revelar
  const [pasted, setPasted] = useState('');
  const [revealPass, setRevealPass] = useState('');
  const [revealed, setRevealed] = useState('');
  const [revealState, setRevealState] = useState<'idle' | 'done' | 'nocontent'>('idle');
  const [revealBusy, setRevealBusy] = useState(false);
  const [showRevealPass, setShowRevealPass] = useState(false);

  const approxInvisible = useMemo(() => (28 + new Blob([secret]).size + 16) * 8, [secret]);

  const handleHide = async () => {
    setErrorHide('');
    setOutput('');
    if (!secret.trim() || !password) {
      setErrorHide('Escribe el mensaje secreto y una contraseña.');
      return;
    }
    setBusy(true);
    try {
      const payload = await encryptToPayload(secret, password);
      setOutput(emoji + bytesToZeroWidth(payload));
    } catch (e) {
      setErrorHide('No se pudo cifrar. ¿El navegador soporta WebCrypto (HTTPS)?');
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async () => {
    setRevealed('');
    setRevealState('idle');
    const payload = zeroWidthToBytes(pasted);
    if (payload.length < 29) {
      setRevealState('nocontent');
      return;
    }
    if (!revealPass) {
      setRevealed('Introduce la contraseña.');
      setRevealState('done');
      return;
    }
    setRevealBusy(true);
    try {
      const real = await decryptPayload(payload, revealPass);
      // Éxito → mensaje real. Fallo → señuelo determinista (nunca "contraseña incorrecta").
      setRevealed(real ?? (await decoyText(revealPass, payload)));
      setRevealState('done');
    } finally {
      setRevealBusy(false);
    }
  };

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400';
  const btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-5 py-2.5 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Mensajes Ocultos en Emojis — Cifrado AES-256 + esteganografía"
        description="Cifra un mensaje con AES-256-GCM + Argon2id y escóndelo en caracteres invisibles detrás de un emoji para enviarlo por WhatsApp o Telegram. Modo señuelo incluido."
        path="/herramientas/mensajes-ocultos-en-emojis"
        image="https://m4rtins.com/og/tool-mensajes-ocultos-en-emojis.png"
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/herramientas"
            className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a herramientas
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Mensajes Ocultos en Emojis
            </h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Cifra un mensaje con <b className="text-slate-300">AES-256-GCM + Argon2id</b> y ocúltalo
              en caracteres invisibles detrás de un emoji. Todo se genera en tu navegador; nada sale
              de esta página.
            </p>
          </header>

          {/* Tabs */}
          <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setMode('ocultar')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold ${
                mode === 'ocultar' ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'
              }`}
            >
              <Lock className="w-4 h-4" /> Ocultar
            </button>
            <button
              type="button"
              onClick={() => setMode('revelar')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold ${
                mode === 'revelar' ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'
              }`}
            >
              <Unlock className="w-4 h-4" /> Revelar
            </button>
          </div>

          {/* ---------- OCULTAR ---------- */}
          {mode === 'ocultar' && (
            <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Mensaje secreto
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      secret.length > MAX_CHARS ? 'text-red-400' : 'text-slate-500'
                    }`}
                  >
                    {secret.length}/{MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={secret}
                  onChange={(e) => setSecret(e.target.value.slice(0, MAX_CHARS))}
                  rows={4}
                  placeholder="Escribe aquí el mensaje que quieres ocultar…"
                  className={`${inputBase} resize-none`}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Contraseña
                </span>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Una contraseña fuerte (compártela por un canal seguro)"
                  className={`${inputBase} font-mono`}
                />
                <span className="text-xs text-slate-500">
                  ¿Sin ideas? Usa el{' '}
                  <Link
                    to="/herramientas/generador-de-contrasenas"
                    className="text-cyber-400 hover:text-cyber-300"
                  >
                    generador de contraseñas
                  </Link>
                  . La seguridad depende sobre todo de esto.
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Emoji de portada
                </span>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-11 h-11 rounded-lg border text-xl ${
                        emoji === e
                          ? 'border-cyber-400 bg-cyber-400/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {errorHide && <span className="text-sm text-red-400 font-medium">{errorHide}</span>}

              <div className="flex gap-3 flex-wrap items-center">
                <button type="button" className={btnPrimary} onClick={handleHide} disabled={busy}>
                  <Lock className="w-4 h-4" /> {busy ? 'Cifrando…' : 'Ocultar y generar'}
                </button>
                {secret && (
                  <span className="text-xs text-slate-500">
                    Ocupará ~{approxInvisible.toLocaleString('es')} caracteres invisibles.
                  </span>
                )}
              </div>

              {output && (
                <div className="flex flex-col gap-3">
                  <div className="bg-cyber-900 rounded-xl p-4 border border-slate-700">
                    <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                      Resultado (cópialo y pégalo en WhatsApp/Telegram)
                    </span>
                    <div className="text-3xl select-all" aria-label="Mensaje con contenido oculto">
                      {output}
                    </div>
                    <span className="block text-xs text-slate-500 mt-2">
                      Parece solo un emoji, pero lleva el mensaje cifrado en su interior.
                    </span>
                  </div>
                  <CopyButton text={output} label="Copiar mensaje oculto" />
                </div>
              )}
            </section>
          )}

          {/* ---------- REVELAR ---------- */}
          {mode === 'revelar' && (
            <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Pega aquí el mensaje recibido
                </span>
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={3}
                  placeholder="Pega el emoji (con su contenido oculto)…"
                  className={`${inputBase} resize-none text-2xl`}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Contraseña
                </span>
                <div className="relative">
                  <input
                    type={showRevealPass ? 'text' : 'password'}
                    value={revealPass}
                    onChange={(e) => setRevealPass(e.target.value)}
                    placeholder="La contraseña acordada"
                    className={`${inputBase} font-mono pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRevealPass((v) => !v)}
                    aria-label={showRevealPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyber-400 p-1.5"
                  >
                    {showRevealPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                className={btnPrimary}
                onClick={handleReveal}
                disabled={revealBusy}
              >
                <Unlock className="w-4 h-4" /> {revealBusy ? 'Descifrando…' : 'Revelar mensaje'}
              </button>

              {revealState === 'nocontent' && (
                <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-amber-400">
                  No se detectó contenido oculto en el texto pegado. Asegúrate de copiar el mensaje
                  completo (algunas apps recortan los caracteres invisibles).
                </p>
              )}

              {revealState === 'done' && (
                <div className="bg-cyber-900 rounded-xl p-4 border border-slate-700">
                  <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                    Mensaje
                  </span>
                  <p className="text-slate-100 whitespace-pre-wrap break-words select-all">
                    {revealed}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ---------- Avisos ---------- */}
          <section className="mt-6 grid gap-3">
            <p className="text-sm text-slate-400 bg-cyber-800 rounded-lg px-4 py-3 border-l-[3px] border-cyber-400 flex gap-3">
              <KeyRound className="w-5 h-5 text-cyber-400 flex-none mt-0.5" />
              <span>
                <b className="text-slate-200">Cómo de seguro es:</b> el cifrado (AES-256-GCM con clave
                derivada por Argon2id) es sólido; ni la fuerza bruta, ni la computación cuántica, ni
                la IA lo rompen. El punto débil es la <b className="text-slate-200">contraseña</b>:
                úsala larga y aleatoria y compártela por un canal aparte.
              </span>
            </p>
            <p className="text-sm text-slate-400 bg-cyber-800 rounded-lg px-4 py-3 border-l-[3px] border-amber-400 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 flex-none mt-0.5" />
              <span>
                <b className="text-slate-200">Modo señuelo:</b> con una contraseña incorrecta no verás
                un error, sino un texto plausible, para no confirmar a nadie si acertó. Es negación
                plausible frente a un curioso, <b className="text-slate-200">no</b> indistinguibilidad
                garantizada frente a un análisis experto. Herramienta educativa y de privacidad: para
                secretos críticos usa apps con cifrado de extremo a extremo como Signal.
              </span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
