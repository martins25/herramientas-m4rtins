import { KeyRound, Globe, VenetianMask, ShieldAlert, Network, FileKey, Hash, Binary, Stamp, type LucideIcon } from 'lucide-react';

export interface ToolMeta {
  /** Slug amigable para SEO; forma la URL /herramientas/<slug> */
  slug: string;
  title: string;
  description: string;
  tags: string[];
  icon: LucideIcon;
  /** 'live' → enlaza a su página; 'soon' → se muestra como "Próximamente" */
  status: 'live' | 'soon';
}

/**
 * Registro de herramientas. Para añadir una nueva:
 *  1. Crea su componente en pages/tools/<NombrePage>.tsx
 *  2. Registra su ruta en App.tsx (/herramientas/<slug>)
 *  3. Añade su entrada aquí y su URL en public/sitemap.xml
 */
export const TOOLS: ToolMeta[] = [
  {
    slug: 'marca-de-agua-dni',
    title: 'Marca de Agua para el DNI',
    description:
      'Protege la copia de tu DNI antes de darla: añádele una marca de agua con el destinatario y la finalidad (hotel, trabajo, trámites). 100% en tu navegador, la imagen no se sube.',
    tags: ['Privacidad', 'DNI', 'Identidad'],
    icon: Stamp,
    status: 'live',
  },
  {
    slug: 'generador-de-contrasenas',
    title: 'Generador de Contraseñas',
    description:
      'Genera contraseñas, frases de contraseña y semillas de wallet BIP39. Todo en tu navegador con crypto.getRandomValues, sin enviar nada por la red.',
    tags: ['Contraseñas', 'BIP39', 'Criptografía'],
    icon: KeyRound,
    status: 'live',
  },
  {
    slug: 'cual-es-mi-ip',
    title: '¿Cuál es mi IP?',
    description:
      'Muestra tu IP pública IPv4 e IPv6, la geolocalización aproximada de tu conexión y lo que tu navegador revela en cada web que visitas.',
    tags: ['Red', 'IP', 'OSINT'],
    icon: Globe,
    status: 'live',
  },
  {
    slug: 'mensajes-ocultos-en-emojis',
    title: 'Mensajes Ocultos en Emojis',
    description:
      'Cifra un mensaje con AES-256-GCM + Argon2id y ocúltalo en caracteres invisibles detrás de un emoji para enviarlo por WhatsApp o Telegram. Incluye modo señuelo.',
    tags: ['Cifrado', 'Esteganografía', 'Privacidad'],
    icon: VenetianMask,
    status: 'live',
  },
  {
    slug: 'comprobar-contrasena-filtrada',
    title: '¿Tu contraseña está filtrada?',
    description:
      'Comprueba si tu contraseña aparece en rockyou y diccionarios de filtraciones usados por atacantes. Privado: se verifica por hash en tu navegador, sin enviarla.',
    tags: ['Contraseñas', 'Seguridad', 'Privacidad'],
    icon: ShieldAlert,
    status: 'live',
  },
  {
    slug: 'calculadora-subredes-cidr',
    title: 'Calculadora de Subredes / CIDR',
    description:
      'Calcula dirección de red, broadcast, rango de hosts, máscara y wildcard de una IPv4/CIDR. Ideal para redes, routers y estudiar. 100% en tu navegador.',
    tags: ['Redes', 'IPv4', 'CIDR'],
    icon: Network,
    status: 'live',
  },
  {
    slug: 'decodificar-jwt',
    title: 'Decodificador de JWT',
    description:
      'Decodifica un JSON Web Token (cabecera, payload y caducidad) y verifica su firma HS256. 100% en tu navegador: el token y el secreto nunca se envían.',
    tags: ['JWT', 'Desarrollo', 'Seguridad'],
    icon: FileKey,
    status: 'live',
  },
  {
    slug: 'generador-de-hashes',
    title: 'Generador de Hashes',
    description:
      'Calcula MD5, SHA-1, SHA-256, SHA-384 y SHA-512 de texto o archivos, en hex o Base64. 100% en tu navegador, sin enviar nada por la red.',
    tags: ['Hash', 'Desarrollo', 'Integridad'],
    icon: Hash,
    status: 'live',
  },
  {
    slug: 'base64-url-encode-decode',
    title: 'Codificador Base64 y URL',
    description:
      'Codifica y decodifica Base64 y URL (texto y archivos) al instante en tu navegador. Sin enviar nada por la red.',
    tags: ['Base64', 'URL', 'Desarrollo'],
    icon: Binary,
    status: 'live',
  },
];
