'use client';

import { useEffect, useState } from 'react';

interface Petal {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

export default function SakuraDrop() {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    // Generate 20-30 petals with random properties
    const petalCount = 20 + Math.floor(Math.random() * 11); // 20-30 petals
    const newPetals: Petal[] = Array.from({ length: petalCount }, (_, i) => ({
      id: i,
      // Concentrate petals around top right (70-100% from left, start at top)
      left: 70 + Math.random() * 30, // 70-100% from left (top right area)
      delay: Math.random() * 8, // Random delay (0-8s) for continuous flow
      duration: 10 + Math.random() * 10, // Random duration (10-20s)
      size: 10 + Math.random() * 15, // Random size (10-25px) - larger petals
      rotation: Math.random() * 360, // Random initial rotation
    }));
    setPetals(newPetals);
  }, []);

  return (
    <>
      {/* Sakura Tree in Top Right */}
      <div className="fixed top-0 right-0 w-64 h-80 pointer-events-none overflow-visible z-20">
        <div className="absolute top-0 right-0 w-full h-full flex items-start justify-end">
          {/* Tree SVG */}
          <svg
            viewBox="0 0 200 250"
            className="w-full h-full opacity-80"
            style={{ filter: 'drop-shadow(0 0 10px rgba(255, 183, 197, 0.3))' }}
          >
            {/* Tree trunk */}
            <path
              d="M 120 220 L 120 250 L 80 250 L 80 220"
              fill="#8B4513"
              opacity="0.7"
            />
            {/* Branches */}
            <path
              d="M 100 180 Q 60 160 40 140 Q 30 120 50 100"
              stroke="#654321"
              strokeWidth="3"
              fill="none"
              opacity="0.6"
            />
            <path
              d="M 100 180 Q 140 160 160 140 Q 170 120 150 100"
              stroke="#654321"
              strokeWidth="3"
              fill="none"
              opacity="0.6"
            />
            <path
              d="M 100 160 Q 50 140 30 110"
              stroke="#654321"
              strokeWidth="2.5"
              fill="none"
              opacity="0.5"
            />
            <path
              d="M 100 160 Q 150 140 170 110"
              stroke="#654321"
              strokeWidth="2.5"
              fill="none"
              opacity="0.5"
            />
            {/* Sakura blossoms - pink clusters */}
            <circle cx="45" cy="105" r="12" fill="#ffb7c5" opacity="0.8" />
            <circle cx="155" cy="105" r="12" fill="#ffb7c5" opacity="0.8" />
            <circle cx="35" cy="115" r="10" fill="#ffb7c5" opacity="0.7" />
            <circle cx="165" cy="115" r="10" fill="#ffb7c5" opacity="0.7" />
            <circle cx="60" cy="165" r="15" fill="#ffb7c5" opacity="0.85" />
            <circle cx="140" cy="165" r="15" fill="#ffb7c5" opacity="0.85" />
            <circle cx="50" cy="145" r="11" fill="#ffb7c5" opacity="0.75" />
            <circle cx="150" cy="145" r="11" fill="#ffb7c5" opacity="0.75" />
            <circle cx="80" cy="140" r="13" fill="#ffb7c5" opacity="0.8" />
            <circle cx="120" cy="140" r="13" fill="#ffb7c5" opacity="0.8" />
            <circle cx="100" cy="120" r="14" fill="#ffb7c5" opacity="0.85" />
            {/* Additional smaller blossoms */}
            <circle cx="40" cy="130" r="8" fill="#ffd0da" opacity="0.6" />
            <circle cx="160" cy="130" r="8" fill="#ffd0da" opacity="0.6" />
            <circle cx="70" cy="155" r="9" fill="#ffd0da" opacity="0.65" />
            <circle cx="130" cy="155" r="9" fill="#ffd0da" opacity="0.65" />
          </svg>
        </div>
      </div>

      {/* Falling Petals Container - from tree position */}
      <div className="fixed top-0 right-0 w-64 h-screen pointer-events-none overflow-hidden z-15">
        {petals.map((petal) => (
          <div
            key={petal.id}
            className="sakura-petal"
            style={{
              position: 'absolute',
              left: `${petal.left}%`,
              width: `${petal.size}px`,
              height: `${petal.size}px`,
              animationDelay: `${petal.delay}s`,
              animationDuration: `${petal.duration}s`,
              transform: `rotate(${petal.rotation}deg)`,
            }}
          >
            {/* Petal shape using rounded corners */}
            <div className="w-full h-full bg-sakura-primary/70 rounded-tr-full rounded-bl-full" />
          </div>
        ))}
      </div>
    </>
  );
}
