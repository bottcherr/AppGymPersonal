// Generador de "Rutina para hoy". No usa IA: son reglas sobre tu historial, así funciona sin internet.
//
// 1. Qué entrenar: el bloque (Push / Pull / Piernas) que hace más tiempo que no entrenás.
// 2. Cuántos: los que entran en el tiempo elegido, según las series y el descanso.
// 3. Cobertura: cada grupo cubre sus zonas en orden de importancia (ej. espalda: amplitud, después densidad).
// 4. Qué ejercicio en cada zona: el que más hacés o tenés en tus rutinas. No hay azar,
//    salvo al tocar "Otra opción", que cambia el ejercicio de cada zona pero mantiene la cobertura.
// 5. Peso sugerido: se calcula desde tu mejor serie de la última vez.

import * as store from './store.js';
import { MUSCLES, muscleOf, muscleLabel as muscleLabelOf, isCompound } from './data.js';

// workSecs: lo que lleva hacer una serie (sin contar el descanso).
export const INTENSITIES = {
  light: { label: 'Ligera', restSeconds: 60, mainSets: 3, mainReps: 12, sets: 3, reps: 12, workSecs: 70, load: 0.9 },
  heavy: { label: 'Pesada', restSeconds: 150, mainSets: 4, mainReps: 6, sets: 3, reps: 8, workSecs: 40, load: 1 },
};

export const DURATIONS = {
  short: { label: 'Corta', minutes: 40, hint: '40 min' },
  medium: { label: 'Media', minutes: 60, hint: '1 h' },
  long: { label: 'Completa', minutes: 75, hint: '1:15 h' },
};

const WARMUP_MIN = 5;
const MAX_EXERCISES = 10;
const DAY = 86400000;

// Bloques clásicos. El primer grupo es el principal (lleva más ejercicios).
const TEMPLATES = [
  { groups: ['pecho', 'hombro', 'triceps'] },
  { groups: ['espalda', 'biceps'] },
  { groups: ['piernas'] },
];

// Orden cuando elegís los grupos a mano (los grupos propios van al final).
const BIG_FIRST = ['piernas', 'pecho', 'espalda', 'hombro', 'triceps', 'biceps'];

