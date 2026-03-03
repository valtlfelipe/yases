export default defineNuxtConfig({
  // future: {
  //   compatibilityVersion: 5,
  // },
  modules: ['@nuxt/ui'],
  compatibilityDate: '2026-03-03',
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    },
  },
  ssr: false,
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'YASES - Dashboard',
      meta: [
        { name: 'description', content: 'YASES - Yet another SES Wrapper dashboard' }
      ]
    }
  },
  ui: {
    global: true,
    icons: ['heroicons']
  }
})
