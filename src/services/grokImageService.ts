import { config, logger } from '../config/development';
import { analyzeTextEnvironments } from './grokService';
import { getFallbackImageUrl, generateImageDescription } from './fallbackImageService';

const API_KEY = import.meta.env.VITE_GROK_API_KEY || '';
const API_BASE_URL = 'https://api.x.ai/v1'; // URL de base pour l'API Grok
const API_URL = `${API_BASE_URL}/images/generations`; // Endpoint officiel selon la doc
const CHAT_API_URL = `${API_BASE_URL}/chat/completions`; // URL pour l'API de chat
const USE_FALLBACK = false; // Désactiver le mode fallback pour utiliser la nouvelle clé API
const MAX_RETRIES = 3; // Nombre maximum de tentatives en cas d'erreur 429 (rate limit)
const RETRY_DELAY = 250; // Délai initial entre les tentatives (en ms)

export interface ImageGenerationResult {
  imageUrl: string | null;
  prompt: string;
  error?: string;
}

/**
 * Analyse un texte spécifiquement pour la génération d'images
 * @param text Le texte à analyser
 * @returns Un prompt détaillé pour la génération d'image
 */
export const analyzeTextForImageGeneration = async (text: string): Promise<string> => {
  try {
    logger.group('Analyse du texte pour la génération d\'image');
    logger.info('Début de l\'analyse pour le texte:', text);

    // Prompt spécifique pour la génération d'images - optimisé pour Grok
    const prompt = `
Analyse cette histoire romantique et crée un prompt artistique pour générer une image élégante.

INSTRUCTIONS :
1. Identifie le moment le plus évocateur et émotionnel de l'histoire
2. Crée un prompt d'image artistique, suggestif mais jamais explicite
3. Utilise un format optimisé pour la génération d'images Grok

FORMAT DU PROMPT (utilise exactement cette structure) :
"[Style artistique], [Personnages], [Action suggestive], [Environnement], [Éclairage], [Ambiance], [Qualité]"

EXEMPLES DE BONS PROMPTS POUR GROK :
- "Fine art photography, elegant couple, intimate embrace, luxurious bedroom, soft candlelight, romantic atmosphere, high quality, detailed, 8k"
- "Renaissance painting, passionate lovers, tender moment, secluded garden, golden sunset, emotional connection, masterful composition, artistic"

DIRECTIVES IMPORTANTES :
- Sois suggestif et artistique, jamais explicite
- Privilégie l'émotion et la connexion plutôt que les détails physiques
- Utilise un vocabulaire élégant et poétique
- Limite le prompt final à 200 caractères maximum
- Ajoute toujours des termes de qualité comme "high quality", "detailed", "8k", "artistic"
- Évite tout contenu inapproprié qui pourrait déclencher des filtres

Texte à analyser :
${text}
`;

    // Appel à l'API Grok
    console.log('Envoi de la requête à l\'API Grok pour l\'analyse d\'image...');
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
      { role: 'system', content: 'Tu es un expert en création de prompts artistiques pour la génération d\'images avec Grok. Tu crées des prompts élégants, suggestifs mais jamais explicites.' },
          { role: 'user', content: prompt }
        ],
        model: 'grok-3',
        temperature: 0.7
      })
    });

    // Vérifier si la réponse est OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Réponse d\'erreur complète:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Erreur API: ${response.status} - ${response.statusText}`);
    }

    // Traitement de la réponse
    const responseData = await response.json();
    let imagePrompt = responseData.choices[0].message.content;
    
    // Extraire uniquement la partie finale du prompt
    let finalPrompt = imagePrompt;
    
    // Essayer d'extraire une section spécifique si elle existe
    if (imagePrompt.includes('"')) {
      // Extraire le contenu entre guillemets
      const matches = imagePrompt.match(/"([^"]+)"/);
      if (matches && matches[1]) {
        finalPrompt = matches[1].trim();
      }
    } else if (imagePrompt.includes("Prompt d'image :")) {
      const parts = imagePrompt.split("Prompt d'image :");
      finalPrompt = parts[1].trim();
    } else if (imagePrompt.includes("Prompt final :")) {
      const parts = imagePrompt.split("Prompt final :");
      finalPrompt = parts[1].trim();
    } else if (imagePrompt.includes("Prompt :")) {
      const parts = imagePrompt.split("Prompt :");
      finalPrompt = parts[1].trim();
    }
    
    // Supprimer les guillemets si présents
    finalPrompt = finalPrompt.replace(/^["']|["']$/g, '');
    
    // S'assurer que le prompt est bien formaté
    if (!finalPrompt.includes(",")) {
      // Si le prompt n'a pas de virgules, c'est probablement un paragraphe
      // Extraire les mots-clés et créer un prompt formaté
      const keywords = extractKeywordsFromText(finalPrompt);
      finalPrompt = keywords.join(", ");
    }
    
    // S'assurer que le prompt ne dépasse pas 200 caractères
    if (finalPrompt.length > 200) {
      // Tronquer à la dernière virgule avant 200 caractères
      const truncated = finalPrompt.substring(0, 200);
      const lastCommaIndex = truncated.lastIndexOf(',');
      if (lastCommaIndex > 0) {
        finalPrompt = truncated.substring(0, lastCommaIndex);
      } else {
        finalPrompt = truncated;
      }
    }
    
    // Ajouter des termes de qualité s'ils ne sont pas présents (optimisés pour Grok)
    if (!finalPrompt.toLowerCase().includes("high quality") && 
        !finalPrompt.toLowerCase().includes("detailed") &&
        !finalPrompt.toLowerCase().includes("masterful")) {
      finalPrompt += ", high quality, detailed, 8k, artistic";
    }
    
    logger.debug('Analyse complète:', imagePrompt);
    logger.debug('Prompt final pour l\'image:', finalPrompt);
    logger.groupEnd();
    
    return finalPrompt;
  } catch (error) {
    logger.error('Erreur lors de l\'analyse pour la génération d\'image:', error);
    console.error('Erreur détaillée:', error);
    
    // Prompt par défaut en cas d'erreur
    return `Une image érotique représentant une scène de ${text.length > 50 ? text.substring(0, 50) + '...' : text}`;
  }
};

