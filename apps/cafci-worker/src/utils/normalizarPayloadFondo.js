export function normalizarPayloadFondo(payload = {}) {
  const rendimientos = payload.rendimientos ?? payload.performance ?? {}
  const composicionCartera =
    payload.composicionCartera ?? payload.portfolioComposition ?? []
  const calificaciones = payload.calificaciones ?? payload.ratings ?? []
  const honorarios = payload.honorarios ?? payload.fees ?? {}
  const sociedades = payload.sociedades ?? payload.societies ?? []

  return {
    fondoId: payload.fondoId ?? payload.fundId ?? null,
    claseId: payload.claseId ?? payload.classId ?? null,
    slug: payload.slug ?? null,
    nombre: payload.nombre ?? payload.name ?? null,
    fecha: payload.fecha ?? payload.date ?? null,
    administradora: payload.administradora ?? payload.manager ?? null,
    depositaria: payload.depositaria ?? payload.depositary ?? null,
    tipoRenta: payload.tipoRenta ?? payload.incomeType ?? null,
    tipoDD: payload.tipoDD ?? payload.ddType ?? null,
    region: payload.region ?? null,
    benchmark: payload.benchmark ?? null,
    horizonte: payload.horizonte ?? payload.horizon ?? null,
    duracion: payload.duracion ?? payload.duration ?? null,
    moneda: payload.moneda ?? payload.currency ?? null,
    codigoCNV: payload.codigoCNV ?? payload.cnvCode ?? null,
    patrimonio: payload.patrimonio ?? payload.assetsUnderManagement ?? null,
    cantidadCuotapartes:
      payload.cantidadCuotapartes ?? payload.shareCount ?? null,
    inversionMinima:
      payload.inversionMinima ?? payload.minimumInvestment ?? null,
    monedaInversion:
      payload.monedaInversion ?? payload.investmentCurrency ?? null,
    plazoLiquidacionDias:
      payload.plazoLiquidacionDias ?? payload.settlementDays ?? null,
    rendimientos: {
      valorCuotaparte:
        rendimientos.valorCuotaparte ?? rendimientos.shareValue ?? null,
      variacionDiariaPct:
        rendimientos.variacionDiariaPct ??
        rendimientos.dailyVariationPct ??
        null,
      ultimos7Dias: rendimientos.ultimos7Dias ?? rendimientos.last7Days ?? null,
      unMes: rendimientos.unMes ?? rendimientos.oneMonth ?? null,
      noventaDias: rendimientos.noventaDias ?? rendimientos.ninetyDays ?? null,
      cientoOchentaDias:
        rendimientos.cientoOchentaDias ??
        rendimientos.oneHundredEightyDays ??
        null,
      enElAnio: rendimientos.enElAnio ?? rendimientos.yearToDate ?? null,
      doceMeses: rendimientos.doceMeses ?? rendimientos.twelveMonths ?? null,
    },
    composicionCartera: composicionCartera.map(item => ({
      nombre: item.nombre ?? item.name ?? null,
      porcentaje: item.porcentaje ?? item.percentage ?? null,
    })),
    calificaciones: calificaciones.map(item => ({
      calificadora: item.calificadora ?? item.agency ?? null,
      calificacion: item.calificacion ?? item.rating ?? null,
      fecha: item.fecha ?? item.date ?? null,
    })),
    honorarios: {
      honorarioGerente:
        honorarios.honorarioGerente ?? honorarios.managerFee ?? null,
      honorarioDepositaria:
        honorarios.honorarioDepositaria ?? honorarios.depositaryFee ?? null,
      comisionIngreso:
        honorarios.comisionIngreso ?? honorarios.entryFee ?? null,
      comisionEgreso: honorarios.comisionEgreso ?? honorarios.exitFee ?? null,
      comisionTransferencia:
        honorarios.comisionTransferencia ?? honorarios.transferFee ?? null,
      gastosOrdinariosGestion:
        honorarios.gastosOrdinariosGestion ??
        honorarios.managementExpenses ??
        null,
      comisionExito: honorarios.comisionExito ?? honorarios.successFee ?? null,
      otros: honorarios.otros ?? honorarios.otherFees ?? null,
    },
    sociedades: sociedades.map(item => ({
      tipo: item.tipo ?? item.type ?? null,
      nombre: item.nombre ?? item.name ?? null,
      logo: item.logo ?? item.logoUrl ?? null,
    })),
  }
}
