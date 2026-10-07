import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Copy, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { WORDS, WORDS_ES } from './wordlists';
import { Seo } from '../../components/Seo';

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Qué es una contraseña segura?',
    a: 'Una contraseña segura es larga (16 caracteres o más), aleatoria y única para cada servicio. Cuanto mayor es su entropía (medida en bits), más inviable resulta adivinarla por fuerza bruta. A partir de 128 bits, romperla es imposible en la práctica.',
  },
  {
    q: '¿Cuántos caracteres debe tener una contraseña?',
    a: 'Para cuentas importantes, apunta a un mínimo de 16 caracteres combinando mayúsculas, minúsculas, números y símbolos. Si prefieres algo memorable, una frase de contraseña de 4 o más palabras aleatorias ofrece una seguridad excelente.',
  },
  {
    q: '¿Es seguro este generador de contraseñas online?',
    a: 'Sí. Todo se genera localmente en tu navegador con crypto.getRandomValues (el generador criptográficamente seguro del sistema). Ninguna contraseña ni semilla se envía por la red ni se almacena en ningún servidor.',
  },
  {
    q: '¿Dónde debería guardar mis contraseñas?',
    a: 'Nunca en un archivo de texto ni en el navegador sin cifrar. Usa un gestor de contraseñas como KeePass o Bitwarden: solo tendrás que recordar una contraseña maestra y podrás activar la verificación en dos pasos (MFA).',
  },
];

const GEN_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Generador de Contraseñas Seguras',
    url: 'https://m4rtins.com/herramientas/generador-de-contrasenas',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Generador gratuito de contraseñas seguras, frases de contraseña y semillas de wallet BIP39. Funciona en el navegador sin enviar nada por la red.',
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

const DICT: Record<'es' | 'en', string[]> = { es: WORDS_ES, en: WORDS };

/* ---------- aleatoriedad uniforme (sin sesgo de módulo) ---------- */
function randInt(n: number): number {
  const lim = Math.floor(0x100000000 / n) * n;
  const b = new Uint32Array(1);
  do {
    crypto.getRandomValues(b);
  } while (b[0] >= lim);
  return b[0] % n;
}
const pickArr = <T,>(arr: T[]): T => arr[randInt(arr.length)];
const pickChar = (s: string): string => s[randInt(s.length)];

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!#$%&*+-./:;<=>?@[]^_{|}~()',
};
const AMBIG = /[0O1lI|]/g;
const SEP_CHARS = ['-', '_', '.', '!', '#', '$', '%', '*', '+', '=', '@', '~', '/'];

type SegKind = 'plain' | 'digit' | 'symbol' | 'sep' | 'num';
interface Seg {
  t: string;
  kind: SegKind;
}
interface GenResult {
  segments: Seg[];
  text: string;
  bits: number;
}

interface PwOpts {
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  ambig: boolean;
}

function genPassword(length: number, opts: PwOpts): GenResult | null {
  const sets: string[] = [];
  if (opts.upper) sets.push(SETS.upper);
  if (opts.lower) sets.push(SETS.lower);
  if (opts.digits) sets.push(SETS.digits);
  if (opts.symbols) sets.push(SETS.symbols);
  const clean = (opts.ambig ? sets.map((s) => s.replace(AMBIG, '')) : sets).filter((s) => s.length);
  if (!clean.length) return null;

  const pool = clean.join('');
  let pw = '';
  // Muestreo uniforme sobre el conjunto válido: se descarta si falta algún tipo marcado.
  do {
    pw = Array.from({ length }, () => pickChar(pool)).join('');
  } while (length >= clean.length && !clean.every((s) => [...pw].some((c) => s.includes(c))));

  const segments: Seg[] = [...pw].map((c) => ({
    t: c,
    kind: /\d/.test(c) ? 'digit' : /[A-Za-z]/.test(c) ? 'plain' : 'symbol',
  }));
  return { segments, text: pw, bits: length * Math.log2(pool.length) };
}

