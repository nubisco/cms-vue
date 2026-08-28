/**
 * A page document, as a component reads it.
 *
 * Deliberately stateless beyond the refs it returns: a page IS per route and per
 * request, so there is nothing here to memoise and nothing to leak between the
 * requests a Worker isolate serves. Call `load()` from `onServerPrefetch` (and
 * await it) so a server render emits the document rather than a spinner.
 */
import { ref, type Ref } from 'vue'
import { useCms, type CmsClient, type CmsOutcome, type CmsPageDocument } from './client'

export interface UseCmsPage {
  doc: Ref<CmsPageDocument | null>
  error: Ref<string | null>
  outcome: Ref<CmsOutcome>
  loading: Ref<boolean>
  load: () => Promise<void>
}

export function useCmsPage(route: string, client?: CmsClient | null): UseCmsPage {
  const cms = client ?? useCms()
  const doc = ref<CmsPageDocument | null>(null)
  const error = ref<string | null>(null)
  const outcome = ref<CmsOutcome>('unavailable')
  const loading = ref(false)

  async function load(): Promise<void> {
    if (!cms) {
      error.value = 'CMS client is not configured'
      outcome.value = 'unavailable'
      return
    }
    loading.value = true
    try {
      const res = await cms.fetchPage(route)
      doc.value = res.doc
      error.value = res.error
      outcome.value = res.outcome
    } finally {
      loading.value = false
    }
  }

  return { doc, error, outcome, loading, load }
}
