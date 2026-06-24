# 📋 PLAN MAESTRO - SISTEMA GESTIÓN ACADÉMICA MULTI-ROL

**Fecha:** 21/06/2026 | **Proyecto:** Notas Henry Pittier  
**Objetivo:** Implementar sistema educativo completo con 5 roles + reportería ministerial

---

## 🎯 VISIÓN DEL SISTEMA

Sistema integrado donde cada rol tiene responsabilidades específicas y coordinadas:

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPERADMIN (Ápice)                       │
│          (Gestiona TODO, sin cambiar su clave)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DIRECTIVO ─────► Carga docentes, asigna roles            │
│      ↓           Abre/cierra períodos, gestiona personal  │
│      │                                                     │
│      ├─► EVALUACIÓN_DOCENTE ─► Asigna docentes/materias  │
│      │   (Dept. Evaluación)    Ve todas las notas         │
│      │                          Modifica notas entre lapsos│
│      │                                                     │
│      ├─► DOCENTES ───────────► Carga notas de estudiantes │
│      │                         Define % evaluaciones      │
│      │                         Ve asesorías               │
│      │                                                     │
│      └─► CONTROL_ESTUDIOS ──► Carga estudiantes          │
│          (Oficina de Estudios) Crea/transfiere secciones │
│                               Genera reportes             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

```

---

## 🏗️ ARQUITECTURA TÉCNICA REQUERIDA

### **NUEVA ESTRUCTURA DE TABLAS**

```sql
-- 1. ROLES Y PERMISOS
├── roles (id, nombre, descripcion)
├── user_roles (user_id, role_id, fecha_asignacion, activo)
└── permisos (id, rol_id, accion, recurso)

-- 2. USUARIOS Y PERFILES
├── usuarios (id, email, metadata{nombre, apellido, cedula})
├── docentes (id, user_id, especialidad, activo)
├── directivos (id, user_id, cargo, departamento, activo)
└── evaluadores (id, user_id, activo)

-- 3. ESTRUCTURA ACADÉMICA
├── anios_escolares (id, nombre, fecha_inicio, fecha_fin, activo)
├── lapsos (id, anio_id, numero, fecha_inicio, fecha_fin, activo)
├── secciones (id, anio, nombre, grado, seccion, capacidad, activo)
├── materias (id, nombre, codigo, horas, activo)
└── docente_materia_seccion (id, docente_id, materia_id, seccion_id, lapso_id)

-- 4. ESTUDIANTES
├── estudiantes (id, cedula, nombre, apellido, email, seccion_id, estado)
├── inscripciones (id, estudiante_id, seccion_id, lapso_id, anio_id)
└── traslados (id, estudiante_id, seccion_origen, seccion_destino, fecha, razon)

-- 5. EVALUACIONES Y CALIFICACIONES
├── tipos_evaluacion (id, nombre, descripcion)
├── instrumentos_evaluacion (id, nombre, descripcion)
├── evaluaciones (id, docente_id, seccion_id, lapso_id, tipo, instrumento, 
                  fecha, valor_maximo, porcentaje)
├── calificaciones (id, evaluacion_id, estudiante_id, nota, observacion, fecha)
├── ventanas_carga (id, lapso_id, fecha_inicio, fecha_fin, abierta)
└── notas_bloqueadas (id, calificacion_id, razon, fecha_bloqueo)

-- 6. ASESORÍAS
├── asesores_seccion (id, docente_id, seccion_id, activo)
└── notas_asesorias (id, asesor_id, estudiante_id, observacion, fecha)

-- 7. REPORTES Y AUDITORÍA
├── reportes_generados (id, usuario_id, tipo, fecha, archivo_url, formato)
├── audit_log (id, usuario_id, accion, tabla, fecha, cambios)
└── historicos_calificaciones (id, calificacion_id, anio_id, lapso_id, 
                               estudiante_id, nota, docente_id, fecha_archivo)
