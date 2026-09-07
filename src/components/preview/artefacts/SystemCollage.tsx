import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Live, PhosphorWeightProvider, SPECIMENS, TokenIcon, type IconOpts, type SpecimenProps } from '../../configurator/docs/specimens'
import { TokenInspector, inspectGroupAttrs, useInspectorActive } from './TokenInspector'
import {
  cardSurfaceStyle,
  radiusRoleOf,
  shadowOf,
  sizeRoleOf,
  spacingRoleOf,
  strokeRoleOf,
  typeStyleOf,
} from '../../../lib/previewTokens'
import type { PreviewTokens } from '../ButtonPreview'
import type { ThemeAppearance } from '../../../lib/themeModes'
import { useI18n } from '../../../lib/i18n'
import { COMPONENTS } from '../../../lib/componentCatalogue'

export { COLLAGE_TILE_COUNT } from '../../../lib/randomTheme'

/** One axis's values for a catalogue component — same source as ThemePreviewHub. */
function axisValuesOf(key: string, axis: string): string[] {
  return COMPONENTS.find((c) => c.key === key)?.axes.find((a) => a.name === axis)?.values ?? []
}

/**
 * A catalogue specimen, marked up for Inspector mode.
 *
 * Wrapping here rather than at each of the ~30 call sites below is deliberate:
 * the collage's JSX is the composition, and threading a `component="Input"`
 * prop through every tag would be repeating a name the registry lookup already
 * knows — one that could then disagree with it. `TokenInspector` renders
 * nothing while the mode is off, so this costs nothing in the normal case.
 */
const inspectable = (key: string) => {
  const Specimen = SPECIMENS[key]
  const Wrapped = (p: SpecimenProps) => (
    <TokenInspector component={key} variant={p.v}>{Specimen(p)}</TokenInspector>
  )
  Wrapped.displayName = `Inspectable(${key})`
  return Wrapped
}

const Input = inspectable('Input')
const SocialLogin = inspectable('SocialLoginButton')
const Card = inspectable('Card')
const Avatar = inspectable('Avatar')
const Badge = inspectable('Badge')
const InputOTP = inspectable('InputOTP')
const TextLink = inspectable('TextLink')
const Segmented = inspectable('SegmentedControl')
const Toast = inspectable('Toast')
const TabMenu = inspectable('TabMenu')
const Progress = inspectable('Progress')
const StatusBadge = inspectable('StatusBadge')
const Chip = inspectable('Chip')
const Sidebar = inspectable('Sidebar')
const InputTag = inspectable('InputTag')
const CheckboxGroup = inspectable('CheckboxGroup')
const FileUpload = inspectable('FileUpload')
const Stepper = inspectable('Stepper')
const Pagination = inspectable('Pagination')
const Spinner = inspectable('Spinner')

/** `Live` already carries the catalogue key as `c`, so the marker reads it
 *  straight off the prop rather than being restated. */
function InspectableLive(p: Parameters<typeof Live>[0]) {
  const icons = p.icons ?? ((p.c === 'Button' || p.c === 'Input') ? catalogueIcons(p.t) : undefined)
  return <TokenInspector component={p.c} variant={p.v}><Live {...p} icons={icons} /></TokenInspector>
}

/**
 * Specimens lay out at a real mobile card width (Input 260, SocialLogin 280
 * with `w="100%"`). Never re-flow that type into the thumbnail column.
 */
const MODULE_SOURCE = 260
/**
 * Thumbnail column. Small on purpose: the canvas is an impression of many
 * modules at once, not three stretched desktop tiles. 156 packs 5–7 across a
 * typical Themes canvas; CSS columns cannot do this (unconstrained height
 * fills one stack).
 */
const MODULE_DISPLAY = 156
/** Sub-row unit for the masonry `grid-row: span` trick. */
const MASONRY_ROW = 4

const gap = (t: PreviewTokens, role: string, fb: string) => spacingRoleOf(t, role, fb)

/** Same icon library + slot contract as Theme Preview · Components. */
function catalogueIcons(t: PreviewTokens, leadingConcept?: IconOpts['leadingConcept']): IconOpts {
  return { prefix: t.iconPrefix ?? 'phosphor', leading: true, trailing: false, leadingConcept }
}

