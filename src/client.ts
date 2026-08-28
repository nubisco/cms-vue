/**
 * The CMS client: configure a site once, then read documents from delivery.
 *
 * This is the equivalent of Prismic's createPrismic/usePrismic. A host does:
 *
 *   const cms = createCms({ siteId: 'nubisco-corporate', environment: 'production' })
 *   app.use(cms)                       // provides it to every component
 *   const { doc, outcome } = await cms.fetchPage('/about')
 *
 * and the primitives (CmsLink, CmsRichText) pick the same configuration up by
 * injection, which is where they get their navigate function from.
 *
 * THIS MODULE HOLDS NO PER-DOCUMENT STATE ON PURPOSE. A Worker isolate renders
 * many requests, concurrently and for as long as it lives, so anything memoised
 * at module scope here would be answered from the first request the isolate
 * ever served and a publish would never appear. Fetching is a pure function of
 * its arguments; the one memo the system needs (partials, which are site chrome
 * and must not refetch on every navigation) lives in usePartial, scoped to the
 * Vue app instance on the server and to module scope only in the browser, where
 * there genuinely is exactly one app load.
 */
import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { Zone } from './contract'

export type FetchLike = (input: string, init?: { cache?: RequestCache; headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

/** A router this library can hand a route to, without depending on any router. */
export interface CmsRouterLike {
  push: (to: string) => unknown
}

/** Whether this render is the editor canvas, and what it may read. */
export interface CmsPreview {
  /** True in the in-context editor (?cms-edit=1). Bypasses the edge cache. */
  active: boolean
  /** ?cms-env override, so the canvas shows the environment being edited. */
  environment?: string
  /**
   * The short-lived token the console mints for the canvas. Reading a draft is
   * a capability, not a flag: delivery serves one only to a caller that proves
   * it edits this site. The canvas runs on the host's own origin and therefore
   * cannot send a CMS session cookie, which is why the token exists.
   */
  token?: string
}

export interface CmsClientOptions {
  /** e.g. 'nubisco-corporate'. */
  siteId: string
  /** Which environment to read: development | staging | production. */
  environment?: string
  /** Delivery base, e.g. https://cms.nubisco.io. Required: there is no default. */
  apiBase: string
  /**
   * The postMessage type the editing console posts a live document with.
   * Defaults to the Nubisco console's, so a white-label console can speak its
   * own protocol without forking the library.
   */
  patchMessageType?: string
  /** Injected for tests, or for a Worker that must pass its own fetch. */
  fetch?: FetchLike
  /**
   * How an internal link navigates. A library cannot assume the host's router,
   * so give it one of these, or neither: with neither, every link stays a plain
   * anchor and the browser does a full page load, which is correct, just slower.
   */
  router?: CmsRouterLike
  navigate?: (href: string) => unknown
  /** Where preview comes from. Defaults to reading the browser's query string. */
  preview?: () => CmsPreview
  /**
   * Whether partials may be fetched at all. A partial has no route to be
   * published at, so there is no row whose presence could turn it on: the host
   * either composes its chrome from the CMS or it does not.
   */
  partials?: boolean
  /** Accept live-preview patches from the console while in edit mode. */
  livePreview?: boolean
  /** Extra origins a live-preview patch may arrive from (the console's URL). */
  consoleOrigins?: string[]
}

export interface CmsPageDocument {
  route: string
  meta?: Record<string, unknown>
  zones: Record<string, Zone>
}

export interface CmsPartialDocument {
  /** The partial key, e.g. 'footer'. Delivery returns it as `key`. */
  key?: string
  meta?: Record<string, unknown>
  zones: Record<string, Zone>
}

/**
 * How a load ended. Separate from `error` because the two failures are not the
 * same fact and a request-time renderer has to tell them apart: delivery
 * answering 404 means this path genuinely has no page (render the 404), while
 * delivery being unreachable or broken means we do not know (render nothing and
 * answer 503, so a crawler comes back instead of recording the page as gone).
 */
export type CmsOutcome = 'ok' | 'missing' | 'unavailable'

export interface CmsPageResult {
  doc: CmsPageDocument | null
  error: string | null
  outcome: CmsOutcome
}

export interface CmsPartialResult {
  doc: CmsPartialDocument | null
  /** '' on success; a reason otherwise. Any reason means: render the coded fallback. */
  error: string | null
}

export interface CmsClient {
  readonly siteId: string
  readonly environment: string
  readonly apiBase: string
  /** The console protocol this canvas answers to. See CmsClientOptions. */
  readonly patchMessageType: string
  readonly options: CmsClientOptions
  /** The preview state of this render. */
  preview(): CmsPreview
  /** The delivery URL for a document path, preview included. */
  documentUrl(path: string): string
  /**
   * Navigate in-app. Returns false when the host gave no router, which is the
   * caller's signal to leave the click to the browser.
   */
  navigate(href: string): boolean
  fetchPage(route: string): Promise<CmsPageResult>
  fetchPartial(key: string): Promise<CmsPartialResult>
  /** Vue plugin: `app.use(cms)`. */
  install(app: App): void
}

export const CMS_CLIENT: InjectionKey<CmsClient> = Symbol('cms-client')

/** True in any non-browser render (a Worker isolate, Node, a test). */
export function isServerRender(): boolean {
  return typeof window === 'undefined'
}

function locationParams(): URLSearchParams | null {
  return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
}

/** The default preview source: the canvas's own query string. */
export function readPreviewFromLocation(): CmsPreview {
  const p = locationParams()
  if (!p?.has('cms-edit')) return { active: false }
  return {
    active: true,
    environment: p.get('cms-env')?.trim() || undefined,
    token: p.get('cms-preview-token')?.trim() || undefined,
  }
}

const NOOP_PREVIEW: CmsPreview = { active: false }

export function createCms(options: CmsClientOptions): CmsClient {
  // No default host. A library that falls back to one vendor's API means a
  // misconfigured tenant silently fetches someone else's content instead of
  // failing where the mistake is. Fail loudly at construction instead.
  if (!options.apiBase) {
    throw new Error('createCms: apiBase is required, for example https://cms.example.com')
  }
  if (!options.siteId) {
    throw new Error('createCms: siteId is required')
  }
  const apiBase = options.apiBase.replace(/\/$/, '')
  const environment = options.environment || 'production'
  const siteId = options.siteId
  const doFetch: FetchLike = (options.fetch ?? ((input, init) => fetch(input, init))) as FetchLike
  const previewOf = options.preview ?? readPreviewFromLocation

  function preview(): CmsPreview {
    try {
      return previewOf() ?? NOOP_PREVIEW
    } catch {
      return NOOP_PREVIEW
    }
  }

  function documentUrl(path: string): string {
    const pv = preview()
    const env = (pv.active && pv.environment) || environment
    // With a token we present the credential; without one we still ask
    // (?preview=1) so a same-origin session can answer, and an anonymous caller
    // simply gets the published document.
    const query = pv.active ? (pv.token ? `?previewToken=${encodeURIComponent(pv.token)}` : '?preview=1') : ''
    return `${apiBase}/api/v1/${siteId}/${env}/${path.replace(/^\/+/, '')}${query}`
  }

  async function read(path: string): Promise<{ status: number; body: unknown } | null> {
    // A REQUEST-TIME render must never answer from a cache: the whole point of
    // rendering per request is that a publish is live on the next request, and
    // a cached read would put a stale document back in the response. The
    // browser keeps its ordinary cache behaviour for client-side navigation.
    const cache: RequestCache = preview().active || isServerRender() ? 'no-store' : 'default'
    const res = await doFetch(documentUrl(path), { cache })
    if (!res.ok) return { status: res.status, body: null }
    return { status: res.status, body: await res.json() }
  }

  async function fetchPage(route: string): Promise<CmsPageResult> {
    try {
      const res = await read(route)
      if (!res) return { doc: null, error: 'CMS delivery unreachable', outcome: 'unavailable' }
      if (res.body === null) {
        // 404 and 410 are delivery ANSWERING: no document lives at this path.
        // Anything else (429, 5xx, a gateway page) is delivery failing, which
        // says nothing about the path.
        const missing = res.status === 404 || res.status === 410
        return {
          doc: null,
          error: `CMS delivery ${res.status}`,
          outcome: missing ? 'missing' : 'unavailable',
        }
      }
      const doc = res.body as CmsPageDocument
      return { doc, error: null, outcome: doc?.zones?.main ? 'ok' : 'missing' }
    } catch {
      return { doc: null, error: 'CMS delivery unreachable', outcome: 'unavailable' }
    }
  }

  async function fetchPartial(key: string): Promise<CmsPartialResult> {
    if (options.partials === false) return { doc: null, error: 'CMS partials are off' }
    try {
      const res = await read(`_partials/${encodeURIComponent(key)}`)
      if (!res) return { doc: null, error: 'CMS delivery unreachable' }
      if (res.body === null) {
        // 404 is the ordinary answer for "no partial with that key" (and for an
        // endpoint that is not deployed yet). Both mean: render the coded chrome.
        return { doc: null, error: `CMS delivery ${res.status}` }
      }
      const doc = res.body as CmsPartialDocument
      // A partial that exists but carries no blocks would render as nothing at
      // all. That is a footerless site, so it counts as absent.
      if (!doc?.zones?.main?.blocks?.length) return { doc: null, error: 'CMS partial is empty' }
      return { doc, error: '' }
    } catch {
      return { doc: null, error: 'CMS delivery unreachable' }
    }
  }

  function navigate(href: string): boolean {
    if (options.navigate) {
      void options.navigate(href)
      return true
    }
    if (options.router) {
      void options.router.push(href)
      return true
    }
    return false
  }

  const client: CmsClient = {
    siteId,
    environment,
    apiBase,
    patchMessageType: options.patchMessageType ?? 'nubisco-cms:patch',
    options,
    preview,
    documentUrl,
    navigate,
    fetchPage,
    fetchPartial,
    install(app: App) {
      app.provide(CMS_CLIENT, client)
    },
  }
  return client
}

/**
 * The configured client, or null when the host never installed one. Null is a
 * supported state: the primitives fall back to plain anchors and coded content,
 * which is what lets a product adopt them one component at a time.
 */
export function useCms(): CmsClient | null {
  return inject(CMS_CLIENT, null)
}

/** The same, but for code that cannot proceed without configuration. */
export function useCmsOrThrow(): CmsClient {
  const client = useCms()
  if (!client) throw new Error('[cms-vue] No CMS client provided. Call app.use(createCms({ siteId }))')
  return client
}