```

### **POLÍTICAS RLS REQUERIDAS**

- **Superadmin**: Acceso total a todas las tablas
- **Directivo**: Gestión de usuarios, roles, periodos, estudiantes (lectura)
- **Evaluación_Docente**: Lectura de todas las notas, edición entre lapsos
- **Docentes**: Edición de sus propias evaluaciones/notas, lectura de asesorías
- **Control_Estudios**: Gestión de estudiantes, secciones, traslados, reportes
- **Estudiantes**: Lectura de sus propias notas

---

## 📊 ROLES Y FUNCIONALIDADES DETALLADAS

### **1️⃣ SUPERADMIN**

**Panel:** Dashboard administrativo

| Funcionalidad | Acceso | Restricciones |
|---------------|--------|---------------|
| Gestionar todos los usuarios | ✅ Total | Solo en Supabase para cambiar clave |
| Asignar/revocar roles | ✅ Total | Puede crear otros superadmins |
| Ver auditoría completa | ✅ Total | Lectura: todos los logs |
| Cerrar/abrir períodos | ✅ Total | Solo si no hay períodos en transición |
| Generar reportes ejecutivos | ✅ Total | Exportar: PDF, CSV, Excel |
| Gestionar parámetros del sistema | ✅ Total | Tiempos, configuración, reglas |

**UI Requerida:**
- Dashboard con KPIs (usuarios activos, estudiantes inscritos, periodos abiertos)
- Módulo de gestión de usuarios (crear, editar, deshabilitar)
- Módulo de asignación de roles (user_roles)
- Visor de auditoría con filtros
- Panel de configuración del sistema

---

### **2️⃣ DIRECTIVO**

**Panel:** Gestión de personal y académica

| Funcionalidad | Acceso | Restricciones |
|---------------|--------|---------------|
| Cargar docentes nuevo personal | ✅ Crear | Con especialidad si es docente |
| Asignar roles (Evaluación_Docente, Control) | ✅ Crear | No a Superadmin |
| Modificar directivo (rol, cargo, nombre) | ✅ Editar | No su propia clave |
| Crear período académico | ✅ Crear | 1 activo máximo |
| Cerrar período académico | ✅ Editar | Solo si todas notas están cargadas |
| Ver panel de personal | ✅ Leer | Filtrar por rol y estado |
| Modificar email/clave (excepto propios datos) | ✅ Editar | No su cedula/nombre/apellido |
| Ver histórico de periodos | ✅ Leer | Consulta de archivo |

**UI Requerida:**
- **Módulo de Personal**: Tabla con docentes/directivos (crear, editar, estado)
- **Asignación de Roles**: Selector de rol + cargo/especialidad según rol
- **Gestión de Períodos**: Crear período, ver estado, botones cerrar
- **Perfil Directivo**: Editar email/clave, no editables: cedula/nombre/apellido
- **Reportes Directivo**: Resumen de personal, estado de periodos

---

### **3️⃣ EVALUACIÓN_DOCENTE**

**Panel:** Gestión de evaluaciones y calificaciones

| Funcionalidad | Acceso | Restricciones |
|---------------|--------|---------------|
| Asignar docentes a secciones/materias | ✅ Crear | Tabla docente_materia_seccion |
| Asignar docentes asesores | ✅ Crear | Tabla asesores_seccion |
| Ver TODAS las notas de periodo activo | ✅ Leer | Solo período académico activo |
| Modificar notas (entre lapsos) | ✅ Editar | Solo si lapso cerrado pero siguiente no abierto |
| Ver tipos evaluación usados | ✅ Leer | Consulta de docentes en sección |
| Generar reporte de evaluaciones | ✅ Leer | Por sección, lapso, período |
| Ver asesorías registradas | ✅ Leer | Comentarios de asesores |

**Restricciones Académicas:**
- 📌 Ver todas las notas del período activo
- 📌 Editar entre lapsos (no dentro de lapso activo)
- 📌 Verificar tipos de evaluación usados

**UI Requerida:**
- **Asignación de Docentes**: Tabla con secciones, selector de docente/materia
- **Asignación de Asesores**: Tabla de secciones, selector de docente asesor
- **Visor de Calificaciones**: Tabla grande con filtros (sección, lapso, materia, estudiante)
- **Editor de Notas**: Formulario modal para editar entre lapsos
- **Reporte de Evaluaciones**: Mostrar técnicas e instrumentos usados
- **Perfil Evaluador**: Editar email/clave

---

### **4️⃣ DOCENTE**

**Panel:** Carga de notas y seguimiento

| Funcionalidad | Acceso | Restricciones |
|---------------|--------|---------------|
| Ver secciones asignadas | ✅ Leer | Solo propias asignaciones |
| Crear evaluaciones | ✅ Crear | Solo si ventana abierta, solo en secciones asignadas |
| Cargar notas | ✅ Crear | Solo si ventana abierta, máximo 7 evaluaciones/sección |
| Definir % evaluaciones | ✅ Editar | Máx 25% por evaluación, total ≤100%, máx 7 evaluaciones |
| Especificar técnica de evaluación | ✅ Crear | Obligatorio: tipo_evaluacion + instrumento_evaluacion |
| Especificar instrumento | ✅ Crear | Obligatorio en cada evaluación |
| Ver notas lapsos anteriores | ✅ Leer | Mismo período, otros lapsos |
| Ver notas de asesorías | ✅ Leer | Secciones donde es asesor |

**Restricciones Técnicas:**
- 🔒 Nota máxima: 20 puntos | Nota mínima: 1 punto (inasistente)
- 🔒 Máximo 7 evaluaciones por sección/lapso
- 🔒 Suma de porcentajes ≤ 100%
- 🔒 Máximo 25% por evaluación
- 🔒 Ventana de carga: solo si ventana abierta (ventanas_carga.abierta = true)
- 🔒 No puede editar si ventana cerrada
- 🔒 No puede cambiar notas de lapsos anteriores

**UI Requerida:**
- **Dashboard Docente**: Mis secciones asignadas, lapso activo, días restantes para carga
- **Crear Evaluación**: Form con tipo, instrumento, %, fecha, estudiantes
- **Cargar Notas**: Tabla de estudiantes, validación de % y reglas
- **Ver Histórico**: Notas de lapsos anteriores, período activo
- **Asesorías**: Tabla de estudiantes en asesoría, comentarios
- **Perfil Docente**: Editar email/clave, especialidad (no editable)

---

### **5️⃣ CONTROL DE ESTUDIOS**

**Panel:** Gestión académica y reportería

| Funcionalidad | Acceso | Restricciones |
|---------------|--------|---------------|
| Cargar estudiantes | ✅ Crear | Con cedula, email, sección |
| Crear secciones | ✅ Crear | Siempre 5 años (1ero a 5to) |
| Transferir estudiantes | ✅ Editar | Entre secciones mismo año |
| Ver estudiantes por sección | ✅ Leer | Filtrar por estado |
| Generar reportes por estudiante | ✅ Leer | Récord completo académico |
| Generar reportes por sección | ✅ Leer | Notas sección, lapso, año, completo |
| Calcular promedios | ✅ Leer | Por período, lapso, materia |
| Exportar reportes | ✅ Crear | Formatos: PDF, CSV, Excel |
| Ver histórico periodos | ✅ Leer | Archivados, cerrados, activos |
| Promedios por período | ✅ Leer | Cálculo automático |
| Promedios por lapso | ✅ Leer | Cálculo automático |
| Promedios por materia | ✅ Leer | Cálculo automático |

**Cálculos Requeridos:**
- 📊 Promedio por lapso = (Sum notas * peso%) / Sum pesos
- 📊 Promedio por período = (Sum promedios lapsos) / cantidad lapsos
- 📊 Promedio por materia = (Sum notas en materia) / cantidad evaluaciones
- 📊 Resumen académico = promedio general

**UI Requerida:**
- **Gestión de Estudiantes**: Tabla (crear, editar, ver, transferir)
- **Gestión de Secciones**: CRUD de 5 secciones por año
- **Transferencias**: Formulario sección origen → destino + razon
- **Reportes - Estudiante**: Récord completo, notas todas materias
- **Reportes - Sección**: Por lapso, año, o histórico
- **Reportes - Promedios**: Tabla con cálculos automáticos
- **Exportar Reportes**: Botones PDF/CSV/Excel
- **Perfil**: Editar email/clave
- **Histórico**: Tabla de periodos guardados

---

## 🗄️ TABLAS NUEVAS A CREAR

### **Tabla: `roles`**
```sql
CREATE TABLE public.roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (nombre, descripcion) VALUES
  ('Superadmin', 'Acceso total al sistema'),
  ('Directivo', 'Gestión de personal y períodos'),
  ('Evaluacion_docente', 'Gestión de evaluaciones y calificaciones'),
  ('Docente', 'Carga de notas y seguimiento'),
  ('Control_estudios', 'Gestión de estudiantes y reportes'),
  ('Estudiante', 'Visualización de notas propias');
