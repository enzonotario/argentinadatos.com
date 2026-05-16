export function ordenarPorFecha(data) {
  return data.sort((a, b) => {
    return new Date(a.fecha) - new Date(b.fecha)
  })
}
