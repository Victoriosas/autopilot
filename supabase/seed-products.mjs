import { createClient } from '@supabase/supabase-js';
import { INITIAL_PRODUCTS } from '../src/data/initialProducts.js';
import { INITIAL_SUPPLIERS } from '../src/data/initialSuppliers.js';

const supabaseUrl = 'https://jfjzpwlrhzqbcrvqxhzf.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmanpwd2xyaHpxYmNydnF4aHpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA3NjkxMywiZXhwIjoyMTA0NjUyOTEzfQ.zR9DNKGr6chnHc8gHtZ4MsY6pzUH0VsStC4IcggvQ0k';

const supabase = createClient(supabaseUrl, serviceKey);

function flattenProduct(p) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    subtitle: p.subtitle || null,
    description: p.description || null,
    original_title: p.originalTitle || null,
    category: p.category || null,
    sub_category: p.subCategory || null,
    brand: p.brand || 'Victoriosa',
    sku: p.sku || null,
    price: p.price,
    compare_at_price: p.compareAtPrice || null,
    cost_price: p.costPrice || null,
    inventory: p.inventory || 0,
    rating: p.rating || null,
    review_count: p.reviewCount || 0,
    status: p.status || 'published',
    rejection_reason: p.rejectionReason || null,
    tags: p.tags || [],
    badges: p.badges || [],
    features: p.features || [],
    specs: p.specs || {},
    images: p.images || [],
    original_images: p.originalImages || [],
    image_enhancements: p.imageEnhancements || [],
    is_image_enhanced: p.isImageEnhanced || false,
    variants: p.variants || [],
    supplier_id: p.supplierId || null,
    traceability: p.traceability || {},
    created_by: 'Victoriosa Autopilot Core v3.0',
  };
}

async function seed() {
  console.log('Seeding products...');
  
  for (const product of INITIAL_PRODUCTS) {
    const flat = flattenProduct(product);
    const { error } = await supabase.from('products').upsert(flat, { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting ${flat.title}:`, error.message);
    } else {
      console.log(`OK: ${flat.title}`);
    }
  }

  console.log('\nDone!');
}

seed().catch(console.error);
