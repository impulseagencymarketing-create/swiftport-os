# Swiftport OS

MVP web responsive para la operativa de Swiftport Logistics. Incluye Dashboard, Expedientes, Almacén, Transportes, Aduanas, Clientes/Tarifas y Facturación.

## Ejecutar

```bash
npm install
npm run dev
```

## Compilar

```bash
npm run build
```

## Publicar

El proyecto incluye despliegue automático mediante GitHub Actions. Consulta
[`DEPLOYMENT.md`](DEPLOYMENT.md) para configurar los tres secretos FTP de
Hostinger.

## Alcance del MVP

- Interfaz adaptada a móvil y escritorio.
- Navegación lateral y navegación móvil.
- Alta local de expedientes, búsqueda, filtros y acciones de demostración.
- Datos de prueba para todos los módulos.
- Sin backend: los cambios se conservan únicamente durante la sesión del navegador.
