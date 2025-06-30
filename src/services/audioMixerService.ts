import { logger } from '../config/development';

export interface AudioSegment {
  startTime: number;
  duration: number;
  audioUrl: string;
  environment?: string;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface MixedAudioResult {
  audioUrl: string;
  duration: number;
  segments: AudioSegment[];
}

class AudioMixerService {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private segmentNodes: Map<string, AudioBufferSourceNode> = new Map();
  private environmentNodes: Map<string, AudioBufferSourceNode> = new Map();

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      // Vérifier si le contexte audio est déjà initialisé
      if (this.audioContext) {
        logger.info('Contexte audio déjà initialisé');
        return;
      }

      // Vérifier si l'API Web Audio est disponible
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new Error('Web Audio API non supportée par ce navigateur');
      }

      // Créer le contexte audio avec gestion des erreurs détaillée
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        logger.info('Contexte audio créé avec succès');
      } catch (contextError) {
        logger.error('Erreur lors de la création du contexte audio:', contextError);
        throw contextError;
      }

      // Créer et connecter le nœud de gain principal
      try {
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
        logger.info('Nœud de gain principal créé et connecté');
      } catch (gainError) {
        logger.error('Erreur lors de la création du nœud de gain:', gainError);
        throw gainError;
      }

      // Vérifier l'état du contexte audio
      logger.info('État du contexte audio:', this.audioContext.state);
      if (this.audioContext.state === 'suspended') {
        logger.warn('Le contexte audio est suspendu, une interaction utilisateur peut être nécessaire');
      }

      logger.info('Contexte audio du mixeur initialisé avec succès');
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du contexte audio:', error);
      console.error('Détails de l\'erreur d\'initialisation:', {
        error,
        audioContext: this.audioContext,
        masterGainNode: this.masterGainNode,
        userAgent: window.navigator.userAgent,
        isSecureContext: window.isSecureContext
      });
      throw error;
    }
  }

  private async fetchAudioBuffer(url: string): Promise<AudioBuffer> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext!.decodeAudioData(arrayBuffer);
    } catch (error) {
      logger.error('Erreur lors du chargement de l\'audio:', error);
      throw error;
    }
  }

  private createGainNode(): GainNode {
    return this.audioContext!.createGain();
  }

  private applyFadeEffect(gainNode: GainNode, startTime: number, duration: number, fadeIn?: number, fadeOut?: number, emotion?: string) {
    const currentTime = this.audioContext!.currentTime;
    
    // Utiliser des courbes logarithmiques pour des fondus plus naturels
    gainNode.gain.setValueAtTime(0.001, currentTime + startTime); // Éviter la valeur 0 pour les courbes exponentielles

    if (fadeIn && fadeIn > 0) {
      // Courbe exponentielle pour un fondu d'entrée plus naturel
      gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + startTime);
      gainNode.gain.exponentialRampToValueAtTime(1, currentTime + startTime + fadeIn);
    } else {
      gainNode.gain.setValueAtTime(1, currentTime + startTime);
    }

    if (fadeOut && fadeOut > 0) {
      // Maintenir le niveau jusqu'au début du fondu de sortie
      gainNode.gain.setValueAtTime(1, currentTime + startTime + duration - fadeOut);
      // Courbe exponentielle pour un fondu de sortie plus naturel
      gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + startTime + duration);
    }
  }

  /**
   * Calcule la durée de crossfade adaptative entre deux segments
   */
  private calculateAdaptiveCrossfade(segment1: AudioSegment, segment2: AudioSegment): number {
    const minDuration = Math.min(segment1.duration, segment2.duration);
    
    // Calculer la distance émotionnelle (approximation basée sur l'environnement)
    const emotionalDistance = this.getEmotionalDistance(segment1.environment || 'default', segment2.environment || 'default');
    
    // Crossfade plus court pour émotions similaires, plus long pour transitions importantes
    let baseCrossfade = emotionalDistance > 0.7 ? 0.4 : 0.15;
    
    // Limiter le crossfade à maximum 20% de la durée du segment le plus court
    const maxCrossfade = minDuration * 0.2;
    baseCrossfade = Math.min(baseCrossfade, maxCrossfade);
    
    // Minimum de 50ms pour éviter les clics
    return Math.max(0.05, baseCrossfade);
  }

  /**
   * Calcule la distance émotionnelle approximative entre deux environnements
   */
  private getEmotionalDistance(env1: string, env2: string): number {
    const emotionalMap: Record<string, number> = {
      'chambre': 0.5,
      'plage': 0.3,
      'forêt': 0.2,
      'pluie': 0.4,
      'ville': 0.8,
      'default': 0.5
    };
    
    const val1 = emotionalMap[env1] || 0.5;
    const val2 = emotionalMap[env2] || 0.5;
    
    return Math.abs(val1 - val2);
  }

  /**
   * Applique une compression dynamique contextuelle
   */
  private applyDynamicCompression(buffer: AudioBuffer, emotion?: string): void {
    // Paramètres de compression selon l'émotion
    const compressionParams = this.getCompressionParams(emotion);
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        const absSample = Math.abs(sample);
        
        if (absSample > compressionParams.threshold) {
          // Appliquer la compression
          const excess = absSample - compressionParams.threshold;
          const compressedExcess = excess / compressionParams.ratio;
          const newLevel = compressionParams.threshold + compressedExcess;
          
          channelData[i] = sample >= 0 ? newLevel : -newLevel;
        }
      }
    }
  }

  /**
   * Obtient les paramètres de compression selon l'émotion
   */
  private getCompressionParams(emotion?: string): { threshold: number; ratio: number } {
    switch (emotion) {
      case 'murmure':
        return { threshold: 0.3, ratio: 2 }; // Compression douce pour préserver les nuances
      case 'jouissance':
        return { threshold: 0.6, ratio: 4 }; // Compression plus forte pour contrôler les pics
      case 'excite':
        return { threshold: 0.5, ratio: 3 };
      case 'sensuel':
        return { threshold: 0.4, ratio: 2.5 };
      default:
        return { threshold: 0.5, ratio: 2.5 };
    }
  }

  /**
   * Calcule le volume d'environnement avec ducking intelligent
   */
  private calculateEnvironmentVolume(baseVolume: number, voiceIntensity: number, emotion?: string): number {
    // Facteur de ducking selon l'émotion
    const duckingFactor = emotion === 'murmure' ? 0.3 : 
                         emotion === 'jouissance' ? 0.8 : 
                         emotion === 'excite' ? 0.7 : 0.6;
    
    // Réduire l'ambiance quand la voix est intense
    const duckingReduction = voiceIntensity * duckingFactor;
    return baseVolume * (1 - duckingReduction);
  }

  /**
   * Estime l'intensité vocale approximative basée sur l'environnement
   */
  private estimateVoiceIntensity(environment?: string): number {
    // Mapping approximatif environnement -> intensité vocale probable
    const intensityMap: Record<string, number> = {
      'chambre': 0.7,     // Environnement intime, voix probablement intense
      'plage': 0.4,       // Environnement relaxant, voix plus douce
      'forêt': 0.3,       // Environnement calme, voix douce
      'pluie': 0.5,       // Environnement méditatif, voix modérée
      'ville': 0.6,       // Environnement urbain, voix modérément intense
      'murmure': 0.2,     // Voix très douce
      'jouissance': 0.9,  // Voix très intense
      'excite': 0.8,      // Voix intense
      'sensuel': 0.6,     // Voix modérément intense
      'default': 0.5      // Intensité moyenne par défaut
    };
    
    return intensityMap[environment || 'default'] || 0.5;
  }

  private normalizeBuffer(buffer: AudioBuffer, targetLevel: number = 0.9): void {
    // Trouver la valeur maximale dans le buffer
    let maxValue = 0;
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        const absValue = Math.abs(channelData[i]);
        if (absValue > maxValue) {
          maxValue = absValue;
        }
      }
    }
    
    // Si le niveau maximum est déjà inférieur à la cible, pas besoin de normaliser
    if (maxValue <= targetLevel) {
      logger.debug('Pas besoin de normalisation, niveau maximum:', maxValue);
      return;
    }
    
    // Calculer le facteur de gain pour atteindre le niveau cible
    const gainFactor = targetLevel / maxValue;
    logger.debug('Normalisation avec facteur de gain:', gainFactor);
    
    // Appliquer le gain à tous les échantillons
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] *= gainFactor;
      }
    }
  }

  public async mixAudioSegments(segments: AudioSegment[]): Promise<MixedAudioResult> {
    if (!this.audioContext) {
      throw new Error('Contexte audio non initialisé');
    }

    try {
      logger.group('Mixage des segments audio');
      logger.info('Début du mixage de', segments.length, 'segments');

      // Vérifier s'il y a des segments
      if (segments.length === 0) {
        throw new Error('Aucun segment audio à mixer');
      }

      // Si un seul segment, retourner directement son URL
      if (segments.length === 1) {
        logger.info('Un seul segment audio, pas besoin de mixage');
        const segment = segments[0];
        logger.info('URL audio utilisée:', segment.audioUrl);
        logger.info('Mixage terminé avec succès');
        logger.groupEnd();
        return {
          audioUrl: segment.audioUrl,
          duration: segment.duration,
          segments: [segment]
        };
      }

      // Trier les segments par temps de début
      segments.sort((a, b) => a.startTime - b.startTime);
      
      // Calculer la durée totale
      const totalDuration = segments.reduce((max, segment) => {
        return Math.max(max, segment.startTime + segment.duration);
      }, 0);
      
      logger.info('Durée totale calculée:', totalDuration);

      // Créer un buffer pour le mixage final
      const sampleRate = this.audioContext.sampleRate;
      const totalSamples = Math.ceil(totalDuration * sampleRate);
      const mixBuffer = this.audioContext.createBuffer(
        2, // stéréo
        totalSamples,
        sampleRate
      );
      
      // Paramètres de crossfade
      const defaultCrossfadeDuration = 0.3; // 300ms de crossfade par défaut (réduit pour éviter les chevauchements)
      
      // Charger et mixer chaque segment avec les nouvelles améliorations
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const nextSegment = i < segments.length - 1 ? segments[i + 1] : null;
        
        logger.debug('Traitement du segment:', i, segment);
        
        // Charger le buffer audio
        const buffer = await this.fetchAudioBuffer(segment.audioUrl);
        
        // Appliquer la compression dynamique selon l'environnement (approximation de l'émotion)
        this.applyDynamicCompression(buffer, segment.environment);
        
        // Calculer le crossfade adaptatif
        let crossfadeOut = 0;
        if (nextSegment) {
          crossfadeOut = this.calculateAdaptiveCrossfade(segment, nextSegment);
        }
        
        // Calculer les paramètres de fondu optimisés
        const fadeIn = segment.fadeIn || 0.08; // Réduit de 0.1 à 0.08 pour plus de fluidité
        let fadeOut = segment.fadeOut || crossfadeOut;
        
        // Limiter le fadeOut à maximum 25% de la durée du segment (réduit de 30% à 25%)
        if (fadeOut > segment.duration * 0.25) {
          fadeOut = segment.duration * 0.25;
        }
        
        // Calculer l'intensité vocale approximative pour le ducking
        const voiceIntensity = this.estimateVoiceIntensity(segment.environment);
        
        // Ajuster le volume avec ducking intelligent si c'est un son d'environnement
        let adjustedVolume = segment.volume || 1.0;
        if (segment.environment && segment.volume && segment.volume < 0.5) {
          // C'est probablement un son d'environnement, appliquer le ducking
          adjustedVolume = this.calculateEnvironmentVolume(segment.volume, voiceIntensity, segment.environment);
        }
        
        logger.debug('Paramètres de fondu optimisés:', { 
          fadeIn, 
          fadeOut, 
          crossfadeOut, 
          adjustedVolume,
          voiceIntensity 
        });
        
        // Calculer les positions en échantillons
        const startSample = Math.floor(segment.startTime * sampleRate);
        const segmentSamples = buffer.length;
        
        // Mixer le segment dans le buffer principal avec courbes exponentielles
        for (let channel = 0; channel < 2; channel++) {
          const mixChannelData = mixBuffer.getChannelData(channel);
          const segmentChannelData = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
          
          for (let s = 0; s < segmentSamples; s++) {
            const targetSample = startSample + s;
            if (targetSample >= totalSamples) break;
            
            // Appliquer les fondus avec courbes exponentielles pour plus de naturel
            let gain = adjustedVolume;
            
            // Fondu d'entrée avec courbe exponentielle
            if (s < fadeIn * sampleRate) {
              const fadeProgress = s / (fadeIn * sampleRate);
              // Courbe exponentielle douce (éviter 0 pour éviter -Infinity)
              gain *= Math.pow(Math.max(0.001, fadeProgress), 0.5);
            }
            
            // Fondu de sortie avec courbe exponentielle
            if (s > segmentSamples - (fadeOut * sampleRate)) {
              const fadeProgress = (segmentSamples - s) / (fadeOut * sampleRate);
              // Courbe exponentielle douce
              gain *= Math.pow(Math.max(0.001, fadeProgress), 0.5);
            }
            
            // Mixer avec le contenu existant (addition)
            mixChannelData[targetSample] += segmentChannelData[s] * gain;
          }
        }
      }
      
      // Normaliser le buffer pour éviter l'écrêtage
      this.normalizeBuffer(mixBuffer);
      
      // Créer un blob avec le résultat final
      const finalBuffer = await this.exportToBuffer(mixBuffer);
      const audioBlob = new Blob([finalBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      logger.info('Mixage terminé avec succès');
      logger.info('URL audio générée:', audioUrl);
      logger.groupEnd();

      return {
        audioUrl,
        duration: totalDuration,
        segments
      };
    } catch (error) {
      logger.error('Erreur lors du mixage audio:', error);
      throw error;
    }
  }

  private async exportToBuffer(buffer: AudioBuffer): Promise<ArrayBuffer> {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // En-tête WAV
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Données audio
    const channelData = new Float32Array(buffer.length);
    const offset = 44;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      buffer.copyFromChannel(channelData, channel, 0);
      for (let i = 0; i < buffer.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset + (i * buffer.numberOfChannels + channel) * 2, sample * 0x7FFF, true);
      }
    }

    return arrayBuffer;
  }

  public stopAll() {
    this.segmentNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (error) {
        logger.error('Erreur lors de l\'arrêt d\'un segment:', error);
      }
    });
    this.segmentNodes.clear();

    this.environmentNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (error) {
        logger.error('Erreur lors de l\'arrêt d\'un son d\'environnement:', error);
      }
    });
    this.environmentNodes.clear();
  }

  public setMasterVolume(volume: number) {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  public async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public async suspend() {
    if (this.audioContext?.state === 'running') {
      await this.audioContext.suspend();
    }
  }
}

export const audioMixerService = new AudioMixerService();
