import pino from 'pino'

const transports = pino.transport({
  targets: [
    {
      target: 'pino-axiom',
      options: {
        orgId: import.meta.env.VITE_AXIOM_ORG_ID,
        token: import.meta.env.VITE_AXIOM_TOKEN,
        dataset: import.meta.env.VITE_AXIOM_DATASET,
      },
    },
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
      },
    },
  ],
})

const logger = pino(transports)

const traceId =
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15)

export function logGrupo(grupo) {
  return logger.child({
    traceId,
    ...grupo,
  })
}

export function logError(grupo, error) {
  grupo.error({
    msg: 'Error',
    errorMessage: error.message,
    errorName: error.name,
    errorStack: error.stack,
    errorType: error.constructor ? error.constructor.nombre : 'Desconocido',
  })
}

export function logMensaje(grupo, mensaje, extra = {}) {
  grupo.info({
    msg: mensaje,
    ...extra,
  })
}
