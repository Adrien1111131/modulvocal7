# Module Vocal 7

Une application React utilisant l'API ElevenLabs pour ajouter des émotions à la sortie vocale.

## Structure du projet

```
modulvocal7/
├── vite-react-elevenlabs-app/     # Application React principale
│   ├── src/                       # Code source React
│   ├── server/                    # Serveur API Node.js
│   └── package.json              # Dépendances React
├── photo/                         # Images du projet
├── package.json                   # Configuration racine pour Vercel
├── vercel.json                    # Configuration de déploiement Vercel
└── README.md                      # Ce fichier
```

## Déploiement

### Vercel (Recommandé)

Le projet est configuré pour être déployé automatiquement sur Vercel :

1. **Build automatique** : Vercel exécute `npm run build` qui :
   - Navigue vers `vite-react-elevenlabs-app/`
   - Installe les dépendances avec `npm install`
   - Build l'application avec `vite build`

2. **Configuration** : Le fichier `vercel.json` configure :
   - Le serveur API Node.js (`server/server.js`)
   - Le build statique React
   - Les routes API (`/api/*` et `/audio/*`)

### Développement local

```bash
# Cloner le repository
git clone https://github.com/Adrien1111131/modulvocal7.git
cd modulvocal7

# Démarrer l'application React
npm run dev

# Ou directement dans le dossier React
cd vite-react-elevenlabs-app
npm install
npm run dev
```

### Scripts disponibles

- `npm run build` : Build l'application pour la production
- `npm run dev` : Démarre le serveur de développement
- `npm run preview` : Prévisualise le build de production

## Configuration

### Variables d'environnement

Créer un fichier `.env` dans `vite-react-elevenlabs-app/` :

```env
VITE_ELEVENLABS_API_KEY=your_api_key_here
VITE_API_BASE_URL=http://localhost:3000
```

### API ElevenLabs

L'application utilise l'API ElevenLabs pour la synthèse vocale avec émotions. Assurez-vous d'avoir une clé API valide.

## Fonctionnalités

- Synthèse vocale avec émotions
- Interface React moderne
- API backend Node.js
- Déploiement automatique sur Vercel

## Technologies

- **Frontend** : React 18, TypeScript, Vite
- **Backend** : Node.js, Express
- **API** : ElevenLabs
- **Déploiement** : Vercel
