import React, { useState, useEffect, useRef } from 'react';
import randomImageService from '../services/randomImageService';

interface RandomImageDisplayProps {
  isPlaying: boolean;
  onImageChange?: (imageUrl: string) => void;
}

/**
 * Composant pour afficher des images aléatoires pendant la lecture audio
 * Remplace le système de génération d'images Grok
 */
const RandomImageDisplay: React.FC<RandomImageDisplayProps> = ({ isPlaying, onImageChange }) => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageCount, setImageCount] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);

  // Initialisation du service d'images
  useEffect(() => {
    const initializeService = async () => {
      setIsLoading(true);
      await randomImageService.initialize();
      setImageCount(randomImageService.getImageCount());
      
      if (randomImageService.isReady()) {
        const firstImage = randomImageService.getRandomImageUrl();
        setCurrentImage(firstImage);
        if (onImageChange && firstImage) {
          onImageChange(firstImage);
        }
      }
      setIsLoading(false);
    };

    initializeService();
  }, [onImageChange]);

  // Changement d'image quand la lecture commence
  useEffect(() => {
    if (isPlaying && randomImageService.isReady()) {
      const newImage = randomImageService.getRandomImageUrl();
      setCurrentImage(newImage);
      if (onImageChange && newImage) {
        onImageChange(newImage);
      }
    }
  }, [isPlaying, onImageChange]);

  // Fonction pour changer manuellement d'image
  const changeImage = () => {
    if (randomImageService.isReady()) {
      const newImage = randomImageService.getRandomImageUrl();
      setCurrentImage(newImage);
      if (onImageChange && newImage) {
        onImageChange(newImage);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="random-image-display loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Chargement des images...</p>
        </div>
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="random-image-display error">
        <p>Aucune image disponible</p>
      </div>
    );
  }

  return (
    <div className="random-image-display">
      <div className="image-container">
        <img
          ref={imageRef}
          src={currentImage}
          alt="Image aléatoire"
          className="random-image"
          onLoad={() => {
            // Animation d'apparition fluide
            if (imageRef.current) {
              imageRef.current.style.opacity = '1';
            }
          }}
          onError={() => {
            console.error('Erreur lors du chargement de l\'image:', currentImage);
            // Essayer de charger une autre image
            changeImage();
          }}
        />
        
        {/* Overlay avec informations */}
        <div className="image-overlay">
          <div className="image-info">
            <span className="image-counter">
              {imageCount} images disponibles
            </span>
            <button 
              className="change-image-btn"
              onClick={changeImage}
              title="Changer d'image"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .random-image-display {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
        }

        .random-image-display.loading {
          background: linear-gradient(45deg, #1a1a1a, #2a2a2a);
        }

        .loading-spinner {
          text-align: center;
          color: #fff;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #333;
          border-top: 4px solid #ff6b6b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .random-image-display.error {
          background: #2a1a1a;
          color: #ff6b6b;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .random-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          border-radius: 4px;
        }

        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,0.7) 0%,
            transparent 20%,
            transparent 80%,
            rgba(0,0,0,0.7) 100%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .image-container:hover .image-overlay {
          opacity: 1;
        }

        .image-info {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: auto;
        }

        .image-counter {
          background: rgba(0,0,0,0.8);
          color: #fff;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .change-image-btn {
          background: rgba(255,107,107,0.9);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
        }

        .change-image-btn:hover {
          background: rgba(255,107,107,1);
          transform: scale(1.1);
        }

        .change-image-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default RandomImageDisplay;
