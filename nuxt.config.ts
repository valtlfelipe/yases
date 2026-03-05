export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  ssr: true,
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'YASES - Dashboard',
      meta: [
        { name: 'description', content: 'YASES - Yet another SES Wrapper dashboard' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-03-03',
  nitro: { preset: 'bun' },
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
