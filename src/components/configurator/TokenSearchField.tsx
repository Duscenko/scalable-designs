import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useI18n } from '../../lib/i18n'
import {
  groupResults, searchTokens, type TokenSearchEntry, type TokenSearchResult,
} from '../../lib/tokenSearch'
import { CHROME_CONTROL_ACTIVE, CHROME_CONTROL_HOVER, CHROME_CONTROL_SHELL } from './themeWorkspaceLayout'

/** Field width as rem — must match the animated overflow mask AND the label
 *  `w-[14rem]`. A px constant (224) assumed a 16px root; this app's root is
 *  18px, so 14rem = 252px and the mask clipped ~28px off the chip. */
const SEARCH_W = '14rem'
/** Collapsed icon is `h-8 w-8` = 2rem (36px at this root). */
const ICON_W = '2rem'
const WIDE_BP = '(min-width: 1280px)'

const IS_MAC = typeof navigator !== 'undefined'
  && /mac/i.test(navigator.platform || navigator.userAgent || '')

const ICON_ACTION = `grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-fg-muted transition-[color,box-shadow] ${CHROME_CONTROL_SHELL} ${CHROME_CONTROL_HOVER} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ui/60 focus-visible:ring-offset-2 focus-visible:ring-offset-app`

/** Search sits `bg-input-bg` on `bg-tab-bar` — fill does not separate (dark
 *  ΔL 0.081, WCAG 1.20:1), so the edge is the boundary. Hover is a real fill
 *  step to `--elevated`, not the shared chip inset wash: that 7% white lift
 *  lands on the tab-bar (ΔL 0.007) and the control vanishes. */
const FIELD_SHELL = [
  'border border-line bg-input-bg',
  'transition-[color,border-color,background-color,box-shadow] duration-150 ease-out',
  'hover:border-line-strong hover:bg-elevated hover:text-fg',
  'focus-within:border-accent-ui focus-within:bg-elevated focus-within:text-fg',
  'focus-within:ring-2 focus-within:ring-accent-ui/60 focus-within:ring-offset-2 focus-within:ring-offset-tab-bar',
].join(' ')

const FOUNDATION_LABEL: Record<string, string> = {
  color: 'Color',
  typography: 'Typography',
  radius: 'Border radius',
  spacing: 'Spacing',
  grid: 'Grid',
  sizes: 'Sizes',
  stroke: 'Stroke',
  shadow: 'Shadow',
}

const COLLECTION_LABEL: Record<string, string> = {
  primitives: 'Primitives',
  semantics: 'Semantics',
  gradients: 'Gradients',
}

function MaskGlyph({
  src,
  className = 'h-3.5 w-3.5 flex-shrink-0 bg-current',
}: {
  src: string
  className?: string
}) {
  const mask = `url('${src}') center / contain no-repeat`
  return <span aria-hidden className={className} style={{ WebkitMask: mask, mask }} />
}

function SearchGlyph({ className = 'h-3.5 w-3.5 flex-shrink-0 bg-current' }: { className?: string }) {
  return <MaskGlyph src="/icons/settings/search.svg" className={className} />
}

export type TokenSearchHandle = { focus: () => void }

interface TokenSearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Cross-foundation index — built from `generateTokenJSON()` in the shell. */
  index: TokenSearchEntry[]
  onSelect: (entry: TokenSearchEntry) => void
}

