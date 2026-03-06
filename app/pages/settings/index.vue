<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-display text-stone-900 dark:text-stone-100">
        Settings
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400">
        Manage domains, providers, and API keys.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="card-elevated p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100">
              {{ item.label }}
            </h2>
            <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {{ item.description }}
            </p>
          </div>
          <UIcon
            :name="item.icon"
            class="w-5 h-5 text-stone-500 dark:text-stone-400"
          />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const items = [
  {
    to: '/settings/domains',
    label: 'Domains',
    description: 'Manage your verified sending domains.',
    icon: 'i-heroicons-globe-alt',
  },
  {
    to: '/settings/providers',
    label: 'Providers',
    description: 'Configure SES, SendGrid, Mailgun, and more.',
    icon: 'i-heroicons-cloud',
  },
  {
    to: '/settings/api-keys',
    label: 'API Keys',
    description: 'Create and revoke API access keys.',
    icon: 'i-heroicons-key',
  },
]
</script>
