<template>
  <div>
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
          Email Providers
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400">
          Manage your email service providers.
        </p>
      </div>

      <div class="card-elevated p-6 space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Providers
            </h2>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              Configure email providers like AWS SES, SendGrid, or Mailgun.
            </p>
          </div>
          <UButton
            @click="openAddModal"
          >
            <UIcon
              name="i-heroicons-plus"
              class="w-4 h-4 mr-1.5"
            />
            Add Provider
          </UButton>
        </div>

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
          title="Failed to load providers"
          :description="String(error)"
        />

        <template v-else-if="data">
          <div
            v-if="data.length === 0"
            class="empty-state"
          >
            <div class="empty-state-icon">
              <UIcon
                name="i-heroicons-cloud"
                class="w-8 h-8 text-stone-400"
              />
            </div>
            <p class="text-stone-500 dark:text-stone-400">
              No providers configured
            </p>
            <p class="text-sm text-stone-400 dark:text-stone-500 mt-1">
              Add a provider to start sending emails
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
                    Provider
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Domains
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th class="px-4 py-3" />
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-200 dark:divide-stone-800">
                <tr
                  v-for="item in data"
                  :key="item.id"
                  class="table-row-animate"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                        <UIcon
                          :name="getProviderIcon(item.name)"
                          class="w-4 h-4 text-stone-600 dark:text-stone-400"
                        />
                      </div>
                      <div>
                        <span class="text-sm font-medium text-stone-700 dark:text-stone-300">{{ item.displayName }}</span>
                        <p class="text-xs text-stone-500 dark:text-stone-400">
                          {{ getProviderLabel(item.name) }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="item.isActive ? 'success' : 'warning'"
                      variant="soft"
                    >
                      {{ item.isActive ? 'Active' : 'Pending Setup' }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-stone-600 dark:text-stone-300">{{ item.domainCount ?? 0 }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-stone-500">{{ formatDate(item.createdAt) }}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <UTooltip text="Test connection">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          :disabled="testingProvider === item.id"
                          @click="testConnection(item.id)"
                        >
                          <UIcon
                            name="i-heroicons-signal"
                            class="w-4 h-4"
                            :class="{ 'animate-pulse': testingProvider === item.id }"
                          />
                        </UButton>
                      </UTooltip>
                      <UTooltip text="View details">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="openDetailsModal(item)"
                        >
                          <UIcon
                            name="i-heroicons-information-circle"
                            class="w-4 h-4"
                          />
                        </UButton>
                      </UTooltip>
                      <UTooltip
                        v-if="!item.isActive"
                        text="Configure webhooks"
                      >
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="openSetupModal(item)"
                        >
                          <UIcon
                            name="i-heroicons-cog-6-tooth"
                            class="w-4 h-4"
                          />
                        </UButton>
                      </UTooltip>
                      <UTooltip
                        v-if="!item.isActive"
                        text="Edit provider"
                      >
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="openEditModal(item)"
                        >
                          <UIcon
                            name="i-heroicons-pencil-square"
                            class="w-4 h-4"
                          />
                        </UButton>
                      </UTooltip>
                      <UTooltip text="Remove provider">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="error"
                          @click="confirmDelete(item)"
                        >
                          <UIcon
                            name="i-heroicons-trash"
                            class="w-4 h-4"
                          />
                        </UButton>
                      </UTooltip>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>

    <!-- Add/Edit Provider Modal -->
    <UModal
      v-model:open="showProviderModal"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              {{ editingProvider ? 'Edit Provider' : 'Add Provider' }}
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {{ editingProvider ? 'Update provider credentials.' : 'Configure a new email service provider.' }}
            </p>
          </div>

          <UFormField label="Provider Type">
            <USelect
              v-model="formData.name"
              :items="providerTypes"
              :disabled="!!editingProvider"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Display Name">
            <UInput
              v-model="formData.displayName"
              placeholder="My AWS Account"
              class="w-full"
            />
          </UFormField>

          <template
            v-for="field in selectedCredentialFields"
            :key="field.key"
          >
            <UFormField :label="field.label">
              <USelect
                v-if="field.type === 'select'"
                v-model="formData.credentials[field.key]"
                :items="field.options ?? []"
                class="w-full"
              />
              <UInput
                v-else
                v-model="formData.credentials[field.key]"
                :type="field.type === 'password' ? 'password' : 'text'"
                :placeholder="field.placeholder ?? ''"
                class="w-full"
              />
            </UFormField>
          </template>

          <div v-if="formError">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="error"
              variant="soft"
              :title="formError"
            />
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="closeProviderModal"
            >
              Cancel
            </UButton>
            <UButton
              :loading="savingProvider"
              @click="saveProvider"
            >
              {{ editingProvider ? 'Update' : 'Add Provider' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Setup (Webhook) Modal -->
    <UModal
      v-model:open="showSetupModal"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Configure Webhooks
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Set up webhooks to receive email events like bounces and deliveries.
            </p>
          </div>

          <UFormField label="Webhook Host">
            <UInput
              v-model="webhookUrl"
              placeholder="https://your-domain.com"
              class="w-full"
            />
            <template #help>
              <p class="text-xs text-stone-500">
                Webhook endpoint: <code class="text-xs bg-stone-100 dark:bg-stone-800 px-1 rounded">{{ webhookEndpoint }}</code>
              </p>
            </template>
          </UFormField>

          <UAlert
            v-if="setupResult"
            :icon="setupResult.success ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
            :color="setupResult.success ? 'success' : 'error'"
            variant="soft"
            :title="setupResult.success ? 'Setup successful' : 'Setup failed'"
          >
            <template #description>
              <pre
                v-if="setupResult.details"
                class="text-xs mt-1 whitespace-pre-wrap"
              >{{ JSON.stringify(setupResult.details, null, 2) }}</pre>
            </template>
          </UAlert>

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showSetupModal = false"
            >
              Close
            </UButton>
            <UButton
              :loading="settingUp"
              @click="runSetup"
            >
              Setup Webhooks
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Provider Details Modal -->
    <UModal
      v-model:open="showDetailsModal"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #content>
        <div class="p-6 space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Provider Details
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Basic configuration data for this provider. Secret keys are not shown.
            </p>
          </div>

          <div
            v-if="detailsProvider"
            class="space-y-3"
          >
            <div class="grid grid-cols-3 gap-3 text-sm">
              <span class="text-stone-500 dark:text-stone-400">Display Name</span>
              <span class="col-span-2 text-stone-800 dark:text-stone-200 font-medium">{{ detailsProvider.displayName }}</span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm">
              <span class="text-stone-500 dark:text-stone-400">Provider</span>
              <span class="col-span-2">
                <span class="inline-flex items-center gap-2 text-stone-700 dark:text-stone-300">
                  <UIcon
                    :name="getProviderBrandIcon(detailsProvider.name)"
                    class="w-4 h-4"
                  />
                  {{ getProviderLabel(detailsProvider.name) }}
                </span>
              </span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm">
              <span class="text-stone-500 dark:text-stone-400">Status</span>
              <span class="col-span-2">
                <UBadge
                  :color="detailsProvider.isActive ? 'success' : 'warning'"
                  variant="soft"
                >
                  {{ detailsProvider.isActive ? 'Active' : 'Pending Setup' }}
                </UBadge>
              </span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm">
              <span class="text-stone-500 dark:text-stone-400">Created</span>
              <span class="col-span-2 text-stone-700 dark:text-stone-300">{{ formatDate(detailsProvider.createdAt) }}</span>
            </div>
            <div class="space-y-2">
              <p class="text-sm text-stone-500 dark:text-stone-400">
                Settings
              </p>
              <pre class="text-xs bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-lg p-3 whitespace-pre-wrap text-stone-700 dark:text-stone-300">{{ formatSettings(detailsProvider.settings) }}</pre>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showDetailsModal = false"
            >
              Close
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
              Remove Provider
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Are you sure you want to remove <strong>{{ providerToDelete?.displayName }}</strong>? This cannot be undone.
            </p>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showDeleteModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="deleting"
              @click="deleteProvider"
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
interface Provider {
  id: string
  name: string
  displayName: string
  isActive: boolean
  settings?: Record<string, unknown>
  domainCount?: number
  createdAt: string
  updatedAt: string
}

interface ProviderCredentialField {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string, value: string }>
}

interface ProviderTypeDefinition {
  type: string
  displayName: string
  credentialFields: ProviderCredentialField[]
}

const toast = useToast()

const { data, pending, error, refresh: refreshList } = useFetch<Provider[]>('/api/providers', {
  credentials: 'include',
  key: 'providers',
})
const { data: providerTypesData } = useFetch<ProviderTypeDefinition[]>('/api/providers/types', {
  credentials: 'include',
  key: 'provider-types',
  default: () => [],
})

// --- Add/Edit Modal ---
const showProviderModal = ref(false)
const editingProvider = ref<Provider | null>(null)
const savingProvider = ref(false)
const formError = ref<string | null>(null)

const providerTypes = computed(() => (
  providerTypesData.value.map(p => ({ label: p.displayName, value: p.type }))
))
const selectedCredentialFields = computed(() => (
  providerTypesData.value.find(p => p.type === formData.name)?.credentialFields ?? []
))

const defaultFormData = {
  name: 'aws',
  displayName: '',
  credentials: {} as Record<string, string>,
}

const formData = reactive({ ...defaultFormData })

watch(selectedCredentialFields, (fields) => {
  for (const field of fields) {
    if (!formData.credentials[field.key] && field.type === 'select' && field.options?.[0]?.value) {
      formData.credentials[field.key] = field.options[0].value
    }
  }
}, { immediate: true })

watch(providerTypes, (items) => {
  const first = items[0]
  if (!first) return
  if (!items.some(i => i.value === formData.name)) {
    formData.name = first.value
  }
}, { immediate: true })

function openAddModal() {
  editingProvider.value = null
  Object.assign(formData, defaultFormData)
  formError.value = null
  showProviderModal.value = true
}

function openEditModal(provider: Provider) {
  if (provider.isActive) {
    toast.add({ title: 'Active providers cannot be edited', color: 'warning' })
    return
  }

  editingProvider.value = provider
  formData.name = provider.name
  formData.displayName = provider.displayName
  formData.credentials = {}
  formError.value = null
  showProviderModal.value = true
}

function closeProviderModal() {
  showProviderModal.value = false
  editingProvider.value = null
}

async function saveProvider() {
  if (!formData.displayName.trim()) {
    formError.value = 'Please enter a display name.'
    return
  }

  savingProvider.value = true
  formError.value = null

  const credentials: Record<string, string> = {}
  for (const field of selectedCredentialFields.value) {
    const value = (formData.credentials[field.key] ?? '').trim()
    if (field.required && !value) {
      formError.value = `Please enter ${field.label}.`
      savingProvider.value = false
      return
    }
    if (value) {
      credentials[field.key] = value
    }
  }

  try {
    if (editingProvider.value) {
      await $fetch(`/api/providers/${editingProvider.value.id}`, {
        method: 'PATCH',
        credentials: 'include',
        body: { credentials },
      })
      toast.add({ title: 'Provider updated', color: 'success' })
    }
    else {
      await $fetch('/api/providers', {
        method: 'POST',
        credentials: 'include',
        body: {
          name: formData.name,
          displayName: formData.displayName,
          credentials,
        },
      })
      toast.add({ title: 'Provider added', color: 'success' })
    }
    closeProviderModal()
    await refreshList()
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? 'Failed to save provider'
    formError.value = msg
  }
  finally {
    savingProvider.value = false
  }
}

// --- Test Connection ---
const testingProvider = ref<string | null>(null)

async function testConnection(id: string) {
  testingProvider.value = id
  try {
    const result = await $fetch<{ success: boolean, message?: string }>(`/api/providers/${id}/test`, {
      method: 'POST',
      credentials: 'include',
    })
    if (result.success) {
      toast.add({ title: 'Connection successful', color: 'success' })
    }
    else {
      toast.add({ title: 'Connection failed', description: result.message, color: 'error' })
    }
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? 'Connection test failed'
    toast.add({ title: 'Connection failed', description: msg, color: 'error' })
  }
  finally {
    testingProvider.value = null
  }
}

// --- Setup Modal ---
const showSetupModal = ref(false)
const setupProvider = ref<Provider | null>(null)
const webhookUrl = ref('')
const settingUp = ref(false)
const setupResult = ref<{ success: boolean, details?: Record<string, unknown> } | null>(null)

const webhookEndpoint = computed(() => {
  const host = webhookUrl.value.trim() || 'https://your-domain.com'
  const providerName = setupProvider.value?.name || 'aws'
  const providerId = setupProvider.value?.id
  // Ensure host doesn't have trailing slash
  const cleanHost = host.replace(/\/$/, '')
  return providerId
    ? `${cleanHost}/api/webhook/${providerName}?providerId=${providerId}`
    : `${cleanHost}/api/webhook/${providerName}`
})

function openSetupModal(provider: Provider) {
  if (provider.isActive) {
    toast.add({ title: 'Active providers cannot run setup again', color: 'warning' })
    return
  }

  setupProvider.value = provider
  webhookUrl.value = ''
  setupResult.value = null
  showSetupModal.value = true
}

async function runSetup() {
  if (!webhookUrl.value) {
    toast.add({ title: 'Please enter a webhook host', color: 'error' })
    return
  }

  if (!setupProvider.value) return

  // Construct full URL by appending /api/webhook/{provider}
  const host = webhookUrl.value.trim().replace(/\/$/, '')
  const fullWebhookUrl = `${host}/api/webhook/${setupProvider.value.name}?providerId=${setupProvider.value.id}`

  settingUp.value = true
  try {
    const result = await $fetch(`/api/providers/${setupProvider.value.id}/setup`, {
      method: 'POST',
      credentials: 'include',
      body: { webhookUrl: fullWebhookUrl },
    })
    setupResult.value = result as { success: boolean, details?: Record<string, unknown> }
    if (result.success) {
      toast.add({ title: 'Webhook configured successfully', color: 'success' })
      await refreshList()
    }
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? 'Setup failed'
    setupResult.value = { success: false, details: { error: msg } }
  }
  finally {
    settingUp.value = false
  }
}

// --- Details Modal ---
const showDetailsModal = ref(false)
const detailsProvider = ref<Provider | null>(null)

function openDetailsModal(provider: Provider) {
  detailsProvider.value = provider
  showDetailsModal.value = true
}

// --- Delete ---
const showDeleteModal = ref(false)
const providerToDelete = ref<Provider | null>(null)
const deleting = ref(false)

function confirmDelete(provider: Provider) {
  providerToDelete.value = provider
  showDeleteModal.value = true
}

async function deleteProvider() {
  if (!providerToDelete.value) return

  deleting.value = true
  try {
    await $fetch(`/api/providers/${providerToDelete.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    showDeleteModal.value = false
    providerToDelete.value = null
    await refreshList()
    toast.add({ title: 'Provider removed', color: 'success' })
  }
  catch {
    toast.add({ title: 'Removal failed', color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

// --- Utils ---
function getProviderIcon(name: string) {
  switch (name) {
    case 'aws':
      return 'i-simple-icons-amazonaws'
    case 'sendgrid':
      return 'i-simple-icons-sendgrid'
    case 'mailgun':
      return 'i-simple-icons-mailgun'
    default:
      return 'i-heroicons-cloud'
  }
}

function getProviderBrandIcon(name: string) {
  switch (name) {
    case 'aws':
      return 'i-simple-icons-amazonaws'
    default:
      return getProviderIcon(name)
  }
}

function getProviderLabel(name: string) {
  return providerTypesData.value.find(p => p.type === name)?.displayName ?? name
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets)
  }

  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {}
    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (/(secret|token|password|private.?key|access.?key|api.?key)/i.test(key)) {
        redacted[key] = '[REDACTED]'
      }
      else {
        redacted[key] = redactSecrets(childValue)
      }
    }
    return redacted
  }

  return value
}

function formatSettings(settings: Record<string, unknown> | undefined) {
  if (!settings || Object.keys(settings).length === 0) {
    return 'No settings configured.'
  }
  return JSON.stringify(redactSecrets(settings), null, 2)
}
</script>
