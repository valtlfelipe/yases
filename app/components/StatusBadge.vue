<template>
  <span class="inline-flex items-center gap-1.5 text-xs font-medium">
    <span
      class="w-1.5 h-1.5 rounded-full"
      :class="dotColor"
    />
    <span :class="textColor">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ status: string }>()

const statusMap: Record<string, { bg: string, text: string }> = {
  // email send statuses
  queued: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  sending: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  sent: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  failed: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  suppressed: { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400' },
  bounced: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  // email event types
  submitted: { bg: 'bg-blue-400', text: 'text-blue-600 dark:text-blue-400' },
  send: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  delivery: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  bounce: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  complaint: { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400' },
  reject: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  open: { bg: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-400' },
  click: { bg: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400' },
  // identity statuses
  pending: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  verified: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  temporarily_failed: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  // suppression reasons
  permanent_bounce: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  transient_bounce: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  invalid: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  manual: { bg: 'bg-stone-400', text: 'text-stone-600 dark:text-stone-400' },
  unsubscribed: { bg: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-400' },
}

const labelMap: Record<string, string> = {
  permanent_bounce: 'Permanent bounce',
  transient_bounce: 'Transient bounce',
  complaint: 'Complaint',
  invalid: 'Invalid',
  manual: 'Manual',
  unsubscribed: 'Unsubscribed',
  temporarily_failed: 'Temporarily failed',
}

const defaultStatus = { bg: 'bg-stone-400', text: 'text-stone-600 dark:text-stone-400' }

const dotColor = computed(() => statusMap[props.status]?.bg ?? defaultStatus.bg)
const textColor = computed(() => statusMap[props.status]?.text ?? defaultStatus.text)
const label = computed(() => labelMap[props.status] ?? props.status.charAt(0).toUpperCase() + props.status.slice(1))
</script>
