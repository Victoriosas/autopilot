export type PublicDocument = 'home' | 'editorial' | 'fallback';
export function routeHtml(html: string, route: PublicDocument, preview: boolean): string {
  if (route === 'editorial') {
    const title = 'De mí para ti · Victoriosas';
    const description = 'Un espacio pensado como una pausa. Bienestar, belleza y pequeños rituales para el cuidado cotidiano.';
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
      .replace(/(<link rel="canonical" href=")[^"]*/, '$1https://victoriosas.online/de-mi-para-ti')
      .replace(/(<meta property="og:url" content=")[^"]*/, '$1https://victoriosas.online/de-mi-para-ti');
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
