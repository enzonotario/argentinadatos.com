import { PRIVATE_RULES, dateField, numberField, textField } from './fields.js'

export const LETRAS_COLLECTION = {
  name: 'letras',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    textField('ticker', { required: true }),
    textField('fechaEmision'),
    textField('fechaVencimiento', { required: true }),
    numberField('tem'),
    numberField('vpv', { required: true }),
    dateField('fechaActualizacion', { required: true }),
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_letras_ticker ON letras (ticker)',
    'CREATE INDEX idx_letras_fechaVencimiento ON letras (fechaVencimiento)',
  ],
}

export const CRIPTOPESOS_COLLECTION = {
  name: 'criptopesos',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    textField('token', { required: true }),
    textField('entidad', { required: true }),
    // required:false — PocketBase trata 0 como blank en number required
    numberField('tna'),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE INDEX idx_criptopesos_token ON criptopesos (token)',
    'CREATE INDEX idx_criptopesos_entidad ON criptopesos (entidad)',
    'CREATE INDEX idx_criptopesos_timestamp ON criptopesos (timestamp)',
    'CREATE INDEX idx_criptopesos_token_entidad ON criptopesos (token, entidad)',
  ],
}

export const CUENTAS_REMUNERADAS_USD_COLLECTION = {
  name: 'cuentas_remuneradas_usd',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    textField('entidad', { required: true }),
    numberField('tasa'),
    numberField('tope'),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE INDEX idx_cuentas_rem_usd_entidad ON cuentas_remuneradas_usd (entidad)',
    'CREATE INDEX idx_cuentas_rem_usd_timestamp ON cuentas_remuneradas_usd (timestamp)',
  ],
}

export const FCI_OTROS_COLLECTION = {
  name: 'fci_otros',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    textField('fondo', { required: true }),
    numberField('tna'),
    numberField('tea'),
    numberField('tope'),
    textField('fecha', { required: true }),
    textField('condiciones'),
    textField('condicionesCorto'),
    numberField('plazoMinDias', { onlyInt: true }),
    numberField('plazoMaxDias', { onlyInt: true }),
    textField('timestamp', { required: true }),
  ],
  indexes: [
    'CREATE INDEX idx_fci_otros_fondo ON fci_otros (fondo)',
    'CREATE INDEX idx_fci_otros_fecha ON fci_otros (fecha)',
    'CREATE INDEX idx_fci_otros_timestamp ON fci_otros (timestamp)',
  ],
}
