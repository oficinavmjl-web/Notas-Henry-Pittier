Esta es una documentación técnica estructurada para las **Edge Functions** de Supabase de tu proyecto, diseñada específicamente para que herramientas como **GitHub Copilot** puedan indexar y entender el flujo de trabajo, los parámetros y los requisitos de seguridad.

---

# Documentación de Supabase Edge Functions: Gestión Académica

Este repositorio contiene un conjunto de funciones de servidor (Edge Functions) desarrolladas en **Deno** para gestionar el ciclo de vida académico, desde la auditoría de usuarios hasta la validación de notas.

## 1. Estándares Globales
Todas las funciones implementan las siguientes características:
- **CORS:** Manejo de pre-flight (método `OPTIONS`) para permitir llamadas desde el frontend.
- **Seguridad:** Uso del `service_role_key` para operaciones administrativas y validación de roles jerárquicos mediante RPC `current_user_roles`.
- **Manejo de Errores:** Respuestas estandarizadas en formato JSON con estados HTTP 400 para errores de validación y 500 para fallos del servidor.

---

## 2. Módulos de Diagnóstico y Salud

### `ping`
Verifica la disponibilidad del sistema y la latencia de la base de datos.
- **Propósito:** Health-check rápido sin validación de JWT para optimizar recursos.
- **Validaciones:** Comprueba variables de entorno (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) y conexión básica con la tabla `anios_escolares`.

### `debug`
Herramienta de diagnóstico profundo para administradores.
- **Funcionalidad:** Devuelve el estado de autenticación del usuario, sus roles y el contexto académico activo (año y lapso).
- **Detección de errores:** Identifica "Lapsos Huérfanos" (años escolares sin lapsos activos vinculados).

---

## 3. Módulo de Notas y Evaluaciones (`modulo-notas`)

### Acción: `verificar-completitud-notas`
Cruza el plan de evaluación contra las notas cargadas para prevenir cierres de lapso incompletos.
- **Parámetros requeridos:**
  - `id_seccion`: ID de la sección a consultar.
  - `id_materia`: ID de la materia específica.
  - `id_lapso`: ID del lapso académico actual.
- **Lógica:**
  1. Obtiene las evaluaciones configuradas en `evaluaciones_lapsos`.
  2. Filtra estudiantes activos en la sección.
  3. Detecta notas faltantes comparando el total esperado (estudiantes × evaluaciones) vs. el total cargado.

---

## 4. Módulo de Períodos Académicos (`modulo-periodos`)

### Acción: `configurar-ventanas-carga`
Define el rango de fechas en el que los docentes pueden registrar calificaciones.
- **Seguridad:** Solo permitido para roles administrativos (Directivos o Superadmins, IDs 5-7).
- **Impacto:** Actualiza los campos `inicio_carga` y `fin_carga` en la tabla `lapsos`, lo que activa validaciones a nivel de base de datos (`trigger_validar_calificacion_ventana`).

---

## 5. Módulo de Usuarios y Auditoría (`modulo-usuarios`)

### Acción: `consultar-auditoria`
Permite el rastreo detallado de cambios críticos en el sistema.
- **Seguridad:** Acceso exclusivo para el Rol 5 (Superadmin).
- **Filtros Dinámicos:** Permite filtrar por tabla, operación (INSERT, UPDATE, DELETE), ID de usuario o ID de registro específico.
- **Información devuelta:** Incluye el registro de cambios (`cambios`) y metadatos del usuario que realizó la acción.

---

## 6. Módulo de Reportes (`modulo-reportes`)

### Helper: `formatNota`
Función de utilidad para la generación de documentos oficiales.
- **Regla del 01:** Redondea notas al entero más cercano y aplica el formato de dos dígitos (ej. "08").
- **Gestión de Retirados:** Transforma automáticamente cualquier nota de un alumno con estado 'retirado' a la etiqueta 'RET'.

---

## 7. Módulos Base (Estructura Estándar)
Los siguientes módulos comparten una estructura de inicialización común para futuras implementaciones:
- **`modulo-estudiantes`**: Preparado para la gestión de inscripciones y datos personales.
- **`modulo-materias`**: Gestión del catálogo de asignaturas.
- **`modulo-secciones`**: Administración de cupos y horarios.
- **`modulo-evaluaciones`**: Configuración de porcentajes y tipos de evaluación.

---

### Ejemplo de Estructura de Respuesta (JSON)
```json
{
  "ok": true,
  "mensaje": "Operación exitosa",
  "data": { ... },
  "diagnostics": { "timestamp": "2026-06-23T..." }
}
```
*Este formato asegura que cualquier cliente frontend pueda manejar las respuestas de forma predecible.*