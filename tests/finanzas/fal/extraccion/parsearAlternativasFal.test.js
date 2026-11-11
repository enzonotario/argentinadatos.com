import { describe, expect, it } from 'vitest'
import { parsearAdcapFal } from '@/finanzas/fal/extraccion/extraerAdcapFal.js'
import { parsearBalanzFal } from '@/finanzas/fal/extraccion/extraerBalanzFal.js'
import { parsearBbvaFal } from '@/finanzas/fal/extraccion/extraerBbvaFal.js'
import { parsearCocosFal } from '@/finanzas/fal/extraccion/extraerCocosFal.js'
import { parsearGaliciaFal } from '@/finanzas/fal/extraccion/extraerGaliciaFal.js'
import { parsearGstFal } from '@/finanzas/fal/extraccion/extraerGstFal.js'
import { parsearBnaFal } from '@/finanzas/fal/extraccion/extraerBnaFal.js'
import { parsearIebFal } from '@/finanzas/fal/extraccion/extraerIebFal.js'
import { textoPlano } from '@/finanzas/fal/extraccion/fetchTextoFal.js'
import { parsearMacroFal } from '@/finanzas/fal/extraccion/extraerMacroFal.js'
import { parsearMarivaFal } from '@/finanzas/fal/extraccion/extraerMarivaFal.js'
import { parsearMaxFal } from '@/finanzas/fal/extraccion/extraerMaxFal.js'
import { parsearSantanderFal } from '@/finanzas/fal/extraccion/extraerSantanderFal.js'
import { parsearWiseFal } from '@/finanzas/fal/extraccion/extraerWiseFal.js'

