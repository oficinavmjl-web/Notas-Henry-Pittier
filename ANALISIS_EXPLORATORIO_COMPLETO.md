# 📊 ANÁLISIS EXPLORATORIO COMPLETO
## Proyecto: Notas-Henry-Pittier | Fecha: 2026-06-24

---

## 1. 🔌 EDGE FUNCTIONS (Backend - Supabase)

### ✅ Funciones Disponibles y Operativas

```
📦 MÓDULO: modulo-usuarios (Gestión de Usuarios)
├─ create_user          → Crear usuario con rol (validación jerárquica)
├─ list_users           → Listar usuarios con JOIN a roles
├─ update_user          → Modificar datos de usuario
├─ toggle_status        → Habilitar/deshabilitar (ban_duration en Auth)
├─ reset_password       → Cambiar contraseña
└─ consultar-auditoria  → ⭐ CRÍTICA: Auditoría solo para Superadmin (rol 5)
   Retorna: cambios + metadatos de usuario
   Filtros: tabla, operación, usuario_id, registro_id

📦 MÓDULO: modulo-periodos (Académicos: Años y Lapsos)
├─ crear_anio           → Crear año escolar
├─ cerrar_anio          → Cierre con validación
├─ crear_lapso          → Crear lapso en año
├─ activar_lapso        → Activar/desactivar lapso
├─ obtener_activo       → Retorna año activo actual
├─ listar_lapsos        → Listar lapsos por año
├─ configurar-ventanas-carga → ⭐ Define fechas de carga (CRÍTICA)
│  └─ Activa: trigger_validar_calificacion_ventana
│  └─ Roles: 5-7 (admin) solamente
├─ status_ventanas_carga     → Monitor: Abierta/Próxima/Cerrada
└─ check_readiness_cierre    → Valida completitud antes de cerrar

📦 MÓDULO: modulo-notas (Calificaciones y Evaluaciones)
├─ configurar-planilla        → Inserta plan de evaluación
├─ registrar-planilla         → Carga masiva de notas (con Regla del 01: 1-20)
├─ corregir-individual        → Actualizar nota específica
├─ obtener-planilla-llenada   → Listado estudiantes + notas actuales
├─ finalizar-lapso            → RPC cerrar_lapso
└─ verificar-completitud-notas → ⭐ PREVENCIÓN: Detecta faltantes
   Cruza: evaluaciones planificadas vs notas cargadas
   Bloquea: Cierre incompleto

📦 MÓDULO: modulo-secciones (Cupos Académicos)
├─ listar               → Listado con RLS (docentes ven solo sus secciones)
├─ crear                → Crear sección (grado, letra)
├─ editar               → Modificar sección
├─ toggle_status        → Activar/desactivar
├─ clonar               → Duplicar sección a otro año
└─ asignar-asesor       → ⭐ Vincula docente a sección
   Validación: Usuario es Docente (rol 1)
   Constraint: UNIQUE(seccion_id, anio_escolar_id)

📦 MÓDULO: modulo-estudiantes (Inscripciones)
├─ listar               → Búsqueda multicampo + filtrado
├─ inscribir            → Inscripción + creación automática
├─ cambiar_seccion      → Upsert para traslados
└─ promover             → Promoción con validación (sin pendientes)

📦 MÓDULO: modulo-reportes (Reportería)
├─ generar-datos-sabana      → Planilla PDF (notas por materia/lapso)
├─ generar-boletin-estudiante → Resumen por representante
└─ generar-acta-final        → Reporte fin de año (rol 2, 4, 5 solo)
   Helper: formatNota() - Redondea + Regla del 01 + "RET" si retirado

📦 MÓDULO: Diagnóstico
├─ ping                 → Health-check (latencia BD)
└─ debug                → Estado autenticación + roles + contexto académico

📦 MÓDULOS Base (Solo estructura, sin implementación):
├─ modulo-estudiantes   → Preparado para inscripciones
├─ modulo-materias      → Preparado para catálogo
└─ modulo-evaluaciones  → Preparado para configuración %
```

---

## 2. 🗄️ SCHEMA DE BASE DE DATOS

### Estructura de Tablas Principales (20+)

