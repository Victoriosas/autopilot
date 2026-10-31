const legacy: Record<string, string> = {
  '#servicios':'/nuestros-servicios', '#nosotras':'/victoria', '#como-empezar':'/contacto', '#preguntas':'/contacto', '#contacto':'/consultanos', '#de-mi-para-ti':'/de-mi-para-ti',
};
export function publicPageLocation(pathname: string, search: string, hash: string) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' && legacy[hash]) return legacy[hash];
  if (path === '/servicios') return '/nuestros-servicios' + search + hash;
  return path + search + hash;
}
