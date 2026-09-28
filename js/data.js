// Datos fijos de la app: grupos musculares y ejercicios recomendados iniciales.

export const GROUPS = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'espalda', label: 'Espalda' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'hombro', label: 'Hombro' },
  { id: 'piernas', label: 'Piernas' },
];

export const SEED_EXERCISES = {
  pecho: ['Press banca', 'Press inclinado con mancuernas', 'Aperturas', 'Fondos', 'Cruce de poleas'],
  espalda: ['Dominadas', 'Remo con barra', 'Jalón al pecho', 'Remo con mancuerna', 'Remo en polea baja'],
  biceps: ['Curl con barra', 'Curl con mancuernas', 'Curl martillo', 'Curl en banco Scott'],
  triceps: ['Press francés', 'Extensión en polea', 'Fondos en banco', 'Patada de tríceps'],
  hombro: ['Press militar', 'Elevaciones laterales', 'Elevaciones frontales', 'Pájaros (deltoides posterior)'],
  piernas: ['Sentadilla', 'Prensa', 'Peso muerto rumano', 'Extensión de cuádriceps', 'Curl femoral', 'Gemelos'],
};

export function groupLabel(id) {
  return GROUPS.find((g) => g.id === id)?.label ?? id;
}
