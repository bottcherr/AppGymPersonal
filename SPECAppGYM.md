# App de gimnasio – Especificación

## Qué es

Una app de gimnasio para uso personal, minimalista pero con aspecto profesional. Sirve para armar rutinas y registrar cada entrenamiento desde el celular, sin depender de internet.

El objetivo del proyecto es también aprender a crear apps, así que se construye primero un MVP (versión mínima que ya sirva de verdad) y después se suman funciones de a una.

## Principios

- **Minimalismo:** nada que no se use en el gimnasio. Interfaz limpia, pocos toques por acción.
- **Pensada para el celular:** se usa con una mano, entre series, con poca atención disponible.
- **Offline desde el día uno:** todos los datos se guardan en el dispositivo.

---

## MVP (primera versión)

### 1. Pantalla de inicio

- Si no hay rutinas creadas, muestra una invitación clara a crear la primera.
- Si hay rutinas, muestra la lista para elegir una y empezar a entrenar.
- Siempre hay un botón para crear una rutina nueva.

### 2. Crear rutina

1. Se le pone un nombre (por ejemplo, "Push" o "Día de piernas").
2. Se eligen uno o más grupos musculares para combinar: **pecho, espalda, bíceps, tríceps, hombro y piernas**.
3. La app muestra ejercicios recomendados de los grupos elegidos y se marcan los que se quieren.
4. Si falta un ejercicio, se escribe a mano indicando a qué grupo muscular pertenece. Los ejercicios escritos a mano **quedan guardados** y aparecen en la lista las próximas veces.
5. Para cada ejercicio se definen las **series y repeticiones objetivo** (por ejemplo, 4 × 10).

El peso **no** se define en la rutina; se carga al entrenar.

### 3. Entrenar

- Se elige una rutina y se ven sus ejercicios con las series ya armadas según el plan.
- En cada serie se carga el **peso** en el momento.
- Al lado de cada ejercicio se muestra lo que se hizo **la última vez** (por ejemplo, "Última vez: 60 kg × 10"). Con un toque se puede usar ese valor como base.
- Si las repeticiones reales fueron distintas a las planeadas, se corrigen antes de marcar la serie.
- Cada serie se marca como **hecha**.
- Se guarda lo que realmente se hizo, no solo lo planeado.

### 4. Datos

- Todo se guarda en el dispositivo y funciona sin conexión.
- Se guardan: rutinas, ejercicios (recomendados y propios) y el registro de cada entrenamiento con sus series (ejercicio, repeticiones, peso, fecha).

### Ejercicios recomendados iniciales

Lista corta para arrancar (se puede ampliar después):

- **Pecho:** press banca, press inclinado con mancuernas, aperturas, fondos, cruce de poleas.
- **Espalda:** dominadas, remo con barra, jalón al pecho, remo con mancuerna, remo en polea baja.
- **Bíceps:** curl con barra, curl con mancuernas, curl martillo, curl en banco Scott.
- **Tríceps:** press francés, extensión en polea, fondos en banco, patada de tríceps.
- **Hombro:** press militar, elevaciones laterales, elevaciones frontales, pájaros (deltoides posterior).
- **Piernas:** sentadilla, prensa, peso muerto rumano, extensión de cuádriceps, curl femoral, gemelos.

---

## Detalles a definir sobre la marcha

- Editar y borrar rutinas.
- Qué pasa al terminar un entrenamiento (resumen, confirmación, etc.).
- Agregar o quitar series durante el entrenamiento.

---

## Para después (no entra en el MVP)

En el orden que convenga:

1. **Temporizador de descanso automático:** al marcar una serie como hecha arranca el descanso (tiempo elegido por el usuario). Se muestra como una barra de progreso sutil en el borde superior que cambia de color cuando es hora de volver. Idealmente con vibración o sonido.
2. **Calculadora de discos:** botón al lado del peso que muestra qué discos poner de cada lado de la barra (con peso de barra y discos disponibles configurables).
3. **Registro de esfuerzo (RPE):** tres botones por serie: verde (sobrado), amarillo (justo), rojo (al fallo), con ícono o letra además del color.
4. **Etiquetas por disciplina:** categorizar rutinas (hipertrofia, fuerza explosiva, pliometría, etc.). Tener en cuenta ejercicios que no se miden en kilos (saltos, tiempo).
5. **Historial y progreso:** ver entrenamientos pasados y la evolución por ejercicio.
6. **Backup:** exportar e importar los datos a un archivo.
7. **Sincronización con servidor:** subir los datos cuando vuelve la conexión.

## Criterio para sumar funciones

Antes de agregar algo, preguntarse: *"¿puedo entrenar y anotar sin esto?"*. Si la respuesta es sí, va a la lista de "para después".
