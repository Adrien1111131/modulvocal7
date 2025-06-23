import React, { useEffect, useState } from 'react';

interface Emoji {
  id: number;
  type: string;
  left: number;
  animationDelay: number;
  scale: number;
}

const LoadingAnimation: React.FC = () => {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  
  // Types d'émojis disponibles
  const emojiTypes = ['❤️', '🔥', '👄'];
  
  // Générer un nouvel emoji aléatoire
  const generateRandomEmoji = (id: number): Emoji => {
    return {
      id,
      type: emojiTypes[Math.floor(Math.random() * emojiTypes.length)],
      left: Math.random() * 80 + 10, // Position horizontale entre 10% et 90%
      animationDelay: Math.random() * 2, // Délai d'animation entre 0 et 2 secondes
      scale: Math.random() * 0.5 + 0.5, // Échelle entre 0.5 et 1
    };
  };
  
  // Ajouter de nouveaux émojis périodiquement
  useEffect(() => {
    // Ajouter quelques émojis initiaux
    const initialEmojis = Array.from({ length: 10 }, (_, i) => generateRandomEmoji(i));
    setEmojis(initialEmojis);
    
    // Ajouter un nouvel emoji toutes les 300ms
    const interval = setInterval(() => {
      setEmojis(prevEmojis => {
        // Limiter à 20 émojis maximum pour éviter les problèmes de performance
        if (prevEmojis.length >= 20) {
          // Supprimer le plus ancien emoji et ajouter un nouveau
          const newEmojis = [...prevEmojis.slice(1)];
          return [...newEmojis, generateRandomEmoji(prevEmojis[prevEmojis.length - 1].id + 1)];
        }
        // Ajouter un nouvel emoji
        return [...prevEmojis, generateRandomEmoji(prevEmojis[prevEmojis.length - 1].id + 1)];
      });
    }, 300);
    
    // Nettoyer l'intervalle lors du démontage du composant
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="loading-animation-container">
      <div className="loading-text">Génération de la voix en cours...</div>
      {emojis.map(emoji => (
        <div
          key={emoji.id}
          className="floating-emoji"
          style={{
            left: `${emoji.left}%`,
            animationDelay: `${emoji.animationDelay}s`,
            transform: `scale(${emoji.scale})`,
          }}
        >
          {emoji.type}
        </div>
      ))}
      <style>
        {`
          .loading-animation-container {
            position: relative;
            height: 120px;
            width: 100%;
            overflow: hidden;
            background: linear-gradient(135deg, rgba(30, 42, 59, 0.8), rgba(18, 18, 18, 0.8));
            border-radius: 12px;
            margin: 1rem 0;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          
          .loading-text {
            color: white;
            font-size: 1.2rem;
            text-align: center;
            z-index: 10;
            position: relative;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
          }
          
          .floating-emoji {
            position: absolute;
            bottom: -20px;
            font-size: 24px;
            animation: floatEmoji 3s ease-in-out forwards;
            opacity: 0;
            z-index: 5;
          }
          
          @keyframes floatEmoji {
            0% {
              transform: translateY(0) scale(0.2);
              opacity: 0;
            }
            20% {
              opacity: 1;
            }
            80% {
              opacity: 0.8;
            }
            100% {
              transform: translateY(-120px) scale(1.5);
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingAnimation;
