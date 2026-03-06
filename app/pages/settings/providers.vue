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
                          {{ item.name }}
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

          <!-- AWS Fields -->
          <template v-if="formData.name === 'aws'">
            <UFormField label="Access Key ID">
              <UInput
                v-model="formData.credentials.accessKeyId"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Secret Access Key">
              <UInput
                v-model="formData.credentials.secretAccessKey"
                type="password"
                placeholder="••••••••••••••••"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Region">
              <USelect
                v-model="formData.credentials.region"
                :items="awsRegions"
                class="w-full"
              />
            </UFormField>
          </template>

          <!-- SendGrid Fields -->
          <template v-else-if="formData.name === 'sendgrid'">
            <UFormField label="API Key">
              <UInput
                v-model="formData.credentials.apiKey"
                placeholder="SG.xxxxxxxx"
                class="w-full"
              />
            </UFormField>
          </template>

          <!-- Mailgun Fields -->
          <template v-else-if="formData.name === 'mailgun'">
            <UFormField label="API Key">
              <UInput
                v-model="formData.credentials.mailgunApiKey"
                type="password"
                placeholder="••••••••••••••••"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Domain">
              <UInput
                v-model="formData.credentials.domain"
                placeholder="mg.example.com"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Region">
              <USelect
                v-model="formData.credentials.mailgunRegion"
                :items="mailgunRegions"
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
  createdAt: string
  updatedAt: string
}

const toast = useToast()

const { data, pending, error, refresh: refreshList } = useFetch<Provider[]>('/api/providers', {
  credentials: 'include',
  key: 'providers',
})

// --- Add/Edit Modal ---
const showProviderModal = ref(false)
const editingProvider = ref<Provider | null>(null)
const savingProvider = ref(false)
const formError = ref<string | null>(null)

const providerTypes = [
  { label: 'AWS SES', value: 'aws' },
]

const awsRegions = [
  // US Regions
  { label: 'US East (N. Virginia)', value: 'us-east-1' },
  { label: 'US East (Ohio)', value: 'us-east-2' },
  { label: 'US West (N. California)', value: 'us-west-1' },
  { label: 'US West (Oregon)', value: 'us-west-2' },
  // Canada
  { label: 'Canada (Central)', value: 'ca-central-1' },
  // Europe
  { label: 'Europe (Frankfurt)', value: 'eu-central-1' },
  { label: 'Europe (Ireland)', value: 'eu-west-1' },
  { label: 'Europe (London)', value: 'eu-west-2' },
  { label: 'Europe (Paris)', value: 'eu-west-3' },
  { label: 'Europe (Stockholm)', value: 'eu-north-1' },
  { label: 'Europe (Milan)', value: 'eu-south-1' },
  { label: 'Europe (Spain)', value: 'eu-south-2' },
  { label: 'Europe (Zurich)', value: 'eu-central-2' },
  // Asia Pacific
  { label: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
  { label: 'Asia Pacific (Seoul)', value: 'ap-northeast-2' },
  { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
  { label: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
  { label: 'Asia Pacific (Jakarta)', value: 'ap-southeast-3' },
  { label: 'Asia Pacific (Melbourne)', value: 'ap-southeast-4' },
  { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
  { label: 'Asia Pacific (Hyderabad)', value: 'ap-south-2' },
  { label: 'Asia Pacific (Hong Kong)', value: 'ap-east-1' },
  { label: 'Asia Pacific (Osaka)', value: 'ap-northeast-3' },
  // South America
  { label: 'South America (Sao Paulo)', value: 'sa-east-1' },
  // Middle East
  { label: 'Middle East (Bahrain)', value: 'me-south-1' },
  { label: 'Middle East (UAE)', value: 'me-central-1' },
  // Africa
  { label: 'Africa (Cape Town)', value: 'af-south-1' },
  { label: 'Israel (Tel Aviv)', value: 'il-central-1' },
]

const mailgunRegions = [
  { label: 'US', value: 'us' },
  { label: 'EU', value: 'eu' },
]

const defaultFormData = {
  name: 'aws',
  displayName: '',
  credentials: {
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    apiKey: '',
    mailgunApiKey: '',
    domain: '',
    mailgunRegion: 'us',
  },
}

const formData = reactive({ ...defaultFormData })

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
  formData.credentials = {
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    apiKey: '',
    mailgunApiKey: '',
    domain: '',
    mailgunRegion: 'us',
  }
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
  if (formData.name === 'aws') {
    if (!formData.credentials.accessKeyId || !formData.credentials.secretAccessKey) {
      formError.value = 'Please enter AWS credentials.'
      savingProvider.value = false
      return
    }
    credentials.accessKeyId = formData.credentials.accessKeyId
    credentials.secretAccessKey = formData.credentials.secretAccessKey
    credentials.region = formData.credentials.region || 'us-east-1'
  }
  else if (formData.name === 'sendgrid') {
    if (!formData.credentials.apiKey) {
      formError.value = 'Please enter your SendGrid API key.'
      savingProvider.value = false
      return
    }
    credentials.apiKey = formData.credentials.apiKey
  }
  else if (formData.name === 'mailgun') {
    if (!formData.credentials.mailgunApiKey) {
      formError.value = 'Please enter your Mailgun API key.'
      savingProvider.value = false
      return
    }
    credentials.mailgunApiKey = formData.credentials.mailgunApiKey
    credentials.domain = formData.credentials.domain || ''
    credentials.mailgunRegion = formData.credentials.mailgunRegion || 'us'
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
  // Ensure host doesn't have trailing slash
  const cleanHost = host.replace(/\/$/, '')
  return `${cleanHost}/api/webhook/${providerName}`
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
  const fullWebhookUrl = `${host}/api/webhook/${setupProvider.value.name}`

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
      return 'i-heroicons-cloud'
    case 'sendgrid':
      return 'i-heroicons-paper-airplane'
    case 'mailgun':
      return 'i-heroicons-envelope'
    default:
      return 'i-heroicons-cloud'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>
