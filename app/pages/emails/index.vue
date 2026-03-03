<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
          Emails
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400">
          View and track all your sent emails.
        </p>
      </div>
      <span
        v-if="emails"
        class="text-sm text-stone-500 dark:text-stone-400"
      >{{ formatNumber(emails.total) }} total</span>
    </div>

    <div class="card-elevated p-6">
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
        color="red"
        variant="soft"
        title="Failed to load emails"
        :description="String(error)"
      />

      <template v-else-if="emails">
        <div
          v-if="emails.items.length === 0"
          class="empty-state"
        >
          <div class="empty-state-icon">
            <UIcon
              name="i-heroicons-envelope"
              class="w-8 h-8 text-stone-400"
            />
          </div>
          <p class="text-stone-500 dark:text-stone-400">
            No emails found
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
                  To
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Subject
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Date
                </th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
              <tr
                v-for="email in emails.items"
                :key="email.id"
                class="table-row-animate"
              >
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-700 dark:text-stone-300 truncate max-w-[200px] block">{{ email.to }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-700 dark:text-stone-300 truncate max-w-[240px] block">{{ email.subject }}</span>
                </td>
                <td class="px-4 py-3">
                  <StatusBadge :status="email.status" />
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-stone-500">{{ formatDate(email.createdAt) }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <NuxtLink
                    :to="`/emails/${email.id}`"
                    class="text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  >
                    View
                  </NuxtLink>
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
              <UIcon
                name="i-heroicons-chevron-left"
                class="w-4 h-4 mr-1"
              />
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
</template>

<script setup lang="ts">
const page = ref(1)
const limit = 20
const { emails, pending, error } = useEmails(page, limit)

const totalPages = computed(() => Math.ceil((emails.value?.total ?? 0) / limit))

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
