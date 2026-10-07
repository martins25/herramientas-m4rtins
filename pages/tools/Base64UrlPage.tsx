import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Copy, Check, ArrowRightLeft, Upload, Download } from 'lucide-react';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Codificador/decodificador Base64 y URL. 100% local, sin red.
---------------------------------------------------------------------------- */

function b64encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64decodeBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64decodeText(s: string): string {
  return new TextDecoder().decode(b64decodeBytes(s));
}

type Tab = 'base64' | 'url';
type Dir = 'encode' | 'decode';

function convert(input: string, tab: Tab, dir: Dir): { value: string; error: string } {
  if (!input) return { value: '', error: '' };
  try {
    if (tab === 'base64') return { value: dir === 'encode' ? b64encode(input) : b64decodeText(input), error: '' };
    return { value: dir === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input), error: '' };
  } catch {
    if (dir === 'decode') return { value: '', error: tab === 'base64' ? 'El texto no es Base64 válido.' : 'La cadena URL no es válida.' };
    return { value: '', error: 'No se pudo convertir.' };
  }
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Base64 es cifrado?',
    a: 'No. Base64 es solo una codificación para representar datos binarios como texto ASCII; cualquiera puede decodificarlo. No protege la información: no lo uses para "ocultar" contraseñas ni secretos.',
  },
  {
    q: '¿Cuándo se usa Base64?',
    a: 'Para transportar binarios por medios de texto: adjuntos de email, imágenes embebidas en CSS/HTML (data URI), tokens, certificados (PEM), JSON/APIs, etc.',
  },
  {
    q: '¿Qué diferencia hay entre URL encode de todo o por componente?',
    a: 'Esta herramienta usa codificación por componente (encodeURIComponent): escapa también caracteres como & = ? / para que un valor sea seguro dentro de un parámetro de URL. Es lo habitual al construir query strings.',
  },
  {
    q: '¿Se envía mi texto a algún servidor?',
    a: 'No. Toda la conversión ocurre en tu navegador; no se envía nada por la red.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Codificador / Decodificador Base64 y URL',
    url: 'https://m4rtins.com/herramientas/base64-url-encode-decode',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description: 'Codifica y decodifica Base64 y URL (texto y archivos) en tu navegador. No se envía nada por la red.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

export const Base64UrlPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('base64');
  const [dir, setDir] = useState<Dir>('encode');
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [fileInfo, setFileInfo] = useState('');

  const { value: output, error } = useMemo(() => convert(input, tab, dir), [input, tab, dir]);

  const copy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1400); },
      () => {}
    );
  };

  const swap = () => {
    if (!output) return;
    setInput(output);
    setDir((d) => (d === 'encode' ? 'decode' : 'encode'));
    setFileInfo('');
  };

  // Archivo → Base64 (pone el resultado en el campo de entrada en modo decodificar,
  // o simplemente lo codifica mostrando el resultado abajo). Para no mezclar binario
  // con el textarea, lo codificamos y lo dejamos como entrada en modo "decodificar".
  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    buf.forEach((b) => (bin += String.fromCharCode(b)));
    setTab('base64');
    setDir('decode');
    setInput(btoa(bin));
    setFileInfo(`Base64 de: ${file.name} (${(file.size / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} KB) — abajo tienes su contenido decodificado; usa "Intercambiar" para ver el Base64.`);
  }, []);

  const downloadDecoded = () => {
    try {
      const bytes = b64decodeBytes(input);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'decodificado.bin';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* input no válido */
    }
  };

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400 font-mono text-sm resize-none break-all';

  const inLabel = tab === 'base64' ? (dir === 'encode' ? 'Texto' : 'Base64') : dir === 'encode' ? 'Texto' : 'Texto codificado (URL)';
  const outLabel = tab === 'base64' ? (dir === 'encode' ? 'Base64' : 'Texto') : dir === 'encode' ? 'Codificado (URL)' : 'Texto';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Base64 y URL: Codificar y Decodificar Online"
        description="Codifica y decodifica Base64 y URL (texto y archivos) al instante y en tu navegador. Sin registro y sin enviar nada por la red."
        path="/herramientas/base64-url-encode-decode"
        image="https://m4rtins.com/og/tool-base64-url-encode-decode.png"
        jsonLd={JSONLD}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/herramientas" className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a herramientas
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Codificador Base64 y URL</h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Codifica y decodifica <b className="text-slate-300">Base64</b> y <b className="text-slate-300">URL</b>,
              de texto o archivos, al instante. Todo en tu navegador: no se envía nada por la red.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            {/* Selección de modo */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
                {(['base64', 'url'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTab(t); setFileInfo(''); }}
                    className={`px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'}`}
                  >
                    {t === 'base64' ? 'Base64' : 'URL'}
                  </button>
                ))}
              </div>
              <div className="inline-flex border border-slate-700 rounded-lg overflow-hidden">
                {(['encode', 'decode'] as Dir[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDir(d); setFileInfo(''); }}
                    className={`px-4 py-2 text-sm font-semibold ${dir === d ? 'bg-cyber-400 text-cyber-900' : 'text-slate-300'}`}
                  >
                    {d === 'encode' ? 'Codificar' : 'Decodificar'}
                  </button>
                ))}
              </div>
            </div>

            {/* Entrada */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{inLabel}</span>
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); setFileInfo(''); }}
                rows={4}
                placeholder={dir === 'encode' ? 'Escribe o pega el texto…' : 'Pega aquí lo que quieras decodificar…'}
                className={inputBase}
                spellCheck={false}
              />
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={swap}
                disabled={!output}
                className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-cyber-400 transition-colors disabled:opacity-40"
              >
                <ArrowRightLeft className="w-4 h-4" /> Intercambiar
              </button>
            </div>

            {/* Salida */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{outLabel}</span>
                <button
                  type="button"
                  onClick={copy}
                  disabled={!output}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyber-400 transition-colors disabled:opacity-40"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <textarea value={output} readOnly rows={4} className={`${inputBase} text-cyber-400`} placeholder="Resultado…" />
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>

            {/* Archivos (solo Base64) */}
            {tab === 'base64' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700/60">
                <label className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-cyber-400 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" /> Codificar un archivo a Base64
                  <input type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                {dir === 'decode' && input && (
                  <button type="button" onClick={downloadDecoded} className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-cyber-400 transition-colors ml-auto">
                    <Download className="w-4 h-4" /> Descargar como archivo
                  </button>
                )}
              </div>
            )}
            {fileInfo && <p className="text-xs text-slate-500">{fileInfo}</p>}

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-amber-400">
              <b className="text-slate-200">Recuerda:</b> Base64 <b className="text-slate-200">no es cifrado</b>, solo codificación: cualquiera puede revertirlo. No lo uses para proteger datos sensibles.
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Base64 y URL encoding</h2>
            <p className="text-slate-400">
              <b className="text-slate-200">Base64</b> convierte datos binarios en texto ASCII para
              poder transportarlos por canales pensados para texto (email, JSON, data URIs…). La{' '}
              <b className="text-slate-200">codificación URL</b> (percent-encoding) escapa los
              caracteres que tienen un significado especial en una dirección, para incluir valores de
              forma segura en una query string. Ninguna de las dos es cifrado: son reversibles por
              cualquiera.
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
