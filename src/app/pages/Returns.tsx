import React from "react";
import { RotateCcw } from "lucide-react";
import { Link } from "react-router";

export function Returns() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-primary/10 p-3 text-primary"><RotateCcw className="h-7 w-7" /></span>
            <h1 className="text-3xl font-bold sm:text-4xl">Política de devoluciones y reembolsos</h1>
          </div>
          <p className="text-muted-foreground">Tropical Plants · Última actualización: 27 de octubre de 2026</p>
          <p className="mt-3 text-muted-foreground">Esta política se aplica a compras realizadas por consumidores desde España y complementa los derechos que reconoce la legislación vigente.</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 text-xl font-semibold">Resumen</h2>
          <p>En general, puedes desistir de tu compra online sin indicar el motivo durante los <strong>14 días naturales desde la recepción</strong> del producto, salvo las excepciones legales. Los productos defectuosos, dañados o distintos de los solicitados se atienden conforme a la garantía legal, incluso cuando no proceda el desistimiento.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">1. Derecho de desistimiento</h2>
          <p>Puedes comunicarnos tu decisión de desistir dentro de los 14 días naturales siguientes a la recepción del pedido, sin tener que justificarla. Cuando un pedido tenga entregas separadas, el plazo comienza con la recepción del último bien. Puedes escribirnos mediante la <Link to="/contacto" className="text-primary underline">página de contacto</Link>, indicando tu nombre, número de pedido y una declaración inequívoca de desistimiento. No es necesario utilizar un formulario específico.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">2. Cómo devolver un producto</h2>
          <ol className="list-decimal space-y-2 pl-6"><li>Comunícanos la devolución mediante nuestros <Link to="/contacto" className="text-primary underline">canales de contacto</Link>.</li><li>Te indicaremos una dirección válida para la devolución, que puede variar según el origen del producto. No envíes artículos sin obtener previamente esa dirección.</li><li>Remite el producto dentro de los 14 días naturales siguientes a tu comunicación de desistimiento, salvo que acordemos recogerlo.</li><li>Protege y embala el artículo adecuadamente; puedes examinarlo como lo harías en una tienda física, pero responderás de la disminución de valor derivada de manipulaciones no necesarias para comprobar su naturaleza, características y funcionamiento.</li></ol>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">3. Gastos de devolución</h2>
          <p>En devoluciones por desistimiento, el cliente asume los costes directos de devolver el producto cuando se le haya informado previamente de ello, excepto si Tropical Plants acuerda asumirlos. En casos de falta de conformidad, daños o errores imputables a la venta, la solución legal correspondiente no supondrá costes para el consumidor.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">4. Reembolsos</h2>
          <p>Cuando proceda el desistimiento, reembolsaremos los pagos recibidos, incluidos los gastos de entrega ordinaria iniciales cuando legalmente corresponda, sin demora indebida y dentro de los 14 días naturales desde que nos informes de tu decisión. Podemos retener el reembolso hasta recibir los bienes o hasta que aportes prueba de su devolución, lo que ocurra primero. Utilizaremos el mismo medio de pago original salvo acuerdo expreso distinto, sin cargos por el reembolso.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">5. Plantas naturales, flores y productos personalizados</h2>
          <p>El desistimiento puede estar legalmente excluido para bienes que puedan deteriorarse o caducar con rapidez y para artículos confeccionados según las especificaciones del cliente o claramente personalizados. La exclusión se aplica únicamente cuando el producto cumpla efectivamente los requisitos legales; <strong>no todas las plantas naturales están automáticamente excluidas</strong>. Las excepciones se comunicarán antes de la compra cuando correspondan. Los derechos ante productos defectuosos o no conformes se mantienen en todo caso.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">6. Productos defectuosos, dañados o equivocados</h2>
          <p>Si un artículo llega dañado, presenta una falta de conformidad o no coincide con tu pedido, contacta con nosotros e indica el número de pedido y una descripción del problema. Si dispones de fotografías, puedes aportarlas para agilizar la revisión, pero ello no limita tus derechos. Aplicaremos la reparación, sustitución, rebaja del precio o resolución contractual según corresponda conforme a la garantía legal.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">7. Productos enviados por proveedores externos</h2>
          <p>Algunos accesorios y artículos de jardinería pueden enviarse desde proveedores colaboradores. La gestión logística y dirección de devolución pueden variar, pero eso no reduce los derechos del consumidor frente a Tropical Plants como vendedor.</p>
        </section>
        <section><h2 className="mb-3 text-2xl font-semibold">8. Atención al cliente</h2>
          <p>Para solicitar una devolución, ejercer el desistimiento o comunicar una incidencia, utiliza nuestra <Link to="/contacto" className="text-primary underline">página de contacto</Link>. Incluye, si lo tienes disponible, el número de pedido, producto y motivo de contacto. También puedes consultar nuestros <Link to="/terminos" className="text-primary underline">términos y condiciones</Link>.</p>
        </section>
        <p className="border-t pt-6 text-sm text-muted-foreground">Esta información no limita los derechos irrenunciables de las personas consumidoras conforme a la legislación española.</p>
      </div>
    </main>
  );
}
