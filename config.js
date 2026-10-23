/*
 * Bonjour JG — configuration
 * ---------------------------------------------------------------
 * 1. Collez ici l'URL et la clé publique (publishable / anon) de votre
 *    projet Supabase. Tant qu'elles sont vides, le site tourne en
 *    « mode démo » (données enregistrées uniquement dans votre navigateur).
 * 2. Adaptez les créneaux, la capacité et les motifs de blocage.
 */
window.BONJOUR_JG_CONFIG = {
  supabaseUrl: "https://flbbbjcqledczqveyzmo.supabase.co",
  supabaseKey: "sb_publishable_CcEJ9N3Fa-9LAkLiyagNEQ_yhcxcUcT",

  // Créneaux de visite proposés chaque jour (id unique, sans espace).
  // ⚠️ Ne changez pas l'"id" d'un créneau qui a déjà des inscriptions.
  slots: [
    { id: "h10", label: "Matin",      start: "10:00", end: "11:00" },
    { id: "h11", label: "Matin",      start: "11:00", end: "12:00" },
    { id: "h12", label: "Midi",       start: "12:00", end: "13:00" },
    { id: "h13", label: "Après-midi", start: "13:00", end: "14:00" },
    { id: "h14", label: "Après-midi", start: "14:00", end: "15:00" },
    { id: "h15", label: "Après-midi", start: "15:00", end: "16:00" },
    { id: "h16", label: "Après-midi", start: "16:00", end: "17:00" },
    { id: "h17", label: "Fin de journée", start: "17:00", end: "18:00" },
    { id: "h18", label: "Soirée",     start: "18:00", end: "19:00" },
    { id: "h19", label: "Soirée",     start: "19:00", end: "20:00" },
  ],

  // Nombre maximum de personnes par créneau (0 = illimité).
  maxPeoplePerSlot: 3,

  // Nombre minimum d'heures SANS visite à préserver chaque jour (0 = pas de limite).
  // Calculé sur les créneaux ci-dessus : les créneaux bloqués comptent comme du repos.
  minRestHoursPerDay: 4,

  // Motifs proposés pour bloquer un créneau.
  blockReasons: ["Repos", "Soins / examens", "Visite médicale", "Kiné", "Autre"],

  // Valeurs affichées par défaut dans « Infos pratiques ».
  // Elles sont modifiables directement sur le site (bouton « Modifier »).
  defaultLogistics: {
    hospital: "Hôpital d'Instruction des Armées Percy",
    address: "2 rue du Lieutenant Raoul Batany, 92140 Clamart",
    service: "",
    room: "318",
    hours: "Tous les jours de 10h à 20h",
    notes: "Pièce d'identité contrôlée à l'entrée, à pied comme en voiture.\nParking intérieur souvent saturé : mieux vaut se garer à l'extérieur.\nPas de plantes en pot ni d'animaux ; fleurs coupées selon le service.",
  },
};