describe('parsear alternativas FAL', () => {
  it('arma los dos fondos de BBVA con comisión 0 hasta fin de 2027', () => {
    const filas = parsearBbvaFal(`
      0% de comisión de administración para tu Fondo FAL.
      FAL I Pensada para el resguardo a Corto Plazo. Vida promedio: entre 1 y 3 meses.
      FAL II protección frente a la inflación. Vida promedio: entre los 6 y los 12 meses.
      En BBVA, el FAL no tendrá comisión (0%) hasta fin de 2027.
      El FAL se instrumenta a través de un Fondo Común de Inversión Abierto.
      BBVA Asset Management Argentina.
      Entrará en vigencia el 1° de diciembre de 2026.
      ID FAL directamente desde Web BBVA Empresas.
      Recibirá el reintegro del 100% del aporte FAL.
    `)

    expect(filas).toHaveLength(2)
    expect(filas.map(fila => fila.plan)).toEqual(['fal-i', 'fal-ii'])
    expect(filas[0]).toMatchObject({
      entidad: 'bbva',
      comisionAnual: 0,
      comisionVigenciaHasta: '2027-12-31',
      comisionPosteriorAnual: null,
      horizonte: 'corto_plazo',
      vidaPromedioMesesMin: 1,
      vidaPromedioMesesMax: 3,
      vehiculo: 'fci_abierto',
      reintegroAportes: true,
      vigenciaDeclarada: '2026-12-01',
    })
    expect(filas[1].horizonte).toBe('inflacion')
  })

  it('no publica 0% de BBVA si la página deja de decirlo', () => {
    expect(
      parsearBbvaFal(
        'FAL I entre 1 y 3 meses. FAL II entre los 6 y los 12 meses.',
      ),
    ).toEqual([])
  })

  it('arma los tres honorarios de Wise Capital', () => {
    const filas = parsearWiseFal(`
      0% anual de costo total por administración del Fondo Wise Capital FAL.
      También habrá dos alícuotas adicionales, una con honorario en 0,8% y otra en 1% anual.
      Honorario hasta diciembre de 2027 para todos los clientes.
      Devolución del Aporte.
      duración de portfolio que va a moverse entre 6 y 18 meses.
      A partir del 1° de noviembre de 2026.
    `)

    expect(filas.map(fila => fila.comisionPosteriorAnual)).toEqual([
      0, 0.008, 0.01,
    ])
    expect(filas.every(fila => fila.comisionAnual === 0)).toBe(true)
    expect(
      filas.every(
        fila => fila.incluyeIva === true && fila.ivaAdicional === false,
      ),
    ).toBe(true)
    expect(filas[1].comisionVigenciaHasta).toBe('2027-12-31')
    expect(filas[0].comisionPosteriorAnual).toBe(0)
  })

  it('separa los dos Superfondos de Santander sin inventar comisión', () => {
    const filas = parsearSantanderFal(`
      SUPERFONDO RESERVA FAL. Prioriza la liquidez, rendimiento competitivo de corto plazo.
      SUPERFONDO RESERVA PLUS FAL. Deuda soberana ajustada por CER.
      Calificación AAAf.ar. Fondos Comunes de Inversión.
      Online Banking Empresas. 1 de diciembre de 2026.
    `)

    expect(filas).toHaveLength(2)
    expect(filas.every(fila => fila.comisionAnual === null)).toBe(true)
    expect(filas[0].horizonte).toBe('corto_plazo')
    expect(filas[1].horizonte).toBe('inflacion')
    expect(filas[0].metadata.calificacion).toMatch(/AAAf/)
  })

  it('no copia el tope legal de Balanz como comisión propia', () => {
    const [fila] = parsearBalanzFal(`
      Abrí tu cuenta FAL. Un asesor Balanz te contacta.
      Balanz Sociedad Gerente de Fondos Comunes de Inversión S.A.U.
      La ley establece un tope del 1% de comisión anual.
      Vigencia: 1° de diciembre de 2026.
    `)

    expect(fila.comisionAnual).toBeNull()
    expect(fila.comisionEsTope).toBe(false)
    expect(fila.metadata.topeLegalAnual).toBe(0.01)
    expect(fila.sociedadGerente).toMatch(/Balanz Sociedad Gerente/)
  })

  it('distingue el tope legal de Macro de un precio publicado', () => {
    const [fila] = parsearMacroFal(`
      Fondo de Asistencia Laboral. Macro Fondos y Banco Macro.
      Banca Internet Empresas.
      La apertura y el alta en Banco Macro no tienen costo.
      La legislación vigente establece una comisión anual de gestión máxima del 1% sobre los saldos administrados.
      El Decreto prorrogó la fecha de entrada en vigencia al 1 de diciembre de 2026.
    `)

    expect(fila.comisionAnual).toBeNull()
    expect(fila.metadata.aperturaSinCosto).toBe(true)
    expect(fila.metadata.topeLegalAnual).toBe(0.01)
    expect(fila.vigenciaDeclarada).toBe('2026-12-01')
  })

  it('identifica gestora y depositaria de Mariva sin comisión', () => {
    const [fila] = parsearMarivaFal(`
      Fondo de Asistencia Laboral. Mariva Asset Management.
      Banco Mariva es la sociedad depositaria.
      Escribinos por WhatsApp.
      Su vigencia fue diferida al 1° de noviembre de 2026.
      Los gastos, comisiones, honorarios estarán a disposición en las oficinas.
    `)

    expect(fila.sociedadDepositaria).toBe('Banco Mariva S.A.')
    expect(fila.comisionAnual).toBeNull()
    expect(fila.vehiculo).toBe('fci_abierto')
  })

  it('toma el FCI de IEB sin inventar honorario', () => {
    const [fila] = parsearIebFal(`
      Fondo de Asistencia Laboral. IEB lo gestiona.
      a través de un Fondo Común de Inversión.
      La fecha de entrada en vigencia es el 1° de noviembre de 2026.
      Por WhatsApp o completando el formulario.
    `)

    expect(fila).toMatchObject({
      entidad: 'ieb',
      vehiculo: 'fci_abierto',
      comisionAnual: null,
      vigenciaDeclarada: '2026-11-01',
      canal: 'formulario',
    })
  })

  it('lee el vehículo de IEB cuando el texto está en JSON-LD', () => {
    const html =
      '<script type="application/ld+json">{"description":"Fondo Común de Inversión. Fondo de Asistencia Laboral. noviembre de 2026."}</script> IEB'
    const [fila] = parsearIebFal(textoPlano(html))

    expect(fila.vehiculo).toBe('fci_abierto')
    expect(fila.comisionAnual).toBeNull()
  })

  it('no usa el ejemplo de tasa del FAQ de Max como comisión', () => {
    const [fila] = parsearMaxFal(`
      Fondo de Asistencia Laboral (FAL). Max Capital Asset Management.
      familia integral de Fondos Comunes de Inversión.
      El régimen entraría en vigencia el 01/12/2026.
      Dejanos tus datos.
      Ejemplo de referencia: Tasa ~5% + CER.
    `)

    expect(fila.comisionAnual).toBeNull()
    expect(fila.vigenciaDeclarada).toBe('2026-12-01')
    expect(fila.sociedadGerente).toBe('Max Capital Asset Management')
  })

  it('no convierte Comisión Nacional de Cocos en un arancel', () => {
    const [fila] = parsearCocosFal(`
      Fondos de Asistencia Laboral. Cocos Asset Management.
      Gestionado por entidades habilitadas por la Comisión Nacional de Valores.
      La información contenida en esta página es preliminar.
    `)

    expect(fila.comisionAnual).toBeNull()
    expect(fila.metadata.preliminar).toBe(true)
  })

  it('deja la comisión de Galicia en null cuando el PDF dice que está en definición', () => {
    const [fila] = parsearGaliciaFal(`
      Fondo de Asistencia Laboral. Galicia Asset Management S.A.U.
      Banco de Galicia y Buenos Aires S.A.
      Tope de honorarios 1%.
      El % puntual de Galicia está en definición.
      App Galicia Empresas y Office Banking.
      Fondos Fima AA PIC FCI.
    `)

    expect(fila.comisionAnual).toBeNull()
    expect(fila.metadata.comisionEnDefinicion).toBe(true)
    expect(fila.metadata.topeLegalAnual).toBe(0.01)
    expect(fila.sociedadDepositaria).toMatch(/Banco de Galicia/)
  })

  it('arma los tres FAL de Grupo ST sin tomar el aporte legal como comisión', () => {
    const filas = parsearGstFal(`
      GST Grupo ST. El presente FAL se instrumentará a través de un Fondo Común de Inversión,
      con Mega QM S.A. como sociedad gerente y Banco de Servicios y Transacciones S.A.U. como sociedad depositaria.
      Sin costo adicional. Grandes empresas: 1% mínimo.
      1 Dic 26. El FAL entra en vigencia.
      MEGAQM ASISTENCIA FCIA FAL. FAL – TAMAR. preservar liquidez y capturar tasa con baja duration.
      MEGAQM COBERTURA FCIA FAL. FAL – CER. ajuste inflación. horizonte medio.
      Fondo de Asistencia Laboral dedicado. Ad hoc TEA proyectada.
      Contactanos.
    `)

    expect(filas.map(fila => fila.plan)).toEqual([
      'asistencia-tamar',
      'cobertura-cer',
      'dedicado',
    ])
    expect(filas.every(fila => fila.comisionAnual == null)).toBe(true)
    expect(filas[0]).toMatchObject({
      entidad: 'gst',
      nombreComercial: 'Grupo ST',
      vehiculo: 'fci_abierto',
      sociedadGerente: 'Mega QM S.A.',
      sociedadDepositaria: 'Banco de Servicios y Transacciones S.A.U.',
      horizonte: 'corto_plazo',
      vigenciaDeclarada: '2026-12-01',
      canal: 'formulario',
    })
    expect(filas[1].horizonte).toBe('inflacion')
    expect(filas[2].horizonte).toBeNull()
  })

  it('arma el FAL de Adcap sin inventar comisión ni nombre de fondo', () => {
    const [fila] = parsearAdcapFal(`
      Fondo de Asistencia Laboral. FAL para empresas.
      Adcap Asset Management Sociedad Gerente de Fondos Comunes de Inversión S.A.
      Estructuración integral del vehículo FAL.
      Fondos Comunes de Inversión.
      Obligatorio desde el 1º de diciembre de 2026.
      Gestioná tu ID FAL.
    `)

    expect(fila).toMatchObject({
      entidad: 'adcap',
      nombreComercial: 'Adcap',
      vehiculo: 'fci_abierto',
      sociedadGerente:
        'Adcap Asset Management Sociedad Gerente de Fondos Comunes de Inversión S.A.',
      comisionAnual: null,
      vigenciaDeclarada: '2026-12-01',
      canal: 'web',
      enlace: 'https://asset.ad-cap.com.ar/fal',
    })
    expect(fila.nombrePlan).toBeNull()
  })

  it('no publica Adcap si falta la oferta FAL', () => {
    expect(parsearAdcapFal('Adcap Asset Management. Fondos Comunes de Inversión.')).toEqual(
      [],
    )
  })

  it('arma los tres FAL del BNA sin convertir el reintegro en una comisión 0', () => {
    const filas = parsearBnaFal(`
      Elegí al BNA. Quiero que me contacten.
      Reintegro del 100% de la comisión de administración hasta el 31/12/2027.
      El reintegro es de una suma equivalente a la comisión percibida por Pellegrini FCI S.A.
      FAL Ahorro. Fondo multiempleador de corto plazo, con foco en liquidez.
      FAL Crecimiento. Horizonte mediano/largo, con exposición a CER.
      Fondo exclusivo. Solución para grandes empresas, con cartera personalizada.
      El régimen comienza a aplicarse el 1° de noviembre de 2026.
      El aporte es del 1% para grandes empresas y del 2,5% para PyMEs.
      Sin costo adicional.
    `)

    expect(filas.map(fila => fila.plan)).toEqual([
      'ahorro',
      'crecimiento',
      'exclusivo',
    ])
    expect(filas.every(fila => fila.comisionAnual == null)).toBe(true)
    expect(filas.every(fila => fila.reintegroAportes == null)).toBe(true)
    expect(filas[0]).toMatchObject({
      entidad: 'bna',
      nombreComercial: 'BNA',
      sociedadGerente: 'Pellegrini FCI S.A.',
      horizonte: 'corto_plazo',
      vigenciaDeclarada: '2026-11-01',
      canal: 'formulario',
    })
    expect(filas[0].metadata.reintegroComisionHasta).toBe('2027-12-31')
    expect(filas[1].horizonte).toBe('inflacion')
    expect(filas[2].horizonte).toBeNull()
  })
})
