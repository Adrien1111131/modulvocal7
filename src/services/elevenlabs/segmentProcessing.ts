import { logger } from '../../config/development';
import { analyzeTextEnvironments } from '../grokService';
import { IntonationContext, IntonationMarker, SegmentContext, TextAnalysis, TextSegment } from './types';
import { analyzeText } from './textAnalysis';
import { calculateEmotionTransitionDuration } from './voiceSettings';
import { extractIntonationMarkers } from './ssmlGenerator';

/**
 * Analyse un texte et le divise en segments avec analyse émotionnelle
 * @param text Le texte à analyser
 * @returns Les segments analysés
 */
export const parseTextSegments = async (text: string): Promise<TextSegment[]> => {
  logger.group('Parsing des segments');
  logger.debug('Texte à parser:', text);
  
  const segments: TextSegment[] = [];
  
  // Utiliser l'analyse de Grok pour obtenir les segments et leurs émotions
  const environmentDetections = await analyzeTextEnvironments(text);
  
  // Convertir les détections en segments
  environmentDetections.forEach((detection, i) => {
    const analysis = analyzeText(detection.segment);
    const { markers, contexts } = extractIntonationMarkers(detection.segment);

    // Créer le contexte du segment
    const segmentContext: SegmentContext = {
      previousEmotion: i > 0 ? environmentDetections[i - 1].emotionalTone : undefined,
      nextEmotion: i < environmentDetections.length - 1 ? environmentDetections[i + 1].emotionalTone : undefined,
      transitionDuration: i < environmentDetections.length - 1 ? 
        calculateEmotionTransitionDuration(detection.emotionalTone, environmentDetections[i + 1].emotionalTone) : undefined
    };

    // Ajuster l'analyse en fonction du contexte
    if (segmentContext.previousEmotion) {
      analysis.emotionalProgression *= 1.2;
    }

    // Créer le segment avec les informations de contexte
    segments.push({
      text: detection.segment,
      emotion: detection.emotionalTone,
      analysis,
      intonationMarkers: markers,
      context: segmentContext,
      intonationContexts: contexts
    });
  });

  logger.debug('Segments générés:', segments);
  logger.groupEnd();
  return segments;
};

/**
 * Analyse phonétique approximative pour estimer la durée de prononciation
 */
const analyzePhonemes = (text: string): { phonemeCount: number; complexityFactor: number } => {
  // Compter les syllabes approximativement
  const vowelPattern = /[aeiouyàáâäèéêëìíîïòóôöùúûü]/gi;
  const vowelMatches = text.match(vowelPattern) || [];
  const syllableCount = Math.max(1, vowelMatches.length);
  
  // Facteur de complexité basé sur les consonnes difficiles
  const complexConsonants = /[rlmnpbtdkgfvszjx]/gi;
  const complexMatches = text.match(complexConsonants) || [];
  const complexityFactor = 1 + (complexMatches.length / text.length) * 0.3;
  
  return {
    phonemeCount: syllableCount,
    complexityFactor
  };
};

/**
 * Obtient les mots par minute selon l'émotion
 */
const getWPMForEmotion = (emotion: string): number => {
  const emotionWPM: Record<string, number> = {
    'murmure': 80,      // Très lent
    'sensuel': 100,     // Lent
    'doux': 110,        // Lent-modéré
    'intense': 130,     // Modéré
    'excite': 150,      // Rapide
    'jouissance': 120   // Modéré (pas trop rapide pour rester compréhensible)
  };
  
  return emotionWPM[emotion] || 120; // Défaut modéré
};

/**
 * Obtient le multiplicateur de vitesse selon le débit
 */
const getRateMultiplier = (speechRate: string): number => {
  const rateMultipliers: Record<string, number> = {
    'très lent': 0.7,
    'lent': 0.85,
    'modéré': 1.0,
    'rapide': 1.2
  };
  
  return rateMultipliers[speechRate] || 1.0;
};

/**
 * Calcule la durée précise basée sur l'analyse phonétique et l'émotion
 */
