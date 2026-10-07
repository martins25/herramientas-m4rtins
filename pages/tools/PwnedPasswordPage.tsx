import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Eye, EyeOff, ShieldAlert, ShieldCheck, Search, KeyRound } from 'lucide-react';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Comprueba si una contraseña está en los diccionarios usados por atacantes
   (rockyou + listas de filtraciones). Modelo k-anonymity con ficheros estáticos:
   se calcula el SHA-1 EN EL NAVEGADOR y solo se envía el prefijo (2 hex) para
   descargar el bloque correspondiente; el resto se compara en local. La
   contraseña nunca sale del navegador.
---------------------------------------------------------------------------- */

async function sha1HexUpper(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/* ---------- estimación de fuerza (local, independiente del diccionario) ---------- */
interface Strength {
  bits: number;
  verdict: string;
  color: string;
  crack: string;
}
function estimateStrength(pw: string): Strength {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(pool || 1);

  const secs = Math.pow(2, bits - 1) / 1e12; // 10^12 intentos/s
  const yr = secs / 31557600;
  let t: string;
  if (secs < 1) t = 'menos de un segundo';
  else if (secs < 3600) t = Math.round(secs / 60) + ' minutos';
  else if (secs < 86400 * 2) t = Math.round(secs / 3600) + ' horas';
  else if (yr < 1) t = Math.round(secs / 86400) + ' días';
  else if (yr < 1e6) t = Math.round(yr).toLocaleString('es') + ' años';
  else t = '~10^' + Math.floor(Math.log10(yr)) + ' años';

  const [verdict, color] =
    bits < 40
      ? ['Muy débil', '#ef4444']
      : bits < 60
        ? ['Débil', '#f87171']
        : bits < 80
          ? ['Aceptable', '#fbbf24']
          : bits < 100
            ? ['Fuerte', '#4ade80']
            : ['Excelente', '#22d3ee'];
  return { bits, verdict, color, crack: `Fuerza bruta a 10¹² intentos/s: ${t}.` };
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Es seguro escribir aquí mi contraseña?',
    a: 'Sí. Se calcula su hash SHA-1 en tu propio navegador y solo se envían los 2 primeros caracteres de ese hash para descargar un bloque de coincidencias; la comparación final se hace en tu dispositivo. Tu contraseña nunca se envía ni se guarda, y el prefijo se consulta contra nuestros propios ficheros, no contra terceros.',
  },
  {
    q: '¿Qué diccionarios se usan?',
    a: 'Un conjunto de las contraseñas más usadas en ataques reales (rockyou y listas de filtraciones tipo SecLists). No es exhaustivo, pero cubre la inmensa mayoría de las contraseñas débiles y reutilizadas.',
  },
  {
    q: '¿Qué hago si mi contraseña aparece?',
    a: 'Cámbiala cuanto antes en todos los sitios donde la uses y no vuelvas a reutilizarla. Genera una nueva aleatoria, guárdala en un gestor (KeePass, Bitwarden) y activa la verificación en dos pasos (2FA).',
  },
  {
    q: '¿Distingue mayúsculas y minúsculas?',
    a: 'Sí: el hash es sensible a mayúsculas, así que "Hola" y "hola" son distintas. Pero como los atacantes prueban variaciones triviales (capitalizar, MAYÚSCULAS, añadir números al final), también comprobamos esas variantes y te avisamos si tu contraseña es una de ellas.',
  },
  {
    q: '¿Que NO aparezca significa que es segura?',
    a: 'No necesariamente. Por eso, además de buscarla en los diccionarios, la herramienta estima su fuerza (longitud y variedad de caracteres). Una contraseña corta o predecible puede no estar en las listas y aun así ser débil. Lo ideal: larga, aleatoria y única para cada servicio.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '¿Tu contraseña está filtrada?',
    url: 'https://m4rtins.com/herramientas/comprobar-contrasena-filtrada',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Comprueba si tu contraseña aparece en los diccionarios que usan los ciberdelincuentes (rockyou y filtraciones). Privado: se comprueba por hash en el navegador.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
];

type Status = 'idle' | 'checking' | 'pwned' | 'variant' | 'safe' | 'error';

export const PwnedPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  const strength = React.useMemo(() => (password ? estimateStrength(password) : null), [password]);

  const check = async () => {
    if (!password) return;
    setStatus('checking');
    try {
      // Candidatas: la exacta + variaciones triviales que prueban los atacantes
      // (minúsculas y quitando símbolos/números del final).
      const cands = new Map<string, 'exact' | 'variant'>();
      cands.set(password, 'exact');
      const lower = password.toLowerCase();
      if (!cands.has(lower)) cands.set(lower, 'variant');
      const base = password.replace(/[^a-zA-Z]+$/, '').toLowerCase();
      if (base.length >= 3 && !cands.has(base)) cands.set(base, 'variant');

      const cache = new Map<string, Set<string>>();
      let exactHit = false;
      let variantHit = false;
      for (const [value, kind] of cands) {
        const hash = await sha1HexUpper(value);
        const prefix = hash.slice(0, 2);
        const suffix = hash.slice(2);
        let set = cache.get(prefix);
        if (!set) {
          const res = await fetch(`/pwned/${prefix}.txt`, { cache: 'force-cache' });
          set = res.ok ? new Set((await res.text()).split('\n')) : new Set<string>();
          cache.set(prefix, set);
        }
        if (set.has(suffix)) {
          if (kind === 'exact') exactHit = true;
          else variantHit = true;
        }
      }
      setStatus(exactHit ? 'pwned' : variantHit ? 'variant' : 'safe');
    } catch {
      setStatus('error');
    }
  };

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400 font-mono';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="¿Tu contraseña está filtrada? Compruébalo (rockyou y diccionarios)"
        description="Comprueba gratis si tu contraseña aparece en los diccionarios que usan los ciberdelincuentes (rockyou y filtraciones). Privado: se comprueba por hash en tu navegador, la contraseña nunca se envía."
        path="/herramientas/comprobar-contrasena-filtrada"
        image="https://m4rtins.com/og/tool-comprobar-contrasena-filtrada.png"
        jsonLd={JSONLD}
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
              ¿Tu contraseña está en los diccionarios de los ciberdelincuentes?
            </h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Comprueba si tu contraseña aparece en <b className="text-slate-300">rockyou</b> y en
              listas de filtraciones reales, y evalúa <b className="text-slate-300">su fuerza</b>. Se
              verifica <b className="text-slate-300">por hash en tu navegador</b>: la contraseña nunca
              se envía.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Contraseña a comprobar
              </span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && check()}
                  placeholder="Escribe la contraseña…"
                  className={`${inputBase} pr-11`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Ocultar' : 'Mostrar'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyber-400 p-1.5"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={check}
              disabled={!password || status === 'checking'}
              className="self-start inline-flex items-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-5 py-2.5 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" /> {status === 'checking' ? 'Comprobando…' : 'Comprobar'}
            </button>

            {strength && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="font-semibold" style={{ color: strength.color }}>
                    Fuerza: {strength.verdict}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-300">
                    {Math.round(strength.bits)} bits
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-cyber-900 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (strength.bits / 128) * 100)}%`, background: strength.color }}
                  />
                </div>
                <span className="text-xs text-slate-500">{strength.crack}</span>
              </div>
            )}

            {status === 'pwned' && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                <ShieldAlert className="w-6 h-6 text-red-400 flex-none mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">Aparece en los diccionarios.</p>
                  <p className="text-sm text-slate-300 mt-1">
                    Esta contraseña la conocen los atacantes. Cámbiala ya donde la uses y no la
                    reutilices.{' '}
                    <Link to="/herramientas/generador-de-contrasenas" className="text-cyber-400 hover:text-cyber-300">
                      Genera una segura aquí
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

            {status === 'variant' && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <ShieldAlert className="w-6 h-6 text-amber-400 flex-none mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300">Es una variación trivial de una contraseña común.</p>
                  <p className="text-sm text-slate-300 mt-1">
                    La forma exacta no está, pero una variante obvia (mayúsculas/minúsculas o quitando
                    los números/símbolos del final) sí está en los diccionarios. Los atacantes prueban
                    estas variaciones automáticamente, así que considérala débil.{' '}
                    <Link to="/herramientas/generador-de-contrasenas" className="text-cyber-400 hover:text-cyber-300">
                      Genera una segura aquí
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

            {status === 'safe' && (
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  strength && strength.bits >= 80
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-amber-500/40 bg-amber-500/10'
                }`}
              >
                {strength && strength.bits >= 80 ? (
                  <ShieldCheck className="w-6 h-6 text-green-400 flex-none mt-0.5" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-amber-400 flex-none mt-0.5" />
                )}
                <div>
                  {strength && strength.bits >= 80 ? (
                    <>
                      <p className="font-bold text-green-300">No aparece en los diccionarios y es fuerte.</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Buena contraseña. Asegúrate de que es <b className="text-slate-200">única</b> para
                        cada servicio y guárdala en un gestor.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-amber-300">No aparece en los diccionarios, pero es débil.</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Que no esté en las listas no la hace segura: es corta o poco aleatoria y podría
                        caer por fuerza bruta.{' '}
                        <Link to="/herramientas/generador-de-contrasenas" className="text-cyber-400 hover:text-cyber-300">
                          Genera una más fuerte
                        </Link>
                        .
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {status === 'error' && (
              <p className="text-sm text-red-400">No se pudo comprobar. Revisa tu conexión e inténtalo de nuevo.</p>
            )}

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-cyber-400 flex gap-3">
              <KeyRound className="w-5 h-5 text-cyber-400 flex-none mt-0.5" />
              <span>
                <b className="text-slate-200">Privacidad:</b> se calcula el hash SHA-1 en tu navegador
                y solo se envían <b className="text-slate-200">2 caracteres</b> de ese hash para
                descargar el bloque de coincidencias; la comparación se hace en tu dispositivo. La
                contraseña nunca viaja.
              </span>
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Por qué importa</h2>
            <p className="text-slate-400">
              Los ataques de fuerza bruta y <i>credential stuffing</i> no prueban combinaciones al
              azar: usan <b className="text-slate-200">diccionarios</b> con millones de contraseñas
              reales filtradas (como <b className="text-slate-200">rockyou</b>). Si tu contraseña está
              en esas listas, un atacante la prueba en segundos. Esta herramienta te dice si la tuya
              está entre ellas, sin que tengas que confiarla a nadie.
            </p>

            <h2 className="text-2xl font-bold text-white pt-2">Preguntas frecuentes</h2>
            <div className="divide-y divide-slate-700/60 border-t border-slate-700/60">
              {FAQ.map((f) => (
                <div key={f.q} className="py-4">
                  <h3 className="text-white font-semibold mb-1">{f.q}</h3>
                  <p className="text-slate-400 text-sm">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
