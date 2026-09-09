# Escáner de gastos operativos

Estado: implementación local. No se ha desplegado ni registrado ninguna factura real.

## Uso

1. Finanzas o Administración: Gastos operativos → Escanear factura de gasto.
2. Subir un PDF o foto. El original se guarda como adjunto; la IA configurada extrae proveedor, número, fecha, base, impuestos, total y referencias explícitas.
3. Revisar datos y coste a repartir (se propone la base neta). La lectura automática utiliza la API de OpenAI existente y consume su saldo; no usa el escáner de Holded.
4. Elegir uno o varios expedientes. Solo una referencia única de expediente o PO se preselecciona. Un nombre de barco puede corresponder a varias operativas: no basta para asignar automáticamente.
5. Repartir a partes iguales o indicar importes manuales. Revisar y confirmar. El gasto y el justificante aparecen en cada expediente y en el registro central.

## Controles

- Original hasta 50 MB; lectura automática hasta 20 MB. Si la IA no está configurada o falla, se permite completar manualmente.
- EUR; para otras monedas, convertir el coste y documentar el cambio. Se conservan base, impuestos y total para revisión. No se determina la deducibilidad fiscal automáticamente.
- Céntimos exactos, incluidos abonos; suma obligatoria, sin expedientes duplicados y mismo signo en todas las partes.
- Duplicados por hash del archivo y proveedor/número normalizados. No es una garantía contra documentos distintos con proveedor o número mal transcritos: revisar siempre.
- Transacción del servidor: todas las partes se guardan juntas o ninguna. El registro canónico `app_expense_imports` restaura importes importados frente a guardados de pestañas antiguas. Se mantiene la edición de categoría, pago, revisión y repercusión.
- Un reparto confirmado queda protegido contra edición/borrado aislado desde un expediente. Esta primera versión no incluye anulación/reasignación del reparto; revisar antes de confirmar.
- No envía facturas a Holded ni realiza pagos.

## Verificación

`node --test tests/expenseMath.test.mjs`

`php tests/expense-service.test.php` (requiere mbstring)

`node tests/expense-ui.mjs` con Vite en `http://127.0.0.1:5183`, Playwright y Edge. Puede usarse `PLAYWRIGHT_PACKAGE` para indicar el package.json de Playwright, y `EXPENSE_SCREENSHOT_DIR` para capturas. Las llamadas de subida, OCR y guardado son simuladas: no hay facturas reales ni consumo de IA.

Probados: reparto exacto, abonos, ambigüedad de buques, validaciones, proyección idempotente, preservación de importes ante pestañas antiguas, flujo de interfaz, lectura fallida con alternativa manual y rechazo de duplicados; compilación Vite y sintaxis PHP.

Pendiente antes de considerarlo validado en producción: autorización de despliegue, comprobación con MySQL/configuración real y una factura de prueba autorizada para verificar la lectura IA. Las pruebas locales de servicio validan la lógica, no sustituyen esa comprobación de integración.
