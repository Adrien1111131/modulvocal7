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
    <div className="spotify-player">
      {audioUrl ? (
        <div className="player-container">
          {/* Section d'image principale */}
          <div className="player-image-main">
            {isGeneratingImage ? (
              <div className="image-loading">
                <div className="spinner"></div>
                <p>Génération de l'illustration en cours...</p>
              </div>
            ) : (
              <div className="image-with-controls">
                <ImageDisplay 
                  imageUrl={imageUrl} 
                  prompt={imagePrompt} 
                  error={imageError}
                  onRegenerateClick={handleRegenerateImage}
                />
                {/* Bouton play/pause superposé sur l'image */}
                <button 
                  className={`play-button-overlay ${isPlaying ? 'playing' : ''}`}
                  onClick={isPlaying ? handlePause : handlePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  <div className="play-icon">
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" width="100%" height="100%">
                        <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                        <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="100%" height="100%">
                        <path d="M8 5v14l11-7z" fill="currentColor" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>
          
          {/* Contrôles audio cachés pour la fonctionnalité */}
          <audio 
            ref={audioRef} 
            src={audioUrl}
            style={{ display: 'none' }}
          />
          
          {/* Barre de progression style Spotify */}
          <div className="spotify-progress-container">
            <span className="time">{formatTime(currentTime)}</span>
            <div className="progress-bar-wrapper">
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={handleSeek}
                className="spotify-progress-slider"
              />
              <div 
                className="progress-bar-fill" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
            <span className="time">{formatTime(duration)}</span>
          </div>
          
          {/* Contrôles supplémentaires */}
          <div className="player-controls-row">
            <div className="volume-container">
              <span className="volume-icon">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor" />
                </svg>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="spotify-volume-slider"
              />
            </div>
            <div className="player-info">
              <span className="environment-display">Environnement: {environment}</span>
              <span className="emotion-display">Émotion: {emotion}</span>
            </div>
          </div>
        </div>
      ) : (
        <p>Aucun audio disponible</p>
      )}
      <style>
        {`
          .spotify-player {
            background: linear-gradient(135deg, #1e2a3b, #121212);
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            color: #fff;
            max-width: 600px;
            margin: 0 auto;
          }
          
          .player-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
          
          .player-image-main {
            position: relative;
            width: 100%;
            margin: 0 auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          }
          
          .image-with-controls {
            position: relative;
            width: 100%;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .image-with-controls img {
            width: 100%;
            height: auto;
            display: block;
            transition: transform 0.3s ease;
          }
          
          .play-button-overlay {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #1DB954;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            transition: all 0.2s ease-in-out;
            z-index: 10;
          }
          
          .play-button-overlay:hover {
            transform: scale(1.1);
            background: #1ed760;
          }
          
          .play-button-overlay.playing {
            background: #ffffff;
            color: #121212;
          }
          
          .play-icon {
            width: 24px;
            height: 24px;
          }
          
          .spotify-progress-container {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            margin: 0.5rem 0;
          }
          
          .progress-bar-wrapper {
            position: relative;
            flex: 1;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
          }
          
          .spotify-progress-slider {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            -webkit-appearance: none;
            background: transparent;
            margin: 0;
            z-index: 2;
            cursor: pointer;
          }
          
          .spotify-progress-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            background: #fff;
            border-radius: 50%;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
          }
          
          .progress-bar-wrapper:hover .spotify-progress-slider::-webkit-slider-thumb {
            opacity: 1;
          }
          
          .progress-bar-fill {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: #1DB954;
            border-radius: 2px;
            z-index: 1;
            pointer-events: none;
          }
          
          .time {
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.7);
            min-width: 3.5ch;
          }
          
          .player-controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .volume-container {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .volume-icon {
            color: rgba(255, 255, 255, 0.7);
            display: flex;
            align-items: center;
          }
          
          .spotify-volume-slider {
            width: 80px;
            height: 4px;
            -webkit-appearance: none;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            outline: none;
          }
          
          .spotify-volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 10px;
            height: 10px;
            background: #fff;
            border-radius: 50%;
            cursor: pointer;
          }
          
          .player-info {
            display: flex;
            gap: 1rem;
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.7);
          }
          
          .environment-display {
            font-style: italic;
          }
          
          .emotion-display {
            color: #1DB954;
            font-weight: bold;
          }
          
          .image-loading {
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            font-style: italic;
            padding: 4rem 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
          }
          
          .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border-left-color: #1DB954;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default VoicePlayer;
