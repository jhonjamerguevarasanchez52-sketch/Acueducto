import 'package:flutter/material.dart';

/// Recorta un widget a su mitad izquierda o derecha. Da el efecto de "dos
/// placas" que se cierran en el ensamble del logo del splash.
class HalfClipper extends CustomClipper<Rect> {
  HalfClipper({required this.left});

  final bool left;

  @override
  Rect getClip(Size size) => left
      ? Rect.fromLTWH(0, 0, size.width / 2, size.height)
      : Rect.fromLTWH(size.width / 2, 0, size.width / 2, size.height);

  @override
  bool shouldReclip(HalfClipper oldClipper) => oldClipper.left != left;
}
