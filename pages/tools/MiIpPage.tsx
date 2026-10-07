import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Copy, Check, MapPin, Wifi, Monitor, Globe } from 'lucide-react';
import { Seo } from '../../components/Seo';

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Cómo saber cuál es mi IP?',
    a: 'Pulsa el botón "Consultar mi IP pública" y esta herramienta mostrará tu dirección IP tal y como la ve internet, tanto en IPv4 como en IPv6 si tu conexión la tiene.',
  },
  {
    q: '¿Qué diferencia hay entre IPv4 e IPv6?',
    a: 'IPv4 usa direcciones como 203.0.113.42 y se están agotando. IPv6 es el formato nuevo, más largo (por ejemplo 2001:db8::1a2b), con muchísimas más direcciones. Una misma conexión puede tener las dos a la vez.',
  },
  {
    q: '¿Mi IP es pública o privada?',
    a: 'La que muestra esta página es tu IP pública: la que usa tu router para salir a internet. Las IP privadas (192.168.x.x, 10.x.x.x) solo existen dentro de tu red local y no son visibles desde fuera.',
  },
  {
    q: '¿Pueden localizarme con mi dirección IP?',
    a: 'Solo de forma aproximada: la geolocalización por IP suele acertar la ciudad o la región y el proveedor (ISP), pero no tu dirección exacta. Corresponde al nodo de tu operador, no a tu domicilio.',
  },
];

const IP_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '¿Cuál es mi IP?',
    url: 'https://m4rtins.com/herramientas/cual-es-mi-ip',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Consulta tu dirección IP pública IPv4 e IPv6, tu proveedor (ISP) y la ubicación aproximada de tu conexión.',
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

/* Endpoints con CORS abierto y sin clave. Cada uno fuerza un protocolo:
   - api.ipify.org  → solo IPv4 (registro A)
   - api6.ipify.org → solo IPv6 (registro AAAA)
   - ipapi.co       → geolocalización de la IP con la que te conectas */
const IPV4_URL = 'https://api.ipify.org?format=json';
const IPV6_URL = 'https://api6.ipify.org?format=json';
const GEO_URL = 'https://ipapi.co/json/';

interface Geo {
  ip?: string;
  city?: string;
  region?: string;
  country_name?: string;
  country_code?: string;
  timezone?: string;
  asn?: string;
  org?: string;
  error?: boolean;
}

/** Bandera emoji a partir del código ISO de país (ES → 🇪🇸) */
function flagEmoji(cc?: string): string {
  if (!cc || cc.length !== 2) return '';
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

async function fetchIp(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.ip === 'string' ? j.ip : null;
  } catch {
    return null;
  }
}

function detectOS(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const ua = navigator.userAgent;
  const plat = nav.userAgentData?.platform;
  if (plat) {
    if (/win/i.test(plat)) return 'Windows';
    if (/mac/i.test(plat)) return 'macOS';
    if (/android/i.test(plat)) return 'Android';
    if (/linux/i.test(plat)) return 'Linux';
    if (plat.trim()) return plat;
  }
  if (/Windows NT 10/.test(ua)) return 'Windows 10 / 11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Desconocido';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Desconocido';
}

async function fetchGeo(): Promise<Geo | null> {
  try {
    const r = await fetch(GEO_URL, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as Geo;
    return j && j.error ? null : j;
  } catch {
    return null;
  }
}

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copiar"
      onClick={() => {
        if (!text) return;
        try {
          navigator.clipboard.writeText(text).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            },
            () => {}
          );
        } catch {
          /* noop */
        }
      }}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700 text-slate-300 hover:border-cyber-400 hover:text-cyber-400 transition-colors flex-none"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const IpRow: React.FC<{ label: string; value: string | null; loading: boolean; missing: string }> = ({
  label,
  value,
  loading,
  missing,
}) => (
  <div className="bg-cyber-900 rounded-xl p-4 flex items-center gap-3">
    <div className="min-w-0 flex-1">
      <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </span>
      {loading ? (
        <span className="font-mono text-slate-500 animate-pulse">Consultando…</span>
      ) : value ? (
        <span className="font-mono text-lg md:text-xl text-cyber-400 break-all select-all">
          {value}
        </span>
      ) : (
        <span className="text-sm text-slate-400">{missing}</span>
      )}
    </div>
    {value && !loading && <CopyBtn text={value} />}
  </div>
);

const Detail: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-cyber-900 rounded-lg px-4 py-3">
    <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
      {label}
    </span>
    <span className="text-slate-100 break-words">{value || '—'}</span>
  </div>
);

