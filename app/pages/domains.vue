<template>
  <div>
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
          Domain Identities
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400">
          Manage your verified sending domains.
        </p>
      </div>

      <div class="card-elevated p-6 space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Domains
            </h2>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              Verified sending domains registered with AWS SES.
            </p>
          </div>
          <UButton
            @click="openAddModal"
          >
            <UIcon
              name="i-heroicons-plus"
              class="w-4 h-4 mr-1.5"
            />
            Add Domain
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
          title="Failed to load identities"
          :description="String(error)"
        />

        <template v-else-if="data">
          <div
            v-if="data.items.length === 0"
            class="empty-state"
          >
            <div class="empty-state-icon">
              <UIcon
                name="i-heroicons-globe-alt"
                class="w-8 h-8 text-stone-400"
              />
            </div>
            <p class="text-stone-500 dark:text-stone-400">
              No domains configured
            </p>
            <p class="text-sm text-stone-400 dark:text-stone-500 mt-1">
              Add a domain to start sending emails
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
                    Domain
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Health
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    DKIM
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Mail From
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th class="px-4 py-3" />
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
                    <HealthBadge
                      :domain="item.domain"
                      :has-tenant="!!item.tenantName"
                    />
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
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <UTooltip text="View DNS records">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          :disabled="viewingDnsDomain === item.domain"
                          @click="viewDns(item.domain)"
                        >
                          <UIcon
                            :name="viewingDnsDomain === item.domain ? 'i-heroicons-arrow-path' : 'i-heroicons-globe-alt'"
                            class="w-4 h-4"
                            :class="{ 'animate-spin': viewingDnsDomain === item.domain }"
                          />
                        </UButton>
                      </UTooltip>
                      <UTooltip text="Sync status from SES">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          :disabled="refreshingDomain === item.domain"
                          @click="refreshDomain(item.domain)"
                        >
                          <UIcon
                            name="i-heroicons-arrow-path"
                            class="w-4 h-4"
                            :class="{ 'animate-spin': refreshingDomain === item.domain }"
                          />
                        </UButton>
                      </UTooltip>
                      <UTooltip text="Remove domain">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="error"
                          @click="confirmDelete(item.domain)"
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

    <!-- Add Domain Modal -->
    <UModal
      v-model:open="showAddModal"
      :ui="{ content: 'max-w-xl' }"
    >
      <template #content>
        <!-- Step 1: Form -->
        <div
          v-if="addStep === 1"
          class="p-6 space-y-5"
        >
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Add Domain
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Register a sending domain with AWS SES and get the DNS records to configure.
            </p>
          </div>

          <UFormField label="Domain">
            <UInput
              v-model="formDomain"
              placeholder="example.com"
              class="w-full"
              autofocus
              @keydown.enter="addDomain"
            />
          </UFormField>

          <UFormField
            label="MAIL FROM subdomain"
            help="A subdomain used as the envelope sender. Defaults to 'mail'."
          >
            <UInput
              v-model="formMailFrom"
              placeholder="mail"
              class="w-full"
            />
          </UFormField>

          <div v-if="addError">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="error"
              variant="soft"
              :title="addError"
            />
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="closeAddModal"
            >
              Cancel
            </UButton>
            <UButton
              :loading="adding"
              @click="addDomain"
            >
              Add Domain
            </UButton>
          </div>
        </div>

        <!-- Step 2: DNS Records -->
        <div
          v-else-if="addStep === 2 && dnsResult"
          class="p-6 space-y-5"
        >
          <div>
            <h3 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Configure DNS
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Add these records to your DNS provider for <strong>{{ formDomain }}</strong>. DKIM verification typically completes within 72 hours.
            </p>
          </div>

          <!-- DKIM records -->
          <div
            v-if="dnsResult.dkim.length"
            class="space-y-2"
          >
            <p class="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              DKIM — 3 CNAME records (all required)
            </p>
            <div class="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
              <div
                v-for="rec in dnsResult.dkim"
                :key="rec.name"
                class="p-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
                      Name
                    </p>
                    <p class="text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                      {{ rec.name }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="shrink-0"
                    aria-label="Copy name"
                    @click="copyText(rec.name, 'name')"
                  >
                    <UIcon
                      :name="copiedField.name === rec.name ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                      class="w-3.5 h-3.5 mr-1"
                    />
                    <span class="text-[10px]">{{ copiedField.name === rec.name ? 'Copied' : 'Copy' }}</span>
                  </UButton>
                </div>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
                      Content
                    </p>
                    <p class="text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                      {{ rec.value }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="shrink-0"
                    aria-label="Copy value"
                    @click="copyText(rec.value, 'value')"
                  >
                    <UIcon
                      :name="copiedField.value === rec.value ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                      class="w-3.5 h-3.5 mr-1"
                    />
                    <span class="text-[10px]">{{ copiedField.value === rec.value ? 'Copied' : 'Copy' }}</span>
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- MAIL FROM records -->
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              MAIL FROM
            </p>
            <div class="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
              <div
                v-for="rec in dnsResult.mailFrom"
                :key="rec.name + rec.type"
                class="p-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
                      Name
                    </p>
                    <p class="text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                      {{ rec.name }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="shrink-0"
                    aria-label="Copy name"
                    @click="copyText(rec.name, 'name')"
                  >
                    <UIcon
                      :name="copiedField.name === rec.name ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                      class="w-3.5 h-3.5 mr-1"
                    />
                    <span class="text-[10px]">{{ copiedField.name === rec.name ? 'Copied' : 'Copy' }}</span>
                  </UButton>
                </div>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
                      Content
                    </p>
                    <p class="text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                      {{ rec.value }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="shrink-0"
                    aria-label="Copy value"
                    @click="copyText(rec.value, 'value')"
                  >
                    <UIcon
                      :name="copiedField.value === rec.value ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                      class="w-3.5 h-3.5 mr-1"
                    />
                    <span class="text-[10px]">{{ copiedField.value === rec.value ? 'Copied' : 'Copy' }}</span>
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- DMARC record -->
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              DMARC (recommended)
            </p>
            <div class="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
              <div
                v-for="rec in dnsResult.dmarc"
                :key="rec.name"
                class="p-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
                      Name
                    </p>
                    <p class="text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                      {{ rec.name }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="shrink-0"
                    aria-label="Copy name"
                    @click="copyText(rec.name, 'name')"
                  >
                    <UIcon
                      :name="copiedField.name === rec.name ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                      class="w-3.5 h-3.5 mr-1"
                    />
                    <span class="text-[10px]">{{ copiedField.name === rec.name ? 'Copied' : 'Copy' }}</span>
                  </UButton>
                </div>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">
                      Content
                    </p>
                    <p class="text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                      {{ rec.value }}
                    </p>
                  </div>
                  <UButton
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="shrink-0"
                    aria-label="Copy value"
                    @click="copyText(rec.value, 'value')"
                  >
                    <UIcon
                      :name="copiedField.value === rec.value ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                      class="w-3.5 h-3.5 mr-1"
                    />
                    <span class="text-[10px]">{{ copiedField.value === rec.value ? 'Copied' : 'Copy' }}</span>
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <UButton @click="closeAddModal">
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
              Remove Domain
            </h3>
            <p class="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Are you sure you want to remove <strong>{{ domainToDelete }}</strong>? This will delete the identity from AWS SES and cannot be undone.
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
              @click="deleteIdentity"
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
type DnsRecord = { name: string, type: string, value: string }
type DnsResult = {
  dkim: DnsRecord[]
  mailFrom: DnsRecord[]
  dmarc: DnsRecord[]
}

