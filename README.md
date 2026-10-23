# Bonjour JG 🌷

Petit site interne pour organiser les visites à l'hôpital :

- calendrier à la semaine (lundi → dimanche), navigable ;
- inscription sur un créneau, à plusieurs (avec nombre de personnes et petit mot) ;
- capacité maximale par créneau (3 personnes par défaut) ;
- blocage d'un créneau ou d'une journée entière avec un motif (repos, soins…) ;
- encart « Infos pratiques » modifiable : hôpital, adresse + lien itinéraire, service, n° de chambre, horaires, rappel carte d'identité ;
- mise à jour en temps réel pour tous les visiteurs ;
- aucune connexion : le prénom saisi est mémorisé sur l'appareil pour mettre en évidence « vos » inscriptions.

Tant que Supabase n'est pas configuré, le site fonctionne en **mode démo** (données locales au navigateur) : ouvrez simplement `index.html`.

---

## Mise en ligne (≈ 15 minutes)

### 1. Supabase — la base de données
1. Sur [supabase.com](https://supabase.com), créez un projet (région Europe, ex. Paris ou Francfort).
2. Menu **SQL Editor** → **New query** → collez le contenu de `supabase/schema.sql` → **Run**.
3. Récupérez dans **Project Settings → API Keys** (ou bouton **Connect**) :
   - l'**URL du projet** (`https://xxxx.supabase.co`) ;
   - la **clé publique** : *publishable key* (`sb_publishable_…`) ou, sur les anciens projets, la clé *anon*.
   ⚠️ N'utilisez **jamais** la clé *secret* / *service_role* dans le site.

### 2. Configuration
Ouvrez `config.js` et renseignez `supabaseUrl` et `supabaseKey`.
Ajustez si besoin les créneaux (`slots`), la capacité (`maxPeoplePerSlot`) et les motifs de blocage.

### 3. GitHub
Créez un dépôt (privé de préférence), par ex. `bonjour-jg`, et déposez-y tous les fichiers
(glisser-déposer via « Add file → Upload files » suffit).

### 4. Vercel
1. **Add New → Project** → importez le dépôt GitHub.
2. Framework : **Other** — aucune commande de build, dossier de sortie par défaut.
3. **Deploy**. Vous obtenez une adresse du type `bonjour-jg.vercel.app`.
4. Chaque modification poussée sur GitHub redéploie automatiquement le site.

### 5. Premier usage
Ouvrez le site → « Infos pratiques » → **Modifier** : saisissez l'hôpital, l'adresse, la chambre…
Partagez ensuite le lien aux proches (WhatsApp, SMS…).

---

## Bon à savoir
- **Accès** : pas d'authentification, donc toute personne qui a le lien peut s'inscrire, bloquer ou retirer une inscription. Le site n'est pas référencé par les moteurs de recherche, mais gardez le lien dans le cercle des proches.
- **Données** : seuls des prénoms et des créneaux sont enregistrés. Évitez d'inscrire des informations médicales dans les motifs ou les petits mots.
- **Supabase gratuit** : un projet sans aucune activité pendant ~7 jours peut être mis en pause ; il suffit de le réactiver depuis le tableau de bord Supabase.
- **Changer les créneaux** : vous pouvez en ajouter ou en retirer dans `config.js`, mais ne renommez pas l'`id` d'un créneau qui a déjà des inscriptions.

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | structure de la page |
| `styles.css` | mise en forme (mobile d'abord) |
| `app.js` | logique : calendrier, inscriptions, blocages, temps réel |
| `config.js` | **vos réglages** (Supabase, créneaux, capacité) |
| `supabase/schema.sql` | tables et droits à créer dans Supabase |
| `vercel.json`, `robots.txt` | non-référencement |
