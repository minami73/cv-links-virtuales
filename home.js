/* ============================================================
   Página de inicio (index.html) — listado de los 12 grupos.
   Pensada para coordinación/dirección: cada grupo enlaza a su
   página individual (grupo.html?k=<token>), que es lo que se
   comparte con los papás.
   ============================================================ */

function renderHome() {
    const today = new Date();
    document.getElementById("todayDay").textContent = getTodayShortDay(today);
    document.getElementById("todayDate").textContent = capitalize(getTodayDiaLabel(today));

    const host = document.getElementById("groupsGrid");
    host.innerHTML = "";
    GROUPS.forEach(group => {
        const token = tokenForGroup(group.id);
        const a = document.createElement("a");
        a.className = "group-btn";
        a.href = `grupo.html?k=${token}`;
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
        const url = new URL(`grupo.html?k=${token}`, window.location.href).href;

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

/* index.html exige el token de dirección (?k=...), igual que grupo.html
   exige el token de cada grupo: así nadie llega al listado completo
   solo adivinando la URL — necesita el enlace que dirección comparte. */
(async function init() {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get("k") || "").trim().toLowerCase();

    /* En desarrollo local (Live Server / localhost) se entra directo con el
       token de dirección, para no pegarlo a mano en cada "Go Live". En el
       sitio publicado, el hostname no es localhost y el candado aplica.   */
    const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (token !== DIRECTOR_TOKEN && isLocalDev) {
        window.location.replace(`index.html?k=${DIRECTOR_TOKEN}`);
        return;
    }

    if (token !== DIRECTOR_TOKEN) {
        document.getElementById("viewLocked").classList.add("is-active");
        return;
    }

    document.getElementById("viewHome").classList.add("is-active");
    renderHome();
    renderLinkList();
    await loadData();
    renderPendingBadges();
    startStatusTimeTicker();
})();