// --- List ---
const toast = useToast()

const page = ref(1)
const limit = 20

const { data, pending, error, refresh: refreshList } = useFetch('/api/identities', {
  credentials: 'include',
  query: { page, limit },
  key: () => `identities-${page.value}`,
  watch: [page],
})

const totalPages = computed(() => Math.ceil((data.value?.total ?? 0) / limit))

// --- Add domain modal ---
const showAddModal = ref(false)
const addStep = ref(1)
const formDomain = ref('')
const formMailFrom = ref('mail')
const adding = ref(false)
const addError = ref<string | null>(null)
const dnsResult = ref<DnsResult | null>(null)

function openAddModal() {
  addStep.value = 1
  formDomain.value = ''
  formMailFrom.value = 'mail'
  addError.value = null
  dnsResult.value = null
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

async function addDomain() {
  const domain = formDomain.value.trim()
  if (!domain) {
    addError.value = 'Please enter a domain.'
    return
  }

  adding.value = true
  addError.value = null
  try {
    const result = await $fetch<{ identity: unknown, dnsRecords: DnsResult }>('/api/identities', {
      method: 'POST',
      credentials: 'include',
      body: {
        domain,
        mailFromSubdomain: formMailFrom.value.trim() || 'mail',
      },
    })
    dnsResult.value = result.dnsRecords
    addStep.value = 2
    await refreshList()
  }
  catch (e: unknown) {
    const msg = (e as { data?: { error?: string }, message?: string })?.data?.error ?? (e as { message?: string })?.message ?? 'Failed to add domain'
    addError.value = msg
  }
  finally {
    adding.value = false
  }
}

// --- View DNS records ---
const viewingDnsDomain = ref<string | null>(null)

async function viewDns(domain: string) {
  viewingDnsDomain.value = domain
  try {
    const result = await $fetch<DnsResult>(`/api/identities/${domain}/dns`, {
      credentials: 'include',
    })
    formDomain.value = domain
    dnsResult.value = result
    addStep.value = 2
    showAddModal.value = true
  }
  catch {
    // silently ignore
  }
  finally {
    viewingDnsDomain.value = null
  }
}

// --- Refresh domain ---
const refreshingDomain = ref<string | null>(null)

async function refreshDomain(domain: string) {
  refreshingDomain.value = domain
  try {
    await $fetch(`/api/identities/${domain}/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    await refreshList()
    toast.add({ title: 'Status synced', description: `${domain} has been updated from SES.`, color: 'success' })
  }
  catch {
    toast.add({ title: 'Sync failed', description: `Could not reach AWS SES for ${domain}.`, color: 'error' })
  }
  finally {
    refreshingDomain.value = null
  }
}

// --- Copy ---
const copiedField = reactive<{ name: string | null; value: string | null }>({
  name: null,
  value: null,
})

async function copyText(text: string, field: 'name' | 'value') {
  await navigator.clipboard.writeText(text)
  copiedField[field] = text
  setTimeout(() => (copiedField[field] = null), 2000)
}

// --- Delete ---
const showDeleteModal = ref(false)
const domainToDelete = ref<string | null>(null)
const deleting = ref(false)

function confirmDelete(domain: string) {
  domainToDelete.value = domain
  showDeleteModal.value = true
}

async function deleteIdentity() {
  if (!domainToDelete.value) return
  deleting.value = true
  const domain = domainToDelete.value
  try {
    await $fetch(`/api/identities/${domain}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    showDeleteModal.value = false
    domainToDelete.value = null
    await refreshList()
    toast.add({ title: 'Domain removed', description: `${domain} has been deleted from SES.`, color: 'success' })
  }
  catch {
    toast.add({ title: 'Removal failed', description: `Could not remove ${domain}. Please try again.`, color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

// --- Utils ---
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
