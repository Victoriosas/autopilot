export type PublicDocument = 'home' | 'editorial' | 'privacy' | 'services' | 'consultation' | 'victoria' | 'starting' | 'fallback';
export function routeHtml(html: string, route: PublicDocument, preview: boolean): string {
  if (route === 'victoria' || route === 'starting') {
    const title = route === 'victoria' ? 'Victoria · Victoriosas' : 'Cómo empezar · Victoriosas';
    const description = route === 'victoria' ? 'Conocé el enfoque de atención personal de Victoria en Victoriosas.' : 'Evaluación inicial remota y coordinación personal, sin reservas automáticas.';
    const canonical = 'https://victoriosas.online/' + (route === 'victoria' ? 'victoria' : 'contacto');
    html = html.replace(/<title>[^<]*<\/title>/, '<title>' + title + '</title>')
      .replace(/(<meta name="description" content=")[^"]*/, '$1' + description)
      .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + title)
      .replace(/(<meta name="twitter:title" content=")[^"]*/, '$1' + title)
      .replace(/(<link rel="canonical" href=")[^"]*/, '$1' + canonical)
      .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + canonical);
  }
  if (route === 'consultation') {
    const title = 'Consultanos · Victoriosas';
    const description = 'Hablemos de tu cuidado. Consultá con Victoriosas y elegí cómo preferís recibir una respuesta personal.';
    const canonical = 'https://victoriosas.online/consultanos';
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
      .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${title}`)
      .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${description}`)
      .replace(/(<link rel="canonical" href=")[^"]*/, `$1${canonical}`)
      .replace(/(<meta property="og:url" content=")[^"]*/, `$1${canonical}`);
  }
  if (route === 'editorial' || route === 'privacy' || route === 'services') {
    const title = route === 'services' ? 'Nuestros servicios · Victoriosas' : route === 'editorial' ? 'De mí para ti · Victoriosas' : 'Contacto y privacidad · Victoriosas';
    const description = route === 'services' ? 'Explorá los cuidados faciales, corporales y masajes de Victoriosas. Consultá por WhatsApp o email para una evaluación inicial remota.' : route === 'editorial' ? 'Un espacio pensado como una pausa. Bienestar, belleza y pequeños rituales para el cuidado cotidiano.' : 'Cómo contactar con Victoriosas por email o WhatsApp y qué tener en cuenta antes de compartir información personal.';
    const canonical = 'https://victoriosas.online/' + (route === 'services' ? 'nuestros-servicios' : route === 'editorial' ? 'de-mi-para-ti' : 'privacidad');
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
