export function redondearTasa(valor, precision = 4) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return null
  }

  return Number(Number(valor).toFixed(precision))
}

export function porcentajeADecimal(valor, precision = 4) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return null
  }

  return redondearTasa(Number(valor) / 100, precision)
}

export function calcularTeaDesdeTna(tna, precision = 4) {
  if (tna === null || tna === undefined || Number.isNaN(Number(tna))) {
    return null
  }

  return redondearTasa((1 + Number(tna) / 365) ** 365 - 1, precision)
}
