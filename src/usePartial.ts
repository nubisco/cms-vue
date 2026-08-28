/**
 * A PARTIAL, as a component reads it.
 *
 * A partial is a document that is not a page: it has no route of its own, it is
 * included BY pages (a footer, a nav). Delivery serves it from
 *   GET /api/v1/{site}/{env}/_partials/{key}
 * and answers with the same document shape a page returns.
 *
 * Two things separate this from useCmsPage:
 *
 *  1. It is fetched ONCE PER APP LOAD, not once per route change. Site chrome
 *     refetched on every navigation would put a request (and a re-render of the
 *     footer) on every link click. The result is memoised per key, so every
 *     layout instance shares one request.
 *
 *  2. A failure is not an error state the caller has to design for: it leaves
 *     `doc` null and the caller renders its coded fallback. A partial that does
 *     not exist yet, an endpoint that is not deployed yet, and a CMS that is
 *     unreachable all land in the same place on purpose.
 *
 * WHERE THE MEMO LIVES is the whole difficulty, and it is the one thing a
 * library must get right that an app can be sloppy about. The browser has
 * exactly one app load, so module scope IS the right scope there. A SERVER does
 * not: a Worker isolate renders many requests, concurrently and for as long as
 * it lives, so a module-scope memo makes the chrome permanently stale. The
 * first request an isolate served would decide the nav and footer for every
 * request after it, and a publish would never appear. On the server the states
 * therefore hang off the Vue app instance, which is created fresh per request
 * and is the natural per-request scope.
 */
import { getCurrentInstance, ref, type Ref } from 'vue'
import { isServerRender, useCms, type CmsClient, type CmsPartialDocument } from './client'

interface PartialState {
  doc: Ref<CmsPartialDocument | null>
  /** Live copy from the editor: { $t } refs resolve through this while editing. */
  messages: Ref<Record<string, string>>
  /** Null until the first load settles; then the failure reason, or ''. */
  error: Ref<string | null>
  /** True until the first load settles, so the caller can avoid a chrome flash. */
  loading: Ref<boolean>
  started: boolean
  /**
   * The in-flight first load, so a SERVER RENDER can AWAIT it. Without this the
   * partial resolves only in the browser: the server puts the coded fallback
   * into every page and hydration swaps the CMS one in underneath the reader.
   */
  ready: Promise<void> | null
}

const clientStates = new Map<string, PartialState>()

interface StateHost {
  __cmsPartialStates?: Map<string, PartialState>
}

function statesFor(app?: unknown): Map<string, PartialState> {
  if (!isServerRender()) return clientStates
  const host = (app ?? getCurrentInstance()?.appContext.app) as StateHost | undefined
  // No app instance to hang off (a bare server-side call): a fresh map, never
  // the shared one, because sharing is precisely the bug.
  if (!host) return new Map<string, PartialState>()
  return (host.__cmsPartialStates ??= new Map<string, PartialState>())
}

/** Partials from two sites or two environments are different documents. */
function stateKey(cms: CmsClient | null, key: string): string {
  return cms ? `${cms.siteId}:${cms.environment}:${key}` : `:${key}`
}

function blankState(): PartialState {
  return {
    doc: ref<CmsPartialDocument | null>(null),
    messages: ref<Record<string, string>>({}),
    error: ref<string | null>(null),
    loading: ref(true),
    started: false,
    ready: null,
  }
}

function stateFor(id: string, app?: unknown): PartialState {
  const states = statesFor(app)
  let s = states.get(id)
  if (!s) {
    s = blankState()
    states.set(id, s)
  }
  return s
}

/**
 * True when a live-preview patch is carrying THIS partial rather than a page.
 *
 * The console posts whichever document it currently has open. A page document
 * is addressed by a route (always '/'-prefixed); a partial is addressed by its
 * key. Every marker delivery or the console might use is accepted, and the
 * '/'-prefix rule is the backstop, so a footer patch is never mistaken for a
 * page (which would replace the page body with the footer) and a page patch is
 * never mistaken for the footer.
 */
export function isPartialDocument(doc: unknown, key?: string): boolean {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as {
    key?: unknown
    route?: unknown
    contentType?: unknown
    content_type?: unknown
    kind?: unknown
  }
  const type =
    typeof d.contentType === 'string' ? d.contentType : typeof d.content_type === 'string' ? d.content_type : ''
  const isPartial = type === 'partial' || d.kind === 'partial'
  const named =
    typeof d.key === 'string' ? d.key : typeof d.route === 'string' && !d.route.startsWith('/') ? d.route : ''
  if (!isPartial && !named) return false
  // When a key is asked for, the document has to be that one.
  return key ? named === key || (isPartial && named === '') : true
}

/**
 * Origins a live-preview patch may arrive from: the window that embedded us, on
 * the delivery origin, an explicitly configured console origin, or the referrer
 * (which is where the console actually lives in local development).
 */
function allowedParentOrigins(cms: CmsClient | null): string[] {
  const out = new Set<string>()
  const add = (raw: string | undefined): void => {
    if (!raw) return
    try {
      out.add(new URL(raw).origin)
    } catch {
      /* not a URL: ignore */
    }
  }
  add(cms?.apiBase)
  for (const o of cms?.options.consoleOrigins ?? []) add(o)
  add(typeof document !== 'undefined' ? document.referrer : undefined)
  return Array.from(out)
}

