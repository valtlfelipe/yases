<template>
  <span class="inline-flex items-center gap-1.5 text-xs font-medium">
    <span class="w-1.5 h-1.5 rounded-full" :class="dotColor"></span>
    <span :class="textColor">{{ status }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ status: string }>()

const statusMap: Record<string, { bg: string; text: string }> = {
  sent: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  delivered: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  opened: { bg: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-400' },
  clicked: { bg: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400' },
  failed: { bg: 'bg-red-600', text: 'text-red-700 dark:text-red-400' },
  bounced: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  suppressed: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  complained: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  queued: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  sending: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  pending: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  temporarily_failed: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  verified: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  pending_verification: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  failed_verification: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
}

const defaultStatus = { bg: 'bg-stone-400', text: 'text-stone-600 dark:text-stone-400' }

const dotColor = computed(() => statusMap[props.status]?.bg ?? defaultStatus.bg)
const textColor = computed(() => statusMap[props.status]?.text ?? defaultStatus.text)
</script>
