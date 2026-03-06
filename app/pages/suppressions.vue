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
      <div class="flex items-center gap-3">
        <UButton @click="openAddModal">
          <UIcon
            name="i-heroicons-plus"
            class="w-4 h-4 mr-1.5"
          />
          Add Suppression
        </UButton>
      </div>
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
                  <th class="px-4 py-3" />
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
                  <td class="px-4 py-3 text-right">
                    <UButton
                      variant="ghost"
                      color="error"
                      size="xs"
                      icon="i-heroicons-trash"
                      @click="confirmRemove(item.email)"
                    />
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

    <!-- Add suppression modal -->
    <UModal v-model:open="showAddModal">
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Add Suppression
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Emails sent to this address will be blocked.
            </p>
          </div>

          <UFormField label="Email address">
            <UInput
              v-model="formEmail"
              placeholder="user@example.com"
              type="email"
              class="w-full"
              autofocus
              @keydown.enter="addSuppression"
            />
          </UFormField>

          <UFormField label="Reason">
            <USelect
              v-model="formReason"
              :items="reasonAddItems"
              color="neutral"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Detail"
            :help="'Optional note explaining why this address is suppressed.'"
          >
            <UInput
              v-model="formDetail"
              placeholder="e.g. User requested opt-out"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="addError"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="addError"
          />

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showAddModal = false"
            >
              Cancel
            </UButton>
            <UButton
              :loading="adding"
              @click="addSuppression"
            >
              Add Suppression
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Remove confirmation modal -->
    <UModal v-model:open="showRemoveModal">
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Remove Suppression
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Are you sure you want to remove <strong class="text-stone-700 dark:text-stone-300">{{ emailToRemove }}</strong> from the suppression list? They will be able to receive emails again.
            </p>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="soft"
              color="neutral"
              @click="showRemoveModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="removing"
              @click="remove"
            >
              Remove
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { SuppressionFilters } from '~/composables/useSuppressions'

const toast = useToast()
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
const { suppressions, pending, error, refresh } = useSuppressions(page, limit, filtersRef)

const totalPages = computed(() => Math.ceil((suppressions.value?.total ?? 0) / limit))
const hasActiveFilters = computed(() => !!(emailInput.value || selectedReason.value !== '_all'))

const reasonSelectItems = [
  { label: 'All reasons', value: '_all' },
  { label: 'Permanent bounce', value: 'permanent_bounce' },
  { label: 'Transient bounce', value: 'transient_bounce' },
  { label: 'Complaint', value: 'complaint' },
  { label: 'Invalid', value: 'invalid' },
  { label: 'Manual', value: 'manual' },
  { label: 'Unsubscribed', value: 'unsubscribed' },
]

const reasonAddItems = [
  { label: 'Manual', value: 'manual' },
  { label: 'Unsubscribed', value: 'unsubscribed' },
  { label: 'Complaint', value: 'complaint' },
  { label: 'Invalid', value: 'invalid' },
  { label: 'Permanent bounce', value: 'permanent_bounce' },
  { label: 'Transient bounce', value: 'transient_bounce' },
]

// Add
const showAddModal = ref(false)
const formEmail = ref('')
const formReason = ref('manual')
const formDetail = ref('')
const adding = ref(false)
const addError = ref<string | null>(null)

function openAddModal() {
  formEmail.value = ''
  formReason.value = 'manual'
  formDetail.value = ''
  addError.value = null
  showAddModal.value = true
}

async function addSuppression() {
  const email = formEmail.value.trim()
  if (!email) {
    addError.value = 'Please enter an email address.'
    return
  }

  adding.value = true
  addError.value = null
  try {
    await $fetch('/api/suppressions', {
      method: 'POST',
      credentials: 'include',
      body: {
        email,
        reason: formReason.value,
        detail: formDetail.value.trim() || undefined,
      },
    })
    showAddModal.value = false
    refresh()
    toast.add({ title: 'Suppression added', description: `${email} has been added to the suppression list.`, color: 'success' })
  }
  catch (e: unknown) {
    const msg = (e as { data?: { error?: string }, message?: string })?.data?.error ?? (e as { message?: string })?.message ?? 'Failed to add suppression'
    addError.value = msg
  }
  finally {
    adding.value = false
  }
}

// Remove
const showRemoveModal = ref(false)
const emailToRemove = ref('')
const removing = ref(false)

function confirmRemove(email: string) {
  emailToRemove.value = email
  showRemoveModal.value = true
}

async function remove() {
  removing.value = true
  try {
    await $fetch('/api/suppressions', {
      method: 'DELETE',
      credentials: 'include',
      body: { email: emailToRemove.value },
    })
    showRemoveModal.value = false
    refresh()
    toast.add({ title: 'Suppression removed', description: `${emailToRemove.value} can now receive emails.`, color: 'success' })
  }
  catch {
    toast.add({ title: 'Removal failed', description: 'Could not remove the suppression. Please try again.', color: 'error' })
  }
  finally {
    removing.value = false
  }
}

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
</script>
