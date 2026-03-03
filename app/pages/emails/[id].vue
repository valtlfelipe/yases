<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink
        to="/emails"
        class="inline-flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
      >
        <UIcon
          name="i-heroicons-arrow-left"
          class="w-4 h-4"
        />
        Back to emails
      </NuxtLink>
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
      color="red"
      variant="soft"
      title="Failed to load email"
      :description="String(error)"
    />

    <template v-else-if="email">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-display text-stone-900 dark:text-stone-100">
            {{ email.subject }}
          </h1>
          <p class="mt-1 text-sm text-stone-500 dark:text-stone-400 font-mono">
            ID: {{ email.id }}
          </p>
        </div>
        <StatusBadge :status="email.status" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card-elevated p-6">
          <h3 class="text-lg font-display text-stone-900 dark:text-stone-100 mb-4">
            Details
          </h3>
          <dl class="space-y-4">
            <div class="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800">
              <dt class="text-sm text-stone-500 dark:text-stone-400">
                To
              </dt>
              <dd class="text-sm text-stone-900 dark:text-stone-100 font-mono">
                {{ email.to }}
              </dd>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800">
              <dt class="text-sm text-stone-500 dark:text-stone-400">
                From
              </dt>
              <dd class="text-sm text-stone-900 dark:text-stone-100 font-mono">
                {{ email.from }}
              </dd>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800">
              <dt class="text-sm text-stone-500 dark:text-stone-400">
                Queued
              </dt>
              <dd class="text-sm text-stone-600 dark:text-stone-300">
                {{ formatDate(email.createdAt) }}
              </dd>
            </div>
            <div
              v-if="email.sentAt"
              class="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800"
            >
              <dt class="text-sm text-stone-500 dark:text-stone-400">
                Sent
              </dt>
              <dd class="text-sm text-stone-600 dark:text-stone-300">
                {{ formatDate(email.sentAt) }}
              </dd>
            </div>
            <div
              v-if="email.deliveredAt"
              class="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800"
            >
              <dt class="text-sm text-stone-500 dark:text-stone-400">
                Delivered
              </dt>
              <dd class="text-sm text-stone-600 dark:text-stone-300">
                {{ formatDate(email.deliveredAt) }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="card-elevated p-6">
          <h3 class="text-lg font-display text-stone-900 dark:text-stone-100 mb-4">
            Timeline
          </h3>
          <EmailTimeline :timeline="email.timeline" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
const { email, pending, error } = useEmail(id)

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
