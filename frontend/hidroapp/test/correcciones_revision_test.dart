// Pruebas de las correcciones de la revisión del 12-nov:
//  1. Las cuotas extraordinarias se pueden pagar (sin pasar por los planes).
//  2. Cancelar un pago no cambia el plan de la factura; si el registro falla
//     después de aplicarlo, la factura vuelve a su plan original.
//  3. Una falla temporal al renovar la sesión no saca al usuario de la app.
//  4. El administrador puede abrir "Recibos por revisar" desde Perfil.
//  5. La tarjeta muestra el número de factura y el tipo correcto.
//  6. Los campos del perfil no dejan pasar de 150 caracteres.
import 'dart:convert';

import 'package:acueducto_app/models/factura.dart';
import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/screens/editar_perfil_screen.dart';
import 'package:acueducto_app/screens/perfil_screen.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/services/flujo_pago_factura.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/widgets/facturas/factura_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

class _Memoria implements AuthSessionStorage {
  final valores = <String, String>{};

  @override
  Future<String?> read(String key) async => valores[key];

  @override
  Future<void> write(String key, String value) async => valores[key] = value;

  @override
  Future<void> delete(String key) async => valores.remove(key);
}

/// Petición registrada por el servidor simulado.
typedef _Peticion = ({String metodo, String ruta, Object? cuerpo});

Map<String, dynamic> _opcion(int meses, num servicio, num cargo) => {
  'meses': meses,
  'periodoInicio': '2026-10',
  'periodoFin': meses == 1 ? '2026-10' : (meses == 12 ? '2027-09' : '2027-03'),
  'valorServicio': servicio,
  'cargoWompi': cargo,
  'totalCobrar': servicio + cargo,
  'disponible': true,
};

/// Servidor simulado de pagos. [fallaRegistro] hace que `POST /pagos` falle.
({ApiService api, List<_Peticion> peticiones}) _servidor({
  bool fallaRegistro = false,
}) {
  final peticiones = <_Peticion>[];
  final api = ApiService(
    client: MockClient((request) async {
      final ruta = request.url.path.replaceFirst('/api', '');
      peticiones.add((
        metodo: request.method,
        ruta: ruta,
        cuerpo: request.body.isEmpty ? null : jsonDecode(request.body),
      ));
      if (ruta == '/facturas/f1/opciones-pago') {
        return http.Response(
          jsonEncode({
            'puedeCambiarPlan': true,
            'opciones': [_opcion(1, 12000, 1251), _opcion(12, 144000, 5550)],
          }),
          200,
        );
      }
      if (ruta.startsWith('/pagos/cotizacion-wompi/')) {
        return http.Response(
          jsonEncode({
            'valorServicio': 30000,
            'cargoWompi': 1900,
            'totalCobrar': 31900,
          }),
          200,
        );
      }
      if (ruta == '/facturas/f1/plan-pago') return http.Response('{}', 200);
      if (ruta == '/pagos' && request.method == 'POST') {
        if (fallaRegistro) {
          return http.Response(jsonEncode({'error': 'Servidor caído'}), 500);
        }
        return http.Response(
          jsonEncode({
            'wompi': {
              'publicKey': 'pub_test_x',
              'currency': 'COP',
              'amountInCents': 1325100,
              'reference': 'ref-1',
              'signature': 'firma',
            },
          }),
          201,
        );
      }
      return http.Response('{}', 404);
    }),
  );
  return (api: api, peticiones: peticiones);
}

Factura _factura({String tipo = 'servicio', String? observacion}) =>
    Factura.fromJson({
      'id': 'f1',
      'periodo': '2026-10',
      'valor_total': tipo == 'servicio' ? 12000 : 30000,
      'estado': 'pendiente',
      'meses_cubiertos': 1,
      'tipo': tipo,
      'numero_factura': 19,
      'observacion': observacion,
    });

/// Monta un botón que lanza el flujo de pago y guarda su resultado o error.
Future<({ResultadoPago? Function() resultado, Object? Function() error})>
_montarFlujo(WidgetTester tester, ApiService api, Factura factura) async {
  ResultadoPago? resultado;
  Object? error;
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                try {
                  resultado = await FlujoPagoFactura.pagarFactura(
                    context,
                    api,
                    factura,
                  );
                } catch (e) {
                  error = e;
                }
              },
              child: const Text('Abrir'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Abrir'));
  await tester.pumpAndSettle();
  return (resultado: () => resultado, error: () => error);
}

