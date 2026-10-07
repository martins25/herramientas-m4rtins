import React, { useEffect } from 'react';

const SITE_URL = 'https://m4rtins.com';
const DEFAULT_IMAGE = `${SITE_URL}/recursos/CV.jpg`;

export interface SeoProps {
  /** Título de la pestaña y de los buscadores (incluye la marca). */
  title: string;
  /** Meta description (150-160 caracteres idealmente). */
  description: string;
  /** Ruta absoluta desde la raíz, p.ej. "/herramientas/cual-es-mi-ip". */
  path: string;
  image?: string;
  noindex?: boolean;
  /** Objeto(s) JSON-LD (schema.org) para datos estructurados. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function meta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function canonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Gestiona los metadatos por ruta en esta SPA: título, description, canonical,
 * Open Graph, Twitter Card y datos estructurados JSON-LD. Googlebot renderiza
 * JavaScript, por lo que recoge estos valores tras el montaje del componente.
 */
export const Seo: React.FC<SeoProps> = ({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  noindex = false,
  jsonLd,
}) => {
  // Serializamos el JSON-LD para que la dependencia del efecto sea estable por contenido.
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;

    meta('name', 'description', description);
    meta(
      'name',
      'robots',
      noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'
    );

    meta('property', 'og:site_name', 'Adrián Martín');
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:url', url);
    meta('property', 'og:image', image);
    meta('property', 'og:type', path === '/' ? 'website' : 'article');

    meta('name', 'twitter:card', 'summary_large_image');
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', description);
    meta('name', 'twitter:image', image);

    canonical(url);

    let script: HTMLScriptElement | null = null;
    if (ld) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo', 'route');
      script.textContent = ld;
      document.head.appendChild(script);
    }

    return () => {
      if (script) script.remove();
    };
  }, [title, description, path, image, noindex, ld]);

  return null;
};
