// Pantallas de la app. Router simple por hash:
//   #/                     inicio
//   #/rutina/nueva         crear rutina
//   #/rutina/:id/editar    editar rutina
//   #/entrenar             entrenamiento en curso
//   #/resumen/:workoutId   resumen al terminar
//   #/progreso             ejercicios con historial
//   #/ejercicio/:id        evolución de un ejercicio
//   #/generar              rutina para hoy (generada automáticamente)
//   #/entrenamiento/:id    entrenamiento pasado (corregir o borrar)

import * as store from './store.js';
import {
  generatePlan,
  suggestedSetsLabel,
  planItem,
  recalcMinutes,
  additionCandidates,
  INTENSITIES,
  DURATIONS,
} from './generator.js';
import { muscleLabel, muscleOf, slug } from './data.js';

const groupLabel = (id) => store.groupLabel(id);

/** "3 × 10", o "12/10/8" si cada serie tiene sus propias reps. */
function fmtTarget(sets, reps, repsPerSet) {
  return repsPerSet?.length ? repsPerSet.join('/') : `${sets} × ${reps}`;
}

/** Reps objetivo de la serie j de un ejercicio del entrenamiento. */
function targetFor(ex, j) {
  return ex.targetRepsPerSet?.[j] ?? ex.targetReps;
}

/** "Espalda · Amplitud", o solo el grupo si no se sabe la zona. */
function exerciseZone(ex) {
  const zone = muscleLabel(ex);
  return zone ? `${groupLabel(ex?.group)} · ${zone}` : groupLabel(ex?.group);
}

const root = document.getElementById('app');
const sheet = document.getElementById('sheet');

// ---------- Utilidades ----------

const ICONS = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>',
  dumbbell:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function navigate(path) {
  if (location.hash === '#' + path) route();
  else location.hash = path;
}

function fmtNumber(n) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

function fmtSet(s) {
  return s.weight != null ? `${fmtNumber(s.weight)} kg × ${s.reps}` : `${s.reps} reps`;
}

/** La mejor serie de la última vez: la de más peso (y a igual peso, más reps). */
function topSet(sets) {
  return sets.reduce((best, s) => {
    const w = s.weight ?? 0;
    const bw = best.weight ?? 0;
    return w > bw || (w === bw && s.reps > best.reps) ? s : best;
  });
}