/**
 * Génère une image basée sur l'analyse du texte
 * @param text Le texte à analyser
 * @returns URL de l'image générée et le prompt utilisé
 */
export const generateImageFromText = async (text: string): Promise<ImageGenerationResult> => {
  // Déclarer la variable prompt en dehors des blocs try/catch pour qu'elle soit accessible partout
  let finalPrompt = '';
  
  // Variables pour stocker l'environnement et l'émotion détectés (pour le fallback)
  let mainEnvironment = 'chambre';
  let mainEmotion = 'sensuel';
  
  try {
    logger.group('Génération d\'image');
    logger.info('Début de la génération d\'image pour le texte:', text);

    // Générer un prompt spécifique pour l'image
    finalPrompt = await analyzeTextForImageGeneration(text);
    
    // Pour le fallback, analyser quand même le texte pour extraire l'environnement et l'émotion
    const textAnalysis = await analyzeTextEnvironments(text);
    
    if (textAnalysis.length > 0) {
      // Extraire l'environnement principal
      const environments = textAnalysis.map(segment => segment.environment);
      mainEnvironment = environments.length > 0 ? 
        environments.sort((a, b) => 
          environments.filter(e => e === a).length - environments.filter(e => e === b).length
        ).pop() || 'chambre' : 'chambre';
      
      // Extraire l'émotion dominante
      const emotions = textAnalysis.map(segment => segment.emotionalTone);
      mainEmotion = emotions.length > 0 ? 
        emotions.sort((a, b) => 
          emotions.filter(e => e === a).length - emotions.filter(e => e === b).length
        ).pop() || 'sensuel' : 'sensuel';
    }
    
    logger.debug('Prompt généré:', finalPrompt);
    console.log('Prompt généré pour l\'image:', finalPrompt);

    // Si le mode fallback est activé, utiliser directement une image locale
    if (USE_FALLBACK) {
      console.log('Mode fallback activé, utilisation d\'une image locale');
      // Créer une description basée sur le texte original
      const description = text.length > 150 ? text.substring(0, 150) + '...' : text;
      const fallbackUrl = getFallbackImageUrl(mainEnvironment, mainEmotion);
      
      return {
        imageUrl: fallbackUrl,
        prompt: description
      };
    }
    
    // Sinon, essayer d'utiliser l'API Grok
    console.log('Envoi de la requête à l\'API Grok pour générer une image...');
    
    // Créer un timeout pour éviter les attentes infinies
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes timeout
    
    try {
      // Appel à l'API selon la documentation officielle
      console.log('Envoi de la requête à l\'API Grok avec les paramètres corrects...');
      
      // Fonction pour effectuer la requête avec retry
      const fetchWithRetry = async (retryCount = 0): Promise<Response> => {
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: "grok-2-image", // Modèle recommandé selon la doc
              prompt: finalPrompt,
              n: 1,
              response_format: "url" // Format de réponse explicite selon la doc
            }),
            signal: controller.signal
          });
          
          // Si on a une erreur 429 (rate limit) et qu'on n'a pas dépassé le nombre max de tentatives
          if (response.status === 429 && retryCount < MAX_RETRIES) {
            console.log(`Rate limit atteint (429), nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} dans ${RETRY_DELAY * (retryCount + 1)}ms...`);
            
            // Attendre avec un délai exponentiel
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
            
            // Réessayer
            return fetchWithRetry(retryCount + 1);
          }
          
          return response;
        } catch (error) {
          // Si c'est une erreur d'abandon (timeout), la propager
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          
          // Pour les autres erreurs, réessayer si possible
          if (retryCount < MAX_RETRIES) {
            console.log(`Erreur réseau, nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} dans ${RETRY_DELAY * (retryCount + 1)}ms...`);
            
            // Attendre avec un délai exponentiel
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
            
            // Réessayer
            return fetchWithRetry(retryCount + 1);
          }
          
          throw error;
        }
      };
      
      // Exécuter la requête avec retry
      const response = await fetchWithRetry();
      
      clearTimeout(timeoutId);
      
      // Vérifier si la réponse est OK avec une meilleure gestion des erreurs
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Réponse d\'erreur complète:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Erreur API: ${response.status} - ${response.statusText}`);
      }
      
      // Récupérer la réponse JSON
      const data = await response.json();
      console.log('Réponse de l\'API Grok:', data);
      
      // Extraire l'URL de l'image selon le format documenté
      const imageUrl = data.data[0].url;
      console.log('URL de l\'image extraite:', imageUrl);
      
      if (!imageUrl) {
        throw new Error('Impossible d\'extraire l\'URL de l\'image de la réponse');
      }
      
      logger.debug('URL de l\'image générée:', imageUrl);
      
      // Si nous avons une URL d'image, tenter de la télécharger
      try {
        console.log('Téléchargement de l\'image...');
        const imageResponse = await fetch(imageUrl, { 
          signal: (new AbortController()).signal
        });
        
        if (!imageResponse.ok) {
          throw new Error(`Erreur lors du téléchargement de l'image: ${imageResponse.status}`);
        }
        
        const imageBlob = await imageResponse.blob();
        const localImageUrl = URL.createObjectURL(imageBlob);
        
        logger.info('Image téléchargée et URL locale créée avec succès');
        console.log('Image téléchargée avec succès');
        
        return {
          imageUrl: localImageUrl,
          prompt: finalPrompt
        };
      } catch (downloadError) {
        // En cas d'erreur de téléchargement (CORS, etc.), utiliser directement l'URL
        console.warn('Erreur lors du téléchargement de l\'image:', downloadError);
        logger.warn('Erreur lors du téléchargement de l\'image, utilisation de l\'URL directe');
        
        return {
          imageUrl: imageUrl,
          prompt: finalPrompt,
          error: "L'image a été générée mais ne peut pas être téléchargée. Cliquez pour l'ouvrir dans un nouvel onglet."
        };
      }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('Erreur lors de la requête fetch:', fetchError);
      
      // Essayer avec l'autre endpoint
      console.log('Tentative avec l\'endpoint alternatif...');
      
      try {
        // Essai avec cURL pur REST selon la documentation
        console.log('Tentative avec cURL pur REST selon la documentation...');
        
        // Fonction pour effectuer la requête alternative avec retry
        const fetchAltWithRetry = async (retryCount = 0): Promise<Response> => {
          try {
            const response = await fetch(API_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${API_KEY}`, // Format d'authentification correct
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: "grok-2-image", // Modèle recommandé
                prompt: finalPrompt,
                n: 1,
                response_format: "url" // Format de réponse explicite
              })
            });
            
            // Si on a une erreur 429 (rate limit) et qu'on n'a pas dépassé le nombre max de tentatives
            if (response.status === 429 && retryCount < MAX_RETRIES) {
              console.log(`Rate limit atteint (429), nouvelle tentative alternative ${retryCount + 1}/${MAX_RETRIES} dans ${RETRY_DELAY * (retryCount + 1)}ms...`);
              
              // Attendre avec un délai exponentiel
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
              
              // Réessayer
              return fetchAltWithRetry(retryCount + 1);
            }
            
            return response;
          } catch (error) {
            // Pour les erreurs réseau, réessayer si possible
            if (error instanceof Error && retryCount < MAX_RETRIES) {
              console.log(`Erreur réseau alternative, nouvelle tentative ${retryCount + 1}/${MAX_RETRIES} dans ${RETRY_DELAY * (retryCount + 1)}ms...`);
              
              // Attendre avec un délai exponentiel
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
              
              // Réessayer
              return fetchAltWithRetry(retryCount + 1);
            }
            
            throw error;
          }
        };
        
        // Exécuter la requête alternative avec retry
        const alternativeResponse = await fetchAltWithRetry();
        
        // Meilleure gestion des erreurs pour l'endpoint alternatif
        if (!alternativeResponse.ok) {
          const errorText = await alternativeResponse.text();
          console.error('Réponse d\'erreur alternative complète:', {
            status: alternativeResponse.status,
            statusText: alternativeResponse.statusText,
            body: errorText
          });
          throw new Error(`Erreur API alternative: ${alternativeResponse.status} - ${alternativeResponse.statusText}`);
        }
        
        const altResponseText = await alternativeResponse.text();
        console.log('Réponse brute de l\'API alternative:', altResponseText);
        
        // Tenter de parser la réponse comme JSON
        let altData;
        try {
          altData = JSON.parse(altResponseText);
        } catch (parseError) {
          // Si ce n'est pas du JSON valide, vérifier si c'est une URL directe
          if (altResponseText.trim().startsWith('http')) {
            return {
              imageUrl: altResponseText.trim(),
              prompt: finalPrompt
            };
          } else {
            throw new Error('Format de réponse alternative non reconnu');
          }
        }
        
        // Extraire l'URL de l'image selon le format documenté
        const altImageUrl = altData.data[0].url;
        console.log('URL alternative extraite:', altImageUrl);
        
        if (!altImageUrl) {
          throw new Error('Format de réponse alternative non reconnu');
        }
        
        return {
          imageUrl: altImageUrl,
          prompt: finalPrompt
        };
        
      } catch (altError) {
        console.error('Erreur avec l\'endpoint alternatif:', altError);
        throw altError; // Propager l'erreur pour être gérée par le bloc catch principal
      }
    }
    
    logger.info('Image générée avec succès');
    logger.groupEnd();
    
  } catch (error: unknown) {
    logger.error('Erreur lors de la génération de l\'image:', error);
    console.error('Erreur détaillée lors de la génération d\'image:', error);
    
    // Erreurs spécifiques
    let errorMessage = "Erreur lors de la génération d'image";
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = "Délai d'attente dépassé lors de la génération d'image";
      } else if (error.message.includes('401')) {
        errorMessage = "Clé API invalide ou expirée";
      } else if (error.message.includes('429')) {
        errorMessage = "Limite de requêtes API dépassée";
      } else if (error.message.includes('Network Error')) {
        errorMessage = "Problème de connexion réseau";
      } else {
        errorMessage = error.message;
      }
    }
    
    // Utiliser une image de fallback en cas d'erreur
    console.log('Utilisation d\'une image de fallback suite à une erreur');
    const fallbackUrl = getFallbackImageUrl(mainEnvironment, mainEmotion);
    
    // Utiliser le texte original comme prompt
    const description = text.length > 150 ? text.substring(0, 150) + '...' : text;
    
    return {
      imageUrl: fallbackUrl,
      prompt: description,
      error: errorMessage
    };
  }
};

/**
 * Extrait des mots-clés pertinents du texte et les organise en prompt formaté
 * @param text Le texte à analyser
 * @returns Liste de mots-clés organisés pour un prompt d'image
 */
const extractKeywordsFromText = (text: string): string[] => {
  const result = [];
  
  // Styles artistiques à ajouter au début (optimisés pour Grok)
  const styles = ['fine art photography', 'artistic portrait', 'renaissance painting', 'romantic illustration', 'oil painting', 'digital art'];
  result.push(styles[Math.floor(Math.random() * styles.length)]);
  
  // Personnages
  result.push('elegant couple');
  
  // Actions suggestives mais appropriées
  const actions = ['intimate embrace', 'tender moment', 'passionate gaze', 'gentle touch', 'romantic connection'];
  result.push(actions[Math.floor(Math.random() * actions.length)]);
  
  // Environnements
  const environments = ['luxurious bedroom', 'elegant room', 'romantic setting', 'intimate space'];
  result.push(environments[Math.floor(Math.random() * environments.length)]);
  
  // Éclairage
  const lighting = ['soft lighting', 'warm glow', 'candlelight', 'golden hour light'];
  result.push(lighting[Math.floor(Math.random() * lighting.length)]);
  
  // Ambiance
  const mood = ['romantic atmosphere', 'emotional connection', 'sensual mood', 'intimate ambiance'];
  result.push(mood[Math.floor(Math.random() * mood.length)]);
  
  // Qualité (optimisée pour Grok)
  result.push('high quality, detailed, 8k, artistic composition');
  
  return result;
};