function px(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function ModuleSurface({ t, children, style }: { t: PreviewTokens; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        ...cardSurfaceStyle(t),
        border: `${strokeRoleOf(t, 'control', '1px')} solid ${t.borderDefault || t.border || '#eaecf0'}`,
        borderRadius: radiusRoleOf(t, 'container', '16px'),
        // Elevation lives on `ScaledModule`'s OUTER frame — an inner
        // box-shadow is clipped by the photograph and shrunk by scale().
        padding: spacingRoleOf(t, 'inset-surface', '20px'),
        display: 'flex',
        flexDirection: 'column',
        gap: gap(t, 'gap-control', '8px'),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Photograph a mobile-width module down to `MODULE_DISPLAY`. Same contract as
 * `ScaledArtefactCard`: layout at true size first, then `transform: scale()`.
 * The inner is taken out of flow so its 260px min-content cannot inflate the
 * masonry column. Pointer events stay on the specimens so `Live` still drives
 * Hover/Pressed.
 *
 * Elevation is painted on THIS frame (display size), never on the scaled
 * inner — `overflow: hidden` + `scale()` made Strong look like None.
 */
function ScaledModule({
  t, appearance = 'light', children, chrome = true, clip = true, elev, style, sourceWidth = MODULE_SOURCE,
}: {
  t: PreviewTokens
  appearance?: ThemeAppearance
  children: ReactNode
  chrome?: boolean
  /** When false the photograph can spill past the frame. */
  clip?: boolean
  /** Shadow ramp step on the unscaled frame. Defaults to `sm` when chrome. */
  elev?: string | false
  style?: CSSProperties
  sourceWidth?: number
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  // A module IS the container Inspector mode groups by — the cluster of
  // controls that read a set of roles together. The frame is already a real
  // box, so this is an attribute and not a wrapper (see `inspectGroupAttrs`),
  // and the badge derives its name and its members from what's inside rather
  // than from a label passed down here.
  const inspecting = useInspectorActive()
  const scale = MODULE_DISPLAY / sourceWidth
  const frameRadius = (parseFloat(radiusRoleOf(t, 'container', '16px')) || 0) * scale
  const displayHeight = naturalHeight != null ? naturalHeight * scale : 0
  const gutter = px(gap(t, 'gap-control', '8px')) || 8
  const span = Math.max(1, Math.ceil((displayHeight + gutter) / (MASONRY_ROW + gutter)))
  const elevation = elev === false ? undefined : elev ?? (chrome ? 'sm' : undefined)
  const frameShadow = elevation
    ? shadowOf(t, elevation, '0 1px 2px rgba(10,13,18,0.05)')
    : undefined

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h) setNaturalHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const body = chrome ? <ModuleSurface t={t} style={style}>{children}</ModuleSurface> : children
  const appearanceClass = appearance === 'dark' ? 'dark' : 'light'
  const weighted = (
    <PhosphorWeightProvider weight={t.iconWeight}>
      {body}
    </PhosphorWeightProvider>
  )

  return (
    <div
      className={`relative overflow-visible ${appearanceClass}`}
      data-collage-appearance={appearance}
      {...inspectGroupAttrs(inspecting)}
      style={{
        width: MODULE_DISPLAY,
        minWidth: MODULE_DISPLAY,
        maxWidth: MODULE_DISPLAY,
        height: displayHeight || undefined,
        gridRowEnd: `span ${span}`,
        opacity: naturalHeight != null ? 1 : 0,
        borderRadius: chrome || frameShadow ? frameRadius : undefined,
        boxShadow: frameShadow,
        // Floating menus sit above neighbours; elevated chrome does too so a
        // Strong shadow isn't buried under the next tile.
        zIndex: !clip || frameShadow ? 1 : undefined,
      }}
    >
      <div
        ref={innerRef}
        className={clip ? 'absolute left-0 top-0 overflow-hidden' : 'absolute left-0 top-0'}
        style={{
          width: sourceWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          borderRadius: chrome && clip ? radiusRoleOf(t, 'container', '16px') : undefined,
        }}
      >
        {weighted}
      </div>
    </div>
  )
}

function GradientAvatar({ t, size }: { t: PreviewTokens; size: string }) {
  return (
    <TokenInspector component="Avatar">
      <span
        aria-hidden
        style={{
          width: size, height: size, flexShrink: 0,
          borderRadius: 999,
          background: t.avatarGradient || t.coverGradient || t.brandSolid,
        }}
      />
    </TokenInspector>
  )
}

function Well({
  t, size, icon, iconSize, pill = false,
}: {
  t: PreviewTokens
  size: string
  icon: 'user' | 'users' | 'zap' | 'box'
  /** Override glyph px. Default ~58% of the well — fills the chip without
   *  growing the container (14–16 in a 32–40 well read as lost). */
  iconSize?: number
  pill?: boolean
}) {
  const wellPx = parseFloat(size) || 32
  const glyph = iconSize ?? Math.round(wellPx * 0.58)
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        borderRadius: pill ? 999 : radiusRoleOf(t, 'control', '8px'),
        background: t.neutralFill,
      }}
    >
      <TokenIcon t={t} concept={icon} size={glyph} color={t.neutralText} />
    </span>
  )
}

