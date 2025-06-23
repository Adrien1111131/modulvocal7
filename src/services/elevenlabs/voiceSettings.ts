import { logger } from '../../config/development';
import { ContextualMoodPattern, ContextualMoodType, TextAnalysis, VoiceSettings } from './types';

// Mots-clés émotionnels pour l'analyse du texte
export const emotionKeywords = {
  sensuel: ['désir', 'doux', 'caresse', 'peau', 'frisson', 'sensuel', 'chaleur', 'corps'],
  excite: ['gémis', 'soupir', 'excité', 'passionné', 'brûlant', 'urgent', 'envie', 'trembler'],
  jouissance: ['extase', 'jouir', 'orgasme', 'plaisir', 'délice', 'intense', 'explosion'],
  murmure: ['murmure', 'souffle', 'chuchote', 'doux', 'tendre', 'délicat'],
  intense: ['fort', 'intense', 'profond', 'puissant', 'violent', 'ardent', 'sauvage'],
  doux: ['tendre', 'doux', 'délicat', 'léger', 'suave', 'douceur']
};

// Patterns de prosodie pour les différentes ambiances émotionnelles avec limites de vitesse
export const contextualMoodPatterns: Record<Exclude<ContextualMoodType, 'neutral'>, ContextualMoodPattern> = {
  anticipation: { pitch: '+5%', rate: '40%' },   // Limité à 40% au lieu de 55%
  tension: { pitch: '+10%', rate: '45%' },       // Limité à 45% au lieu de 65%
  relaxation: { pitch: '-5%', rate: '35%' },     // Ralenti davantage pour plus de détente
  intimacy: { pitch: '-12%', rate: '30%' },      // Encore plus lent pour l'intimité
  passion: { pitch: '+8%', rate: '40%' }         // Limité à 40% au lieu de 60%
};

/**
 * Calcule les paramètres vocaux en fonction de l'émotion et de l'analyse du texte
 * @param emotion L'émotion dominante du texte
 * @param analysis L'analyse du texte
 * @returns Les paramètres vocaux ajustés
 */
export const getVoiceSettings = (emotion: string, analysis: TextAnalysis): VoiceSettings => {
  logger.group('Calcul des paramètres de voix');
  logger.debug('Émotion:', emotion);
  logger.debug('Analyse:', analysis);
  
  // Paramètres ajustés pour plus de sensualité, de profondeur et de variations naturelles
  const baseSettings: Record<string, VoiceSettings> = {
    sensuel: {
      stability: 0.65,  // Légèrement réduit pour plus de variations naturelles
      similarity_boost: 0.9  // Maintenu pour l'expressivité
    },
    excite: {
      stability: 0.35,  // Réduit pour plus de variations émotionnelles
      similarity_boost: 0.95
    },
    jouissance: {
      stability: 0.25,  // Réduit pour plus d'expressivité dans les moments intenses
      similarity_boost: 0.98  // Presque maximal pour une forte expressivité
    },
    murmure: {
      stability: 0.75, // Réduit pour plus de variations naturelles tout en gardant le contrôle
      similarity_boost: 0.85  // Ajusté pour plus de naturel
    },
    intense: {
      stability: 0.35,  // Réduit pour plus de variations émotionnelles
      similarity_boost: 0.95 // Maintenu pour l'expressivité
    },
    doux: {
      stability: 0.7, // Légèrement réduit
      similarity_boost: 0.85 // Maintenu pour l'expressivité
    }
  };

  const settings = baseSettings[emotion] || baseSettings.sensuel;
  const adjustedSettings = {
    ...settings,
    // Ajustements plus dynamiques pour une meilleure expressivité
    stability: Math.max(0.2, Math.min(0.8, settings.stability * (1 - analysis.intensity * 0.4))),
    similarity_boost: Math.max(0.7, Math.min(1.0, settings.similarity_boost + analysis.emotionalProgression * 0.2))
  };

  logger.debug('Paramètres ajustés:', adjustedSettings);
  logger.groupEnd();
  return adjustedSettings;
};

/**
 * Calcule la durée de transition entre deux émotions
 * @param currentEmotion L'émotion actuelle
 * @param nextEmotion L'émotion suivante
 * @returns La durée de transition en millisecondes
 */
export const calculateEmotionTransitionDuration = (currentEmotion: string, nextEmotion: string): number => {
  // Définir les durées de transition entre les émotions
  const transitionMap: Record<string, Record<string, number>> = {
    sensuel: {
      excite: 600,
      jouissance: 800,
      murmure: 400,
      intense: 700,
      doux: 300
    },
    excite: {
      sensuel: 600,
      jouissance: 400,
      murmure: 700,
      intense: 500,
      doux: 800
    },
    jouissance: {
      sensuel: 800,
      excite: 400,
      murmure: 900,
      intense: 300,
      doux: 1000
    },
    murmure: {
      sensuel: 400,
      excite: 700,
      jouissance: 900,
      intense: 800,
      doux: 300
    },
    intense: {
      sensuel: 700,
      excite: 500,
      jouissance: 300,
      murmure: 800,
      doux: 900
    },
    doux: {
      sensuel: 300,
      excite: 800,
      jouissance: 1000,
      murmure: 300,
      intense: 900
    }
  };

  return transitionMap[currentEmotion]?.[nextEmotion] || 500;
};