```sql
TABLAS DE AUTENTICACIÓN Y ROLES:
├── auth.users (Supabase Auth) - email, contraseña
├── perfiles - Extensión de auth.users
│   └── id, nombres, apellidos, cedula, activo, user_id FK
├── rol - Catálogo de roles
│   └── id_rol: 1=Estudiante, 2=Control Estudios, 3=Docente, 4=Directivo, 5=Superadmin
└── user_roles - Asignación de roles a usuarios
    └── user_id, id_rol, unique(user_id, id_rol)

ESTRUCTURA ACADÉMICA:
├── anios_escolares
│   └── id_anio, nombre (ej: "2024-2025"), fecha_inicio, fecha_fin, activo
├── lapsos
│   └── id_lapso, id_anio FK, numero, fecha_inicio, fecha_fin, 
│       inicio_carga (ventana de carga), fin_carga, activo
├── secciones
│   └── id_seccion, nombre, grado (7-9), letra, anio_escolar_id FK, activo
├── materias
│   └── id_materia, nombre, codigo, horas, activo
└── seccion_materias
    └── id_seccion FK, id_materia FK, id_docente FK

EVALUACIONES Y CALIFICACIONES:
├── evaluaciones_lapsos
│   └── id_evaluacion, docente_id FK, seccion_id FK, materia_id FK, 
│       lapso_id FK, porcentaje (máx 25%), nombre
├── evaluaciones_notas
│   └── id_nota, evaluacion_id FK, estudiante_id FK, nota (1-20), observacion
├── notas_lapso
│   └── estudiante_id FK, materia_id FK, lapso_id FK, nota_final
└── notas_anuales
    └── estudiante_id FK, materia_id FK, anio_escolar_id FK, 
        nota_final (promedio de 3 lapsos), aprobado (>=10)

ESTUDIANTES E INSCRIPCIONES:
├── estudiantes
│   └── id_estudiante, cedula, nombres, apellidos, fecha_nacimiento, 
│       sexo, telefono, direccion, representante, activo
└── inscripciones
    └── id_inscripcion, estudiante_id FK, seccion_id FK, 
        anio_escolar_id FK, estado (activo|promovido|retirado|reprobado)

ASIGNACIONES Y CONTROL:
├── asesores_seccion
│   └── docente_id FK, seccion_id FK, anio_escolar_id FK, activo
└── audit_log
    └── id, tabla, operacion (INSERT/UPDATE/DELETE), registro_id, 
        cambios (JSON), usuario_id FK, created_at
```

### 🔑 Relaciones Clave

```
auth.users (1) ──── (N) user_roles ──── (1) rol
    │
    └──── (1) perfiles

anios_escolares (1) ──── (N) lapsos
                             │
                             └──── (N) secciones ──── (N) materias
                                       │
                                       ├──── (N) inscripciones ──── (1) estudiantes
                                       │
                                       └──── (N) evaluaciones_lapsos ──── (N) evaluaciones_notas
                                                                                │
                                                                                └──── (1) estudiantes
```

### 🛡️ Row Level Security (RLS) - Estado: PARCIAL ⚠️

```
✅ IMPLEMENTADO:
├── user_roles: SELECT propio + DIRECTIVO/SUPERADMIN gestión completa
├── perfiles: SELECT propio + DIRECTIVO/SUPERADMIN
└── inscripciones: DOCENTES ven solo sus secciones asignadas

❌ FALTA IMPLEMENTAR:
├── notas_lapso: Sin restricción (riesgo: docentes ven otros cursos)
├── notas_anuales: Sin restricción
├── evaluaciones_notas: Sin restricción
└── audit_log: Sin restricción (solo Superadmin debería acceder)
```

### 🔄 Triggers Implementados

```
✅ actualizar_nota_lapso()       - Recalcula nota_lapso cuando cambien evaluaciones_notas
✅ actualizar_nota_anual()       - Promedia 3 lapsos → nota_anual (con validaciones)
✅ actualizar_promedio_final()   - Calcula promedio general del estudiante
✅ trg_actualizar_promedio       - Dispara recálculos en cascada
❓ trigger_validar_calificacion_ventana - Debería validar ventana de carga (verificar)
```

---

## 3. 🎨 FRONTEND ACTUAL - Status por Módulo

