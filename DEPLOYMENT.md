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
- `DB_HOST`: servidor MySQL (en Hostinger normalmente `localhost`).
- `DB_NAME`: nombre completo de la base de datos, incluido el prefijo de Hostinger.
- `DB_USER`: usuario completo de MySQL, incluido el prefijo de Hostinger.
- `DB_PASSWORD`: contraseña actual del usuario MySQL.
- `APP_SETUP_TOKEN`: código largo y aleatorio para crear el primer administrador.

No guardes estos datos en archivos del repositorio.
El servidor FTP público de Hostinger está configurado directamente en el flujo.

## 3. Publicar

Un cambio enviado a `main` ejecutará automáticamente:

1. `npm ci`
2. `npm run build`
3. Inclusión de la API PHP protegida dentro de `dist/api`.
4. Creación de la configuración privada fuera de `public_html`.
5. Sincronización de `dist` con `/public_html/` en la cuenta FTP aislada.

También puede iniciarse manualmente desde **Actions → Publicar en Hostinger →
Run workflow**.

## Primer acceso

Después de la primera publicación con autenticación, abre
`https://app.swiftportlogistic.com/`. La app solicitará:

1. Nombre y email del primer administrador.
2. Una contraseña nueva de al menos 4 caracteres.
3. El valor de `APP_SETUP_TOKEN`.

Este formulario se cierra automáticamente después de crear la primera cuenta.
Desde **Usuarios** el administrador puede crear perfiles de Operaciones,
Finanzas o Administración.

## Seguridad

El despliegue elimina del destino los archivos que ya no existan en `dist`.
Por eso la cuenta FTP debe estar limitada exclusivamente al `public_html` de
la app y nunca al directorio de la web principal.
# Procesamiento automático de correos

La aplicación puede revisar los buzones desde el propio hosting, sin servicios de pago.

En Hostinger, abre **Avanzado → Tareas cron** y crea una tarea cada 10 minutos con:

```bash
php /home/u443176985/domains/app.swiftportlogistic.com/public_html/api/mail/process.php
```

Si Hostinger muestra una ruta raíz distinta en el Administrador de archivos, conserva esa ruta y termina siempre en:
`/public_html/api/mail/process.php`.

El proceso es de solo lectura sobre IMAP, no marca ni elimina mensajes y evita duplicados.