function genPassphrase(
  lang: 'es' | 'en',
  n: number,
  sepMode: string,
  cap: boolean,
  addNum: boolean
): GenResult {
  const dict = DICT[lang];
  const words = Array.from({ length: n }, () => {
    const x = pickArr(dict);
    return cap ? x[0].toUpperCase() + x.slice(1) : x;
  });
  let bits = n * Math.log2(dict.length);
  const segments: Seg[] = [];
  words.forEach((x, i) => {
    segments.push({ t: x, kind: 'plain' });
    if (i < n - 1) {
      const s = sepMode === 'rand' ? pickArr(SEP_CHARS) : sepMode;
      segments.push({ t: s, kind: 'sep' });
    }
  });
  if (sepMode === 'rand') bits += (n - 1) * Math.log2(SEP_CHARS.length);
  if (addNum) {
    const d = String(randInt(100)).padStart(2, '0');
    const s = sepMode === 'rand' ? pickArr(SEP_CHARS) : sepMode;
    segments.push({ t: s, kind: 'sep' }, { t: d, kind: 'num' });
    bits += Math.log2(100) + (sepMode === 'rand' ? Math.log2(SEP_CHARS.length) : 0);
  }
  return { segments, text: segments.map((p) => p.t).join(''), bits };
}

/* ---------- BIP39 ---------- */
async function genSeed(n: number): Promise<string[]> {
  const entBytes = n === 12 ? 16 : 32;
  const ent = crypto.getRandomValues(new Uint8Array(entBytes));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', ent));
  const csBits = (entBytes * 8) / 32;
  let bits = [...ent].map((b) => b.toString(2).padStart(8, '0')).join('');
  bits += hash[0].toString(2).padStart(8, '0').slice(0, csBits);
  return bits.match(/.{11}/g)!.map((b) => WORDS[parseInt(b, 2)]);
}

/* ---------- fuerza / entropía ---------- */
interface Strength {
  verdict: string;
  color: string;
  crack: string;
}
function strength(bits: number): Strength {
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
    bits < 60
      ? ['Débil', '#f87171']
      : bits < 80
        ? ['Aceptable', '#fbbf24']
        : bits < 128
          ? ['Fuerte', '#4ade80']
          : ['Inviable de romper', '#22d3ee'];
  return { verdict, color, crack: `Fuerza bruta a 10¹² intentos/s: ${t} de media.` };
}

const segClass: Record<SegKind, string> = {
  plain: 'text-slate-100',
  digit: 'text-cyber-400',
  symbol: 'text-amber-400',
  sep: 'text-cyber-400 font-semibold',
  num: 'text-cyber-400',
};

