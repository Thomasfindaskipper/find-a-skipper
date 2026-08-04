# Find a Skipper — Next.js + TypeScript + Tailwind + Supabase

Architecture évolutive : 5 rôles (skipper, propriétaire, broker, société de
charter, administrateur), tableaux de bord dédiés par rôle, base de données
Postgres avec sécurité au niveau des lignes (RLS), authentification et
messagerie temps réel via Supabase, prêt pour un déploiement Vercel.

## 1. Configurer Supabase

1. Dans votre projet Supabase → **SQL Editor** → **New query**
2. Collez tout le contenu de `supabase/schema.sql` puis **Run**
3. Dans **Authentication → Providers → Email**, désactivez "Confirm email"
   pour tester rapidement (à réactiver avant la production)
4. Dans **Project Settings → API**, notez votre **Project URL** et votre
   clé **`anon` `public`** (ou `sb_publishable_...`)

## 2. Installer le projet en local

```bash
cd find-a-skipper          # le dossier de ce projet
cp .env.local.example .env.local
```

Remplissez `.env.local` avec les deux valeurs Supabase récupérées ci-dessus.

```bash
npm install
npm run dev
```

Le site est disponible sur `http://localhost:3000`.

## 3. Envoyer le projet sur GitHub

Depuis le dossier du projet, dans le Terminal :

```bash
git init
git add .
git commit -m "Premier import du projet Find a Skipper"
git branch -M main
git remote add origin https://github.com/<votre-nom-utilisateur>/find-a-skipper.git
git push -u origin main
```

(Remplacez l'URL par celle de votre dépôt — visible sur la page GitHub de
votre repo, bouton "Code" → "HTTPS".)

## 4. Déployer sur Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Importez votre dépôt GitHub `find-a-skipper`
3. Dans **Environment Variables**, ajoutez `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (les mêmes valeurs que dans `.env.local`)
4. Cliquez sur **Deploy**

Chaque futur `git push` redéploiera automatiquement le site.

## Architecture des rôles

Un seul système d'authentification (Supabase Auth), un seul champ `role`
dans la table `profiles` (`skipper`, `owner`, `broker`, `charter_company`,
`admin`). Chaque rôle a :
- Son propre tableau de bord (`/dashboard/skipper`, `/dashboard/demandeur`
  pour owner/broker/charter_company, `/dashboard/admin` en stub)
- Ses propres permissions au niveau de la base de données (RLS) : un
  skipper ne peut pas publier de mission, seul le propriétaire d'une
  mission voit ses candidatures, etc.
- `broker` et `charter_company` partagent le même tableau de bord que
  `owner` mais avec des champs supplémentaires (`company_name`,
  `fleet_size`) et un encart adapté à la gestion de flotte.

## Fonctionnalités prévues dans le schéma mais pas encore développées

- **Administration** (`role = 'admin'`) : vérification des skippers,
  gestion des signalements, mise en avant de missions (`is_featured`),
  statistiques. Pour tester, changez manuellement le rôle d'un compte en
  `admin` dans Supabase (Table Editor → profiles).
- **Avis** (table `reviews`) : notation 1-5 après une mission.
- **Favoris** (table `favorites`) : skippers ou missions favoris.
- **Notifications** (table `notifications`) : email/in-app.
- **Vérification d'identité et de diplômes** (`identity_verified`,
  `certifications`) : les champs existent, l'upload de justificatifs et le
  processus de vérification restent à construire (probablement via
  Supabase Storage).
- **Galerie photos** (`gallery_urls`) et **photo de profil**
  (`avatar_url`) : champs prêts, upload à construire (Supabase Storage).

## Structure du projet

```
├── supabase/schema.sql
├── middleware.ts                 ← rafraîchit la session Supabase
├── lib/
│   ├── supabase/client.ts        ← client navigateur
│   ├── supabase/server.ts        ← client serveur (Server Components)
│   └── database.types.ts         ← types TypeScript des tables
├── components/
│   ├── Nav.tsx
│   └── ui.tsx                    ← composants réutilisables
└── app/
    ├── page.tsx                  ← accueil
    ├── login/, signup/
    ├── dashboard/{skipper,demandeur,admin}/
    ├── missions/, missions/new/, missions/[id]/
    ├── my-missions/, my-missions/[id]/
    ├── my-applications/
    ├── skippers/, skippers/[id]/
    ├── messages/
    └── profile/
```
