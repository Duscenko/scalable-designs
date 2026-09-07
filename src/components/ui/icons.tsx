import { motion, useReducedMotion } from 'framer-motion'

// Shared chrome icons — the single source for glyphs that repeat across the
// configurator, so every surface shows the same official mark. Both track
// currentColor; size them per context.

/** GitHub brand mark — monochrome, tracks currentColor.
 *  Lived as three byte-identical local copies (SaveView · ExportWizard ·
 *  HomeActions' Systems popover) before the third call site made the pattern
 *  worth breaking — the file this sits in exists for exactly that. */
export function GitHubGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

/** Figma brand mark — monochrome, tracks currentColor. Same path the
 *  configurator chrome uses; SocialLoginButton and the icon rail share it
 *  so a login artefact can't drift from the mark on the sync control. */
export function FigmaGlyph({ size = 16 }: { size?: number }) {
  const width = (size * 38) / 57
  return (
    <svg width={width} height={size} viewBox="0 0 38 57" fill="currentColor" aria-hidden>
      <path d="M9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5C0 52.7467 4.25329 57 9.5 57Z" />
      <path d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z" />
      <path d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z" />
      <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" />
      <path d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z" />
    </svg>
  )
}

/** Sliders / "tune" — per-row scale editors, picker toggles, algorithm
 *  surfaces. The Color hub's scale-guide trigger uses SparkleCircleIcon. */
export function SlidersIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 14 14" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
      className={className} aria-hidden
    >
      <line x1="3" y1="2" x2="3" y2="12" />
      <line x1="7" y1="2" x2="7" y2="12" />
      <line x1="11" y1="2" x2="11" y2="12" />
      <circle cx="3" cy="5" r="1.7" fill="var(--app)" />
      <circle cx="7" cy="9" r="1.7" fill="var(--app)" />
      <circle cx="11" cy="4" r="1.7" fill="var(--app)" />
    </svg>
  )
}

/** Sparkle in a circle — AI / agent mark (context copy, Color Agent, scale guide). */
export function SparkleCircleIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden
    >
      <path
        d="M11.7372 6.70975L11.1685 8.40303C10.9573 9.0472 10.5977 9.63262 10.1187 10.112C9.63979 10.5914 9.0549 10.9513 8.41132 11.1627L6.69797 11.732C6.64036 11.7509 6.59019 11.7876 6.55463 11.8368C6.51907 11.8859 6.49992 11.9451 6.49992 12.0058C6.49992 12.0665 6.51907 12.1256 6.55463 12.1748C6.59019 12.2239 6.64036 12.2606 6.69797 12.2796L8.41132 12.8488C9.04858 13.0609 9.62764 13.4188 10.1025 13.8942C10.5774 14.3695 10.935 14.949 11.1469 15.5869L11.7156 17.3018C11.7346 17.3594 11.7712 17.4097 11.8203 17.4452C11.8695 17.4808 11.9286 17.5 11.9892 17.5C12.0498 17.5 12.1089 17.4808 12.1581 17.4452C12.2072 17.4097 12.2438 17.3594 12.2628 17.3018L12.8531 15.6085C13.065 14.9707 13.4226 14.3911 13.8975 13.9158C14.3724 13.4405 14.9514 13.0825 15.5887 12.8704L17.302 12.3012C17.3596 12.2822 17.4098 12.2456 17.4454 12.1964C17.4809 12.1472 17.5001 12.0881 17.5001 12.0274C17.5001 11.9667 17.4809 11.9075 17.4454 11.8584C17.4098 11.8092 17.3596 11.7725 17.302 11.7536L15.6103 11.1627C14.9667 10.9513 14.3818 10.5914 13.9028 10.112C13.4239 9.63262 13.0643 9.0472 12.8531 8.40303L12.2844 6.68813C12.2633 6.6311 12.2247 6.58221 12.1741 6.54846C12.1236 6.51471 12.0637 6.49783 12.003 6.50022C11.9422 6.50262 11.8838 6.52418 11.8361 6.56182C11.7884 6.59945 11.7538 6.65123 11.7372 6.70975Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Copy / duplicate — the designer-supplied mark (`public/icons/settings/copy.svg`,
 *  filed beside `edit.svg` rather than in the `Icon/` subfolder it exported into).
 *  Painted as a CSS MASK with `currentColor`, not an `<img>`: the asset ships a
 *  hardcoded `fill="white"`, so a bare `<img>` is invisible in light chrome and
 *  can't track a button's hover ink. The mask reads only the file's alpha. */
export function CopyGlyph({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block flex-shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMask: "url('/icons/settings/copy.svg') center / contain no-repeat",
        mask: "url('/icons/settings/copy.svg') center / contain no-repeat",
      }}
    />
  )
}

/** Frame + cursor from `public/icons/settings/inspect.svg`, split so the
 *  pointer can move independently. Inline + `currentColor` (same ink contract
 *  as the old CSS-mask) — a mask of the combined asset cannot animate a part. */
