import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, ShieldX, KeyRound, Clock } from 'lucide-react';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Decodificador de JWT. 100% local: ni el token ni el secreto salen del navegador.
---------------------------------------------------------------------------- */

const enc = new TextEncoder();

function b64urlToBytes(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlDecodeText(str: string): string {
  return new TextDecoder().decode(b64urlToBytes(str));
}

function bytesToB64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface Decoded {
  headerJson: string;
  payloadJson: string;
  signature: string;
  alg?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  error?: string;
}

function decode(token: string): Decoded | null {
  const t = token.trim();
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return { headerJson: '', payloadJson: '', signature: '', error: 'Un JWT debe tener 3 partes separadas por puntos (cabecera.payload.firma).' };
  try {
    const headerObj = JSON.parse(b64urlDecodeText(parts[0]));
    const payloadObj = JSON.parse(b64urlDecodeText(parts[1]));
    return {
      headerJson: JSON.stringify(headerObj, null, 2),
      payloadJson: JSON.stringify(payloadObj, null, 2),
      signature: parts[2],
      alg: headerObj.alg,
      exp: typeof payloadObj.exp === 'number' ? payloadObj.exp : undefined,
      iat: typeof payloadObj.iat === 'number' ? payloadObj.iat : undefined,
      nbf: typeof payloadObj.nbf === 'number' ? payloadObj.nbf : undefined,
    };
  } catch {
    return { headerJson: '', payloadJson: '', signature: '', error: 'No se pudo decodificar: la cabecera o el payload no son Base64URL/JSON válidos.' };
  }
}

function fmtDate(sec: number): string {
  const d = new Date(sec * 1000);
  const now = Date.now();
  const diff = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  const unit =
    abs < 60 ? `${abs} s` : abs < 3600 ? `${Math.round(abs / 60)} min` : abs < 86400 ? `${Math.round(abs / 3600)} h` : `${Math.round(abs / 86400)} días`;
  const rel = diff >= 0 ? `en ${unit}` : `hace ${unit}`;
  return `${d.toLocaleString('es')} (${rel})`;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Es seguro pegar aquí mi token?',
    a: 'Sí. La decodificación y la verificación de la firma se hacen íntegramente en tu navegador; ni el token ni el secreto se envían a ningún servidor.',
  },
  {
    q: '¿Decodificar un JWT es lo mismo que descifrarlo?',
    a: 'No. La cabecera y el payload de un JWT van en Base64URL, no cifrados: cualquiera puede leerlos. La firma solo garantiza que no se han manipulado. Por eso nunca debes guardar datos sensibles en el payload.',
  },
  {
    q: '¿Qué firmas se pueden verificar?',
    a: 'La verificación integrada es para HS256 (HMAC-SHA256) introduciendo el secreto. Para RS256/ES256 haría falta la clave pública; dímelo si la necesitas.',
  },
  {
    q: '¿Qué significan exp, iat y nbf?',
    a: 'Son marcas de tiempo (en segundos): iat = emitido en, exp = expira en, nbf = no válido antes de. La herramienta te las muestra como fechas legibles y te avisa si el token ha caducado.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Decodificador de JWT',
    url: 'https://m4rtins.com/herramientas/decodificar-jwt',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Decodifica un JWT (cabecera, payload y caducidad) y verifica la firma HS256 en tu navegador. El token no se envía a ningún servidor.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkcmnDoW4gTWFydMOtbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAzNjAwfQ.sVqW8m0mQ2n0h0b3b5oQ9mE8s3gkqH4rN8K4yq1cQ0w';

type SigState = 'idle' | 'checking' | 'valid' | 'invalid' | 'unsupported';

export const JwtDecoderPage: React.FC = () => {
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [sig, setSig] = useState<SigState>('idle');

  const decoded = useMemo(() => decode(token), [token]);
  const expired = decoded?.exp !== undefined && decoded.exp * 1000 < Date.now();

  const verify = async () => {
    if (!decoded || decoded.error || !secret) return;
    if (decoded.alg !== 'HS256') {
      setSig('unsupported');
      return;
    }
    setSig('checking');
    try {
      const parts = token.trim().split('.');
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${parts[0]}.${parts[1]}`));
      setSig(bytesToB64url(mac) === parts[2] ? 'valid' : 'invalid');
    } catch {
      setSig('invalid');
    }
  };

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400 font-mono';
  const preBox =
    'overflow-x-auto rounded-xl border border-slate-700 bg-cyber-900 p-4 font-mono text-sm text-slate-200 whitespace-pre-wrap break-all';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Decodificar JWT online — ver claims y verificar firma (HS256)"
        description="Decodifica un JWT y consulta su cabecera, payload y caducidad; verifica la firma HS256. 100% en tu navegador: el token y el secreto nunca se envían."
        path="/herramientas/decodificar-jwt"
        image="https://m4rtins.com/og/tool-decodificar-jwt.png"
        jsonLd={JSONLD}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/herramientas" className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a herramientas
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Decodificador de JWT</h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              Pega un JSON Web Token para ver su <b className="text-slate-300">cabecera</b>, su{' '}
              <b className="text-slate-300">payload</b> y su caducidad, y verificar la firma HS256. Todo
              en tu navegador: <b className="text-slate-300">ni el token ni el secreto se envían</b>.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Token (JWT)</span>
                <button type="button" onClick={() => setToken(SAMPLE)} className="text-xs text-cyber-400 hover:text-cyber-300">
                  Probar con un ejemplo
                </button>
              </div>
              <textarea
                value={token}
                onChange={(e) => { setToken(e.target.value); setSig('idle'); }}
                rows={4}
                spellCheck={false}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                className={`${inputBase} resize-none break-all`}
              />
            </div>

            {decoded?.error && <p className="text-sm text-red-400">{decoded.error}</p>}

            {decoded && !decoded.error && (
              <>
                {(decoded.exp || decoded.iat || decoded.nbf) && (
                  <div className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-cyber-900 px-4 py-3">
                    {decoded.exp !== undefined && (
                      <div className={`flex items-center gap-2 text-sm ${expired ? 'text-red-300' : 'text-green-300'}`}>
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">{expired ? 'Caducado' : 'Válido'}:</span>
                        <span className="text-slate-300">expira {fmtDate(decoded.exp)}</span>
                      </div>
                    )}
                    {decoded.iat !== undefined && (
                      <div className="text-sm text-slate-400">Emitido (iat): {fmtDate(decoded.iat)}</div>
                    )}
                    {decoded.nbf !== undefined && (
                      <div className="text-sm text-slate-400">No válido antes (nbf): {fmtDate(decoded.nbf)}</div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cabecera</span>
                  <pre className={preBox}>{decoded.headerJson}</pre>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payload</span>
                  <pre className={preBox}>{decoded.payloadJson}</pre>
                </div>

                {/* Verificación de firma */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Verificar firma (HS256)
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      value={secret}
                      onChange={(e) => { setSecret(e.target.value); setSig('idle'); }}
                      placeholder="Secreto (clave HMAC)"
                      className={`${inputBase} flex-1 min-w-[180px]`}
                    />
                    <button
                      type="button"
                      onClick={verify}
                      disabled={!secret || sig === 'checking'}
                      className="inline-flex items-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-4 py-2.5 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <KeyRound className="w-4 h-4" /> Verificar
                    </button>
                  </div>
                  {sig === 'valid' && (
                    <p className="flex items-center gap-2 text-sm text-green-300 font-semibold"><ShieldCheck className="w-4 h-4" /> Firma válida</p>
                  )}
                  {sig === 'invalid' && (
                    <p className="flex items-center gap-2 text-sm text-red-300 font-semibold"><ShieldX className="w-4 h-4" /> Firma inválida (secreto incorrecto o token manipulado)</p>
                  )}
                  {sig === 'unsupported' && (
                    <p className="text-sm text-amber-300">
                      La verificación integrada es solo para HS256. Este token usa <b>{decoded.alg}</b> (requiere clave pública).
                    </p>
                  )}
                </div>
              </>
            )}

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-cyber-400">
              <b className="text-slate-200">Privacidad:</b> la cabecera y el payload de un JWT no están
              cifrados (solo Base64URL), así que cualquiera puede leerlos. Esta herramienta los
              decodifica y verifica la firma <b className="text-slate-200">en local</b>; nada se envía
              a ningún servidor.
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Qué es un JWT</h2>
            <p className="text-slate-400">
              Un <b className="text-slate-200">JSON Web Token</b> es un formato muy usado para
              autenticación y APIs. Tiene tres partes separadas por puntos: cabecera, payload y firma,
              codificadas en Base64URL. La firma (con un secreto o una clave) permite comprobar que el
              token no se ha alterado, pero <b className="text-slate-200">el contenido es legible por
              cualquiera</b>: nunca pongas datos sensibles sin cifrar en el payload.
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
