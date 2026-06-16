/* ============================================================
   Router único — maneja index.html para todos los usuarios:
   · Token de dirección  → vista con los 12 grupos
   · Token de grupo      → vista del horario de ese grupo
   · Sin token / inválido → vista de acceso restringido
   ============================================================ */

function renderHome() {
    const today = new Date();
    document.getElementById("todayDay").textContent = getTodayShortDay(today);
    document.getElementById("todayDate").textContent = capitalize(getTodayDiaLabel(today));

    /* Botón "Abrir hoja de cálculo" — solo aparece si SHEET_EDIT_URL
       está configurada en config.js. Abre la hoja editable, no el CSV. */
    const sheetBtn = document.getElementById("sheetEditLink");
    if (sheetBtn && typeof SHEET_EDIT_URL === "string" && SHEET_EDIT_URL.trim()) {
        sheetBtn.href = SHEET_EDIT_URL.trim();
        sheetBtn.hidden = false;
    }

    const host = document.getElementById("groupsGrid");
    host.innerHTML = "";
    GROUPS.forEach(group => {
        const token = tokenForGroup(group.id);
        const a = document.createElement("a");
        a.className = "group-btn";
        a.href = `?k=${token}`;
        a.setAttribute("role", "listitem");
        a.setAttribute("data-group", group.id);
        a.setAttribute("aria-label", `Ver clases del grupo ${group.display}`);
        a.innerHTML = `
      <span class="group-btn__pending" data-pending-for="${group.id}"></span>
      <div class="group-btn__grade">
        ${group.grade}<span class="sup">°</span><span class="sec">${group.section}</span>
      </div>
      <div class="group-btn__label">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
        <span>Ver clases</span>
      </div>
    `;
        host.appendChild(a);
    });
}

/* ============================================================
   Conteo de "Pendiente" por grupo — clases del horario fijo que
   aún no tienen enlace cargado en la hoja. Solo tiene sentido
   llamarlo después de loadData(), cuando state.rows ya está listo.
   ============================================================ */
function countPending(groupId) {
    const rows = state.rows.filter(r => r.grupoId === groupId);
    const byTime = {};
    rows.forEach(r => { if (r.hora_inicio) byTime[r.hora_inicio] = r; });

    return SCHEDULE_BLOCKS
        .filter(block => !block.recess)
        .filter(block => {
            const row = byTime[block.from];
            return !(row && row.link);
        }).length;
}

function renderPendingBadges() {
    document.querySelectorAll(".group-btn__pending").forEach(badge => {
        const groupId = badge.getAttribute("data-pending-for");
        const pending = countPending(groupId);
        if (pending > 0) {
            badge.textContent = pending === 1 ? "1 pendiente" : `${pending} pendientes`;
            badge.classList.add("is-visible");
        } else {
            badge.textContent = "";
            badge.classList.remove("is-visible");
        }
    });
}

/* ============================================================
   Lista de enlaces para compartir — pensada para coordinación:
   un lugar único con la URL completa de cada grupo, lista para
   copiar y pegar en WhatsApp/Classroom.
   ============================================================ */
function renderLinkList() {
    const host = document.getElementById("linkList");
    if (!host) return;
    host.innerHTML = "";

    GROUPS.forEach(group => {
        const token = tokenForGroup(group.id);
        const url = (typeof PUBLIC_BASE_URL === "string" && PUBLIC_BASE_URL.trim())
            ? `${PUBLIC_BASE_URL.trim()}?k=${token}`
            : new URL(`?k=${token}`, window.location.href).href;

        const row = document.createElement("div");
        row.className = "link-row";
        row.innerHTML = `
      <span class="link-row__group">${group.display}</span>
      <span class="link-row__url">${escapeHTML(url)}</span>
      <button class="link-row__copy" type="button" data-url="${escapeAttr(url)}">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copiar</span>
      </button>
    `;
        host.appendChild(row);
    });

    host.addEventListener("click", handleCopyClick);
}

async function handleCopyClick(e) {
    const btn = e.target.closest(".link-row__copy");
    if (!btn) return;

    const ok = await copyToClipboard(btn.getAttribute("data-url"));
    const label = btn.querySelector("span:last-child");

    btn.classList.toggle("is-copied", ok);
    label.textContent = ok ? "¡Copiado!" : "No se pudo copiar";
    clearTimeout(btn._resetTimer);
    btn._resetTimer = setTimeout(() => {
        btn.classList.remove("is-copied");
        label.textContent = "Copiar";
    }, 1600);
}

/* navigator.clipboard requiere contexto seguro (https/localhost); al abrir
   la página como archivo local (file://) no está disponible, así que se usa
   un <textarea> + execCommand("copy") como respaldo.                       */
async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch (err) { /* sigue al respaldo */ }
    }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch (err) {
        return false;
    }
}

(async function init() {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get("k") || "").trim().toLowerCase();
    const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

    /* En desarrollo local sin token, entra directo como director. */
    if (isLocalDev && !token) {
        window.location.replace(`?k=${DIRECTOR_TOKEN}`);
        return;
    }

    /* Token de dirección → vista completa de los 12 grupos. */
    if (token === DIRECTOR_TOKEN) {
        document.getElementById("viewHome").classList.add("is-active");
        renderHome();
        renderLinkList();
        await loadData();
        renderPendingBadges();
        startStatusTimeTicker();
        return;
    }

    /* Token de grupo → vista del horario de ese grupo. */
    const groupId = TOKENS[token];
    if (groupId) {
        document.getElementById("viewGroup").classList.add("is-active");
        const els = {
            badge: document.getElementById("detailBadge"),
            title: document.getElementById("detailTitle"),
            date: document.getElementById("detailDate"),
            count: document.getElementById("detailCount"),
            scheduleHost: document.getElementById("scheduleHost")
        };
        await loadData();
        renderGroupDetail(groupId, els);
        startStatusTimeTicker();
        return;
    }

    /* Sin token válido → acceso restringido. */
    document.getElementById("viewLocked").classList.add("is-active");
})();
