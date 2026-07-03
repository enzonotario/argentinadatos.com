export const useApi = () => {
  const baseUrl = 'https://api.argentinadatos.com'

  function get(url: string) {
    return fetch(`${baseUrl}/v1${url}`).then(res => res.json())
  }

  return {
    get,
  }
}
