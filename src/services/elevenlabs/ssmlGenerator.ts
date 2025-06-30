import { logger } from '../../config/development';
import { ContextualMoodType, IntonationContext, IntonationMarker, TextAnalysis } from './types';
import { contextualMoodPatterns } from './voiceSettings';

/**
 * Extrait les marqueurs d'intonation du texte
 * @param text Le texte à analyser
 * @returns Le texte nettoyé et les marqueurs d'intonation extraits
 */
export const extractIntonationMarkers = (text: string): { text: string; markers: IntonationMarker[]; contexts: IntonationContext[] } => {
  // Nettoyer les espaces multiples uniquement
  const cleanText = text.replace(/\s+/g, ' ').trim();
  return { 
    text: cleanText, 
    markers: [], 
    contexts: [] 
  };
};

/**
 * Ajoute des respirations et des pauses au texte en utilisant le format SSML
 * @param text Le texte à traiter
 * @param emotion L'émotion dominante du texte
 * @param analysis L'analyse du texte
 * @returns Le texte au format SSML avec respirations et pauses
 */
export const addBreathingAndPauses = (text: string, emotion: string, analysis: TextAnalysis): string => {
  logger.group('Ajout des respirations et pauses');
  logger.debug('Texte initial:', text);
  logger.debug('Émotion:', emotion);
  logger.debug('Analyse:', analysis);
  
  // Nettoyer le texte des espaces multiples
  text = text.replace(/\s+/g, ' ').trim();

  // Calculer la durée des pauses en fonction de l'intensité et de l'émotion
  let pauseDuration = Math.min(1500, 1000 + (analysis.intensity * 700));
  
  // Ajuster les pauses en fonction de l'émotion
  if (emotion === 'murmure') {
    pauseDuration *= 1.5; // Pauses plus longues pour les murmures
  } else if (emotion === 'sensuel') {
    pauseDuration *= 1.3; // Pauses plus longues pour le ton sensuel
  } else if (emotion === 'jouissance') {
    pauseDuration *= 0.8; // Pauses plus courtes pour la jouissance
  }
  
  // Ajouter des pauses pour la ponctuation avec plus de variations
  text = text.replace(/\.\.\./g, (match) => {
    // Pauses variables pour les points de suspension (tension, anticipation)
    const suspensionPause = pauseDuration * (1.2 + Math.random() * 0.3);
    return `${match}<break time="${suspensionPause}ms"/>`;
  });
  
  text = text.replace(/([.!?])/g, (match) => {
    // Pauses variables selon le type de ponctuation et avec légère randomisation
    let duration;
    if (match === '?') {
      duration = pauseDuration * (1.1 + Math.random() * 0.2); // Question
    } else if (match === '!') {
      duration = pauseDuration * (1.3 + Math.random() * 0.4); // Exclamation
    } else {
      duration = pauseDuration * (0.9 + Math.random() * 0.2); // Point normal
    }
    return `${match}<break time="${Math.round(duration)}ms"/>`;
  });
  
  text = text.replace(/,/g, (match) => {
    // Pauses variables pour les virgules
    const commaPause = pauseDuration * (0.6 + Math.random() * 0.2);
    return `,<break time="${Math.round(commaPause)}ms"/>`;
  });

  // Traiter les onomatopées et interjections spécifiques au contexte érotique
  const eroticSounds = [
    { pattern: /\b(m+m+h+)\b/gi, template: (match: string) => `<say-as interpret-as="interjection">${match}</say-as>` },
    { pattern: /\b(a+h+h+)\b/gi, template: (match: string) => `<say-as interpret-as="interjection">${match}</say-as>` },
    { pattern: /\b(o+h+h+)\b/gi, template: (match: string) => `<say-as interpret-as="interjection">${match}</say-as>` },
    { pattern: /\b(o+u+i+)\b/gi, template: (match: string) => `<say-as interpret-as="interjection">${match}</say-as>` }
  ];
  
  // Appliquer les modèles d'onomatopées
  eroticSounds.forEach(sound => {
    text = text.replace(sound.pattern, sound.template);
  });
  
  // Ajouter des respirations stratégiques en fonction de l'émotion
  if (emotion === 'excite' || emotion === 'jouissance') {
    // Ajouter des respirations haletantes entre certaines phrases
    text = text.replace(/([.!?]<break[^>]*>)([A-Z])/g, (match, p1, p2, offset) => {
      // Ajouter des respirations seulement à certains endroits (pas après chaque phrase)
      return Math.random() > 0.4 ? 
        `${p1}<say-as interpret-as="interjection">inhale</say-as><break time="100ms"/>${p2}` : 
        match;
    });
  } else if (emotion === 'murmure' || emotion === 'sensuel') {
    // Ajouter des respirations douces et profondes
    text = text.replace(/([.!?]<break[^>]*>)([A-Z])/g, (match, p1, p2, offset) => {
      return Math.random() > 0.6 ? 
        `${p1}<say-as interpret-as="interjection">exhale</say-as><break time="200ms"/>${p2}` : 
        match;
    });
  }

  // Appliquer les variations contextuelles avec volume
  // Ne pas définir de valeur de rate ici, car elle sera définie dans generateSegmentSSML
  if (analysis.contextualMood !== 'neutral') {
    const contextPattern = contextualMoodPatterns[analysis.contextualMood];
    
    // Ajouter des variations de volume en fonction de l'émotion
    let volume = "+0dB";
    if (emotion === 'murmure') {
      volume = "-6dB";
    } else if (emotion === 'jouissance') {
      volume = "+4dB";
    } else if (emotion === 'excite') {
      volume = "+2dB";
    } else if (emotion === 'sensuel') {
      volume = "-2dB";
    }
    
    text = `<prosody pitch="${contextPattern.pitch}" volume="${volume}">${text}</prosody>`;
  } else {
    // Ajouter des variations de volume même pour le mode neutre
    const volume = analysis.intensity > 0.7 ? "+2dB" : 
                  analysis.intensity < 0.3 ? "-4dB" : 
                  "+0dB";
    text = `<prosody pitch="-5%" volume="${volume}">${text}</prosody>`;
  }

  // Ajouter des emphases sur les mots importants avec plus de variations
  analysis.emphasis.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    // Varier le niveau d'emphase en fonction de l'intensité et avec une légère randomisation
    const emphasisLevel = analysis.intensity > 0.8 ? 'strong' : 
                         analysis.intensity > 0.5 ? 'moderate' : 
                         'reduced';
    text = text.replace(regex, `<emphasis level="${emphasisLevel}">${word}</emphasis>`);
  });

  logger.debug('Texte avec respirations et variations:', text);
  logger.groupEnd();
  return text;
};

