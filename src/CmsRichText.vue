<template>
  <!-- Authored HTML. The content comes from the CMS and is written by trusted
       editors, so v-html is intentional. `v-html` INSERTS markup, it does not
       COMPILE it, which is why the internal-link navigation below is a
       delegated click handler rather than a <RouterLink>. -->
  <component
    :is="as"
    v-if="isHtmlBody"
    class="cms-richtext-body"
    :data-cms-block="editorBlockId"
    :data-cms-field="editorField"
    data-cms-field-kind="richtext"
    @click="onClick"
    v-html="html"
  />
  <!-- Plain authored text is ONE paragraph, so it is a <p>. The HTML branch
       stays a container element because authored markup brings its own block
       elements and a <p> cannot legally contain them. -->
  <component
    :is="plainAs"
    v-else-if="plain"
    class="cms-richtext-body"
    :data-cms-block="editorBlockId"
    :data-cms-field="editorField"
    data-cms-field-kind="richtext"
    >{{ plain }}</component
  >
</template>

<script setup lang="ts">
/**
 * The richtext primitive: renders a richtext field value.
 *
 * Three things it does that a bare `v-html` does not:
 *
 *  1. INTERNAL ANCHORS NAVIGATE. Inserted markup is never compiled, so an
 *     anchor inside authored HTML would reload the whole app. One delegated
 *     click handler on the container gives every internal anchor inside it the
 *     SPA navigation a RouterLink would have provided, and leaves everything
 *     else (external URLs, mailto:, tel:, #fragments, downloads, modified
 *     clicks, target="_blank") to the browser. Navigation goes through the
 *     configured client, so this depends on no particular router.
 *
 *  2. AUTHORED <router-link> BECOMES A REAL ANCHOR, because a document written
 *     against a Vue site will contain them and they would otherwise vanish.
 *
 *  3. SERIALIZERS. A product styles its own headings, lists and quotes by
 *     naming classes per node type instead of forking this component. See
 *     richtext.ts for exactly how much a serializer can change.
 */
import { computed, inject } from 'vue'
import type { BlockInstance, FieldValue } from './contract'
import { CMS_CONTEXT } from './context'
import { text } from './resolve'
import { pickField } from './link'
import { applySerializers, compileLinks, isHtml, type RichTextSerializers } from './richtext'
import { useCms } from './client'

const props = withDefaults(
  defineProps<{
    block?: BlockInstance
    field?: string | readonly string[]
    /**
     * Or pass the authored value directly. Typed `unknown` rather than
     * `FieldValue` because `FieldValue` includes `boolean`, and Vue casts an
     * absent prop whose declared type includes Boolean to `false`: every block
     * that read its body from `block`/`field` would have rendered "false".
     */
    value?: unknown
    /** Per-node-type rendering overrides, the Prismic serializer equivalent. */
    serializers?: RichTextSerializers
    /** The element wrapping authored markup. */
    as?: string
    /** The element wrapping plain authored text. */
    plainAs?: string
    /**
     * Transform applied after serializers, for the rewrites a serializer cannot
     * express (restructuring a subtree). Kept as an escape hatch so a product
     * with an existing transform can adopt the primitive without losing it.
     */
    transform?: (html: string) => string
  }>(),
  { as: 'div', plainAs: 'p' },
)

const ctx = inject(CMS_CONTEXT, { messages: {}, editing: false, setText: () => {} })
const cms = useCms()

const fields = computed(() => props.block?.fields as Record<string, unknown> | undefined)

function aliases(f: string | readonly string[] | undefined): readonly string[] {
  return f === undefined ? [] : typeof f === 'string' ? [f] : f
}

const editorField = computed(() => {
  if (!props.block) return undefined
  const src = fields.value
  return aliases(props.field).find((k) => src && src[k] !== undefined && src[k] !== null)
})
const editorBlockId = computed(() => props.block?.id)

const raw = computed<FieldValue | undefined>(() =>
  (props.value !== undefined ? props.value : pickField(fields.value, aliases(props.field))) as
    | FieldValue
    | undefined,
)

/** Resolved through the message table, so a { $t } richtext ref works too. */
const body = computed(() => text(raw.value, ctx.messages))
const isHtmlBody = computed(() => isHtml(body.value))
const plain = computed(() => (isHtmlBody.value ? '' : body.value))

const html = computed(() => {
  // compileLinks first, so an authored <router-link> is a real anchor by the
  // time serializers see it and gets the same treatment every other link gets.
  let out = applySerializers(compileLinks(body.value), props.serializers)
  if (props.transform) out = props.transform(out)
  return out
})

function onClick(ev: MouseEvent): void {
  if (!cms) return // no router configured: the browser owns every click
  if (ev.defaultPrevented) return
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
  const target = ev.target as Element | null
  const anchor = target?.closest?.('a') as HTMLAnchorElement | null
  if (!anchor) return
  if (anchor.hasAttribute('download')) return
  const explicitTarget = anchor.getAttribute('target')
  if (explicitTarget && explicitTarget !== '_self') return
  const href = anchor.getAttribute('href') ?? ''
  // Site-absolute only: an external URL, a mailto:, a tel: and an in-page
  // fragment all stay with the browser.
  if (!href.startsWith('/') || href.startsWith('//')) return
  if (cms.navigate(href)) ev.preventDefault()
}

defineExpose({ html, plain })
</script>