// Para ubicar los grupos propios en un bloque según su nombre.
const KEYWORDS = [
  { template: 0, words: ['pecho', 'pector', 'hombro', 'delto', 'tricep'] },
  { template: 1, words: ['espalda', 'dorsal', 'lumbar', 'trapecio', 'bicep', 'antebrazo'] },
  { template: 2, words: ['pierna', 'cuadri', 'isquio', 'femoral', 'glut', 'gemel', 'pantorr', 'aductor'] },
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function joinLabels(labels) {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

/** Bloques disponibles, con los grupos propios agregados donde corresponden. */
function templates() {
  const list = TEMPLATES.map((t) => ({ groups: [...t.groups] }));
  for (const g of store.groups().filter((g) => g.custom)) {
    const name = normalize(g.label);
    const match = KEYWORDS.find((k) => k.words.some((w) => name.includes(w)));
    if (match) list[match.template].groups.push(g.id);
    else list.push({ groups: [g.id] });
  }
  // Solo grupos que tienen ejercicios.
  return list
    .map((t) => ({ groups: t.groups.filter((g) => store.exercisesByGroup(g).length) }))
    .filter((t) => t.groups.length);
}

/** Cuándo se entrenó cada grupo por última vez y cuántas veces se hizo cada ejercicio. */
function analyzeHistory() {
  const lastByGroup = new Map();
  const sessionsByExercise = new Map();
  for (const w of store.workouts()) {
    const seen = new Set();
    for (const s of w.sets) {
      const ex = store.exercise(s.exerciseId);
      if (ex) lastByGroup.set(ex.group, Math.max(lastByGroup.get(ex.group) ?? 0, w.startedAt));
      if (!seen.has(s.exerciseId)) {
        seen.add(s.exerciseId);
        sessionsByExercise.set(s.exerciseId, (sessionsByExercise.get(s.exerciseId) ?? 0) + 1);
      }
    }
  }
  const inRoutines = new Map();
  for (const r of store.routines()) {
    for (const it of r.items) inRoutines.set(it.exerciseId, (inRoutines.get(it.exerciseId) ?? 0) + 1);
  }
  return { lastByGroup, sessionsByExercise, inRoutines };
}

/** Elige el bloque que hace más tiempo que no se entrena. */
function pickTemplate(history) {
  const now = Date.now();
  let best = null;
  for (const t of templates()) {
    const last = Math.max(0, ...t.groups.map((g) => history.lastByGroup.get(g) ?? 0));
    const daysAgo = last ? (now - last) / DAY : Infinity;
    if (!best || daysAgo > best.daysAgo) best = { ...t, daysAgo };
  }
  return best;
}

/**
 * Reparte los ejercicios entre los grupos por "rondas": primero la zona más importante de cada grupo
 * (empezando por el principal), después la segunda zona de cada uno, y así.
 * Ej. Push con 5: pecho, hombro, tríceps, pecho, hombro → pecho 2, hombro 2, tríceps 1.
 */
function allocate(groups, count) {
  const capacity = groups.map((g) => store.exercisesByGroup(g).length);
  const alloc = groups.map(() => 0);
  let assigned = 0;
  while (assigned < count) {
    let progressed = false;
    for (let i = 0; i < groups.length && assigned < count; i++) {
      if (alloc[i] < capacity[i]) {
        alloc[i]++;
        assigned++;
        progressed = true;
      }
    }
    if (!progressed) break; // no hay más ejercicios
  }
  return alloc;
}

/**
 * Elige `n` ejercicios de un grupo cubriendo sus zonas en orden de importancia.
 * En cada zona gana el de mayor puntaje; si hay que repetir zona, se empieza otra vuelta.
 */
function pickForGroup(group, n, scoreOf) {
  const buckets = new Map();
  for (const ex of store.exercisesByGroup(group)) {
    const zone = muscleOf(ex) ?? '_otras';
    if (!buckets.has(zone)) buckets.set(zone, []);
    buckets.get(zone).push({ ex, score: scoreOf(ex) });
  }
  for (const list of buckets.values()) list.sort((a, b) => b.score - a.score);
  const zones = MUSCLES[group] ?? [];
  const order = [...zones.map((m) => m.id), '_otras'].filter((z) => buckets.has(z));
  const max = (zone) => zones.find((m) => m.id === zone)?.max ?? Infinity;
  const minor = (zone) => max(zone) !== Infinity; // zonas chicas: entran desde la segunda vuelta

  const chosen = [];
  const perZone = new Map();
  for (let round = 0; chosen.length < n; round++) {
    let progressed = false;
    const roundOrder = round === 0 ? order.filter((z) => !minor(z)) : [...order.filter((z) => !minor(z)), ...order.filter(minor)];
    for (const zone of roundOrder) {
      const list = buckets.get(zone);
      const count = perZone.get(zone) ?? 0;
      if (list.length && count < max(zone) && chosen.length < n) {
        chosen.push(list.shift());
        perZone.set(zone, count + 1);
        progressed = true;
      }
    }
    if (!progressed && round > 0) break;
  }
  return chosen;
}

/**
 * Series por ejercicio: { main (el primero), rest (los demás) }.
 * `chosen` = elegido por el usuario (2, 3 o 4). Sugerido: en rutinas cortas 2 series, así entran más ejercicios;
 * si no, lo de la intensidad (pesada: 4 en el primero y 3 en el resto).
 */
function setsPlan(intensityKey, durationKey, chosen) {
  const intensity = INTENSITIES[intensityKey];
  if (chosen) return { main: chosen, rest: chosen };
  if (durationKey === 'short') return { main: intensityKey === 'heavy' ? 3 : 2, rest: 2 };
  return { main: intensity.mainSets, rest: intensity.sets };
}

/** Texto del sugerido para la pantalla, ej. "2" o "3 (4 el primero)". */
export function suggestedSetsLabel(intensityKey, durationKey) {
  const { main, rest } = setsPlan(intensityKey, durationKey, null);
  return main === rest ? `${rest}` : `${rest} (${main} el primero)`;
}

/** Cuántos ejercicios entran en el tiempo elegido. */
function exerciseCount(sets, duration, secsPerSet) {
  const budget = (duration.minutes - WARMUP_MIN) * 60;
  let used = sets.main * secsPerSet;
  let count = 1;
  while (count < MAX_EXERCISES && used + sets.rest * secsPerSet <= budget) {
    used += sets.rest * secsPerSet;
    count++;
  }
  return count;
}

/** Peso sugerido para `reps` repeticiones, desde la mejor serie de la última vez (fórmula de Epley). */
function suggestWeight(exerciseId, reps, load) {
  const last = store.lastPerformance(exerciseId);
  const weighted = (last ?? []).filter((s) => s.weight > 0);
  if (!weighted.length) return null;
  const oneRepMax = Math.max(...weighted.map((s) => s.weight * (1 + s.reps / 30)));
  const raw = (oneRepMax / (1 + reps / 30)) * load;
  const step = raw >= 20 ? 2.5 : 1;
  return Math.max(step, Math.round(raw / step) * step);
}

/**
 * Arma la rutina.
 * options: { intensity: 'light'|'heavy', duration: 'short'|'medium'|'long', focus: [groupId] (vacío = automático),
 *            rest: segundos de descanso, o null = el sugerido por la intensidad,
 *            sets: series por ejercicio (2, 3 o 4), o null = sugerido,
 *            variety: 0 = siempre la misma rutina; > 0 = cambia el ejercicio de cada zona ("Otra opción") }
 */
export function generatePlan({
  intensity: intensityKey,
  duration: durationKey,
  focus = [],
  rest = null,
  sets: chosenSets = null,
  variety = 0,
}) {
  const intensity = INTENSITIES[intensityKey];
  const duration = DURATIONS[durationKey];
  const setsCount = setsPlan(intensityKey, durationKey, chosenSets);
  const restSeconds = rest ?? intensity.restSeconds;
  const secsPerSet = intensity.workSecs + restSeconds;
  const history = analyzeHistory();
  const hasHistory = store.workouts().length > 0;

  let groups;
  let reason;
  if (focus.length) {
    // Primero los músculos grandes: se llevan la primera ronda de ejercicios.
    const rank = (g) => {
      const i = BIG_FIRST.indexOf(g);
      return i >= 0 ? i : BIG_FIRST.length;
    };
    groups = [...focus].sort((a, b) => rank(a) - rank(b));
    reason = `Rutina de ${joinLabels(groups.map(store.groupLabel))}, como pediste.`;
  } else {
    const t = pickTemplate(history);
    groups = t.groups;
    const labels = joinLabels(groups.map(store.groupLabel));
    if (!hasHistory) {
      reason = 'Todavía no tenés entrenamientos, así que arranqué con una rutina base. Cuanto más entrenes, mejor se adapta.';
    } else if (t.daysAgo === Infinity) {
      reason = `Elegí ${labels} porque todavía no lo entrenaste.`;
    } else if (t.daysAgo >= 1) {
      const d = Math.floor(t.daysAgo);
      reason = `Elegí ${labels} porque hace ${d} ${d === 1 ? 'día' : 'días'} que no lo entrenás.`;
    } else {
      reason = `Elegí ${labels} porque es lo que hace más tiempo que no entrenás.`;
    }
  }

  // Puntaje de cada ejercicio dentro de su zona: lo que más hacés gana. Sin azar,
  // salvo con `variety` ("Otra opción"), que mezcla un poco para cambiar el ejercicio de cada zona.
  const heavy = intensityKey === 'heavy';
  const scoreOf = (ex) => {
    const sessions = history.sessionsByExercise.get(ex.id) ?? 0;
    const routines = history.inRoutines.get(ex.id) ?? 0;
    return (
      sessions * 3 +
      routines * 2 +
      (ex.custom ? 1 : 0) +
      (isCompound(ex) ? (heavy ? 3 : 0.5) : 0) +
      (variety ? Math.random() * variety : 0)
    );
  };

  const alloc = allocate(groups, exerciseCount(setsCount, duration, secsPerSet));
  const picked = [];
  const coverage = [];
  groups.forEach((g, gi) => {
    const chosen = pickForGroup(g, alloc[gi], scoreOf);
    const zones = chosen.map(({ ex }) => muscleLabelOf(ex)).filter(Boolean);
    if (zones.length) coverage.push(`${store.groupLabel(g).toLowerCase()} (${joinLabels([...new Set(zones)].map((z) => z.toLowerCase()))})`);
    // En pesada, los básicos primero.
    if (heavy) chosen.sort((a, b) => isCompound(b.ex) - isCompound(a.ex));
    picked.push(...chosen);
  });

  const items = picked.map(({ ex }, i) => {
    const sets = i === 0 ? setsCount.main : setsCount.rest;
    const reps = i === 0 ? intensity.mainReps : intensity.reps;
    return { exerciseId: ex.id, sets, reps, weight: suggestWeight(ex.id, reps, intensity.load) };
  });

  if (coverage.length) reason += ` Cubrí ${joinLabels(coverage)}.`;
  const used = picked.some(({ ex }) => (history.sessionsByExercise.get(ex.id) ?? 0) + (history.inRoutines.get(ex.id) ?? 0) > 0);
  if (used) reason += ' En cada zona elegí el ejercicio que más hacés.';
  if (items.some((it) => it.weight != null)) reason += ' Los pesos sugeridos salen de tu última vez.';

  const totalSets = items.reduce((sum, it) => sum + it.sets, 0);
  return {
    name: joinLabels(groups.map(store.groupLabel)),
    reason,
    intensity: intensityKey,
    duration: durationKey,
    groups,
    restSeconds,
    secsPerSet, // para recalcular el tiempo si se agregan o quitan ejercicios
    setsRest: setsCount.rest,
    minutes: Math.round(WARMUP_MIN + (totalSets * secsPerSet) / 60),
    items,
  };
}

// ---------- Ajustar la rutina generada a mano ----------

/** Ítem nuevo para agregar a la rutina generada, con las series, reps y peso sugerido de la intensidad. */
export function planItem(plan, exerciseId) {
  const intensity = INTENSITIES[plan.intensity];
  return {
    exerciseId,
    sets: plan.setsRest,
    reps: intensity.reps,
    weight: suggestWeight(exerciseId, intensity.reps, intensity.load),
  };
}

/** Recalcula el tiempo estimado después de agregar o quitar ejercicios. */
export function recalcMinutes(plan) {
  const totalSets = plan.items.reduce((sum, it) => sum + it.sets, 0);
  plan.minutes = Math.round(WARMUP_MIN + (totalSets * plan.secsPerSet) / 60);
}

/**
 * Ejercicios para agregar. Primero los que cubren zonas que todavía no están en la rutina
 * (en orden de importancia), y dentro de cada zona, los que más hacés.
 * Sin `groupId`: hasta 3 por cada grupo de la rutina. Con `groupId`: todos los de ese grupo.
 */
export function additionCandidates(plan, groupId = null) {
  const history = analyzeHistory();
  const inPlan = new Set(plan.items.map((it) => it.exerciseId));
  const groups = groupId ? [groupId] : plan.groups;
  const result = [];
  for (const g of groups) {
    const zones = (MUSCLES[g] ?? []).map((m) => m.id);
    const covered = new Map();
    for (const it of plan.items) {
      const ex = store.exercise(it.exerciseId);
      if (ex?.group === g) covered.set(muscleOf(ex), (covered.get(muscleOf(ex)) ?? 0) + 1);
    }
    const zoneRank = (ex) => {
      const i = zones.indexOf(muscleOf(ex));
      return i >= 0 ? i : zones.length;
    };
    // Zonas chicas (trapecio, lumbar...) cuentan como "ya cubiertas una vez": van después de las principales.
    const isMinor = (ex) => (MUSCLES[g] ?? []).some((m) => m.id === muscleOf(ex) && m.max);
    const need = (ex) => (covered.get(muscleOf(ex)) ?? 0) + (isMinor(ex) ? 1 : 0);
    const uses = (ex) => (history.sessionsByExercise.get(ex.id) ?? 0) * 3 + (history.inRoutines.get(ex.id) ?? 0) * 2;
    const list = store
      .exercisesByGroup(g)
      .filter((ex) => !inPlan.has(ex.id))
      .sort(
        (a, b) =>
          need(a) - need(b) ||
          zoneRank(a) - zoneRank(b) ||
          uses(b) - uses(a),
      );
    result.push(...(groupId ? list : list.slice(0, 3)));
  }
  return result;
}
