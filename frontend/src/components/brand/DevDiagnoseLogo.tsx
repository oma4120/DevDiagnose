import type { SVGProps } from 'react'

interface DevDiagnoseLogoProps extends SVGProps<SVGSVGElement> {
  showText?: boolean
  size?: number
  light?: boolean
  interior?: 'outline' | 'filled'
}

export default function DevDiagnoseLogo({
  showText = true,
  size = 42,
  light = false,
  interior = 'filled',
  className = '',
  ...props
}: DevDiagnoseLogoProps) {
  return (
    <svg
      width={showText ? 288 : size}
      height={showText ? 72 : size}
      viewBox={showText ? '0 0 580 145' : '0 0 145 145'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DevDiagnose"
      role="img"
      {...props}
    >
      <defs>
        {/* Blue → Violet gradient */}
        <linearGradient
          id="devDiagnoseGradient"
          x1="10"
          y1="10"
          x2="130"
          y2="135"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        {/* Subtle text gradient */}
        <linearGradient
          id="devDiagnoseTextGradient"
          x1="180"
          y1="60"
          x2="560"
          y2="110"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        {/* Light text gradient (for dark backgrounds) */}
        <linearGradient
          id="devDiagnoseTextGradientLight"
          x1="180"
          y1="60"
          x2="560"
          y2="110"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="55%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      <g transform="translate(66 63) scale(0.88) translate(-66 -63)">{/* Magnifying glass ring */}
      <circle cx="62" cy="58" r="45" stroke="url(#devDiagnoseGradient)" strokeWidth="10" fill="#FFFFFF" />

      {/* Magnifying glass handle */}
      <path d="M98 93L121 116" stroke="url(#devDiagnoseGradient)" strokeWidth="11" strokeLinecap="round" />

<g
        transform="translate(62 58) scale(2.2) translate(-12 -12)"
        fill="none"
        stroke="#172554"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.12 3.88 16 2" />
        <path d="M21 21a4 4 0 0 0-3.81-4" />
        <path d="M21 5a4 4 0 0 1-3.55 3.97" />
        <path d="M22 13h-4" />
        <path d="M3 21a4 4 0 0 1 3.81-4" />
        <path d="M3 5a4 4 0 0 0 3.55 3.97" />
        <path d="M6 13H2" />
        <path d="m8 2 1.88 1.88" />
        <path d="M9 7.13V6a3 3 0 1 1 6 0v1.13" />
        <path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z" fill={interior === 'filled' ? '#FFFFFF' : 'none'} />
        <path d="M12 20v-9" stroke="#172554" />
      </g>

      {/* AI / diagnostic particles */}
      <rect x="112" y="24" width="10" height="10" rx="2" fill="#3B82F6" />
      <rect x="127" y="40" width="8" height="8" rx="2" fill="#6366F1" />
      <rect x="116" y="49" width="9" height="9" rx="2" fill="#8B5CF6" />
      </g>

      {showText && (
        <text
          x="148"
          y="91"
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          fontSize="62"
          fontWeight="700"
          letterSpacing="-2"
        >
          <tspan fill={light ? '#F8FAFC' : '#1a2033'}>Dev</tspan>
          <tspan fill={light ? 'url(#devDiagnoseTextGradientLight)' : 'url(#devDiagnoseTextGradient)'}>Diagnose</tspan>
        </text>
      )}
    </svg>
  )
}