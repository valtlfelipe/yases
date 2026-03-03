<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
        Settings
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400">
        Manage your API keys.
      </p>
    </div>

    <div class="card-elevated p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
            API Keys
          </h2>
          <p class="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Use these keys to authenticate requests to the API.
          </p>
        </div>
        <UButton
          size="sm"
          @click="showCreateModal = true"
        >
          <UIcon
            name="i-heroicons-plus"
            class="w-4 h-4 mr-1.5"
          />
          New API Key
        </UButton>
      </div>

      <!-- Loading -->
      <div
        v-if="pending"
        class="flex items-center justify-center py-10"
      >
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-6 h-6 animate-spin text-stone-400"
        />
      </div>

      <!-- Error -->
      <UAlert
        v-else-if="loadError"
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        title="Failed to load API keys"
        :description="loadError"
      />

      <!-- Empty -->
      <div
        v-else-if="keys.length === 0"
        class="empty-state py-10"
      >
        <div class="empty-state-icon">
          <UIcon
            name="i-heroicons-key"
            class="w-8 h-8 text-stone-400"
          />
        </div>
        <p class="text-stone-500 dark:text-stone-400">
          No API keys yet
        </p>
        <p class="text-sm text-stone-400 dark:text-stone-500 mt-1">
          Create a key to start making API requests.
        </p>
      </div>

      <!-- Keys table -->
      <div
        v-else
        class="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800"
      >
        <table class="w-full">
          <thead class="bg-stone-50 dark:bg-stone-800/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Name
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Key
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Created
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Expires
              </th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
            <tr
              v-for="k in keys"
              :key="k.id"
              class="table-row-animate"
            >
              <td class="px-4 py-3">
                <span class="text-sm font-medium text-stone-700 dark:text-stone-300">{{ k.name || 'Unnamed' }}</span>
              </td>
              <td class="px-4 py-3">
                <code class="text-xs bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-2 py-1 rounded font-mono">
                  {{ k.start ? `${k.start}...` : '••••••••' }}
                </code>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm text-stone-500">{{ formatDate(k.createdAt) }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="k.expiresAt"
                  class="text-sm text-stone-500"
                >{{ formatDate(k.expiresAt) }}</span>
                <span
                  v-else
                  class="text-sm text-stone-400 dark:text-stone-500"
                >Never</span>
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="red"
                  :loading="deletingId === k.id"
                  @click="confirmDelete(k)"
                >
                  <UIcon
                    name="i-heroicons-trash"
                    class="w-4 h-4"
                  />
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create modal -->
    <UModal v-model:open="showCreateModal">
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Create API Key
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Give your key a name to identify it later.
            </p>
          </div>

          <UFormField label="Key name">
            <UInput
              v-model="newKeyName"
              placeholder="e.g. Production, Local dev"
              class="w-full"
              autofocus
            />
          </UFormField>

          <UFormField label="Expiry (optional)">
            <USelect
              v-model="newKeyExpiry"
              :items="expiryOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>

          <div v-if="createError">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="red"
              variant="soft"
              :title="createError"
            />
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="gray"
              @click="closeCreateModal"
            >
              Cancel
            </UButton>
            <UButton
              :loading="creating"
              @click="createKey"
            >
              Create key
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- New key reveal modal -->
    <UModal
      v-model:open="showRevealModal"
      :dismissible="false"
    >
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Save your API key
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              This is the only time you'll see the full key. Copy it now.
            </p>
          </div>

          <div class="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5">
            <code class="flex-1 text-sm font-mono text-stone-800 dark:text-stone-200 break-all">{{ revealedKey }}</code>
            <UButton
              size="xs"
              variant="ghost"
              color="gray"
              @click="copyKey"
            >
              <UIcon
                :name="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                class="w-4 h-4"
              />
            </UButton>
          </div>

          <UAlert
            icon="i-heroicons-exclamation-triangle"
            color="yellow"
            variant="soft"
            title="Store this key securely — it won't be shown again."
          />

          <div class="flex justify-end pt-2">
            <UButton @click="closeRevealModal">
              Done
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete confirm modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Delete API Key
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Are you sure you want to delete <strong>{{ keyToDelete?.name || 'this key' }}</strong>? This cannot be undone.
            </p>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="gray"
              @click="showDeleteModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="red"
              :loading="deletingId !== null"
              @click="deleteKey"
            >
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { authClient } from '~/lib/auth.client'

type ApiKey = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  createdAt: string
  expiresAt: string | null
}

// --- List ---
const keys = ref<ApiKey[]>([])
const pending = ref(true)
const loadError = ref<string | null>(null)

async function loadKeys() {
  pending.value = true
  loadError.value = null
  try {
    const { data, error } = await authClient.apiKey.list({})
    if (error) throw new Error(error.message ?? 'Failed to load keys')
    console.log('Loaded keys:', data)
    keys.value = (data?.apiKeys ?? []) as ApiKey[]
  }
  catch (e: any) {
    loadError.value = e.message
  }
  finally {
    pending.value = false
  }
}

onMounted(loadKeys)

// --- Create ---
const showCreateModal = ref(false)
const newKeyName = ref('')
const newKeyExpiry = ref<number | null>(null)
const creating = ref(false)
const createError = ref<string | null>(null)

const expiryOptions = [
  { label: 'No expiry', value: null },
  { label: '7 days', value: 60 * 60 * 24 * 7 },
  { label: '30 days', value: 60 * 60 * 24 * 30 },
  { label: '90 days', value: 60 * 60 * 24 * 90 },
  { label: '1 year', value: 60 * 60 * 24 * 365 },
]

async function createKey() {
  if (!newKeyName.value.trim()) {
    createError.value = 'Please enter a key name.'
    return
  }
  creating.value = true
  createError.value = null
  try {
    const { data, error } = await authClient.apiKey.create({
      name: newKeyName.value.trim(),
      ...(newKeyExpiry.value ? { expiresIn: newKeyExpiry.value } : {}),
    })
    if (error) throw new Error(error.message ?? 'Failed to create key')
    revealedKey.value = (data as any).key
    closeCreateModal()
    showRevealModal.value = true
    await loadKeys()
  }
  catch (e: any) {
    createError.value = e.message
  }
  finally {
    creating.value = false
  }
}

function closeCreateModal() {
  showCreateModal.value = false
  newKeyName.value = ''
  newKeyExpiry.value = null
  createError.value = null
}

// --- Reveal ---
const showRevealModal = ref(false)
const revealedKey = ref('')
const copied = ref(false)

async function copyKey() {
  await navigator.clipboard.writeText(revealedKey.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function closeRevealModal() {
  showRevealModal.value = false
  revealedKey.value = ''
  copied.value = false
}

// --- Delete ---
const showDeleteModal = ref(false)
const keyToDelete = ref<ApiKey | null>(null)
const deletingId = ref<string | null>(null)

function confirmDelete(k: ApiKey) {
  keyToDelete.value = k
  showDeleteModal.value = true
}

async function deleteKey() {
  if (!keyToDelete.value) return
  deletingId.value = keyToDelete.value.id
  try {
    await authClient.apiKey.delete({ keyId: keyToDelete.value.id })
    showDeleteModal.value = false
    keyToDelete.value = null
    await loadKeys()
  }
  finally {
    deletingId.value = null
  }
}

// --- Utils ---
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
</script>
