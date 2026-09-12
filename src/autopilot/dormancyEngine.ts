export interface ProductActivityInput {
  productId: string;
  publishedAt?: string;
  views30d?: number;
  addToCart30d?: number;
  orders30d?: number;
  revenue30d?: number;
}

export interface DormancyAssessment {
  productId: string;
  score: number;
  status: 'healthy' | 'watch' | 'dormant';
  reasons: string[];
  recommendedAction: 'keep' | 'optimize_listing' | 'test_promotion' | 'consider_unpublish';
}

export function assessDormancy(input: ProductActivityInput): DormancyAssessment {
  const views = Math.max(0, Number(input.views30d || 0));
  const carts = Math.max(0, Number(input.addToCart30d || 0));
  const orders = Math.max(0, Number(input.orders30d || 0));
  const revenue = Math.max(0, Number(input.revenue30d || 0));
  const reasons: string[] = [];

  const cartRate = views > 0 ? carts / views : 0;
  const orderRate = views > 0 ? orders / views : 0;
  let score = 100;

  if (views < 20) { score -= 30; reasons.push('low_traffic'); }
  if (views >= 20 && cartRate < 0.02) { score -= 25; reasons.push('low_add_to_cart_rate'); }
  if (views >= 20 && orderRate < 0.005) { score -= 30; reasons.push('low_order_rate'); }
  if (revenue <= 0 && views >= 50) { score -= 20; reasons.push('no_revenue_despite_traffic'); }
  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return { productId: input.productId, score, status: 'healthy', reasons, recommendedAction: 'keep' };
  if (score >= 40) return { productId: input.productId, score, status: 'watch', reasons, recommendedAction: carts > 0 ? 'test_promotion' : 'optimize_listing' };
  return { productId: input.productId, score, status: 'dormant', reasons, recommendedAction: orders > 0 ? 'optimize_listing' : 'consider_unpublish' };
}
