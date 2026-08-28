import { inject } from 'vue'
import type { FieldValue } from '@nubisco/cms-core'
import { CMS_CONTEXT } from './context'
import { text } from '@nubisco/cms-core'

/** Small helper for block components: resolve a field value to display text. */
export function useField() {
  const ctx = inject(CMS_CONTEXT, { messages: {}, editing: false, setText: () => {} })
  return {
    t: (value: FieldValue | undefined) => text(value, ctx.messages),
  }
}
