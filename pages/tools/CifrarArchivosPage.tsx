import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Upload, Download, Lock, Unlock, Copy, Check, ShieldCheck, Loader2 } from 'lucide-react';
import { argon2id } from 'hash-wasm';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Cifrado de archivos AES-256-GCM + Argon2id. 100% en el navegador:
   el archivo NUNCA se sube a ningún servidor.
   Formato del contenedor .enc:
   [ magic "M4F1" (4) | version (1) | nameLen uint16 LE (2) | name (nameLen)
     | salt (16) | iv (12) | ciphertext+tag ]
---------------------------------------------------------------------------- */

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const MAGIC = [0x4d, 0x34, 0x46, 0x31]; // "M4F1"
const VERSION = 1;

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(data: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

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

function downloadBytes(data: Uint8Array, name: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type Mode = 'encrypt' | 'decrypt';

interface Result {
  mode: Mode;
  name: string;
  originalSha?: string;
  encryptedSha?: string;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Se sube mi archivo a algún servidor?',
    a: 'No. Todo el cifrado y descifrado ocurre en tu navegador con la API WebCrypto; el archivo nunca se envía por la red ni se guarda en ningún sitio. Puedes comprobarlo: funciona sin conexión una vez cargada la página.',
  },
  {
    q: '¿Qué cifrado utiliza?',
    a: 'AES-256-GCM (cifrado autenticado) con una clave derivada de tu contraseña mediante Argon2id, siguiendo las recomendaciones de OWASP. El resultado incluye salt e IV aleatorios por archivo.',
  },
  {
    q: '¿Por qué hay un límite de tamaño?',
    a: 'El navegador cifra el archivo completo en memoria, así que el tamaño está limitado por la RAM disponible. El límite es de 100 MB en escritorio; en móvil conviene usar archivos más pequeños (25–50 MB) para evitar que la pestaña se quede sin memoria.',
  },
  {
    q: '¿Para qué sirve el checksum?',
    a: 'El SHA-256 del archivo cifrado te permite enviarlo junto al fichero para que quien lo reciba verifique que no se ha corrompido ni manipulado durante el envío. El del archivo original te sirve para confirmar, tras descifrar, que has recuperado exactamente el mismo contenido.',
  },
  {
    q: '¿Qué pasa si olvido la contraseña?',
    a: 'No hay forma de recuperar el contenido. No existe puerta trasera ni servidor con una copia: si pierdes la contraseña, el archivo cifrado es irrecuperable. Guárdala bien.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Cifrar archivos online',
    url: 'https://m4rtins.com/herramientas/cifrar-archivos',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Cifra y descifra archivos y documentos con AES-256-GCM y Argon2id en tu navegador, con checksum SHA-256. Nada se sube a ningún servidor.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

export const CifrarArchivosPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState('');

  const pickFile = useCallback((f: File | undefined) => {
    setError('');
    setResult(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`El archivo supera el límite de ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB. Usa uno más pequeño.`);
      return;
    }
    if (f.size === 0) {
      setError('El archivo está vacío.');
      return;
    }
    setFile(f);
  }, []);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1400);
    });
  };

  const run = async () => {
    if (!file || !password) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      if (mode === 'encrypt') {
        const originalSha = await sha256Hex(data);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));

        const nameBytes = new TextEncoder().encode(file.name);
        const header = new Uint8Array(4 + 1 + 2 + nameBytes.length);
        header.set(MAGIC, 0);
        header[4] = VERSION;
        header[5] = nameBytes.length & 0xff;
        header[6] = (nameBytes.length >> 8) & 0xff;
        header.set(nameBytes, 7);

        const out = new Uint8Array(header.length + 16 + 12 + ct.length);
        out.set(header, 0);
        out.set(salt, header.length);
        out.set(iv, header.length + 16);
        out.set(ct, header.length + 28);

        const encryptedSha = await sha256Hex(out);
        downloadBytes(out, `${file.name}.enc`);
        setResult({ mode, name: `${file.name}.enc`, originalSha, encryptedSha });
      } else {
        // descifrar
        if (data.length < 35 || !MAGIC.every((b, i) => data[i] === b)) {
          throw new Error('BAD_FORMAT');
        }
        const nameLen = data[5] | (data[6] << 8);
        const name = new TextDecoder().decode(data.slice(7, 7 + nameLen));
        let off = 7 + nameLen;
        const salt = data.slice(off, off + 16);
        const iv = data.slice(off + 16, off + 28);
        const ct = data.slice(off + 28);
        const key = await deriveKey(password, salt);
        const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
        const originalSha = await sha256Hex(pt);
        downloadBytes(pt, name || 'archivo-descifrado');
        setResult({ mode, name: name || 'archivo-descifrado', originalSha });
      }
    } catch (e) {
      if ((e as Error).message === 'BAD_FORMAT') {
        setError('Este archivo no tiene el formato .enc de esta herramienta.');
      } else if (mode === 'decrypt') {
        setError('No se pudo descifrar: contraseña incorrecta o archivo dañado.');
      } else {
        setError('Se produjo un error al procesar el archivo.');
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPassword('');
    setResult(null);
    setError('');
  };

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400 text-sm';

  const accept = mode === 'decrypt' ? '.enc' : undefined;

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Cifrar archivos online (AES-256) con checksum | Gratis"
        description="Cifra y descifra archivos y documentos con AES-256-GCM + Argon2id en tu navegador y obtén el checksum SHA-256. Nada se sube a ningún servidor."
        path="/herramientas/cifrar-archivos"
        image="https://m4rtins.com/og/tool-cifrar-archivos.png"
        jsonLd={JSONLD}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/herramientas" className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a herramientas
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Cifrar archivos</h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Cifra cualquier archivo o documento con <b className="text-slate-300">AES-256-GCM</b> y una contraseña,
              y obtén su <b className="text-slate-300">checksum SHA-256</b>. Todo ocurre{' '}
              <b className="text-slate-300">en tu navegador</b>: el archivo no se sube a ningún servidor.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-5">
            {/* Modo */}
            <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden self-start">
              {(['encrypt', 'decrypt'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); reset(); }}
                  className={`px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 ${mode === m ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'}`}
                >
                  {m === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {m === 'encrypt' ? 'Cifrar' : 'Descifrar'}
                </button>
              ))}
            </div>

            {/* Archivo */}
            {!file ? (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors ${
                  dragOver ? 'border-cyber-400 bg-cyber-900/60' : 'border-slate-600 hover:border-cyber-400/70'
                }`}
              >
                <Upload className="w-8 h-8 text-cyber-400" />
                <span className="text-slate-200 font-semibold">
                  {mode === 'encrypt' ? 'Sube el archivo a cifrar' : 'Sube el archivo .enc a descifrar'}
                </span>
                <span className="text-slate-500 text-sm text-center">
                  Arrastra el archivo aquí o haz clic para elegir · máx. {(MAX_BYTES / 1024 / 1024).toFixed(0)} MB
                </span>
                <input type="file" accept={accept} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-cyber-900 px-4 py-3">
                <span className="text-sm text-slate-200 truncate">
                  {file.name} <span className="text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </span>
                <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-red-400 transition-colors shrink-0">
                  Quitar
                </button>
              </div>
            )}

            {/* Contraseña */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'encrypt' ? 'Elige una contraseña fuerte' : 'Introduce la contraseña del archivo'}
                className={inputBase}
                autoComplete="new-password"
              />
            </div>

            <button
              type="button"
              onClick={run}
              disabled={!file || !password || busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-5 py-3 hover:bg-cyber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'encrypt' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              {busy ? 'Procesando…' : mode === 'encrypt' ? 'Cifrar y descargar' : 'Descifrar y descargar'}
            </button>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* Resultado */}
            {result && (
              <div className="flex flex-col gap-3 rounded-xl border border-cyber-400/40 bg-cyber-900 p-4">
                <p className="text-sm text-cyber-300 font-semibold inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {result.mode === 'encrypt' ? 'Archivo cifrado y descargado' : 'Archivo descifrado y descargado'}: <span className="text-slate-300 font-normal truncate">{result.name}</span>
                </p>
                {result.originalSha && (
                  <ChecksumRow label="SHA-256 del archivo original" value={result.originalSha} copied={copied === 'orig'} onCopy={() => copy('orig', result.originalSha!)} />
                )}
                {result.encryptedSha && (
                  <ChecksumRow label="SHA-256 del archivo cifrado (.enc)" value={result.encryptedSha} copied={copied === 'enc'} onCopy={() => copy('enc', result.encryptedSha!)} />
                )}
              </div>
            )}

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-cyber-400 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-cyber-400 shrink-0 mt-0.5" />
              <span>
                <b className="text-slate-200">Privacidad real:</b> el archivo se cifra solo en tu dispositivo.
                Si olvidas la contraseña, <b className="text-slate-200">no hay forma de recuperarlo</b>: no existe copia ni puerta trasera.
              </span>
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Cifrado de archivos en el navegador</h2>
            <p className="text-slate-400">
              Esta herramienta protege tus documentos con <b className="text-slate-200">AES-256-GCM</b>, un cifrado
              autenticado estándar de la industria, usando una clave derivada de tu contraseña con{' '}
              <b className="text-slate-200">Argon2id</b> (resistente a ataques por fuerza bruta). Genera un archivo{' '}
              <code className="text-cyber-400">.enc</code> que solo se puede abrir con la contraseña correcta, y te
              entrega el <b className="text-slate-200">checksum SHA-256</b> para verificar su integridad al compartirlo.
              Como todo sucede en tu navegador, es tan privado como dice ser.
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

const ChecksumRow: React.FC<{ label: string; value: string; copied: boolean; onCopy: () => void }> = ({ label, value, copied, onCopy }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyber-400 transition-colors shrink-0">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
    <code className="text-xs text-cyber-400 break-all font-mono">{value}</code>
  </div>
);