/**
 * Packed wall of mobile-sized catalogue modules — the Theme Preview impression
 * of the system as a set, not as three stretched desktop tiles.
 */
export function SystemCollage({
  tokensByAppearance, tileAppearances, projectName,
}: {
  tokensByAppearance: Record<ThemeAppearance, PreviewTokens>
  tileAppearances: ThemeAppearance[]
  projectName: string
}) {
  const { t: translate } = useI18n()
  const tile = (index: number) => tokensByAppearance[tileAppearances[index] === 'dark' ? 'dark' : 'light']
  const appearanceAt = (index: number) => tileAppearances[index] ?? 'light'
  const muted = (index: number) => tile(index).fgMuted || '#717680'
  const handle = `@${projectName.replace(/\s+/g, '_').toLowerCase()}`
  const gutter = gap(tile(2), 'gap-control', '8px')
  const wellLg = sizeRoleOf(tile(2), 'control', '40px')
  const wellSm = sizeRoleOf(tile(2), 'compact', '32px')

  return (
    <div
      className="w-full"
      style={{
        // Room for unscaled elevation to paint into the scrollport padding —
        // without it Strong's blur reads clipped against the canvas edge.
        padding: 10,
        margin: -10,
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, ${MODULE_DISPLAY}px)`,
        gridAutoRows: MASONRY_ROW,
        gap: gutter,
        alignItems: 'start',
        justifyContent: 'center',
      }}
    >
      <ScaledModule t={tile(2)} appearance={appearanceAt(2)}>
        <span style={{ ...typeStyleOf(tile(2), 'heading-sm'), color: tile(2).neutralText }}>{translate('Verify account')}</span>
        <InputOTP t={tile(2)} v={{ State: 'Filled', Size: 'SM' }} />
        <span style={{ ...typeStyleOf(tile(2), 'body-sm'), color: muted(2) }}>
          {translate('Didn’t get a code?')}{' '}
          <TextLink t={tile(2)} v={{}}>{translate('Resend')}</TextLink>
        </span>
      </ScaledModule>

      <ScaledModule
        t={tile(3)}
        appearance={appearanceAt(3)}
        style={{ gap: gap(tile(3), 'gap-group', '16px') }}
      >
        <div className="flex w-full min-w-0 flex-col" style={{ gap: gap(tile(3), 'gap-control', '8px') }}>
          {axisValuesOf('Button', 'Style').map((style) => (
            <InspectableLive
              key={style}
              c="Button"
              t={tile(3)}
              v={{ Style: style, Color: 'Brand', Size: 'SM' }}
              w="100%"
            >
              {translate('Click me')}
            </InspectableLive>
          ))}
        </div>
        <div
          className="grid w-full grid-cols-2"
          style={{
            gap: gap(tile(3), 'gap-control', '8px'),
            paddingTop: gap(tile(3), 'gap-group', '16px'),
            borderTop: `${strokeRoleOf(tile(3), 'divider', '1px')} solid ${tile(3).borderDefault || tile(3).border}`,
          }}
        >
          <InspectableLive
            c="Button"
            t={tile(3)}
            v={{ Style: 'Solid', Color: 'Danger', Size: 'SM' }}
            icons={catalogueIcons(tile(3), 'error')}
            w="100%"
          >
            {translate('Critical')}
          </InspectableLive>
          <InspectableLive
            c="Button"
            t={tile(3)}
            v={{ Style: 'Solid', Color: 'Success', Size: 'SM' }}
            icons={catalogueIcons(tile(3), 'check')}
            w="100%"
          >
            {translate('Success')}
          </InspectableLive>
        </div>
      </ScaledModule>

      <ScaledModule
        t={tile(4)}
        appearance={appearanceAt(4)}
        style={{ gap: gap(tile(4), 'gap-group', '16px') }}
      >
        <div
          className="grid w-full grid-cols-2 justify-items-center"
          style={{ gap: gap(tile(4), 'gap-control', '8px') }}
        >
          <Badge t={tile(4)} v={{ Style: 'Soft', Color: 'Error', Size: 'SM' }}>{translate('Critical')}</Badge>
          <Badge t={tile(4)} v={{ Style: 'Soft', Color: 'Warning', Size: 'SM' }}>{translate('Warning')}</Badge>
          <Badge t={tile(4)} v={{ Style: 'Soft', Color: 'Success', Size: 'SM' }}>{translate('Success')}</Badge>
          <Badge t={tile(4)} v={{ Style: 'Soft', Color: 'Info', Size: 'SM' }}>{translate('Info')}</Badge>
        </div>
        <div
          className="flex flex-wrap items-center"
          style={{
            gap: gap(tile(4), 'gap-control', '8px'),
            paddingTop: gap(tile(4), 'gap-group', '16px'),
            borderTop: `${strokeRoleOf(tile(4), 'divider', '1px')} solid ${tile(4).borderDefault || tile(4).border}`,
          }}
        >
          <StatusBadge t={tile(4)} v={{ Status: 'Online' }} />
          <StatusBadge t={tile(4)} v={{ Status: 'Busy' }} />
          <InspectableLive c="Chip" t={tile(4)} v={{ Selected: 'True' }} toggle="Selected" />
        </div>
      </ScaledModule>

      <ScaledModule t={tile(5)} appearance={appearanceAt(5)}>
        <div className="flex justify-end">
          <InspectableLive c="CloseButton" t={tile(5)} v={{ Size: 'SM' }} />
        </div>
        <div className="flex flex-col items-center text-center" style={{ gap: gap(tile(5), 'gap-tight', '4px') }}>
          <GradientAvatar t={tile(5)} size={wellLg} />
          <p style={{ margin: 0, ...typeStyleOf(tile(5), 'heading-sm'), color: tile(5).neutralText }}>{translate('Create an account')}</p>
          <p style={{ margin: 0, ...typeStyleOf(tile(5), 'body-sm', { leading: true }), color: muted(5) }}>
            {translate('Sign in to continue to your workspace.')}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col" style={{ gap: gap(tile(5), 'gap-group', '16px') }}>
          <Input t={tile(5)} v={{ Type: 'E-Mail', State: 'Filled', Size: 'SM' }} w="100%" />
          <Input t={tile(5)} v={{ Type: 'Password', Size: 'SM' }} w="100%" />
        </div>
        <InspectableLive c="Button" t={tile(5)} v={{ Style: 'Solid', Size: 'MD' }} w="100%">{translate('Get Started')}</InspectableLive>
        <div className="flex items-center" style={{ gap: gap(tile(5), 'gap-control', '8px') }}>
          <span style={{ flex: 1, height: 1, background: tile(5).borderDefault || tile(5).border }} />
          <span style={{ ...typeStyleOf(tile(5), 'caption'), color: muted(5) }}>{translate('or')}</span>
          <span style={{ flex: 1, height: 1, background: tile(5).borderDefault || tile(5).border }} />
        </div>
        <SocialLogin t={tile(5)} v={{ Provider: 'Google' }} w="100%" />
        <SocialLogin t={tile(5)} v={{ Provider: 'Apple' }} w="100%" />
      </ScaledModule>

      <ScaledModule t={tile(6)} appearance={appearanceAt(6)}>
        <Segmented t={tile(6)} v={{ Size: 'SM' }} />
      </ScaledModule>

      <ScaledModule t={tile(7)} appearance={appearanceAt(7)}>
        <div className="grid grid-cols-2" style={{ gap: gap(tile(7), 'gap-control', '8px') }}>
          <InspectableLive c="Button" t={tile(7)} v={{ Style: 'Outline', Size: 'SM' }} icons={catalogueIcons(tile(7), 'chat')} w="100%">{translate('Chats')}</InspectableLive>
          <InspectableLive c="Button" t={tile(7)} v={{ Style: 'Outline', Size: 'SM' }} icons={catalogueIcons(tile(7), 'mail')} w="100%">{translate('Emails')}</InspectableLive>
        </div>
      </ScaledModule>

      <ScaledModule t={tile(8)} appearance={appearanceAt(8)}>
        <div className="flex items-start" style={{ gap: gap(tile(8), 'gap-control', '8px') }}>
          <TokenInspector component="Avatar">
            <span
              aria-hidden
              style={{
                width: wellSm, height: wellSm, flexShrink: 0,
                borderRadius: radiusRoleOf(tile(8), 'control', '8px'),
                background: tile(8).coverGradient || tile(8).brandSolid,
              }}
            />
          </TokenInspector>
          <div className="min-w-0 flex-1">
            <TokenInspector component="Badge">
              <div className="flex items-center" style={{ gap: gap(tile(8), 'gap-tight', '4px') }}>
                <span style={{ ...typeStyleOf(tile(8), 'label'), color: tile(8).neutralText }}>{projectName}</span>
                <TokenIcon t={tile(8)} concept="check" size={12} color={tile(8).brandSolid} />
              </div>
            </TokenInspector>
            <TokenInspector component="TextLink">
              <p style={{ margin: 0, ...typeStyleOf(tile(8), 'helper'), color: muted(8) }}>{handle}</p>
            </TokenInspector>
          </div>
        </div>
        <TokenInspector component="InlineAlert">
          <p style={{ margin: 0, ...typeStyleOf(tile(8), 'body-sm', { leading: true }), color: tile(8).neutralText }}>
            {translate('One payload underneath: the same JSON Figma, CSS, and an agent all read.')}
          </p>
        </TokenInspector>
        <TokenInspector component="Badge">
          <div className="flex" style={{ gap: gap(tile(8), 'gap-group', '16px') }}>
            <div>
              <span style={{ ...typeStyleOf(tile(8), 'heading-sm'), color: tile(8).neutralText }}>4</span>
              <span style={{ marginLeft: 6, ...typeStyleOf(tile(8), 'helper'), color: muted(8) }}>{translate('Following')}</span>
            </div>
            <div>
              <span style={{ ...typeStyleOf(tile(8), 'heading-sm'), color: tile(8).neutralText }}>12.4K</span>
              <span style={{ marginLeft: 6, ...typeStyleOf(tile(8), 'helper'), color: muted(8) }}>{translate('Followers')}</span>
            </div>
          </div>
        </TokenInspector>
      </ScaledModule>

      {([
        { title: translate('Indie Hackers'), count: '148', by: 'John', icon: 'users' as const, index: 9 },
        { title: translate('AI Builders'), count: '362', by: 'Martha', icon: 'zap' as const, index: 10 },
      ]).map((community) => (
        <ScaledModule key={community.title} t={tile(community.index)} appearance={appearanceAt(community.index)} chrome={false} elev="sm">
          <Card t={tile(community.index)} v={{}} w="100%" elev={false}>
            <div className="flex flex-col" style={{ gap: gap(tile(community.index), 'gap-control', '8px') }}>
              <Well t={tile(community.index)} size={wellSm} icon={community.icon} />
              <div>
                <p style={{ margin: 0, ...typeStyleOf(tile(community.index), 'label'), color: tile(community.index).neutralText }}>{community.title}</p>
                <p style={{ margin: 0, ...typeStyleOf(tile(community.index), 'helper'), color: muted(community.index) }}>{community.count}</p>
              </div>
              <div className="flex items-center" style={{ gap: gap(tile(community.index), 'gap-tight', '4px') }}>
                <Avatar t={tile(community.index)} v={{ Size: 'XS' }} />
                <span style={{ ...typeStyleOf(tile(community.index), 'helper'), color: muted(community.index) }}>{translate('By')} {community.by}</span>
              </div>
            </div>
          </Card>
        </ScaledModule>
      ))}

      <ScaledModule t={tile(12)} appearance={appearanceAt(12)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...typeStyleOf(tile(12), 'body-sm'), color: tile(12).neutralText }}>{translate('You have 2 credits left')}</span>
        <InspectableLive c="Button" t={tile(12)} v={{ Style: 'Soft', Size: 'SM' }}>{translate('Upgrade')}</InspectableLive>
      </ScaledModule>

      <ScaledModule t={tile(13)} appearance={appearanceAt(13)} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <InspectableLive c="Toggle" t={tile(13)} v={{ On: 'True', Size: 'SM' }} toggle="On" />
      </ScaledModule>

      <ScaledModule t={tile(14)} appearance={appearanceAt(14)}>
        <div className="flex items-start justify-between" style={{ gap: gap(tile(14), 'gap-control', '8px') }}>
          <Well t={tile(14)} size={wellSm} icon="box" />
          <InspectableLive c="CloseButton" t={tile(14)} v={{ Size: 'SM' }} />
        </div>
        <div>
          <p style={{ margin: 0, ...typeStyleOf(tile(14), 'heading-sm'), color: tile(14).neutralText }}>{translate('Unsaved changes')}</p>
          <p style={{ margin: 0, ...typeStyleOf(tile(14), 'body-sm', { leading: true }), color: muted(14) }}>
            {translate('Do you want to save or discard changes?')}
          </p>
        </div>
        <div className="flex flex-col" style={{ gap: gap(tile(14), 'gap-control', '8px') }}>
          <InspectableLive c="Button" t={tile(14)} v={{ Style: 'Outline', Size: 'SM' }} w="100%">{translate('Discard')}</InspectableLive>
          <InspectableLive c="Button" t={tile(14)} v={{ Style: 'Solid', Size: 'SM' }} w="100%">{translate('Save changes')}</InspectableLive>
        </div>
      </ScaledModule>

      <ScaledModule
        t={tile(15)}
        appearance={appearanceAt(15)}
        style={{ gap: gap(tile(15), 'gap-group', '16px') }}
      >
        <Toast t={tile(15)} v={{ Status: 'Success' }} w="100%" elev={false} />
        <Toast t={tile(15)} v={{ Status: 'Error' }} w="100%" elev={false} />
      </ScaledModule>

      <ScaledModule
        t={tile(16)}
        appearance={appearanceAt(16)}
        style={{ gap: gap(tile(16), 'gap-group', '16px') }}
      >
        <TabMenu t={tile(16)} v={{}} w="100%" />
        <Progress t={tile(16)} v={{}} w="100%" />
      </ScaledModule>

      <ScaledModule t={tile(18)} appearance={appearanceAt(18)} chrome={false} elev="sm">
        <Sidebar t={tile(18)} v={{}} w="100%" />
      </ScaledModule>

      <ScaledModule t={tile(19)} appearance={appearanceAt(19)}>
        <InputTag t={tile(19)} v={{}} w="100%" />
      </ScaledModule>

      <ScaledModule t={tile(20)} appearance={appearanceAt(20)}>
        <CheckboxGroup t={tile(20)} v={{}} />
      </ScaledModule>

      <ScaledModule t={tile(21)} appearance={appearanceAt(21)}>
        <FileUpload t={tile(21)} v={{}} w="100%" />
      </ScaledModule>

      <ScaledModule
        t={tile(22)}
        appearance={appearanceAt(22)}
        style={{ gap: gap(tile(22), 'gap-group', '16px') }}
      >
        <Stepper t={tile(22)} v={{}} w="100%" />
        <div
          className="flex w-full justify-center"
          style={{
            paddingTop: gap(tile(22), 'gap-group', '16px'),
            borderTop: `${strokeRoleOf(tile(22), 'divider', '1px')} solid ${tile(22).borderDefault || tile(22).border}`,
          }}
        >
          <Pagination t={tile(22)} v={{}} />
        </div>
      </ScaledModule>

      <ScaledModule t={tile(23)} appearance={appearanceAt(23)} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 72 }}>
        <Spinner t={tile(23)} v={{ Size: 'MD' }} />
      </ScaledModule>
    </div>
  )
}
