import { authClient } from '../lib/auth.client'

const publicRoutes = ['/login', '/signup']

export default defineNuxtRouteMiddleware(async (to, _from) => {
  if (publicRoutes.some(route => to.path.startsWith(route))) {
    return
  }

  const { data: session } = await authClient.useSession(useFetch)

  if (!session.value) {
    return navigateTo('/login')
  }
})