function relativeDay(ts) {
  const day = (d) => new Date(d).setHours(0, 0, 0, 0);
  const diff = Math.round((day(Date.now()) - day(ts)) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 7) return `hace ${diff} días`;
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const REST_OPTIONS = [0, 45, 60, 90, 120, 180];

function fmtRest(secs) {
  if (!secs) return 'Sin descanso';
  if (secs < 60) return `${secs} s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

function fmtShortDate(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });
}

function fmtDuration(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

let toastTimer;
function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function checkSave() {
  if (store.lastSaveFailed()) toast('No se pudo guardar en el dispositivo');
}

/** Hoja de opciones desde abajo. actions: [{ label, danger?, run }] */
function openSheet(title, actions) {
  sheet.innerHTML = `
    <div class="sheet-body">
      <p class="sheet-title">${esc(title)}</p>
      ${actions
        .map(
          (a, i) =>
            `<button class="sheet-btn${a.danger ? ' danger' : ''}" data-i="${i}">${esc(a.label)}</button>`,
        )
        .join('')}
      <button class="sheet-btn cancel" data-i="cancel">Cancelar</button>
    </div>`;
  sheet.onclick = (e) => {
    if (e.target === sheet) return sheet.close();
    const btn = e.target.closest('[data-i]');
    if (!btn) return;
    sheet.close();
    if (btn.dataset.i !== 'cancel') actions[+btn.dataset.i].run();
  };
  sheet.showModal();
}

/**
 * Pregunta de sí/no dentro de la app. Devuelve una promesa con true/false.
 * (No usamos confirm() del navegador: algunos lo bloquean y devuelve false sin mostrar nada.)
 */
function ask(message, { ok = 'Aceptar', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (answer) => {
      if (settled) return;
      settled = true;
      sheet.onclose = null;
      if (sheet.open) sheet.close();
      resolve(answer);
    };
    sheet.innerHTML = `
      <div class="sheet-body">
        <p class="sheet-message">${esc(message)}</p>
        <button class="sheet-btn${danger ? ' danger' : ''}" data-answer="yes">${esc(ok)}</button>
        <button class="sheet-btn cancel" data-answer="no">Cancelar</button>
      </div>`;
    sheet.onclick = (e) => {
      if (e.target === sheet) return done(false);
      const btn = e.target.closest('[data-answer]');
      if (btn) done(btn.dataset.answer === 'yes');
    };
    // Cerrado con Escape o al cambiar de pantalla. Si la hoja está abierta, es un cierre viejo de otra hoja.
    sheet.onclose = () => {
      if (!sheet.open) done(false);
    };
    if (sheet.open) sheet.close();
    sheet.showModal();
  });
}

/** Pedir un texto corto en una hoja de la app. Devuelve el texto, o null si se canceló. */
function promptText(title, { value = '', placeholder = '', ok = 'Guardar' } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      sheet.onclose = null;
      if (sheet.open) sheet.close();
      resolve(result);
    };
    sheet.innerHTML = `
      <form class="sheet-body" method="dialog">
        <p class="sheet-title">${esc(title)}</p>
        <input name="text" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="120" autocomplete="off" enterkeyhint="done">
        <button class="sheet-btn" type="submit">${esc(ok)}</button>
        <button class="sheet-btn cancel" type="button" data-answer="no">Cancelar</button>
      </form>`;
    const form = sheet.querySelector('form');
    form.onsubmit = (e) => {
      e.preventDefault();
      done(form.text.value);
    };
    sheet.onclick = (e) => {
      if (e.target === sheet || e.target.closest('[data-answer="no"]')) done(null);
    };
    sheet.onclose = () => {
      if (!sheet.open) done(null);
    };
    if (sheet.open) sheet.close();
    sheet.showModal();
    form.text.focus();
  });
}

// ---------- Router ----------

let timerId = null;

function route() {
  clearInterval(timerId);
  if (sheet.open) sheet.close();
  root.onchange = null;
  root.onfocusin = null;
  const parts = location.hash.slice(1).split('/').filter(Boolean);

  if (parts[0] === 'rutina' && parts[1] === 'nueva') openEditor(null);
  else if (parts[0] === 'rutina' && parts[2] === 'editar') openEditor(parts[1]);
  else if (parts[0] === 'entrenar') renderWorkout();
  else if (parts[0] === 'resumen') renderSummary(parts[1]);
  else if (parts[0] === 'progreso') renderProgress();
  else if (parts[0] === 'ejercicio') renderExercise(parts[1]);
  else if (parts[0] === 'generar') openGenerator();
  else if (parts[0] === 'entrenamiento') renderPastWorkout(parts[1]);
  else renderHome();

  window.scrollTo(0, 0);
}

/** Volver a la pantalla anterior (o al inicio si se entró directo). */
function goBack() {
  if (history.length > 1) history.back();
  else navigate('/');
}

// ---------- Ajustes y backup ----------

function chooseRest() {
  const current = store.settings().restSeconds;
  openSheet(
    'Descanso entre series',
    REST_OPTIONS.map((secs) => ({
      label: `${secs === current ? '✓ ' : ''}${fmtRest(secs)}`,
      run: () => {
        store.updateSettings({ restSeconds: secs });
        checkSave();
        toast(secs ? `Descanso: ${fmtRest(secs)}` : 'Descanso desactivado');
      },
    })),
  );
}

function exportBackup() {
  const json = JSON.stringify(store.exportData(), null, 2);
  const name = `appgym-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // En el celular, abrir "Compartir" para guardarlo en Archivos, Drive, WhatsApp, etc.
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    navigator
      .share({ files: [file], title: 'Backup App Gym' })
      .then(backupDone)
      .catch(() => {}); // cancelado: no cuenta como backup
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup descargado');
  backupDone();
}

/** Compartir una rutina: archivo chiquito que el otro importa desde ⋯ → Importar. */
function shareRoutine(id) {
  const data = store.exportRoutine(id);
  if (!data) return;
  const name = `rutina-${slug(data.routine.name) || 'compartida'}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  const text = `Rutina "${data.routine.name}" para App Gym Personal. Guardá el archivo y abrilo desde el menú ⋯ → Importar.`;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: `Rutina ${data.routine.name}`, text }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Rutina descargada: mandale el archivo a quien quieras');
}

function backupDone() {
  store.markBackup();
  // Si estaba el aviso en el inicio, sacarlo.
  if (!location.hash.slice(1).replace(/^\//, '')) renderHome();
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  document.body.appendChild(input);
  input.onchange = async () => {
    const file = input.files[0];
    input.remove();
    if (!file) return;
    let obj = null;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      obj = null;
    }

    // ¿Es una rutina compartida? Se agrega sin tocar nada más.
    const shared = store.parseSharedRoutine(obj);
    if (shared) {
      const n = shared.items.length;
      const ok = await ask(
        `¿Agregar la rutina "${shared.name}" (${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}) a tus rutinas? No se borra nada de lo tuyo.`,
        { ok: 'Agregar rutina' },
      );
      if (!ok) return;
      store.importRoutine(shared);
      checkSave();
      toast('Rutina agregada');
      return navigate('/');
    }

    const data = store.parseBackup(obj);
    if (!data) return toast('El archivo no es un backup ni una rutina');
    const ok = await ask(
      `Esto reemplaza tus datos actuales por los del backup (${data.routines.length} rutinas, ${data.workouts.length} entrenamientos). ¿Continuar?`,
      { ok: 'Importar', danger: true },
    );
    if (!ok) return;
    store.importData(data);
    checkSave();
    toast('Datos importados');
    navigate('/');
  };
  input.click();
}

// ---------- Inicio ----------

function workoutProgress(a) {
  let done = 0;
  let total = 0;
  for (const ex of a.exercises) {
    total += ex.sets.length;
    done += ex.sets.filter((s) => s.done).length;
  }
  return { done, total };
}

function renderHome() {
  const routines = store.routines();
  const a = store.active();

  let banner = '';
  if (a) {
    const p = workoutProgress(a);
    banner = `
      <button class="resume" data-action="resume">
        <span class="pulse" aria-hidden="true"></span>
        <span class="resume-text">
          <strong>Entrenamiento en curso</strong>
          <span>${esc(a.routineName)} · ${fmtDuration(Date.now() - a.startedAt)} · ${p.done}/${p.total} series</span>
        </span>
        <span class="resume-cta">Continuar</span>
      </button>`;
  }

  const backupDays = store.backupReminderDays();
  if (backupDays != null) {
    banner += `
      <div class="notice">
        <span class="notice-text">Hace ${backupDays} días que no hacés un backup de tus datos.</span>
        <button class="notice-btn" data-action="backup-now">Exportar</button>
        <button class="icon-btn notice-close" data-action="backup-later" aria-label="Recordar más tarde">${ICONS.close}</button>
      </div>`;
  }

  let body;
  if (!routines.length) {
    body = `
      <div class="empty">
        <div class="empty-icon">${ICONS.dumbbell}</div>
        <h2>Creá tu primera rutina</h2>
        <p>Elegí los grupos musculares, marcá los ejercicios y definí series y repeticiones.</p>
        <button class="btn btn-primary" data-action="new">${ICONS.plus}Crear rutina</button>
        <button class="link-btn" data-action="generate">${ICONS.spark}O generá una automática</button>
      </div>`;
  } else {
    body = `
      <button class="gen-card" data-action="generate">
        <span class="gen-icon">${ICONS.spark}</span>
        <span class="gen-text">
          <strong>Rutina para hoy</strong>
          <span>Armada según lo que venís entrenando</span>
        </span>
        ${ICONS.chevron}
      </button>
      <h2 class="section-title">Tus rutinas</h2>
      <ul class="routine-list">
        ${routines
          .map((r) => {
            const last = store.lastWorkoutOf(r.id);
            const n = r.items.length;
            return `
            <li class="card routine">
              <button class="routine-main" data-action="start" data-id="${r.id}">
                <span class="routine-name">${esc(r.name)}</span>
                <span class="routine-groups">${r.groups.map(groupLabel).join(' · ')}</span>
                <span class="routine-sub">${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}${
                  last ? ` · Último: ${relativeDay(last.startedAt)}` : ''
                }</span>
              </button>
              <button class="icon-btn" data-action="routine-menu" data-id="${r.id}" aria-label="Opciones de ${esc(r.name)}">${ICONS.dots}</button>
            </li>`;
          })
          .join('')}
      </ul>`;
  }

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">${ICONS.dumbbell}</span>APP GYM PERSONAL</div>
      <button class="icon-btn" data-action="app-menu" aria-label="Menú">${ICONS.dots}</button>
    </header>
    <main class="content">${banner}${body}</main>
    ${
      routines.length
        ? `<div class="bottombar"><button class="btn btn-primary btn-block" data-action="new">${ICONS.plus}Nueva rutina</button></div>`
        : ''
    }`;

  root.oninput = null;
  root.onsubmit = null;
  root.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'new':
        return navigate('/rutina/nueva');
      case 'resume':
        return navigate('/entrenar');
      case 'generate':
        return navigate('/generar');
      case 'start':
        return startRoutine(id);
      case 'backup-now':
        return exportBackup();
      case 'backup-later':
        store.snoozeBackupReminder();
        return renderHome();
      case 'app-menu':
        return openSheet('Menú', [
          { label: 'Progreso', run: () => navigate('/progreso') },
          { label: `Descanso entre series: ${fmtRest(store.settings().restSeconds)}`, run: chooseRest },
          { label: 'Exportar datos (backup)', run: exportBackup },
          { label: 'Importar backup o rutina', run: importBackup },
        ]);
      case 'routine-menu':
        return openSheet(store.routine(id).name, [
          { label: 'Empezar entrenamiento', run: () => startRoutine(id) },
          { label: 'Editar rutina', run: () => navigate(`/rutina/${id}/editar`) },
          { label: 'Compartir rutina', run: () => shareRoutine(id) },
          {
            label: 'Eliminar rutina',
            danger: true,
            run: async () => {
              if (await confirmDeleteRoutine(id)) renderHome();
            },
          },
        ]);
    }
  };
}

async function confirmDeleteRoutine(id) {
  const r = store.routine(id);
  if (!r) return false;
  const ok = await ask(`¿Eliminar la rutina "${r.name}"? El historial de entrenamientos se conserva.`, {
    ok: 'Eliminar rutina',
    danger: true,
  });
  if (!ok) return false;
  store.deleteRoutine(id);
  checkSave();
  toast('Rutina eliminada');
  return true;
}

async function startRoutine(id) {
  const a = store.active();
  if (a) {
    if (a.routineId === id) return navigate('/entrenar');
    const ok = await ask(`Tenés un entrenamiento de "${a.routineName}" en curso. ¿Descartarlo y empezar este?`, {
      ok: 'Descartar y empezar',
      danger: true,
    });
    if (!ok) return;
  }
  const r = store.routine(id);
  if (!r.items.length) {
    toast('Esta rutina no tiene ejercicios');
    return;
  }
  store.startWorkout(id);
  checkSave();
  navigate('/entrenar');
}

// ---------- Crear / editar rutina ----------

let draft = null;
let draftSnapshot = '';
let addingTo = null; // grupo donde se está escribiendo un ejercicio propio
let addingGroup = false; // se está escribiendo un grupo muscular propio

function openEditor(id) {
  const r = id ? store.routine(id) : null;
  if (id && !r) return navigate('/');
  draft = r ? JSON.parse(JSON.stringify(r)) : { id: null, name: '', groups: [], items: [] };
  draftSnapshot = JSON.stringify(draft);
  addingTo = null;
  addingGroup = false;
  renderEditor();
}

function saveHint() {
  if (!draft.name.trim()) return 'Poné un nombre a la rutina';
  if (!draft.items.length) return 'Elegí al menos un ejercicio';
  return '';
}

function updateSaveButton() {
  const hint = saveHint();
  const btn = root.querySelector('[data-action="save"]');
  btn.disabled = !!hint;
  const n = draft.items.length;
  btn.textContent = hint || `Guardar rutina · ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`;
}

