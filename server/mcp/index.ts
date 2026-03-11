declare module 'h3' {
  interface H3EventContext {
    user?: { id: string }
  }
}

export default defineMcpHandler({
  middleware: async (event) => {
    const session = await requireApiAuth(event)
    if (session) {
      event.context.user = session.user
    }
  },
})