/**
 * Génère des micro-variations naturelles pour les paramètres prosodiques
 */
const generateNaturalVariations = (baseValue: string, variationRange: number = 2): string => {
  // Extraire la valeur numérique du paramètre (ex: "-10%" -> -10)
  const numericValue = parseFloat(baseValue.replace('%', ''));
  
  // Ajouter une variation aléatoire dans la plage spécifiée
  const variation = (Math.random() - 0.5) * 2 * variationRange;
  const newValue = numericValue + variation;
  
  // Retourner la nouvelle valeur formatée
  return `${newValue >= 0 ? '+' : ''}${newValue.toFixed(1)}%`;
};

/**
 * Calcule les paramètres prosodiques optimisés selon l'émotion et l'intensité
 */
const calculateOptimizedProsody = (
  emotion: string, 
  analysis: TextAnalysis, 
  options: { pitch?: string; rate?: string } = {}
): { pitch: string; rate: string; volume: string } => {
  // Paramètres de base selon l'émotion avec micro-variations
  let basePitch: string;
  let baseRate: string;
  let volume: string;
  
  switch (emotion) {
    case 'jouissance':
      basePitch = generateNaturalVariations(options.pitch || '+8%', 3);
      baseRate = generateNaturalVariations(options.rate || '42%', 2); // Réduit de 45% à 42%
      volume = 'loud';
      break;
    case 'excite':
      basePitch = generateNaturalVariations(options.pitch || '+3%', 2);
      baseRate = generateNaturalVariations(options.rate || '38%', 2); // Réduit de 40% à 38%
      volume = 'medium-loud';
      break;
    case 'murmure':
      basePitch = generateNaturalVariations(options.pitch || '-18%', 2);
      baseRate = generateNaturalVariations(options.rate || '25%', 1);
      volume = 'soft';
      break;
    case 'sensuel':
      basePitch = generateNaturalVariations(options.pitch || '-12%', 2);
      baseRate = generateNaturalVariations(options.rate || '30%', 1.5);
      volume = 'medium-soft';
      break;
    case 'intense':
      basePitch = generateNaturalVariations(options.pitch || '+0%', 3);
      baseRate = generateNaturalVariations(options.rate || '36%', 2); // Réduit de 38% à 36%
      volume = 'medium-loud';
      break;
    default:
      basePitch = generateNaturalVariations(options.pitch || '-8%', 2); // Réduit de -10% à -8%
      baseRate = generateNaturalVariations(options.rate || '33%', 2); // Réduit de 35% à 33%
      volume = 'medium';
  }
  
  // Ajustements selon l'intensité de l'analyse
  if (analysis.intensity > 0.8) {
    // Forte intensité : augmenter légèrement le pitch et limiter la vitesse
    const pitchAdjustment = emotion === 'murmure' ? -2 : +3;
    const currentPitch = parseFloat(basePitch.replace(/[+%]/g, ''));
    basePitch = `${currentPitch + pitchAdjustment >= 0 ? '+' : ''}${(currentPitch + pitchAdjustment).toFixed(1)}%`;
    
    // Limiter la vitesse maximale même pour forte intensité
    const currentRate = parseFloat(baseRate.replace('%', ''));
    if (currentRate > 42) {
      baseRate = '42.0%'; // Limite absolue
    }
  } else if (analysis.intensity < 0.3) {
    // Faible intensité : diminuer pitch et vitesse
    const pitchAdjustment = -3;
    const rateAdjustment = -3;
    
    const currentPitch = parseFloat(basePitch.replace(/[+%]/g, ''));
    const currentRate = parseFloat(baseRate.replace('%', ''));
    
    basePitch = `${currentPitch + pitchAdjustment >= 0 ? '+' : ''}${(currentPitch + pitchAdjustment).toFixed(1)}%`;
    baseRate = `${Math.max(20, currentRate + rateAdjustment).toFixed(1)}%`; // Minimum 20%
  }
  
  return { pitch: basePitch, rate: baseRate, volume };
};

