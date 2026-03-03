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
  ui: {
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    },
  },
  compatibilityDate: '2026-03-03',

  eslint: {
    config: {
      stylistic: true,
    },
  },
})
