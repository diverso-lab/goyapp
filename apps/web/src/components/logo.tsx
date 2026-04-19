"use client";

import { useId } from "react";

export function Logo({ className = "h-7 w-auto" }: { className?: string }) {
  const gradId = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 780 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} text-slate-900 dark:text-slate-50`}
      aria-label="Goyapp"
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="55%" stopColor="#B857E8" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
      <g transform="translate(30, 30)">
        <rect width="160" height="160" rx="35" ry="35" fill={`url(#${gradId})`} />
        <g transform="scale(0.3125)">
          <path
            d="M 375 182 A 140 140 0 1 0 375 330 L 375 256 L 260 256"
            stroke="#FFFFFF"
            strokeWidth={58}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <text
        x={220}
        y={142}
        fontFamily="Inter, 'Helvetica Neue', system-ui, -apple-system, sans-serif"
        fontWeight={800}
        fontSize={108}
        fill="currentColor"
        letterSpacing={-3}
      >
        goyapp
      </text>
    </svg>
  );
}
