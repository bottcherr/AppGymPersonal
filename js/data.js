// Datos fijos de la app: grupos musculares, sus zonas y los ejercicios recomendados.

export const GROUPS = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'espalda', label: 'Espalda' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'hombro', label: 'Hombro' },
  { id: 'piernas', label: 'Piernas' },
];

// Zonas de cada grupo, en orden de prioridad: si la rutina lleva 2 ejercicios de un grupo,
// se toman de las 2 primeras zonas. max: como mucho esa cantidad de ejercicios por rutina (zonas chicas).
export const MUSCLES = {
  pecho: [
    { id: 'medio', label: 'Medio' },
    { id: 'superior', label: 'Superior' },
    { id: 'aperturas', label: 'Aperturas' },
    { id: 'inferior', label: 'Inferior' },
  ],
  espalda: [
    { id: 'amplitud', label: 'Amplitud' },
    { id: 'densidad', label: 'Densidad' },
    { id: 'trapecio', label: 'Trapecio', max: 1 },
    { id: 'lumbar', label: 'Lumbar', max: 1 },
  ],
  biceps: [
    { id: 'general', label: 'General' },
    { id: 'braquial', label: 'Braquial' },
    { id: 'larga', label: 'Cabeza larga' },
    { id: 'corta', label: 'Cabeza corta' },
  ],
  triceps: [
    { id: 'larga', label: 'Cabeza larga' },
    { id: 'lateral', label: 'Cabeza lateral' },
    { id: 'compuesto', label: 'Compuesto' },
    { id: 'medial', label: 'Cabeza medial' },
  ],
  hombro: [
    { id: 'press', label: 'Press' },
    { id: 'lateral', label: 'Lateral' },
    { id: 'posterior', label: 'Posterior' },
    { id: 'frontal', label: 'Frontal', max: 1 },
  ],
  piernas: [
    { id: 'cuadriceps', label: 'Cuádriceps' },
    { id: 'isquios', label: 'Isquios' },
    { id: 'gluteos', label: 'Glúteos' },
    { id: 'gemelos', label: 'Gemelos', max: 1 },
  ],
};

// compound: ejercicio básico/multiarticular (en rutinas pesadas van primero).
export const SEED_EXERCISES = {
  pecho: [
    { name: 'Press banca', muscle: 'medio', compound: true },
    { name: 'Press inclinado con mancuernas', muscle: 'superior', compound: true },
    { name: 'Aperturas', muscle: 'aperturas' },
    { name: 'Fondos', muscle: 'inferior', compound: true },
    { name: 'Cruce de poleas', muscle: 'aperturas' },
    { name: 'Press inclinado con barra', muscle: 'superior', compound: true },
    { name: 'Press declinado', muscle: 'inferior', compound: true },
  ],
  espalda: [
    { name: 'Dominadas', muscle: 'amplitud', compound: true },
    { name: 'Remo con barra', muscle: 'densidad', compound: true },
    { name: 'Jalón al pecho', muscle: 'amplitud', compound: true },
    { name: 'Remo con mancuerna', muscle: 'densidad', compound: true },
    { name: 'Remo en polea baja', muscle: 'densidad' },
    { name: 'Pullover en polea', muscle: 'amplitud' },
    { name: 'Remo en T', muscle: 'densidad', compound: true },
    { name: 'Encogimientos', muscle: 'trapecio' },
    { name: 'Hiperextensiones', muscle: 'lumbar' },
  ],
  biceps: [
    { name: 'Curl con barra', muscle: 'general', compound: true },
    { name: 'Curl con mancuernas', muscle: 'general' },
    { name: 'Curl martillo', muscle: 'braquial' },
    { name: 'Curl en banco Scott', muscle: 'corta' },
    { name: 'Curl inclinado con mancuernas', muscle: 'larga' },
    { name: 'Curl concentrado', muscle: 'corta' },
    { name: 'Curl invertido', muscle: 'braquial' },
  ],
  triceps: [
    { name: 'Press francés', muscle: 'larga' },
    { name: 'Extensión en polea', muscle: 'lateral' },
    { name: 'Fondos en banco', muscle: 'compuesto', compound: true },
    { name: 'Patada de tríceps', muscle: 'lateral' },
    { name: 'Press cerrado', muscle: 'compuesto', compound: true },
    { name: 'Extensión sobre la cabeza en polea', muscle: 'larga' },
    { name: 'Extensión con agarre invertido', muscle: 'medial' },
  ],
  hombro: [
    { name: 'Press militar', muscle: 'press', compound: true },
    { name: 'Elevaciones laterales', muscle: 'lateral' },
    { name: 'Elevaciones frontales', muscle: 'frontal' },
    { name: 'Pájaros (deltoides posterior)', muscle: 'posterior' },
    { name: 'Press Arnold', muscle: 'press', compound: true },
    { name: 'Face pull', muscle: 'posterior' },
    { name: 'Elevaciones laterales en polea', muscle: 'lateral' },
  ],
  piernas: [
    { name: 'Sentadilla', muscle: 'cuadriceps', compound: true },
    { name: 'Prensa', muscle: 'cuadriceps', compound: true },
    { name: 'Peso muerto rumano', muscle: 'isquios', compound: true },
    { name: 'Extensión de cuádriceps', muscle: 'cuadriceps' },
    { name: 'Curl femoral', muscle: 'isquios' },
    { name: 'Gemelos', muscle: 'gemelos' },
    { name: 'Hip thrust', muscle: 'gluteos', compound: true },
    { name: 'Sentadilla búlgara', muscle: 'cuadriceps', compound: true },
    { name: 'Gemelos sentado', muscle: 'gemelos' },
  ],
};