/**
 * Génère le SSML pour un segment avec des paramètres spécifiques optimisés
 * @param segment Le texte du segment
 * @param emotion L'émotion dominante
 * @param analysis L'analyse du texte
 * @param options Options supplémentaires (pitch, rate)
 * @returns Le SSML généré et optimisé
 */
export const generateSegmentSSML = (
  segment: string, 
  emotion: string, 
  analysis: TextAnalysis, 
  options: { pitch?: string; rate?: string } = {}
): string => {
  // Calculer les paramètres prosodiques optimisés
  const prosody = calculateOptimizedProsody(emotion, analysis, options);
  
  // Ajouter des variations micro-prosodiques pour plus de naturel
  const processedSegment = addBreathingAndPauses(segment, emotion, analysis);
  
  // Générer un SSML simplifié et optimisé pour ElevenLabs
  // Éviter les balises Amazon non supportées
  return `<speak>
    <prosody pitch="${prosody.pitch}" rate="${prosody.rate}" volume="${prosody.volume}">
      ${processedSegment}
    </prosody>
  </speak>`;
};

/**
 * Ajoute des respirations au SSML en fonction de l'intensité
 * @param ssml Le SSML à modifier
 * @param breathingType Le type de respiration ('haletante' ou 'profonde')
 * @returns Le SSML avec respirations
 */
export const addBreathingToSSML = (ssml: string, breathingType: 'haletante' | 'profonde' | 'légère'): string => {
  if (breathingType === 'haletante') {
    // Ajouter des respirations haletantes entre les phrases avec variations
    return ssml.replace(/([.!?]<break[^>]*>)/g, (match, p1, offset) => {
      // Varier les types de respirations haletantes
      const breathTypes = [
        '<say-as interpret-as="interjection">inhale</say-as><break time="80ms"/>',
        '<say-as interpret-as="interjection">hah</say-as><break time="100ms"/>',
        '<say-as interpret-as="interjection">hmm</say-as><break time="90ms"/>'
      ];
      // Sélectionner aléatoirement un type de respiration
      const randomBreath = breathTypes[Math.floor(Math.random() * breathTypes.length)];
      return `${p1}${randomBreath}`;
    });
  } else if (breathingType === 'profonde') {
    // Ajouter des respirations profondes au début des phrases avec variations
    return ssml.replace(/(<\/break>)([A-Z])/g, (match, p1, p2, offset) => {
      // Varier les types de respirations profondes
      const breathTypes = [
        '<say-as interpret-as="interjection">exhale</say-as><break time="200ms"/>',
        '<say-as interpret-as="interjection">sigh</say-as><break time="180ms"/>',
        '<break time="300ms"/>'
      ];
      // Sélectionner aléatoirement un type de respiration
      const randomBreath = breathTypes[Math.floor(Math.random() * breathTypes.length)];
      return `${p1}${randomBreath}${p2}`;
    });
  } else if (breathingType === 'légère') {
    // Ajouter des respirations légères à des endroits stratégiques
    return ssml.replace(/([,;:])/g, (match, p1, offset) => {
      // N'ajouter des respirations légères qu'occasionnellement
      if (Math.random() > 0.7) {
        return `${p1}<break time="${50 + Math.floor(Math.random() * 50)}ms"/>`;
      }
      return match;
    });
  }
  return ssml;
};