const calculateAccurateDuration = (text: string, speechRate: string, emotion: string): number => {
  const { phonemeCount, complexityFactor } = analyzePhonemes(text);
  
  // Mots par minute selon l'émotion et le débit
  const baseWPM = getWPMForEmotion(emotion);
  const rateMultiplier = getRateMultiplier(speechRate);
  const adjustedWPM = baseWPM * rateMultiplier;
  
  // Estimation basée sur les phonèmes plutôt que les caractères
  const estimatedDuration = (phonemeCount / (adjustedWPM / 60)) * complexityFactor;
  
  // Ajouter du temps pour la ponctuation avec des durées variables
  const punctuationMarks = text.match(/[.!?…]/g) || [];
  const commaMarks = text.match(/[,;:]/g) || [];
  
  let punctuationDuration = 0;
  punctuationMarks.forEach(mark => {
    if (mark === '…') {
      punctuationDuration += 0.8; // Points de suspension plus longs
    } else if (mark === '!') {
      punctuationDuration += 0.5; // Exclamation
    } else if (mark === '?') {
      punctuationDuration += 0.4; // Question
    } else {
      punctuationDuration += 0.3; // Point normal
    }
  });
  
  // Pauses plus courtes pour les virgules
  punctuationDuration += commaMarks.length * 0.15;
  
  return Math.max(0.5, estimatedDuration + punctuationDuration); // Minimum 500ms
};

/**
 * Système de timing adaptatif selon la durée et le contexte
 */
const adaptiveTimingSystem = {
  shortSegments: { 
    threshold: 2.0,
    minGap: 0.08,      // Réduit de 0.1 à 0.08
    maxCrossfade: 0.1,
    fadeInDefault: 0.05,
    fadeOutDefault: 0.08
  },
  mediumSegments: { 
    threshold: 6.0,
    minGap: 0.04,      // Réduit de 0.05 à 0.04
    maxCrossfade: 0.15, // Réduit de 0.2 à 0.15
    fadeInDefault: 0.08,
    fadeOutDefault: 0.12
  },
  longSegments: { 
    threshold: Infinity,
    minGap: 0,
    maxCrossfade: 0.25, // Réduit de 0.3 à 0.25
    fadeInDefault: 0.12,
    fadeOutDefault: 0.15
  }
};

/**
 * Calcule les temps de début et de fin pour chaque segment avec timing optimisé
 * @param segments Les segments à traiter
 * @param options Options de timing (fadeIn, fadeOut, crossfade)
 * @returns Les segments avec timing précis
 */
export const calculateSegmentTiming = (
  segments: any[], 
  options: { defaultFadeIn?: number; defaultFadeOut?: number; defaultCrossfade?: number } = {}
) => {
  // Calculer les temps de début pour chaque segment
  let currentTime = 0;
  
  return segments.map((segment, index) => {
    // Calculer la durée précise du segment
    const accurateDuration = calculateAccurateDuration(
      segment.segment, 
      segment.speechRate || 'lent', 
      segment.emotionalTone || 'sensuel'
    );
    
    // Déterminer le système de timing à utiliser
    let timingSystem = adaptiveTimingSystem.longSegments;
    if (accurateDuration <= adaptiveTimingSystem.shortSegments.threshold) {
      timingSystem = adaptiveTimingSystem.shortSegments;
    } else if (accurateDuration <= adaptiveTimingSystem.mediumSegments.threshold) {
      timingSystem = adaptiveTimingSystem.mediumSegments;
    }
    
    // Calculer les paramètres de fondu optimisés
    const fadeIn = segment.fadeIn || options.defaultFadeIn || timingSystem.fadeInDefault;
    const fadeOut = segment.fadeOut || options.defaultFadeOut || timingSystem.fadeOutDefault;
    
    // Créer l'objet segment avec timing précis
    const segmentWithTiming = {
      ...segment,
      startTime: currentTime,
      duration: accurateDuration,
      fadeIn,
      fadeOut
    };
    
    // Calculer le temps de début du prochain segment
    const nextSegment = index < segments.length - 1 ? segments[index + 1] : null;
    
    if (nextSegment) {
      // Calculer le crossfade optimal entre ce segment et le suivant
      const maxCrossfade = Math.min(
        timingSystem.maxCrossfade,
        accurateDuration * 0.2, // Maximum 20% de la durée du segment
        options.defaultCrossfade || timingSystem.maxCrossfade
      );
      
      // Appliquer le crossfade seulement si les segments sont assez longs
      if (accurateDuration > maxCrossfade * 2) {
        currentTime += accurateDuration - maxCrossfade;
      } else {
        // Pour les segments courts, ajouter un petit gap
        currentTime += accurateDuration + timingSystem.minGap;
      }
    } else {
      // Dernier segment, pas de crossfade
      currentTime += accurateDuration;
    }
    
    return segmentWithTiming;
  });
};