function renderEditor() {
  const selected = new Map(draft.items.map((it, i) => [it.exerciseId, { ...it, order: i + 1 }]));

  const allGroups = store.groups();
  const chips =
    allGroups
      .map(
        (g) =>
          `<button class="chip" data-action="group" data-group="${g.id}" aria-pressed="${draft.groups.includes(g.id)}">${esc(g.label)}</button>`,
      )
      .join('') +
    (addingGroup ? '' : `<button class="chip chip-add" data-action="add-group">${ICONS.plus}Grupo</button>`);

  const groupForm = addingGroup
    ? `<form class="add-ex add-group">
         <input name="groupname" placeholder="Ej: Piernas (cuádriceps)" maxlength="40" autocomplete="off" enterkeyhint="done" aria-label="Nombre del grupo muscular">
         <button class="btn btn-primary btn-sm" type="submit">Crear</button>
         <button class="icon-btn" type="button" data-action="cancel-group" aria-label="Cancelar">${ICONS.close}</button>
       </form>`
    : '';

  const orderBlock =
    draft.items.length >= 2
      ? `<section class="group-block">
           <h2 class="section-title">Orden de la rutina</h2>
           <ol class="order-list">
             ${draft.items
               .map((it, i) => {
                 const ex = store.exercise(it.exerciseId);
                 return `
                 <li class="order-item">
                   <span class="order-num">${i + 1}</span>
                   <span class="order-name">${esc(ex?.name ?? 'Ejercicio')}<small>${esc(exerciseZone(ex))}</small></span>
                   <button class="icon-btn" data-action="move" data-index="${i}" data-delta="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ICONS.up}</button>
                   <button class="icon-btn" data-action="move" data-index="${i}" data-delta="1" aria-label="Bajar" ${i === draft.items.length - 1 ? 'disabled' : ''}>${ICONS.down}</button>
                 </li>`;
               })
               .join('')}
           </ol>
         </section>`
      : '';

  const blocks = allGroups
    .filter((g) => draft.groups.includes(g.id))
    .map((g) => {
      const items = store
        .exercisesByGroup(g.id)
        .map((ex) => {
          const sel = selected.get(ex.id);
          return `
          <li class="ex-item${sel ? ' selected' : ''}">
            <button class="ex-toggle" data-action="toggle-ex" data-id="${ex.id}" aria-pressed="${!!sel}">
              <span class="ex-check">${sel ? sel.order : ''}</span>
              <span class="ex-name">${esc(ex.name)}${muscleLabel(ex) ? `<small>${esc(muscleLabel(ex))}</small>` : ''}</span>
              ${ex.custom ? '<span class="tag">propio</span>' : ''}
            </button>
            ${
              sel
                ? `<div class="targets">
                    ${stepper(ex.id, 'sets', 'Series', sel.sets)}
                    ${
                      sel.repsPerSet
                        ? `<div class="rps">
                             <span class="stepper-label">Reps por serie</span>
                             <div class="rps-row">
                               ${sel.repsPerSet
                                 .map(
                                   (r, k) =>
                                     `<input class="rps-input" inputmode="numeric" enterkeyhint="done" maxlength="3" data-rps="${ex.id}" data-k="${k}" value="${r}" aria-label="Reps serie ${k + 1}">`,
                                 )
                                 .join('<span class="rps-sep">/</span>')}
                             </div>
                           </div>`
                        : `<span class="times">×</span>${stepper(ex.id, 'reps', 'Reps', sel.reps)}`
                    }
                  </div>
                  <button class="link-btn rps-toggle" data-action="toggle-rps" data-id="${ex.id}">${
                    sel.repsPerSet ? 'Mismas reps en todas las series' : 'Reps distintas por serie'
                  }</button>`
                : ''
            }
          </li>`;
        })
        .join('');

      const add =
        addingTo === g.id
          ? `<form class="add-ex" data-group="${g.id}">
               <input name="exname" placeholder="Nombre del ejercicio" maxlength="60" autocomplete="off" enterkeyhint="done" aria-label="Nombre del ejercicio de ${esc(g.label)}">
               <button class="btn btn-primary btn-sm" type="submit">Agregar</button>
               <button class="icon-btn" type="button" data-action="cancel-add" aria-label="Cancelar">${ICONS.close}</button>
             </form>`
          : `<button class="link-btn" data-action="add-ex" data-group="${g.id}">${ICONS.plus}Agregar ejercicio a ${esc(g.label)}</button>`;

      return `
        <section class="group-block">
          <h2 class="section-title">${esc(g.label)}</h2>
          <ul class="ex-list">${items}</ul>
          ${add}
        </section>`;
    })
    .join('');

  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Volver">${ICONS.back}</button>
      <h1 class="topbar-title">${draft.id ? 'Editar rutina' : 'Nueva rutina'}</h1>
    </header>
    <main class="content">
      <label class="field">
        <span class="label">Nombre</span>
        <input id="rname" value="${esc(draft.name)}" placeholder="Ej: Push, Día de piernas" maxlength="40" autocomplete="off">
      </label>
      <div class="field">
        <span class="label">Grupos musculares</span>
        <div class="chips">${chips}</div>
        ${groupForm}
      </div>
      ${blocks || '<p class="hint">Elegí uno o más grupos para ver los ejercicios recomendados.</p>'}
      ${orderBlock}
      ${
        draft.id
          ? `<button class="btn btn-danger btn-block" data-action="delete-routine">${ICONS.trash}Eliminar rutina</button>`
          : ''
      }
    </main>
    <div class="bottombar"><button class="btn btn-primary btn-block" data-action="save"></button></div>`;

  updateSaveButton();
  if (addingTo || addingGroup) root.querySelector('.add-ex input')?.focus();

  root.oninput = (e) => {
    const el = e.target;
    if (el.id === 'rname') {
      draft.name = el.value;
      updateSaveButton();
    } else if (el.dataset.rps) {
      // Solo números; si queda vacío se guarda como está y se corrige al guardar la rutina.
      el.value = el.value.replace(/\D/g, '');
      const item = draft.items.find((it) => it.exerciseId === el.dataset.rps);
      const n = parseInt(el.value, 10);
      if (n > 0) item.repsPerSet[+el.dataset.k] = Math.min(100, n);
    }
  };
  // Al tocar un casillero de reps, se selecciona el número para reemplazarlo directo.
  root.onfocusin = (e) => {
    if (e.target.classList?.contains('rps-input')) e.target.select();
  };

  root.onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.classList.contains('add-group')) {
      const group = store.addGroup(form.groupname.value);
      if (!group) return form.groupname.focus();
      if (!draft.groups.includes(group.id)) draft.groups.push(group.id);
      addingGroup = false;
      checkSave();
      return rerenderKeepingScroll(renderEditor);
    }
    const ex = store.addExercise(form.exname.value, form.dataset.group);
    if (!ex) return form.exname.focus();
    if (!draft.items.some((it) => it.exerciseId === ex.id)) {
      draft.items.push({ exerciseId: ex.id, sets: 3, reps: 10 });
    }
    addingTo = null;
    checkSave();
    rerenderKeepingScroll(renderEditor);
  };

  root.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'back':
        if (
          JSON.stringify(draft) !== draftSnapshot &&
          !(await ask('¿Salir sin guardar los cambios?', { ok: 'Salir sin guardar', danger: true }))
        ) {
          return;
        }
        return navigate('/');
      case 'group':
        return toggleGroup(btn.dataset.group);
      case 'toggle-ex': {
        const id = btn.dataset.id;
        const i = draft.items.findIndex((it) => it.exerciseId === id);
        if (i >= 0) draft.items.splice(i, 1);
        else draft.items.push({ exerciseId: id, sets: 3, reps: 10 });
        return rerenderKeepingScroll(renderEditor);
      }
      case 'step': {
        const item = draft.items.find((it) => it.exerciseId === btn.dataset.id);
        const field = btn.dataset.field;
        const max = field === 'sets' ? 20 : 100;
        item[field] = Math.min(max, Math.max(1, item[field] + Number(btn.dataset.delta)));
        if (field === 'sets' && item.repsPerSet) {
          // Sumar o quitar casilleros: la serie nueva copia las reps de la última.
          while (item.repsPerSet.length < item.sets) item.repsPerSet.push(item.repsPerSet.at(-1));
          item.repsPerSet.length = item.sets;
          return rerenderKeepingScroll(renderEditor);
        }
        root.querySelector(`[data-out="${field}-${item.exerciseId}"]`).textContent = item[field];
        return;
      }
      case 'toggle-rps': {
        const item = draft.items.find((it) => it.exerciseId === btn.dataset.id);
        if (item.repsPerSet) {
          item.reps = item.repsPerSet[0];
          delete item.repsPerSet;
        } else {
          item.repsPerSet = Array(item.sets).fill(item.reps);
        }
        rerenderKeepingScroll(renderEditor);
        // Dejar listo el primer casillero para escribir.
        if (item.repsPerSet) root.querySelector(`[data-rps="${item.exerciseId}"]`)?.focus();
        return;
      }
      case 'add-ex':
        addingTo = btn.dataset.group;
        return rerenderKeepingScroll(renderEditor);
      case 'cancel-add':
        addingTo = null;
        return rerenderKeepingScroll(renderEditor);
      case 'add-group':
        addingGroup = true;
        return rerenderKeepingScroll(renderEditor);
      case 'cancel-group':
        addingGroup = false;
        return rerenderKeepingScroll(renderEditor);
      case 'move': {
        const i = +btn.dataset.index;
        const j = i + Number(btn.dataset.delta);
        if (j < 0 || j >= draft.items.length) return;
        [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]];
        return rerenderKeepingScroll(renderEditor);
      }
      case 'save':
        return saveDraft();
      case 'delete-routine':
        if (await confirmDeleteRoutine(draft.id)) navigate('/');
        return;
    }
  };
}

function stepper(id, field, label, value) {
  return `
    <div class="stepper">
      <span class="stepper-label">${label}</span>
      <div class="stepper-ctrl">
        <button data-action="step" data-id="${id}" data-field="${field}" data-delta="-1" aria-label="Menos ${label.toLowerCase()}">−</button>
        <output data-out="${field}-${id}">${value}</output>
        <button data-action="step" data-id="${id}" data-field="${field}" data-delta="1" aria-label="Más ${label.toLowerCase()}">+</button>
      </div>
    </div>`;
}

async function toggleGroup(group) {
  if (draft.groups.includes(group)) {
    const inGroup = draft.items.filter((it) => store.exercise(it.exerciseId)?.group === group);
    if (
      inGroup.length &&
      !(await ask(`¿Quitar ${groupLabel(group)} y sus ${inGroup.length} ejercicios elegidos?`, { ok: 'Quitar' }))
    ) {
      return;
    }
    draft.groups = draft.groups.filter((g) => g !== group);
    draft.items = draft.items.filter((it) => !inGroup.includes(it));
    if (addingTo === group) addingTo = null;
  } else {
    draft.groups.push(group);
  }
  rerenderKeepingScroll(renderEditor);
}

function saveDraft() {
  if (saveHint()) return;
  const order = store.groups().map((g) => g.id);
  store.saveRoutine({
    id: draft.id || store.uid(),
    name: draft.name.trim(),
    groups: [...draft.groups].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    items: draft.items.map((it) => {
      if (!it.repsPerSet) return it;
      // Con reps por serie: la cantidad de series sale de la lista, y "reps" queda como la primera.
      return { ...it, sets: it.repsPerSet.length, reps: it.repsPerSet[0] };
    }),
  });
  checkSave();
  toast('Rutina guardada');
  navigate('/');
}

function rerenderKeepingScroll(render) {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// ---------- Descanso ----------

let audioCtx = null;
let restBeep = null; // sonido programado para el final del descanso

function startRest(a) {
  // "Sin descanso" en ajustes lo apaga siempre; si no, una rutina generada trae su propio descanso.
  const setting = store.settings().restSeconds;
  const secs = setting ? a.restSeconds ?? setting : 0;
  if (!secs) return;
  const now = Date.now();
  a.rest = { startedAt: now, endsAt: now + secs * 1000, notified: false };
  store.persistActive();
  scheduleBeep(secs);
  renderRest(a);
}

function scheduleBeep(secs) {
  cancelBeep();
  try {
    // Se crea en el toque del usuario: así el celular permite reproducir sonido después.
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
    const t = audioCtx.currentTime + secs;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    // Dos "bips" cortos.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    gain.gain.setValueAtTime(0.0001, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.37);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
    restBeep = osc;
  } catch {
    restBeep = null; // sin sonido, queda la barra y la vibración
  }
}

function cancelBeep() {
  try {
    restBeep?.stop();
  } catch {
    /* ya había sonado */
  }
  restBeep = null;
}

const RING = 2 * Math.PI * 18; // largo del anillo (radio 18)

function restIslandHtml() {
  return `
    <div class="rest-island" id="rest-island" hidden role="timer">
      <svg class="rest-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle class="rest-ring-track" cx="22" cy="22" r="18"/>
        <circle class="rest-ring-fill" cx="22" cy="22" r="18" stroke-dasharray="${RING}"/>
      </svg>
      <div class="rest-info">
        <span class="rest-time" id="rest-time"></span>
        <span class="rest-label" id="rest-label"></span>
      </div>
      <button class="rest-btn" data-action="rest-add" aria-label="Sumar 15 segundos">+15</button>
      <button class="rest-btn rest-close" data-action="rest-skip" aria-label="Saltar descanso">${ICONS.close}</button>
    </div>`;
}

/** Muestra u oculta la isla. El anillo se vacía con una animación CSS que dura lo que dura el descanso. */
function renderRest(a) {
  const island = document.getElementById('rest-island');
  if (!island) return;
  const r = a.rest;
  island.hidden = !r;
  if (!r) return;
  const fill = island.querySelector('.rest-ring-fill');
  fill.style.animation = 'none';
  void fill.getBoundingClientRect(); // reinicia la animación
  fill.style.animation = `rest-ring ${r.endsAt - r.startedAt}ms linear ${r.startedAt - Date.now()}ms forwards`;
  updateRestTime(a);
}

/** Se llama varias veces por segundo mientras se entrena. */
function tickRest(a) {
  const r = a.rest;
  if (!r) return;
  const now = Date.now();
  if (now >= r.endsAt && !r.notified) {
    r.notified = true;
    store.persistActive();
    navigator.vibrate?.([200, 100, 200]);
  }
  // A los 20 s de terminado, la isla se va sola.
  if (now >= r.endsAt + 20000) {
    a.rest = null;
    store.persistActive();
    return renderRest(a);
  }
  updateRestTime(a);
}

function updateRestTime(a) {
  const island = document.getElementById('rest-island');
  const r = a.rest;
  if (!island || !r) return;
  const left = r.endsAt - Date.now();
  const over = left <= 0;
  island.classList.toggle('over', over);
  if (over) {
    document.getElementById('rest-time').textContent = '¡A entrenar!';
    document.getElementById('rest-label').textContent = 'Descanso terminado';
  } else {
    const secs = Math.ceil(left / 1000);
    document.getElementById('rest-time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    document.getElementById('rest-label').textContent = 'Descanso';
  }
}

function extendRest(a, secs) {
  const r = a.rest;
  if (!r) return;
  const now = Date.now();
  if (now >= r.endsAt) {
    r.startedAt = now;
    r.endsAt = now + secs * 1000;
  } else {
    r.endsAt += secs * 1000;
  }
  r.notified = false;
  store.persistActive();
  scheduleBeep((r.endsAt - now) / 1000);
  renderRest(a);
}

function skipRest(a) {
  a.rest = null;
  cancelBeep();
  store.persistActive();
  renderRest(a);
}

// ---------- Entrenar ----------

function renderWorkout() {
  clearInterval(timerId); // por si se vuelve a dibujar sin pasar por el router
  const a = store.active();
  if (!a) return navigate('/');

  root.innerHTML = `
    ${restIslandHtml()}
    <header class="topbar">
      <button class="icon-btn" data-action="home" aria-label="Volver al inicio">${ICONS.back}</button>
      <div class="topbar-title">
        <h1>${esc(a.routineName)}</h1>
        <span class="topbar-sub"><span id="timer">${fmtElapsed(Date.now() - a.startedAt)}</span> · <span id="progress"></span></span>
      </div>
      <button class="icon-btn" data-action="workout-menu" aria-label="Opciones">${ICONS.dots}</button>
    </header>
    <main class="content">
      ${a.exercises.map((_, i) => exerciseCard(a, i)).join('')}
    </main>
    <div class="bottombar"><button class="btn btn-primary btn-block" data-action="finish">Terminar entrenamiento</button></div>`;

  updateProgress();
  renderRest(a);
  timerId = setInterval(() => {
    const el = document.getElementById('timer');
    if (el) el.textContent = fmtElapsed(Date.now() - a.startedAt);
    tickRest(a);
  }, 250);

  root.onsubmit = null;
  root.oninput = (e) => {
    const input = e.target;
    if (!input.dataset.field) return;
    a.exercises[+input.dataset.ex].sets[+input.dataset.set][input.dataset.field] = input.value;
    store.persistActive();
  };

  root.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const exIndex = +btn.dataset.ex;
    const ex = a.exercises[exIndex];
    switch (btn.dataset.action) {
      case 'home':
        return navigate('/');
      case 'history':
        return navigate(`/ejercicio/${btn.dataset.id}`);
      case 'ex-menu': {
        const info = store.exercise(ex.exerciseId);
        return openSheet(info?.name ?? 'Ejercicio', [
          { label: 'Cambiar por otro ejercicio', run: () => chooseSwap(a, exIndex) },
          { label: info?.note ? 'Editar nota' : 'Agregar nota', run: () => editNote(a, exIndex) },
          { label: 'Ver progreso', run: () => navigate(`/ejercicio/${ex.exerciseId}`) },
        ]);
      }
      case 'rest-add':
        return extendRest(a, 15);
      case 'rest-skip':
        return skipRest(a);
      case 'workout-menu':
        return openSheet(a.routineName, [
          { label: `Descanso entre series: ${fmtRest(store.settings().restSeconds)}`, run: chooseRest },
          {
            label: 'Descartar entrenamiento',
            danger: true,
            run: async () => {
              const ok = await ask('¿Descartar este entrenamiento? No se va a guardar nada.', {
                ok: 'Descartar',
                danger: true,
              });
              if (!ok) return;
              cancelBeep();
              store.discardWorkout();
              navigate('/');
            },
          },
        ]);
      case 'done': {
        const s = ex.sets[+btn.dataset.set];
        s.done = !s.done;
        if (s.done && !String(s.reps).trim()) s.reps = String(targetFor(ex, +btn.dataset.set));
        s.pr = false;
        if (s.done) {
          // ¿Récord? Cuentan el historial y las otras series ya hechas hoy.
          const today = ex.sets
            .filter((o) => o !== s && o.done)
            .map((o) => ({ weight: toNum(o.weight), reps: toNum(o.reps) ?? 0 }));
          const weight = toNum(s.weight);
          const reps = toNum(s.reps);
          if (store.isRecord(ex.exerciseId, weight, reps, today)) {
            s.pr = true;
            toast(`🏆 Nuevo récord: ${fmtSet({ weight, reps })}`);
            navigator.vibrate?.(80);
          }
        }
        store.persistActive();
        checkSave();
        replaceCard(a, exIndex);
        if (s.done) startRest(a);
        return updateProgress();
      }
      case 'use-last': {
        const last = store.lastPerformance(ex.exerciseId);
        if (!last) return;
        ex.sets.forEach((s, j) => {
          if (s.done) return;
          const src = last[j] ?? last[last.length - 1];
          s.weight = src.weight != null ? String(src.weight) : '';
          s.reps = String(src.reps);
        });
        store.persistActive();
        return replaceCard(a, exIndex);
      }
      case 'use-suggest': {
        const w = btn.dataset.weight;
        ex.sets.forEach((s) => {
          if (!s.done) s.weight = w;
        });
        store.persistActive();
        replaceCard(a, exIndex);
        return toast(`Cargué ${fmtNumber(Number(w))} kg: la última vez completaste todas las series`);
      }
      case 'add-set': {
        const prev = ex.sets[ex.sets.length - 1];
        ex.sets.push({ weight: prev?.weight ?? '', reps: prev?.reps ?? String(ex.targetReps), done: false });
        store.persistActive();
        replaceCard(a, exIndex);
        return updateProgress();
      }
      case 'remove-set': {
        if (ex.sets.length <= 1) return;
        const lastSet = ex.sets[ex.sets.length - 1];
        if (
          lastSet.done &&
          !(await ask('La última serie ya está marcada como hecha. ¿Quitarla igual?', { ok: 'Quitar serie' }))
        ) {
          return;
        }
        ex.sets.pop();
        store.persistActive();
        replaceCard(a, exIndex);
        return updateProgress();
      }
      case 'finish':
        return finish(a);
    }
  };
}

function exerciseCard(a, i) {
  const ex = a.exercises[i];
  const info = store.exercise(ex.exerciseId);
  const last = store.lastPerformance(ex.exerciseId);
  const allDone = ex.sets.every((s) => s.done);

  const next = last ? suggestNext(ex, last) : null;
  const lastHtml = last
    ? `<div class="last-row">
         <button class="last-btn" data-action="use-last" data-ex="${i}">
           <span>Última vez: <strong>${fmtSet(topSet(last))}</strong></span>
           <span class="last-use">Usar</span>
         </button>
         ${
           next != null
             ? `<button class="up-btn" data-action="use-suggest" data-ex="${i}" data-weight="${next}" aria-label="Hoy probá ${fmtNumber(next)} kg">↑ ${fmtNumber(next)} kg</button>`
             : ''
         }
       </div>`
    : '<div class="last-none">Primera vez con este ejercicio</div>';

  const rows = ex.sets
    .map((s, j) => {
      const ref = last ? last[j] ?? last[last.length - 1] : null;
      const weightPh = ref?.weight != null ? fmtNumber(ref.weight) : 'kg';
      return `
      <div class="set-row${s.done ? ' done' : ''}">
        <span class="set-num"${s.pr ? ' title="Récord"' : ''}>${s.pr ? '🏆' : j + 1}</span>
        <input class="num" inputmode="decimal" enterkeyhint="next" data-field="weight" data-ex="${i}" data-set="${j}"
          value="${esc(s.weight)}" placeholder="${esc(weightPh)}" aria-label="Peso serie ${j + 1} (kg)">
        <input class="num" inputmode="numeric" enterkeyhint="done" data-field="reps" data-ex="${i}" data-set="${j}"
          value="${esc(s.reps)}" placeholder="${targetFor(ex, j)}" aria-label="Repeticiones serie ${j + 1}">
        <button class="check-btn" data-action="done" data-ex="${i}" data-set="${j}" aria-pressed="${s.done}"
          aria-label="Serie ${j + 1} hecha">${ICONS.check}</button>
      </div>`;
    })
    .join('');

  return `
    <article class="card ex-card${allDone ? ' complete' : ''}" data-card="${i}">
      <div class="ex-head">
        <h2 class="ex-title">
          <button class="ex-title-btn" data-action="history" data-id="${ex.exerciseId}" aria-label="Ver progreso de ${esc(info?.name ?? '')}">
            ${esc(info?.name ?? 'Ejercicio eliminado')}${ICONS.chevron}
          </button>
        </h2>
        <span class="ex-target">${esc(exerciseZone(info))} · ${fmtTarget(ex.targetSets, ex.targetReps, ex.targetRepsPerSet)}</span>
        ${info?.note ? `<span class="ex-note">${esc(info.note)}</span>` : ''}
        <button class="icon-btn ex-menu" data-action="ex-menu" data-ex="${i}" aria-label="Opciones de ${esc(info?.name ?? 'ejercicio')}">${ICONS.dots}</button>
      </div>
      ${lastHtml}
      <div class="sets">
        <div class="set-row set-head" aria-hidden="true"><span>Serie</span><span>kg</span><span>Reps</span><span></span></div>
        ${rows}
      </div>
      <div class="set-actions">
        <button class="link-btn" data-action="add-set" data-ex="${i}">${ICONS.plus}Serie</button>
        <button class="link-btn muted" data-action="remove-set" data-ex="${i}" ${ex.sets.length <= 1 ? 'disabled' : ''}>Quitar serie</button>
      </div>
    </article>`;
}

/** Nota fija del ejercicio: se ve cada vez que lo hacés. */
async function editNote(a, i) {
  const info = store.exercise(a.exercises[i].exerciseId);
  if (!info) return;
  const text = await promptText(`Nota para ${info.name}`, {
    value: info.note ?? '',
    placeholder: 'Ej: asiento en 4, agarre cerrado',
  });
  if (text == null) return;
  store.setExerciseNote(info.id, text);
  checkSave();
  replaceCard(a, i);
  toast(text.trim() ? 'Nota guardada' : 'Nota borrada');
}

/**
 * Cambiar un ejercicio en el momento (máquina ocupada). Ofrece primero los de la misma zona.
 * Si ya hay series hechas, esas quedan con el ejercicio original y las pendientes pasan al nuevo.
 */
function chooseSwap(a, i) {
  const current = a.exercises[i];
  const info = store.exercise(current.exerciseId);
  if (!info) return;
  const zone = muscleOf(info);
  const inWorkout = new Set(a.exercises.map((e) => e.exerciseId));
  const uses = (ex) => store.exerciseHistory(ex.id).length;
  const candidates = store
    .exercisesByGroup(info.group)
    .filter((ex) => !inWorkout.has(ex.id))
    .sort((x, y) => (muscleOf(y) === zone) - (muscleOf(x) === zone) || uses(y) - uses(x))
    .slice(0, 6);
  if (!candidates.length) return toast('No hay otros ejercicios de este grupo');

  openSheet(
    `Cambiar ${info.name}`,
    candidates.map((ex) => ({
      label: `${ex.name}${muscleLabel(ex) ? ` · ${muscleLabel(ex)}` : ''}`,
      run: () => {
        const done = current.sets.filter((s) => s.done);
        const pending = current.sets
          .filter((s) => !s.done)
          .map((s) => ({ weight: '', reps: s.reps, done: false }));
        const replacement = {
          exerciseId: ex.id,
          targetSets: current.targetSets,
          targetReps: current.targetReps,
          targetRepsPerSet: current.targetRepsPerSet,
          sets: pending.length ? pending : [{ weight: '', reps: String(current.targetReps), done: false }],
        };
        if (done.length) {
          current.sets = done; // lo hecho queda registrado con el ejercicio original
          a.exercises.splice(i + 1, 0, replacement);
        } else {
          a.exercises[i] = replacement;
        }
        store.persistActive();
        checkSave();
        rerenderKeepingScroll(renderWorkout);
        toast(`Cambiado por ${ex.name}`);
      },
    })),
  );
}

function toNum(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Progresión: si la última vez completaste todas las series con las reps objetivo,
 * sugiere subir el peso (2,5 kg, o 1 kg en pesos chicos). Si no, null.
 */
function suggestNext(ex, last) {
  if (last.length < ex.targetSets || last.some((s) => s.weight == null)) return null;
  for (let j = 0; j < ex.targetSets; j++) {
    if (last[j].reps < targetFor(ex, j)) return null;
  }
  const top = Math.max(...last.map((s) => s.weight));
  if (!top) return null;
  return top + (top >= 20 ? 2.5 : 1);
}

function replaceCard(a, i) {
  const card = root.querySelector(`[data-card="${i}"]`);
  if (card) card.outerHTML = exerciseCard(a, i);
}

function updateProgress() {
  const a = store.active();
  const el = document.getElementById('progress');
  if (!a || !el) return;
  const p = workoutProgress(a);
  el.textContent = `${p.done}/${p.total} series`;
}

async function finish(a) {
  const p = workoutProgress(a);
  if (p.done === 0) {
    const ok = await ask('No marcaste ninguna serie. ¿Salir sin guardar el entrenamiento?', {
      ok: 'Salir sin guardar',
      danger: true,
    });
    if (!ok) return;
    cancelBeep();
    store.discardWorkout();
    return navigate('/');
  }
  const pending = p.total - p.done;
  if (
    pending > 0 &&
    !(await ask(
      `Quedan ${pending} ${pending === 1 ? 'serie' : 'series'} sin marcar y no se van a guardar. ¿Terminar igual?`,
      { ok: 'Terminar' },
    ))
  ) {
    return;
  }
  cancelBeep();
  const w = store.finishWorkout();
  checkSave();
  navigate(w ? `/resumen/${w.id}` : '/');
}

// ---------- Resumen ----------

function workoutStats(w) {
  const volume = w.sets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0);
  return `
    <div class="stats">
      <div class="stat"><span class="stat-value">${fmtDuration(w.finishedAt - w.startedAt)}</span><span class="stat-label">Duración</span></div>
      <div class="stat"><span class="stat-value">${w.sets.length}</span><span class="stat-label">Series</span></div>
      <div class="stat"><span class="stat-value">${fmtNumber(Math.round(volume))}</span><span class="stat-label">kg totales</span></div>
    </div>`;
}

/** Series agrupadas por ejercicio, guardando el índice original de cada una. */
function setsByExercise(w) {
  const map = new Map();
  w.sets.forEach((s, index) => {
    if (!map.has(s.exerciseId)) map.set(s.exerciseId, []);
    map.get(s.exerciseId).push({ ...s, index });
  });
  return [...map];
}

function fmtWorkoutDate(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderSummary(id) {
  const w = store.workout(id);
  if (!w) return navigate('/');
  const records = w.sets.filter((s) => s.pr).length;

  root.innerHTML = `
    <header class="topbar"><h1 class="topbar-title">Resumen</h1></header>
    <main class="content">
      <div class="hero">
        <div class="hero-check">${ICONS.check}</div>
        <h2>¡Entrenamiento completo!</h2>
        <p>${esc(w.routineName)} · ${fmtWorkoutDate(w.startedAt)}</p>
        ${records ? `<p class="hero-pr">🏆 ${records === 1 ? '1 récord nuevo' : `${records} récords nuevos`}</p>` : ''}
      </div>
      ${workoutStats(w)}
      <ul class="summary-list">
        ${setsByExercise(w)
          .map(
            ([exId, sets]) => `
          <li class="card summary-item">
            <span class="summary-name">${esc(store.exercise(exId)?.name ?? 'Ejercicio')}</span>
            <span class="summary-sets">${sets.map((s) => `<span class="pill${s.pr ? ' pill-pr' : ''}">${s.pr ? '🏆 ' : ''}${fmtSet(s)}</span>`).join('')}</span>
          </li>`,
          )
          .join('')}
      </ul>
    </main>
    <div class="bottombar"><button class="btn btn-primary btn-block" data-action="home">Listo</button></div>`;

  root.oninput = null;
  root.onsubmit = null;
  root.onclick = (e) => {
    if (e.target.closest('[data-action="home"]')) navigate('/');
  };
}

// ---------- Entrenamiento pasado (ver, corregir, borrar) ----------

function renderPastWorkout(id) {
  const w = store.workout(id);
  if (!w) return navigate('/progreso');

  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Volver">${ICONS.back}</button>
      <div class="topbar-title">
        <h1>${esc(w.routineName)}</h1>
        <span class="topbar-sub">${fmtWorkoutDate(w.startedAt)}</span>
      </div>
    </header>
    <main class="content">
      ${workoutStats(w)}
      <p class="hint hint-left">Tocá un número para corregirlo. Se guarda solo.</p>
      ${setsByExercise(w)
        .map(
          ([exId, sets]) => `
        <article class="card ex-card">
          <h2 class="ex-title">${esc(store.exercise(exId)?.name ?? 'Ejercicio')}</h2>
          <div class="sets">
            <div class="set-row set-head" aria-hidden="true"><span>Serie</span><span>kg</span><span>Reps</span><span></span></div>
            ${sets
              .map(
                (s, k) => `
              <div class="set-row">
                <span class="set-num">${s.pr ? '🏆' : k + 1}</span>
                <input class="num" inputmode="decimal" data-edit="weight" data-index="${s.index}" value="${s.weight != null ? fmtNumber(s.weight) : ''}" placeholder="—" aria-label="Peso serie ${k + 1}">
                <input class="num" inputmode="numeric" data-edit="reps" data-index="${s.index}" value="${s.reps}" aria-label="Repeticiones serie ${k + 1}">
                <button class="check-btn remove-btn" data-action="remove-past-set" data-index="${s.index}" aria-label="Borrar serie ${k + 1}">${ICONS.close}</button>
              </div>`,
              )
              .join('')}
          </div>
        </article>`,
        )
        .join('')}
      <button class="btn btn-danger btn-block" data-action="delete-workout">${ICONS.trash}Eliminar entrenamiento</button>
    </main>`;

  root.onsubmit = null;
  root.oninput = null;
  // Guardar al salir del casillero (así no se recalcula nada mientras escribís).
  root.onchange = (e) => {
    const el = e.target;
    if (!el.dataset.edit) return;
    store.updateWorkoutSet(w.id, +el.dataset.index, el.dataset.edit, el.value);
    checkSave();
    toast('Corregido');
  };
  root.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'back':
        return goBack();
      case 'remove-past-set': {
        const ok = await ask('¿Borrar esta serie del entrenamiento?', { ok: 'Borrar serie', danger: true });
        if (!ok) return;
        const gone = store.removeWorkoutSet(w.id, +btn.dataset.index);
        checkSave();
        if (gone) {
          toast('Entrenamiento eliminado');
          return navigate('/progreso');
        }
        return rerenderKeepingScroll(() => renderPastWorkout(id));
      }
      case 'delete-workout': {
        const ok = await ask('¿Eliminar este entrenamiento? Se borra del historial y de tu progreso.', {
          ok: 'Eliminar entrenamiento',
          danger: true,
        });
        if (!ok) return;
        store.deleteWorkout(w.id);
        checkSave();
        toast('Entrenamiento eliminado');
        return navigate('/progreso');
      }
    }
  };
}

