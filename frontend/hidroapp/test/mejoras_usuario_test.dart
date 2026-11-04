import 'dart:convert';

import 'package:acueducto_app/models/corte.dart';
import 'package:acueducto_app/models/profile.dart';
import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/widgets/averias/formulario_reporte.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'auth_provider_test.dart' show MemoryAuthSessionStorage;

void main() {
  group('Entrar con código al correo', () {
    test('pide el código y luego abre la sesión sin contraseña', () async {
      final storage = MemoryAuthSessionStorage();
      final cuerpos = <String, Map<String, dynamic>>{};
      final client = MockClient((request) async {
        final ruta = request.url.path;
        if (request.method == 'POST') {
          cuerpos[ruta] = jsonDecode(request.body) as Map<String, dynamic>;
        }
        if (ruta.endsWith('/auth/codigo-acceso')) {
          return http.Response(jsonEncode({'message': 'ok'}), 200);
        }
        if (ruta.endsWith('/auth/ingresar-con-codigo')) {
          return http.Response(
            jsonEncode({
              'session': {'access_token': 'acceso', 'refresh_token': 'renovar'},
              'debeCambiarPassword': false,
            }),
            200,
          );
        }
        if (ruta.endsWith('/profile/mi-perfil')) {
          return http.Response(
            jsonEncode({
              'id': 'u1',
              'correo': 'ana@correo.com',
              'nombre': 'Ana',
              'apellido': 'Ruiz',
              'rol': 'usuario',
            }),
            200,
          );
        }
        return http.Response('{}', 404);
      });
      final provider = AuthProvider(api: ApiService(client: client), storage: storage);
      addTearDown(provider.dispose);

      await provider.solicitarCodigoAcceso('  Ana@Correo.com ');
      await provider.loginConCodigo('ana@correo.com', ' 123456 ');

      expect(cuerpos['/api/auth/codigo-acceso'], {'correo': 'ana@correo.com'});
      expect(cuerpos['/api/auth/ingresar-con-codigo'], {
        'correo': 'ana@correo.com',
        'codigo': '123456',
      });
      expect(provider.status, AuthStatus.authenticated);
      expect(storage.values['access_token'], 'acceso');
      expect(storage.values['biometric_refresh_token'], 'renovar');
    });

    test('un código incorrecto no abre la sesión', () async {
      final client = MockClient((request) async {
        return http.Response(jsonEncode({'error': 'Código incorrecto o expirado'}), 400);
      });
      final provider = AuthProvider(
        api: ApiService(client: client),
        storage: MemoryAuthSessionStorage(),
      );
      addTearDown(provider.dispose);

      await expectLater(
        provider.loginConCodigo('ana@correo.com', '000000'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Código'))),
      );
      expect(provider.status, isNot(AuthStatus.authenticated));
    });
  });

  group('Reporte rápido de averías', () {
    test('el tipo elegido inicia la descripción y el detalle es opcional', () {
      expect(descripcionAveria('Fuga de agua', ''), 'Fuga de agua');
      expect(
        descripcionAveria('Baja presión', '  desde ayer  '),
        'Baja presión. desde ayer',
      );
      expect(descripcionAveria('Otro problema', 'Se rompió la llave'), 'Se rompió la llave');
    });

    test('todos los tipos rápidos cumplen el mínimo de 10 caracteres del backend', () {
      for (final (_, etiqueta) in tiposAveria) {
        if (etiqueta == 'Otro problema') continue;
        expect(descripcionAveria(etiqueta, '').length, greaterThanOrEqualTo(10), reason: etiqueta);
      }
    });
  });

  group('Perfil', () {
    Profile perfil({String rol = 'usuario', String? direccion}) => Profile.fromJson({
          'id': 'u1',
          'correo': 'a@b.co',
          'nombre': 'Ana',
          'apellido': 'Ruiz',
          'rol': rol,
          'direccion': direccion,
        });

    test('la ubicación registrada solo la cambia el administrador', () {
      expect(perfil(direccion: 'Calle 1').ubicacionBloqueada('Calle 1'), isTrue);
      expect(perfil().ubicacionBloqueada(null), isFalse, reason: 'vacía: el usuario la puede llenar');
      expect(perfil().ubicacionBloqueada('  '), isFalse);
      expect(
        perfil(rol: 'administrador', direccion: 'Calle 1').ubicacionBloqueada('Calle 1'),
        isFalse,
      );
    });
  });

  group('Cortes programados', () {
    test('el estado del servicio incluye los cortes anunciados para la zona', () {
      final estado = EstadoServicio.fromJson({
        'servicioCortado': false,
        'corte': null,
        'cortesProgramados': [
          {
            'id': 'c1',
            'zona': 'Alta',
            'motivo': 'Lavado del tanque',
            'inicio': '2026-11-05T13:00:00Z',
            'fin': '2026-11-05T17:00:00Z',
          },
          {'id': 'roto', 'motivo': 'Sin fechas'},
          {
            'id': 'c2',
            'zona': '',
            'motivo': 'Daño en la bocatoma',
            'inicio': '2026-11-06T13:00:00Z',
            'fin': '2026-11-06T17:00:00Z',
          },
        ],
      });

      expect(estado.cortesProgramados.map((c) => c.id), ['c1', 'c2']);
      expect(estado.cortesProgramados.first.zona, 'Alta');
      expect(estado.cortesProgramados.last.zona, isNull, reason: 'zona vacía = todo el acueducto');
      final corte = estado.cortesProgramados.first;
      expect(corte.enCurso(DateTime.utc(2026, 11, 5, 14)), isTrue);
      expect(corte.enCurso(DateTime.utc(2026, 11, 5, 12)), isFalse);
      expect(corte.enCurso(DateTime.utc(2026, 11, 5, 17)), isFalse);
    });

    test('una respuesta antigua sin cortes programados sigue funcionando', () {
      final estado = EstadoServicio.fromJson({'servicioCortado': true});
      expect(estado.servicioCortado, isTrue);
      expect(estado.cortesProgramados, isEmpty);
    });
  });
}
