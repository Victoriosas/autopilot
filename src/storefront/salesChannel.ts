import type { Product } from '../types';

export interface CatalogOffer {
  mode: 'affiliate' | 'inquiry';
  url: string;
  merchant: string;
  approved: boolean;
}
type ChannelProduct = { traceability?: { offer?: unknown } };
export type SalesAction = {
  kind: 'checkout' | 'affiliate' | 'inquiry' | 'blocked';
  label: string;
  disclosure: string;
  href?: string;
};

// Presence is intentional: malformed metadata must never fall back to checkout.
export function hasExternalChannel(product: ChannelProduct): boolean {
  return Boolean(product.traceability && Object.hasOwn(product.traceability, 'offer'));
}

export function safeCatalogUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !host.includes('.') || host.endsWith('.') || host.endsWith('.local') ||
        host.endsWith('.localhost') || host.endsWith('.internal') ||
        /^[\d.]+$/.test(host) || host.includes(':') || host.includes('[')) return null;
    return url;
  } catch { return null; }
}

export function salesAction(product: ChannelProduct & { title?: string }): SalesAction {
  if (!hasExternalChannel(product)) return {kind:'checkout',label:'Añadir a la bolsa',disclosure:'Disponibilidad por confirmar'};
  const offer = product.traceability?.offer as Partial<CatalogOffer> | null;
  const blocked: SalesAction = {kind:'blocked',label:'Ficha en revisión',disclosure:'El enlace y las condiciones aún no están confirmados.'};
  if (!offer || offer.approved !== true || typeof offer.merchant !== 'string' || !offer.merchant.trim() || offer.merchant.length > 100) return blocked;
  const url = safeCatalogUrl(offer.url);
  if (!url) return blocked;
  if (offer.mode === 'affiliate') {
    return {kind:'affiliate',href:url.href,label:'Ver en '+offer.merchant.trim(),
      disclosure:'Compra en '+offer.merchant.trim()+'. Sus precios, envío y condiciones se confirman allí. Podemos recibir una comisión por tu compra.'};
  }
  if (offer.mode !== 'inquiry' || url.hostname !== 'wa.me' || !/^\/[1-9]\d{7,14}$/.test(url.pathname) || url.search || url.hash) return blocked;
  url.searchParams.set('text', 'Hola, quiero consultar disponibilidad, precio final y entrega de: '+String(product.title || '').slice(0,200)+'. Esta consulta no confirma una compra.');
  return {kind:'inquiry',href:url.href,label:'Consultar disponibilidad',
    disclosure:'Precio, stock y entrega por confirmar antes de aceptar el pedido. Esta consulta no reserva unidades ni inicia un cobro.'};
}

export function isCatalogVisible(product: Pick<Product, 'status' | 'price' | 'traceability'>): boolean {
  if (product.status !== 'published') return false;
  const action = salesAction(product);
  return action.kind === 'checkout' ? Number.isFinite(product.price) && product.price > 0 : action.kind !== 'blocked';
}
