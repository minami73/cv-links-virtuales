/* ============================================================
   Núcleo compartido: estado, carga de datos y tarjetas de horario.
   Lo usan tanto index.html (vía home.js) como grupo.html (vía grupo.js).
   ============================================================ */

const state = {
    rows: [],          // normalized rows from CSV (or sample)
    source: "sample",  // "sample" | "sheet" | "error"
    lastUpdated: null  // Date — última vez que se intentó cargar la hoja
};

async function loadData() {
    state.lastUpdated = new Date();
    if (!SHEET_CSV_URL || SHEET_CSV_URL.trim() === "") {
        state.rows = normalizeRows(SAMPLE_ROWS);
        state.source = "sample";
        setStatus("sample");
        return;
    }
    setStatus("loading");
    try {
        const resp = await fetch(SHEET_CSV_URL, { cache: "no-store" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const text = await resp.text();
        const parsed = parseCSV(text);
        if (!parsed.length) throw new Error("empty");
        state.rows = normalizeRows(parsed);
        state.source = "sheet";
        setStatus("live");
    } catch (err) {
        console.warn("No se pudo cargar la hoja:", err);
        state.rows = normalizeRows(SAMPLE_ROWS);
        state.source = "error";
        setStatus("error");
    }
}

function setStatus(mode) {
    const dot = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    dot.className = "dot";
    if (mode === "live") { text.textContent = "Datos en vivo"; }
    else if (mode === "sample") { text.textContent = "Datos de ejemplo"; dot.classList.add("is-warn"); }
    else if (mode === "loading") { text.textContent = "Cargando…"; dot.classList.add("is-warn"); }
    else if (mode === "error") { text.textContent = "Sin conexión a la hoja"; dot.classList.add("is-err"); }
}

/* ============================================================
   "Actualizado hace X" — para que dirección sepa qué tan fresca
   es la información antes de compartirla. Se recalcula cada
   30s para que el texto avance solo, sin recargar la página.
   ============================================================ */
function formatRelativeTime(date) {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "justo ahora";
    if (minutes === 1) return "hace 1 min";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? "hace 1 h" : `hace ${hours} h`;
}

function renderStatusTime() {
    const el = document.getElementById("statusTime");
    if (!el || !state.lastUpdated) return;
    el.textContent = `· Actualizado ${formatRelativeTime(state.lastUpdated)}`;
}

function startStatusTimeTicker() {
    renderStatusTime();
    setInterval(renderStatusTime, 30000);
}

/* ============================================================
   Render — detalle de UN grupo (usado por grupo.html)
   `els` = { badge, title, date, count, scheduleHost } referencias al DOM
   ============================================================ */
function dayLabelForRows(rows) {
    return (rows.find(r => r.dia) || {}).dia || getTodayDiaLabel();
}

function renderGroupDetail(groupId, els) {
    const group = GROUPS.find(g => g.id === groupId);
    if (!group) return;

    els.badge.textContent = group.display;
    els.title.textContent = `${group.longName} · ${group.display}`;

    const rows = state.rows.filter(r => r.grupoId === groupId);

    const dayLabel = dayLabelForRows(rows);
    els.date.textContent = capitalize(dayLabel);

    const blocks = scheduleForGrade(group.grade, dayLabel);

    const host = els.scheduleHost;
    host.innerHTML = "";

    if (state.source === "error" && rows.length === 0) {
        els.count.textContent = "";
        host.appendChild(buildErrorNotice());
        return;
    }

    if (rows.length === 0) {
        els.count.textContent = "";
        host.appendChild(buildEmptyNotice(group));
        return;
    }

    const byTime = {};
    rows.forEach(r => { if (r.hora_inicio) byTime[r.hora_inicio] = r; });

    const classBlocks = blocks.filter(b => !b.recess && !isFreeSlot(byTime[b.from]));

    els.count.textContent = classBlocks.length === 1 ? "1 clase en agenda" : `${classBlocks.length} clases en agenda`;

    if (classBlocks.length === 0) {
        host.appendChild(buildAllFreeNotice(group));
        return;
    }

    const list = document.createElement("div");
    list.className = "schedule";

    const firstFrom = classBlocks[0].from;
    const lastFrom = classBlocks[classBlocks.length - 1].from;

    blocks.forEach(block => {
        if (block.recess) {
            if (block.from > firstFrom && block.from < lastFrom) {
                list.appendChild(buildRecess(block));
            }
        } else if (!isFreeSlot(byTime[block.from])) {
            const row = byTime[block.from] || null;
            list.appendChild(buildClassCard(block, row));
        }
    });

    host.appendChild(list);

    if (state.source === "error") {
        host.insertBefore(buildSoftErrorNotice(), list);
    }
}

function buildClassCard(block, row) {
    const el = document.createElement("article");
    el.className = "class-card";

    const platform = row ? detectPlatform(row.link) : null;
    const has = row && row.link;

    el.innerHTML = `
    <div class="class-card__time">
      <span class="from">${block.from}</span>
      <span class="to">a ${block.to}</span>
      <span class="dur">${blockMinutes(block)} min</span>
    </div>
    <div class="class-card__body">
      <div class="class-card__row">
        <h3 class="class-card__subject">${row ? escapeHTML(row.materia || "—") : "—"}</h3>
        <p class="class-card__teacher">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>
          <span>${row ? escapeHTML(row.profesor || "Profesor por confirmar") : "Profesor por confirmar"}</span>
        </p>
      </div>
      <div class="class-card__action">
        ${has
            ? `<a class="btn-join is-coral" href="${escapeAttr(row.link)}" target="_blank" rel="noopener noreferrer">
               <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 4 21 12 3 20 3 14 14 12 3 10 3 4" fill="currentColor" stroke="none"/></svg>
               <span>Ir a la clase</span>
             </a>
             ${platform ? `<span class="platform-tag is-${platform}">${platformLabel(platform)}</span>` : ""}`
            : `<span class="btn-pending" aria-disabled="true">Pendiente</span>`
        }
      </div>
    </div>
  `;
    return el;
}

function buildRecess(block) {
    const el = document.createElement("div");
    el.className = "recess";
    el.innerHTML = `
    <div class="recess__time">
      <span class="from">${block.from}</span>
      <span class="to">a ${block.to}</span>
    </div>
    <div class="recess__body">
      <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h11a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H4z"/><path d="M16 12h2a2 2 0 0 1 0 4h-2"/><path d="M7 4v2"/><path d="M11 4v2"/></svg>
      <div>
        <strong>Receso</strong> · ${blockMinutes(block)} minutos
      </div>
    </div>
  `;
    return el;
}

function buildErrorNotice() {
    const el = document.createElement("div");
    el.className = "notice";
    el.innerHTML = `
    <div class="notice__icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/></svg>
    </div>
    <div>
      <p class="notice__title">No se pudieron cargar las clases</p>
      <p class="notice__text">Por favor verifica tu conexión o intenta de nuevo en unos minutos. Si el problema continúa, escríbenos al WhatsApp del colegio.</p>
    </div>
  `;
    return el;
}

function buildSoftErrorNotice() {
    const el = document.createElement("div");
    el.className = "notice";
    el.style.marginBottom = "14px";
    el.innerHTML = `
    <div class="notice__icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
    </div>
    <div>
      <p class="notice__title">Mostrando información de respaldo</p>
      <p class="notice__text">No pudimos contactar la hoja de cálculo. Los datos podrían no estar al día — confirma con coordinación si tienes dudas.</p>
    </div>
  `;
    return el;
}

function buildAllFreeNotice(group) {
    const el = document.createElement("div");
    el.className = "notice";
    el.innerHTML = `
    <div class="notice__icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
    </div>
    <div>
      <p class="notice__title">Hoy no hay clases virtuales para ${escapeHTML(group.display)}</p>
      <p class="notice__text">Este grupo no tiene clases en línea programadas para hoy. Si esperabas una clase, contacta a coordinación.</p>
    </div>
  `;
    return el;
}

function buildEmptyNotice(group) {
    const el = document.createElement("div");
    el.className = "notice";
    el.innerHTML = `
    <div class="notice__icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
    </div>
    <div>
      <p class="notice__title">Sin clases programadas para ${escapeHTML(group.display)}</p>
      <p class="notice__text">Aún no hay clases virtuales cargadas para este grupo. Si esperabas ver clases hoy, contacta a coordinación.</p>
    </div>
  `;
    return el;
}
