# 🔴 AUDITORÍA TÉCNICA: GAPS BACKEND-FRONTEND

## RESUMEN EJECUTIVO

**El frontend en `js/services/api.js` está COMPLETAMENTE DESFASADO del backend real.**

- ❌ ~70% de los métodos en `api.js` llaman endpoints que NO EXISTEN
- ❌ Edge Functions reales NO están siendo usadas
- ❌ Estructura de request/response NO coincide
- ❌ Los nombres de "action" NO coinciden entre documentación y código real

---

## 1. EDGE FUNCTIONS REALES vs FRONTEND

### ✅ modulo-usuarios
**URL:** `https://slwbzfxwrxrsnlizapps.supabase.co/functions/v1/modulo-usuarios`  
**Método:** `POST`  
**Body:** `{ action: string, data: {...} }`

#### Acciones Implementadas:
```javascript
// ✅ EXISTE Y DOCUMENTADA
{
  action: 'consultar-auditoria',
  data: {
    tabla?: string,
    operacion?: string,
    usuario_id?: string,
    registro_id?: string,
    limit?: number
  }
}
// → Response: { ok, conteo, registros }

// ✅ EXISTE
{
  action: 'list_users',
  data: {}
}
// → Response: Array de usuarios con roles

// ✅ EXISTE
{
  action: 'create_user',
  data: {
    email,
    password,
    username,
    nombres,
    apellidos,
    cedula,
    id_rol
  }
}
// → Response: { ok, user }
```

#### ⚠️ PROBLEMAS:
- `api.js` llama a `users-list_users` (INCORRECTO → debe ser `modulo-usuarios` con action `list_users`)
- `api.js` llama a `users-create_user` (INCORRECTO → debe ser `modulo-usuarios` con action `create_user`)
- No hay método en `api.js` para `consultar-auditoria` (PERO EXISTE en backend)

---

### ✅ modulo-periodos
**URL:** `https://.../functions/v1/modulo-periodos`  
**Método:** `POST`  
**Body:** `{ action: string, params: {...} }` ← ¡USA `params` NO `data`!

#### Acciones Implementadas:
```javascript
// ✅ EXISTE
{
  action: 'configurar-ventanas-carga',
  params: {
    id_lapso: number,
    inicio_carga: "2026-06-23T08:00:00Z",
    fin_carga: "2026-07-15T23:59:59Z"
  }
}

// ✅ EXISTE
{
  action: 'status_ventanas_carga',
  params: { id_anio: number }
}

// ✅ EXISTE
{
  action: 'check_readiness_cierre',
  params: { id_lapso: number }
}

// ✅ EXISTE (según docs)
{
  action: 'crear_anio',
  params: { nombre, ...}
}

// ✅ EXISTE (según docs)
{
  action: 'crear_lapso',
  params: { anio_id, numero, ...}
}

// ✅ EXISTE (según docs)
{
  action: 'activar_lapso',
  params: { id_lapso }
}
```

#### ⚠️ PROBLEMAS:
- `api.js` llama a `periodos-list_anios`, `periodos-create_anio`, etc. (INCORRECTO)
- Debe ser UN SOLO endpoint: `modulo-periodos` con acciones específicas
- `api.js` usa `data`, backend espera `params`
- Las acciones reales incluyen: `crear_anio`, `cerrar_anio`, `crear_lapso`, `activar_lapso`, `cerrar_lapso`, `obtener_activo`, `listar_lapsos`

---

### ✅ modulo-estudiantes
**URL:** `https://.../functions/v1/modulo-estudiantes`  
**Método:** `POST`  
**Body:** `{ action: string, data: {...} }`

#### Acciones Implementadas:
```javascript
// ✅ EXISTE
{
  action: 'listar',
  data: { 
    search?: string  // Búsqueda multicampo
  }
}
// Restricción: Docentes solo ven sus secciones

// ✅ EXISTE
{
  action: 'inscribir',
  data: {
    cedula,
    nombres,
    apellidos,
    fecha_nacimiento,
    sexo,
    seccion_id,
    anio_escolar_id
  }
}

// ✅ EXISTE
{
  action: 'cambiar_seccion',
  data: {
    estudiante_id,
    seccion_id,
    anio_escolar_id
  }
}

// ✅ EXISTE
{
  action: 'promover',
  data: {
    estudiante_id,
    anio_origen_id,
    anio_destino_id,
    seccion_destino_id
  }
}

// ✅ EXISTE (según docs)
{
  action: 'repetir',
  data: { estudiante_id, anio_escolar_id }
}

// ✅ EXISTE (según docs)
{
  action: 'retirar',
  data: { estudiante_id, anio_escolar_id }
}
```

