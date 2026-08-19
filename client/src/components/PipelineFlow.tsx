import { useEffect, useState } from 'react';
import { Search, Zap, TrendingUp } from 'lucide-react';

// ── Layout ────────────────────────────────────────────────────────────────────
const CW  = 96;                          // card width
const CH  = 120;                         // card height
const GAP = 24;                          // gap between cards
const R   = 12;                          // card border-radius
const W   = CW * 3 + GAP * 2;           // 336 total
const MY  = CH / 2;                      // 60 — connector vertical midpoint
const XS  = [0, CW + GAP, (CW + GAP) * 2] as const; // [0, 120, 240]

// ── Colors ────────────────────────────────────────────────────────────────────
const BLUE   = '#FF5F2D';  // power-orange — primary brand color
const ORANGE = '#D64123';

// ── Cards data ────────────────────────────────────────────────────────────────
const CARDS = [
  { step: '01', title: 'AI Search',  desc: 'Describe the role in plain English',   Icon: Search     },
  { step: '02', title: 'Match',      desc: 'Evidence-backed candidate ranking',    Icon: Zap        },
  { step: '03', title: 'Pipeline',   desc: 'Track every hire through to close',    Icon: TrendingUp },
];

// ── SVG path helpers ──────────────────────────────────────────────────────────

/** ECG heartbeat zigzag from x0 to x1 at baseline y (works for both directions). */
function hb(x0: number, x1: number, y: number): string {
  const s = (x1 - x0) / 8;
  return [
    `L ${x0 + s}   ${y}`,
    `L ${x0 + 2*s} ${y - 10}`,
    `L ${x0 + 3*s} ${y + 10}`,
    `L ${x0 + 4*s} ${y - 24}`,
    `L ${x0 + 5*s} ${y + 24}`,
    `L ${x0 + 6*s} ${y - 10}`,
    `L ${x0 + 7*s} ${y}`,
    `L ${x1} ${y}`,
  ].join(' ');
}

/** Top-half of a card: enter left-mid, trace over the top, exit right-mid. */
function cardTop(x: number): string {
  return `L ${x} ${R} A ${R} ${R} 0 0 1 ${x+R} 0 L ${x+CW-R} 0 A ${R} ${R} 0 0 1 ${x+CW} ${R} L ${x+CW} ${MY}`;
}

/** Bottom-half of a card: enter right-mid, trace under the bottom, exit left-mid. */
function cardBot(x: number): string {
  return `L ${x+CW} ${CH-R} A ${R} ${R} 0 0 1 ${x+CW-R} ${CH} L ${x+R} ${CH} A ${R} ${R} 0 0 1 ${x} ${CH-R} L ${x} ${MY}`;
}

// Single continuous closed path:
//  forward  → Card1 top → hb → Card2 top → hb → Card3 top+bottom
//  backward ← hb ← Card2 bottom ← hb ← Card1 bottom → close
const PATH = [
  `M 0 ${MY}`,
  cardTop(XS[0]),
  hb(CW,         XS[1],        MY),   // connector 1 →
  cardTop(XS[1]),
  hb(XS[1]+CW,   XS[2],        MY),   // connector 2 →
  cardTop(XS[2]),
  cardBot(XS[2]),                      // Card 3 bottom (closes right side)
  hb(XS[2],      XS[1]+CW,     MY),   // connector 2 ←
  cardBot(XS[1]),
  hb(XS[1],      CW,           MY),   // connector 1 ←
  cardBot(XS[0]),                      // returns to M 0 MY
  'Z',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

export function PipelineFlow() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // 8s loop syncs pulse travel with card glow: each card glows for ~2s every 8s
  const loopMs = 8000;

  return (
    <>
      <style>{`
        @keyframes pipeline-pulse {
          to { stroke-dashoffset: -1; }
        }
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,95,45,0); }
          12%       { box-shadow: 0 0 24px 7px rgba(255,95,45,0.38); }
          26%       { box-shadow: 0 0 0 0 rgba(255,95,45,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pl-pulse { animation: none !important; }
        }
      `}</style>

      <div style={{ position: 'relative', width: W, height: CH }}>

        {/* ── SVG track layer (z-index above cards so path is always crisp) ── */}
        <svg
          width={W} height={CH}
          viewBox={`0 0 ${W} ${CH}`}
          style={{ position: 'absolute', inset: 0, overflow: 'visible', zIndex: 2, pointerEvents: 'none' }}
        >
          <defs>
            <filter id="pl-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Static dim track — always visible */}
          <path
            d={PATH} fill="none"
            stroke="rgba(255,255,255,0.13)" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round"
          />

          {/* Animated glowing pulse — travels around the full path every loopMs */}
          <path
            d={PATH} fill="none"
            stroke={BLUE} strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round"
            filter="url(#pl-glow)"
            pathLength="1"
            strokeDasharray="0.07 0.93"
            className="pl-pulse"
            style={{ animation: `pipeline-pulse ${loopMs}ms linear infinite` }}
          />
        </svg>

        {/* ── Cards (z-index 1, below SVG so path draws over their edges) ── */}
        {CARDS.map(({ step, title, desc, Icon }, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: XS[i], top: 0,
              width: CW, height: CH,
              borderRadius: R,
              background: 'rgba(65,151,203,0.06)',
              zIndex: 1,
              padding: '12px 10px',
              display: 'flex', flexDirection: 'column', gap: 6,
              // Staggered glow: card 1 at 0s, card 2 at loopMs/3, card 3 at 2*loopMs/3
              animation: reduced
                ? undefined
                : `card-glow ${loopMs}ms ease-in-out ${((i * loopMs) / 3 / 1000).toFixed(3)}s infinite`,
            }}
          >
            {/* Icon badge */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: ORANGE, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={13} color="#fff" strokeWidth={2} />
            </div>

            {/* Eyebrow */}
            <p style={{
              margin: 0, fontSize: 8, fontWeight: 800,
              letterSpacing: '0.11em', textTransform: 'uppercase',
              color: BLUE, lineHeight: 1,
            }}>STEP {step}</p>

            {/* Title */}
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              color: '#fff', lineHeight: 1.2,
            }}>{title}</p>

            {/* Description */}
            <p style={{
              margin: 0, fontSize: 9, lineHeight: 1.4,
              color: 'rgba(255,255,255,0.48)',
            }}>{desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