/* ---------- controles reutilizables ---------- */
const CheckCard: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
}> = ({ checked, onChange, label, hint, inputRef, className = '' }) => (
  <label
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-colors ${
      checked ? 'border-cyber-400 bg-cyber-400/10' : 'border-slate-700 hover:border-slate-600'
    } ${className}`}
  >
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-[18px] h-[18px] accent-cyber-400"
    />
    <span className="text-sm text-slate-200">{label}</span>
    {hint && <small className="ml-auto font-mono text-xs text-slate-500">{hint}</small>}
  </label>
);

export const GeneradorContrasenasPage: React.FC = () => {
  // modo
  const [phraseMode, setPhraseMode] = useState(false);
  // contraseña
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [ambig, setAmbig] = useState(false);
  // frase
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [wordCount, setWordCount] = useState(10);
  const [sepMode, setSepMode] = useState('rand');
  const [cap, setCap] = useState(true);
  const [addNum, setAddNum] = useState(false);
  // regeneración forzada
  const [pwNonce, setPwNonce] = useState(0);

  const [result, setResult] = useState<GenResult | null>(null);
  const [pwError, setPwError] = useState(false);
  const [copiedMain, setCopiedMain] = useState(false);
  const outRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<HTMLInputElement>(null);

  // semilla
  const [seedWords, setSeedWords] = useState(24);
  const [seed, setSeed] = useState<string[]>([]);
  const [seedHidden, setSeedHidden] = useState(true);
  const [seedError, setSeedError] = useState(false);
  const [seedNonce, setSeedNonce] = useState(0);
  const [copiedSeed, setCopiedSeed] = useState(false);
  const seedRef = useRef<HTMLOListElement>(null);

  // generar contraseña / frase al cambiar cualquier parámetro
  useEffect(() => {
    if (phraseMode) {
      setResult(genPassphrase(lang, wordCount, sepMode, cap, addNum));
      setPwError(false);
    } else {
      const r = genPassword(length, { upper, lower, digits, symbols, ambig });
      setPwError(!r);
      setResult(r);
    }
  }, [phraseMode, length, upper, lower, digits, symbols, ambig, lang, wordCount, sepMode, cap, addNum, pwNonce]);

  // checkbox "Letras" en estado intermedio
  useEffect(() => {
    if (lettersRef.current) lettersRef.current.indeterminate = upper !== lower;
  }, [upper, lower]);

  // semilla BIP39
  useEffect(() => {
    let alive = true;
    genSeed(seedWords)
      .then((s) => {
        if (!alive) return;
        setSeed(s);
        setSeedHidden(true);
        setSeedError(false);
      })
      .catch(() => {
        if (!alive) return;
        setSeed([]);
        setSeedError(true);
      });
    return () => {
      alive = false;
    };
  }, [seedWords, seedNonce]);

  const selectEl = (el: HTMLElement | null) => {
    if (!el) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  const copyText = useCallback(
    (text: string, el: HTMLElement | null, setCopied: (v: boolean) => void) => {
      if (!text) return;
      const done = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      };
      const fallback = () => selectEl(el);
      try {
        navigator.clipboard.writeText(text).then(done, fallback);
      } catch {
        fallback();
      }
    },
    []
  );

  const meter = result ? strength(result.bits) : null;
  const barWidth = result ? Math.min(100, (result.bits / 160) * 100) : 0;

  const btnPrimary =
    'flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-4 py-2.5 hover:brightness-110 transition-all';
  const btnGhost =
    'flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 text-slate-200 font-semibold px-4 py-2.5 hover:border-cyber-400 transition-colors';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Generador de Contraseñas Seguras Online Gratis"
        description="Generador de contraseñas seguras gratis: crea contraseñas fuertes, frases de contraseña y semillas BIP39 en tu navegador. Sin registro y sin enviar nada por la red."
        path="/herramientas/generador-de-contrasenas"
        jsonLd={GEN_JSONLD}
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
              Generador de Contraseñas Seguras
            </h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Crea una contraseña segura, una frase de contraseña o una semilla BIP39. Todo se genera
              en tu navegador con{' '}
              <code className="font-mono text-cyber-400">crypto.getRandomValues</code>: nada sale de
              esta página.
            </p>
          </header>

          {/* ---------- Panel contraseña / frase ---------- */}
          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-5 mb-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Resultado
            </span>

            <div
              ref={outRef}
              aria-live="polite"
              className="bg-cyber-900 rounded-xl p-4 font-mono text-lg md:text-xl leading-relaxed break-all select-all min-h-[3.4em]"
            >
              {result?.segments.map((s, i) => (
                <span key={i} className={segClass[s.kind]}>
                  {s.t}
                </span>
              ))}
            </div>

            {/* medidor */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline text-sm">
                <span className="font-semibold" style={{ color: meter?.color }}>
                  {result ? meter?.verdict : '—'}
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-300">
                  {result ? Math.round(result.bits) : 0} bits
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-cyber-900 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barWidth}%`, background: meter?.color }}
                />
              </div>
              <span className="text-xs text-slate-500">{result ? meter?.crack : ''}</span>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button type="button" className={btnPrimary} onClick={() => setPwNonce((n) => n + 1)}>
                <RefreshCw className="w-4 h-4" /> Generar
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => copyText(result?.text ?? '', outRef.current, setCopiedMain)}
              >
                {copiedMain ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedMain ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <hr className="border-slate-700" />

            {/* switch modo */}
            <button
              type="button"
              onClick={() => setPhraseMode((v) => !v)}
              className="flex items-center justify-between gap-4 bg-cyber-400/10 rounded-xl px-4 py-3 text-left"
            >
              <span>
                <b className="block text-slate-100 font-semibold">Palabras concatenadas</b>
                <em className="not-italic text-sm text-slate-400">
                  Ej.: Tortuga#Nube%Faro… en vez de caracteres sueltos
                </em>
              </span>
              <span
                className={`relative w-12 h-7 rounded-full flex-none transition-colors ${
                  phraseMode ? 'bg-cyber-400' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    phraseMode ? 'translate-x-5' : ''
                  }`}
                />
              </span>
            </button>

            {/* controles contraseña */}
            {!phraseMode && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Longitud
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={8}
                      max={128}
                      value={length}
                      onChange={(e) => setLength(+e.target.value)}
                      className="flex-1 accent-cyber-400"
                      aria-label="Longitud"
                    />
                    <input
                      type="number"
                      min={8}
                      max={128}
                      value={length}
                      onChange={(e) => {
                        const v = Math.min(128, Math.max(8, parseInt(e.target.value) || 20));
                        setLength(v);
                      }}
                      className="w-16 text-center font-mono font-semibold tabular-nums px-2 py-1.5 rounded-lg border border-slate-700 bg-cyber-900 text-slate-100"
                      aria-label="Longitud exacta"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Caracteres
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <CheckCard
                      inputRef={lettersRef}
                      checked={upper && lower}
                      onChange={(v) => {
                        setUpper(v);
                        setLower(v);
                      }}
                      label="Letras"
                      hint="a–Z"
                    />
                    <CheckCard checked={upper} onChange={setUpper} label="Mayúsculas" hint="A–Z" />
                    <CheckCard checked={lower} onChange={setLower} label="Minúsculas" hint="a–z" />
                    <CheckCard checked={digits} onChange={setDigits} label="Números" hint="0–9" />
                    <CheckCard checked={symbols} onChange={setSymbols} label="Símbolos" hint="!#$%…" />
                    <CheckCard
                      checked={ambig}
                      onChange={setAmbig}
                      label="Evitar ambiguos"
                      hint="0O1lI|"
                    />
                  </div>
                  {pwError && (
                    <span className="text-sm text-red-400 font-medium">
                      Marca al menos un tipo de carácter.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* controles frase */}
            {phraseMode && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Idioma del diccionario
                  </span>
                  <div className="inline-flex self-start border border-slate-700 rounded-lg overflow-hidden">
                    {(['es', 'en'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLang(l)}
                        className={`px-4 py-2 text-sm font-semibold ${
                          lang === l ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'
                        }`}
                      >
                        {l === 'es' ? 'Español' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Número de palabras
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={4}
                      max={16}
                      value={wordCount}
                      onChange={(e) => setWordCount(+e.target.value)}
                      className="flex-1 accent-cyber-400"
                      aria-label="Número de palabras"
                    />
                    <span className="font-mono font-semibold tabular-nums min-w-[2.5ch] text-right text-slate-100">
                      {wordCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Separador
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSepMode('rand')}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                        sepMode === 'rand'
                          ? 'bg-cyber-400 text-cyber-900 border-cyber-400'
                          : 'border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      Aleatorio (más entropía)
                    </button>
                    {SEP_CHARS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSepMode(c)}
                        className={`w-10 py-1.5 rounded-lg border font-mono font-semibold ${
                          sepMode === c
                            ? 'bg-cyber-400 text-cyber-900 border-cyber-400'
                            : 'border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CheckCard checked={cap} onChange={setCap} label="Mayúscula inicial" />
                  <CheckCard checked={addNum} onChange={setAddNum} label="Añadir número" />
                </div>
              </div>
            )}
          </section>

          {/* ---------- Panel semilla ---------- */}
          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-white">Semilla de wallet</h2>
              <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
                {[12, 24].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeedWords(n)}
                    className={`px-4 py-2 text-sm font-semibold ${
                      seedWords === n ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {seedError ? (
              <p className="text-sm text-red-400">
                <b>No se pudo calcular el checksum:</b> este navegador no expone SHA-256
                (crypto.subtle). Abre la página por HTTPS en un navegador actual.
              </p>
            ) : (
              <ol
                ref={seedRef}
                aria-label="Palabras de la semilla"
                className={`grid grid-cols-2 sm:grid-cols-3 gap-2 transition-all ${
                  seedHidden ? 'blur-[7px] select-none pointer-events-none' : ''
                }`}
              >
                {seed.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-2 bg-cyber-900 rounded-lg px-3 py-2 font-mono text-sm min-w-0"
                  >
                    <span className="text-xs text-slate-500 tabular-nums min-w-[2ch] text-right">
                      {i + 1}
                    </span>
                    <span className="text-slate-100 truncate">{w}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setSeedNonce((n) => n + 1)}
              >
                <RefreshCw className="w-4 h-4" /> Generar semilla
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setSeedHidden((h) => !h)}
              >
                {seedHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {seedHidden ? 'Mostrar' : 'Ocultar'}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => copyText(seed.join(' '), seedRef.current, setCopiedSeed)}
              >
                {copiedSeed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedSeed ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-amber-400">
              <b className="text-slate-200">BIP39 estándar</b> (lista inglesa, checksum SHA-256),
              compatible con MetaMask, Ledger, Trezor, Electrum… Para fondos reales, genera la
              semilla <b className="text-slate-200">en tu hardware wallet</b> o en esta página abierta
              sin conexión, y apúntala en papel, nunca en el portapapeles ni en la nube.
            </p>
          </section>

          {/* Recomendación de gestor de contraseñas */}
          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 mt-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-2">
              <ShieldCheck className="w-5 h-5 text-cyber-400" /> Guarda tus contraseñas en un gestor
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Una contraseña larga y aleatoria es imposible de memorizar, y ese es precisamente el
              objetivo. Guárdala en un <b className="text-slate-200">gestor de contraseñas</b>: solo
              tendrás que recordar una contraseña maestra. Recomiendo{' '}
              <a
                href="https://keepass.info/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyber-400 hover:text-cyber-300 font-medium"
              >
                KeePass
              </a>{' '}
              (gratuito, de código abierto y con la base de datos cifrada en tu propio equipo) o
              alternativas como Bitwarden o KeePassXC. Activa además la verificación en dos pasos
              (MFA) siempre que el servicio lo permita. ¿Usas ya una contraseña y dudas de ella?{' '}
              <Link
                to="/herramientas/comprobar-contrasena-filtrada"
                className="text-cyber-400 hover:text-cyber-300 font-medium"
              >
                Comprueba si está filtrada
              </Link>
              .
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">
              Cómo crear una contraseña segura
            </h2>
            <p className="text-slate-400">
              Una buena contraseña cumple tres reglas: es <b className="text-slate-200">larga</b> (16
              caracteres o más), es <b className="text-slate-200">aleatoria</b> (no contiene palabras,
              fechas ni patrones previsibles) y es <b className="text-slate-200">única</b> para cada
              servicio. Este generador de contraseñas te permite ajustar la longitud, mezclar
              mayúsculas, minúsculas, números y símbolos, y evitar caracteres ambiguos. Si prefieres
              algo que puedas teclear a mano, genera una frase de contraseña con varias palabras
              aleatorias: es fácil de escribir y muy difícil de romper.
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

          <footer className="text-center text-xs text-slate-500 mt-8">
            Entropía estimada como longitud × log₂(alfabeto). A partir de 128 bits la fuerza bruta es
            inviable.
          </footer>
        </div>
      </div>
    </div>
  );
};