// Para clasificar ejercicios propios por su nombre. Se revisan en orden: la primera regla que coincide gana.
const KEYWORD_RULES = {
  pecho: [
    ['inferior', ['declinad', 'fondo']],
    ['superior', ['inclinad']],
    ['aperturas', ['apertur', 'cruce', 'peck', 'contractor', 'fly']],
    ['medio', ['press', 'banca', 'flexion']],
  ],
  espalda: [
    ['lumbar', ['lumbar', 'hiperext', 'peso muerto', 'buenos dias']],
    ['trapecio', ['encog', 'trapecio', 'shrug']],
    ['amplitud', ['domin', 'jalon', 'pullover', 'pull over', 'pulldown', 'dorsal']],
    ['densidad', ['remo', 'row']],
  ],
  biceps: [
    ['braquial', ['martillo', 'invertid', 'braquial', 'hammer', 'zottman']],
    ['larga', ['inclinad', 'bayes', 'detras']],
    ['corta', ['scott', 'predicador', 'concentrad', 'arana', 'spider']],
    ['general', ['curl', 'barra']],
  ],
  triceps: [
    ['medial', ['invertid', 'supin']],
    ['larga', ['frances', 'cabeza', 'overhead', 'katana', 'nuca', 'copa']],
    ['compuesto', ['cerrad', 'fondo', 'dip', 'diamante']],
    ['lateral', ['polea', 'cuerda', 'patada', 'extension', 'pushdown']],
  ],
  hombro: [
    ['posterior', ['pajar', 'posterior', 'face', 'invertid', 'reverse']],
    ['lateral', ['lateral', 'menton']],
    ['frontal', ['frontal']],
    ['press', ['press', 'militar', 'arnold']],
  ],
  piernas: [
    ['gemelos', ['gemel', 'pantorr', 'calf']],
    ['gluteos', ['glut', 'hip', 'puente', 'abduc', 'cadera', 'patada']],
    ['isquios', ['rumano', 'femoral', 'isquio', 'nordic', 'peso muerto']],
    ['cuadriceps', ['sentadill', 'prensa', 'extension', 'cuadri', 'hack', 'zancad', 'estocad', 'bulgar', 'lunge', 'step']],
  ],
};

const COMPOUND_WORDS = ['press', 'remo', 'sentadill', 'domin', 'peso muerto', 'fondo', 'prensa', 'hip thrust', 'jalon'];

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function slug(text) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function seedId(group, name) {
  return `${group}-${slug(name)}`;
}

const SEED_INFO = new Map();
for (const [group, list] of Object.entries(SEED_EXERCISES)) {
  for (const e of list) SEED_INFO.set(seedId(group, e.name), e);
}

/** Zona del músculo de un ejercicio (id), o null si no se sabe. */
export function muscleOf(ex) {
  if (!ex) return null;
  const seed = SEED_INFO.get(ex.id);
  if (seed) return seed.muscle;
  const name = normalize(ex.name);
  const rule = (KEYWORD_RULES[ex.group] ?? []).find(([, words]) => words.some((w) => name.includes(w)));
  return rule ? rule[0] : null;
}

export function muscleLabel(ex) {
  const id = muscleOf(ex);
  return MUSCLES[ex?.group]?.find((m) => m.id === id)?.label ?? null;
}

/** ¿Es un ejercicio básico/multiarticular? */
export function isCompound(ex) {
  const seed = SEED_INFO.get(ex.id);
  if (seed) return !!seed.compound;
  const name = normalize(ex.name);
  return COMPOUND_WORDS.some((w) => name.includes(w));
}
