const cache = new Map<string, string>()

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null

/**
 * ECharts/zrender no parsea `oklch()` (Tailwind v4).
 * Convierte colores CSS modernos a hex vía canvas.
 */
export function toEchartsColor(color: string): string {
  if (!color || !color.includes('oklch'))
    return color

  const cached = cache.get(color)
  if (cached)
    return cached

  if (typeof document === 'undefined')
    return color

  if (!canvas || !ctx) {
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  }

  if (!ctx)
    return color

  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000000'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  const hex = `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
  cache.set(color, hex)
  return hex
}

export function normalizeEchartsOptionColors<T>(input: T): T {
  if (typeof input === 'string')
    return toEchartsColor(input) as T

  if (input == null || typeof input === 'function' || typeof input !== 'object')
    return input

  if (Array.isArray(input))
    return input.map(item => normalizeEchartsOptionColors(item)) as T

  // Dejar instancias (p.ej. echarts.graphic.LinearGradient) intactas
  if (Object.getPrototypeOf(input) !== Object.prototype)
    return input

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>))
    result[key] = normalizeEchartsOptionColors(value)

  return result as T
}
