<template>
  <component
    :is="tag"
    v-bind="attrs"
    class="cms-link"
    :class="link.ok && link.href ? '' : 'cms-link--inert'"
    :data-cms-block="editorBlockId"
    :data-cms-field="editorField"
    :data-cms-link-status="link.status"
    @click="onClick"
  >
    <slot :link="link">{{ labelText }}</slot>
  </component>
</template>

<script setup lang="ts">
/**
 * The link primitive.
 *
 * It renders a REAL anchor (href in the markup, so it is crawlable, copyable
 * and middle-clickable) and intercepts only the plain left click a router
 * should own, exactly as a RouterLink does. Where the router comes from is the
 * host's business: a library cannot assume one, so navigation goes through the
 * configured client (createCms({ router }) or createCms({ navigate })). With
 * neither configured this is a plain anchor and the browser does a full page
 * load, which is correct, just slower.
 *
 * A link whose status is not 'ok' renders INERT: the label stays as plain text
 * in a <span>, never as a dead anchor, and the destination never reaches the
 * markup at all, so it cannot be read out of the rendered HTML either.
 */
import { computed, inject } from 'vue'
import type { BlockInstance, FieldValue } from './contract'
import { CMS_CONTEXT } from './context'
import { text } from './resolve'
import { linkAttrs, linkTag, normalizeLink, pickField, type ResolvedLink } from './link'
import { useCms } from './client'

const props = defineProps<{
  /** Read the link out of a block's fields. */
  block?: BlockInstance
  /** The field name, or several accepted spellings, first filled one wins. */
  field?: string | readonly string[]
  /** Or pass the authored value directly (the object shape, or a bare string). */
  value?: unknown
  /** The host's own coded href, used only when the document carries nothing. */
  fallback?: string
  /**
   * Label, when it is not supplied as slot content. Typed `unknown` rather than
   * `FieldValue` on purpose: `FieldValue` includes `boolean`, and Vue casts an
   * ABSENT prop whose declared type includes Boolean to `false`, so the label
   * of every link that did not pass one rendered as the word "false".
   */
  label?: unknown
  /** Field holding the label, read from `block` like `field` is. */
  labelField?: string | readonly string[]
}>()

const ctx = inject(CMS_CONTEXT, { messages: {}, editing: false, setText: () => {} })
const cms = useCms()

const fields = computed(() => props.block?.fields as Record<string, unknown> | undefined)

function aliases(f: string | readonly string[] | undefined): readonly string[] {
  return f === undefined ? [] : typeof f === 'string' ? [f] : f
}

/** Which spelling the document actually carries, so the editor targets that one. */
const editorField = computed(() => {
  if (!props.block) return undefined
  const src = fields.value
  return aliases(props.field).find((k) => src && src[k] !== undefined && src[k] !== null)
})
const editorBlockId = computed(() => props.block?.id)

const raw = computed(() =>
  props.value !== undefined ? props.value : pickField(fields.value, aliases(props.field)),
)

const link = computed<ResolvedLink>(() => normalizeLink(raw.value, props.fallback ?? ''))
const tag = computed(() => linkTag(link.value))
const attrs = computed(() => linkAttrs(link.value))

const labelText = computed(() => {
  if (props.label !== undefined) return text(props.label as FieldValue, ctx.messages)
  const v = pickField(fields.value, aliases(props.labelField))
  return v === undefined ? '' : text(v as FieldValue, ctx.messages)
})

/** Expose the resolved link, so a host component can wrap this in its own button. */
defineExpose({ link })

function onClick(ev: MouseEvent): void {
  const l = link.value
  if (!l.ok || !l.internal || !l.href) return
  // An internal link the editor sent to a new tab is a REAL anchor with
  // target="_blank". Pushing the router here as well would open the page twice:
  // once in this tab, once in the new one. The browser owns this click.
  if (l.newTab) return
  // Leave every modified click to the browser: new tab, new window, download.
  if (ev.defaultPrevented) return
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
  if (!cms) return // no router configured: a full page load is the fallback
  if (cms.navigate(l.href)) ev.preventDefault()
}
</script>

<style scoped>
.cms-link--inert {
  cursor: default;
}
</style>
