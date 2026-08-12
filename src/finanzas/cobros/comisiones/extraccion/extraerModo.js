import {
  crearComisionCobro,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const MODO_COMERCIOS_URL = 'https://www.modo.com.ar/comercios'

/**
 * MODO no cobra comisión propia: el comercio paga la del adquirente.
 * @returns {Array<object>}
 */
export function parsearModo() {
  return [
    crearComisionCobro({
      entidad: 'modo',
      nombreComercial: 'MODO',
      producto: 'QR interoperable',
      canal: 'qr',
      medioPago: 'qr_cuenta',
      arancel: 0,
      arancelEsTope: false,
      incluyeIva: false,
      ivaAdicional: false,
      acreditacionTipo: 'desconocida',
      acreditacionPlazoHabiles: null,
      acreditacionLabel: 'Según adquirente',
      condiciones:
        'MODO no cobra comisión propia; pagás la del adquirente (Getnet, PosNet, Payway, etc.).',
      enlace: MODO_COMERCIOS_URL,
      metadata: {
        fuenteUrl: MODO_COMERCIOS_URL,
        nota: 'Fila informativa: el arancel efectivo depende del adquirente vinculado.',
      },
    }),
  ]
}

export async function extraerModo() {
  return parsearModo()
}
