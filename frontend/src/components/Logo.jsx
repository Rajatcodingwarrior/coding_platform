import React from "react";

export const Logo = ({ size = 24 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      <defs>
        {/* Glow and Gradients */}
        <linearGradient id="logo-c-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Sleek Orbit ring */}
      <circle cx="50" cy="50" r="38" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="4" />
      
      {/* Modern styled letter C (Orbital Shape) */}
      <path 
        d="M 68 28 A 30 30 0 1 0 68 72" 
        stroke="url(#logo-c-grad)" 
        strokeWidth="11" 
        strokeLinecap="round" 
        filter="url(#logo-glow)"
      />
      
      {/* Node Dots (LeetCode, Codeforces, AtCoder) */}
      <circle cx="70" cy="20" r="5" fill="#ffa116" filter="drop-shadow(0 0 3px rgba(255, 161, 22, 0.6))" />
      <circle cx="90" cy="55" r="5.5" fill="#ef4444" filter="drop-shadow(0 0 3px rgba(239, 68, 68, 0.6))" />
      <circle cx="38" cy="88" r="4.5" fill="#3b82f6" filter="drop-shadow(0 0 3px rgba(59, 130, 246, 0.6))" />
    </svg>
  );
};