#### ⚠️ PROBLEMAS:
- `api.js` llama a endpoints separados (`listar-estudiantes`, `inscribir-estudiante`, etc.) - NO EXISTEN
- Todos estos deben ir a `modulo-estudiantes` con acciones específicas
- `api.js` NUNCA llama a `modulo-estudiantes`

---

### ⚠️ modulo-secciones
**URL:** `https://.../functions/v1/modulo-secciones`  
**Método:** `POST`  
**Body:** `{ action: string, data: {...} }`

#### Acciones Implementadas (según código en el archivo):
```javascript
action: 'listar'        // ← pero api.js llama 'listar-secciones'
action: 'crear'         // ← pero api.js llama 'crear-seccion'
action: 'editar'        // ← pero api.js llama 'editar-seccion'
action: 'toggle_status' // ← pero api.js llama 'toggle-seccion'
action: 'clonar'        // ← pero api.js llama 'clonar-seccion-otro-anio'
action: 'asignar-asesor' // ← pero api.js llama 'asignar-docente'
```

#### ⚠️ PROBLEMAS:
- **ACTION NAMES NO COINCIDEN** entre `api.js` y backend
- `api.js` usa: `listar-secciones`, `crear-seccion`, `editar-seccion`, etc.
- Backend real usa: `listar`, `crear`, `editar`, `toggle_status`, `clonar`, `asignar-asesor`

---

### ⚠️ modulo-notas
**URL:** `https://.../functions/v1/modulo-notas`  
**Body:** `{ action: string, data: {...} }`

#### Acciones Implementadas:
```javascript
action: 'configurar-planilla'     // ✅ Llamado desde api.js
action: 'registrar-planilla'      // ✅ Llamado desde api.js
action: 'corregir-individual'     // ⚠️ NO llamado
action: 'obtener-planilla-llenada' // ⚠️ NO llamado
action: 'finalizar-lapso'         // ⚠️ NO llamado
action: 'verificar-completitud-notas' // ⚠️ NO llamado
```

---

### ❌ modulo-evaluaciones
**URL:** `https://.../functions/v1/modulo-evaluaciones`

#### Documentación dice: `crear-evaluacion`  
#### Código REAL solo implementa:
```javascript
action: 'registrar_notas'
action: 'generar_sabana'
```

#### ⚠️ PROBLEMA CRÍTICO:
- **`crear-evaluacion` NO EXISTE EN EL CÓDIGO**
- La documentación está DESACTUALIZADA
- `api.js` y `cargar-notas.js` esperan `crear-evaluacion` QUE NO EXISTE

---

### ❌ modulo-materias
**URL:** `https://.../functions/v1/modulo-materias`  
**Status:** EXISTE pero NUNCA ES LLAMADO desde `api.js`

#### Acciones:
```javascript
action: 'agregar_materia_seccion'
action: 'quitar_materia_seccion'
```

---

### ❌ modulo-reportes
**URL:** `https://.../functions/v1/modulo-reportes`  
**Status:** EXISTE pero NUNCA ES LLAMADO desde `api.js`

#### Acciones:
```javascript
action: 'generar-datos-sabana'
action: 'generar-boletin-estudiante'
action: 'generar-acta-final'
```

---

### 🆗 ping & debug
- ✅ Existen
- ⚠️ No son usados en `api.js`

---

## 2. MATRIZ COMPARATIVA: LO QUE DEBERÍA HABER

