'use client';

export default function LofiBackground() {
  // Option A: Video Background (commented out)
  // Uncomment this section and comment out Option B to use video background
  /*
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source
          src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          type="video/mp4"
        />
      </video>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-blue-900/30 to-indigo-900/30" />
    </div>
  );
  */

  // Yae Sakura Theme Background
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Sakura Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sakura-light via-sakura-primary/60 to-sakura-light">
        {/* Animated gradient overlay for movement */}
        <div className="absolute inset-0 bg-gradient-to-tr from-sakura-primary/20 via-transparent to-sakura-primary/30 animate-pulse" />
        {/* Additional gradient layers for depth */}
        <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-sakura-primary/10 to-gold-accent/10" />
        
        {/* Japanese traditional wave pattern overlay (subtle) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 800"
        >
          <defs>
            <pattern id="wavePattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <path
                d="M0,100 Q50,50 100,100 T200,100 L200,200 L0,200 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-sakura-deep"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wavePattern)" />
        </svg>
      </div>

      {/* SVG Noise Texture Overlay (Film Grain Effect) - Lighter for sakura theme */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      {/* Subtle animated particles for extra atmosphere - Sakura themed */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sakura-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-sakura-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-gold-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
}
