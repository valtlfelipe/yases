<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-900 dark:bg-stone-100 mb-4">
          <UIcon
            name="i-heroicons-paper-airplane"
            class="w-7 h-7 text-white dark:text-stone-900 -rotate-45"
          />
        </div>
        <h1 class="text-2xl font-semibold text-stone-900 dark:text-stone-100">
          YASES
        </h1>
      </div>

      <div class="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-8 shadow-sm text-center">
        <!-- Loading -->
        <template v-if="status === 'pending'">
          <UIcon
            name="i-heroicons-arrow-path"
            class="w-8 h-8 text-stone-400 animate-spin mx-auto mb-4"
          />
          <p class="text-stone-600 dark:text-stone-400">
            Processing your request...
          </p>
        </template>

        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <UIcon
              name="i-heroicons-check"
              class="w-6 h-6 text-green-600 dark:text-green-400"
            />
          </div>
          <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
            You've been unsubscribed
          </h2>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            <span class="font-medium text-stone-700 dark:text-stone-300">{{ email }}</span>
            will no longer receive marketing emails.
          </p>
        </template>

        <!-- Error: already unsubscribed or invalid token -->
        <template v-else-if="status === 'error'">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <UIcon
              name="i-heroicons-x-mark"
              class="w-6 h-6 text-red-600 dark:text-red-400"
            />
          </div>
          <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
            Invalid link
          </h2>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            This unsubscribe link is invalid or has expired. Please use the link from a recent email.
          </p>
        </template>

        <!-- No token -->
        <template v-else>
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 mb-4">
            <UIcon
              name="i-heroicons-question-mark-circle"
              class="w-6 h-6 text-stone-500 dark:text-stone-400"
            />
          </div>
          <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
            Missing link
          </h2>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            No unsubscribe token was provided. Please use the link from your email.
          </p>
        </template>
      </div>

      <p class="text-center text-xs text-stone-400 dark:text-stone-500 mt-6">
        Yet another SES Wrapper
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const config = useRuntimeConfig()

const token = route.query.token as string | undefined
const status = ref<'idle' | 'pending' | 'success' | 'error'>(token ? 'pending' : 'idle')
const email = ref('')

onMounted(async () => {
  if (!token) return

  try {
    const data = await $fetch<{ success: boolean, email: string }>('/api/unsubscribe', {
      baseURL: config.public.apiUrl,
      params: { token },
    })
    email.value = data.email
    status.value = 'success'
  }
  catch {
    status.value = 'error'
  }
})
</script>
