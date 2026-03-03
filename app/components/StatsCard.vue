<template>
  <UCard>
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ label }}
        </p>
        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {{ displayValue }}
        </p>
        <p
          v-if="subtitle"
          class="mt-0.5 text-xs text-gray-400 dark:text-gray-500"
        >
          {{ subtitle }}
        </p>
      </div>
      <div
        class="p-3 rounded-xl"
        :class="iconBg"
      >
        <UIcon
          :name="icon"
          class="w-5 h-5"
          :class="iconColor"
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number | string
  icon: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple'
  subtitle?: string
  suffix?: string
}>()

const displayValue = computed(() => {
  if (typeof props.value === 'number' && props.suffix) return `${props.value}${props.suffix}`
  return props.value
})

const colorMap = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', icon: 'text-blue-500' },
  green: { bg: 'bg-green-50 dark:bg-green-900/30', icon: 'text-green-500' },
  red: { bg: 'bg-red-50 dark:bg-red-900/30', icon: 'text-red-500' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', icon: 'text-yellow-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', icon: 'text-purple-500' },
}

const iconBg = computed(() => colorMap[props.color ?? 'blue'].bg)
const iconColor = computed(() => colorMap[props.color ?? 'blue'].icon)
</script>
