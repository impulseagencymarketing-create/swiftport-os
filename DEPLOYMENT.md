# Despliegue automático en Hostinger

Cada envío a la rama `main` compila la aplicación y publica el contenido de
`dist` en Hostinger.

## 1. Crear una cuenta FTP aislada

En el panel del sitio independiente de `app.swiftportlogistic.com`:

1. Abre **Archivos → Cuentas FTP**.
2. Crea una cuenta nueva.
3. Limita su directorio al `public_html` de este sitio.
4. No reutilices la cuenta FTP del WordPress principal.

## 2. Crear los secretos en GitHub

En el repositorio, abre **Settings → Secrets and variables → Actions** y crea:

- `FTP_USER`: usuario de la cuenta FTP aislada.
- `FTP_PASSWORD`: contraseña de esa cuenta.

No guardes estos datos en archivos del repositorio.
El servidor FTP público de Hostinger está configurado directamente en el flujo.

## 3. Publicar

Un cambio enviado a `main` ejecutará automáticamente:

1. `npm ci`
2. `npm run build`
3. Sincronización de `dist` con `/public_html/` en la cuenta FTP aislada.

También puede iniciarse manualmente desde **Actions → Publicar en Hostinger →
Run workflow**.

## Seguridad

El despliegue elimina del destino los archivos que ya no existan en `dist`.
Por eso la cuenta FTP debe estar limitada exclusivamente al `public_html` de
la app y nunca al directorio de la web principal.
