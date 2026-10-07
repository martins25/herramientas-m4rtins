import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Copy, Check, FileText, Type, Upload } from 'lucide-react';
import SparkMD5 from 'spark-md5';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Generador de hashes (MD5, SHA-1/256/384/512). 100% local, sin red.
   SHA-* con WebCrypto; MD5 con spark-md5.
---------------------------------------------------------------------------- */

const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
type Algo = (typeof ALGOS)[number];
type Format = 'hex' | 'base64';

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function format(bytes: Uint8Array, f: Format): string {
  return f === 'hex' ? hex(bytes) : b64(bytes);
}

async function computeAll(buffer: ArrayBuffer): Promise<Record<Algo, Uint8Array>> {
  const [s1, s256, s384, s512] = await Promise.all([
    crypto.subtle.digest('SHA-1', buffer),
    crypto.subtle.digest('SHA-256', buffer),
    crypto.subtle.digest('SHA-384', buffer),
    crypto.subtle.digest('SHA-512', buffer),
  ]);
  const md5raw = SparkMD5.ArrayBuffer.hash(buffer, true); // binary string
  const md5 = Uint8Array.from(md5raw, (c) => c.charCodeAt(0));
  return {
    MD5: md5,
    'SHA-1': new Uint8Array(s1),
    'SHA-256': new Uint8Array(s256),
    'SHA-384': new Uint8Array(s384),
    'SHA-512': new Uint8Array(s512),
  };
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Qué algoritmo debo usar?',
    a: 'Para seguridad (contraseñas, firmas, integridad crítica) usa SHA-256 o superior. MD5 y SHA-1 están obsoletos criptográficamente (tienen colisiones conocidas) y solo valen para checksums de integridad no crítica.',
  },
  {
    q: '¿Se sube mi texto o archivo a algún servidor?',
    a: 'No. Todo el cálculo se hace en tu navegador con WebCrypto (y spark-md5 para MD5); no se envía nada por la red.',
  },
  {
    q: '¿Para qué sirve hashear un archivo?',
    a: 'Para verificar su integridad: si el hash que obtienes coincide con el publicado por el autor, el archivo no se ha corrompido ni manipulado durante la descarga.',
  },
  {
    q: '¿Un hash se puede revertir?',
    a: 'No directamente: es una función de un solo sentido. Pero para entradas cortas o comunes se puede adivinar por diccionario/fuerza bruta, por eso las contraseñas se guardan con funciones específicas (bcrypt, Argon2), no con un simple MD5/SHA.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Generador de hashes (MD5, SHA-256, SHA-512…)',
    url: 'https://m4rtins.com/herramientas/generador-de-hashes',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Genera hashes MD5, SHA-1, SHA-256, SHA-384 y SHA-512 de texto o archivos en tu navegador. No se envía nada por la red.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

const HashRow: React.FC<{ algo: Algo; value: string }> = ({ algo, value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1 bg-cyber-900 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{algo}</span>
        <button
          type="button"
          onClick={() => {
            if (!value) return;
            navigator.clipboard.writeText(value).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 1400); },
              () => {}
            );
          }}
          aria-label={`Copiar ${algo}`}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyber-400 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <span className="font-mono text-sm text-cyber-400 break-all select-all">{value}</span>
    </div>
  );
};

export const GeneradorHashesPage: React.FC = () => {
  const [mode, setMode] = useState<'texto' | 'archivo'>('texto');
  const [text, setText] = useState('');
  const [fmt, setFmt] = useState<Format>('hex');
  const [hashes, setHashes] = useState<Record<Algo, Uint8Array> | null>(null);
  const [fileInfo, setFileInfo] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Texto: recalcular en vivo
  useEffect(() => {
    if (mode !== 'texto') return;
    if (!text) { setHashes(null); return; }
    let alive = true;
    const bytes = new TextEncoder().encode(text);
    computeAll(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).then((h) => {
      if (alive) setHashes(h);
    });
    return () => { alive = false; };
  }, [text, mode]);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setHashes(null);
    setFileInfo(`${file.name} · ${(file.size / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} KB`);
    try {
      const buf = await file.arrayBuffer();
      setHashes(await computeAll(buf));
    } finally {
      setBusy(false);
    }
  }, []);

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Generador de Hashes Online — MD5, SHA-256, SHA-512"
        description="Genera hashes MD5, SHA-1, SHA-256, SHA-384 y SHA-512 de texto o archivos, en hex o Base64. 100% en tu navegador, sin enviar nada por la red."
        path="/herramientas/generador-de-hashes"
        image="https://m4rtins.com/og/tool-generador-de-hashes.png"
        jsonLd={JSONLD}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/herramientas" className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a herramientas
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Generador de Hashes</h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Calcula <b className="text-slate-300">MD5, SHA-1, SHA-256, SHA-384 y SHA-512</b> de un
              texto o un archivo. Todo en tu navegador: no se envía nada por la red.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            {/* Modo */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setMode('texto'); setHashes(null); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${mode === 'texto' ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'}`}
                >
                  <Type className="w-4 h-4" /> Texto
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('archivo'); setHashes(null); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${mode === 'archivo' ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'}`}
                >
                  <FileText className="w-4 h-4" /> Archivo
                </button>
              </div>
              <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
                {(['hex', 'base64'] as Format[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFmt(f)}
                    className={`px-3 py-2 text-sm font-semibold ${fmt === f ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'}`}
                  >
                    {f === 'hex' ? 'Hex' : 'Base64'}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'texto' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Escribe o pega el texto a hashear…"
                className={`${inputBase} resize-none`}
              />
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-cyber-900 px-4 py-8 cursor-pointer hover:border-cyber-400 transition-colors text-center">
                <Upload className="w-7 h-7 text-cyber-400" />
                <span className="text-sm text-slate-300">Haz clic o suelta un archivo para calcular su hash</span>
                {fileInfo && <span className="text-xs text-slate-500 font-mono mt-1">{fileInfo}</span>}
                <input type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            )}

            {busy && <p className="text-sm text-slate-400">Calculando…</p>}

            {hashes && (
              <div className="grid grid-cols-1 gap-2">
                {ALGOS.map((a) => (
                  <HashRow key={a} algo={a} value={format(hashes[a], fmt)} />
                ))}
              </div>
            )}

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-amber-400">
              <b className="text-slate-200">Nota:</b> MD5 y SHA-1 están obsoletos para seguridad
              (tienen colisiones); úsalos solo como checksum. Para integridad o firmas, SHA-256 o
              superior. Las contraseñas nunca deben guardarse con un simple hash: usa bcrypt o Argon2.
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Qué es un hash</h2>
            <p className="text-slate-400">
              Un <b className="text-slate-200">hash</b> es una huella digital de tamaño fijo que
              resume cualquier dato. La misma entrada siempre produce el mismo hash, y un cambio
              mínimo lo altera por completo. Se usa para <b className="text-slate-200">verificar la
              integridad</b> de descargas, comparar ficheros o como pieza de firmas digitales. Esta
              herramienta calcula los algoritmos más comunes al instante y en local.
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
