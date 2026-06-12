# Enlaces de Clases Virtuales — Colegio Victoria (Primaria)

Aplicación web estática para centralizar los enlaces de clases virtuales de
primaria. Los padres abren el enlace de su grupo y ven el horario del día con
botón directo a cada clase (Zoom/Meet/Teams), sin buscar en WhatsApp.

## Arquitectura

```
index.html          — Vista general con los 12 grupos (1°A–6°B)
grupo.html?k=<tok>  — Vista individual de un grupo (lo que reciben los papás)
config.js           — Config: URL del CSV, horarios, grupos, tokens, datos de ejemplo
app.js              — Núcleo: carga de datos, render de horario, tarjetas de clase
utils.js            — Parseo de CSV, normalización, detección de plataforma
home.js             — Render del grid de grupos en index.html
grupo.js            — Lógica de grupo.html: resuelve token, muestra horario
styles.css          — Todos los estilos (sin frameworks)
```

## Flujo de datos

1. Los docentes registran su enlace en una **hoja de Google Sheets**
   (una fila por clase: grado, día, hora, materia, profesor, link).
2. La hoja se publica como CSV (`Archivo → Compartir → Publicar en la Web`).
3. La URL del CSV se configura en `SHEET_CSV_URL` dentro de `config.js`.
4. Si la carga del CSV falla o la URL está vacía, se usan datos de ejemplo
   (`SAMPLE_ROWS`) para pruebas.

### Columnas de la hoja: cuáles son rígidas y cuáles libres

| Columna | Tipo | Detalle |
|---|---|---|
| `grado` | **Rígida** | Debe normalizar a un grupo válido (`1A`...`6B`). Acepta variantes como `1°A`, `1 A`, `1ºA`, pero el grado debe ser 1-6 y la sección A o B. |
| `hora_inicio` | **Rígida** | Debe coincidir, en formato `HH:MM`, con uno de los horarios fijos de `SCHEDULE_BLOCKS` (`config.js`): `08:00, 08:45, 09:30, 10:15, 11:30, 12:15, 13:00, 13:45`. Es la clave que usa la página para ubicar tu fila en el horario del día. |
| `dia` | Libre | Ver convención arriba — se muestra tal cual si tiene contenido. |
| `hora_fin` | Libre | No se usa para nada: la hora de término que ve el papá siempre sale del bloque fijo en `SCHEDULE_BLOCKS`, no de esta columna. Se puede dejar vacía. |
| `materia`, `profesor` | Libre | Texto que se muestra tal cual en la tarjeta de la clase. |
| `link` | Libre | Si está vacío, la clase se muestra como "Pendiente". |

### Convención para la columna `dia`

Esta columna define **qué fecha se muestra en la página del grupo** (si está
vacía, se usa la fecha real del dispositivo del papá como respaldo). Como la
hoja suele llenarse con anticipación —por ejemplo, el lunes se cargan los
enlaces para la clase virtual del martes—, **debe escribirse el día PARA EL
QUE es el horario, no el día en que se llena la hoja**, y siempre con el
formato completo `[día de la semana] [día del mes] de [mes]`
(ej. `Martes 9 de junio`). Así el papá ve la fecha correcta sin importar si
abre el enlace el día que se publicó o el día de la clase.

## Seguridad por token

Cada grupo tiene un token ofuscado (ej. `k7m4p9xz` → 1°A). Los padres reciben
solo el enlace de su grupo; no pueden adivinar el de otro. Al ser estático,
esto frena a un curioso, no a alguien con conocimientos técnicos.

`index.html` (el listado completo de los 12 grupos, pensado solo para
dirección/coordinación) **también exige un token** vía `?k=<DIRECTOR_TOKEN>`
(`config.js`). Sin él, se muestra un aviso de acceso restringido — así nadie
llega al listado completo solo escribiendo `index.html` en el navegador; hace
falta el enlace que dirección comparte de forma privada.

## Estado actual

- URL del CSV configurada y apuntando a la hoja real.
- Diseño responsive, soporta Zoom/Meet/Teams.
- Sin frameworks ni backend — HTML, CSS y JS vanilla.
