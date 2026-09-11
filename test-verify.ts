import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
  console.log('=== Supabase Test ===');
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('Supabase not configured');
    return;
  }
  
  const db = createClient(url, key);
  
  // Count products by category
  const { data, error } = await db
    .from('products')
    .select('category, status');
  
  if (error) {
    console.error('Query error:', error.message);
    return;
  }
  
  console.log('Total products in DB:', data?.length || 0);
  
  const published = data?.filter((p: any) => p.status === 'published') || [];
  console.log('Published products:', published.length);
  
  const byCategory: Record<string, number> = {};
  for (const p of published) {
    const cat = p.category || 'Unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  
  console.log('\n=== Products by Category (Published) ===');
  for (const [cat, count] of Object.entries(byCategory)) {
    const status = count >= 30 ? '✅' : '⚠️ NEEDS MORE';
    console.log(`  ${cat}: ${count} ${status}`);
  }
  
  const categoriesNeeding = Object.entries(byCategory)
    .filter(([_, count]) => count < 30)
    .map(([cat]) => cat);
  
  if (categoriesNeeding.length > 0) {
    console.log('\nCategories needing products:', categoriesNeeding.join(', '));
  } else {
    console.log('\n✅ All categories have 30+ products!');
  }
}

test();