// ---------- Rutina para hoy (generada) ----------

// rest / sets null = sugerido. Se recuerdan entre usos (menos el enfoque, que cambia cada día).
const genOptions = {
  intensity: 'heavy',
  duration: 'medium',
  rest: null,
  sets: null,
  ...store.settings().generator,
  focus: [],
};
let plan = null;

function rememberGenOptions() {
  const { intensity, duration, rest, sets } = genOptions;
  store.updateSettings({ generator: { intensity, duration, rest, sets } });
}

function openGenerator() {
  plan = generatePlan(genOptions);
  renderGenerator();
}

function segmented(name, options, current) {
  return `
    <div class="segmented" role="group">
      ${Object.entries(options)
        .map(
          ([key, opt]) => `
        <button class="seg-btn" data-action="option" data-name="${name}" data-value="${key}" aria-pressed="${key === current}">
          <span>${opt.label}</span>${opt.hint ? `<small>${opt.hint}</small>` : ''}
        </button>`,
        )
        .join('')}
    </div>`;
}

function renderGenerator() {
  const focusChips =
    `<button class="chip" data-action="focus-auto" aria-pressed="${!genOptions.focus.length}">${ICONS.spark}Automático</button>` +
    store
      .groups()
      .map(
        (g) =>
          `<button class="chip" data-action="focus" data-group="${g.id}" aria-pressed="${genOptions.focus.includes(g.id)}">${esc(g.label)}</button>`,
      )
      .join('');

  const setsChips =
    `<button class="chip" data-action="sets-opt" data-value="" aria-pressed="${genOptions.sets == null}">Sugerido · ${suggestedSetsLabel(genOptions.intensity, genOptions.duration)}</button>` +
    [2, 3, 4]
      .map(
        (n) =>
          `<button class="chip" data-action="sets-opt" data-value="${n}" aria-pressed="${genOptions.sets === n}">${n} series</button>`,
      )
      .join('');

  const suggestedRest = INTENSITIES[genOptions.intensity].restSeconds;
  const restChips =
    `<button class="chip" data-action="rest-opt" data-value="" aria-pressed="${genOptions.rest == null}">Sugerido · ${fmtRest(suggestedRest)}</button>` +
    REST_OPTIONS.filter((s) => s > 0)
      .map(
        (s) =>
          `<button class="chip" data-action="rest-opt" data-value="${s}" aria-pressed="${genOptions.rest === s}">${fmtRest(s)}</button>`,
      )
      .join('');

  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Volver">${ICONS.back}</button>
      <h1 class="topbar-title">Rutina para hoy</h1>
    </header>
    <main class="content">
      <div class="field">
        <span class="label">Intensidad</span>
        ${segmented('intensity', INTENSITIES, genOptions.intensity)}
      </div>
      <div class="field">
        <span class="label">Duración</span>
        ${segmented('duration', DURATIONS, genOptions.duration)}
      </div>
      <div class="field">
        <span class="label">Series por ejercicio</span>
        <div class="chips">${setsChips}</div>
      </div>
      <div class="field">
        <span class="label">Descanso entre series</span>
        <div class="chips">${restChips}</div>
      </div>
      <div class="field">
        <span class="label">Enfoque</span>
        <div class="chips">${focusChips}</div>
      </div>

      <article class="card plan">
        <p class="plan-reason">${ICONS.spark}<span>${esc(plan.reason)}</span></p>
        <h2 class="plan-title">${esc(plan.name)}</h2>
        <p class="plan-meta">${INTENSITIES[plan.intensity].label} · ≈ ${fmtDuration(plan.minutes * 60000)} · ${plan.items.length} ejercicios · descanso ${fmtRest(plan.restSeconds)}</p>
        <ol class="plan-list">
          ${plan.items
            .map((it, i) => {
              const ex = store.exercise(it.exerciseId);
              return `
              <li class="plan-item">
                <span class="order-num">${i + 1}</span>
                <span class="order-name">${esc(ex?.name ?? 'Ejercicio')}<small>${esc(exerciseZone(ex))}${
                  it.weight != null ? ` · sugerido ${fmtNumber(it.weight)} kg` : ''
                }</small></span>
                <span class="plan-sets">${fmtTarget(it.sets, it.reps, it.repsPerSet)}</span>
                <button class="icon-btn plan-remove" data-action="plan-remove" data-index="${i}" aria-label="Quitar ${esc(ex?.name ?? 'ejercicio')}" ${plan.items.length <= 1 ? 'disabled' : ''}>${ICONS.close}</button>
              </li>`;
            })
            .join('')}
        </ol>
        <div class="plan-actions">
          <button class="link-btn" data-action="plan-add">${ICONS.plus}Agregar ejercicio</button>
          <button class="link-btn muted" data-action="save-plan">Guardar como rutina</button>
        </div>
      </article>
    </main>
    <div class="bottombar bottombar-split">
      <button class="btn btn-secondary" data-action="reroll">Otra opción</button>
      <button class="btn btn-primary" data-action="start-plan">Empezar</button>
    </div>`;

  root.oninput = null;
  root.onsubmit = null;
  root.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'back':
        return navigate('/');
      case 'option':
        genOptions[btn.dataset.name] = btn.dataset.value;
        rememberGenOptions();
        return regenerate();
      case 'focus-auto':
        genOptions.focus = [];
        return regenerate();
      case 'rest-opt':
        genOptions.rest = btn.dataset.value ? Number(btn.dataset.value) : null;
        rememberGenOptions();
        return regenerate();
      case 'sets-opt':
        genOptions.sets = btn.dataset.value ? Number(btn.dataset.value) : null;
        rememberGenOptions();
        return regenerate();
      case 'focus': {
        const g = btn.dataset.group;
        genOptions.focus = genOptions.focus.includes(g)
          ? genOptions.focus.filter((x) => x !== g)
          : [...genOptions.focus, g];
        return regenerate();
      }
      case 'plan-remove': {
        if (plan.items.length <= 1) return;
        const [removed] = plan.items.splice(+btn.dataset.index, 1);
        recalcMinutes(plan);
        rerenderKeepingScroll(renderGenerator);
        return toast(`Quitado: ${store.exercise(removed.exerciseId)?.name ?? 'ejercicio'}`);
      }
      case 'plan-add':
        return choosePlanAddition();
      case 'reroll':
        regenerate(3);
        return toast('Otra combinación, mismas zonas');
      case 'save-plan':
        store.saveRoutine({
          id: store.uid(),
          name: plan.name,
          groups: plan.groups,
          items: plan.items.map(({ exerciseId, sets, reps }) => ({ exerciseId, sets, reps })),
        });
        checkSave();
        toast('Rutina guardada');
        return navigate('/');
      case 'start-plan': {
        const a = store.active();
        if (a) {
          const ok = await ask(`Tenés un entrenamiento de "${a.routineName}" en curso. ¿Descartarlo y empezar este?`, {
            ok: 'Descartar y empezar',
            danger: true,
          });
          if (!ok) return;
        }
        store.startWorkoutFromPlan(plan);
        checkSave();
        return navigate('/entrenar');
      }
    }
  };
}

/** Agregar un ejercicio a la rutina generada: primero los que cubren zonas que faltan. */
function choosePlanAddition(groupId = null) {
  const candidates = additionCandidates(plan, groupId);
  const add = (ex) => () => {
    plan.items.push(planItem(plan, ex.id));
    if (!plan.groups.includes(ex.group)) plan.groups.push(ex.group);
    recalcMinutes(plan);
    rerenderKeepingScroll(renderGenerator);
    toast(`Agregado: ${ex.name}`);
  };
  const actions = candidates.map((ex) => ({
    label: `${ex.name} · ${exerciseZone(ex)}`,
    run: add(ex),
  }));
  if (!groupId) {
    actions.push({
      label: 'Elegir de otro grupo…',
      run: () =>
        openSheet(
          'Elegí el grupo',
          store.groups().map((g) => ({ label: g.label, run: () => choosePlanAddition(g.id) })),
        ),
    });
  }
  if (!candidates.length && groupId) return toast('Ya están todos los ejercicios de ese grupo');
  openSheet(groupId ? `Agregar de ${groupLabel(groupId)}` : 'Agregar ejercicio', actions);
}

/** variety > 0 cambia qué ejercicio va en cada zona; 0 da siempre la misma rutina para las mismas opciones. */
function regenerate(variety = 0) {
  plan = generatePlan({ ...genOptions, variety });
  rerenderKeepingScroll(renderGenerator);
}

// ---------- Progreso ----------

let progressTab = 'exercises'; // 'exercises' | 'workouts'

function renderProgress() {
  const list = store.exercisesWithHistory();
  const workouts = [...store.workouts()].sort((a, b) => b.startedAt - a.startedAt);

  const tabs = list.length
    ? segmented(
        'tab',
        { exercises: { label: 'Ejercicios' }, workouts: { label: 'Entrenamientos' } },
        progressTab,
      )
    : '';

  const workoutsList = `
    <ul class="routine-list">
      ${workouts
        .map((w) => {
          const exercises = new Set(w.sets.map((s) => s.exerciseId)).size;
          const records = w.sets.filter((s) => s.pr).length;
          return `
          <li class="card">
            <button class="progress-item" data-action="open-workout" data-id="${w.id}">
              <span class="progress-text">
                <span class="routine-name">${esc(w.routineName)}</span>
                <span class="routine-sub">${relativeDay(w.startedAt)} · ${exercises} ${exercises === 1 ? 'ejercicio' : 'ejercicios'} · ${w.sets.length} series${
                  records ? ` · 🏆 ${records}` : ''
                }</span>
              </span>
              ${ICONS.chevron}
            </button>
          </li>`;
        })
        .join('')}
    </ul>`;

  const exercisesList = list.length
    ? `<ul class="routine-list">
        ${list
          .map(({ exercise: ex, lastDate }) => {
            const all = store.exerciseHistory(ex.id).flatMap((h) => h.sets);
            return `
            <li class="card">
              <button class="progress-item" data-action="open" data-id="${ex.id}">
                <span class="progress-text">
                  <span class="routine-name">${esc(ex.name)}</span>
                  <span class="routine-sub">${esc(exerciseZone(ex))} · Mejor: ${fmtSet(topSet(all))} · ${relativeDay(lastDate)}</span>
                </span>
                ${ICONS.chevron}
              </button>
            </li>`;
          })
          .join('')}
      </ul>`
    : `<div class="empty">
        <div class="empty-icon">${ICONS.dumbbell}</div>
        <h2>Todavía no hay progreso</h2>
        <p>Cuando termines tu primer entrenamiento, acá vas a ver cómo evoluciona cada ejercicio.</p>
      </div>`;

  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Volver">${ICONS.back}</button>
      <h1 class="topbar-title">Progreso</h1>
    </header>
    <main class="content">
      ${tabs}
      ${list.length && progressTab === 'workouts' ? workoutsList : exercisesList}
    </main>`;

  root.oninput = null;
  root.onsubmit = null;
  root.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'back':
        return navigate('/');
      case 'option':
        progressTab = btn.dataset.value;
        return renderProgress();
      case 'open':
        return navigate(`/ejercicio/${btn.dataset.id}`);
      case 'open-workout':
        return navigate(`/entrenamiento/${btn.dataset.id}`);
    }
  };
}

