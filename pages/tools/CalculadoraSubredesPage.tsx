import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Network } from 'lucide-react';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Calculadora de subredes IPv4 / CIDR. 100% local, sin red, sin dependencias.
---------------------------------------------------------------------------- */

function parseIp(s: string): number | null {
  const parts = s.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

function maskToPrefix(mask: number | null): number | null {
  if (mask === null) return null;
  // Debe ser una máscara contigua (unos seguidos de ceros).
  const inv = (~mask >>> 0) + 1;
  if ((inv & (inv - 1)) !== 0) return null; // no es potencia de 2 → máscara inválida
  let prefix = 0;
  let m = mask >>> 0;
  for (let i = 0; i < 32; i++) if ((m >>> (31 - i)) & 1) prefix++; else break;
  // comprobar que no hay unos después del primer cero
  if (((0xffffffff << (32 - prefix)) >>> 0) !== mask) return null;
  return prefix;
}

function parseInput(raw: string): { ip: number; prefix: number } | null {
  const s = raw.trim();
  if (!s) return null;
  let ipPart: string;
  let maskPart: string | undefined;
  if (s.includes('/')) [ipPart, maskPart] = s.split('/');
  else if (/\s/.test(s)) { const p = s.split(/\s+/); ipPart = p[0]; maskPart = p[1]; }
  else { ipPart = s; maskPart = '24'; }

  const ip = parseIp(ipPart);
  if (ip === null) return null;

  let prefix: number | null;
  if (maskPart === undefined || maskPart === '') prefix = 24;
  else if (maskPart.includes('.')) prefix = maskToPrefix(parseIp(maskPart));
  else {
    if (!/^\d{1,2}$/.test(maskPart.trim())) return null;
    prefix = Number(maskPart.trim());
    if (prefix > 32) return null;
  }
  if (prefix === null) return null;
  return { ip, prefix };
}

const toDotted = (n: number) =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const toBinary = (n: number) =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
    .map((o) => o.toString(2).padStart(8, '0'))
    .join('.');

function ipClass(ip: number): string {
  const first = (ip >>> 24) & 255;
  if (first < 128) return 'A';
  if (first < 192) return 'B';
  if (first < 224) return 'C';
  if (first < 240) return 'D (multicast)';
  return 'E (reservada)';
}

function ipType(ip: number): string {
  const a = (ip >>> 24) & 255;
  const b = (ip >>> 16) & 255;
  if (a === 10) return 'Privada';
  if (a === 172 && b >= 16 && b <= 31) return 'Privada';
  if (a === 192 && b === 168) return 'Privada';
  if (a === 127) return 'Loopback';
  if (a === 169 && b === 254) return 'Link-local (APIPA)';
  if (a === 100 && b >= 64 && b <= 127) return 'CGNAT';
  if (a >= 224 && a < 240) return 'Multicast';
  if (a >= 240) return 'Reservada';
  return 'Pública';
}

interface Result {
  prefix: number;
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  first: string;
  last: string;
  usable: string;
  total: string;
  cls: string;
  type: string;
  ipBin: string;
  maskBin: string;
}

function compute(ip: number, prefix: number): Result {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = Math.pow(2, 32 - prefix);

  let first: number, last: number, usable: number;
  if (prefix >= 31) {
    first = network;
    last = broadcast;
    usable = total; // /31 → 2 (p2p, RFC 3021); /32 → 1
  } else {
    first = (network + 1) >>> 0;
    last = (broadcast - 1) >>> 0;
    usable = total - 2;
  }

  return {
    prefix,
    network: toDotted(network),
    broadcast: toDotted(broadcast),
    mask: toDotted(mask),
    wildcard: toDotted(~mask >>> 0),
    first: toDotted(first),
    last: toDotted(last),
    usable: usable.toLocaleString('es'),
    total: total.toLocaleString('es'),
    cls: ipClass(ip),
    type: ipType(ip),
    ipBin: toBinary(ip),
    maskBin: toBinary(mask),
  };
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Qué es la notación CIDR (/24, /16…)?',
    a: 'El número tras la barra indica cuántos bits de la dirección corresponden a la red. /24 significa 24 bits de red y 8 de host (256 direcciones, 254 utilizables). Cuanto mayor es el número, más pequeña es la subred.',
  },
  {
    q: '¿Por qué se restan 2 al número de hosts?',
    a: 'En una subred normal, la primera dirección es la de red y la última la de broadcast; ninguna se asigna a un equipo. Por eso los hosts utilizables son 2^(bits de host) − 2. Excepción: /31 (2 direcciones punto a punto, RFC 3021) y /32 (1 host).',
  },
  {
    q: '¿Qué es la máscara wildcard?',
    a: 'Es la inversa de la máscara de red (se intercambian 0 y 1). Se usa sobre todo en ACLs de routers (p. ej. Cisco) para indicar qué bits deben coincidir.',
  },
  {
    q: '¿Se envía mi dirección a algún sitio?',
    a: 'No. Todo el cálculo se hace en tu navegador; no se envía nada por la red.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Calculadora de Subredes / CIDR (IPv4)',
    url: 'https://m4rtins.com/herramientas/calculadora-subredes-cidr',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Calculadora de subredes IPv4: dirección de red, broadcast, rango de hosts, máscara, wildcard y binario a partir de una IP/CIDR.',
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

const EXAMPLES = ['192.168.1.0/24', '10.0.0.0/8', '172.16.5.1/20', '192.168.1.130/26'];

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex flex-col gap-1 bg-cyber-900 rounded-lg px-4 py-3">
    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
    <span className={`text-slate-100 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

export const CalculadoraSubredesPage: React.FC = () => {
  const [input, setInput] = useState('192.168.1.0/24');
  const parsed = useMemo(() => parseInput(input), [input]);
  const result = useMemo(() => (parsed ? compute(parsed.ip, parsed.prefix) : null), [parsed]);

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400 font-mono text-lg';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Calculadora de Subredes / CIDR (IPv4) Online"
        description="Calculadora de subredes IPv4 gratis: a partir de una IP/CIDR obtén dirección de red, broadcast, rango de hosts utilizables, máscara, wildcard, clase y binario. En tu navegador."
        path="/herramientas/calculadora-subredes-cidr"
        image="https://m4rtins.com/og/tool-calculadora-subredes-cidr.png"
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
              Calculadora de Subredes / CIDR
            </h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Introduce una dirección IPv4 con su prefijo (p. ej. <code className="font-mono text-cyber-400">192.168.1.0/24</code>)
              y calcula la red, el broadcast, el rango de hosts y la máscara. Todo en tu navegador.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                IP / CIDR (o IP y máscara)
              </span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="192.168.1.0/24"
                spellCheck={false}
                className={inputBase}
                aria-label="Dirección IP y prefijo"
              />
              <div className="flex flex-wrap gap-2 mt-1">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setInput(ex)}
                    className="font-mono text-xs px-2 py-1 rounded border border-slate-700 text-slate-400 hover:border-cyber-400 hover:text-cyber-400 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {!result && input.trim() && (
              <p className="text-sm text-red-400">
                Formato no válido. Usa algo como <code className="font-mono">192.168.1.0/24</code> o{' '}
                <code className="font-mono">10.0.0.5 255.0.0.0</code>.
              </p>
            )}

            {result && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Row label="Dirección de red" value={`${result.network} /${result.prefix}`} mono />
                <Row label="Broadcast" value={result.broadcast} mono />
                <Row label="Máscara de red" value={result.mask} mono />
                <Row label="Wildcard" value={result.wildcard} mono />
                <Row label="Primer host" value={result.first} mono />
                <Row label="Último host" value={result.last} mono />
                <Row label="Hosts utilizables" value={result.usable} />
                <Row label="Direcciones totales" value={result.total} />
                <Row label="Clase" value={result.cls} />
                <Row label="Tipo" value={result.type} />
                <div className="sm:col-span-2">
                  <Row label="IP en binario" value={result.ipBin} mono />
                </div>
                <div className="sm:col-span-2">
                  <Row label="Máscara en binario" value={result.maskBin} mono />
                </div>
              </div>
            )}
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Cómo funciona</h2>
            <p className="text-slate-400">
              A partir de una dirección IPv4 y su máscara (en formato CIDR o decimal), la calculadora
              aplica operaciones de bits para obtener la <b className="text-slate-200">dirección de
              red</b> (IP AND máscara), la de <b className="text-slate-200">broadcast</b>, el{' '}
              <b className="text-slate-200">rango de hosts utilizables</b> y la máscara wildcard.
              Útil para diseñar VLSM, configurar routers/firewalls o estudiar para certificaciones de
              redes.
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
