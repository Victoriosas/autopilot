import { getSourcingService } from './src/services/productSourcingService';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
  console.log('=== Running Manual Sourcing Test ===');
  console.log('This will search CJ for products in all categories...\n');
  
  const service = getSourcingService();
  const config = await service.getConfig();
  
  console.log('Config:', JSON.stringify(config, null, 2));
  console.log('\nStarting sourcing run...\n');
  
  try {
    const result = await service.runSourcing(config);
    console.log('\n=== Sourcing Result ===');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n=== Category Counts After Run ===');
    const counts = await service.getProductsCountByCategory();
    for (const c of counts) {
      const status = c.count >= 30 ? '✅' : `⚠️ Need ${c.needed} more`;
      console.log(`  ${c.category}: ${c.count} ${status}`);
    }
  } catch (err: any) {
    console.error('Sourcing error:', err.message);
  }
}

test();
