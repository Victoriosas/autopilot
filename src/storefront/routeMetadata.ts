export type PublicDocument = 'home' | 'editorial' | 'privacy' | 'fallback';
export function routeHtml(html: string, route: PublicDocument, preview: boolean): string {
  if (route === 'editorial' || route === 'privacy') {
    const title = route === 'editorial' ? 'De mí para ti · Victoriosas' : 'Contacto y privacidad · Victoriosas';
    const description = route === 'editorial' ? 'Un espacio pensado como una pausa. Bienestar, belleza y pequeños rituales para el cuidado cotidiano.' : 'Cómo contactar con Victoriosas por email o WhatsApp y qué tener en cuenta antes de compartir información personal.';
    const canonical = 'https://victoriosas.online/' + (route === 'editorial' ? 'de-mi-para-ti' : 'privacidad');
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
      .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${title}`)
      .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${description}`)
      .replace(/(<link rel="canonical" href=")[^"]*/, `$1${canonical}`)
      .replace(/(<meta property="og:url" content=")[^"]*/, `$1${canonical}`);
  }
  if (route === 'fallback') {
    html = html.replace(/<link rel="canonical"[^>]*>/, '')
      .replace(/<meta property="og:url"[^>]*>/, '');
  }
  if (preview || route === 'fallback') {
    html = html.replace(/(<meta name="robots" content=")[^"]*/, '$1noindex,nofollow');
  }
  return html;
}
