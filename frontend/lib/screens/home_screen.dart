import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/factura.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/pagar_sheet.dart';
import 'estado_servicio_screen.dart';
import 'pagos_screen.dart';

/// Pestaña "Inicio": da la bienvenida al usuario, muestra la factura pendiente
/// con su cuenta regresiva y botón de pago, y deja atajos a los módulos que no
/// están en la barra inferior. La navegación entre secciones vive en `MainShell`.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Factura>> _facturas;

  @override
  void initState() {
    super.initState();
    _facturas = _cargarFacturas();
  }

  Future<List<Factura>> _cargarFacturas() async {
    final data = await context.read<AuthProvider>().api.get('/facturas');
    return Factura.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargarFacturas();
    setState(() => _facturas = futuro);
    await futuro.catchError((_) => <Factura>[]);
  }

  Future<void> _pagar(Factura factura) async {
    final eleccion = await mostrarPagarSheet(
      context,
      subtitulo: '${Formato.periodo(factura.periodo)} · '
          '${Formato.pesos(factura.valorTotal)}',
    );
    if (eleccion == null || !mounted) return;

    try {
      await context.read<AuthProvider>().api.post('/pagos', body: {
        'factura_id': factura.id,
        'metodo': eleccion.metodo,
        if (eleccion.referencia != null) 'referencia': eleccion.referencia,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pago registrado. Queda pendiente de confirmación.'),
        ),
      );
      _refrescar();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final perfil = auth.profile;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: ListView(
          padding: EdgeInsets.zero,
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            _Cabecera(nombre: perfil?.nombre, zona: perfil?.zona),
            Transform.translate(
              offset: const Offset(0, -18),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: FutureBuilder<List<Factura>>(
                  future: _facturas,
                  builder: (context, snap) =>
                      _ProximaFactura(snap: snap, onPagar: _pagar),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _MensajeDestacado(),
                  const SizedBox(height: 24),
                  Text(
                    'Más opciones',
                    style: textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 12),
                  _ModuloTile(
                    icon: Icons.payments_outlined,
                    label: 'Mis pagos',
                    destino: () => const PagosScreen(),
                  ),
                  _ModuloTile(
                    icon: Icons.water_drop_outlined,
                    label: 'Estado del servicio',
                    destino: () => const EstadoServicioScreen(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Cabecera azul con degradado: saludo, bienvenida a HidroApp y un par de
/// etiquetas de estado. Imita la tarjeta superior del diseño.
class _Cabecera extends StatelessWidget {
  const _Cabecera({this.nombre, this.zona});

  final String? nombre;
  final String? zona;

  @override
  Widget build(BuildContext context) {
    final saludo = (nombre != null && nombre!.trim().isNotEmpty)
        ? 'Hola, ${nombre!.trim()} 👋'
        : 'Hola 👋';
    final tieneZona = zona != null && zona!.trim().isNotEmpty;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.of(context).padding.top + 24,
        20,
        34,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.midBlue, AppTheme.deepBlue],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            saludo,
            style: const TextStyle(
              color: AppTheme.skyText,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Bienvenido a HidroApp',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tu acueducto veredal, siempre a la mano.',
            style: TextStyle(color: Colors.white70, fontSize: 13.5),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              const _Etiqueta(texto: 'Servicio activo', conPunto: true),
              if (tieneZona) _Etiqueta(texto: 'Zona ${zona!.trim()}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  const _Etiqueta({required this.texto, this.conPunto = false});

  final String texto;
  final bool conPunto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (conPunto) ...[
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppTheme.accent,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            texto,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Mensaje que resalta: banda con acento de color, ícono y texto de bienvenida.
class _MensajeDestacado extends StatelessWidget {
  const _MensajeDestacado();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceTint,
        borderRadius: BorderRadius.circular(16),
        border: const Border(
          left: BorderSide(color: AppTheme.primary, width: 5),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Icon(Icons.info_outline, color: AppTheme.primaryDark),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Todo tu acueducto en un solo lugar',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primaryDark,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Consulta tus facturas, registra pagos, reporta averías y '
                  'revisa el estado del servicio desde tu celular.',
                  style: TextStyle(fontSize: 13, height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta de la factura pendiente: periodo, valor, vencimiento, anillo de
/// avance del ciclo y botón "Pagar ahora". Si no hay nada pendiente muestra un
/// estado tranquilo; si algo falla, un aviso discreto.
class _ProximaFactura extends StatelessWidget {
  const _ProximaFactura({required this.snap, required this.onPagar});

  final AsyncSnapshot<List<Factura>> snap;
  final Future<void> Function(Factura) onPagar;

  int _diasHasta(DateTime venc) {
    final hoy = DateTime.now();
    final h = DateTime(hoy.year, hoy.month, hoy.day);
    final v = DateTime(venc.year, venc.month, venc.day);
    return v.difference(h).inDays;
  }

  /// Avance del ciclo de facturación entre la emisión y el vencimiento (0..1).
  double _avance(Factura f) {
    final venc = f.fechaVencimiento;
    if (venc == null) return 0;
    final emision = f.fechaEmision ?? venc.subtract(const Duration(days: 30));
    final total = venc.difference(emision).inMinutes;
    if (total <= 0) return 1;
    final transcurrido = DateTime.now().difference(emision).inMinutes;
    return (transcurrido / total).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    if (snap.connectionState == ConnectionState.waiting) {
      return const _CajaBlanca(
        child: Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            SizedBox(width: 14),
            Text('Cargando tu factura…'),
          ],
        ),
      );
    }

    if (snap.hasError) {
      return _CajaBlanca(
        child: Row(
          children: [
            const Icon(Icons.cloud_off_outlined, color: AppTheme.secondaryText),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                snap.error is ApiException
                    ? (snap.error as ApiException).message
                    : 'No se pudo cargar tu factura.',
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final facturas = snap.data ?? const <Factura>[];
    final pendientes = facturas
        .where((f) => f.estaPendiente && f.fechaVencimiento != null)
        .toList()
      ..sort((a, b) => a.fechaVencimiento!.compareTo(b.fechaVencimiento!));

    if (pendientes.isEmpty) {
      final sinFacturas = facturas.isEmpty;
      return _CajaBlanca(
        child: Row(
          children: [
            const Icon(Icons.check_circle, color: AppTheme.success, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sinFacturas ? 'Sin facturas' : 'Estás al día',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.success,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    sinFacturas
                        ? 'Todavía no tienes facturas emitidas.'
                        : 'No tienes facturas pendientes de pago.',
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final factura = pendientes.first;
    final dias = _diasHasta(factura.fechaVencimiento!);
    final avance = _avance(factura);

    final Color color;
    final String aviso;
    if (dias < 0) {
      color = AppTheme.danger;
      aviso = dias == -1 ? 'Venció hace 1 día' : 'Venció hace ${-dias} días';
    } else if (dias == 0) {
      color = AppTheme.warning;
      aviso = 'Vence hoy';
    } else if (dias <= 5) {
      color = AppTheme.warning;
      aviso = dias == 1 ? 'Vence mañana' : 'Faltan $dias días';
    } else {
      color = AppTheme.primaryDark;
      aviso = 'Faltan $dias días';
    }

    return _CajaBlanca(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Formato.periodo(factura.periodo),
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      Formato.pesos(factura.valorTotal),
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Vence: ${Formato.fecha(factura.fechaVencimiento)}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppTheme.secondaryText,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _Anillo(valor: avance, color: color),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.schedule, size: 14, color: color),
                const SizedBox(width: 6),
                Text(
                  aviso,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _BotonPagar(onPressed: () => onPagar(factura)),
        ],
      ),
    );
  }
}

/// Contenedor blanco elevado que "flota" sobre la cabecera azul.
class _CajaBlanca extends StatelessWidget {
  const _CajaBlanca({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE3EEF4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _Anillo extends StatelessWidget {
  const _Anillo({required this.valor, required this.color});

  final double valor;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 58,
      height: 58,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox.expand(
            child: CircularProgressIndicator(
              value: valor,
              strokeWidth: 5,
              backgroundColor: color.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          Text(
            '${(valor * 100).round()}%',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _BotonPagar extends StatelessWidget {
  const _BotonPagar({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primary, Color(0xFF6D5DD3)],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onPressed,
          child: Container(
            height: 50,
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.payments_outlined, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text(
                  'Pagar ahora',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ModuloTile extends StatelessWidget {
  const _ModuloTile({
    required this.icon,
    required this.label,
    this.destino,
  });

  final IconData icon;
  final String label;

  /// Constructor de la pantalla a la que navega el módulo. Si es `null`, el
  /// módulo aún no está implementado y solo muestra un aviso.
  final Widget Function()? destino;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
            color: AppTheme.surfaceTint,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppTheme.primaryDark),
        ),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right, color: Colors.black38),
        onTap: () {
          final destino = this.destino;
          if (destino == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('"$label" estará disponible pronto')),
            );
            return;
          }
          Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => destino()),
          );
        },
      ),
    );
  }
}
