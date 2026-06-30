<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

ensure_schema();
$user = require_auth();
$storage = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/swiftport-storage';
if (!is_dir($storage) && !mkdir($storage, 0750, true) && !is_dir($storage)) {
    respond(['error' => 'No se pudo preparar el almacenamiento.'], 500);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $id = preg_replace('/[^a-f0-9]/', '', strtolower((string) ($_GET['id'] ?? '')));
    if (strlen($id) !== 32) {
        respond(['error' => 'Archivo no válido.'], 400);
    }
    $statement = db()->prepare('SELECT original_name, stored_name, mime_type FROM app_attachments WHERE id = ?');
    $statement->execute([$id]);
    $file = $statement->fetch();
    $path = $file ? $storage . '/' . $file['stored_name'] : '';
    if (!$file || !is_file($path)) {
        respond(['error' => 'Archivo no encontrado.'], 404);
    }
    header_remove('Content-Type');
    header('Content-Type: ' . $file['mime_type']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', $file['original_name']) . '"');
    header('Cache-Control: private, max-age=3600');
    readfile($path);
    exit;
}

require_method('POST');
verify_csrf();
if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    respond(['error' => 'Selecciona un archivo válido.'], 422);
}
$upload = $_FILES['file'];
if ((int) $upload['error'] !== UPLOAD_ERR_OK || (int) $upload['size'] < 1 || (int) $upload['size'] > 10485760) {
    respond(['error' => 'El archivo debe ocupar menos de 10 MB.'], 422);
}
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($upload['tmp_name']);
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
];
if (!isset($allowed[$mime])) {
    respond(['error' => 'Solo se admiten imágenes JPG, PNG, WEBP o documentos PDF.'], 422);
}
$category = (string) ($_POST['category'] ?? 'document');
if (!in_array($category, ['photo', 'document'], true)) {
    $category = 'document';
}
$id = bin2hex(random_bytes(16));
$storedName = $id . '.' . $allowed[$mime];
$destination = $storage . '/' . $storedName;
if (!move_uploaded_file($upload['tmp_name'], $destination)) {
    respond(['error' => 'No se pudo guardar el archivo.'], 500);
}
$originalName = mb_substr(basename((string) $upload['name']), 0, 255);
$statement = db()->prepare(
    'INSERT INTO app_attachments
     (id, original_name, stored_name, mime_type, file_size, category, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
$statement->execute([$id, $originalName, $storedName, $mime, (int) $upload['size'], $category, $user['id']]);
audit((int) $user['id'], 'attachment.upload', ['id' => $id, 'category' => $category]);
respond(['file' => [
    'id' => $id,
    'name' => $originalName,
    'mime' => $mime,
    'size' => (int) $upload['size'],
    'category' => $category,
    'url' => '/api/uploads.php?id=' . $id,
]], 201);
