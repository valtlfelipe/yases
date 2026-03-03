<template>
  <span class="inline-flex items-center gap-1.5 text-xs font-medium">
    <!-- No tenant (pre-tenant identity) -->
    <template v-if="!hasTenant">
      <span class="text-stone-400 dark:text-stone-500">—</span>
    </template>

    <!-- Loading -->
    <template v-else-if="pending">
      <UIcon
        name="i-heroicons-arrow-path"
        class="w-3 h-3 animate-spin text-stone-400"
      />
    </template>

    <!-- Error -->
    <template v-else-if="error || !data?.available">
      <span class="text-stone-400 dark:text-stone-500">—</span>
    </template>

    <!-- Health data -->
    <template v-else>
      <UTooltip :text="tooltip">
        <span class="inline-flex items-center gap-1.5 cursor-default">
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="dotColor"
          />
          <span :class="textColor">{{ label }}</span>
        </span>
      </UTooltip>
    </template>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  domain: string
  hasTenant: boolean
}>()

interface HealthData {
  available: boolean
  sendingStatus?: string
  reputationImpact?: string | null
  awsManagedStatus?: string | null
  customerManagedStatus?: string | null
}

const { data, pending, error } = useFetch<HealthData>(
  () => `/api/identities/${props.domain}/health`,
  { credentials: 'include', lazy: true },
)

const label = computed(() => {
  const status = data.value?.sendingStatus
  const impact = data.value?.reputationImpact
  if (status === 'DISABLED') return 'Disabled'
  if (status === 'REINSTATED') return 'Reinstated'
  if (impact === 'HIGH') return 'At Risk'
  if (impact === 'MEDIUM') return 'Warning'
  if (impact === 'LOW') return 'Low Risk'
  return 'Healthy'
})

const dotColor = computed(() => {
  const status = data.value?.sendingStatus
  const impact = data.value?.reputationImpact
  if (status === 'DISABLED') return 'bg-red-600'
  if (status === 'REINSTATED') return 'bg-blue-500'
  if (impact === 'HIGH') return 'bg-red-500'
  if (impact === 'MEDIUM') return 'bg-amber-500'
  if (impact === 'LOW') return 'bg-yellow-400'
  return 'bg-emerald-500'
})

const textColor = computed(() => {
  const status = data.value?.sendingStatus
  const impact = data.value?.reputationImpact
  if (status === 'DISABLED') return 'text-red-700 dark:text-red-400'
  if (status === 'REINSTATED') return 'text-blue-700 dark:text-blue-400'
  if (impact === 'HIGH') return 'text-red-700 dark:text-red-400'
  if (impact === 'MEDIUM') return 'text-amber-700 dark:text-amber-400'
  if (impact === 'LOW') return 'text-yellow-700 dark:text-yellow-400'
  return 'text-emerald-700 dark:text-emerald-400'
})

const tooltip = computed(() => {
  const parts: string[] = []
  const aws = data.value?.awsManagedStatus
  const customer = data.value?.customerManagedStatus
  if (aws) parts.push(`AWS: ${aws}`)
  if (customer) parts.push(`Customer: ${customer}`)
  return parts.length ? parts.join(' · ') : 'Sending enabled, no reputation issues'
})
</script>
