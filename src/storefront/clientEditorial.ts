import type { EditorialArticle } from './editorial';

const checkedAt = '2026-10-29';
const aadWash = { title: 'AAD · Face washing 101', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101', checkedAt };
const aadMoisture = { title: 'AAD · How to pick the right moisturizer for your skin', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer', checkedAt };
const aadAcne = { title: 'AAD · Acne: Tips for managing', url: 'https://www.aad.org/public/diseases/acne/skin-care/tips/', checkedAt };
const aadPeel = { title: 'AAD · Chemical peels: Overview', url: 'https://www.aad.org/public/cosmetic/younger-looking/chemical-peels-overview', checkedAt };
const massage = { title: 'NCCIH · Massage Therapy: What You Need To Know', url: 'https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know', checkedAt };
const lymph = { title: 'NHS · Lymphoedema: Treatment', url: 'https://www.nhs.uk/conditions/lymphoedema/treatment/', checkedAt };

type DraftInput = Pick<EditorialArticle, 'slug' | 'title' | 'category' | 'paragraphs' | 'sections' | 'sources' | 'relatedSlugs' | 'serviceNames'>;
const draft = (item: DraftInput): EditorialArticle => ({
  ...item, date: null, status: 'draft', image: '/brand/editorial-pausa.svg',
  imageAlt: 'Ilustración abstracta de bienestar; no representa un tratamiento ni sus resultados',
});

// Propuestas editoriales: no atribuir revisión profesional ni fecha de publicación.
export const clientEditorial: readonly EditorialArticle[] = [
  draft({
    slug: 'limpieza-de-cutis-como-empezar', title: 'Limpieza de cutis: qué es y cómo empezar', category: 'Belleza',
    paragraphs: ['Si es tu primera limpieza de cutis, no necesitás llegar con el nombre de una técnica decidido. Podés empezar contando qué te gustaría cuidar y qué dudas tenés. En Victoriosas, el primer paso es una evaluación inicial remota con Victoria.'],
    sections: [
      { title: '¿Es lo mismo que limpieza facial?', paragraphs: ['En esta guía usamos limpieza de cutis como una forma cotidiana de hablar de limpieza facial. El nombre no define por sí solo los pasos de una sesión: conviene distinguir la higiene superficial de una propuesta que pueda incluir otras técnicas.'] },
      { title: '¿Qué diferencia hay con la limpieza en casa?', paragraphs: ['La higiene cotidiana forma parte del cuidado habitual. Una consulta profesional agrega la conversación sobre tus necesidades y la selección de una propuesta individual. No reemplaza la rutina diaria ni significa que todas las pieles necesiten exfoliación o extracción.'] },
      { title: '¿Siempre incluye extracciones? ¿Tiene que doler?', paragraphs: ['No. La ficha de limpieza profunda contempla extracciones únicamente cuando correspondan. Antes de coordinar, preguntá qué se propone, qué sensaciones podrían aparecer y cómo se adapta a tu tolerancia. No se promete una sesión indolora; tampoco se debe tomar el dolor como prueba de eficacia.'] },
      { title: '¿Cada cuánto se hace y qué pasa después?', paragraphs: ['No hay un calendario único publicado para todas las personas. La frecuencia y los cuidados posteriores se conversan para la propuesta concreta. Antes de aceptar, pedí que te expliquen qué hacer después, qué cambios observar y cómo consultar si aparece una molestia.'] },
      { title: 'Tu primera consulta', paragraphs: ['Podés escribir: “Me interesa una limpieza facial, es mi primera vez y quisiera saber cómo empezar”. No envíes fotografías ni historia clínica en el formulario general. Si hay un problema de salud, la evaluación estética no reemplaza la consulta médica.'] },
    ], sources: [aadWash], relatedSlugs: ['higiene-facial-y-limpieza-profunda', 'preparar-primera-consulta'], serviceNames: ['Higiene y limpieza facial', 'Limpieza profunda'],
  }),
  draft({
    slug: 'higiene-facial-y-limpieza-profunda', title: 'Higiene facial y limpieza profunda: cómo distinguirlas', category: 'Belleza',
    paragraphs: ['Los nombres pueden parecer similares. En el catálogo de Victoriosas representan propuestas distintas, y conocer esa diferencia te ayuda a preguntar sin elegir un procedimiento por tu cuenta.'],
    sections: [
      { title: 'Higiene y limpieza facial', paragraphs: ['La ficha actual la describe como una higiene orientada a retirar residuos superficiales y seleccionar cosméticos apropiados. Es un punto de partida para conversar sobre limpieza y confort.'] },
      { title: 'Limpieza profunda', paragraphs: ['La propuesta del catálogo contempla valorar exfoliación y extracciones cuidadosas cuando estén indicadas. No implica que toda consulta por poros o granitos vaya a recibir esas maniobras.'] },
      { title: 'Tres preguntas antes de coordinar', paragraphs: ['Preguntá qué incluye la propuesta en tu caso, qué pasos podrían omitirse y qué cuidados requiere después. La intensidad no es un criterio suficiente para elegir. La AAD advierte que frotar la piel puede irritarla.'] },
      { title: 'Si todavía no sabés cuál elegir', paragraphs: ['Consultá por tu inquietud, sin comprometerte con una técnica. Victoria debe confirmar el alcance, las condiciones y el presupuesto antes de coordinar personalmente. No se asegura una duración o frecuencia universal.'] },
    ], sources: [aadWash], relatedSlugs: ['limpieza-de-cutis-como-empezar', 'evaluacion-inicial-remota'], serviceNames: ['Higiene y limpieza facial', 'Limpieza profunda'],
  }),
  draft({
    slug: 'hidratacion-facial-que-conversar', title: 'Hidratación facial: qué conversar antes de elegir', category: 'Belleza',
    paragraphs: ['La textura de un cosmético, la sensación que deja y tus preferencias importan al pensar un cuidado facial. Una consulta puede empezar por lo que sentís, sin que tengas que clasificar tu piel.'],
    sections: [
      { title: 'Describí tu experiencia', paragraphs: ['Contá si buscás mayor confort, si una textura te resulta pesada o si querés revisar tu rutina. Separá lo que observás de los diagnósticos que no tenés: esa información ayuda a plantear la conversación.'] },
      { title: 'No hay un producto único para todas', paragraphs: ['La AAD explica que los hidratantes tienen distintas formulaciones y que su elección depende de las características de la piel. Esta guía no prescribe ingredientes ni combina productos para un caso individual.'] },
      { title: '¿Qué incluye el servicio?', paragraphs: ['La ficha de hidratación y nutrición profunda describe higiene, cosméticos y máscara adaptados. Cualquier tecnología se confirma según compatibilidad y evaluación; no debe darse por incluida solo porque el equipo esté disponible.'] },
      { title: 'Cuándo pedir otro tipo de ayuda', paragraphs: ['Si la sequedad empeora o se vuelve dolorosa, la AAD recomienda consultar dermatología. Una propuesta cosmética no debe retrasar esa valoración. Para empezar en Victoriosas, pedí una evaluación remota y explicá tu objetivo general.'] },
    ], sources: [aadMoisture], relatedSlugs: ['piel-sensible-primera-consulta', 'ordenar-tu-rutina-cosmetica'], serviceNames: ['Hidratación y nutrición profunda'],
  }),
  draft({
    slug: 'piel-sensible-primera-consulta', title: 'Piel sensible: cómo preparar tu primera consulta', category: 'Belleza',
    paragraphs: ['Decir “mi piel es sensible” puede expresar experiencias diferentes. Antes de pensar en un procedimiento, vale la pena ordenar qué te preocupa y qué esperás del encuentro.'],
    sections: [
      { title: 'Contá lo que observás', paragraphs: ['Podés explicar con tus palabras qué productos te resultaron incómodos y si tu inquietud es reciente o habitual. No necesitás probar cosméticos nuevos para llegar a la consulta. Los detalles personales se conversan por el canal adecuado.'] },
      { title: 'Suave no significa adecuado para cualquiera', paragraphs: ['La AAD señala que incluso ingredientes de origen natural pueden causar problemas en algunas pieles. “Natural” no equivale a hipoalergénico. No elijas una técnica únicamente por ese tipo de etiqueta.'] },
      { title: 'Pedí que te expliquen la propuesta', paragraphs: ['Antes de coordinar, preguntá qué pasos se contemplan, qué podría omitirse y qué alternativa existe si no corresponde un procedimiento. La evaluación inicial remota orienta el siguiente paso; no certifica que cualquier técnica sea adecuada.'] },
      { title: 'Cuidado estético y atención médica', paragraphs: ['Si hay un problema persistente o una reacción que te preocupa, pedí valoración médica. No envíes fotografías ni información de salud sensible en el formulario general; para iniciar alcanza con una inquietud breve y tu preferencia de contacto.'] },
    ], sources: [aadMoisture], relatedSlugs: ['preparar-primera-consulta', 'hidratacion-facial-que-conversar'], serviceNames: ['Higiene y limpieza facial', 'Hidratación y nutrición profunda'],
  }),
  draft({
    slug: 'manchas-limites-cuidado-cosmetico', title: 'Manchas: qué puede orientar una consulta estética', category: 'Belleza',
    paragraphs: ['Si te preocupa una diferencia de tono, es comprensible querer saber qué opciones hay. El primer paso no es comprar una promesa de eliminación: es aclarar qué tipo de consulta corresponde.'],
    sections: [
      { title: 'Una observación no es un diagnóstico', paragraphs: ['La ficha de Victoriosas contempla cuidado cosmético de la apariencia del tono desigual. No identifica por chat la causa de una mancha ni sustituye dermatología. Una lesión nueva, cambiante o sospechosa requiere valoración dermatológica antes de buscar un tratamiento estético.'] },
      { title: 'Preguntas útiles', paragraphs: ['Preguntá cuál es el objetivo cosmético de la propuesta, qué límites tiene y cómo se revisará su evolución. No se garantiza eliminar manchas ni obtener el mismo resultado en todas las personas.'] },
      { title: 'Evitá elegir por una promesa viral', paragraphs: ['No tomes fotos de antes y después o recetas caseras como prueba de que un método sirve para vos. Este artículo no recomienda ácidos, combinaciones ni procedimientos para aplicar por tu cuenta.'] },
      { title: 'Cómo iniciar', paragraphs: ['Podés escribir “Me gustaría conversar sobre el tono desigual de mi piel”. La evaluación inicial remota permite orientar el siguiente paso y, cuando corresponda, la derivación. No envíes imágenes de lesiones mediante el formulario general.'] },
    ], sources: [], relatedSlugs: ['rutinas-y-remedios-virales', 'evaluacion-inicial-remota'], serviceNames: ['Tratamiento para manchas'],
  }),
  draft({
    slug: 'granitos-acne-como-consultar', title: 'Granitos y acné: cómo plantear tu consulta', category: 'Belleza',
    paragraphs: ['No necesitás llegar con un autodiagnóstico para pedir orientación. Podés describir tu inquietud y preguntar si corresponde un cuidado cosmético o una valoración dermatológica.'],
    sections: [
      { title: 'Qué ofrece el cuidado cosmético', paragraphs: ['La ficha actual de Victoriosas se enfoca en higiene y hábitos cosméticos para piel con tendencia al acné. No reemplaza un tratamiento dermatológico ni promete resolver todas las causas de los brotes.'] },
      { title: 'No hace falta manipular la piel antes', paragraphs: ['La AAD advierte que apretar o manipular lesiones puede retrasar su mejoría y aumentar el riesgo de marcas. No intentes extracciones en casa como preparación para una consulta.'] },
      { title: 'Qué preguntar', paragraphs: ['Preguntá cómo se decide si corresponde realizar un cuidado, qué límites tiene y qué sucede si conviene consultar dermatología primero. Informá por el canal adecuado si ya seguís indicaciones médicas; no las cambies por una propuesta estética.'] },
      { title: 'Dar el primer paso', paragraphs: ['Para iniciar, compartí un motivo breve, por ejemplo: “Quiero orientación sobre cuidado cosmético para mi piel”. No uses el formulario general para enviar historia clínica ni fotografías. La evaluación inicial remota no confirma diagnósticos.'] },
    ], sources: [aadAcne], relatedSlugs: ['limpieza-de-cutis-como-empezar', 'preparar-primera-consulta'], serviceNames: ['Acné'],
  }),
  draft({
    slug: 'peeling-evaluacion-individual', title: 'Peeling: por qué requiere una evaluación individual', category: 'Belleza',
    paragraphs: ['Peeling es un nombre amplio. Antes de elegirlo, necesitás entender qué propuesta concreta se está considerando y qué preparación y seguimiento requiere.'],
    sections: [
      { title: 'El nombre no describe todo el procedimiento', paragraphs: ['La información de la AAD distingue distintos alcances de los peelings. Esa información general no significa que Victoriosas ofrezca todas esas variantes. La ficha del sitio limita la propuesta a evaluación de un cuidado estético superficial y protocolo autorizado.'] },
      { title: 'Preguntas antes de aceptar', paragraphs: ['Consultá quién realiza el procedimiento, qué formación y habilitación corresponde, qué producto se usaría y qué cuidados se explicarían antes y después. Si esos datos no están confirmados, no debe asumirse que la técnica está disponible para tu caso.'] },
      { title: 'No es una receta para casa', paragraphs: ['Este artículo no indica concentraciones, tiempos de aplicación ni combinaciones. No reproduzcas un protocolo visto en redes. La elección no debe hacerse solo por precio, intensidad o una fotografía de resultados.'] },
      { title: 'Cómo empezar en Victoriosas', paragraphs: ['Iniciá con una evaluación remota para conversar sobre tu objetivo y determinar el siguiente paso. No se promete una recuperación inmediata, ausencia de molestias ni una técnica adecuada para todas las pieles.'] },
    ], sources: [aadPeel], relatedSlugs: ['piel-sensible-primera-consulta', 'rutinas-y-remedios-virales'], serviceNames: ['Peeling'],
  }),
  draft({
    slug: 'masaje-relax-y-descontracturante', title: 'Masaje relax y descontracturante: qué preguntar para elegir', category: 'Bienestar',
    paragraphs: ['Si buscás una pausa o sentís tensión cotidiana, podés tener dudas entre los nombres del catálogo. Empezá por el objetivo de tu consulta, sin asumir que necesitás más presión.'],
    sections: [
      { title: 'Dos objetivos en el catálogo', paragraphs: ['Victoriosas describe el masaje relax como una experiencia de pausa y descanso, y el descontracturante como una propuesta orientada a la sensación cotidiana de tensión. Esas descripciones no constituyen diagnóstico ni aseguran resolver una lesión.'] },
      { title: 'Comodidad y expectativas', paragraphs: ['Preguntá cómo se adapta la sesión a tus preferencias, cómo comunicar incomodidad y qué zonas se contemplan. Duración, intensidad, condiciones y presupuesto se confirman personalmente antes de coordinar.'] },
      { title: 'Los límites importan', paragraphs: ['El NCCIH señala que la evidencia sobre masaje para el dolor varía y puede ser limitada. No se debe presentar un masaje de bienestar como reemplazo de una atención médica necesaria.'] },
      { title: 'Tu consulta puede ser sencilla', paragraphs: ['Podés decir “Busco un momento de relajación y quisiera saber cómo empezar”. Si el motivo es un dolor persistente o una lesión, corresponde aclarar primero qué atención profesional necesitás. El recorrido de Victoriosas comienza a distancia.'] },
    ], sources: [massage], relatedSlugs: ['drenaje-linfatico-preguntas', 'evaluacion-inicial-remota'], serviceNames: ['Masaje relax', 'Masaje descontracturante'],
  }),
  draft({
    slug: 'drenaje-linfatico-preguntas', title: 'Drenaje linfático: preguntas antes de coordinar', category: 'Bienestar',
    paragraphs: ['El drenaje linfático no debe elegirse como una promesa de adelgazar o de “eliminar toxinas”. Antes de coordinar, necesitás conocer el alcance y los límites de la propuesta.'],
    sections: [
      { title: 'No confundir bienestar con tratamiento clínico', paragraphs: ['El NHS describe el drenaje manual como una técnica especializada dentro del manejo del linfedema. Eso no acredita que una propuesta estética sustituya ese tratamiento ni que Victoriosas ofrezca rehabilitación o atención posoperatoria.'] },
      { title: 'Qué confirmar con Victoria', paragraphs: ['Preguntá por la formación pertinente, el alcance del servicio y cuándo se necesita evaluación o derivación médica. La presencia del nombre en un catálogo no demuestra que sea adecuado para una persona concreta.'] },
      { title: 'Si tu motivo es una hinchazón', paragraphs: ['La ficha del servicio indica que una hinchazón nueva, inexplicada o dolorosa requiere valoración médica previa. No uses una consulta estética para posponer esa valoración ni envíes fotografías o informes en el formulario general.'] },
      { title: 'Cómo avanzar', paragraphs: ['Podés solicitar información general y comenzar por la evaluación inicial remota. La técnica, duración y posibilidad de atención deben confirmarse personalmente, sin garantías de reducción de medidas ni resultados clínicos.'] },
    ], sources: [lymph], relatedSlugs: ['masaje-relax-y-descontracturante', 'preparar-primera-consulta'], serviceNames: ['Masaje de drenaje linfático'],
  }),
  draft({
    slug: 'evaluacion-inicial-remota', title: 'Cómo comienza la atención: evaluación inicial remota', category: 'Bienestar',
    paragraphs: ['En Victoriosas, toda atención comienza con una evaluación inicial remota. No necesitás elegir una técnica antes de escribir: podés empezar con una pregunta o con lo que te gustaría cuidar.'],
    sections: [
      { title: 'Primero, tu consulta', paragraphs: ['Explorá nuestros servicios y usá Consultanos o el contacto por WhatsApp. Contá brevemente qué te interesa y cómo preferís que te contacten. No envíes historia clínica, documentos ni fotografías por el formulario general.'] },
      { title: 'Después, orientación personal', paragraphs: ['Victoria orienta el siguiente paso y confirma el alcance de la evaluación. La modalidad concreta se acuerda personalmente: no se promete videollamada, gratuidad ni respuesta inmediata. No es un diagnóstico médico.'] },
      { title: 'Antes de coordinar', paragraphs: ['Las condiciones, el presupuesto y cualquier atención posterior se confirman personalmente. Enviar una consulta no confirma un turno, una reserva ni la idoneidad de un tratamiento. No hay agenda abierta ni tarifas públicas.'] },
      { title: 'Si no corresponde un cuidado estético', paragraphs: ['El siguiente paso puede ser una derivación. No es necesario forzar la elección de un servicio. Podés volver al catálogo para informarte o consultar con calma antes de decidir.'] },
    ], sources: [], relatedSlugs: ['preparar-primera-consulta', 'limpieza-de-cutis-como-empezar'], serviceNames: [],
  }),
  draft({
    slug: 'preparar-primera-consulta', title: 'Tu primera consulta con Victoria: qué conviene tener a mano', category: 'Bienestar',
    paragraphs: ['Una buena primera consulta no empieza con saber todos los nombres del catálogo. Empieza con poder explicar qué te gustaría cuidar, qué te preocupa y qué información necesitás para decidir.'],
    sections: [
      { title: 'Elegí una pregunta principal', paragraphs: ['Por ejemplo: “Nunca me hice una limpieza de cutis”, “Quiero conocer los masajes” o “No sé qué cuidado elegir”. Son ejemplos para ayudarte a expresarte, no un cuestionario clínico.'] },
      { title: 'Prepará tus dudas', paragraphs: ['Podés preguntar qué incluye la propuesta, qué expectativas son razonables, cómo se confirma el presupuesto y qué sucede después de la evaluación remota. No necesitás aceptar un procedimiento al pedir información.'] },
      { title: 'Cuidá lo que compartís', paragraphs: ['En el formulario general, usá solo los campos necesarios y un motivo breve. No adjuntes información de salud ni fotografías. Consultá la política de privacidad y conversá por un canal apropiado si se necesita información adicional.'] },
      { title: 'Antes de cerrar la conversación', paragraphs: ['Asegurate de entender cuál es el siguiente paso, quién lo coordina y qué condiciones se confirmaron. Una consulta enviada no equivale a reserva. Si todavía tenés dudas, podés pedir una aclaración antes de decidir.'] },
    ], sources: [], relatedSlugs: ['evaluacion-inicial-remota', 'ordenar-tu-rutina-cosmetica'], serviceNames: [],
  }),
  draft({
    slug: 'rutinas-y-remedios-virales', title: 'Rutinas y remedios virales: preguntas antes de probarlos', category: 'Belleza',
    paragraphs: ['Una receta con arroz, hielo u otro ingrediente casero puede sonar simple. Una publicación llamativa no demuestra que mejore manchas o que sea adecuada para tu piel. Esta lectura propone preguntas para evaluar esas promesas.'],
    sections: [
      { title: '¿Qué se está prometiendo?', paragraphs: ['Buscá el resultado concreto, a quién se estudió y quién respalda la afirmación. Una experiencia personal o una foto con otra iluminación no permiten anticipar tu resultado. No presentamos recetas caseras como tratamientos.'] },
      { title: '¿Natural significa seguro?', paragraphs: ['No necesariamente. La AAD recuerda que el origen natural de un ingrediente no lo convierte en hipoalergénico. El consejo “sirve para todas” debería motivar preguntas, no una aplicación automática.'] },
      { title: '¿La recomendación respeta tus límites?', paragraphs: ['Desconfiá de instrucciones para tolerar molestias o reemplazar indicaciones médicas. Esta guía no propone aplicar hielo directamente, preparados caseros ni sustancias para aclarar manchas. Tampoco convierte la consulta estética en una prescripción.'] },
      { title: 'Una alternativa para decidir con calma', paragraphs: ['Guardá el enlace de la publicación y anotá tu pregunta sin reproducir el método. Podés conversar sobre tu objetivo de cuidado en una evaluación inicial remota; si la inquietud es de salud, corresponde la valoración profesional adecuada.'] },
    ], sources: [aadMoisture], relatedSlugs: ['manchas-limites-cuidado-cosmetico', 'piel-sensible-primera-consulta'], serviceNames: [],
  }),
];
