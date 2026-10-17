import React from 'react';
import type { Product } from '../../types';
import { salesAction } from '../../storefront/salesChannel';

export function SalesChannelAction({product}: {product: Product}) {
  const action = salesAction(product);
  if (action.kind === 'checkout') return null;
  return <div className="mt-4 space-y-2">
    {action.href ? <a href={action.href} target="_blank"
      rel={action.kind === 'affiliate' ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7b594c] px-4 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b594c]">
      {action.label}<span className="sr-only"> (abre en otra pestaña)</span>
    </a> : <span className="text-sm font-semibold">{action.label}</span>}
    <p className="text-xs leading-5 opacity-80">{action.disclosure}</p>
  </div>;
}
