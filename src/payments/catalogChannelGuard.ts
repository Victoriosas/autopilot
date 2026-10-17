import {hasExternalChannel} from '../storefront/salesChannel';

export async function assertCheckoutChannels(
 items: unknown,
 read: (ids: string[]) => Promise<Array<{id: string; traceability?: any}>>,
) {
 if (!Array.isArray(items) || !items.length) throw Error('CATALOG_CHANNEL_UNAVAILABLE');
 const ids = [...new Set(items.map(item => item?.productId))];
 if (ids.some(id => typeof id !== 'string' || !id)) throw Error('CATALOG_CHANNEL_UNAVAILABLE');
 let rows: Array<{id:string;traceability?:any}>;
 try { rows = await read(ids); } catch { throw Error('CATALOG_CHANNEL_UNAVAILABLE'); }
 if (!Array.isArray(rows) || ids.some(id => !rows.some(row => row.id === id))) throw Error('CATALOG_CHANNEL_UNAVAILABLE');
 if (rows.some(hasExternalChannel)) throw Error('PRODUCT_REQUIRES_EXTERNAL_ACTION');
}
