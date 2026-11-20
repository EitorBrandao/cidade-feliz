// Ícones do HUD desenhados em SVG, no mesmo estilo de borda grossa do jogo.
const S = { width: 20, height: 20, viewBox: '0 0 20 20' }
const O = '#2b2b3a'

export const Coin = () => (
  <svg {...S} aria-hidden>
    <circle cx="10" cy="10" r="8" fill="#ffd84d" stroke={O} strokeWidth="2" />
    <circle cx="10" cy="10" r="4.2" fill="none" stroke="#d99a00" strokeWidth="1.8" />
  </svg>
)

export const Cash = () => (
  <svg {...S} aria-hidden>
    <rect x="2" y="5" width="16" height="10" rx="2" fill="#5fd17a" stroke={O} strokeWidth="2" />
    <circle cx="10" cy="10" r="2.4" fill="#2f9e4f" />
  </svg>
)

export const Bolt = () => (
  <svg {...S} aria-hidden>
    <path d="M11.5 1.5 4 11h5l-1 7.5L16 9h-5z" fill="#ffcf33" stroke={O} strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
)

export const Star = () => (
  <svg {...S} aria-hidden>
    <path d="m10 1.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L10 14.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z" fill="#58b6ff" stroke={O} strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
)

export const People = () => (
  <svg {...S} aria-hidden>
    <circle cx="7" cy="6.5" r="3" fill="#ff9f7a" stroke={O} strokeWidth="1.6" />
    <circle cx="13.5" cy="7.5" r="2.6" fill="#ffc27a" stroke={O} strokeWidth="1.6" />
    <path d="M1.8 17c.4-3.6 2.4-5.4 5.2-5.4s4.8 1.8 5.2 5.4z" fill="#ff9f7a" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12.6 17c.2-2.6 1.4-4.2 3.6-4.2 1.4 0 2.2.8 2.6 1.6V17z" fill="#ffc27a" stroke={O} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)
