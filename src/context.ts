import type { InjectionKey } from 'vue'
import type { BlockInstance, FieldValue } from '@nubisco/cms-core'

/**
 * Render context provided by CmsZone and injected by field primitives. It
 * carries the string table (for { $t } refs), whether edit mode is on, and the
 * write-back hook. In edit mode the primitives decorate the real DOM; off, they
 * render plain text. This is where the in-context editor hangs off the render.
 */
export interface CmsContext {
  messages: Record<string, string>
  editing: boolean
  setText: (
    block: BlockInstance,
    field: string,
    current: FieldValue | undefined,
    next: string,
  ) => void
}

export const CMS_CONTEXT: InjectionKey<CmsContext> = Symbol('cms-context')
