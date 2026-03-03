<template>
  <div class="space-y-0">
    <div
      v-for="(item, i) in timeline"
      :key="i"
      class="flex gap-4"
    >
      <div class="flex flex-col items-center">
        <div
          class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ring-2 ring-white dark:ring-stone-900"
          :class="dotColor(item.event)"
        />
        <div
          v-if="i < timeline.length - 1"
          class="w-px flex-1 bg-stone-200 dark:bg-stone-700 my-1"
        />
      </div>

      <div class="pb-5 min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <StatusBadge :status="item.event" />
          <span class="text-xs text-stone-400 dark:text-stone-500">{{ formatDate(item.occurredAt) }}</span>
        </div>
        <pre
          v-if="item.metadata"
          class="mt-2 text-xs bg-stone-100 dark:bg-stone-800 rounded-lg p-3 overflow-x-auto font-mono text-stone-600 dark:text-stone-400"
        >{{ JSON.stringify(item.metadata, null, 2) }}</pre>
      </div>
    </div>

    <div
      v-if="timeline.length === 0"
      class="text-center py-6 text-stone-400 dark:text-stone-500 text-sm"
    >
      No timeline events
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  timeline: Array<{ event: string, occurredAt: string, metadata: Record<string, unknown> | null }>
}>()

function dotColor(event: string) {
  const map: Record<string, string> = {
    queued: 'bg-amber-400',
    submitted: 'bg-blue-400',
    send: 'bg-blue-400',
    delivery: 'bg-emerald-500',
    sent: 'bg-emerald-500',
    delivered: 'bg-emerald-500',
    bounce: 'bg-red-500',
    bounced: 'bg-red-500',
    complaint: 'bg-red-500',
    reject: 'bg-red-500',
    failed: 'bg-red-500',
    open: 'bg-violet-500',
    opened: 'bg-violet-500',
    click: 'bg-cyan-500',
    clicked: 'bg-cyan-500',
  }
  return map[event] ?? 'bg-stone-400'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>
