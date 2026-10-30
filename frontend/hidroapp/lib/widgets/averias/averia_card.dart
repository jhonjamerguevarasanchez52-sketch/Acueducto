import 'package:flutter/material.dart';

import '../../models/averia.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../core/mensaje_estado.dart';

/// Tarjeta de una avería reportada: fecha, estado, descripción y, si el
/// fontanero la dejó, su nota y la fecha de resolución.
///
/// La administración puede ver los datos del reportante; los usuarios ven
/// únicamente el estado y la descripción de sus propios reportes.
class AveriaCard extends StatelessWidget {
  const AveriaCard({
    super.key,
    required this.averia,
    this.mostrarDetallesOperativos = false,
    this.onCambiarEstado,
  });

  final Averia averia;
  final bool mostrarDetallesOperativos;

  /// Solo se pasa para el fontanero: muestra los botones para tomar,
  /// resolver o cancelar la avería mientras no esté cerrada.
  final void Function(String estado)? onCambiarEstado;

  ({String texto, Color color}) _estado(AppColors colores) {
    switch (averia.estado) {
      case 'en_proceso':
        return (texto: 'En proceso', color: colores.info);
      case 'resuelta':
        return (texto: 'Resuelta', color: colores.success);
      case 'cancelada':
        return (texto: 'Cancelada', color: colores.secondaryText);
      default:
        return (texto: 'Reportada', color: colores.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final estado = _estado(colores);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    Formato.fecha(averia.fechaReporte),
                    style: TextStyle(
                      fontSize: 13,
                      color: colores.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                EtiquetaEstado(texto: estado.texto, color: estado.color),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              averia.descripcion,
              style: const TextStyle(fontSize: 15, height: 1.35),
            ),
            if (mostrarDetallesOperativos) ...[
              const SizedBox(height: 12),
              _DatoAveria(
                icono: Icons.person_outline,
                texto: averia.reportanteNombre ?? 'Reportante no disponible',
              ),
              if (averia.reportanteTelefono?.isNotEmpty == true)
                _DatoAveria(
                  icono: Icons.phone_outlined,
                  texto: averia.reportanteTelefono!,
                ),
              if (averia.reportanteCorreo?.isNotEmpty == true)
                _DatoAveria(
                  icono: Icons.email_outlined,
                  texto: averia.reportanteCorreo!,
                ),
              if (averia.direccion?.isNotEmpty == true ||
                  averia.zona?.isNotEmpty == true)
                _DatoAveria(
                  icono: Icons.location_on_outlined,
                  texto: [
                    averia.direccion,
                    averia.zona,
                  ].where((parte) => parte?.isNotEmpty == true).join(' · '),
                ),
            ],
            if (averia.notaFontanero != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colores.chipBackground,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nota del fontanero',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: colores.info,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      averia.notaFontanero!,
                      style: const TextStyle(fontSize: 13.5, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
            if (averia.fechaResolucion != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.check_circle_outline,
                    size: 15,
                    color: colores.secondaryText,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Resuelta: ${Formato.fecha(averia.fechaResolucion)}',
                    style: TextStyle(
                      fontSize: 13,
                      color: colores.secondaryText,
                    ),
                  ),
                ],
              ),
            ],
            if (onCambiarEstado != null && !averia.cerrada) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => onCambiarEstado!(
                        averia.estado == 'en_proceso' ? 'resuelta' : 'en_proceso',
                      ),
                      icon: Icon(
                        averia.estado == 'en_proceso'
                            ? Icons.check_circle_outline
                            : Icons.handyman_outlined,
                        size: 18,
                      ),
                      label: Text(
                        averia.estado == 'en_proceso'
                            ? 'Marcar resuelta'
                            : 'Tomar avería',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: () => onCambiarEstado!('cancelada'),
                    child: const Text('Cancelar'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DatoAveria extends StatelessWidget {
  const _DatoAveria({required this.icono, required this.texto});
  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.of(context).secondaryText;
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, size: 16, color: color),
          const SizedBox(width: 7),
          Expanded(
            child: Text(texto, style: TextStyle(fontSize: 13, color: color)),
          ),
        ],
      ),
    );
  }
}
