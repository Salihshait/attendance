/** Generic abstract illustration — original artwork, not tied to any real company. */
export function LoginIllustration() {
  return (
    <svg viewBox="0 0 480 420" className="h-full w-full max-w-md" role="img" aria-label="HR analytics illustration">
      <defs>
        <linearGradient id="glowBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d8bd4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1b3f7a" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <g opacity="0.5" stroke="#3d8bd4" strokeWidth="1">
        <circle cx="240" cy="200" r="150" fill="none" opacity="0.25" />
        <circle cx="240" cy="200" r="110" fill="none" opacity="0.3" />
      </g>

      {/* bar chart panel */}
      <g transform="translate(60,70)">
        <rect x="0" y="0" width="120" height="90" rx="4" fill="none" stroke="#4a90d9" strokeWidth="1.5" opacity="0.6" />
        <rect x="12" y="55" width="14" height="25" fill="url(#glowBlue)" />
        <rect x="34" y="40" width="14" height="40" fill="url(#glowBlue)" />
        <rect x="56" y="25" width="14" height="55" fill="url(#glowBlue)" />
        <rect x="78" y="45" width="14" height="35" fill="url(#glowBlue)" />
      </g>

      {/* donut chart panel */}
      <g transform="translate(300,60)">
        <circle cx="45" cy="45" r="42" fill="none" stroke="#4a90d9" strokeWidth="1.5" opacity="0.6" />
        <path d="M45 45 L45 6 A39 39 0 0 1 78 63 Z" fill="#5aa3e8" opacity="0.85" />
        <path d="M45 45 L78 63 A39 39 0 0 1 20 78 Z" fill="#3d8bd4" opacity="0.85" />
        <path d="M45 45 L20 78 A39 39 0 0 1 45 6 Z" fill="#2a6bb5" opacity="0.85" />
      </g>

      {/* line chart panel */}
      <g transform="translate(70,220)">
        <rect x="0" y="0" width="150" height="80" rx="4" fill="none" stroke="#4a90d9" strokeWidth="1.5" opacity="0.6" />
        <polyline points="10,60 40,40 70,50 100,20 140,30" fill="none" stroke="#7bc4ff" strokeWidth="2.5" />
      </g>

      {/* people silhouettes around a table */}
      <g transform="translate(150,150)" fill="#7bc4ff">
        <circle cx="30" cy="70" r="14" opacity="0.9" />
        <rect x="16" y="86" width="28" height="42" rx="10" opacity="0.9" />
        <circle cx="100" cy="55" r="14" opacity="0.75" />
        <rect x="86" y="71" width="28" height="42" rx="10" opacity="0.75" />
        <circle cx="165" cy="80" r="14" opacity="0.9" />
        <rect x="151" y="96" width="28" height="42" rx="10" opacity="0.9" />
        <ellipse cx="98" cy="150" rx="90" ry="16" fill="#245089" opacity="0.6" />
      </g>
    </svg>
  );
}