### 📊 Cobertura General: **40-50% COMPLETO**

### ✅ COMPLETAMENTE FUNCIONALES

```
📄 AUTENTICACIÓN (auth.js)
├─ ✅ Login con email/password
├─ ✅ Obtención de rol principal desde tabla user_roles
├─ ✅ Validación de jerarquía (transforma "superadmin" → "Superadmin")
├─ ✅ Manejo de sesión (sessionStorage + localStorage)
└─ ✅ Redirección por rol

📄 USUARIOS (modulo_usuarios.js)
├─ ✅ Listado con paginación
├─ ✅ Filtros: rol, estado, búsqueda multicampo
├─ ✅ Crear usuario
├─ ✅ Editar usuario
├─ ✅ Toggle status (habilitar/deshabilitar)
├─ ✅ Reset de contraseña
├─ ✅ Modal de creación/edición
└─ ✅ Roles en dropdown (6 opciones)

📄 PERÍODOS ACADÉMICOS (modulo_periodos.js)
├─ ✅ Crear año escolar
├─ ✅ Modal para años (nombre, fecha_inicio, fecha_fin)
├─ ✅ Crear lapso
├─ ✅ Modal para lapsos
├─ ✅ Activar lapso
└─ ✅ Listado de años con lapsos

📄 ESTUDIANTES INSCRITOS (/js/estudiantes/*)
├─ ✅ Listado con paginación (20 registros/página)
├─ ✅ Búsqueda multicampo (nombre, apellido, cédula)
├─ ✅ Ordenamiento (apellidos, cedula, etc.)
├─ ✅ Crear estudiante (con validaciones)
├─ ✅ Editar estudiante
├─ ✅ Ver detalles estudiante
├─ ✅ Cambio de sección (modal)
├─ ✅ Promover estudiante (con validación académica)
├─ ✅ Repetir grado
├─ ✅ Retirar estudiante
└─ ✅ Modales para cada acción (7 modales funcionales)

📄 SERVICIOS Y UTILIDADES
├─ ✅ session.js
│  └─ Gestión de sesión (usuario, rol, autenticación)
│  └─ Métodos: guardarSesion, obtenerSesion, tieneRol, estaAutenticado
├─ ✅ api.js
│  └─ Centralización de llamadas a Edge Functions
│  └─ Normalizador de usuarios y roles
│  └─ Métodos para usuarios, períodos, secciones, estudiantes
├─ ✅ supabase.js
│  └─ Inicialización cliente Supabase
│  └─ Mapeo legacy: 'users-create_user' → 'modulo-usuarios'
│  └─ 40+ funciones legacy mapeadas
└─ ✅ utils-mejorado.js
   └─ Helpers para UI (modal, tabla, paginación)
```

### ⚠️ PARCIALMENTE IMPLEMENTADOS

```
📄 SECCIONES (modulo_secciones.js)
├─ ✅ Carga de años escolares
├─ ✅ Estructura HTML
├─ ❌ Listado de secciones - NO IMPLEMENTADO
├─ ❌ Crear sección - NO IMPLEMENTADO
├─ ❌ Editar sección - NO IMPLEMENTADO
├─ ❌ Asignar docente a materia - NO IMPLEMENTADO
├─ ❌ Agregar/quitar materias - NO IMPLEMENTADO
├─ ❌ Clonar sección - NO IMPLEMENTADO
└─ Status: 15% implementado

📄 CARGAR NOTAS - DOCENTE
├─ ✅ Página HTML: /pages/docente/cargar-notas.html (completa)
├─ ✅ JS inicial: /pages/docente/cargar-notas.js (estructura)
├─ ❌ Lógica de carga de planilla - NO IMPLEMENTADA
├─ ❌ Validación de ventana de carga - NO IMPLEMENTADA
├─ ❌ Verificación de completitud - NO IMPLEMENTADA
├─ ❌ Descarga de planilla vacía - NO IMPLEMENTADA
└─ Status: 20% implementado

📄 DASHBOARDS MULTI-ROL
├─ ❌ Dashboard Superadmin - NO IMPLEMENTADO
├─ ❌ Dashboard Directivo - HTML sin lógica JS
├─ ❌ Dashboard Control Estudios - NO IMPLEMENTADO
├─ ❌ Dashboard Evaluación Docente - NO IMPLEMENTADO
├─ ❌ Dashboard Estudiante - NO IMPLEMENTADO
└─ Status: 0-10% implementado
```

