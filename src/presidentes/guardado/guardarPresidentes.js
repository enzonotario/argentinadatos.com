import { escribirRuta } from '@/utils/rutas.js'

export function guardarPresidentes(presidentes) {
  return escribirRuta('/presidentes', presidentes)
}
