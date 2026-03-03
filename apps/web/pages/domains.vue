<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">Domain Identities</h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400">Manage your verified sending domains.</p>
      </div>
      <span v-if="data" class="text-sm text-stone-500 dark:text-stone-400">{{ data.total }} total</span>
    </div>

    <div class="card-elevated p-6">
      <div v-if="pending" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-stone-400" />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        title="Failed to load identities"
        :description="String(error)"
      />

      <template v-else-if="data">
        <div v-if="data.items.length === 0" class="empty-state">
          <div class="empty-state-icon">
            <UIcon name="i-heroicons-globe-alt" class="w-8 h-8 text-stone-400" />
          </div>
          <p class="text-stone-500 dark:text-stone-400">No domains configured</p>
          <p class="text-sm text-stone-400 dark:text-stone-500 mt-1">Add a domain to start sending emails</p>
        </div>

        <div v-else class="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
          <table class="w-full">
            <thead class="bg-stone-50 dark:bg-stone-800/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Domain</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">DKIM</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Mail From</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Added</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
              <tr 
                v-for="item in data.items" 
                :key="item.id" 
                class="table-row-animate"
              >
                <td class="px-4 py-3">
                  <span class="text-sm font-medium text-stone-700 dark:text-stone-300">{{ item.domain }}</span>
                </td>
                <td class="px-4 py-3">
                  <StatusBadge :status="item.status" />
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-500 dark:text-stone-400">{{ item.dkimStatus ?? '—' }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-500 dark:text-stone-400">{{ item.mailFromDomain ?? '—' }}</span>
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
              size="sm" 
              variant="soft" 
              color="gray"
              :disabled="page <= 1" 
              @click="page--"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 mr-1" />
              Previous
            </UButton>
            <UButton 
              size="sm" 
              variant="soft" 
              color="gray"
              :disabled="page >= totalPages" 
              @click="page++"
            >
              Next
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 ml-1" />
            </UButton>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const api = useApi()
const page = ref(1)
const limit = 20

const { data, pending, error } = useAsyncData(
  () => `identities-${page.value}`,
  () =>
    api<{
      items: Array<{
        id: string
        domain: string
        status: string
        dkimStatus: string | null
        mailFromDomain: string | null
        createdAt: string
      }>
      total: number
      page: number
      limit: number
    }>('/identities', { query: { page: page.value, limit } }),
  { watch: [page] }
)

const totalPages = computed(() => Math.ceil((data.value?.total ?? 0) / limit))

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
</script>
