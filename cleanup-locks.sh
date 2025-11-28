#!/bin/bash

# Directorio de sesión de WhatsApp
SESSION_DIR="/app/.wwebjs_auth/session-nest-whatsapp-service"

# Verificar si existe el directorio
if [ -d "$SESSION_DIR" ]; then
  echo "Limpiando archivos de bloqueo en $SESSION_DIR"
  
  # Eliminar archivos de bloqueo
  rm -f "$SESSION_DIR/SingletonLock"
  rm -f "$SESSION_DIR/SingletonCookie"
  rm -f "$SESSION_DIR/SingletonSocket"
  
  echo "Archivos de bloqueo eliminados"
else
  echo "El directorio de sesión no existe, no es necesario limpiar"
fi

# Asegurar permisos correctos
mkdir -p "$SESSION_DIR"
chmod -R 777 "$SESSION_DIR"
echo "Permisos establecidos correctamente"
