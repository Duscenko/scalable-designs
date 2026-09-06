// Docs — Get started (destinations) plus the token reference sheet
// (System reference + one article per foundation). The master list lives in
// `DocsRail` (owned by Configurator); this view is the article + TOC.

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { OnThisPage } from './docs/blocks'
import { FoundationArticle, OverviewArticle, foundationToc, overviewToc } from './docs/foundationArticle'
import { GetStartedArticle, getStartedToc } from './docs/getStartedArticle'
import { GUIDE_MCP_KEY, isGuideKey, type DocsExits } from './docs/getStarted'
import { useSystemDoc, OVERVIEW_KEY, foundationDoc, type SystemDocScope } from './docs/foundationDocs'
import { ChangelogArticle, changelogToc, CHANGELOG_KEY } from './docs/changelogArticle'
import { FaqArticle, faqToc, FAQ_KEY } from './docs/faqArticle'
import { useI18n } from '../../lib/i18n'

export { OVERVIEW_KEY }
export { GET_STARTED_KEY } from './docs/getStarted'
export { CHANGELOG_KEY } from './docs/changelogArticle'
export { FAQ_KEY } from './docs/faqArticle'

export default function DocsView({
  activeFoundationKey, onSelectFoundationKey, onEditFoundation, exits, allowReference = true,
  overviewTitle, hubMode, docScope,
}: {
  /** Which row of the master list is open — a Get started key, OVERVIEW_KEY
   *  (the whole-system sheet), or a foundation key. */
  activeFoundationKey: string
  onSelectFoundationKey: (key: string) => void
  /** Opens Variables · <foundation> — the "Edit tokens" link on a foundation
   *  page, which is what makes this documentation OF the editor. */
  onEditFoundation: (foundationKey: string) => void
  /** Leaves Docs for Figma / Export / Save / GitHub — the Get started recipes. */
  exits: DocsExits
  /** The global Docs menu contains operating pages only. Token reference
   *  remains available in the preview's contextual documentation surface. */
  allowReference?: boolean
  /** Title for the whole-system overview sheet. The Theme Preview hub passes the
   *  previewed theme's name so it reads as that theme's spec; omitted elsewhere,
   *  where it falls back to "System reference". */
  overviewTitle?: string
  /** Theme Preview hub — page actions render in the fixed header band. */
  hubMode?: boolean
  /** Theme Preview hub: scope ramps/foundations to the previewed theme (and
   *  optional System Style try-on), so Cupertino docs don't inherit Core's
   *  leftover primitives. */
  docScope?: SystemDocScope
}) {
  const { t } = useI18n()
  const system = useSystemDoc(docScope ?? {})
  const articleRef = useRef<HTMLDivElement>(null)

  const pageKey = !allowReference && !isGuideKey(activeFoundationKey) && activeFoundationKey !== CHANGELOG_KEY && activeFoundationKey !== FAQ_KEY
    ? GUIDE_MCP_KEY
    : activeFoundationKey
  const guide = isGuideKey(pageKey)
  const isChangelog = pageKey === CHANGELOG_KEY
  const isFaq = pageKey === FAQ_KEY
  const doc = allowReference && !guide && !isChangelog && !isFaq && pageKey !== OVERVIEW_KEY
    ? foundationDoc(pageKey)
    : undefined

  useEffect(() => {
    articleRef.current?.scrollTo({ top: 0 })
  }, [pageKey])

  const toc = guide
    ? getStartedToc(activeFoundationKey, t)
    : isChangelog
      ? changelogToc(t)
      : isFaq
        ? faqToc(t)
        : doc
          ? foundationToc(doc, t)
          : overviewToc(t)

  return (
    <div className="h-full w-full min-w-0 flex min-h-0 overflow-hidden">
      {/* Page. Remount-and-fade on `key`, NOT an AnimatePresence exit→enter
          pair — see ComponentsView's identical note; the shell's own center
          swap avoids `mode="wait"` for the same reason. */}
      <div ref={articleRef} className="@container flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <motion.div
          key={pageKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="w-full min-w-0 max-w-4xl mx-auto px-5 @min-[760px]:px-8 py-7"
        >
          {guide ? (
            <GetStartedArticle
              pageKey={pageKey}
              onOpen={onSelectFoundationKey}
              exits={exits}
              showPager={allowReference}
            />
          ) : isChangelog ? (
            <ChangelogArticle />
          ) : isFaq ? (
            <FaqArticle />
          ) : doc ? (
            <FoundationArticle
              doc={doc}
              system={system}
              onOpen={onSelectFoundationKey}
              onEdit={onEditFoundation}
              hubMode={hubMode}
            />
          ) : allowReference ? (
            <OverviewArticle system={system} onOpen={onSelectFoundationKey} title={overviewTitle} hubMode={hubMode} />
          ) : null}
        </motion.div>
      </div>

      {/* On this page — deliberately still `xl` (= 1440px under the 18px root),
          NOT the shell preview's `min-[1180px]`. Tried lowering it to match and
          measured the cost: the article drops from 972 to 756px, and the
          Overview sheet's ramps (`min-w-[40rem]` inside an `overflow-x-auto`)
          start hiding tones 11–12 behind a scroll. A TOC is navigation; the
          ramps are the content — don't trade the second for the first. */}
      <div className="hidden xl:block w-48 flex-shrink-0 border-l border-line p-5 overflow-y-auto">
        <OnThisPage entries={toc} scrollRoot={articleRef} />
      </div>
    </div>
  )
}
