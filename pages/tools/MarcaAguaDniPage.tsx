import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Upload, Download, ShieldCheck, Trash2 } from 'lucide-react';
import { Seo } from '../../components/Seo';

/* ----------------------------------------------------------------------------
   Marca de agua para el DNI. 100% en el navegador con <canvas>:
   la imagen NUNCA se sube a ningún servidor.
---------------------------------------------------------------------------- */

const MAX_DIM = 2200; // límite para controlar memoria/tamaño del archivo

// Plantillas de finalidad: el usuario solo rellena los [CORCHETES].
const TEMPLATES: { label: string; text: string }[] = [
  { label: 'Elige una finalidad…', text: '' },
  { label: 'Hotel / Alojamiento', text: 'COPIA SOLO VÁLIDA PARA EL REGISTRO EN EL HOTEL [NOMBRE DEL HOTEL]' },
  { label: 'Proceso de selección / Trabajo', text: 'COPIA SOLO VÁLIDA PARA EL PROCESO DE SELECCIÓN DE [EMPRESA]' },
  { label: 'Trámite administrativo', text: 'COPIA SOLO VÁLIDA PARA EL TRÁMITE [DESCRIPCIÓN] EN [ADMINISTRACIÓN]' },
  { label: 'Alquiler / Inmobiliaria', text: 'COPIA SOLO VÁLIDA PARA EL CONTRATO DE ALQUILER CON [INMOBILIARIA / PROPIETARIO]' },
  { label: 'Banca / Entidad financiera', text: 'COPIA SOLO VÁLIDA PARA [ENTIDAD] — [TRÁMITE]' },
  { label: 'Genérica (rellena tú)', text: 'COPIA SOLO VÁLIDA PARA [DESTINATARIO] — [FINALIDAD]' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Se sube mi DNI a algún servidor?',
    a: 'No. La imagen se procesa íntegramente en tu navegador con la tecnología Canvas; no se envía a ningún servidor ni se guarda en ninguna parte. Puedes comprobarlo: funciona incluso sin conexión una vez cargada la página.',
  },
  {
    q: '¿Por qué debería poner una marca de agua a la copia de mi DNI?',
    a: 'Cuando entregas una copia de tu DNI (hotel, proceso de selección, alquiler, un trámite…) pierdes el control sobre lo que hacen con ella. Una marca de agua que indica el destinatario y la finalidad disuade de reutilizarla para otros fines (abrir cuentas, contratar servicios, suplantación) y deja constancia de para qué la entregaste. La propia AEPD recomienda esta práctica.',
  },
  {
    q: '¿La copia con marca de agua sigue siendo válida?',
    a: 'Sí para los casos en los que basta una fotocopia (hoteles, procesos de selección, gestiones varias). No sustituye al documento original: algunos trámites (notaría, ciertas verificaciones bancarias) exigen el DNI físico o una copia sin alterar. Es una copia protegida para tu seguridad, no un documento oficial nuevo.',
  },
  {
    q: '¿Qué debo escribir en la finalidad?',
    a: 'Indica a quién se la das y para qué, de la forma más concreta posible. Por ejemplo: «Copia solo válida para el registro en el Hotel Costa, 07/10/2026». Tienes plantillas predefinidas para no quedarte en blanco: solo rellena los corchetes.',
  },
  {
    q: '¿Se puede quitar la marca de agua?',
    a: 'La marca cubre todo el documento y es difícil de eliminar sin dejar rastro, pero ninguna marca de agua es 100% irreversible. Su valor es disuasorio y probatorio: complica el mal uso y demuestra la finalidad con la que entregaste la copia.',
  },
];

const JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Marca de agua para el DNI',
    url: 'https://m4rtins.com/herramientas/marca-de-agua-dni',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    description:
      'Añade una marca de agua con la finalidad y el destinatario a la copia de tu DNI, carnet o pasaporte. 100% en tu navegador: la imagen no se sube a ningún servidor.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