Future<void> _elegirAnual(WidgetTester tester) async {
  await tester.tap(find.text('Más pagos'));
  await tester.pumpAndSettle();
  final anual = find.textContaining('Anual · ');
  await tester.ensureVisible(anual);
  await tester.pumpAndSettle();
  await tester.tap(anual);
  await tester.pumpAndSettle();
}

Iterable<_Peticion> _cambiosDePlan(List<_Peticion> peticiones) =>
    peticiones.where((p) => p.ruta == '/facturas/f1/plan-pago');

/// En las pruebas no hay navegador ni galería: se simulan. El navegador abre
/// el checkout sin problema y la galería se cierra sin elegir foto.
void _simularPlugins() {
  final mensajero =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  mensajero.setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/url_launcher'),
    (_) async => true,
  );
  mensajero.setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/image_picker'),
    (_) async => null,
  );
}

void main() {
  setUp(_simularPlugins);

  group('1. cuotas extraordinarias', () {
    testWidgets('se pagan sin pedir planes y con su valor real', (
      tester,
    ) async {
      final s = _servidor();
      addTearDown(s.api.dispose);
      final flujo = await _montarFlujo(
        tester,
        s.api,
        _factura(tipo: 'extraordinaria', observacion: 'Arreglo de la bocatoma'),
      );

      // Va directo a elegir el medio, con el concepto de la cuota.
      expect(find.text('Pagar factura'), findsOneWidget);
      expect(find.textContaining('Arreglo de la bocatoma'), findsOneWidget);
      expect(
        s.peticiones.where((p) => p.ruta.endsWith('/opciones-pago')),
        isEmpty,
        reason: 'el servidor no da planes a las extraordinarias',
      );

      await tester.tap(find.text('Continuar con Wompi'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('31.900'),
        findsOneWidget,
        reason: 'total real con Wompi',
      );
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      final registro = s.peticiones.where(
        (p) => p.metodo == 'POST' && p.ruta == '/pagos',
      );
      expect(registro, hasLength(1));
      expect((registro.first.cuerpo as Map)['factura_id'], 'f1');
      expect(_cambiosDePlan(s.peticiones), isEmpty);
      expect(flujo.error(), isNull);
      expect(flujo.resultado(), ResultadoPago.checkoutAbierto);
    });
  });

  group('2. el plan solo se aplica al confirmar', () {
    testWidgets('elegir Anual y cancelar en Wompi deja la factura igual', (
      tester,
    ) async {
      final s = _servidor();
      addTearDown(s.api.dispose);
      final flujo = await _montarFlujo(tester, s.api, _factura());

      await _elegirAnual(tester);
      await tester.tap(find.text('Continuar con Wompi'));
      await tester.pumpAndSettle();
      // El desglose es el del plan anual, sin pedirlo otra vez al servidor.
      expect(find.textContaining('149.550'), findsOneWidget);
      expect(
        s.peticiones.where((p) => p.ruta.startsWith('/pagos/cotizacion')),
        isEmpty,
      );

      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();

      expect(flujo.resultado(), ResultadoPago.cancelado);
      expect(
        _cambiosDePlan(s.peticiones),
        isEmpty,
        reason: 'cancelar no cambia el plan',
      );
      expect(s.peticiones.where((p) => p.ruta == '/pagos'), isEmpty);
    });

    testWidgets(
      'elegir Anual y cerrar la ventana de medios deja la factura igual',
      (tester) async {
        final s = _servidor();
        addTearDown(s.api.dispose);
        final flujo = await _montarFlujo(tester, s.api, _factura());

        await _elegirAnual(tester);
        await tester.tap(find.byTooltip('Cerrar'));
        await tester.pumpAndSettle();

        expect(flujo.resultado(), ResultadoPago.cancelado);
        expect(_cambiosDePlan(s.peticiones), isEmpty);
      },
    );

    testWidgets(
      'al aceptar se aplica el plan justo antes de registrar el pago',
      (tester) async {
        final s = _servidor();
        addTearDown(s.api.dispose);
        await _montarFlujo(tester, s.api, _factura());

        await _elegirAnual(tester);
        await tester.tap(find.text('Continuar con Wompi'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Continuar'));
        await tester.pumpAndSettle();

        final orden = s.peticiones
            .where((p) => p.metodo == 'POST')
            .map((p) => '${p.ruta} ${jsonEncode(p.cuerpo)}')
            .toList();
        expect(orden.first, '/facturas/f1/plan-pago {"meses":12}');
        expect(orden[1], startsWith('/pagos '));
      },
    );

    testWidgets('si el registro falla, la factura vuelve a su plan mensual', (
      tester,
    ) async {
      final s = _servidor(fallaRegistro: true);
      addTearDown(s.api.dispose);
      final flujo = await _montarFlujo(tester, s.api, _factura());

      await _elegirAnual(tester);
      await tester.tap(find.text('Continuar con Wompi'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      expect(flujo.error(), isA<ApiException>());
      final planes = _cambiosDePlan(
        s.peticiones,
      ).map((p) => (p.cuerpo as Map)['meses']).toList();
      expect(planes, [
        12,
        1,
      ], reason: 'aplica el anual y lo revierte al fallar');
    });

    testWidgets('pagar la mensualidad no toca el plan', (tester) async {
      final s = _servidor();
      addTearDown(s.api.dispose);
      await _montarFlujo(tester, s.api, _factura());

      await tester.tap(find.widgetWithText(FilledButton, 'Pagar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continuar con Wompi'));
      await tester.pumpAndSettle();
      expect(find.textContaining('13.251'), findsOneWidget);
      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      expect(_cambiosDePlan(s.peticiones), isEmpty);
      expect(
        s.peticiones.where((p) => p.metodo == 'POST' && p.ruta == '/pagos'),
        hasLength(1),
      );
    });

    testWidgets('pago físico: si no se elige foto, el plan no cambia', (
      tester,
    ) async {
      final s = _servidor();
      addTearDown(s.api.dispose);
      final flujo = await _montarFlujo(tester, s.api, _factura());

      await _elegirAnual(tester);
      await tester.tap(find.text('Pago físico'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Subir recibo'));
      await tester.pumpAndSettle();

      // El usuario cerró la galería sin elegir foto.
      expect(flujo.error(), isNull);
      expect(flujo.resultado(), ResultadoPago.cancelado);
      expect(_cambiosDePlan(s.peticiones), isEmpty);
      expect(s.peticiones.where((p) => p.ruta.endsWith('/recibo')), isEmpty);
    });
  });

  group('3. sesión ante fallas temporales', () {
    Future<
      ({
        AuthProvider auth,
        _Memoria memoria,
        void Function(int) renovarResponde,
      })
    >
    sesionIniciada() async {
      final memoria = _Memoria();
      var estadoRenovar = 503;
      final api = ApiService(
        client: MockClient((request) async {
          final ruta = request.url.path.replaceFirst('/api', '');
          if (ruta == '/auth/login') {
            return http.Response(
              jsonEncode({
                'session': {'access_token': 'viejo', 'refresh_token': 'r1'},
              }),
              200,
            );
          }
          if (ruta == '/profile/mi-perfil' &&
              request.headers['authorization'] == 'Bearer viejo') {
            return http.Response(
              jsonEncode({'id': 'u1', 'nombre': 'Ana', 'rol': 'usuario'}),
              200,
            );
          }
          if (ruta == '/auth/renovar-sesion') {
            return http.Response(jsonEncode({'error': 'no'}), estadoRenovar);
          }
          // El access token "venció": todo lo demás responde 401.
          return http.Response(jsonEncode({'error': 'Token vencido'}), 401);
        }),
      );
      final auth = AuthProvider(api: api, storage: memoria);
      await auth.login('ana@correo.com', 'clave-segura');
      // A partir de aquí el token ya no sirve para el perfil.
      api.authToken = 'vencido';
      return (
        auth: auth,
        memoria: memoria,
        renovarResponde: (c) => estadoRenovar = c,
      );
    }

    test(
      'servidor caído al renovar: sigue en la app y conserva la sesión',
      () async {
        final s = await sesionIniciada();
        addTearDown(s.auth.dispose);

        await expectLater(
          s.auth.api.get('/facturas'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'mensaje',
              contains('mantener tu sesión'),
            ),
          ),
        );
        expect(
          s.auth.status,
          AuthStatus.authenticated,
          reason: 'no lo saca a la pantalla de acceso',
        );
        expect(s.memoria.valores['biometric_refresh_token'], 'r1');
      },
    );

    test('refresh token rechazado: ahí sí se cierra la sesión', () async {
      final s = await sesionIniciada();
      addTearDown(s.auth.dispose);
      s.renovarResponde(401);

      await expectLater(
        s.auth.api.get('/facturas'),
        throwsA(isA<ApiException>()),
      );
      expect(s.auth.status, AuthStatus.unauthenticated);
      expect(s.memoria.valores['biometric_refresh_token'], isNull);
    });
  });

  group('4 y 6. perfil', () {
    Future<AuthProvider> authCon(String rol) async {
      final api = ApiService(
        client: MockClient((request) async {
          if (request.url.path.endsWith('/auth/login')) {
            return http.Response(
              jsonEncode({
                'session': {'access_token': 't', 'refresh_token': 'r'},
              }),
              200,
            );
          }
          if (request.url.path.endsWith('/profile/mi-perfil')) {
            return http.Response(
              jsonEncode({
                'id': 'u1',
                'nombre': 'Ana',
                'apellido': 'Pérez',
                'rol': rol,
              }),
              200,
            );
          }
          return http.Response('[]', 200);
        }),
      );
      final auth = AuthProvider(api: api, storage: _Memoria());
      await auth.login('ana@correo.com', 'clave-segura');
      return auth;
    }

    Future<void> montar(
      WidgetTester tester,
      AuthProvider auth,
      Widget pantalla,
    ) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ],
          child: MaterialApp(theme: AppTheme.light, home: pantalla),
        ),
      );
      // La pantalla tiene animaciones continuas: se avanza un tiempo fijo.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    }

    testWidgets('el administrador ve y abre "Recibos por revisar"', (
      tester,
    ) async {
      final auth = await authCon('administrador');
      addTearDown(auth.dispose);
      await montar(tester, auth, const PerfilScreen());

      final boton = find.byKey(const ValueKey('abrir-recibos-por-revisar'));
      // Está al final de una lista: se desplaza hasta que aparezca.
      await tester.scrollUntilVisible(
        boton,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(boton);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('No hay recibos por revisar'), findsOneWidget);
    });

    testWidgets('un usuario normal no ve el acceso de administrador', (
      tester,
    ) async {
      final auth = await authCon('usuario');
      addTearDown(auth.dispose);
      await montar(tester, auth, const PerfilScreen());
      // Se baja hasta el final para que la lista construya todos los botones.
      await tester.scrollUntilVisible(
        find.text('Cerrar sesión'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Cambiar contraseña'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('abrir-recibos-por-revisar')),
        findsNothing,
      );
    });

    testWidgets('los campos del perfil se cortan en 150 caracteres', (
      tester,
    ) async {
      final auth = await authCon('usuario');
      addTearDown(auth.dispose);
      await montar(tester, auth, const EditarPerfilScreen());

      final nombre = find.widgetWithText(TextFormField, 'Nombre');
      await tester.enterText(nombre, 'a' * 200);
      await tester.pump();
      final campo = tester.widget<EditableText>(
        find.descendant(of: nombre, matching: find.byType(EditableText)),
      );
      expect(campo.controller.text.length, 150);
    });
  });

  group('5. tarjeta de factura', () {
    Future<void> montarTarjeta(WidgetTester tester, Factura factura) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: SingleChildScrollView(
              child: FacturaCard(
                factura: factura,
                onPagar: () {},
                onVerPagos: () {},
              ),
            ),
          ),
        ),
      );
    }

    testWidgets('muestra el número que llega en el correo', (tester) async {
      await montarTarjeta(tester, _factura());
      expect(find.text('FACTURA DE SERVICIO N.º 19'), findsOneWidget);
    });

    testWidgets('una cuota extraordinaria no se presenta como servicio', (
      tester,
    ) async {
      await montarTarjeta(tester, _factura(tipo: 'extraordinaria'));
      expect(find.text('CUOTA EXTRAORDINARIA N.º 19'), findsOneWidget);
      expect(find.textContaining('FACTURA DE SERVICIO'), findsNothing);
    });

    test('el modelo lee tipo y número, con valores seguros si faltan', () {
      final vieja = Factura.fromJson({
        'id': 'x',
        'periodo': '2025-01',
        'valor_total': 1,
        'estado': 'pendiente',
      });
      expect(vieja.tipo, 'servicio');
      expect(vieja.numeroFactura, isNull);
      expect(vieja.admitePlanes, isTrue);
      expect(_factura(tipo: 'extraordinaria').admitePlanes, isFalse);
      final pagada = Factura.fromJson({
        'id': 'y',
        'periodo': '2025-01',
        'valor_total': 1,
        'estado': 'pagada',
      });
      expect(pagada.admitePlanes, isFalse);
    });
  });
}