| Funcionalidad | Endpoint en api.js | Endpoint REAL | Status |
|---|---|---|---|
| **USUARIOS** | | | |
| Listar | `users-list_users` | `modulo-usuarios` + `list_users` | ❌ Incorrecto |
| Crear | `users-create_user` | `modulo-usuarios` + `create_user` | ❌ Incorrecto |
| Consultar Auditoría | ❌ NO EXISTE | `modulo-usuarios` + `consultar-auditoria` | ❌ Falta |
| **PERÍODOS** | | | |
| Listar Años | `periodos-list_anios` | `modulo-periodos` + `listar_lapsos` | ❌ Incorrecto |
| Crear Año | `periodos-create_anio` | `modulo-periodos` + `crear_anio` | ❌ Incorrecto (params vs data) |
| Crear Lapso | `periodos-create_lapso` | `modulo-periodos` + `crear_lapso` | ❌ Incorrecto (params vs data) |
| Activar Lapso | `periodos-activate_lapso` | `modulo-periodos` + `activar_lapso` | ❌ Incorrecto (params vs data) |
| Configurar Ventana | ❌ NO EXISTE | `modulo-periodos` + `configurar-ventanas-carga` | ❌ Falta |
| Verificar Readiness | ❌ NO EXISTE | `modulo-periodos` + `check_readiness_cierre` | ❌ Falta |
| **ESTUDIANTES** | | | |
| Listar | `listar-estudiantes` | `modulo-estudiantes` + `listar` | ❌ Incorrecto |
| Inscribir | `inscribir-estudiante` | `modulo-estudiantes` + `inscribir` | ❌ Incorrecto |
| Cambiar Sección | `cambiar-seccion` | `modulo-estudiantes` + `cambiar_seccion` | ❌ Incorrecto |
| Promover | `promover-estudiante` | `modulo-estudiantes` + `promover` | ❌ Incorrecto |
| Repetir | `repetir-grado` | `modulo-estudiantes` + `repetir` | ❌ Incorrecto |
| Retirar | `retirar-estudiante` | `modulo-estudiantes` + `retirar` | ❌ Incorrecto |
| **SECCIONES** | | | |
| Listar | `secciones-listar-secciones` | `modulo-secciones` + `listar` | ❌ Action mismatch |
| Crear | `secciones-crear-seccion` | `modulo-secciones` + `crear` | ❌ Action mismatch |
| Editar | `secciones-editar-seccion` | `modulo-secciones` + `editar` | ❌ Action mismatch |
| Asignar Docente | `secciones-asignar-docente` | `modulo-secciones` + `asignar-asesor` | ❌ Action mismatch |
| **NOTAS** | | | |
| Crear Evaluación | `crear-evaluacion` | ❌ NO EXISTE | 🔴 CRÍTICO |
| Registrar Notas | `modulo-notas` + `registrar-planilla` | `modulo-notas` + `registrar-planilla` | ✅ OK |
| Verificar Completitud | ❌ NO EXISTE | `modulo-notas` + `verificar-completitud-notas` | ❌ Falta |
| **REPORTES** | | | |
| Generar Reportes | ❌ NO EXISTEN | `modulo-reportes` + acciones | ❌ No integrado |

---

## 3. RESUMEN DE PROBLEMAS

### 🔴 CRÍTICOS

1. **`crear-evaluacion` NO EXISTE en backend**
   - `cargar-notas.js` intenta crear evaluaciones
   - `modulo-evaluaciones` solo tiene `registrar_notas` y `generar_sabana`
   - **IMPACTO:** La funcionalidad de crear evaluaciones está ROTA

2. **Endpoint fantasma: `users-create_user`, `users-list_users`, etc.**
   - `api.js` usa endpoints que no existen
   - Deben ser `modulo-usuarios` con acciones
   - **IMPACTO:** Gestión de usuarios NO FUNCIONA

3. **Endpoint fantasma: `periodos-create_anio`, `periodos-list_anios`, etc.**
   - `api.js` usa endpoints separados
   - Backend agrupa todo en `modulo-periodos`
   - Body usa `params` no `data`
   - **IMPACTO:** Gestión de períodos NO FUNCIONA

### 🟠 ALTOS

4. **Endpoints fantasma: `listar-estudiantes`, `inscribir-estudiante`, etc.**
   - `api.js` usa endpoints separados
   - Backend es `modulo-estudiantes` con acciones
   - **IMPACTO:** Gestión de estudiantes NO FUNCIONA

5. **Action names no coinciden en secciones**
   - `api.js`: `listar-secciones`
   - Backend: `listar`
   - **IMPACTO:** Gestión de secciones PARCIALMENTE FUNCIONA

6. **`modulo-materias` NUNCA se llama desde frontend**
   - Existe en backend pero no integrado
   - **IMPACTO:** Funcionalidad de materias no usada

7. **`modulo-reportes` NUNCA se llama desde frontend**
   - Existe en backend pero no integrado
   - **IMPACTO:** Reportería no disponible

---

## 4. CONCLUSIÓN

**EL SISTEMA NO FUNCIONA COMO ESTÁ AHORA**

Para que funcione correctamente, se debe:

### Opción A: Corregir `api.js` para usar endpoints reales (RECOMENDADO)
- Cambiar todos los endpoints fantasma
- Actualizar estructura de requests (data vs params)
- Hacer que `crear-evaluacion` use `modulo-notas` o agregar la acción a `modulo-evaluaciones`

### Opción B: Crear los endpoints que faltan en backend (MÁS TRABAJO)
- Implementar edge functions separadas para cada recurso
- Alinear con estructura esperada por `api.js`

**Se recomienda Opción A: Corregir el frontend para usar los endpoints reales que ya existen.**

---

**Documento generado:** 24 Junio 2026
**Estado:** ANÁLISIS TÉCNICO COMPLETADO