### ❌ NO IMPLEMENTADOS

```
❌ MÓDULO: Reportería
   └─ Edge functions SÍ existen (modulo-reportes)
   └─ Pero SIN interfaz UI
   └─ No hay opción para generar: sabanas, boletines, actas finales

❌ MÓDULO: Auditoría (Superadmin)
   └─ Edge function SÍ existe (consultar-auditoria)
   └─ Pero SIN interfaz para consultar logs

❌ MÓDULO: Mi Perfil
   └─ Página existe: /pages/perfil.html
   └─ Pero completamente VACÍA

❌ MÓDULO: Evaluación Docente
   └─ NO EXISTE página ni JS
   └─ Sin interfaz para asignar docentes/materias

❌ MÓDULO: Control Estudios
   └─ NO EXISTE página ni JS
   └─ Sin interfaz para crear/transfierir secciones
```

### 📁 Estructura Actual de Carpetas

```
/workspaces/Notas-Henry-Pittier/
├── /js
│   ├── auth.js ✅
│   ├── supabase.js ✅
│   ├── modulo_usuarios.js ✅
│   ├── modulo_periodos.js ✅
│   ├── modulo_secciones.js ⚠️ (vacío)
│   ├── docente.js ❌ (vacío)
│   ├── bootstrap.min.js ✅
│   │
│   ├── /directivo
│   │   ├── directivo.js ❌
│   │   ├── modulo_periodos.js ⚠️ (duplicado)
│   │   ├── modulo_secciones.js ⚠️ (duplicado)
│   │   └── modulo_usuarios.js ⚠️ (duplicado)
│   │
│   ├── /estudiantes (17 archivos)
│   │   ├── modulo_estudiantes.js ✅
│   │   ├── crear.js ✅
│   │   ├── editar.js ✅
│   │   ├── detalles.js ✅
│   │   ├── cambio_seccion.js ✅
│   │   ├── promover.js ✅
│   │   ├── repetir.js ✅
│   │   ├── retirar.js ✅
│   │   ├── busqueda.js ✅
│   │   ├── paginacion.js ✅
│   │   ├── ordenamiento.js ✅
│   │   ├── validaciones.js ✅
│   │   └── ...
│   │
│   ├── /secciones (11 archivos)
│   │   ├── cargar.js ⚠️
│   │   ├── crear.js ❌
│   │   ├── editar.js ❌
│   │   ├── agregar_materia.js ❌
│   │   ├── asignar_docente.js ❌
│   │   └── ...
│   │
│   └── /services
│       ├── session.js ✅
│       └── api.js ✅
│
├── /pages
│   ├── login.html ✅
│   ├── perfil.html ❌ (vacío)
│   ├── docente.html ❌ (vacío)
│   ├── secciones.html ⚠️ (sin JS)
│   │
│   ├── /directivo
│   │   ├── directivo.html ⚠️
│   │   ├── dashboard.html ⚠️
│   │   └── /modulos
│   │       ├── periodos.html ⚠️
│   │       ├── secciones.html ⚠️
│   │       ├── usuarios.html ⚠️
│   │       └── dashboard.html ⚠️
│   │
│   ├── /docente
│   │   ├── cargar-notas.html ✅
│   │   ├── cargar-notas.js ⚠️
│   │   └── dashboard.html ❌
│   │
│   ├── /estudiante
│   │   └── dashboard.html ❌
│   │
│   ├── /estudiantes
│   │   ├── estudiantes.html ✅
│   │   └── /modales (7 archivos) ✅
│   │
│   ├── /evaluacion_docente
│   │   └── dashboard.html ❌
│   │
│   └── /superadmin
│       └── dashboard.html ❌
│
└── /supabase
    ├── /edge_functions (12 módulos)
    │   ├── modulo-usuarios.txt ✅
    │   ├── modulo-periodos.txt ✅
    │   ├── modulo-notas.txt ✅
    │   ├── modulo-secciones.txt ✅
    │   ├── modulo-estudiantes.txt ✅
    │   ├── modulo-reportes.txt ✅
    │   ├── debug.txt ✅
    │   ├── ping.txt ✅
    │   └── _shared/ (helpers)
    │
    └── /migrations
        └── modelo_schema_supabase.sql ✅
```

