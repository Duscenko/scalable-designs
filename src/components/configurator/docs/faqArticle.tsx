// FAQ — the honest-expectations page. Escala is an independent, single-
// maintainer project in beta with one deliberate architecture and one export
// target (Figma) today. Presented as an accordion, the same disclosure style
// the About surfaces use (`AboutAccordion`) — the first question opens by
// default so the page never reads as an empty list of headers.
// Page chrome (DocHeader · DocTitle) stays shared with every other Docs
// article; only the body is the accordion.

import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { CONTACT } from '../AboutMenu'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../ui/accordion'
import { DocHeader, DocTitle, Prose, type TocEntry } from './blocks'
import {
  AGENT_CONTEXT_FAQ_ID, OPEN_FAQ_EVENT, takePendingFaqItem,
} from '../../../lib/aiContext'
import { useI18n } from '../../../lib/i18n'

export const FAQ_KEY = '__faq'

/** The X handle from `CONTACT.x` (`https://x.com/duscenko` -> `duscenko`). */
const X_HANDLE = (CONTACT.x ?? '').replace(/\/+$/, '').split('/').pop() ?? ''

/** A prefilled X post, mentioning the handle, with the report fields laid out
 *  so a bug lands with context already attached. `intent/tweet` needs no
 *  numeric account id (a DM-compose link would). */
const BUG_TWEET = `https://x.com/intent/tweet?text=${encodeURIComponent(
  [
    `@${X_HANDLE} Escala Tokens bug:`,
    '',
    'What happened:',
    'What I expected:',
    'Browser / OS:',
    'Plugin version (if relevant):',
  ].join('\n'),
)}`

function Para({ text }: { text: string }) {
  return <Prose text={text} className="text-ui leading-relaxed" />
}

type Translate = (source: string) => string

/** Single source for both the accordion body and the "On this page" TOC —
 *  the same shape `AboutMenu`'s `SECTIONS` uses.
 *
 *  **Every answer is `paras`, never inline JSX.** Half of these used to be a
 *  `body` of hardcoded `<Para text="…">` elements, which meant the render's
 *  `t()` call never saw them and the FAQ stayed English in an app that
 *  otherwise speaks three languages. `paras` is the only field that carries
 *  prose; `extra` is for the one answer that also needs a control, and it
 *  receives `t` so its label translates too. */