const todayEs = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Colores sugeridos para la marca de agua (oscuro para fondos claros, blanco para oscuros, etc.)
const COLORS = ['#17263a', '#ffffff', '#dc2626', '#0e7490'];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Incrusta un JPEG en un PDF de una sola página (filtro DCTDecode nativo),
// sin librerías externas. 1 px = 1 pt.
function jpegToPdf(jpeg: Uint8Array, w: number, h: number): Blob {
  const enc = (s: string) => new TextEncoder().encode(s);
  const chunks: Uint8Array[] = [];
  const xref: number[] = [];
  let offset = 0;
  const add = (u8: Uint8Array) => { chunks.push(u8); offset += u8.length; };

  add(enc('%PDF-1.3\n'));
  xref[1] = offset; add(enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  xref[2] = offset; add(enc('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  xref[3] = offset; add(enc(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`));
  xref[4] = offset;
  add(enc(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`));
  add(jpeg);
  add(enc('\nendstream\nendobj\n'));
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  xref[5] = offset; add(enc(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`));

  const xrefStart = offset;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  x += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  add(enc(x));

  return new Blob(chunks.map((c) => c.slice()) as BlobPart[], { type: 'application/pdf' });
}

type OutFormat = 'jpg' | 'png' | 'pdf';

// Parte el texto en líneas que quepan en maxW con la fuente actual del contexto.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export const MarcaAguaDniPage: React.FC = () => {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [fileName, setFileName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dateStr, setDateStr] = useState(todayEs());
  const [opacity, setOpacity] = useState(0.5);
  const [wmColor, setWmColor] = useState('#17263a');
  const [format, setFormat] = useState<OutFormat>('jpg');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadFile = useCallback(async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Por ahora solo se admiten imágenes (JPG o PNG). Si tienes un PDF, haz una captura o foto de la página.');
      return;
    }
    try {
      // imageOrientation corrige la rotación EXIF de las fotos de móvil.
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      setBitmap(bmp);
      setFileName(file.name);
      // Por defecto, el mismo formato que subió el usuario.
      setFormat(file.type === 'image/png' ? 'png' : 'jpg');
    } catch {
      setError('No se ha podido leer la imagen. Prueba con otro archivo (JPG o PNG).');
    }
  }, []);

  // (Re)dibuja la imagen + marca de agua + banda de pie cada vez que cambia algo.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const imgH = Math.round(bitmap.height * scale);

    // --- medir la banda de pie (con el ancho ya fijado) ---
    canvas.width = w;
    const pad = Math.round(w * 0.028);
    const capFont = Math.max(15, Math.round(w * 0.03));
    const brandFont = Math.max(11, Math.round(w * 0.018));
    const lineH = Math.round(capFont * 1.28);
    ctx.font = `bold ${capFont}px Arial, Helvetica, sans-serif`;
    const caption = purpose.trim() || 'Copia de uso limitado';
    const capLines = wrapText(ctx, caption, w - pad * 2);
    const stripH = pad + capLines.length * lineH + Math.round(brandFont * 2) + pad;

    // --- tamaño final (al fijar height se limpia el lienzo) ---
    canvas.height = imgH + stripH;
    ctx.drawImage(bitmap, 0, 0, w, imgH);

    // --- marca de agua en mosaico diagonal (solo sobre el documento) ---
    const wmText = `${(purpose.trim() || 'COPIA · USO LIMITADO').toUpperCase()}   ·   ${dateStr.trim()}`;
    const diag = Math.hypot(w, imgH);
    const fs = Math.max(12, Math.round(diag * 0.0155));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, imgH);
    ctx.clip();
    ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const { r, g, b } = hexToRgb(wmColor);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
    // halo fino del color opuesto (oscuro si el texto es claro, y viceversa) para legibilidad
    ctx.strokeStyle = `rgba(${lum > 0.6 ? '0,0,0' : '255,255,255'},${Math.min(0.45, opacity * 0.5)})`;
    ctx.lineWidth = Math.max(1, fs / 26);
    ctx.translate(w / 2, imgH / 2);
    ctx.rotate(-Math.PI / 6); // -30º
    const stepX = ctx.measureText(wmText).width + fs * 1.6;
    const stepY = fs * 2.5;
    let row = 0;
    for (let y = -diag; y < diag; y += stepY) {
      const offset = (row % 2) * (stepX / 2); // desfase en zigzag
      for (let x = -diag; x < diag; x += stepX) {
        ctx.strokeText(wmText, x + offset, y);
        ctx.fillText(wmText, x + offset, y);
      }
      row++;
    }
    ctx.restore();

    // --- banda de pie con la finalidad legible + marca ---
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, imgH, w, stripH);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(0, imgH, w, Math.max(2, Math.round(w * 0.004))); // filete superior
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${capFont}px Arial, Helvetica, sans-serif`;
    let ty = imgH + pad + capFont;
    for (const ln of capLines) {
      ctx.fillText(ln, pad, ty);
      ty += lineH;
    }
    ctx.fillStyle = '#64748b';
    ctx.font = `${brandFont}px Arial, Helvetica, sans-serif`;
    const brandY = imgH + stripH - pad;
    ctx.fillText('Protege tus documentos en m4rtins.com', pad, brandY);
    ctx.textAlign = 'right';
    ctx.fillText('v1.0', w - pad, brandY);
  }, [bitmap, purpose, dateStr, opacity, wmColor]);

  const saveBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DNI-protegido.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (format === 'png') {
      canvas.toBlob((b) => b && saveBlob(b, 'png'), 'image/png');
    } else if (format === 'pdf') {
      canvas.toBlob(
        async (b) => {
          if (!b) return;
          const bytes = new Uint8Array(await b.arrayBuffer());
          saveBlob(jpegToPdf(bytes, canvas.width, canvas.height), 'pdf');
        },
        'image/jpeg',
        0.92
      );
    } else {
      canvas.toBlob((b) => b && saveBlob(b, 'jpg'), 'image/jpeg', 0.92);
    }
  };

  const reset = () => {
    setBitmap(null);
    setFileName('');
    setPurpose('');
    setError('');
  };

  const inputBase =
    'w-full rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-2.5 focus:outline-none focus:border-cyber-400 text-sm';

  return (
    <div className="pt-32 pb-20 bg-cyber-900 min-h-screen">
      <Seo
        title="Marca de agua para el DNI — Protege tu copia (hotel, trabajo, trámites)"
        description="Añade una marca de agua con la finalidad y el destinatario a la copia de tu DNI antes de entregarla. 100% en tu navegador: la imagen no se sube a ningún servidor."
        path="/herramientas/marca-de-agua-dni"
        image="https://m4rtins.com/og/tool-marca-de-agua-dni.png"
        jsonLd={JSONLD}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/herramientas" className="inline-flex items-center text-cyber-400 hover:text-cyber-300 transition-colors mb-6">
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a herramientas
          </Link>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Marca de agua para el DNI</h1>
            <p className="text-slate-400 mt-3 max-w-xl">
              ¿Te piden una copia del DNI y no sabes qué harán con ella? Añádele una{' '}
              <b className="text-slate-300">marca de agua con el destinatario y la finalidad</b> para que solo
              se pueda usar para lo que tú autorizas. Todo ocurre{' '}
              <b className="text-slate-300">en tu navegador</b>: la imagen no se sube a ningún servidor.
            </p>
          </header>

          <section className="bg-cyber-800 border border-slate-700 rounded-2xl p-5 md:p-6 flex flex-col gap-5">
            {/* Paso 1: subir imagen */}
            {!bitmap ? (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors ${
                  dragOver ? 'border-cyber-400 bg-cyber-900/60' : 'border-slate-600 hover:border-cyber-400/70'
                }`}
              >
                <Upload className="w-8 h-8 text-cyber-400" />
                <span className="text-slate-200 font-semibold">Sube la foto de tu DNI</span>
                <span className="text-slate-500 text-sm text-center">Arrastra la imagen aquí o haz clic para elegir (JPG o PNG)</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
              </label>
            ) : (
              <>
                {/* Vista previa */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 truncate">{fileName}</span>
                    <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-cyber-900 flex justify-center">
                    <canvas ref={canvasRef} className="max-w-full h-auto" />
                  </div>
                </div>

                {/* Paso 2: plantilla de finalidad */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finalidad (elige una plantilla y complétala)</span>
                  <select
                    className={inputBase}
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) setPurpose(e.target.value); }}
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t.label} value={t.text}>{t.label}</option>
                    ))}
                  </select>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                    placeholder="Ej.: COPIA SOLO VÁLIDA PARA EL REGISTRO EN EL HOTEL COSTA"
                    className={`${inputBase} resize-none`}
                  />
                </div>

                {/* Fecha + opacidad */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Fecha</span>
                    <input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className={inputBase} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Intensidad: {Math.round(opacity * 100)}%</span>
                    <input
                      type="range"
                      min={0.2}
                      max={0.8}
                      step={0.05}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full accent-cyber-400 mt-2"
                    />
                  </div>
                </div>

                {/* Color de la marca de agua */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Color de la marca</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setWmColor(c)}
                        aria-label={`Color ${c}`}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          wmColor.toLowerCase() === c ? 'border-cyber-400 scale-110' : 'border-slate-600'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer ml-1">
                      <input
                        type="color"
                        value={wmColor}
                        onChange={(e) => setWmColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                      />
                      Personalizado
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyber-400 text-cyber-900 font-semibold px-5 py-3 hover:bg-cyber-300 transition-colors"
                  >
                    <Download className="w-5 h-5" /> Descargar {format.toUpperCase()}
                  </button>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutFormat)}
                    aria-label="Formato de descarga"
                    className="rounded-lg border border-slate-700 bg-cyber-900 text-slate-100 px-4 py-3 text-sm focus:outline-none focus:border-cyber-400 sm:w-44"
                  >
                    <option value="jpg">Formato: JPG</option>
                    <option value="png">Formato: PNG</option>
                    <option value="pdf">Formato: PDF</option>
                  </select>
                </div>
              </>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <p className="text-sm text-slate-400 bg-cyber-900 rounded-lg px-4 py-3 border-l-[3px] border-cyber-400 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-cyber-400 shrink-0 mt-0.5" />
              <span>
                <b className="text-slate-200">Privacidad real:</b> la imagen se procesa solo en tu dispositivo.
                No se envía, no se guarda y no pasa por ningún servidor.
              </span>
            </p>
          </section>

          {/* Contenido SEO / GEO */}
          <section className="mt-10 text-slate-300 leading-relaxed space-y-4">
            <h2 className="text-2xl font-bold text-white">Por qué proteger la copia de tu DNI</h2>
            <p className="text-slate-400">
              Entregar una fotocopia o foto del DNI sin más es uno de los descuidos más comunes y peligrosos:
              con esa imagen alguien podría intentar <b className="text-slate-200">contratar servicios, abrir cuentas
              o suplantar tu identidad</b>. Añadir una marca de agua que indique <b className="text-slate-200">a quién
              se la das y para qué</b> reduce drásticamente ese riesgo, porque la copia deja de servir para
              cualquier otro fin. Es una recomendación expresa de la Agencia Española de Protección de Datos (AEPD).
            </p>
            <p className="text-slate-400">
              Esta herramienta reparte el texto en diagonal por <b className="text-slate-200">todo el documento</b> para
              que no se pueda recortar, y funciona con cualquier documento de identidad (DNI, NIE, carnet de conducir
              o pasaporte). Como todo sucede en tu navegador, es tan privada como dice ser.
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