const INSPECT_FRAME =
  'M12.667 1.5C13.1531 1.50009 13.6191 1.69337 13.9629 2.03711C14.3066 2.38085 14.4999 2.84689 14.5 3.33301V7.33301C14.5 7.60915 14.2761 7.83301 14 7.83301C13.7239 7.83301 13.5 7.60915 13.5 7.33301V3.33301C13.4999 3.11211 13.4121 2.90034 13.2559 2.74414C13.0997 2.58794 12.8879 2.50009 12.667 2.5H3.33301C3.11211 2.50009 2.90034 2.58794 2.74414 2.74414C2.58794 2.90034 2.50009 3.11211 2.5 3.33301V12.667C2.50009 12.8879 2.58794 13.0997 2.74414 13.2559C2.90034 13.4121 3.11211 13.4999 3.33301 13.5H7.33301C7.60915 13.5 7.83301 13.7239 7.83301 14C7.83301 14.2761 7.60915 14.5 7.33301 14.5H3.33301C2.84689 14.4999 2.38085 14.3066 2.03711 13.9629C1.69337 13.6191 1.50009 13.1531 1.5 12.667V3.33301C1.50009 2.8469 1.69337 2.38085 2.03711 2.03711C2.38085 1.69337 2.8469 1.50009 3.33301 1.5H12.667Z'
const INSPECT_CURSOR =
  'M8.2832 7.5C8.40246 7.49318 8.52271 7.51272 8.63477 7.55664L14.6348 9.88965L14.6357 9.89062C14.7564 9.93779 14.864 10.0123 14.9502 10.1074L15.0293 10.209L15.0908 10.3213C15.144 10.438 15.1705 10.566 15.166 10.6953C15.16 10.8678 15.0998 11.0346 14.9951 11.1719C14.8904 11.309 14.7457 11.4105 14.5811 11.4619H14.5801L12.2842 12.1738C12.2583 12.1818 12.234 12.1967 12.2148 12.2158C12.1958 12.2349 12.1818 12.2584 12.1738 12.2842L11.4619 14.5801V14.5811C11.4105 14.7457 11.309 14.8904 11.1719 14.9951C11.0346 15.0998 10.8678 15.16 10.6953 15.166C10.5231 15.172 10.3531 15.1239 10.209 15.0293C10.0647 14.9345 9.95347 14.7965 9.89062 14.6357L9.88965 14.6348L7.55664 8.63477L7.52148 8.51953C7.49412 8.40293 7.49129 8.28133 7.51562 8.16309L7.54883 8.04688C7.59021 7.93314 7.65592 7.82846 7.74219 7.74219L7.83398 7.66309C7.93106 7.5909 8.04364 7.54023 8.16309 7.51562L8.2832 7.5ZM10.6484 13.8262L11.2188 11.9883C11.2748 11.8074 11.3739 11.6428 11.5078 11.5088C11.6419 11.3747 11.8071 11.2748 11.9883 11.2188L13.8262 10.6484L8.62598 8.62598L10.6484 13.8262Z'

const INSPECT_EASE = [0.22, 1, 0.36, 1] as const

/** Inspect tokens — designer-supplied mark (`public/icons/settings/inspect.svg`).
 *  `hint` plays the inspect gesture (cursor approaches the frame, taps, retreats)
 *  so the header control can advertise the mode without looping the whole pill.
 *  Armed / reduced-motion / paused stay on the rest pose. */
export function InspectGlyph({
  size = 16,
  className = '',
  hint = false,
  paused = false,
}: {
  size?: number
  className?: string
  hint?: boolean
  paused?: boolean
}) {
  const reduce = useReducedMotion() ?? false
  const play = hint && !paused && !reduce
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`flex-shrink-0 overflow-visible ${className}`}
      aria-hidden
    >
      <motion.path
        d={INSPECT_FRAME}
        animate={play ? { opacity: [1, 1, 0.62, 1, 1] } : { opacity: 1 }}
        transition={
          play
            ? {
                duration: 2.1,
                times: [0, 0.34, 0.48, 0.62, 1],
                ease: [INSPECT_EASE, 'linear', INSPECT_EASE, INSPECT_EASE],
                repeat: Infinity,
                repeatDelay: 3.2,
              }
            : { duration: 0.18, ease: INSPECT_EASE }
        }
      />
      <motion.path
        d={INSPECT_CURSOR}
        fillRule="evenodd"
        animate={
          play
            ? { x: [1.7, 0, 0.28, 0, 1.7], y: [1.7, 0, 0.28, 0, 1.7] }
            : { x: 0, y: 0 }
        }
        transition={
          play
            ? {
                duration: 2.1,
                times: [0, 0.34, 0.48, 0.62, 1],
                ease: [INSPECT_EASE, INSPECT_EASE, INSPECT_EASE, INSPECT_EASE],
                repeat: Infinity,
                repeatDelay: 3.2,
              }
            : { duration: 0.18, ease: INSPECT_EASE }
        }
      />
    </svg>
  )
}

/** Painter's palette — the color-token mark: token-table rows and the rail's
 *  Color entry. */
export function PaletteIcon({ size = 16, strokeWidth = 1.8, className = '' }: {
  size?: number
  strokeWidth?: number
  className?: string
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  )
}
