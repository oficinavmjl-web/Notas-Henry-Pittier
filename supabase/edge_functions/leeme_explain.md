Esta es una especificación técnica detallada de las **Supabase Edge Functions** para el sistema de Gestión Académica. Esta documentación profundiza en la arquitectura, la lógica de negocio y las integraciones a nivel de base de datos, ideal para contextos de desarrollo avanzado.

---

### 1. Arquitectura y Estándares Técnicos
Las funciones están desplegadas en el entorno de ejecución **Deno** y utilizan el SDK de Supabase para operaciones del lado del servidor.

*   **Runtime:** Deno (Standard Library v0.168.0/0.177.0).
*   **Gestión de CORS:** Implementación de un objeto `corsHeaders` global para permitir el acceso desde clientes web. Se manejan peticiones `OPTIONS` (pre-flight) de forma nativa devolviendo un estado "ok".
*   **Autenticación y Seguridad:** 
    *   Uso de `SUPABASE_SERVICE_ROLE_KEY` para eludir las políticas de RLS cuando es necesario realizar auditorías o actualizaciones masivas.
    *   **RBAC (Control de Acceso Basado en Roles):** Validación jerárquica mediante la función RPC `current_user_roles` de la base de datos.

---

### 2. Catálogo de Servicios (API Reference)

#### A. Diagnóstico y Monitoreo
*   **`ping`**: Servicio de latencia y salud.
    *   **Lógica:** Realiza una consulta `HEAD` a la tabla `anios_escolares` para verificar la conectividad de la base de datos sin carga de datos.
    *   **Métricas:** Devuelve un objeto con el estado de las variables de entorno y la latencia en milisegundos calculada con `performance.now()`.
*   **`debug`**: Inspección de contexto.
    *   **Lógica:** Cruza datos de la sesión actual con el contexto académico activo.
    *   **Detección Crítica:** Identifica "Lapsos Huérfanos" (años escolares abiertos sin un lapso académico activo asociado) para prevenir errores de integridad en el frontend.

#### B. Gestión Académica (Lógica de Negocio)
*   **`modulo-notas` (`verificar-completitud-notas`)**:
    *   **Algoritmo:** Cruza las tablas `evaluaciones_lapsos` (planificación) y `inscripciones` (estudiantes activos) contra `evaluaciones_notas`.
    *   **Cálculo:** Determina el `total_esperado` (Evaluaciones × Estudiantes) y lo compara con el `total_cargado` para identificar vacíos antes del cierre del periodo.
*   **`modulo-periodos` (`configurar-ventanas-carga`)**:
    *   **Acción:** Actualiza `inicio_carga` y `fin_carga` en la tabla `lapsos`.
    *   **Impacto de Integridad:** Estas fechas disparan el `trigger_validar_calificacion_ventana` en la base de datos, el cual bloquea cualquier inserción de notas fuera del rango establecido.
*   **`modulo-reportes` (Helper: `formatNota`)**:
    *   **Regla de Negocio:** Implementa el redondeo institucional (`Math.round`) y el "Formato 01" (dos dígitos mediante `padStart`).
    *   **Manejo de Estados:** Sobrescribe cualquier valor numérico con el string `'RET'` si el estado del estudiante en la tabla es 'retirado'.

#### C. Seguridad y Auditoría
*   **`modulo-usuarios` (`consultar-auditoria`)**:
    *   **Restricción:** Acceso exclusivo para usuarios con `role_id = 5` (Superadmin).
    *   **Query Dinámica:** Realiza un join con la tabla `perfiles` para obtener nombres y apellidos de quien realizó el cambio. Permite filtrado por `tabla`, `operacion` y `registro_id`.

---

### 3. Esquema de Respuesta Estandarizado
Todas las funciones están diseñadas para devolver un contrato de datos consistente, facilitando la implementación de interceptores en el frontend:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `ok` | Boolean | Indica si la operación lógica se completó exitosamente. |
| `data` / `registros` | Object/Array | Contenido de la respuesta (opcional). |
| `error` | String | Mensaje de error descriptivo en caso de fallo (HTTP 400/500). |
| `diagnostics` | Object | Metadatos de la ejecución (solo en módulos de diagnóstico). |

---

### 4. Dependencias de Base de Datos
Para el correcto funcionamiento de estas Edge Functions, se requiere la existencia de los siguientes objetos en PostgreSQL:
1.  **Tablas:** `anios_escolares`, `lapsos`, `inscripciones`, `evaluaciones_lapsos`, `evaluaciones_notas`, `audit_log`.
2.  **Funciones RPC:** `current_user_roles`, `obtener_anio_activo`.
3.  **Triggers:** `trigger_validar_calificacion_ventana` (activado por las fechas de ventana de carga).