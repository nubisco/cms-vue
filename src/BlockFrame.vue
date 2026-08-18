<template>
  <div class="bf" :class="{ 'bf--dim': hidden, 'bf--selected': selected }">
    <div class="bf__bar" @click="$emit('select')">
      <span class="bf__grip" aria-hidden="true">⠿</span>
      <span class="bf__type">{{ label }}</span>
      <span v-if="hidden" class="bf__badge">hidden by condition</span>
      <span class="bf__spacer"></span>
      <button
        class="bf__btn"
        type="button"
        :disabled="isFirst"
        title="Move up"
        @click.stop="$emit('up')"
      >
        &uarr;
      </button>
      <button
        class="bf__btn"
        type="button"
        :disabled="isLast"
        title="Move down"
        @click.stop="$emit('down')"
      >
        &darr;
      </button>
    </div>
    <div class="bf__body"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  hidden?: boolean
  isFirst?: boolean
  isLast?: boolean
  selected?: boolean
}>()
defineEmits<{ up: []; down: []; select: [] }>()
</script>

<style scoped lang="scss">
.bf {
  position: relative;
  border: 1px solid var(--nb-c-border, #e7e7f1);
  border-radius: 10px;
  margin: 10px;
  background: var(--nb-c-surface, #fff);
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}
.bf:hover {
  box-shadow: 0 4px 16px rgba(26, 26, 38, 0.08);
}
.bf--selected {
  border-color: var(--nb-c-primary, #5856a9);
  box-shadow: 0 0 0 1px var(--nb-c-primary, #5856a9);
}
.bf--dim .bf__body {
  opacity: 0.42;
}
.bf__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--nb-c-border, #e7e7f1);
  font-size: 12px;
  cursor: pointer;
}
.bf__grip {
  color: var(--nb-c-text-muted, #9797a6);
  cursor: grab;
}
.bf__type {
  font-family: ui-monospace, monospace;
  font-weight: 600;
  color: var(--nb-c-text-muted, #6a6a7b);
}
.bf--selected .bf__type {
  color: var(--nb-c-primary, #5856a9);
}
.bf__badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  background: color-mix(in srgb, #b9781e 16%, transparent);
  color: #b9781e;
}
.bf__spacer {
  flex: 1;
}
.bf__btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--nb-c-border, #d7d7e6);
  border-radius: 6px;
  background: var(--nb-c-surface, #fff);
  color: var(--nb-c-text, #1a1a26);
  line-height: 1;
}
.bf__btn:hover:not(:disabled) {
  background: var(--nb-c-surface-2, #f4f4fa);
}
.bf__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.bf__body {
  overflow: hidden;
  border-radius: 0 0 10px 10px;
}
</style>
