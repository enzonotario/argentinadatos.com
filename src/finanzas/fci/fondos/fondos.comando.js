import {
  guardarDetalleFondo,
  guardarListaFondos,
} from '@/finanzas/fci/fondos/guardado/guardarDetallesFondos.js'
import { FciFondosDatabaseService } from '@/finanzas/fci/fondos/database/service.js'
import { logError, logGrupo, logMensaje } from '@/log.js'

export default async function fondosComando() {
  const log = logGrupo({
    comando: 'fciFondos',
    fuente: 'sqlite',
  })

  try {
    const db = new FciFondosDatabaseService()
    const snapshot = db.obtenerSnapshotActual()

    if (!snapshot || snapshot.fondos.length === 0) {
      logMensaje(log, 'No se encontraron fondos detallados en SQLite', {
        dbPath: db.dbPath,
      })
      return false
    }

    const fondos = [...snapshot.fondos].sort((a, b) =>
      (a.name || a.nombre || '').localeCompare(b.name || b.nombre || '', 'es'),
    )

    for (const fondo of fondos) {
      guardarDetalleFondo(adaptarFondoParaApi(fondo))
    }

    await guardarListaFondos({
      fechaActualizacion: snapshot.fechaActualizacion,
      fondos: fondos.map(adaptarFondoParaApi),
    })

    logMensaje(log, 'Fondos detallados generados desde SQLite', {
      cantidad: fondos.length,
      fechaActualizacion: snapshot.fechaActualizacion,
    })

    return true
  } catch (error) {
    logError(log, error)
    return false
  }
}

function adaptarFondoParaApi(fondo) {
  return {
    fondoId: fondo.fundId ?? fondo.fondoId,
    claseId: fondo.classId ?? fondo.claseId,
    slug: fondo.slug,
    nombre: fondo.name ?? fondo.nombre ?? null,
    fecha: fondo.date ?? fondo.fecha ?? null,
    administradora: fondo.manager ?? fondo.administradora ?? null,
    depositaria: fondo.depositary ?? fondo.depositaria ?? null,
    tipoRenta: fondo.incomeType ?? fondo.tipoRenta ?? null,
    tipoDD: fondo.ddType ?? fondo.tipoDD ?? null,
    region: fondo.region ?? null,
    benchmark: fondo.benchmark ?? null,
    horizonte: fondo.horizon ?? fondo.horizonte ?? null,
    duration: fondo.duration ?? null,
    moneda: fondo.currency ?? fondo.moneda ?? null,
    codigoCNV: fondo.cnvCode ?? fondo.codigoCNV ?? null,
    patrimonio: fondo.assetsUnderManagement ?? fondo.patrimonio ?? null,
    inversionMinima: fondo.minimumInvestment ?? fondo.inversionMinima ?? null,
    monedaInversion: fondo.investmentCurrency ?? fondo.monedaInversion ?? null,
    plazoLiquidacionDias:
      fondo.settlementDays ?? fondo.plazoLiquidacionDias ?? null,
    rendimientos: adaptarRendimientos(
      fondo.performance ?? fondo.rendimientos ?? {},
    ),
    composicionCartera: adaptarComposicion(
      fondo.portfolioComposition ?? fondo.composicionCartera ?? [],
    ),
    calificaciones: adaptarCalificaciones(
      fondo.ratings ?? fondo.calificaciones ?? [],
    ),
    honorarios: adaptarHonorarios(fondo.fees ?? fondo.honorarios ?? {}),
    sociedades: adaptarSociedades(fondo.societies ?? fondo.sociedades ?? []),
  }
}

function adaptarRendimientos(rendimientos) {
  return {
    valorCuotaparte:
      rendimientos.shareValue ?? rendimientos.valorCuotaparte ?? null,
    ultimos7Dias: rendimientos.last7Days ?? rendimientos.ultimos7Dias ?? null,
    unMes: rendimientos.oneMonth ?? rendimientos.unMes ?? null,
    noventaDias: rendimientos.ninetyDays ?? rendimientos.noventaDias ?? null,
    cientoOchentaDias:
      rendimientos.oneHundredEightyDays ??
      rendimientos.cientoOchentaDias ??
      null,
    enElAnio: rendimientos.yearToDate ?? rendimientos.enElAnio ?? null,
    doceMeses: rendimientos.twelveMonths ?? rendimientos.doceMeses ?? null,
  }
}

function adaptarComposicion(items) {
  return items.map(item => ({
    nombre: item.name ?? item.nombre ?? null,
    porcentaje: item.percentage ?? item.porcentaje ?? null,
  }))
}

function adaptarCalificaciones(items) {
  return items.map(item => ({
    calificadora: item.agency ?? item.calificadora ?? null,
    calificacion: item.rating ?? item.calificacion ?? null,
    fecha: item.date ?? item.fecha ?? null,
  }))
}

function adaptarHonorarios(honorarios) {
  return {
    honorarioGerente:
      honorarios.managerFee ?? honorarios.honorarioGerente ?? null,
    honorarioDepositaria:
      honorarios.depositaryFee ?? honorarios.honorarioDepositaria ?? null,
    comisionIngreso: honorarios.entryFee ?? honorarios.comisionIngreso ?? null,
    comisionEgreso: honorarios.exitFee ?? honorarios.comisionEgreso ?? null,
    comisionTransferencia:
      honorarios.transferFee ?? honorarios.comisionTransferencia ?? null,
    gastosOrdinariosGestion:
      honorarios.managementExpenses ??
      honorarios.gastosOrdinariosGestion ??
      null,
    comisionExito: honorarios.successFee ?? honorarios.comisionExito ?? null,
    otros: honorarios.otherFees ?? honorarios.otros ?? null,
  }
}

function adaptarSociedades(items) {
  return items.map(item => ({
    tipo: item.type ?? item.tipo ?? null,
    nombre: item.name ?? item.nombre ?? null,
    logo: item.logoUrl ?? item.logo ?? null,
  }))
}
