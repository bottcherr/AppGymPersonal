// Capa de datos. Todo vive en localStorage, así la app funciona sin conexión.
//
// Forma del estado guardado:
//   exercises: [{ id, name, group, custom }]
//   routines:  [{ id, name, groups: [groupId], items: [{ exerciseId, sets, reps, repsPerSet? }] }]
//              repsPerSet (opcional): reps distintas por serie, ej. [12, 10, 8]
//   workouts:  [{ id, routineId, routineName, startedAt, finishedAt,
//                 sets: [{ exerciseId, set, reps, weight }] }]
//   active:    entrenamiento en curso (o null), para no perder nada si se cierra la app.
//              active.rest = { startedAt, endsAt } mientras corre un descanso.
//   settings:  { restSeconds }
//   customGroups: [{ id, label, custom }]  grupos musculares creados por el usuario

import { GROUPS, SEED_EXERCISES, slug, seedId } from './data.js';

const KEY = 'appgym.v1';

const DEFAULT_SETTINGS = { restSeconds: 90 };

let state = normalize(load());

/** Completa campos que agregamos en versiones nuevas, para datos guardados con versiones viejas. */
function normalize(s) {
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  s.customGroups ??= [];
  addMissingSeeds(s);
  return s;
}

/** Suma los ejercicios recomendados nuevos (si no hay ya uno propio con el mismo nombre). */
function addMissingSeeds(s) {
  for (const group of GROUPS) {
    for (const { name } of SEED_EXERCISES[group.id]) {
      const id = seedId(group.id, name);
      const exists = s.exercises.some((e) => e.id === id || (e.group === group.id && slug(e.name) === slug(name)));
      if (!exists) s.exercises.push({ id, name, group: group.id, custom: false });
    }
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function initialState() {
  return { version: 1, exercises: [], routines: [], workouts: [], active: null };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('No se pudieron leer los datos guardados', err);
  }
  return initialState();
}

let saveFailed = false;

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (err) {
    console.error('No se pudieron guardar los datos', err);
    saveFailed = true;
  }
}

export function lastSaveFailed() {
  return saveFailed;
}

// ---------- Ajustes ----------

export function settings() {
  return state.settings;
}

export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  save();
}

// ---------- Backup ----------

export function exportData() {
  return { app: 'appgym', exportedAt: new Date().toISOString(), data: state };
}

/** Devuelve los datos si el objeto parece un backup válido, o null. */
export function parseBackup(obj) {
  const data = obj?.data ?? obj;
  const ok =
    data && Array.isArray(data.exercises) && Array.isArray(data.routines) && Array.isArray(data.workouts);
  return ok ? data : null;
}

/** Reemplaza todos los datos por los del backup. */
export function importData(data) {
  state = normalize(JSON.parse(JSON.stringify(data)));
  state.active ??= null;
  save();
}

// ---------- Grupos musculares ----------

/** Grupos fijos + los creados por el usuario. */
export function groups() {
  return [...GROUPS, ...state.customGroups];
}

export function groupLabel(id) {
  return groups().find((g) => g.id === id)?.label ?? id;
}

/** Crea un grupo propio (o devuelve el existente si ya hay uno con ese nombre). */
export function addGroup(label) {
  const clean = label.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = groups().find((g) => slug(g.label) === slug(clean));
  if (existing) return existing;
  const group = { id: `g-${uid()}`, label: clean, custom: true };
  state.customGroups.push(group);
  save();
  return group;
}

// ---------- Ejercicios ----------

export function exercises() {
  return state.exercises;
}

export function exercise(id) {
  return state.exercises.find((e) => e.id === id);
}

export function exercisesByGroup(group) {
  return state.exercises.filter((e) => e.group === group);
}

/** Crea un ejercicio propio (o devuelve el existente si ya hay uno con ese nombre en el grupo). */
export function addExercise(name, group) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = state.exercises.find(
    (e) => e.group === group && slug(e.name) === slug(clean),
  );
  if (existing) return existing;
  const ex = { id: uid(), name: clean, group, custom: true };
  state.exercises.push(ex);
  save();
  return ex;
}

// ---------- Rutinas ----------

export function routines() {
  return state.routines;
}

export function routine(id) {
  return state.routines.find((r) => r.id === id);
}

