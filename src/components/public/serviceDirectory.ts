export const serviceGroups = [
  { id: 'faciales', title: 'Faciales', services: [
    'Higiene y limpieza facial', 'Limpieza profunda', 'Tratamiento para manchas', 'Acné',
    'Rejuvenecimiento', 'Hidratación y nutrición profunda', 'Efecto lifting',
    'Peeling', 'Hidratación de labios', 'Contorno de ojos', 'Líneas de expresión'
  ] },
  { id: 'corporales', title: 'Corporales', services: [
    'Exfoliación e hidratación', 'Masaje modelador', 'Masaje de drenaje linfático',
    'Masaje descontracturante', 'Masaje relax', 'Reducción de estrías'
  ] }
] as const;

export const serviceSlug = (name: string) => name.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
