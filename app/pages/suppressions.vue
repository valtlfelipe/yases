<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
          Suppressions
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400">
          Manage email addresses that should not receive messages.
        </p>
      </div>
      <span
        v-if="suppressions"
        class="text-sm text-stone-500 dark:text-stone-400"
      >{{ formatNumber(suppressions.total) }} total</span>
    </div>

    <div class="card-elevated">
      <!-- Filter toolbar -->
      <div class="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-stone-200 dark:border-stone-800">
        <UInput
          v-model="emailInput"
          placeholder="Search email…"
          color="neutral"
          icon="i-lucide-search"
          class="w-52"
        />

        <USelect
          v-model="selectedReason"
          :items="reasonSelectItems"
          color="neutral"
          class="w-44"
        />

        <UButton
          v-if="hasActiveFilters"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          class="ml-auto"
          @click="clearFilters"
        >
          Clear filters
        </UButton>
      </div>

      <!-- Content -->
      <div class="p-6">
        <div
          v-if="pending"
          class="flex items-center justify-center py-12"
        >
          <UIcon
            name="i-heroicons-arrow-path"
            class="w-6 h-6 animate-spin text-stone-400"
          />
        </div>

        <UAlert
          v-else-if="error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          title="Failed to load suppressions"
          :description="String(error)"
        />

        <template v-else-if="suppressions">
          <div
            v-if="suppressions.items.length === 0"
            class="empty-state"
          >
            <div class="empty-state-icon">
              <UIcon
                name="i-heroicons-check-circle"
                class="w-8 h-8 text-stone-400"
              />
            </div>
            <p class="text-stone-500 dark:text-stone-400">
              No suppressions
            </p>
            <p class="text-sm text-stone-400 dark:text-stone-500 mt-1">
              {{ hasActiveFilters ? 'No results match your filters' : 'All emails are being delivered successfully' }}
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
                    Email
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Detail
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
                <tr
                  v-for="item in suppressions.items"
                  :key="item.email"
                  class="table-row-animate"
                >
                  <td class="px-4 py-3">
                    <span class="font-mono text-sm text-stone-700 dark:text-stone-300">{{ item.email }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :status="item.reason" />
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-stone-500 dark:text-stone-400">{{ item.detail || '—' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-stone-500">{{ formatDate(item.createdAt) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex items-center justify-between pt-6 border-t border-stone-200 dark:border-stone-800">
            <span class="text-sm text-stone-500 dark:text-stone-400">
              Page {{ page }} of {{ totalPages }}
            </span>
            <div class="flex gap-2">
              <UButton
                variant="soft"
                color="neutral"
                :disabled="page <= 1"
                @click="page--"
              >
                <UIcon
                  name="i-heroicons-chevron-left"
                  class="w-4 h-4 mr-1"
                />
                Previous
              </UButton>
              <UButton
                variant="soft"
                color="neutral"
                :disabled="page >= totalPages"
                @click="page++"
              >
                Next
                <UIcon
                  name="i-heroicons-chevron-right"
                  class="w-4 h-4 ml-1"
                />
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SuppressionFilters } from '~/composables/useSuppressions'

const page = ref(1)
const limit = 20

const filters = reactive<SuppressionFilters>({})

// Email search — debounced
const emailInput = ref('')
let emailDebounce: ReturnType<typeof setTimeout>
watch(emailInput, (v) => {
  clearTimeout(emailDebounce)
  emailDebounce = setTimeout(() => {
    filters.email = v.trim() || undefined
    page.value = 1
  }, 300)
})

// Reason filter
const selectedReason = ref('_all')
watch(selectedReason, (v) => {
  filters.reason = v === '_all' ? undefined : v
  page.value = 1
})

const filtersRef = computed(() => ({ ...filters }))
const { suppressions, pending, error } = useSuppressions(page, limit, filtersRef)

const totalPages = computed(() => Math.ceil((suppressions.value?.total ?? 0) / limit))

const hasActiveFilters = computed(() => !!(emailInput.value || selectedReason.value !== '_all'))

const reasonSelectItems = [
  { label: 'All reasons', value: '_all' },
  { label: 'Permanent bounce', value: 'permanent_bounce' },
  { label: 'Transient bounce', value: 'transient_bounce' },
  { label: 'Complaint', value: 'complaint' },
  { label: 'Invalid', value: 'invalid' },
  { label: 'Manual', value: 'manual' },
]

function clearFilters() {
  emailInput.value = ''
  selectedReason.value = '_all'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
</script>
