'use client';

export function BlockchainAnimation() {
  return (
    <div className="relative w-full h-[400px] animate-float">
      <svg viewBox="0 0 500 500" className="w-full h-full">
        {/* Outer circle */}
        <circle
          cx="250"
          cy="250"
          r="200"
          fill="none"
          stroke="url(#gradientPrimary)"
          strokeWidth="1"
          className="animate-rotate"
        />

        {/* Inner circle */}
        <circle
          cx="250"
          cy="250"
          r="150"
          fill="none"
          stroke="url(#gradientSecondary)"
          strokeWidth="1"
          className="animate-rotate"
          style={{ animationDirection: 'reverse' }}
        />

        {/* Center circle */}
        <circle
          cx="250"
          cy="250"
          r="50"
          fill="url(#gradientCenter)"
          className="animate-pulse-slow"
        />

        {/* Nodes */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const x = 250 + 200 * Math.cos((angle * Math.PI) / 180);
          const y = 250 + 200 * Math.sin((angle * Math.PI) / 180);
          return (
            <g
              key={`outer-node-${i}`}
              className="animate-pulse-slow"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <circle
                cx={`${x}`}
                cy={`${y}`}
                r="10"
                fill="url(#gradientPrimary)"
              />
            </g>
          );
        })}

        {[0, 72, 144, 216, 288].map((angle, i) => {
          const x = 250 + 150 * Math.cos((angle * Math.PI) / 180);
          const y = 250 + 150 * Math.sin((angle * Math.PI) / 180);
          return (
            <g
              key={`inner-node-${i}`}
              className="animate-pulse-slow"
              style={{ animationDelay: `${i * 0.2 + 0.1}s` }}
            >
              <circle
                cx={`${x}`}
                cy={`${y}`}
                r="8"
                fill="url(#gradientSecondary)"
              />
            </g>
          );
        })}

        {/* Connection lines with animation */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const outerX = 250 + 200 * Math.cos((angle * Math.PI) / 180);
          const outerY = 250 + 200 * Math.sin((angle * Math.PI) / 180);

          return (
            <g key={`connection-${i}`}>
              <line
                x1="250"
                y1="250"
                x2={`${outerX}`}
                y2={`${outerY}`}
                stroke="url(#gradientLine)"
                strokeWidth="1.5"
                strokeDasharray="5,5"
                className="animate-flow"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            </g>
          );
        })}

        {/* Gradients */}
        <defs>
          <linearGradient
            id="gradientPrimary"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.627 0.265 303.9)" />
            <stop offset="100%" stopColor="oklch(0.488 0.243 264.376)" />
          </linearGradient>

          <linearGradient
            id="gradientSecondary"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.488 0.243 264.376)" />
            <stop offset="100%" stopColor="oklch(0.627 0.265 303.9)" />
          </linearGradient>

          <linearGradient
            id="gradientCenter"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.627 0.265 303.9)" />
            <stop offset="100%" stopColor="oklch(0.488 0.243 264.376)" />
          </linearGradient>

          <linearGradient id="gradientLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.488 0.243 264.376)" />
            <stop offset="100%" stopColor="oklch(0.627 0.265 303.9)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
