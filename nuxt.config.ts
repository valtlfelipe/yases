export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/mcp-toolkit'],
  ssr: true,
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'YASES - Dashboard',
      meta: [
        { name: 'description', content: 'YASES - Yet another SES Wrapper dashboard' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-03-03',
  nitro: { 
    preset: 'bun',
    experimental: {
      asyncContext: true,
    },
  },
  mcp: {
    name: 'YASES Email',
    route: '/api/mcp',
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
