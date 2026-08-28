<template>
  <span
    v-if="ctx.editing"
    ref="el"
    class="cms-text cms-text--editing"
    :data-cms-block="block.id"
    :data-cms-field="field"
    contenteditable="plaintext-only"
    role="textbox"
    tabindex="0"
    @blur="commit"
    @keydown.enter.prevent="commit"
    >{{ display }}</span
  >
  <span v-else>{{ display }}</span>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { BlockInstance } from '@nubisco/cms-core'
import { CMS_CONTEXT } from './context'
import { text } from '@nubisco/cms-core'

const props = defineProps<{ block: BlockInstance; field: string }>()

const ctx = inject(CMS_CONTEXT, { messages: {}, editing: false, setText: () => {} })

const current = computed(() => props.block.fields[props.field])
const display = computed(() => text(current.value, ctx.messages))
const el = ref<HTMLElement | null>(null)

// Commit on blur/enter only, so the value (and the JSON) does not update on every
// keystroke, which would re-render the node and jump the caret.
function commit() {
  const next = el.value?.innerText.trim() ?? ''
  if (next !== display.value) ctx.setText(props.block, props.field, current.value, next)
  el.value?.blur()
}
</script>

<style scoped>
.cms-text--editing {
  outline: 1px dashed color-mix(in srgb, var(--nb-c-primary, #5856a9) 55%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
  cursor: text;
}
.cms-text--editing:hover {
  background: color-mix(in srgb, var(--nb-c-primary, #5856a9) 6%, transparent);
}
.cms-text--editing:focus {
  outline: 2px solid var(--nb-c-primary, #5856a9);
  background: color-mix(in srgb, var(--nb-c-primary, #5856a9) 9%, transparent);
}
</style>
