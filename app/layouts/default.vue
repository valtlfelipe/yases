<template>
  <div class="min-h-screen bg-stone-50 dark:bg-stone-950 flex">
    <aside class="w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col fixed inset-y-0">
      <div class="px-6 py-6 border-b border-stone-200 dark:border-stone-800">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-stone-900 dark:bg-stone-100 flex items-center justify-center">
            <UIcon
              name="i-heroicons-paper-airplane"
              class="w-5 h-5 text-white dark:text-stone-900"
            />
          </div>
          <div>
            <h1 class="text-lg font-semibold text-stone-900 dark:text-stone-100 font-display">
              YASES
            </h1>
            <p class="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Yet another SES Wrapper
            </p>
          </div>
        </div>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1">
        <div
          v-for="item in nav"
          :key="item.to"
        >
          <NuxtLink
            v-if="!item.children?.length"
            :to="item.to"
            class="nav-item"
            :class="isActive(item.to) ? 'nav-item-active' : 'nav-item-inactive'"
          >
            <UIcon
              :name="item.icon"
              class="w-5 h-5 shrink-0"
            />
            <span>{{ item.label }}</span>
          </NuxtLink>

          <button
            v-else
            type="button"
            class="nav-item w-full"
            :class="isActive(item.to) ? 'nav-item-active' : 'nav-item-inactive'"
            :aria-expanded="isExpanded(item.to)"
            @click="toggleSection(item.to)"
          >
            <UIcon
              :name="item.icon"
              class="w-5 h-5 shrink-0"
            />
            <span class="flex-1 text-left">{{ item.label }}</span>
            <UIcon
              name="i-heroicons-chevron-right"
              class="w-4 h-4 shrink-0 transition-transform"
              :class="isExpanded(item.to) ? 'rotate-90' : ''"
            />
          </button>

          <div
            v-if="item.children?.length"
            v-show="isExpanded(item.to)"
            class="mt-1 ml-7 space-y-1 border-l border-stone-200 dark:border-stone-800 pl-3"
          >
            <NuxtLink
              v-for="child in item.children"
              :key="child.to"
              :to="child.to"
              class="block text-sm px-2 py-1.5 rounded-md transition-colors"
              :class="isExactActive(child.to)
                ? 'text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100/80 dark:hover:bg-stone-800/60'"
            >
              {{ child.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>

      <div class="px-4 py-4 border-t border-stone-200 dark:border-stone-800">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center shrink-0">
            <UIcon
              name="i-heroicons-user"
              class="w-4 h-4 text-stone-600 dark:text-stone-300"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
              {{ user?.name || 'User' }}
            </p>
            <p class="text-xs text-stone-500 dark:text-stone-400 truncate">
              {{ email }}
            </p>
          </div>
          <UTooltip
            text="Sign out"
            :popper="{ placement: 'top' }"
          >
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              @click="logout"
            >
              <UIcon
                name="i-heroicons-arrow-right-on-rectangle"
                class="w-4 h-4"
              />
            </button>
          </UTooltip>
        </div>
      </div>
    </aside>

    <div class="flex-1 ml-64 flex flex-col min-w-0">
      <main class="flex-1 p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { authClient } from '~/lib/auth.client'

const route = useRoute()
const { data: session } = await authClient.useSession(useFetch)
const user = computed(() => session.value?.user ?? null)

const email = computed(() => user.value?.email ?? '')

async function logout() {
  await authClient.signOut()
  await navigateTo('/login')
}

const nav = [
  { to: '/', label: 'Dashboard', icon: 'i-heroicons-squares-2x2' },
  { to: '/emails', label: 'Emails', icon: 'i-heroicons-envelope' },
  { to: '/suppressions', label: 'Suppressions', icon: 'i-heroicons-no-symbol' },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'i-heroicons-cog-6-tooth',
    children: [
      { to: '/settings', label: 'Overview' },
      { to: '/settings/api-keys', label: 'API Keys' },
      { to: '/settings/domains', label: 'Domains' },
      { to: '/settings/providers', label: 'Providers' },
    ],
  },
]

const expandedSections = ref<Record<string, boolean>>({
  '/settings': route.path.startsWith('/settings'),
})

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function isExactActive(path: string) {
  return route.path === path
}

function isExpanded(path: string) {
  return !!expandedSections.value[path]
}

function toggleSection(path: string) {
  expandedSections.value[path] = !expandedSections.value[path]
}

watch(() => route.path, (newPath) => {
  if (newPath.startsWith('/settings')) {
    expandedSections.value['/settings'] = true
  }
})
</script>
