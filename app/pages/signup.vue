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
          Postlane
        </h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Create your admin account
        </p>
      </div>

      <div class="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
        <form
          class="space-y-4"
          @submit.prevent="submit"
        >
          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Name</label>
            <input
              v-model="name"
              type="text"
              placeholder="Your name"
              autocomplete="name"
              required
              class="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 focus:border-transparent transition-all"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="admin@example.com"
              autocomplete="email"
              required
              class="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 focus:border-transparent transition-all"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
              required
              minlength="8"
              class="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 focus:border-transparent transition-all"
            >
          </div>

          <div
            v-if="error"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <p class="text-sm text-red-700 dark:text-red-400">
              {{ error }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="pending"
            class="w-full py-2.5 px-4 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <UIcon
              v-if="pending"
              name="i-heroicons-arrow-path"
              class="w-4 h-4 animate-spin"
            />
            <span>{{ pending ? 'Creating account...' : 'Create account' }}</span>
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-stone-400 dark:text-stone-500 mt-6">
        Yet another SES Wrapper dashboard
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { authClient } from '~/lib/auth.client'

definePageMeta({ layout: false })

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    const { error: err } = await authClient.signUp.email({ name: name.value, email: email.value, password: password.value })
    if (err) throw new Error(err.message ?? 'Failed to create account.')
    await navigateTo('/')
  }
  catch (e: any) {
    error.value = e.message || 'Failed to create account.'
  }
  finally {
    pending.value = false
  }
}
</script>