```

### **Tabla: `user_roles` (CRÍTICA)**
```sql
CREATE TABLE public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES public.roles(id),
  asignado_por UUID REFERENCES auth.users(id),
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion TIMESTAMP,
  activo BOOLEAN DEFAULT true,
  UNIQUE(user_id, role_id)
);
```

### **Tabla: `secciones` (CRÍTICA)**
```sql
CREATE TABLE public.secciones (
  id SERIAL PRIMARY KEY,
  anio_escolar_id INTEGER NOT NULL REFERENCES public.anios_escolares(id),
  grado INTEGER NOT NULL CHECK (grado BETWEEN 1 AND 5),
  letra VARCHAR(1) NOT NULL,
  capacidad INTEGER DEFAULT 35,
  docente_principal_id UUID REFERENCES auth.users(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(anio_escolar_id, grado, letra)
);
```

### **Tabla: `ventanas_carga`**
```sql
CREATE TABLE public.ventanas_carga (
  id SERIAL PRIMARY KEY,
  lapso_id INTEGER NOT NULL REFERENCES public.lapsos(id),
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP NOT NULL,
  abierta BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Tabla: `docente_materia_seccion`** (ya existe, verificar)
```sql
CREATE TABLE public.docente_materia_seccion (
  id SERIAL PRIMARY KEY,
  docente_id UUID NOT NULL REFERENCES auth.users(id),
  materia_id INTEGER NOT NULL REFERENCES public.materias(id),
  seccion_id INTEGER NOT NULL REFERENCES public.secciones(id),
  lapso_id INTEGER NOT NULL REFERENCES public.lapsos(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(docente_id, materia_id, seccion_id, lapso_id)
);
```

### **Tabla: `asesores_seccion`**
```sql
CREATE TABLE public.asesores_seccion (
  id SERIAL PRIMARY KEY,
  docente_id UUID NOT NULL REFERENCES auth.users(id),
  seccion_id INTEGER NOT NULL REFERENCES public.secciones(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(docente_id, seccion_id)
);
```

### **Tabla: `tipos_evaluacion`**
```sql
CREATE TABLE public.tipos_evaluacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true
);

INSERT INTO tipos_evaluacion (nombre) VALUES
  ('Prueba Escrita'),
  ('Prueba Oral'),
  ('Trabajo Práctico'),
  ('Proyecto'),
  ('Participación'),
  ('Exposición'),
  ('Evaluación Continua');
```

### **Tabla: `instrumentos_evaluacion`**
```sql
CREATE TABLE public.instrumentos_evaluacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true
);

INSERT INTO instrumentos_evaluacion (nombre) VALUES
  ('Cuestionario'),
  ('Rúbrica'),
  ('Escala de Estimación'),
  ('Lista de Cotejo'),
  ('Observación Directa'),
  ('Portafolio'),
  ('Ensayo'),
  ('Proyecto'),
  ('Participación en Clase');
```

### **Tabla: `evaluaciones`**
```sql
CREATE TABLE public.evaluaciones (
  id SERIAL PRIMARY KEY,
  docente_id UUID NOT NULL REFERENCES auth.users(id),
  seccion_id INTEGER NOT NULL REFERENCES public.secciones(id),
  lapso_id INTEGER NOT NULL REFERENCES public.lapsos(id),
  materia_id INTEGER NOT NULL REFERENCES public.materias(id),
  tipo_evaluacion_id INTEGER NOT NULL REFERENCES public.tipos_evaluacion(id),
  instrumento_id INTEGER NOT NULL REFERENCES public.instrumentos_evaluacion(id),
  fecha TIMESTAMP NOT NULL,
  valor_maximo DECIMAL(5,2) NOT NULL CHECK (valor_maximo <= 20 AND valor_maximo >= 1),
  porcentaje DECIMAL(5,2) NOT NULL CHECK (porcentaje <= 25 AND porcentaje > 0),
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Tabla: `calificaciones`**
```sql
CREATE TABLE public.calificaciones (
  id SERIAL PRIMARY KEY,
  evaluacion_id INTEGER NOT NULL REFERENCES public.evaluaciones(id),
  estudiante_id UUID NOT NULL REFERENCES auth.users(id),
  nota DECIMAL(5,2) NOT NULL CHECK (nota BETWEEN 1 AND 20),
  asistencia BOOLEAN DEFAULT true,
  observacion TEXT,
  fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modificado_por UUID REFERENCES auth.users(id),
  fecha_modificacion TIMESTAMP,
  UNIQUE(evaluacion_id, estudiante_id)
);
```

### **Tabla: `historicos_calificaciones`**
```sql
CREATE TABLE public.historicos_calificaciones (
  id SERIAL PRIMARY KEY,
  calificacion_id INTEGER NOT NULL REFERENCES public.calificaciones(id),
  anio_escolar_id INTEGER NOT NULL REFERENCES public.anios_escolares(id),
  lapso_id INTEGER NOT NULL REFERENCES public.lapsos(id),
  estudiante_id UUID NOT NULL REFERENCES auth.users(id),
  nota DECIMAL(5,2) NOT NULL,
  docente_id UUID NOT NULL REFERENCES auth.users(id),
  materia_id INTEGER NOT NULL REFERENCES public.materias(id),
  fecha_archivo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  periodo_cierre TIMESTAMP
);
```

---

## 🔐 POLÍTICAS RLS NECESARIAS

### **Política para: `user_roles`**
```sql
-- Superadmin ve todo
CREATE POLICY "superadmin_user_roles" ON user_roles
  FOR ALL USING (auth.uid() = ANY(ARRAY(
    SELECT user_id FROM user_roles WHERE role_id = 1 AND activo
  )));

-- Directivo ve roles del sistema (no Superadmin)
CREATE POLICY "directivo_user_roles" ON user_roles
  FOR SELECT USING (
    auth.uid() = ANY(ARRAY(
      SELECT user_id FROM user_roles WHERE role_id = 2 AND activo
    )) AND role_id != 1
  );
```

### **Política para: `secciones`**
```sql
-- Directivo ve todas
CREATE POLICY "directivo_secciones" ON secciones
  FOR ALL USING (
    auth.uid() = ANY(ARRAY(
      SELECT user_id FROM user_roles WHERE role_id = 2 AND activo
    ))
  );

-- Estudiante ve su sección
CREATE POLICY "estudiante_secciones" ON secciones
  FOR SELECT USING (
    id IN (SELECT seccion_id FROM inscripciones WHERE estudiante_id = auth.uid())
  );
```

### **Política para: `calificaciones`**
```sql
-- Docente ve/edita sus notas durante ventana abierta
CREATE POLICY "docente_calificaciones" ON calificaciones
  FOR ALL USING (
    evaluacion_id IN (
      SELECT id FROM evaluaciones WHERE docente_id = auth.uid()
    ) AND
    lapso_id IN (SELECT id FROM lapsos WHERE estado = 'activo')
  );

-- Evaluador ve todas durante período activo
CREATE POLICY "evaluador_calificaciones" ON calificaciones
  FOR ALL USING (
    auth.uid() = ANY(ARRAY(
      SELECT user_id FROM user_roles WHERE role_id = 3 AND activo
    )) AND
    evaluacion_id IN (
      SELECT id FROM evaluaciones WHERE lapso_id IN (
        SELECT id FROM lapsos WHERE anio_id IN (
          SELECT id FROM anios_escolares WHERE activo
        )
      )
    )
  );
```

---

## 📱 COMPONENTES UI/UX A CREAR

### **Módulos Nuevos Principales**

| Módulo | Ubicación | Prioridad | Complejidad |
|--------|-----------|-----------|------------|
| Dashboard Superadmin | `/pages/superadmin/` | 🔴 CRÍTICA | Alta |
| Gestión de Usuarios | `/pages/admin/` | 🔴 CRÍTICA | Alta |
| Gestión de Roles | `/pages/admin/` | 🔴 CRÍTICA | Media |
| Asignación Docentes | `/pages/evaluacion/` | 🔴 CRÍTICA | Media |
| Carga de Notas Docente | `/pages/docente/` | 🔴 CRÍTICA | Alta |
| Visor de Calificaciones | `/pages/evaluacion/` | 🔴 CRÍTICA | Alta |
| Gestión de Secciones | `/pages/control_estudios/` | 🟠 ALTA | Media |
| Reportes | `/pages/reportes/` | 🟠 ALTA | Alta |
| Perfil Usuario | `/pages/perfil/` | 🟡 MEDIA | Baja |

### **Edge Functions Nuevas** (29/36 bloqueadas)

| Función | Prioridad | Dependencia |
|---------|-----------|------------|
| `assign-role` | 🔴 | user_roles tabla |
| `remove-role` | 🔴 | user_roles tabla |
| `list-user-roles` | 🔴 | user_roles tabla |
| `create-docente` | 🔴 | user_roles tabla |
| `assign-docente-materia` | 🔴 | secciones tabla |
| `get-secciones` | 🔴 | secciones tabla |
| `create-evaluacion` | 🔴 | evaluaciones tabla |
| `upload-notas` | 🔴 | calificaciones tabla |
| `get-calificaciones` | 🔴 | calificaciones tabla |
| `generate-reportes` | 🟠 | historicos tabla |

---

## 📅 CRONOGRAMA DE IMPLEMENTACIÓN

### **FASE 1: INFRAESTRUCTURA (Días 1-3)** 🔴 CRÍTICA
- ✅ Crear tablas nuevas (roles, user_roles, secciones, ventanas_carga, etc.)
- ✅ Crear políticas RLS completas
- ✅ Crear triggers para validaciones
- ✅ Verificar integridad referencial
- ✅ Seed de datos iniciales

**Duración:** 8 horas | **Bloqueador:** Sí

### **FASE 2: AUTENTICACIÓN Y ROLES (Días 3-4)** 🔴 CRÍTICA
- ✅ Actualizar middleware de autenticación
- ✅ Crear Edge Functions de roles
- ✅ Implementar checks de permisos
- ✅ Actualizar auth.js con nuevos roles

**Duración:** 6 horas | **Bloqueador:** Sí

### **FASE 3: UI MÓDULOS CRÍTICOS (Días 4-7)** 🟠 ALTA
- ✅ Dashboard Superadmin
- ✅ Gestión de Usuarios (CRUD)
- ✅ Gestión de Roles (asignar/revocar)
- ✅ Módulo de Docente (carga notas)
- ✅ Visor Evaluación (todas las notas)

**Duración:** 16 horas | **Bloqueador:** Parcial

### **FASE 4: REPORTERÍA Y CÁLCULOS (Días 7-10)** 🟠 ALTA
- ✅ Edge Functions de reportes
- ✅ Cálculo de promedios (período, lapso, materia)
- ✅ Exportar PDF/CSV/Excel
- ✅ Módulo de Reportes en UI

**Duración:** 12 horas | **Bloqueador:** No

### **FASE 5: COMPLEMENTARIOS (Días 10-12)** 🟡 MEDIA
- ✅ Perfil usuario mejorado
- ✅ Histórico académico
- ✅ Validaciones faltantes
- ✅ Testing completo

**Duración:** 8 horas | **Bloqueador:** No

---

## ✅ CHECKLIST DE VALIDACIONES

### **Académicas (Ministerio)**
- [ ] Máximo 7 evaluaciones por materia/lapso
- [ ] Máximo 25% por evaluación
- [ ] Suma de % ≤ 100%
- [ ] Escala 1-20 puntos
- [ ] Tipos de evaluación y instrumentos documentados
- [ ] Histórico completo de calificaciones
- [ ] Promedios por período, lapso, materia
- [ ] Reportes en PDF/CSV/Excel

### **Seguridad (Roles/Permisos)**
- [ ] RLS activas en todas tablas sensibles
- [ ] Docente no edita notas pasado lapso
- [ ] Evaluador no puede asignar roles
- [ ] Superadmin no edita su propia clave desde app
- [ ] Directivo no puede cambiar su cedula/nombre
- [ ] Control_Estudios no ve datos de personal

### **Usabilidad**
- [ ] UI responsivo en móvil
- [ ] Errores claros en español
- [ ] Validaciones en tiempo real
- [ ] Exportes funcionan correctamente
- [ ] Filtros permiten búsquedas rápidas

---

## 🚨 PUNTOS DE RIESGO

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Datos de notas inconsistentes | Alto | Triggers + validaciones |
| RLS no funcionan correctamente | Alto | Testing exhaustivo |
| Cálculo de promedios erróneo | Alto | Fórmulas auditadas |
| Pérdida de datos históricos | Crítico | Backup + históricos tabla |
| Bloqueo de modificación de notas | Medio | Lógica clara de ventanas |
| Exportación lenta (muchos estudiantes) | Bajo | Caché + índices |

---

## 📞 PRÓXIMOS PASOS

1. **Validar que ENTIENDES esta especificación completa**
2. **Comenzar FASE 1** (Infraestructura)
3. **Hacer script SQL** con todas las tablas
4. **Testear RLS** en Supabase
5. **Reportar bloqueadores** que surjan

---

**Generado:** 2026-06-21 | **Versión:** 1.0 | **Estado:** Listo para implementación
