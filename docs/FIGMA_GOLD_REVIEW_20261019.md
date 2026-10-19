# Victoriosas - revision Figma dorado

Referencia del propietario: archivo E301bDHlKE5a9luebq6nCn, frame 2011:1869 (Victoriosas · Inicio). Instruccion: utilizar todos sus textos y emparejar la composicion, con preferencia por dorados. El archivo de Figma permanece intacto.

## Resultado

Home React con las ocho secciones de Figma, navegacion funcional, siete fotografias originales en sus slots, ocho SVG originales, tipografias Cormorant Garamond e Inter locales y paleta marfil/dorado. El footer usa marron oscuro en lugar de oliva. Las fotografias son evocadoras, no retratos de Victoria ni evidencia de instalaciones/clientes. No hay tarifas, disponibilidad, reservas automaticas ni formularios nuevos.

ContactLink existente reutilizado con clases/iconos opcionales. EditorialPage y sus barreras de borradores permanecen; navegacion principal lleva a la seccion de home y el enlace editorial conserva /de-mi-para-ti. Las preguntas de Figma inicialmente cerradas reciben respuestas de la informacion ya aprobada, sin condiciones nuevas.

El test historico que inmovilizaba el copy PR80 ahora comprueba la nueva seleccion del propietario; el fixture historico sigue intacto. RED 867c2c7 reproducido antes del cambio; GREEN local 189/189, TypeScript y ambos builds mediante npm run verify. Un ajuste CSS posterior de iconos FAQ y proporcion del detalle de hero se valido con build Vercel y navegador. Secret scan, diff check y check-route-html aprobados. PowerShell requirio el ajuste de PSModulePath solo en el proceso, como en el lote SEO anterior.

## Verificacion visual y funcional

- Playwright/Edge real, home a 1440, 768, 390 y 320px: sin overflow, imagenes cargadas y un solo H1. Ningun ancla interna sin destino. Links externos con noopener. FAQ abre/cierra por control nativo details/summary. No se envio WhatsApp.
- Comprobacion del texto DOM frente a 105 fragmentos extraidos de la referencia Figma: cero faltantes; se normalizo capitalizacion porque los antetitulos usan CSS uppercase.
- Axe-core 4.10.3, WCAG2A/AA/2.1AA a 1440, 768 y 390px: cero infracciones automatizadas. No equivale a auditoria WCAG completa.
- Comprobados archivos locales no vacios, posicion y geometria de las siete imagenes; desktop hero 600x648, cuidados 400x348, esencia 544x520 y ritual 544x610. Vectores conservados sin alterar sus bytes.
- Capturas locales: .audit/figma-gold-desktop.png, figma-gold-portada.png, figma-gold-390.png y figma-gold-mobile-portada.png. Sin errores JS observados; mensajes de consola solo informativos de desarrollo/lazy images.
- Procedencia, slots y fuentes en public/brand/figma-gold/README.md. Licencias SIL OFL incluidas para fuentes; derechos subyacentes de las fotos no verificados independientemente.

## Entrega y limites

Rama codex/figma-gold-home-20261019 dependiente del PR85 de SEO. Entregar como PR borrador con base en su rama para no duplicar el diff SEO. No merge, promocion, SQL, datos personales, pagos o campanas. Verificar CI y preview por SHA; no atribuir el estado de CI de PR85 a esta rama. Proximo paso: revision visual por el propietario y confirmacion de material antes de publicar; la correccion HTTP #82/PR83 permanece separada.
