import React, { useRef, useEffect, useState } from 'react';
import { audioMixerService } from '../services/audioMixerService';
import { logger } from '../config/development';
import ImageDisplay from './ImageDisplay';
import { generateImageFromText } from '../services/grokImageService';

interface VoicePlayerProps {
  audioUrl: string | null;
  environment?: string;
  emotion?: string;
  originalText?: string; // Ajout du texte original
}

const VoicePlayer: React.FC<VoicePlayerProps> = ({ 
  audioUrl,
  environment = 'default',
  emotion = 'sensuel',
  originalText = ''
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('VoicePlayer - useEffect [audioUrl]', { audioUrl });
    
    if (audioRef.current && audioUrl) {
      console.log('VoicePlayer - Chargement de l\'audio', { audioUrl });
      audioRef.current.load();
      
      // Ajouter un gestionnaire d'événements pour les erreurs de chargement
      const handleError = (e: ErrorEvent) => {
        console.error('VoicePlayer - Erreur de chargement audio:', e);
      };
      
      // Ajouter un gestionnaire d'événements pour le chargement réussi
      const handleCanPlay = () => {
        console.log('VoicePlayer - Audio prêt à être lu');
        // Activer les contrôles audio natifs pour une meilleure compatibilité
        if (audioRef.current) {
          audioRef.current.controls = true;
        }
        // Indiquer que l'audio est chargé
        setIsLoading(false);
      };
      
      audioRef.current.addEventListener('error', handleError as any);
      audioRef.current.addEventListener('canplay', handleCanPlay);
      
      // Initialiser le mixeur audio
      audioMixerService.resume();
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('error', handleError as any);
          audioRef.current.removeEventListener('canplay', handleCanPlay);
        }
        // Nettoyer le mixeur audio
        audioMixerService.stopAll();
      };
    }
    
    return () => {
      // Nettoyer le mixeur audio
      audioMixerService.stopAll();
    };
  }, [audioUrl, environment]);

  useEffect(() => {
    // Gérer les événements de lecture/pause de l'audio
    const handleAudioPlay = () => {
      setIsPlaying(true);
      // Reprendre le mixeur
      audioMixerService.resume();
    };

    const handleAudioPause = () => {
      setIsPlaying(false);
      // Mettre en pause le mixeur
      audioMixerService.suspend();
    };

    const handleAudioEnded = () => {
      setIsPlaying(false);
      // Arrêter le mixeur
      audioMixerService.stopAll();
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
      }
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('play', handleAudioPlay);
      audioRef.current.addEventListener('pause', handleAudioPause);
      audioRef.current.addEventListener('ended', handleAudioEnded);
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handleAudioPlay);
        audioRef.current.removeEventListener('pause', handleAudioPause);
        audioRef.current.removeEventListener('ended', handleAudioEnded);
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, []);

  useEffect(() => {
    // Synchroniser le volume du mixeur avec le volume du lecteur
    audioMixerService.setMasterVolume(volume);
  }, [volume]);
  
  // Fonction pour régénérer l'image
  const handleRegenerateImage = () => {
    setImageUrl(null);
    setImagePrompt('');
    setImageError(undefined);
    setIsGeneratingImage(false); // Ceci déclenchera la régénération via l'useEffect
  };
  
  // Générer l'image lorsque l'audio est disponible
  useEffect(() => {
    if (audioUrl && originalText && !imageUrl && !isGeneratingImage) {
      const generateImage = async () => {
        try {
          setIsGeneratingImage(true);
          console.log('Génération d\'image pour le texte:', originalText.substring(0, 50) + '...');
          
          // Utiliser le texte original directement
          const result = await generateImageFromText(originalText);
          setImageUrl(result.imageUrl);
          
          // Utiliser le texte original comme prompt au lieu du prompt généré
          // Limiter la longueur pour l'affichage
          const displayText = originalText.length > 150 ? 
            originalText.substring(0, 150) + '...' : 
            originalText;
          
          setImagePrompt(displayText);
          setImageError(result.error); // Stocker l'erreur éventuelle
        } catch (error) {
          console.error('Erreur lors de la génération de l\'image:', error);
          setImageError(error instanceof Error ? error.message : 'Erreur inconnue');
        } finally {
          setIsGeneratingImage(false);
        }
      };
      
      generateImage();
    }
  }, [audioUrl, originalText, imageUrl, isGeneratingImage]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => {
        logger.error('Erreur lors de la lecture:', error);
      });
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        logger.error('Erreur lors du redémarrage:', error);
      });
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-player">
      {audioUrl ? (
        <div>
          {isLoading && (
            <div className="hearts-loading">
              <div className="heart heart1"></div>
              <div className="heart heart2"></div>
              <div className="heart heart3"></div>
              <div className="heart heart4"></div>
              <div className="heart heart5"></div>
              <div className="loading-text">Chargement de l'audio...</div>
            </div>
          )}
          <audio 
            ref={audioRef} 
            src={audioUrl}
            controls
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <div className="player-info">
            <span className="environment-display">Environnement: {environment}</span>
            <span className="emotion-display">Émotion: {emotion}</span>
          </div>
          
          {/* Section d'image améliorée */}
          <div className="player-image-section">
            <h3 className="image-section-title">Illustration générée</h3>
            {isGeneratingImage ? (
              <div className="image-loading">
                <div className="spinner"></div>
                <p>Génération de l'illustration en cours...</p>
              </div>
            ) : (
              <ImageDisplay 
                imageUrl={imageUrl} 
                prompt={imagePrompt} 
                error={imageError}
                onRegenerateClick={handleRegenerateImage}
              />
            )}
          </div>
        </div>
      ) : (
        <p>Aucun audio disponible</p>
      )}
      <style>
        {`
          .voice-player {
            background: linear-gradient(135deg, #1e2a3b, #121212);
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            color: #fff;
            max-width: 600px;
            margin: 0 auto;
          }

          .player-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .player-button {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 4px;
            background: #1DB954;
            color: white;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
          }

          .player-button:disabled {
            background: #333;
            cursor: not-allowed;
          }

          .player-button:not(:disabled):hover {
            background: #1ed760;
            transform: scale(1.05);
          }

          .progress-container {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .progress-slider {
            flex: 1;
            height: 4px;
            -webkit-appearance: none;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            outline: none;
          }

          .progress-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            background: #1DB954;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }

          .volume-container {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .volume-slider {
            width: 100px;
            height: 4px;
            -webkit-appearance: none;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            outline: none;
          }

          .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            background: #1DB954;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }

          .time {
            font-family: 'Courier New', monospace;
            min-width: 4ch;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.8rem;
          }

          .volume-label {
            min-width: 60px;
            color: rgba(255, 255, 255, 0.7);
          }

          .player-info {
            margin-top: 1rem;
            padding: 0.8rem;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            margin-bottom: 1rem;
          }

          .environment-display {
            font-style: italic;
            color: rgba(255, 255, 255, 0.7);
          }

          .emotion-display {
            color: #1DB954;
            font-weight: bold;
          }
          
          .player-image-section {
            margin-top: 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 1rem;
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          }
          
          .image-section-title {
            margin-top: 0;
            margin-bottom: 1rem;
            color: #fff;
            font-size: 1.2rem;
            text-align: center;
          }
          
          .image-loading {
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            font-style: italic;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          
          .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #1DB954;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Animation des cœurs */
          .hearts-loading {
            position: relative;
            height: 80px;
            margin: 1rem 0;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }
          
          .loading-text {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
            text-align: center;
            position: relative;
            z-index: 2;
          }
          
          .heart {
            position: absolute;
            width: 20px;
            height: 20px;
            background: #ff69b4;
            transform: rotate(45deg);
            opacity: 0;
            z-index: 1;
          }
          
          .heart:before,
          .heart:after {
            content: '';
            width: 20px;
            height: 20px;
            background: #ff69b4;
            border-radius: 50%;
            position: absolute;
          }
          
          .heart:before {
            top: -10px;
            left: 0;
          }
          
          .heart:after {
            top: 0;
            left: -10px;
          }
          
          .heart1 {
            left: 20%;
            animation: float-heart 3s ease-in-out infinite;
            animation-delay: 0s;
          }
          
          .heart2 {
            left: 35%;
            animation: float-heart 3s ease-in-out infinite;
            animation-delay: 0.5s;
          }
          
          .heart3 {
            left: 50%;
            animation: float-heart 3s ease-in-out infinite;
            animation-delay: 1s;
          }
          
          .heart4 {
            left: 65%;
            animation: float-heart 3s ease-in-out infinite;
            animation-delay: 1.5s;
          }
          
          .heart5 {
            left: 80%;
            animation: float-heart 3s ease-in-out infinite;
            animation-delay: 2s;
          }
          
          @keyframes float-heart {
            0% {
              transform: rotate(45deg) translateY(50px);
              opacity: 0;
              scale: 0.3;
            }
            20% {
              opacity: 0.8;
              scale: 0.6;
            }
            80% {
              opacity: 0.6;
              scale: 0.8;
            }
            100% {
              transform: rotate(45deg) translateY(-50px);
              opacity: 0;
              scale: 0.3;
            }
          }

          /* Style pour l'élément audio natif */
          audio {
            width: 100%;
            height: 40px;
            border-radius: 30px;
            background-color: rgba(255, 255, 255, 0.1);
            margin-bottom: 1rem;
          }

          audio::-webkit-media-controls-panel {
            background-color: rgba(29, 185, 84, 0.1);
          }

          audio::-webkit-media-controls-play-button {
            background-color: #1DB954;
            border-radius: 50%;
          }

          audio::-webkit-media-controls-current-time-display,
          audio::-webkit-media-controls-time-remaining-display {
            color: #000000;
            font-weight: bold;
            text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
          }
        `}
      </style>
    </div>
  );
};

export default VoicePlayer;
