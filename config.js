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
    { id: "matin",       label: "Matin",              start: "10:00", end: "12:00" },
    { id: "debut-aprem", label: "Début d'après-midi", start: "14:00", end: "16:00" },
    { id: "fin-aprem",   label: "Fin d'après-midi",   start: "16:00", end: "18:00" },
    { id: "soir",        label: "Soirée",             start: "18:00", end: "20:00" },
  ],

  // Nombre maximum de personnes par créneau (0 = illimité).
  maxPeoplePerSlot: 3,

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
