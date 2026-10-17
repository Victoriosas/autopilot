// Offline commercial approval worksheet. No network, customers, or publication.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {normalizeBeautyService} from '../src/storefront/beautyManagement.ts';
const definitions=[['facial','facial','Faciales','Cuidado facial cosmético'],['massage','massage','Bienestar','Masaje de relajación'],['ritual','ritual','Rituales','Ritual rostro y cuerpo'],['consultation','consultation','Orientación','Consulta estética personalizada']];
const services=definitions.map(([id,requestService,category,title])=>normalizeBeautyService({id,requestService,category,title,description:'Propuesta para revisión de Sofía; no publicada.',durationMinutes:60,proposedPriceUyu:null,priceApproved:false,conditions:'Pendiente de confirmar modalidad, insumos, traslado y precio total.',availability:'Pendiente de coordinar agenda y cobertura con Sofía.',available:false,publicationStatus:'draft'}));
const output=path.resolve('.audit/beauty-commercial-review');await mkdir(output,{recursive:true});
await writeFile(path.join(output,'services-pending.json'),JSON.stringify({mode:'offline-review-only',durationIsPlaceholder:true,approved:false,services,questions:['Confirmar nombre, alcance y duración de cada servicio','Definir tarifas y traslado por zona; no se fijaron precios','Confirmar cobertura, preparación del domicilio y cancelaciones','Aprobar consentimiento escrito, custodia, privacidad y retiro','Verificar identidad y acceso profesional antes del lanzamiento']},null,2));
console.log(JSON.stringify({output,services:services.length,approved:false,published:false,networkUsed:false}));
