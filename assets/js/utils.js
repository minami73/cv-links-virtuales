function parseCSV(text) {
    text = text.replace(/\r\n?/g, "\n").trim();
    if (!text) return [];
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else { field += c; }
        } else {
            if (c === '"') { inQuotes = true; }
            else if (c === ",") { cur.push(field); field = ""; }
            else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
            else { field += c; }
        }
    }
    cur.push(field);
    rows.push(cur);

    if (rows.length === 0) return [];
    const header = rows.shift().map(h => h.trim().toLowerCase());
    return rows
        .filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""))
        .map(r => {
            const obj = {};
            header.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
            return obj;
        });
}

function normalizeGroupId(raw) {
    if (!raw) return "";
    const cleaned = String(raw).toUpperCase().replace(/[°º]/g, "").replace(/\s+/g, "");
    const m = cleaned.match(/^([1-6])([AB])$/);
    return m ? `${m[1]}${m[2]}` : "";
}

/* Google Sheets exporta horas como "8:00" (sin cero a la izquierda) al
   detectarlas como valores de hora, y los docentes podrían escribirlas de
   formas distintas. Se normaliza a "HH:MM" para que coincida con
   SCHEDULE_BLOCKS, cuyos horarios siempre llevan dos dígitos.            */
function normalizeTime(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

/* Minutos entre block.from y block.to ("HH:MM"). La duración que ve el
   papá siempre sale del bloque fijo, no de la hoja — y no todos los
   bloques duran lo mismo (el último es de 40 min).                      */
function blockMinutes(block) {
    const [h1, m1] = block.from.split(":").map(Number);
    const [h2, m2] = block.to.split(":").map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
}

/* Solo se aceptan enlaces http(s). Cualquier otra cosa escrita en la
   hoja (texto suelto, "javascript:", etc.) se trata como sin enlace,
   para que nunca termine como href clicable.                            */
function safeLink(url) {
    const s = String(url || "").trim();
    return /^https?:\/\//i.test(s) ? s : "";
}

function detectPlatform(url) {
    if (!url) return null;
    const u = url.toLowerCase();
    if (u.includes("zoom.us") || u.includes("zoom.com")) return "zoom";
    if (u.includes("meet.google")) return "meet";
    if (u.includes("teams.microsoft") || u.includes("teams.live")) return "teams";
    return "other";
}

function platformLabel(p) {
    return { zoom: "Zoom", meet: "Google Meet", teams: "Microsoft Teams", other: "Videollamada" }[p] || "";
}

function normalizeRows(rows) {
    return rows.map(r => ({
        grupoId: normalizeGroupId(r.grado || r.grupo || ""),
        grado: (r.grado || r.grupo || "").trim(),
        dia: (r.dia || "").trim(),
        hora_inicio: normalizeTime(r.hora_inicio || r.inicio || ""),
        hora_fin: normalizeTime(r.hora_fin || r.fin || ""),
        materia: (r.materia || "").trim(),
        profesor: (r.profesor || "").trim(),
        link: safeLink(r.link)
    })).filter(r => r.grupoId);
}

function escapeHTML(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttr(s) { return escapeHTML(s); }

function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
