// Capa de datos. Todo vive en localStorage, así la app funciona sin conexión.
//
// Forma del estado guardado:
//   exercises: [{ id, name, group, custom }]
//   routines:  [{ id, name, groups: [groupId], items: [{ exerciseId, sets, reps }] }]
//   workouts:  [{ id, routineId, routineName, startedAt, finishedAt,
//                 sets: [{ exerciseId, set, reps, weight }] }]
//   active:    entrenamiento en curso (o null), para no perder nada si se cierra la app.

import { GROUPS, SEED_EXERCISES } from './data.js';

const KEY = 'appgym.v1';

let state = load();

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function initialState() {
  const exercises = [];
  for (const group of GROUPS) {
    for (const name of SEED_EXERCISES[group.id]) {
      exercises.push({ id: `${group.id}-${slug(name)}`, name, group: group.id, custom: false });
    }
  }
  return { version: 1, exercises, routines: [], workouts: [], active: null };
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

export function startWorkout(routineId) {
  const r = routine(routineId);
  state.active = {
    routineId: r.id,
    routineName: r.name,
    startedAt: Date.now(),
    exercises: r.items.map((item) => ({
      exerciseId: item.exerciseId,
      targetSets: item.sets,
      targetReps: item.reps,
      sets: Array.from({ length: item.sets }, () => ({ weight: '', reps: String(item.reps), done: false })),
    })),
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
