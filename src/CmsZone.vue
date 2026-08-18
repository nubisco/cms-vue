<template>
  <div class="cms-zone">
    <!-- Edit mode: every block wrapped in a frame with reorder controls; blocks
         hidden by their condition are shown dimmed so they can still be reordered. -->
    <template v-if="editing">
      <BlockFrame
        v-for="(block, i) in zone.blocks"
        :key="block.id"
        :label="frameLabel(block)"
        :hidden="!passes(block)"
        :is-first="i === 0"
        :is-last="i === zone.blocks.length - 1"
        :selected="block.id === selectedId"
        @up="move(i, i - 1)"
        @down="move(i, i + 1)"
        @select="emit('select', block.id)"
      >
        <component :is="registry[block.type]" v-if="registry[block.type]" :block="block" />
        <div v-else class="cms-zone__missing">Unknown block type: {{ block.type }}</div>
      </BlockFrame>
    </template>

    <!-- Preview: filtered by condition, rendered plain. -->
    <template v-else>
      <template v-for="block in visibleBlocks" :key="block.id">
        <component :is="registry[block.type]" v-if="registry[block.type]" :block="block" />
        <div v-else class="cms-zone__missing">Unknown block type: {{ block.type }}</div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, type Component } from 'vue'
import type { BlockInstance, FieldValue, LogicGraph, Zone } from './contract'
import { evaluate, type LogicEnv } from './evaluate'
import { CMS_CONTEXT } from './context'
import BlockFrame from './BlockFrame.vue'

const props = defineProps<{
  zone: Zone
  registry: Record<string, Component>
  messages: Record<string, string>
  env: LogicEnv
  editing?: boolean
  selectedId?: string | null
  graphs?: Record<string, LogicGraph>
  setText?: (
    block: BlockInstance,
    field: string,
    current: FieldValue | undefined,
    next: string,
  ) => void
}>()

const emit = defineEmits<{ select: [id: string] }>()

// Getters keep the injected context reactive to prop changes (edit toggle, edits).
provide(CMS_CONTEXT, {
  get messages() {
    return props.messages
  },
  get editing() {
    return props.editing ?? false
  },
  setText: (block: BlockInstance, field: string, current: FieldValue | undefined, next: string) =>
    props.setText?.(block, field, current, next),
})

function passes(block: BlockInstance): boolean {
  return evaluate(block.when, props.env, props.graphs)
}

const visibleBlocks = computed<BlockInstance[]>(() => props.zone.blocks.filter(passes))

function frameLabel(block: BlockInstance): string {
  return block.type + (block.variation ? ` · ${block.variation}` : '')
}

function move(from: number, to: number): void {
  const arr = props.zone.blocks
  if (to < 0 || to >= arr.length) return
  const [block] = arr.splice(from, 1)
  arr.splice(to, 0, block)
}
</script>

<style scoped lang="scss">
.cms-zone__missing {
  padding: 12px 16px;
  border: 1px dashed var(--nb-c-border, #d7d7e6);
  border-radius: 8px;
  color: var(--nb-c-text-muted, #6a6a7b);
  font-size: 13px;
}
</style>
