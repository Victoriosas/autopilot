import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function reviewResearch(record) {
  const missing = [];
  if (!record || typeof record !== 'object') return { eligible: false, missing: ['INVALID_RECORD'] };
  if (record.publicationAllowed !== true) missing.push('PUBLICATION_NOT_APPROVED');
  const evidence = record.cjObservation;
  if (record.provider === 'CJdropshipping') {
    if (!evidence?.variantId) missing.push('VARIANT_NOT_VERIFIED');
    if (!Number.isFinite(evidence?.unitCost) || evidence.unitCost <= 0) missing.push('UNIT_COST_UNKNOWN');
    if (!(evidence?.inventory?.cjWarehouseCN > 0)) missing.push('CJ_WAREHOUSE_STOCK_NOT_AVAILABLE');
    if (!evidence?.freightOptions?.some(x => Number.isFinite(x.priceUSD) && x.priceUSD >= 0)) missing.push('FREIGHT_NOT_QUOTED');
  } else if (record.supplier === 'Casa Hector') {
    if (record.quoteRequest?.status !== 'RECEIVED_VERIFIED') missing.push('SUPPLIER_QUOTE_PENDING');
    if (!record.confirmedStock) missing.push('STOCK_NOT_VERIFIED');
  } else missing.push('UNKNOWN_PROVIDER');
  if (!Number.isFinite(record.allInCost) || record.allInCost <= 0) missing.push('LANDED_COST_UNKNOWN');
  if (!Number.isFinite(record.netMargin)) missing.push('NET_MARGIN_UNKNOWN');
  if (record.imageRightsVerified !== true) missing.push('IMAGE_RIGHTS_UNKNOWN');
  return {eligible: missing.length === 0, missing};
}

export function auditDirectory(directory) {
  return fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8').replace(/^\uFEFF/, ''));
      return {file: name, status: record.status ?? 'UNKNOWN', ...reviewResearch(record)};
    } catch {
      return {file: name, status: 'INVALID', eligible: false, missing: ['UNREADABLE_JSON']};
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] || 'docs/research');
  const result = auditDirectory(directory);
  process.stdout.write(JSON.stringify({generatedAt: new Date().toISOString(), records: result, approved: result.filter(x => x.eligible).length}, null, 2) + '\n');
}