export const MiIpPage: React.FC = () => {
  const [ipv4, setIpv4] = useState<string | null>(null);
  const [ipv6, setIpv6] = useState<string | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Info local del navegador (no sale de la página)
  const [local] = useState(() => ({
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    os: typeof navigator !== 'undefined' ? detectOS() : '',
    browser: typeof navigator !== 'undefined' ? detectBrowser() : '',
    lang: typeof navigator !== 'undefined' ? navigator.language : '',
    tz: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return '';
      }
    })(),
    screen:
      typeof window !== 'undefined'
        ? `${window.screen.width} × ${window.screen.height}`
        : '',
  }));

  useEffect(() => {
    if (!started) return;
    let alive = true;
    setLoading(true);
    setIpv4(null);
    setIpv6(null);
    setGeo(null);

    Promise.all([fetchIp(IPV4_URL), fetchIp(IPV6_URL), fetchGeo()]).then(([v4, v6raw, g]) => {
      if (!alive) return;
      setIpv4(v4);
      // Solo aceptamos como IPv6 si de verdad lo es (contiene ":").
      setIpv6(v6raw && v6raw.includes(':') ? v6raw : null);
      setGeo(g);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [started, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const loc = geo
    ? [geo.city, geo.region, geo.country_name].filter(Boolean).join(', ')
    : '';
  const flag = flagEmoji(geo?.country_code);

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="¿Cuál es mi IP? Saber mi dirección IP pública (IPv4 e IPv6)"
        description="¿Cuál es mi IP? Descubre al instante tu dirección IP pública IPv4 e IPv6, tu proveedor (ISP) y la ubicación aproximada de tu conexión. Gratis y en tu navegador."
        path="/herramientas/cual-es-mi-ip"
        jsonLd={IP_JSONLD}
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
              ¿Cuál es mi IP?
            </h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Tu IP pública y lo que tu conexión revela. A diferencia del resto de herramientas,
              esta <b className="text-slate-300">consulta servicios externos</b> (ipify e ipapi.co) y
              solo lo hace <b className="text-slate-300">cuando tú lo pides</b>. Esta web es estática:
              la petición sale directamente de tu navegador y aquí no se almacena nada.
            </p>
          </header>

          {/* Aviso + consentimiento antes de contactar terceros */}
          {!started && (
            <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 mb-6 flex flex-col gap-4">
              <p className="text-sm text-slate-300 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-amber-400">
                Al continuar, tu <b className="text-white">dirección IP</b> se enviará a servicios de
                terceros (<b className="text-white">ipify</b> e <b className="text-white">ipapi.co</b>)
                para resolverla y ubicarla de forma aproximada. La petición sale directamente de tu
                navegador; esta web no la almacena ni la comparte con nadie más.
              </p>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="self-start inline-flex items-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-4 py-2.5 hover:brightness-110 transition-all"
              >
                <Globe className="w-4 h-4" /> Consultar mi IP pública
              </button>
            </section>
          )}

          {started && (
            <>
          {/* IPs */}
          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4 mb-6">
            <IpRow label="IPv4 pública" value={ipv4} loading={loading} missing="No detectada" />
            <IpRow
              label="IPv6 pública"
              value={ipv6}
              loading={loading}
              missing="Tu red no tiene IPv6 público (o no está enrutada)."
            />

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-cyber-400">
              Una conexión puede tener <b className="text-slate-200">las dos a la vez</b>: son
              direcciones independientes y se usa una u otra según lo que soporten ambos extremos.
              Cada una se consulta con un endpoint forzado a su protocolo.
            </p>

            <button
              type="button"
              onClick={refresh}
              className="self-start inline-flex items-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-4 py-2.5 hover:brightness-110 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </section>

          {/* Geolocalización */}
          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 mb-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <MapPin className="w-5 h-5 text-cyber-400" /> Geolocalización aproximada
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Detail label="Proveedor (ISP)" value={geo?.org} />
              <Detail
                label="Ubicación"
                value={loc ? `${flag ? flag + ' ' : ''}${loc}` : undefined}
              />
              <Detail label="Zona horaria" value={geo?.timezone} />
              <Detail label="ASN" value={geo?.asn} />
            </div>
            <p className="text-xs text-slate-500 mt-4">
              La ubicación se estima a partir de la IP; es aproximada (suele acertar la ciudad o la
              región, no la dirección) y corresponde al nodo de tu proveedor.
            </p>
          </section>
            </>
          )}

          {/* Info local */}
          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Monitor className="w-5 h-5 text-cyber-400" /> Lo que revela tu navegador
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Detail label="Sistema operativo" value={local.os} />
              <Detail label="Navegador" value={local.browser} />
              <Detail label="Idioma" value={local.lang} />
              <Detail label="Zona horaria" value={local.tz} />
              <Detail label="Resolución de pantalla" value={local.screen} />
              <Detail
                label="Conexión"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-cyber-400" />{' '}
                    {started ? (ipv6 ? 'IPv4 + IPv6' : 'Solo IPv4') : '—'}
                  </span>
                }
              />
              <div className="sm:col-span-2">
                <Detail
                  label="User-Agent"
                  value={<span className="font-mono text-sm">{local.ua}</span>}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Estos datos los expone tu propio navegador en cada web que visitas, sin necesidad de
              permisos. Se calculan aquí en local y no se envían a ningún sitio.
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">¿Qué es una dirección IP?</h2>
            <p className="text-slate-400">
              Tu dirección IP es el identificador que usa tu conexión para comunicarse en internet.
              La <b className="text-slate-200">IP pública</b> es la que ven las webs que visitas (la
              asigna tu proveedor), mientras que las IP privadas solo existen dentro de tu red local.
              Para saber cuál es tu IP no necesitas instalar nada: esta herramienta la consulta y te
              la muestra al instante, junto con tu proveedor y una ubicación aproximada.
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

          <footer className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 mt-8">
            <Globe className="w-3.5 h-3.5" /> Datos de red vía ipify e ipapi.co · el resto se calcula
            en tu navegador.
          </footer>
        </div>
      </div>
    </div>
  );
};
