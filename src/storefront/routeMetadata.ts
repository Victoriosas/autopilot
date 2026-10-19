export type PublicDocument = 'home' | 'editorial' | 'fallback';
export function routeHtml(html: string, _route: PublicDocument, _preview: boolean): string {
  return html;
}