function listenForPatches(cms: CmsClient | null, key: string, s: PartialState): void {
  if (typeof window === 'undefined') return
  window.addEventListener('message', (ev: MessageEvent) => {
    if (!cms?.preview().active) return
    if (window.parent !== window) {
      if (ev.source !== window.parent) return
      if (!allowedParentOrigins(cms).includes(ev.origin)) return
    } else if (ev.origin !== window.location.origin) {
      return
    }
    const data = ev.data as {
      type?: string
      document?: CmsPartialDocument
      messages?: Record<string, string>
    } | null
    // The console's protocol is configurable: a tenant running its own editing
    // console must be able to speak to the canvas without forking the library.
    const patchType = cms?.patchMessageType ?? 'nubisco-cms:patch'
    if (!data || data.type !== patchType || !data.document?.zones?.main) return
    if (!isPartialDocument(data.document, key)) return
    if (data.messages && typeof data.messages === 'object') s.messages.value = data.messages
    s.doc.value = data.document
    s.error.value = ''
    s.loading.value = false
  })
}

export interface UseCmsPartial {
  doc: Ref<CmsPartialDocument | null>
  messages: Ref<Record<string, string>>
  error: Ref<string | null>
  loading: Ref<boolean>
  /** Await the first load, so a server render emits the partial, not the fallback. */
  whenReady: () => Promise<void>
}

/**
 * The 'footer' partial (or any other key), shared across the whole app load.
 * `doc` is null whenever the partial is unavailable for ANY reason: partials are
 * off, the endpoint 404s, the CMS is unreachable, or the document is empty.
 * Callers render their coded fallback in that case.
 */
export function useCmsPartial(key: string, client?: CmsClient | null): UseCmsPartial {
  const cms = client ?? useCms()
  const s = stateFor(stateKey(cms, key))
  if (!s.started) {
    s.started = true
    if (!cms) {
      s.error.value = 'CMS client is not configured'
      s.loading.value = false
    } else {
      // In edit mode the console drives the canvas, so listen before fetching.
      if (cms.options.livePreview !== false && cms.preview().active) listenForPatches(cms, key, s)
      s.ready = cms.fetchPartial(key).then((res) => {
        // A live patch that landed first is newer than this response.
        if (s.doc.value) return
        s.doc.value = res.doc
        s.error.value = res.error
        s.loading.value = false
      })
      void s.ready
    }
  }
  return {
    doc: s.doc,
    messages: s.messages,
    error: s.error,
    loading: s.loading,
    whenReady: () => s.ready ?? Promise.resolve(),
  }
}

/** Test/dev helper: forget the memoised partials so the next call refetches. */
export function resetCmsPartials(): void {
  clientStates.clear()
}

/* ────────────────────────────────────────────────────────────────────────────
 * SSR STATE TRANSFER
 *
 * Awaiting the fetch on the server fixes the DOCUMENT: the server-rendered HTML
 * carries the CMS chrome. It does NOT fix the LIVE PAGE. The client starts from
 * doc=null, so Vue hydrates the header to the CODED fallback and only swaps the
 * CMS one back when the network round-trip lands. On a deployed site that was
 * measured as a 162ms window on one route and 1.69s on another, during which
 * the header painted a held-back link and every nav item jumped sideways and
 * back. That is the exact leak this work exists to prevent.
 *
 * The fix is the standard SSR one: the server hands its resolved partials to
 * the client through the framework's initial-state channel, and the client
 * adopts them BEFORE mount. Hydration then starts from the very state the HTML
 * was rendered from, so there is no second render and no fetch.
 *
 * The whole state is transferred, INCLUDING A FAILURE. If the server got a 404
 * it rendered the coded chrome, so the client must keep the coded chrome: a
 * client refetch that succeeded would swap the CMS chrome in underneath the
 * reader, which is the same defect wearing the other mask.
 * ──────────────────────────────────────────────────────────────────────────── */

/** What the server render hands to the browser, per partial key. */
export interface CmsPartialSnapshot {
  doc: CmsPartialDocument | null
  error: string | null
}

/** Key under which the snapshot travels inside the host's initial state. */
export const CMS_PARTIAL_STATE_KEY = 'cmsPartials'

/**
 * Everything resolved so far, for the server render to serialise. Call it after
 * renderToString, so every partial an awaited prefetch resolved is in. Pass the
 * app instance: on the server that is where the states live.
 */
export function snapshotCmsPartials(app?: unknown): Record<string, CmsPartialSnapshot> {
  const out: Record<string, CmsPartialSnapshot> = {}
  for (const [key, s] of statesFor(app)) {
    if (s.loading.value) continue // never settled: nothing truthful to transfer
    out[key] = { doc: s.doc.value, error: s.error.value }
  }
  return out
}

/**
 * Adopt the server's partials before the app mounts, so hydration matches the
 * HTML exactly and no fetch is issued.
 *
 * Skipped in edit mode on purpose: the canvas is meant to show the DRAFT and to
 * take live patches from the console, so it must fetch for itself rather than
 * inherit the published documents the server render resolved.
 */
export function hydrateCmsPartials(raw: unknown, client?: CmsClient | null): void {
  if (!raw || typeof raw !== 'object') return
  if (client?.preview().active) return
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const snap = value as CmsPartialSnapshot | null
    if (!snap || typeof snap !== 'object') continue
    const s = stateFor(key)
    if (s.started) continue // a component already asked: do not fight it
    s.started = true
    s.doc.value = snap.doc ?? null
    s.error.value = typeof snap.error === 'string' ? snap.error : snap.doc ? '' : 'CMS partial unavailable'
    s.loading.value = false
    s.ready = Promise.resolve()
  }
}
