<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
    :class="style.bg"
  >
    <UIcon
      :name="style.icon"
      class="w-3 h-3"
      :class="style.text"
    />
    <span :class="style.text">{{ type }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ type: string }>()

const eventMap: Record<string, { bg: string, text: string, icon: string }> = {
  queued: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: 'i-heroicons-queue-list' },
  suppressed: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: 'i-heroicons-no-symbol' },
  submitted: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: 'i-heroicons-paper-airplane' },
  send: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: 'i-heroicons-arrow-up-tray' },
  delivery: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: 'i-heroicons-check-circle' },
  bounce: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: 'i-heroicons-arrow-uturn-left' },
  complaint: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: 'i-heroicons-exclamation-circle' },
  reject: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: 'i-heroicons-x-circle' },
  open: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', icon: 'i-heroicons-envelope-open' },
  click: { bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', icon: 'i-heroicons-cursor-arrow-rays' },
  unsubscribe: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', icon: 'i-heroicons-hand-raised' },
}

const defaultStyle = { bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-600 dark:text-stone-400', icon: 'i-heroicons-bolt' }

const style = computed(() => eventMap[props.type] ?? defaultStyle)
</script>
