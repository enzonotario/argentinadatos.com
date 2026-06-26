export async function deployComparatasas() {
  const url = import.meta.env.VITE_COMPARATASAS_DEPLOY_HOOK_URL

  if (!url) {
    throw new Error('Falta VITE_COMPARATASAS_DEPLOY_HOOK_URL')
  }

  const response = await fetch(url, { method: 'POST', body: '' })
  const body = await response.text()

  if (!response.ok) {
    throw new Error(
      `Error al disparar deploy de ComparaTasas (${response.status}): ${body}`,
    )
  }

  console.log('Deploy de ComparaTasas disparado')
  console.log(body)
}

export default deployComparatasas
