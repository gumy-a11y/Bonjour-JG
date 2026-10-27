/* Bonjour JG — planning des visites */
(() => {
  "use strict";

  // ---------------------------------------------------------------- Config
  const CFG = window.BONJOUR_JG_CONFIG || {};
  const SLOTS = Array.isArray(CFG.slots) ? CFG.slots : [];
  const MAX = Math.max(0, Number(CFG.maxPeoplePerSlot) || 0);
  const REASONS = Array.isArray(CFG.blockReasons) && CFG.blockReasons.length ? CFG.blockReasons : ["Repos", "Autre"];
  const MIN_REST = Math.max(0, Number(CFG.minRestHoursPerDay) || 0) * 60; // en minutes
  const WHOLE_DAY = "*";
  const NAME_KEY = "bjg-name";

  // ---------------------------------------------------------------- Utils
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
  const fmtWeekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
  const fmtMonth = new Intl.DateTimeFormat("fr-FR", { month: "long" });
  const fmtShort = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const dnum = (d) => (d.getDate() === 1 ? "1er" : String(d.getDate()));
  const longDate = (d) => `${fmtWeekday.format(d)} ${dnum(d)} ${fmtMonth.format(d)}`;
  const norm = (s) => String(s || "").trim().toLowerCase();
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
  };

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
  }

  const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter((c) => c != null && c !== false));

  function weekLabel(a, b) {
    const left = a.getMonth() === b.getMonth()
      ? dnum(a)
      : `${dnum(a)} ${fmtMonth.format(a)}${a.getFullYear() !== b.getFullYear() ? " " + a.getFullYear() : ""}`;
    return `Du ${fmtWeekday.format(a)} ${left} au ${fmtWeekday.format(b)} ${dnum(b)} ${fmtMonth.format(b)} ${b.getFullYear()}`;
  }

  // ---------------------------------------------------------------- Stockage : Supabase
  function createSupabaseStore(url, key) {
    const db = window.supabase.createClient(url, key);
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    return {
      demo: false,
      async load(from, to) {
        const [v, b] = await Promise.all([
          db.from("visits").select("*").gte("visit_date", from).lte("visit_date", to).order("created_at"),
          db.from("blocks").select("*").gte("block_date", from).lte("block_date", to),
        ]);
        return { visits: ok(v) || [], blocks: ok(b) || [] };
      },
      async addVisit(row) { ok(await db.from("visits").insert(row)); },
      async removeVisit(id) { ok(await db.from("visits").delete().eq("id", id)); },
      async addBlock(row) { ok(await db.from("blocks").insert(row)); },
      async removeBlock(id) { ok(await db.from("blocks").delete().eq("id", id)); },
      async getLogistics() { return ok(await db.from("logistique").select("*").eq("id", 1).maybeSingle()); },
      async saveLogistics(obj) { ok(await db.from("logistique").update({ ...obj, updated_at: new Date().toISOString() }).eq("id", 1)); },
      subscribe(cb) {
        const ch = db.channel("bonjour-jg");
        for (const table of ["visits", "blocks", "logistique"]) {
          ch.on("postgres_changes", { event: "*", schema: "public", table }, cb);
        }
        ch.subscribe();
      },
    };
  }

  // ---------------------------------------------------------------- Stockage : démo locale
  function createLocalStore() {
    const KEY = "bjg-demo-data";
    let mem = null;
    const now = () => new Date().toISOString();
    function seed() {
      const mon = startOfWeek(new Date());
      const s = (i) => (SLOTS[i] || SLOTS[0] || {}).id;
      const data = { visits: [], blocks: [], logistique: null };
      if (!SLOTS.length) return data;
      data.visits.push(
        { id: uid(), visit_date: toISO(addDays(mon, 1)), slot_id: s(1), name: "Marie", people: 1, note: "J'apporte des clémentines", created_at: now() },
        { id: uid(), visit_date: toISO(addDays(mon, 1)), slot_id: s(1), name: "Paul", people: 1, note: null, created_at: now() },
        { id: uid(), visit_date: toISO(addDays(mon, 4)), slot_id: s(2), name: "Sophie", people: 1, note: null, created_at: now() },
        { id: uid(), visit_date: toISO(addDays(mon, 5)), slot_id: s(0), name: "Jean-Pierre Martin", people: 1, note: null, created_at: now() },
      );
      data.blocks.push(
        { id: uid(), block_date: toISO(addDays(mon, 3)), slot_id: s(0), reason: "Soins / examens", note: "Scanner prévu", created_at: now() },
        { id: uid(), block_date: toISO(addDays(mon, 6)), slot_id: WHOLE_DAY, reason: "Repos", note: "Journée calme", created_at: now() },
      );
      return data;
    }
    const read = () => {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
      if (!mem || !Array.isArray(mem.visits)) mem = seed();
      return mem;
    };
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* mémoire seulement */ } };
    return {
      demo: true,
      async load(from, to) {
        const d = read();
        return {
          visits: d.visits.filter((v) => v.visit_date >= from && v.visit_date <= to),
          blocks: d.blocks.filter((b) => b.block_date >= from && b.block_date <= to),
        };
      },
      async addVisit(row) { read().visits.push({ id: uid(), created_at: now(), ...row }); write(); },
      async removeVisit(id) { const d = read(); d.visits = d.visits.filter((v) => v.id !== id); write(); },
      async addBlock(row) {
        const d = read();
        if (d.blocks.some((b) => b.block_date === row.block_date && b.slot_id === row.slot_id)) throw { code: "23505" };
        d.blocks.push({ id: uid(), created_at: now(), ...row }); write();
      },
      async removeBlock(id) { const d = read(); d.blocks = d.blocks.filter((b) => b.id !== id); write(); },
      async getLogistics() { return read().logistique; },
      async saveLogistics(obj) { const d = read(); d.logistique = { ...(d.logistique || {}), ...obj }; write(); },
      subscribe(cb) { window.addEventListener("storage", (e) => { if (e.key === KEY) { mem = null; cb(); } }); },
    };
  }

  const useSupabase = Boolean(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);
  const store = useSupabase ? createSupabaseStore(CFG.supabaseUrl, CFG.supabaseKey) : createLocalStore();

  // ---------------------------------------------------------------- État
  const state = { weekStart: startOfDay(new Date()), visits: [], blocks: [], logistics: null, current: null };

  const slotById = (id) => SLOTS.find((s) => s.id === id);
  const visitsFor = (iso, slotId) => state.visits.filter((v) => v.visit_date === iso && v.slot_id === slotId);
  const dayBlockFor = (iso) => state.blocks.find((b) => b.block_date === iso && b.slot_id === WHOLE_DAY);
  const blockFor = (iso, slotId) => state.blocks.find((b) => b.block_date === iso && b.slot_id === slotId) || dayBlockFor(iso);
  const headcount = (list) => list.reduce((s, v) => s + (Number(v.people) || 1), 0);
  const isPast = (iso, slot) => { const d = fromISO(iso); const [h, m] = slot.end.split(":").map(Number); d.setHours(h, m || 0); return d < new Date(); };
  const myName = () => norm(storage.get(NAME_KEY));

  // Repos quotidien minimum
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };
  const slotMinutes = (slot) => Math.max(0, toMin(slot.end) - toMin(slot.start));
  const DAY_MINUTES = SLOTS.reduce((s, x) => s + slotMinutes(x), 0);
  const fmtHours = (min) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${pad(m)}` : `${h} h`; };
  const visitedMinutes = (iso) => SLOTS.reduce((s, x) => s + (visitsFor(iso, x.id).length ? slotMinutes(x) : 0), 0);
  const restMinutes = (iso) => DAY_MINUTES - visitedMinutes(iso);
  // Vrai si ouvrir ce créneau (encore vide) ferait passer le repos du jour sous le minimum
  const restLocked = (iso, slot) =>
    MIN_REST > 0 && visitsFor(iso, slot.id).length === 0 && restMinutes(iso) - slotMinutes(slot) < MIN_REST;

  // ---------------------------------------------------------------- Notifications
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("is-error", isError);
    toastEl.classList.add("is-on");
    try { if (toastEl.matches(":popover-open")) toastEl.hidePopover(); toastEl.showPopover(); } catch { /* pas de popover */ }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-on");
      try { toastEl.hidePopover(); } catch { /* idem */ }
    }, 3400);
  }
  const fail = (err, msg) => { console.error(err); toast(msg || "Oups, une erreur est survenue. Réessayez.", true); };

  // ---------------------------------------------------------------- Chargement
  let loadSeq = 0;
  async function refresh() {
    const seq = ++loadSeq;
    const from = toISO(state.weekStart);
    const to = toISO(addDays(state.weekStart, 6));
    try {
      const d = await store.load(from, to);
      if (seq !== loadSeq) return;
      state.visits = d.visits;
      state.blocks = d.blocks;
      renderWeek();
    } catch (err) {
      if (seq !== loadSeq) return;
      console.error(err);
      $("#days").classList.remove("is-loading");
      $("#days").replaceChildren(el("div", { class: "error-box", text: "Impossible de charger le planning. Vérifiez votre connexion puis rechargez la page." }));
    }
  }

  async function loadLogistics() {
    try { state.logistics = await store.getLogistics(); } catch (err) { console.error(err); }
    renderLogistics();
    renderPatient();
  }

  // ---------------------------------------------------------------- Rendu : information du patient
  const frDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

  function renderPatient() {
    const P = state.logistics || {};
    const date = P.discharge_date || null;
    let when = null;
    if (date) {
      const days = Math.round((fromISO(date) - fromISO(toISO(new Date()))) / 86400000);
      when = days > 1 ? `dans ${days} jours` : days === 1 ? "demain" : days === 0 ? "aujourd'hui" : "date passée";
    }
    fill($("#patient"),
      el("span", { class: "patient-icon", "aria-hidden": "true", text: "🗓️" }),
      el("div", { class: "patient-main" },
        el("span", { class: "logi-label", text: "Information du patient" }),
        date
          ? el("p", { class: "patient-date" }, "Sortie prévue le ", el("strong", { text: frDate(date) }), el("span", { class: "patient-when", text: when }))
          : el("p", { class: "patient-date muted", text: "Date de sortie pas encore connue" }),
        P.patient_notes ? el("p", { class: "patient-notes", text: P.patient_notes }) : null),
      el("button", { class: "btn link", type: "button", onclick: openPatient }, "Modifier"),
    );
  }

  function openPatient() {
    const f = $("#form-patient");
    const P = state.logistics || {};
    f.elements.discharge_date.value = P.discharge_date || "";
    f.elements.patient_notes.value = P.patient_notes || "";
    $("#dlg-patient").showModal();
  }

  $("#form-patient").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const btn = f.querySelector("[type=submit]");
    const data = {
      discharge_date: f.elements.discharge_date.value || null,
      patient_notes: f.elements.patient_notes.value.trim() || null,
    };
    btn.disabled = true;
    try {
      await store.saveLogistics(data);
      $("#dlg-patient").close();
      await loadLogistics();
      toast("Information du patient mise à jour.");
    } catch (err) { fail(err, "L'information n'a pas pu être enregistrée."); }
    finally { btn.disabled = false; }
  });

  // ---------------------------------------------------------------- Rendu : infos pratiques
  function logisticsData() {
    const base = { ...(CFG.defaultLogistics || {}) };
    const saved = state.logistics || {};
    for (const k of ["hospital", "address", "service", "room", "hours", "notes"]) {
      if (saved[k] != null && saved[k] !== "") base[k] = saved[k];
    }
    return base;
  }

  function renderLogistics() {
    const L = logisticsData();
    const query = [L.hospital, L.address].filter(Boolean).join(", ");
    const mapUrl = query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
    const item = (icon, label, ...content) =>
      el("div", { class: "logi-item" }, el("span", { class: "logi-icon", "aria-hidden": "true", text: icon }),
        el("div", {}, el("span", { class: "logi-label", text: label }), ...content));

    fill($("#logistics"),
      el("div", { class: "logi-head" },
        el("h2", { text: "Infos pratiques" }),
        el("button", { class: "btn link", type: "button", onclick: openLogistics }, "Modifier")),
      el("div", { class: "logi-grid" },
        item("🏥", "Hôpital",
          el("p", {}, el("strong", { text: L.hospital || "—" })),
          L.address ? el("p", { text: L.address }) : null,
          mapUrl ? el("a", { class: "btn small", href: mapUrl, target: "_blank", rel: "noopener" }, "Itinéraire ↗") : null),
        item("🚪", "Chambre",
          el("span", { class: "room", text: L.room || "—" }),
          L.service ? el("p", { text: L.service }) : null),
        item("🕑", "Horaires de visite", el("p", { text: L.hours || "—" })),
        el("div", { class: "logi-item id-reminder" },
          el("span", { class: "logi-icon", "aria-hidden": "true", text: "🪪" }),
          el("div", {},
            el("strong", { text: "N'oubliez pas votre carte d'identité !" }),
            el("p", { text: "Elle peut vous être demandée à l'accueil de l'hôpital." })))),
      L.notes ? el("p", { class: "logi-notes", text: L.notes }) : null,
    );
  }

  function openLogistics() {
    const f = $("#form-logistics");
    const L = { ...logisticsData(), ...(state.logistics || {}) };
    for (const k of ["hospital", "address", "service", "room", "hours", "notes"]) f.elements[k].value = L[k] || "";
    $("#dlg-logistics").showModal();
  }

  $("#form-logistics").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const btn = f.querySelector("[type=submit]");
    const data = {};
    for (const k of ["hospital", "address", "service", "room", "hours", "notes"]) data[k] = f.elements[k].value.trim() || null;
    btn.disabled = true;
    try {
      await store.saveLogistics(data);
      $("#dlg-logistics").close();
      await loadLogistics();
      toast("Infos pratiques mises à jour.");
    } catch (err) { fail(err, "Les infos n'ont pas pu être enregistrées."); }
    finally { btn.disabled = false; }
  });

  // ---------------------------------------------------------------- Rendu : semaine
  function renderWeek() {
    const days = $("#days");
    days.classList.remove("is-loading");
    $("#week-label").textContent = weekLabel(state.weekStart, addDays(state.weekStart, 6));

    if (!SLOTS.length) {
      days.replaceChildren(el("div", { class: "empty", text: "Aucun créneau n'est défini dans config.js." }));
      return;
    }

    const todayISO = toISO(new Date());
    const cards = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(state.weekStart, i);
      const iso = toISO(d);
      const dayBlock = dayBlockFor(iso);
      const classes = ["day", iso === todayISO && "is-today", iso < todayISO && "is-past", dayBlock && "is-blocked"].filter(Boolean).join(" ");
      cards.push(el("article", { class: classes, "aria-label": longDate(d) },
        el("header", { class: "day-head" },
          el("div", {},
            el("span", { class: "day-name", text: fmtWeekday.format(d) }),
            el("span", { class: "day-date", text: `${dnum(d)} ${fmtShort.format(d)}` })),
          iso === todayISO ? el("span", { class: "pill", text: "Aujourd'hui" }) : null),
        MIN_REST > 0 ? restIndicator(iso) : null,
        dayBlock ? el("div", { class: "day-blocked" },
          el("strong", { text: `Journée bloquée · ${dayBlock.reason}` }),
          dayBlock.note ? el("span", { text: dayBlock.note }) : null,
          el("button", { class: "btn link", type: "button", onclick: () => unblock(dayBlock) }, "Débloquer")) : null,
        SLOTS.map((s) => renderSlot(iso, s)),
      ));
    }
    days.replaceChildren(...cards);
  }

  function restIndicator(iso) {
    const r = restMinutes(iso);
    const atLimit = r - Math.min(...SLOTS.map(slotMinutes)) < MIN_REST;
    return el("div", { class: `rest-meter${atLimit ? " is-limit" : ""}`, title: `Minimum ${fmtHours(MIN_REST)} sans visite par jour` },
      el("span", { "aria-hidden": "true", text: "🛌 " }), `${fmtHours(r)} sans visite`,
      atLimit ? el("span", { class: "rest-tag", text: "minimum atteint" }) : null);
  }

  function slotStatus(iso, slot) {
    const list = visitsFor(iso, slot.id);
    const n = headcount(list);
    const block = blockFor(iso, slot.id);
    const past = isPast(iso, slot);
    const full = MAX > 0 && n >= MAX;
    const rest = !block && !past && restLocked(iso, slot);
    let text, kind;
    if (block) { text = block.reason; kind = "blocked"; }
    else if (past) { text = n ? `${n} visiteur${n > 1 ? "s" : ""}` : "Passé"; kind = "past"; }
    else if (rest) { text = "Repos"; kind = "rest"; }
    else if (full) { text = "Complet"; kind = "full"; }
    else if (n) { text = MAX ? `${n}/${MAX} pers.` : `${n} pers.`; kind = "some"; }
    else { text = "Libre"; kind = "free"; }
    return { list, n, block, past, full, rest, text, kind };
  }

  function renderSlot(iso, slot) {
    const st = slotStatus(iso, slot);
    const me = myName();
    return el("button", {
      type: "button",
      class: `slot slot--${st.kind}`,
      "aria-label": `${slot.label}, ${slot.start} à ${slot.end} : ${st.text}`,
      onclick: () => openSlot(iso, slot.id),
    },
      el("span", { class: "slot-top" },
        el("span", { class: "slot-time", text: `${slot.start} – ${slot.end}` }),
        el("span", { class: "slot-status", text: st.text })),
      st.list.length ? el("span", { class: "chips" }, st.list.map((v) =>
        el("span", { class: `chip${me && norm(v.name) === me ? " chip--me" : ""}`, title: v.name, text: v.people > 1 ? `${v.name} +${v.people - 1}` : v.name }))) : null,
    );
  }

  // ---------------------------------------------------------------- Fenêtre créneau
  function openSlot(iso, slotId) {
    state.current = { iso, slotId };
    renderSlotDialog();
    const dlg = $("#dlg-slot");
    if (!dlg.open) dlg.showModal();
    const input = dlg.querySelector("input[name=name]");
    if (input && !input.value) input.focus();
  }

  function renderSlotDialog() {
    if (!state.current) return;
    const { iso, slotId } = state.current;
    const slot = slotById(slotId);
    if (!slot) return;
    const st = slotStatus(iso, slot);
    const me = myName();
    const remaining = MAX ? Math.max(0, MAX - st.n) : 10;
    const canSignup = !st.block && !st.past && !st.full && !st.rest;

    let reasonCant = null;
    if (st.past) reasonCant = "Ce créneau est passé.";
    else if (st.rest) reasonCant = `Pour préserver au moins ${fmtHours(MIN_REST)} de repos ce jour-là, ce créneau reste libre. Vous pouvez rejoindre un créneau où quelqu'un est déjà inscrit.`;
    else if (st.full && !st.block) reasonCant = "Ce créneau est complet — essayez un autre moment 🙂";

    fill($("#slot-body"),
      el("p", { class: "dlg-kicker", text: slot.label }),
      el("h3", { text: longDate(fromISO(iso)) }),
      el("p", { class: "dlg-sub", text: `De ${slot.start.replace(":", "h")} à ${slot.end.replace(":", "h")}` }),

      st.block ? el("div", { class: "notice notice--blocked" },
        el("strong", { text: `${st.block.slot_id === WHOLE_DAY ? "Journée bloquée" : "Créneau bloqué"} : ${st.block.reason}` }),
        st.block.note ? el("p", { text: st.block.note }) : null,
        el("button", { class: "btn small", type: "button", onclick: () => unblock(st.block) },
          st.block.slot_id === WHOLE_DAY ? "Débloquer la journée" : "Débloquer ce créneau")) : null,

      el("h4", { text: st.list.length ? `Inscrits · ${st.n}${MAX ? ` / ${MAX}` : ""} personne${st.n > 1 ? "s" : ""}` : "Inscrits" }),
      st.list.length
        ? el("ul", { class: "visitors" }, st.list.map((v) =>
          el("li", { class: me && norm(v.name) === me ? "is-me" : null },
            el("div", {},
              el("strong", { text: v.name }),
              v.people > 1 ? el("span", { class: "muted", text: ` · ${v.people} personnes` }) : null,
              v.note ? el("p", { class: "note", text: `« ${v.note} »` }) : null),
            st.past ? null : el("button", { class: "btn link danger", type: "button", onclick: () => removeVisit(v) }, "Retirer"))))
        : el("p", { class: "muted", text: "Personne n'est encore inscrit sur ce créneau." }),

      canSignup ? signupForm(remaining) : (reasonCant ? el("div", { class: "notice notice--info", text: reasonCant }) : null),

      !st.block && !st.past ? el("div", { class: "dlg-foot" },
        el("button", { class: "btn link", type: "button", onclick: openBlock }, "Bloquer ce créneau (repos, soins…)")) : null,
    );
  }

  // Une seule personne par inscription : « Prénom », « Nom » ou « Prénom Nom ».
  // Lettres (accents compris) et tiret uniquement, un seul espace au maximum.
  const ONE_PERSON_MSG = "Vous ne pouvez inscrire qu'une personne à la fois.";
  const NAME_RE = /^[\p{L}]+(?:-[\p{L}]+)*(?: [\p{L}]+(?:-[\p{L}]+)*)?$/u;
  const isSinglePerson = (name) => NAME_RE.test(name);

  function signupForm(remaining) {
    return el("form", { class: "signup", onsubmit: onSignup },
      el("h4", { text: "S'inscrire" }),
      CFG.signupNotice ? el("p", { class: "signup-notice" }, el("span", { "aria-hidden": "true", text: "⏱️ " }), CFG.signupNotice) : null,
      el("label", {}, "Votre prénom et/ou nom",
        el("input", { name: "name", required: true, maxlength: "60", autocomplete: "name", placeholder: "Ex. : Marie Dupont", value: storage.get(NAME_KEY) || "",
          oninput: (ev) => { ev.target.removeAttribute("aria-invalid"); const err = ev.target.form.querySelector(".field-error"); if (err) err.hidden = true; } })),
      el("p", { class: "field-error", role: "alert", hidden: true, text: ONE_PERSON_MSG }),
      el("p", { class: "field-hint", text: "Un seul nom : « Prénom », « Nom » ou « Prénom Nom »." }),
      el("label", {}, MAX ? `Nombre de personnes (${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""})` : "Nombre de personnes",
        el("input", { name: "people", type: "number", inputmode: "numeric", min: "1", max: String(Math.min(10, remaining)), value: "1", required: true })),
      el("label", {}, "Petit mot (facultatif)",
        el("textarea", { name: "note", maxlength: "200", rows: "2", placeholder: "Ex. : j'apporte le journal" })),
      el("div", { class: "actions" },
        el("button", { class: "btn primary block", type: "submit" }, "Je m'inscris")),
    );
  }

  async function onSignup(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const btn = f.querySelector("[type=submit]");
    const name = f.elements.name.value.trim();
    const people = Math.max(1, Math.min(10, parseInt(f.elements.people.value, 10) || 1));
    const note = f.elements.note.value.trim();
    if (!name) return;
    if (!isSinglePerson(name)) {
      f.elements.name.setAttribute("aria-invalid", "true");
      f.querySelector(".field-error").hidden = false;
      f.elements.name.focus();
      return toast(ONE_PERSON_MSG, true);
    }
    const { iso, slotId } = state.current;
    btn.disabled = true;
    try {
      await refresh(); // données fraîches avant de vérifier la capacité
      const slot = slotById(slotId);
      const st = slotStatus(iso, slot);
      if (st.block) { renderSlotDialog(); return toast("Ce créneau vient d'être bloqué.", true); }
      if (st.rest) { renderSlotDialog(); return toast(`Ce créneau est réservé au repos (${fmtHours(MIN_REST)} minimum par jour).`, true); }
      if (MAX && st.n + people > MAX) {
        renderSlotDialog();
        const left = Math.max(0, MAX - st.n);
        return toast(left ? `Il ne reste que ${left} place${left > 1 ? "s" : ""} sur ce créneau.` : "Ce créneau vient d'être complété.", true);
      }
      await store.addVisit({ visit_date: iso, slot_id: slotId, name, people, note: note || null });
      storage.set(NAME_KEY, name);
      $("#dlg-slot").close(); // inscription faite : on referme la fenêtre
      await refresh();
      toast(`C'est noté, merci ${name} ! 💐`);
    } catch (err) {
      fail(err, "L'inscription n'a pas pu être enregistrée.");
      btn.disabled = false;
    }
  }

  async function removeVisit(v) {
    if (!confirm(`Retirer l'inscription de ${v.name} sur ce créneau ?`)) return;
    try {
      await store.removeVisit(v.id);
      await refresh();
      renderSlotDialog();
      toast("Inscription retirée.");
    } catch (err) { fail(err, "Impossible de retirer cette inscription."); }
  }

  // ---------------------------------------------------------------- Blocage
  const reasonSelect = $("#block-reason");
  reasonSelect.replaceChildren(...REASONS.map((r) => el("option", { value: r, text: r })));

  function openBlock() {
    const { iso, slotId } = state.current;
    const slot = slotById(slotId);
    const f = $("#form-block");
    f.reset();
    $("#block-when").textContent = `${longDate(fromISO(iso))} · ${slot.start} – ${slot.end}`;
    updateBlockWarning();
    $("#dlg-block").showModal();
  }

  function updateBlockWarning() {
    if (!state.current) return;
    const { iso, slotId } = state.current;
    const whole = $("#form-block").elements.scope.value === "day";
    const list = whole ? state.visits.filter((v) => v.visit_date === iso) : visitsFor(iso, slotId);
    const warn = $("#block-warn");
    if (list.length) {
      const names = [...new Set(list.map((v) => v.name))].join(", ");
      warn.textContent = `Déjà inscrit${list.length > 1 ? "s" : ""} : ${names}. Leurs inscriptions sont conservées — pensez à les prévenir.`;
      warn.hidden = false;
    } else warn.hidden = true;
  }
  $("#form-block").addEventListener("change", (e) => { if (e.target.name === "scope") updateBlockWarning(); });

  $("#form-block").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const btn = f.querySelector("[type=submit]");
    const { iso, slotId } = state.current;
    const whole = f.elements.scope.value === "day";
    const row = {
      block_date: iso,
      slot_id: whole ? WHOLE_DAY : slotId,
      reason: f.elements.reason.value,
      note: f.elements.note.value.trim() || null,
    };
    btn.disabled = true;
    try {
      await store.addBlock(row);
      $("#dlg-block").close();
      await refresh();
      renderSlotDialog();
      toast(whole ? "Journée bloquée." : "Créneau bloqué.");
    } catch (err) {
      if (err && err.code === "23505") toast(whole ? "Cette journée est déjà bloquée." : "Ce créneau est déjà bloqué.", true);
      else fail(err, "Le blocage n'a pas pu être enregistré.");
    } finally { btn.disabled = false; }
  });

  async function unblock(block) {
    const what = block.slot_id === WHOLE_DAY ? "cette journée" : "ce créneau";
    if (!confirm(`Débloquer ${what} (${block.reason}) ?`)) return;
    try {
      await store.removeBlock(block.id);
      await refresh();
      if ($("#dlg-slot").open) renderSlotDialog();
      toast("C'est débloqué.");
    } catch (err) { fail(err, "Impossible de débloquer."); }
  }

  // ---------------------------------------------------------------- Navigation & fenêtres
  // Le calendrier commence toujours au plus tôt aujourd'hui : les jours passés ne sont pas affichés.
  function goTo(date) {
    const today = startOfDay(new Date());
    const d = startOfDay(date);
    state.weekStart = d < today ? today : d;
    $("#prev").disabled = state.weekStart <= today;
    $("#days").classList.add("is-loading");
    $("#week-label").textContent = weekLabel(state.weekStart, addDays(state.weekStart, 6));
    refresh();
  }
  $("#prev").addEventListener("click", () => goTo(addDays(state.weekStart, -7)));
  $("#next").addEventListener("click", () => goTo(addDays(state.weekStart, 7)));
  $("#today").addEventListener("click", () => goTo(new Date()));

  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-close]");
    if (c) c.closest("dialog").close();
  });
  for (const dlg of document.querySelectorAll("dialog")) {
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }
  $("#dlg-slot").addEventListener("close", () => { state.current = null; });

  // ---------------------------------------------------------------- Démarrage
  if (store.demo) $("#demo-badge").hidden = false;
  $("#prev").disabled = true;
  renderLogistics();
  renderPatient();
  $("#days").classList.add("is-loading");
  refresh();
  loadLogistics();

  const live = debounce(() => { refresh(); loadLogistics(); }, 300);
  try { store.subscribe(live); } catch (err) { console.warn("Temps réel indisponible", err); }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (state.weekStart < startOfDay(new Date())) goTo(state.weekStart); // la page est restée ouverte après minuit
    else live();
  });
  setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000); // filet de sécurité
})();
