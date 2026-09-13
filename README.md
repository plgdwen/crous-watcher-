# Crous Watcher

Surveille une page de recherche de logement CROUS et envoie un email dès qu'un logement apparaît.

## Comment ça marche

- Le serveur vérifie la page toutes les `CHECK_INTERVAL_MS` (60 secondes par défaut).
- Si le texte "Aucun logement trouvé" disparaît de la page, ça veut dire qu'un logement est apparu → email envoyé.
- Une fois notifié, il ne renvoie pas de nouvel email tant que la page reste dans cet état (évite le spam). Si la page repasse à "aucun logement" puis retrouve une offre, une nouvelle notification part.
- Une page de statut (`/`) affiche en direct : zone surveillée, dernière vérification, nombre de vérifications, lien.

## Installation en local (pour tester)

```bash
npm install
cp .env.example .env
# remplir .env avec tes identifiants SMTP et l'URL à surveiller
npm start
```

Puis ouvrir `http://localhost:3000`.

## Déploiement sur Render (gratuit)

1. Pousser ce dossier sur un repo GitHub.
2. Sur [render.com](https://render.com) → **New +** → **Web Service** → connecter le repo.
3. Render détecte Node automatiquement. Configurer :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
4. Dans l'onglet **Environment**, ajouter toutes les variables du fichier `.env.example` (avec tes vraies valeurs).
5. Déployer. L'URL fournie par Render (ex: `https://crous-watcher.onrender.com`) est la page de statut.

### ⚠️ Important : le plan gratuit de Render s'endort

Un service gratuit sur Render se met en veille après 15 minutes sans trafic HTTP entrant. Vu qu'on a besoin d'une surveillance h24, il faut le garder éveillé avec un ping externe régulier :

1. Créer un compte gratuit sur [cron-job.org](https://cron-job.org) ou [uptimerobot.com](https://uptimerobot.com).
2. Configurer un ping toutes les 5 minutes vers :
   `https://<ton-url-render>.onrender.com/health`

Sans ce ping, le service risque de s'arrêter et de manquer une disponibilité.

## Configurer l'envoi d'email (SMTP)

Le plus simple pour un usage gratuit : [Brevo](https://www.brevo.com) (ex-Sendinblue), 300 emails/jour gratuits.

1. Créer un compte Brevo.
2. Récupérer les identifiants SMTP dans les paramètres du compte.
3. Renseigner `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` dans les variables d'environnement.

Sans configuration SMTP, le script fonctionne quand même : la notification s'affiche simplement dans les logs du serveur (utile pour tester sans dépendre de l'email).

## Tester la détection sans attendre un vrai logement

Changer temporairement `TARGET_URL` vers une ville qui a effectivement des logements disponibles, redémarrer, vérifier que l'email arrive puis remettre l'URL cible réelle.