const FAQ_ITEMS: {
  id: string
  q: string
  paras: string[]
  extra?: (t: Translate) => ReactNode
}[] = [
  {
    id: 'architecture',
    q: 'Why is there only one architecture?',
    paras: [
      "Escala ships a single semantic architecture, `Categorical Semantic`, and it's selected by default. You don't pick between token schemes. There is one, and the whole app is built around it.",
      "That's a deliberate choice, not a missing feature. A design-token system is only useful if every consumer (Figma, CSS, an AI agent) agrees on what a role means. One well-defined set of roles that always resolves to an accessible value is worth more here than a blank canvas that each team fills in differently.",
    ],
  },
  {
    id: 'no-free-tokens',
    q: 'Can I create my own tokens or rename the roles?',
    paras: [
      "Not freely. You configure the VALUES behind the roles: colours, type, spacing, radius, and so on. You can add colour families and themes. You can't invent new role names or restructure the schema. The Categorical architecture defines the roles, and the export, the docs and the Figma plugin all depend on that shape staying fixed.",
    ],
  },
  {
    id: 'beta',
    q: 'How finished is this?',
    paras: [
      "It's a beta. The core flow (configure, preview, export, sync to Figma) works and is used in real projects, but the token contract, the UI and the docs still change. Pin a copy of any export you ship, and re-check your system after an update.",
    ],
  },
  {
    id: 'plugin-updates',
    q: 'Do I need to keep the Figma plugin updated?',
    paras: [
      'Yes. The plugin ships frequent updates, often alongside changes to the token format. The `Sync` button in the top bar shows a dot when a newer plugin build is available. When you see it, re-download the plugin from Sync, then Download plugin, and re-import it in Figma. An out-of-date plugin can silently skip parts of a newer payload.',
    ],
  },
  {
    id: 'figma-only',
    q: 'Does this work with anything other than Figma?',
    paras: [
      'Today, no. Figma is the only supported target. The export also produces `variables.css` and W3C JSON you can use anywhere, but the round-trip sync is Figma-only for now.',
      'On the roadmap: extending the same model to other design surfaces, like Paper, Pencil, and Claude-based design environments. None of those are wired up yet. Treat them as intent, not a promise with a date.',
    ],
  },
  {
    id: AGENT_CONTEXT_FAQ_ID,
    q: 'Send this system to an agent',
    paras: [
      'Copy page puts a markdown brief on the clipboard — token names, semantic roles, and how they map in Figma and CSS. It is a snapshot you paste, not a live MCP connection.',
      'Paste it into Google Stitch, Claude (Claude Code or Claude Design), Figma Make’s chat, Cursor, or any LLM so the agent uses this system’s roles instead of inventing hex and px.',
      'A live connection in the product repo is Docs → Use in code (MCP). The Figma Make Skill zip is a separate install on that page — Copy page does not upload a zip.',
    ],
  },
  {
    id: 'who',
    q: 'Who makes this?',
    paras: [
      'One person: Cesar Durango. Design Ops is what I do and what I care about. I live in this problem space and build this infrastructure myself, on my own time.',
      "So the cadence, the support and the roadmap are all a solo project's. That's the trade for a tool that's opinionated, free, and moves fast.",
    ],
  },
  {
    id: 'report',
    q: 'I found a bug, how do I report it?',
    paras: [
      "Send it to me on X. Reports genuinely shape what gets fixed next. Say what happened, what you expected, your browser, and the plugin version if it's relevant. The button below opens a post with those fields ready, addressed to me.",
    ],
    // `extra` rather than `body`: the prose above must stay in `paras` so it
    // goes through `t()` like every other answer. Only the CTA — which has no
    // prose equivalent — is markup, and it takes `t` so its label translates.
    extra: (t) => (
      <div className="pt-1">
        <a
          href={BUG_TWEET}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-accent-solid px-4 py-2 text-ui font-medium text-accent-ink hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
          </svg>
          {t('Open a bug report')}
        </a>
      </div>
    ),
  },
]

export function faqToc(t: Translate = (source) => source): TocEntry[] {
  return [{ id: 'description', label: t('Overview') }, ...FAQ_ITEMS.map((i) => ({ id: i.id, label: t(i.q) }))]
}

function scrollFaqItem(id: string, reduce: boolean) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, 200)
}

export function FaqArticle() {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(() => takePendingFaqItem() ?? FAQ_ITEMS[0].id)

  useEffect(() => {
    if (open && open !== FAQ_ITEMS[0].id) scrollFaqItem(open, !!reduce)
    // First paint only — later accordion clicks must not yank the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const item = (event as CustomEvent<{ item?: string }>).detail?.item
      if (!item) return
      takePendingFaqItem()
      setOpen(item)
      scrollFaqItem(item, !!reduce)
    }
    window.addEventListener(OPEN_FAQ_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_FAQ_EVENT, onOpen)
  }, [reduce])

  return (
    <div className="flex flex-col gap-8">
      <DocHeader section={t('Docs')} kind={t('Get started')} title={t('FAQ')} actions={null} />
      <DocTitle
        title={t('FAQ')}
        eyebrow={t('About')}
        lead={t("Escala Tokens is an independent, one-person project, and it's in beta. Here's what that means before you build a system on it.")}
      />

      <Accordion type="single" collapsible value={open} onValueChange={setOpen} className="max-w-2xl -mx-3">
        {FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id} id={item.id} className="border-b border-line scroll-mt-4">
            <AccordionTrigger className="px-3 hover:bg-elevated/40 text-ui text-fg">
              {t(item.q)}
            </AccordionTrigger>
            <AccordionContent className="px-3">
              <div className="flex flex-col gap-2 text-ui text-fg-muted leading-relaxed">
                {item.paras.map((para) => <Para key={para} text={t(para)} />)}
                {item.extra?.(t)}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