---

## 4. ⚙️ CONFIGURACIÓN ACTUAL

### package.json
```json
{
  "name": "cargar-notas-e2e",
  "version": "0.0.1",
  "scripts": {
    "test": "npx playwright test",
    "test:headed": "npx playwright test --headed",
    "test:debug": "npx playwright test --debug"
  },
  "devDependencies": {
    "@playwright/test": "^1.37.0"
  }
}
```

⚠️ **PROBLEMAS:**
- ❌ No tiene `npm start` o script de desarrollo
- ❌ No tiene dependencias principales (supabase.js, bootstrap, etc.)
- ✅ Tests Playwright listos

### index.html
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <title>Iniciar Sesión</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Login Form -->
</head>
<body>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="/js/supabase.js"></script>
  <script src="/js/services/session.js"></script>
  <script src="/js/services/api.js"></script>
  <script src="/js/auth.js"></script>
</body>
</html>
```

**Flujo:**
1. Usuario ingresa email/password
2. auth.js llama `supabase.auth.signInWithPassword()`
3. Obtiene rol desde `user_roles` table
4. Guarda sesión en sessionStorage
5. Redirecciona por rol

### supabase.js
```javascript
const SUPABASE_URL = "https://slwbzfxwrxrsnlizapps.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_9yQQumW9JF5A-NjFjtp3Og_7HBfSDpr"

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// LEGACY_FUNCTIONS: Mapeo de funciones antiguas a nuevas
// Ejemplo: 'users-create_user' → 'modulo-usuarios' con action: 'create_user'
// Total: 40+ funciones mapeadas para retrocompatibilidad
```

### Flujo de Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Login (index.html)                                       │
│    ├─ Email/Password                                        │
│    └─ supabase.auth.signInWithPassword()                    │
├─────────────────────────────────────────────────────────────┤
│ 2. Obtener Rol (auth.js)                                    │
│    ├─ SELECT * FROM user_roles WHERE user_id = ?           │
│    ├─ SELECT nombre FROM rol WHERE id_rol = ?              │
│    └─ Transforma: 'superadmin' → 'Superadmin'              │
├─────────────────────────────────────────────────────────────┤
│ 3. Guardar Sesión (session.js)                              │
│    └─ sessionStorage.USER_SESSION = {                       │
│       user_id, email, rol_principal, todos_roles,          │
│       nombres, apellidos, cedula, timestamp                │
│    }                                                        │
├─────────────────────────────────────────────────────────────┤
│ 4. Redireccionar (navigation)                               │
│    ├─ Superadmin    → /pages/superadmin/dashboard.html     │
│    ├─ Directivo     → /pages/directivo/dashboard.html      │
│    ├─ Docente       → /pages/docente/dashboard.html        │
│    ├─ Estudiante    → /pages/estudiante/dashboard.html     │
│    └─ ...otros      → Dashboard específico                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 🔴 BLOQUEADORES (Impiden funcionalidad)

#### 1. Tabla `user_roles` - Inconsistencia Potencial
```
RIESGO: Si la tabla user_roles no existe en BD o no se sincroniza correctamente:
├─ ❌ Login fallará (no obtiene rol)
├─ ❌ 29 Edge Functions se bloquearán
└─ ❌ Sistema de permisos colapsa

ESTADO: ⚠️ CRÍTICO - Verificar:
├─ ✓ Schema SQL crea tabla correctamente
├─ ✓ Tabla tiene índices y RLS
└─ ✓ Datos iniciales de usuarios tienen roles asignados
```

#### 2. RLS Incompleto en Tablas de Notas
```
RIESGO: Falta Row Level Security en:
├─ notas_lapso        → Docentes pueden ver notas de otros cursos
├─ notas_anuales      → Sin restricción de acceso
├─ evaluaciones_notas → Sin validación de propiedad
└─ audit_log          → Sin restricción (solo Superadmin debería)

