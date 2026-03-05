<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
          Dashboard
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400">
          Track your email performance and engagement.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
          <span>Auto-refresh</span>
          <USwitch
            v-model="autoRefresh"
            color="primary"
          />
        </label>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-heroicons-arrow-path"
          :loading="pending"
          @click="refreshAll"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div
      v-if="pending && !stats"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        class="stat-card"
      >
        <div class="skeleton h-4 w-20 rounded mb-3" />
        <div class="skeleton h-8 w-16 rounded mb-2" />
        <div class="skeleton h-3 w-24 rounded" />
      </div>
    </div>

    <UAlert
      v-else-if="error && !stats"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      title="Failed to load stats"
      :description="String(error)"
    />

    <template v-else-if="stats">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="stat-card animate-fade-in-up stagger-1">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Total Sent</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <UIcon
                name="i-heroicons-paper-airplane"
                class="w-4 h-4 text-blue-600 dark:text-blue-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ formatNumber(totalAttempted) }}
          </p>
          <p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
            emails attempted
          </p>
        </div>

        <div class="stat-card animate-fade-in-up stagger-2">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Delivery Rate</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
              <UIcon
                name="i-heroicons-check-circle"
                class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ stats.rates.delivery }}%
          </p>
          <p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
            {{ formatNumber(stats.deliveredCount) }} delivered
          </p>
        </div>

        <div class="stat-card animate-fade-in-up stagger-3">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Bounce Rate</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30">
              <UIcon
                name="i-heroicons-arrow-uturn-left"
                class="w-4 h-4 text-red-600 dark:text-red-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ stats.rates.bounce }}%
          </p>
          <p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
            {{ formatNumber(stats.sends.bounced) }} bounced
          </p>
        </div>

        <div class="stat-card animate-fade-in-up stagger-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Complaint Rate</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/30">
              <UIcon
                name="i-heroicons-exclamation-circle"
                class="w-4 h-4 text-orange-600 dark:text-orange-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ stats.rates.complaint }}%
          </p>
          <p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
            {{ formatNumber(stats.sends.complained) }} complaints
          </p>
        </div>

        <div class="stat-card animate-fade-in-up stagger-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Open Rate</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30">
              <UIcon
                name="i-heroicons-envelope-open"
                class="w-4 h-4 text-violet-600 dark:text-violet-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ stats.rates.open }}%
          </p>
          <p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
            {{ formatNumber(stats.sends.opened) }} opens
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="stat-card animate-fade-in-up stagger-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Queued</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <UIcon
                name="i-heroicons-queue-list"
                class="w-4 h-4 text-amber-600 dark:text-amber-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ formatNumber(stats.sends.queued) }}
          </p>
        </div>

        <div class="stat-card animate-fade-in-up stagger-7">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Failed</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30">
              <UIcon
                name="i-heroicons-x-circle"
                class="w-4 h-4 text-red-600 dark:text-red-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ formatNumber(stats.sends.failed) }}
          </p>
        </div>

        <div class="stat-card animate-fade-in-up stagger-8">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Click Rate</span>
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-900/30">
              <UIcon
                name="i-heroicons-cursor-arrow-rays"
                class="w-4 h-4 text-cyan-600 dark:text-cyan-400"
              />
            </div>
          </div>
          <p class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            {{ stats.rates.click }}%
          </p>
          <p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
            {{ formatNumber(stats.events.clicked) }} click events
          </p>
        </div>
      </div>

      <div class="card-elevated p-6 animate-fade-in-up stagger-9">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-display text-stone-900 dark:text-stone-100">
              7-day activity
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              Sent, delivered, opened, and bounced per day
            </p>
          </div>
        </div>
        <TrendChart
          v-if="stats.trend.length > 0"
          :trend="stats.trend"
        />
        <div
          v-else
          class="empty-state"
        >
          <div class="empty-state-icon">
            <UIcon
              name="i-heroicons-chart-bar"
              class="w-8 h-8 text-stone-400"
            />
          </div>
          <p class="text-stone-500 dark:text-stone-400">
            No data for the last 7 days
          </p>
        </div>
      </div>

      <div class="card-elevated p-6 animate-fade-in-up stagger-10">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-display text-stone-900 dark:text-stone-100">
              Recent Events
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              Latest events from SES
            </p>
          </div>
          <NuxtLink
            to="/emails"
            class="text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            View emails
          </NuxtLink>
        </div>

        <div
          v-if="eventsPending && recentEvents.length === 0"
          class="flex items-center justify-center py-8"
        >
          <UIcon
            name="i-heroicons-arrow-path"
            class="w-5 h-5 animate-spin text-stone-400"
          />
        </div>

        <div
          v-else-if="recentEvents.length === 0"
          class="empty-state"
        >
          <div class="empty-state-icon">
            <UIcon
              name="i-heroicons-bolt"
              class="w-8 h-8 text-stone-400"
            />
          </div>
          <p class="text-stone-500 dark:text-stone-400">
            No events yet
          </p>
        </div>

        <div
          v-else
          class="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800"
        >
          <table class="w-full">
            <thead class="bg-stone-50 dark:bg-stone-800/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Event
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  To
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Subject
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Date
                </th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
              <tr
                v-for="ev in recentEvents"
                :key="ev.id"
                class="table-row-animate"
              >
                <td class="px-4 py-3">
                  <EventTypeBadge :type="ev.eventType" />
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-700 dark:text-stone-300 truncate max-w-[180px] block">{{ ev.to }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-700 dark:text-stone-300 truncate max-w-[240px] block">{{ ev.subject }}</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="text-sm text-stone-500"
                    :title="formatDate(ev.occurredAt, false).tooltip ?? undefined"
                  >{{ formatDate(ev.occurredAt, false).text }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <NuxtLink
                    :to="`/emails/${ev.emailSendId}`"
                    class="text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  >
                    View
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn, useLocalStorage } from '@vueuse/core'

const { stats, pending, error, refresh } = useStats()

const autoRefresh = useLocalStorage('dashboard-auto-refresh', true)

const { pause, resume } = useIntervalFn(() => {
  refreshAll()
}, 30000)

watch(autoRefresh, (enabled) => {
  if (enabled) {
    resume()
  } else {
    pause()
  }
}, { immediate: true })

const totalAttempted = computed(() =>
  (stats.value?.sends.sent ?? 0)
  + (stats.value?.sends.delivered ?? 0)
  + (stats.value?.sends.opened ?? 0)
  + (stats.value?.sends.complained ?? 0)
  + (stats.value?.sends.bounced ?? 0)
  + (stats.value?.sends.failed ?? 0),
)

const { data: eventsData, pending: eventsPending, refresh: refreshEvents } = useFetch('/api/events', {
  credentials: 'include',
  query: { limit: 10 },
  key: 'recent-events',
})

async function refreshAll() {
  await Promise.all([refresh(), refreshEvents()])
}

const recentEvents = computed(() => eventsData.value ?? [])

const { formatDate } = useRelativeTime()

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
</script>
