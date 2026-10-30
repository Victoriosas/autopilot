import { checkLocalConsultationModel } from '../src/storefront/consultationLocalModelCheck';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--model') {
  console.error('Uso: npm run check:consultation-local-model -- --model MODELO_LOCAL_INSTALADO');
  process.exit(2);
}
const report = await checkLocalConsultationModel(args[1]);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
