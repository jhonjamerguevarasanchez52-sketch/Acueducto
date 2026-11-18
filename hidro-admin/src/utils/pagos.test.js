import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accionesPago,
  diaColombia,
  esPagoPendiente,
  estadoPago,
  fechaRecaudo,
  requiereAccion,
} from './pagos.js'

const ahora = Date.parse('2026-11-09T12:00:00Z')
const wompi = (extra) => ({ metodo: 'wompi', confirmado: false, estado_wompi: 'PENDING', transaccion_id: null, fecha_pago: '2026-11-09T11:50:00Z', ...extra })

test('un pago de Wompi nunca ofrece "confirmar"', () => {
  for (const estado of ['PENDING', 'DECLINED', 'SUPERSEDED', 'APPROVED_NO_APLICADO', 'MONTO_INVALIDO', 'REEMBOLSADO']) {
    assert.ok(!accionesPago(wompi({ estado_wompi: estado }), ahora).includes('confirmar'), estado)
  }
  assert.deepEqual(accionesPago({ metodo: 'fisico', confirmado: false, estado_wompi: null }, ahora), ['confirmar', 'eliminar'])
})

test('cada estado de Wompi tiene su acción', () => {
  assert.deepEqual(accionesPago(wompi(), ahora), [])
  assert.deepEqual(accionesPago(wompi({ fecha_pago: '2026-11-09T10:00:00Z' }), ahora), ['liberar'])
  assert.deepEqual(accionesPago(wompi({ estado_wompi: 'DECLINED' }), ahora), ['eliminar'])
  assert.deepEqual(accionesPago(wompi({ estado_wompi: 'APPROVED_NO_APLICADO' }), ahora), ['devolver'])
  assert.deepEqual(accionesPago(wompi({ estado_wompi: 'SUPERSEDED' }), ahora), [])
  assert.deepEqual(accionesPago({ ...wompi(), confirmado: true }, ahora), [])
})

test('solo cuentan como pendientes los recibos por revisar y los pagos en curso', () => {
  assert.equal(esPagoPendiente({ metodo: 'fisico', confirmado: false, estado_wompi: null }, ahora), true)
  assert.equal(esPagoPendiente(wompi(), ahora), true)
  assert.equal(esPagoPendiente(wompi({ fecha_pago: '2026-11-09T10:00:00Z' }), ahora), false)
  assert.equal(esPagoPendiente(wompi({ estado_wompi: 'DECLINED' }), ahora), false)
  assert.equal(esPagoPendiente(wompi({ estado_wompi: 'SUPERSEDED' }), ahora), false)
  assert.equal(requiereAccion(wompi({ estado_wompi: 'MONTO_INVALIDO' }), ahora), true)
  assert.equal(estadoPago(wompi({ estado_wompi: 'REEMBOLSADO' }), ahora).clave, 'devuelto')
})

test('el recaudo se fecha el día de la confirmación, en hora de Colombia', () => {
  const pago = { confirmado: true, fecha_pago: '2026-10-31T20:00:00Z', fecha_confirmacion: '2026-11-01T03:00:00Z' }
  assert.equal(fechaRecaudo(pago), '2026-11-01T03:00:00Z')
  // 1-nov 03:00 UTC es todavía 31-oct en Colombia.
  assert.equal(diaColombia(fechaRecaudo(pago)), '2026-10-31')
  assert.equal(fechaRecaudo({ confirmado: false, fecha_pago: '2026-10-01T00:00:00Z' }), '2026-10-01T00:00:00Z')
})
