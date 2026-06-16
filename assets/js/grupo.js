/* ============================================================
   Página individual de grupo (grupo.html) — la que se comparte
   con los papás por WhatsApp/Classroom.

   Resuelve el token de la URL (?k=...) contra TOKENS y muestra
   ÚNICAMENTE el horario de ese grupo. Sin token válido, no se
   revela el listado completo: solo un aviso para usar su enlace.
   ============================================================ */

(function () {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get("k") || "").trim().toLowerCase();
    const groupId = TOKENS[token];

    const viewGroup = document.getElementById("viewGroup");
    const viewNoToken = document.getElementById("viewNoToken");

    if (!groupId) {
        viewNoToken.classList.add("is-active");
        return;
    }

    viewGroup.classList.add("is-active");

    const els = {
        badge: document.getElementById("detailBadge"),
        title: document.getElementById("detailTitle"),
        date: document.getElementById("detailDate"),
        count: document.getElementById("detailCount"),
        scheduleHost: document.getElementById("scheduleHost")
    };

    (async function init() {
        await loadData();
        renderGroupDetail(groupId, els);
        startStatusTimeTicker();
    })();
})();
