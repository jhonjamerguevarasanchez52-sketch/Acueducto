import { FileText, Gauge, UserRoundPlus } from 'lucide-react'
import { endpoints } from '../services/api.js'

export const quickActions = [
  { label: 'Usuarios', section: 'usuarios', icon: UserRoundPlus },
  { label: 'Facturación', section: 'facturas', icon: FileText },
  { label: 'Cortes', section: 'cortes', icon: Gauge },
]

export const resourceEndpointBySection = {
  usuarios: 'adminUsers',
  facturas: 'facturasTodas',
  pagos: 'pagos',
  cortes: 'cortes',
  notificaciones: 'notificaciones',
  tarifas: 'tarifas',
}

export const MAX_BULK_USERS = 100
export const MAX_USER_FILE_SIZE_BYTES = 5 * 1024 * 1024

export const operationDefinitions = {
  factura: {
    title: 'Emitir factura', section: 'facturas', endpoint: endpoints.facturas, method: 'POST',
    fields: [
      { name: 'perfil_id', label: 'Suscriptor', type: 'user', required: true },
      { name: 'periodo', label: 'Periodo', type: 'month', required: true },
      { name: 'valor_total', label: 'Valor total', type: 'number', required: true },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['servicio', 'extraordinaria'], defaultValue: 'servicio' },
      { name: 'observacion', label: 'Observación' },
    ],
  },
  facturaExtraordinaria: {
    title: 'Factura extraordinaria', section: 'facturas', endpoint: endpoints.facturaExtraordinaria, method: 'POST',
    fields: [
      { name: 'perfil_ids', label: 'Destinatarios', type: 'recipient', required: true, defaultValue: 'todos' },
      { name: 'periodo', label: 'Periodo', required: true },
      { name: 'valor_total', label: 'Valor total', type: 'number', required: true },
      { name: 'concepto', label: 'Concepto', required: true },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date' },
    ],
  },
  facturacionMensual: {
    title: 'Generar facturas mensuales', section: 'facturas', endpoint: endpoints.generarFacturasMensuales, method: 'POST',
    fields: [
      { name: 'periodo', label: 'Periodo · usuarios activos · $12.000 por factura', type: 'month', required: true },
    ],
  },
  editarFactura: {
    title: 'Editar factura', section: 'facturas', endpoint: endpoints.facturas, method: 'PUT',
    fields: [
      { name: 'estado', label: 'Estado', type: 'select', options: ['pendiente', 'pagada', 'anulada', 'vencida'] },
      { name: 'valor_total', label: 'Valor total', type: 'number' },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date' },
      { name: 'observacion', label: 'Observación' },
    ],
  },
  corte: {
    title: 'Programar corte', section: 'cortes', endpoint: endpoints.cortes, method: 'POST',
    fields: [
      { name: 'perfil_id', label: 'Suscriptor', type: 'user', required: true },
      { name: 'motivo', label: 'Motivo', required: true },
      { name: 'factura_id', label: 'ID de factura asociada' },
    ],
  },
  tarifa: {
    title: 'Crear tarifa', section: 'tarifas', endpoint: endpoints.tarifas, method: 'POST',
    fields: [
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['residencial', 'comercial', 'industrial'], defaultValue: 'residencial' },
      { name: 'cuota_fija', label: 'Cuota fija', type: 'number', required: true },
      { name: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true },
      { name: 'vigente_hasta', label: 'Vigente hasta', type: 'date' },
    ],
  },
  editarTarifa: {
    title: 'Editar tarifa', section: 'tarifas', endpoint: endpoints.tarifas, method: 'PUT',
    fields: [
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['residencial', 'comercial', 'industrial'] },
      { name: 'cuota_fija', label: 'Cuota fija', type: 'number', required: true },
      { name: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true },
      { name: 'vigente_hasta', label: 'Vigente hasta', type: 'date' },
    ],
  },
  notificacion: {
    title: 'Publicar aviso', section: 'notificaciones', endpoint: endpoints.notificaciones, method: 'POST',
    fields: [
      { name: 'perfil_id', label: 'Destinatario', type: 'recipient', defaultValue: 'todos' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['general', 'servicio', 'factura', 'corte'], defaultValue: 'general' },
      { name: 'mensaje', label: 'Mensaje', type: 'textarea', required: true },
      { name: 'enviar_correo', label: 'Enviar también al correo', type: 'checkbox', defaultValue: true },
    ],
  },
  editarUsuario: {
    title: 'Editar usuario', section: 'usuarios', endpoint: endpoints.adminUsers, method: 'PUT',
    fields: [
      { name: 'nombre', label: 'Nombre' },
      { name: 'apellido', label: 'Apellido' },
      { name: 'telefono', label: 'Teléfono' },
      { name: 'numero_lote', label: 'Número de lote' },
      { name: 'direccion', label: 'Dirección' },
      { name: 'ocupacion', label: 'Ocupación' },
      { name: 'zona', label: 'Zona' },
    ],
  },
}

export const roleColors = { administrador: '#1f8fff', usuario: '#53c18b', fontanero: '#ff9d42' }