export function saveRoutine(r) {
  const i = state.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) state.routines[i] = r;
  else state.routines.push(r);
  save();
}

export function deleteRoutine(id) {
  state.routines = state.routines.filter((r) => r.id !== id);
  if (state.active?.routineId === id) state.active = null;
  save();
}

// ---------- Historial ----------

/** Series de la última vez que se hizo este ejercicio, o null si nunca. */
export function lastPerformance(exerciseId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const sets = state.workouts[i].sets.filter((s) => s.exerciseId === exerciseId);
    if (sets.length) return sets;
  }
  return null;
}

export function workouts() {
  return state.workouts;
}

/** Todas las sesiones de un ejercicio, de la más vieja a la más nueva: [{ workoutId, date, sets }]. */
export function exerciseHistory(exerciseId) {
  const out = [];
  for (const w of state.workouts) {
    const sets = w.sets.filter((s) => s.exerciseId === exerciseId);
    if (sets.length) out.push({ workoutId: w.id, date: w.startedAt, sets });
  }
  return out;
}

/** Ejercicios que se hicieron al menos una vez, del más reciente al más viejo. */
export function exercisesWithHistory() {
  const lastDate = new Map();
  for (const w of state.workouts) {
    for (const s of w.sets) lastDate.set(s.exerciseId, w.startedAt);
  }
  return [...lastDate]
    .map(([id, date]) => ({ exercise: exercise(id), lastDate: date }))
    .filter((x) => x.exercise)
    .sort((a, b) => b.lastDate - a.lastDate);
}

export function lastWorkoutOf(routineId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    if (state.workouts[i].routineId === routineId) return state.workouts[i];
  }
  return null;
}

export function workout(id) {
  return state.workouts.find((w) => w.id === id);
}

// ---------- Entrenamiento en curso ----------

export function active() {
  return state.active;
}

/**
 * Arma un ejercicio del entrenamiento a partir de un ítem de rutina.
 * item.repsPerSet (opcional) = reps distintas por serie, ej. [12, 10, 8]; si está, manda sobre sets/reps.
 */
function workoutExercise(item, weight = '') {
  const per = item.repsPerSet?.length ? item.repsPerSet : null;
  const count = per ? per.length : item.sets;
  return {
    exerciseId: item.exerciseId,
    targetSets: count,
    targetReps: item.reps,
    targetRepsPerSet: per,
    sets: Array.from({ length: count }, (_, j) => ({
      weight,
      reps: String(per ? per[j] : item.reps),
      done: false,
    })),
  };
}

export function startWorkout(routineId) {
  const r = routine(routineId);
  state.active = {
    routineId: r.id,
    routineName: r.name,
    startedAt: Date.now(),
    exercises: r.items.map((item) => workoutExercise(item)),
  };
  save();
  return state.active;
}

/**
 * Empieza un entrenamiento desde una rutina generada (sin guardarla como rutina).
 * plan: { name, restSeconds, items: [{ exerciseId, sets, reps, repsPerSet?, weight }] }
 */
export function startWorkoutFromPlan(plan) {
  state.active = {
    routineId: null,
    routineName: plan.name,
    startedAt: Date.now(),
    restSeconds: plan.restSeconds,
    exercises: plan.items.map((item) => workoutExercise(item, item.weight != null ? String(item.weight) : '')),
  };
  save();
  return state.active;
}

/** Guardar cambios hechos directamente sobre el objeto active(). */
export function persistActive() {
  save();
}

export function discardWorkout() {
  state.active = null;
  save();
}

function toNumber(value) {
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Guarda en el historial solo las series marcadas como hechas. Devuelve el entrenamiento o null. */
export function finishWorkout() {
  const a = state.active;
  if (!a) return null;
  const sets = [];
  for (const ex of a.exercises) {
    ex.sets.forEach((s, i) => {
      if (!s.done) return;
      sets.push({
        exerciseId: ex.exerciseId,
        set: i + 1,
        reps: toNumber(s.reps) ?? 0,
        weight: toNumber(s.weight),
      });
    });
  }
  state.active = null;
  if (!sets.length) {
    save();
    return null;
  }
  const w = {
    id: uid(),
    routineId: a.routineId,
    routineName: a.routineName,
    startedAt: a.startedAt,
    finishedAt: Date.now(),
    sets,
  };
  state.workouts.push(w);
  save();
  return w;
}
