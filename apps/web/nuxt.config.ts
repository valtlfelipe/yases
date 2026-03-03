export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3000',
    },
  },
  ssr: false,
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'YASES - Dashboard',
      meta: [
        { name: 'description', content: 'YASES - Email service dashboard' }
      ]
    }
  },
  ui: {
    global: true,
    icons: ['heroicons']
  }
})
