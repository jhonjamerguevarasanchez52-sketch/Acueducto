import 'package:acueducto_app/services/pago_checkout_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('crea el Web Checkout oficial con los datos firmados', () {
    final uri = PagoCheckoutService.crearUrlCheckout(
      publicKey: 'pub_test_example',
      currency: 'COP',
      amountInCents: 1250000,
      reference: 'pago-123',
      integrity: 'firma-prueba',
    );

    expect(uri.scheme, 'https');
    expect(uri.host, 'checkout.wompi.co');
    expect(uri.path, '/p/');
    expect(uri.queryParameters, {
      'public-key': 'pub_test_example',
      'currency': 'COP',
      'amount-in-cents': '1250000',
      'reference': 'pago-123',
      'signature:integrity': 'firma-prueba',
    });
  });
}
