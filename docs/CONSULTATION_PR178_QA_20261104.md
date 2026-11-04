# PR 178 · selector y correo supervisado

Base de la PR comprobada: `a4ddea9e00512cfbf52af60e68939e2be13f92d4`. Sin consultas, correo o cambios de preferencias en producción.

## Correcciones

- El límite de altura del picker estaba restringido a mouse. Se reprodujo el fallo en Chrome con touch emulado (`appearance: none`); ahora `base-select` se aplica también a touch cuando el navegador lo soporta. Continúa el select nativo accesible como fallback. Opciones, grupos, foco y selección mantienen contraste; no se agregaron dependencias.
- Se conservan orientación y los 17 tratamientos. Navegador real: árbol accesible nativo, apertura/cierre, Escape, Space/Home/flecha/Enter, foco conservado, ausencia de desbordamiento y contraste AA (4,5:1 mínimo en texto normal y seleccionado). Capturas del menú abierto a 1280 y 390 px en `output/consultation-lab/menu-*-open.png`; CI las adjunta como artefacto.
- El correo válido habilita respuesta supervisada independientemente de la preferencia guardada. WhatsApp conserva copia manual y ofrece además aprobación por Resend; llamada y email también pueden responder por correo. Sin email válido no se ofrece ni se acepta esa acción.
- La ruta histórica de acuse automático podía activarse mediante flags y escribir `approval_mode=automatic`. Se retira su llamada del intake y el helper queda inerte aun con esos flags habilitados. El envío manual registra explícitamente `approval_mode=human`. No se cambian registros históricos ni variables productivas.

## Verificación

`npm run verify`: 401/401, tipos y ambas compilaciones. PostgreSQL desechable de consultas: 12/12. Pruebas focalizadas de ruta/respuesta/retirada automática: 19/19. Prueba local de navegador desktop y touch móvil aprobada con los estilos reales.

El recorrido `test-consultation-lab-browser.ts` usa Supabase/Auth/PostgREST reales desechables y transporte Resend simulado. Prueba WhatsApp+email con copia y aprobación coexistentes, cancelación de confirmación sin envío, aprobación aceptada, llamada/email, conservación de preferencia, denegación sin Auth/origen/aprobación, duplicados y ausencia de email. Flags automáticos habilitados en el fixture deben producir cero respuestas antes de una aprobación humana. Cualquier acceso saliente del servidor fuera de loopback o Resend interceptado se rechaza. El navegador bloquea todos los orígenes externos. La CI del SHA final debe aprobar este recorrido; hasta entonces no se considera probado.

Límites: móvil emulado en Chromium, no dispositivo físico ni prueba manual con NVDA/VoiceOver. Las comprobaciones del árbol accesible no sustituyen esa revisión. En navegadores sin `base-select`, la interfaz nativa del sistema controla el menú. La prueba de correo no acredita entrega real ni Gmail. Supabase Preview/historial se corrige separadamente en PR 179; no hay migraciones nuevas en PR 178.
