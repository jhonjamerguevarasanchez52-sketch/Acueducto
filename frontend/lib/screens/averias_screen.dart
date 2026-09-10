import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/averia.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/gota_scaffold.dart';
import '../widgets/mensaje_estado.dart';

/// Módulo "Averías": el usuario reporta una avería del servicio y hace
/// seguimiento del estado en que la deja el fontanero.
class AveriasScreen extends StatefulWidget {
  const AveriasScreen({super.key});

  @override
  State<AveriasScreen> createState() => _AveriasScreenState();
}

class _AveriasScreenState extends State<AveriasScreen> {
  late Future<List<Averia>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<Averia>> _cargar() async {
    final data =
        await context.read<AuthProvider>().api.get('/averias/mis-averias');
    return Averia.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Averia>[]);
  }

  Future<void> _abrirReporte() async {
    final creada = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _FormularioReporte(),
    );
    if (creada == true && mounted) {
      _refrescar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Avería reportada. Gracias por avisar.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: AppBar(title: const Text('Averías')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirReporte,
        icon: const Icon(Icons.add),
        label: const Text('Reportar'),
      ),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Averia>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snap.hasError) {
              return ListView(
                children: [
                  MensajeEstado.error(
                    mensaje: snap.error is ApiException
                        ? (snap.error as ApiException).message
                        : 'Ocurrió un error inesperado.',
                    onReintentar: _refrescar,
                  ),
                ],
              );
            }

            final averias = snap.data ?? const <Averia>[];
            if (averias.isEmpty) {
              return ListView(
                children: const [
                  MensajeEstado(
                    icono: Icons.build_outlined,
                    titulo: 'Sin averías reportadas',
                    detalle:
                        'Usa el botón "Reportar" si tienes un problema con el servicio.',
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: averias.length,
              itemBuilder: (context, i) => _AveriaCard(averia: averias[i]),
            );
          },
        ),
      ),
    );
  }
}

class _AveriaCard extends StatelessWidget {
  const _AveriaCard({required this.averia});

  final Averia averia;

  ({String texto, Color color}) get _estado {
    switch (averia.estado) {
      case 'en_proceso':
        return (texto: 'En proceso', color: AppTheme.info);
      case 'resuelta':
        return (texto: 'Resuelta', color: AppTheme.success);
      case 'cancelada':
        return (texto: 'Cancelada', color: AppTheme.secondaryText);
      default:
        return (texto: 'Reportada', color: AppTheme.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estado = _estado;
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
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.secondaryText,
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
            if (averia.notaFontanero != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceTint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Nota del fontanero',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.primaryDark,
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
                  const Icon(Icons.check_circle_outline,
                      size: 15, color: AppTheme.secondaryText),
                  const SizedBox(width: 6),
                  Text(
                    'Resuelta: ${Formato.fecha(averia.fechaResolucion)}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.secondaryText,
                    ),
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

/// Hoja inferior con el formulario para reportar una nueva avería.
class _FormularioReporte extends StatefulWidget {
  const _FormularioReporte();

  @override
  State<_FormularioReporte> createState() => _FormularioReporteState();
}

class _FormularioReporteState extends State<_FormularioReporte> {
  final _formKey = GlobalKey<FormState>();
  final _descripcionCtrl = TextEditingController();
  bool _enviando = false;

  @override
  void dispose() {
    _descripcionCtrl.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _enviando = true);
    try {
      await context.read<AuthProvider>().api.post(
        '/averias',
        body: {'descripcion': _descripcionCtrl.text.trim()},
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _enviando = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fondo = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: fondo),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: SafeArea(
          top: false,
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCE7EF),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Reportar una avería',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Describe qué está pasando: fuga, falta de agua, agua turbia, etc.',
                  style: TextStyle(color: AppTheme.secondaryText, fontSize: 13),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _descripcionCtrl,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 500,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Describe la avería…',
                    alignLabelWithHint: true,
                  ),
                  validator: (v) {
                    final t = v?.trim() ?? '';
                    if (t.isEmpty) return 'Cuéntanos qué ocurre';
                    if (t.length < 10) return 'Danos un poco más de detalle';
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _enviando ? null : _enviar,
                  child: _enviando
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Enviar reporte'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
