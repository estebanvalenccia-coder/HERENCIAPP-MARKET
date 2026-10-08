import test from "node:test";
import assert from "node:assert/strict";
import { cleanSupplierDescription } from "./productDescription.js";

test("supplier descriptions drop markup and embedded remote images", () => {
  const input = '<p>Features:<br><br>Water timer</p><img src="https://supplier.example/one.jpg" /><script>alert(1)</script><p>Accurate &amp; easy to use</p>';
  const cleaned = cleanSupplierDescription(input);
  assert.match(cleaned, /Features:/);
  assert.match(cleaned, /Water timer/);
  assert.match(cleaned, /Accurate & easy to use/);
  assert.doesNotMatch(cleaned, /<[^>]+>|supplier\.example|alert\(1\)/);
});

test("keeps useful plain-text specifications and respects limits", () => {
  assert.equal(cleanSupplierDescription("Tamaño 20 × 30 cm &nbsp;\n Peso: 2 kg"), "Tamaño 20 × 30 cm \nPeso: 2 kg");
  assert.equal(cleanSupplierDescription("abcdef", 3), "abc");
});

test("removes malformed HTML elements without executing them", () => {
  const cleaned = cleanSupplierDescription('<div onclick="evil()">Instrucciones<br/>Regar semanalmente</div><iframe src="evil">BAD</iframe>');
  assert.match(cleaned, /Instrucciones/);
  assert.match(cleaned, /Regar semanalmente/);
  assert.doesNotMatch(cleaned, /evil|BAD|iframe/);
});
