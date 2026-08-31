import {
  PRIVATE_RULES,
  jsonField,
  numberField,
  textField,
} from './fields.js'

export const DIPUTADOS_COLLECTION = {
  name: 'diputados',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    textField('diputadoId', { required: true }),
    textField('nombre', { required: true }),
    textField('apellido'),
    textField('genero'),
    textField('provincia'),
    textField('periodoMandatoInicio', { required: true }),
    textField('periodoMandatoFin'),
    textField('juramentoFecha'),
    textField('ceseFecha'),
    textField('bloque'),
    textField('periodoBloqueInicio'),
    textField('periodoBloqueFin'),
    textField('foto'),
    jsonField('data', { required: true }),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_diputados_id_periodo ON diputados (diputadoId, periodoMandatoInicio)',
  ],
}

export const DIPUTADOS_ACTAS_COLLECTION = {
  name: 'diputados_actas',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    numberField('actaId', { required: true, onlyInt: true }),
    numberField('anio', { required: true, onlyInt: true }),
    textField('periodo'),
    textField('reunion'),
    textField('numeroActa'),
    textField('titulo'),
    textField('resultado'),
    textField('fecha'),
    textField('presidente'),
    numberField('votosAfirmativos', { onlyInt: true }),
    numberField('votosNegativos', { onlyInt: true }),
    numberField('abstenciones', { onlyInt: true }),
    numberField('ausentes', { onlyInt: true }),
    jsonField('data', { required: true }),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_diputados_actas_id_anio ON diputados_actas (actaId, anio)',
  ],
}

export const SENADORES_COLLECTION = {
  name: 'senadores',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    numberField('senadorId', { required: true, onlyInt: true }),
    textField('nombre', { required: true }),
    textField('provincia'),
    textField('partido'),
    textField('periodoLegalInicio', { required: true }),
    textField('periodoLegalFin'),
    textField('periodoRealInicio'),
    textField('periodoRealFin'),
    textField('reemplazo'),
    textField('observaciones'),
    textField('foto'),
    textField('email'),
    textField('telefono'),
    textField('redes'),
    jsonField('data', { required: true }),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_senadores_id_periodo ON senadores (senadorId, periodoLegalInicio)',
  ],
}

export const SENADO_ACTAS_COLLECTION = {
  name: 'senado_actas',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    numberField('actaId', { required: true, onlyInt: true }),
    numberField('anio', { required: true, onlyInt: true }),
    textField('titulo'),
    textField('fecha'),
    numberField('votosAfirmativos', { onlyInt: true }),
    numberField('votosNegativos', { onlyInt: true }),
    numberField('abstenciones', { onlyInt: true }),
    numberField('ausentes', { onlyInt: true }),
    textField('presidente'),
    jsonField('data', { required: true }),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_senado_actas_id_anio ON senado_actas (actaId, anio)',
  ],
}