export const TokenSearchField = forwardRef<TokenSearchHandle, TokenSearchFieldProps>(
  function TokenSearchField({ value: valueProp, onChange, index, onSelect }, ref) {
    const value = valueProp ?? ''
    const { t } = useI18n()
    const inputRef = useRef<HTMLInputElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const [expanded, setExpanded] = useState(false)
    const [wide, setWide] = useState(
      () => typeof window !== 'undefined' && window.matchMedia(WIDE_BP).matches,
    )
    const [panelOpen, setPanelOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null)
    // The width mask MUST clip while the chip is growing/shrinking or the
    // 14rem field spills. Once settled, clip OFF — `ring-offset-2` paints
    // 4px outside the label and `overflow-hidden` was slicing that halo
    // (top/right especially, against the tab-bar edge).
    const [clipping, setClipping] = useState(false)
    const reduceMotion = useReducedMotion()

    const { results, total } = useMemo(
      () => searchTokens(index, value),
      [index, value],
    )
    const grouped = useMemo(() => groupResults(results), [results])
    const flatResults = results

    useEffect(() => {
      const mq = window.matchMedia(WIDE_BP)
      const sync = () => {
        setWide(mq.matches)
        if (mq.matches) setExpanded(false)
      }
      sync()
      mq.addEventListener('change', sync)
      return () => mq.removeEventListener('change', sync)
    }, [])

    const open = wide || expanded

    const focusField = useCallback(() => {
      if (!wide) setExpanded(true)
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        el.select()
        setPanelOpen(true)
      })
    }, [wide])

    useImperativeHandle(ref, () => ({ focus: focusField }), [focusField])

    const measurePanel = useCallback(() => {
      const el = rootRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPanelRect({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 320) })
    }, [])

    useLayoutEffect(() => {
      if (!panelOpen || !value.trim()) return
      measurePanel()
      const onLayout = () => measurePanel()
      window.addEventListener('resize', onLayout)
      window.addEventListener('scroll', onLayout, true)
      return () => {
        window.removeEventListener('resize', onLayout)
        window.removeEventListener('scroll', onLayout, true)
      }
    }, [measurePanel, panelOpen, value, open, wide])

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return
        const active = document.activeElement as HTMLElement | null
        const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
        if (typing && active !== inputRef.current) return
        if (!inputRef.current) return
        e.preventDefault()
        focusField()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [focusField])

    useEffect(() => {
      if (!expanded || wide || value) return
      const onPointerDown = (e: PointerEvent) => {
        if (rootRef.current?.contains(e.target as Node)) return
        setExpanded(false)
        setPanelOpen(false)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        setExpanded(false)
        setPanelOpen(false)
        inputRef.current?.blur()
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKey)
      }
    }, [expanded, wide, value])

    useEffect(() => {
      setActiveIndex(-1)
      if (value.trim()) setPanelOpen(true)
    }, [value])

    const pick = useCallback((entry: TokenSearchResult) => {
      onSelect(entry)
      setPanelOpen(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
    }, [onSelect])

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!value.trim()) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPanelOpen(true)
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
        e.preventDefault()
        pick(flatResults[activeIndex])
      } else if (e.key === 'Escape') {
        setPanelOpen(false)
        setActiveIndex(-1)
      }
    }

    useEffect(() => {
      if (activeIndex < 0) return
      listRef.current
        ?.querySelector(`[data-result-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex])

    const showPanel = panelOpen && value.trim().length > 0 && panelRect

    const input = (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (value.trim()) setPanelOpen(true) }}
        onKeyDown={onInputKeyDown}
        placeholder={t('Search tokens')}
        aria-label={t('Search tokens')}
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        role="combobox"
        aria-expanded={!!showPanel}
        aria-controls="token-search-results"
        aria-autocomplete="list"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-muted"
        onBlur={() => {
          window.setTimeout(() => {
            if (listRef.current?.contains(document.activeElement)) return
            setPanelOpen(false)
            if (value || wide) return
            if (!rootRef.current?.contains(document.activeElement)) setExpanded(false)
          }, 120)
        }}
      />
    )

    const clearBtn = value ? (
      <button
        type="button"
        onClick={() => {
          onChange('')
          setPanelOpen(false)
          setActiveIndex(-1)
        }}
        aria-label={t('Clear search')}
        className="grid h-5 w-5 flex-shrink-0 place-items-center rounded text-ui text-fg-muted hover:bg-chip-rest hover:text-fg"
      >
        ×
      </button>
    ) : (
      <MaskGlyph
        src="/icons/settings/search-comands.svg"
        className="hidden min-[1180px]:block h-3.5 w-[33px] flex-shrink-0 bg-current"
      />
    )

    const field = wide || open ? (
      <label className={`flex h-8 w-[14rem] items-center gap-1.5 rounded-lg px-2.5 text-fg-muted ${FIELD_SHELL}`}>
        <SearchGlyph />
        {input}
        {clearBtn}
      </label>
    ) : (
      <button
        type="button"
        onClick={focusField}
        aria-label={t('Search tokens')}
        title={`${t('Search tokens')} (${IS_MAC ? '⌘K' : 'Ctrl+K'})`}
        className={`${ICON_ACTION} ${value ? `${CHROME_CONTROL_ACTIVE} text-fg` : ''}`}
      >
        <SearchGlyph className="h-4 w-4 bg-current text-current" />
      </button>
    )

    let resultIndex = -1
    const panel = showPanel && panelRect ? createPortal(
      <div
        id="token-search-results"
        role="listbox"
        className="fixed z-[200] overflow-hidden rounded-xl border border-line bg-elevated shadow-lg"
        style={{ top: panelRect.top, left: panelRect.left, width: panelRect.width, maxHeight: 'min(420px, calc(100vh - 80px))' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {results.length === 0 ? (
          <p className="px-3 py-4 text-body text-fg-muted">
            {t('No matching tokens')} “{value.trim()}”
          </p>
        ) : (
          <ul ref={listRef} className="overflow-y-auto py-1" style={{ maxHeight: 'min(400px, calc(100vh - 96px))' }}>
            {grouped.map((group) => (
              <li key={group.foundation}>
                <p className="px-3 pt-2 pb-1 text-micro font-semibold uppercase tracking-widest text-fg-faint">
                  {FOUNDATION_LABEL[group.foundation] ?? group.foundation}
                </p>
                <ul>
                  {group.results.map((row) => {
                    resultIndex += 1
                    const idx = resultIndex
                    const active = idx === activeIndex
                    return (
                      <li key={`${row.foundation}-${row.id}`}>
                        <button
                          type="button"
                          role="option"
                          data-result-index={idx}
                          aria-selected={active}
                          onClick={() => pick(row)}
                          className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                            active ? 'bg-elevated text-fg font-medium' : 'text-fg hover:bg-chip-rest'
                          }`}
                        >
                          <span className="flex min-w-0 items-baseline justify-between gap-2">
                            <span className="truncate font-mono text-ui">{row.label}</span>
                            <span className="flex-shrink-0 text-micro text-fg-faint">
                              {COLLECTION_LABEL[row.collection] ?? row.collection}
                            </span>
                          </span>
                          {(row.value || row.description) && (
                            <span className="truncate text-mini text-fg-muted">
                              {row.value || row.description}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {total > results.length && (
          <p className="border-t border-line px-3 py-2 text-mini text-fg-faint">
            +{total - results.length} {t('more matches')}
          </p>
        )}
      </div>,
      document.body,
    ) : null

    if (wide) {
      return (
        <div ref={rootRef} className="relative flex-shrink-0">
          {field}
          {panel}
        </div>
      )
    }

    return (
      <div ref={rootRef} className="relative flex-shrink-0">
        <motion.div
          className={clipping ? 'overflow-hidden' : ''}
          initial={false}
          animate={{ width: open ? SEARCH_W : ICON_W }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.33, 1, 0.68, 1] }}
          onAnimationStart={() => setClipping(true)}
          onAnimationComplete={() => setClipping(false)}
        >
          {field}
        </motion.div>
        {panel}
      </div>
    )
  },
)
