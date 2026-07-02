export const useApi = () => {
  const baseUrl = 'https://api.argentinadatos.com'

  function get(url: string) {
    return fetch(`${baseUrl}/v1${url}`).then(res => res.json())
  }

  async function getDiputados() {
    const legislaturas = await get('/diputados/diputados')
    const shards = await Promise.all(
      legislaturas.map((legislatura: number) =>
        get(`/diputados/diputados/${legislatura}`),
      ),
    )

    return shards.flat()
  }

  return {
    get,
    getDiputados,
  }
}