IMPACTO: Vulnerabilidad de privacidad académica
```

#### 3. Validación de Ventana de Carga - No se Ejecuta
```
PROBLEMA:
├─ Edge function 'configurar-ventanas-carga' SÍ existe
├─ Actualiza: lapsos.inicio_carga, lapsos.fin_carga
├─ Pero el trigger 'trigger_validar_calificacion_ventana' NO se valida en carga
└─ Resultado: Docentes pueden cargar notas FUERA de ventana

FALTA: Validar en frontend ANTES de enviar notas
```

#### 4. Completitud de Notas - Manual y Opcional
```
PROBLEMA:
├─ Edge function 'verificar-completitud-notas' existe
├─ Pero NO se llama automáticamente
├─ Resultado: Docentes cierran lapso con notas faltantes

FALTA: Validación OBLIGATORIA antes de cierre
```

### 🟠 INCOMPLETOS (Funcionalidad Degradada)

#### 1. Módulo Secciones
```
ESTADO: 15% implementado

FALTA:
├─ [ ] Listado de secciones (cargar desde BD)
├─ [ ] Crear sección
├─ [ ] Editar sección
├─ [ ] Asignar docente a materia (para sección)
├─ [ ] Agregar/quitar materias
├─ [ ] Clonar sección a otro año
└─ [ ] Interfaz UI con modal y tabla

IMPACTO: Directivos no pueden gestionar cupos académicos
```

#### 2. Cargar Notas (Docente)
```
ESTADO: 20% implementado

COMPLETO:
├─ ✅ Página HTML (estructura)
├─ ✅ Modales y formularios

FALTA:
├─ [ ] Listar secciones asignadas al docente
├─ [ ] Obtener estudiantes de sección
├─ [ ] Obtener evaluaciones configuradas
├─ [ ] Carga masiva de notas en planilla
├─ [ ] Validación: Ventana de carga abierta
├─ [ ] Validación: Estudiante en estado activo
├─ [ ] Exportar planilla vacía (Excel/CSV)
├─ [ ] Importar y cargar planilla

IMPACTO: Docentes no pueden cargar calificaciones
```

#### 3. Reportería
```
ESTADO: 0% UI (100% Backend)

EXISTE:
├─ ✅ generar-datos-sabana (planilla PDF)
├─ ✅ generar-boletin-estudiante (por estudiante)
├─ ✅ generar-acta-final (fin de año)

FALTA:
├─ [ ] Interfaz UI para seleccionar sección/período
├─ [ ] Botón "Generar Sabana"
├─ [ ] Botón "Generar Boletín"
├─ [ ] Botón "Generar Acta"
├─ [ ] Descarga PDF/Excel

IMPACTO: No se pueden generar reportes oficiales
```

#### 4. Roles sin Dashboard
```
ESTADO: 0-10% implementados

FALTA:
├─ Superadmin:
│  ├─ [ ] Auditoría UI (consultar logs)
│  ├─ [ ] Gestión de sistema
│  └─ [ ] Backups y restauración
├─ Evaluación Docente:
│  ├─ [ ] Dashboard vacío
│  ├─ [ ] Asignación de docentes/materias
│  └─ [ ] Verificación de calificaciones
├─ Control Estudios:
│  ├─ [ ] Dashboard vacío
│  ├─ [ ] Carga de estudiantes masiva
│  └─ [ ] Transferencias entre secciones
└─ Estudiante:
   ├─ [ ] Dashboard vacío
   ├─ [ ] Ver propias calificaciones
   └─ [ ] Descargar boletín

