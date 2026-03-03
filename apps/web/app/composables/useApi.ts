export function useApi() {
  const config = useRuntimeConfig();
  return $fetch.create({
    baseURL: `${config.public.apiUrl}/dashboard`,
    credentials: "include",
  });
}