function renderExercise(id) {
  const info = store.exercise(id);
  if (!info) return navigate('/');
  const hist = store.exerciseHistory(id);
  const all = hist.flatMap((h) => h.sets);
  const useWeight = all.some((s) => s.weight != null);
  const unit = useWeight ? 'kg' : 'reps';
  const points = hist.slice(-12).map((h) => {
    const t = topSet(h.sets);
    return { date: h.date, value: useWeight ? t.weight ?? 0 : t.reps };
  });

  let body;
  if (!hist.length) {
    body = '<p class="hint">Todavía no hiciste este ejercicio. Cuando lo registres, vas a ver acá su evolución.</p>';
  } else {
    const best = topSet(all);
    body = `
      <div class="stats">
        <div class="stat"><span class="stat-value">${fmtSet(best)}</span><span class="stat-label">Mejor serie</span></div>
        <div class="stat"><span class="stat-value">${hist.length}</span><span class="stat-label">Sesiones</span></div>
        <div class="stat"><span class="stat-value">${relativeDay(hist[hist.length - 1].date)}</span><span class="stat-label">Última vez</span></div>
      </div>
      <div class="card chart-card">
        <p class="chart-title">Mejor serie de cada sesión (${unit})</p>
        ${
          points.length >= 2
            ? lineChart(points, unit)
            : '<p class="hint">Entrená este ejercicio al menos 2 veces para ver la evolución.</p>'
        }
      </div>
      <h2 class="section-title">Sesiones</h2>
      <ul class="summary-list">
        ${[...hist]
          .reverse()
          .map(
            (h) => `
          <li class="card summary-item">
            <span class="summary-name">${new Date(h.date).toLocaleDateString('es-AR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}</span>
            <span class="summary-sets">${h.sets.map((s) => `<span class="pill">${fmtSet(s)}</span>`).join('')}</span>
          </li>`,
          )
          .join('')}
      </ul>`;
  }

  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Volver">${ICONS.back}</button>
      <div class="topbar-title">
        <h1>${esc(info.name)}</h1>
        <span class="topbar-sub">${esc(exerciseZone(info))}</span>
      </div>
    </header>
    <main class="content">${info.note ? `<p class="ex-note ex-note-page">${esc(info.note)}</p>` : ''}${body}</main>`;

  root.oninput = null;
  root.onsubmit = null;
  root.onclick = (e) => {
    if (e.target.closest('[data-action="back"]')) goBack();
  };
}

/** Gráfico de línea simple en SVG. points: [{ date, value }] */
function lineChart(points, unit) {
  const W = 320;
  const H = 160;
  const pad = { l: 40, r: 14, t: 14, b: 26 };
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución en ${unit}: de ${fmtNumber(values[0])} a ${fmtNumber(values[last])}">
      <line class="chart-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(max)}" y2="${y(max)}"/>
      <line class="chart-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(min)}" y2="${y(min)}"/>
      <text class="chart-label" x="${pad.l - 8}" y="${y(max) + 4}" text-anchor="end">${fmtNumber(max)}</text>
      <text class="chart-label" x="${pad.l - 8}" y="${y(min) + 4}" text-anchor="end">${fmtNumber(min)}</text>
      <polyline class="chart-line" points="${line}"/>
      ${points
        .map((p, i) => `<circle class="chart-dot${i === last ? ' last' : ''}" cx="${x(i)}" cy="${y(p.value)}" r="${i === last ? 4.5 : 3}"/>`)
        .join('')}
      <text class="chart-label" x="${x(0)}" y="${H - 6}" text-anchor="start">${fmtShortDate(points[0].date)}</text>
      <text class="chart-label" x="${x(last)}" y="${H - 6}" text-anchor="end">${fmtShortDate(points[last].date)}</text>
    </svg>`;
}

// ---------- Arranque ----------

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker no registrado', err));
  });
}
// Pedirle al navegador que no borre los datos si le falta espacio.
navigator.storage?.persist?.().catch(() => {});