IMPACTO: Roles secundarios sin funcionalidad
```

### 🟡 WARNINGS (Buenas Prácticas)

| Problema | Riesgo | Fix |
|----------|--------|-----|
| Claves públicas en código | Exposición de credenciales | Usar .env |
| Sin manejo de errores global | Errores silenciosos | Error handler middleware |
| Sin confirmaciones destructivas | Borrados accidentales | Modales de confirmación |
| Sin validación de cuota | Secciones sobrecargadas | Límite de estudiantes |
| Scripts en HEAD | Performance | Mover a END de BODY |
| Sin versioning API | Incompatibilidades | Versionado de endpoints |
| Sin logs centralizados | Debugging difícil | Logger utility |
| Sin tests E2E completos | Regresiones | Suite de tests |

---

## 6. 📝 HOJA DE RUTA PARA 100% FUNCIONAL

### Fase 1: CRÍTICA (Semana 1-2)
**Objetivo:** Funcionalidad core operativa

- [ ] **Verificar tabla `user_roles`**
  - Confirmar que se crea en BD
  - Validar índices y RLS
  - Verificar datos iniciales

- [ ] **Completar RLS en todas las tablas**
  - notas_lapso: Solo docente/admin
  - notas_anuales: Solo docente/admin
  - evaluaciones_notas: Solo propietario/admin
  - audit_log: Solo Superadmin

- [ ] **Módulo Secciones (JavaScript)**
  - Implementar listado
  - Implementar crear/editar
  - Implementar asignar docentes
  - Total: 4-6 horas

- [ ] **Cargar Notas - Validaciones**
  - Obtener estudiantes de sección
  - Validar ventana de carga
  - Carga masiva de planilla
  - Total: 6-8 horas

### Fase 2: IMPORTANTE (Semana 3-4)
**Objetivo:** Roles secundarios funcionales

- [ ] **Dashboard Evaluación Docente**
- [ ] **Dashboard Control Estudios**
- [ ] **Interfaz de Reportes** (6-8 horas)
- [ ] **Auditoría UI para Superadmin** (4 horas)
- [ ] **Dashboard Estudiante** (básico, 2 horas)

### Fase 3: MEJORA (Semana 5)
**Objetivo:** Robustez y UX

- [ ] **Error Handling Global**
- [ ] **Confirmaciones Destructivas**
- [ ] **Validación de Cuotas**
- [ ] **Logging Centralizado**
- [ ] **Tests E2E Completos**

---

## 7. 👥 ROLES Y RESPONSABILIDADES

| Rol | ID | Responsabilidades | Frontend | Backend | Status |
|-----|----|--------------------|----------|---------|--------|
| **Estudiante** | 1 | Ver propias notas, boletín | ❌ | ✅ | ❌ |
| **Control Estudios** | 2 | Cargar estudiantes, crear secciones | ❌ | ✅ | ❌ |
| **Docente** | 3 | Cargar notas, configurar evaluaciones | ⚠️ | ✅ | ⚠️ |
| **Directivo** | 4 | Gestión completa, períodos, usuarios | ⚠️ | ✅ | ⚠️ |
| **Superadmin** | 5 | TODO (auditoría, backups, sistema) | ❌ | ✅ | ❌ |

---

## 8. 🎯 RESUMEN EJECUTIVO

### Panorama Actual
```
Total Funcionalidad: 40-50%

✅ LISTO PARA USAR:
   • Login y autenticación
   • Gestión de usuarios (CRUD)
   • Gestión de períodos (crear/activar lapsos)
   • Gestión de estudiantes (inscritos)
   • Servicios de API y sesión

⚠️ PARCIALMENTE FUNCIONAL:
   • Cargar notas (sin validaciones críticas)
   • Secciones (sin CRUD completo)
   • Dashboards (sin lógica JS)

❌ NO FUNCIONAL:
   • Reportería (sin UI)
   • Auditoría (sin UI)
   • 4 de 5 dashboards de rol
```

### Puntos de Integración Críticos
```
1. Edge Function → Frontend:
   ├─ API Client (api.js) ✅ Centralizado
   ├─ Error Handling ⚠️ Incompleto
   └─ Validación Pre-envío ❌ Falta

2. BD → Edge Functions:
   ├─ RLS ⚠️ Parcial
   ├─ Triggers ✅ Implementados
   └─ Validaciones ⚠️ Incompletas

3. Sesión → Autorización:
   ├─ sessionStorage ✅ Activo
   ├─ Validación de rol ⚠️ Básica
   └─ Permisos granulares ❌ Falta
```

### Esfuerzo Estimado para Completitud
```
Fase 1 (Crítica):    40 horas (bloquea resto)
Fase 2 (Importante): 30 horas (usa core)
Fase 3 (Mejora):     20 horas (refinamiento)
─────────────────────────────
Total:               ~90 horas (2-3 semanas, 1 dev)
```

---

**Documento generado:** 2026-06-24 | **Versión:** 1.0
