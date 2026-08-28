<template>
  <img
    v-if="image.src"
    :src="image.src"
    :alt="image.alt"
    :width="image.width"
    :height="image.height"
    :data-cms-block="editorBlockId"
    :data-cms-field="editorField"
  />
</template>

<script setup lang="ts">
/**
 * The image primitive.
 *
 * Every block that renders an image otherwise re-implements the same
 * "string-or-object" read, gets one of the three authored shapes right, and
 * drops the alt text of the other two. This accepts all of them (a bare string,
 * the contract's { src, alt, w, h }, delivery's media { url, alt, width,
 * height }), resolves a { $t } alt through the message table, and renders
 * nothing at all when nothing is authored, so a half-authored document does not
 * paint a broken-image icon.
 *
 * `alt` is always emitted, including as alt="" for a decorative image, which is
 * what a screen reader needs in order to skip it.
 */
import { computed, inject } from 'vue'
import type { BlockInstance } from '@nubisco/cms-core'
import { CMS_CONTEXT } from './context'
import { normalizeImage, type ResolvedImage } from '@nubisco/cms-core'
import { pickField } from '@nubisco/cms-core'

const props = defineProps<{
  block?: BlockInstance
  field?: string | readonly string[]
  value?: unknown
  /** The host's own bundled asset, used only when the document carries nothing. */
  fallback?: string | ResolvedImage
  /** Overrides the authored alt (a product that knows better than the document). */
  alt?: string
}>()

const ctx = inject(CMS_CONTEXT, { messages: {}, editing: false, setText: () => {} })

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

const raw = computed(() =>
  props.value !== undefined ? props.value : pickField(fields.value, aliases(props.field)),
)

const image = computed<ResolvedImage>(() => {
  const img = normalizeImage(raw.value, ctx.messages, props.fallback ?? '')
  return props.alt === undefined ? img : { ...img, alt: props.alt }
})

defineExpose({ image })
</script>
