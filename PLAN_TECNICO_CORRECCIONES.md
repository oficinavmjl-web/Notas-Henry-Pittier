# 🔧 PLAN TÉCNICO DE CORRECCIONES

**Fecha:** 2026-06-21  
**Prioridad:** CRÍTICA  
**Responsable:** Equipo de Backend

---

## 🎯 PROBLEMAS CRÍTICOS A RESOLVER (EN ORDEN DE PRIORIDAD)

---

## 1️⃣ CREAR TABLA `user_roles` 🔴 CRÍTICA

### Impacto
- 29 edge functions bloqueadas
- Sistema de permisos incompleto
- Login no completa asignación de roles

### Solución: Script SQL

```sql
-- 1. Crear tabla user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- 2. Crear índices
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);

-- 3. Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
CREATE POLICY "users_can_view_own_roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "directivos_can_manage_roles" ON public.user_roles
  FOR ALL USING (4 IN (SELECT current_user_roles()));

CREATE POLICY "superadmin_all_user_roles" ON public.user_roles
  FOR ALL USING (5 IN (SELECT current_user_roles()))
  WITH CHECK (5 IN (SELECT current_user_roles()));

-- 5. Insertar roles de usuarios desde auth.users metadata
INSERT INTO public.user_roles (user_id, role_id)
SELECT id, (raw_user_meta_data ->> 'role_id')::integer 
FROM auth.users 
WHERE raw_user_meta_data ->> 'role_id' IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_timestamp
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_roles_timestamp();
```

### Archivos a Actualizar
- Edge functions ya tienen referencias a `user_roles` (revisar sintaxis)
- `auth.js` - Usar tabla para obtener rol en login
- `modulo_usuarios.js` - Agregar interfaz para asignar roles

### Roles y IDs
| Rol ID | Nombre | Descripción |
|--------|--------|-------------|
| 1 | Estudiante | Acceso limitado a datos propios |
| 2 | Control de Estudios | Gestión de inscripciones y registros |
| 3 | Evaluador/Docente | Crear evaluaciones y calificaciones |
| 4 | Directivo | Gestión completa de institución |
| 5 | Superadmin | Acceso sin restricciones |

**Esfuerzo:** 2-3 horas  
**Testing necesario:** Verificar que login obtiene rol correcto

---

## 2️⃣ CORREGIR REFERENCIAS A `perfiles` → `docentes` 🔴 CRÍTICA

### Archivos Afectados (8)
1. `users-create_user.txt`
2. `users-delete_user.txt`
3. `users-disable_user.txt`
4. `users-enable_user.txt`
5. `users-get_user.txt`
6. `users-list_users.txt`
7. `users-reset_password.txt`
8. `users-update_user.txt`

### Cambios Requeridos

**ANTES:**
```typescript
const { data: perfil } = await supabase
  .from("perfiles")
  .select("*")
  .eq("id", user_id)
  .single();
```

**DESPUÉS:**
```typescript
const { data: docente } = await supabase
  .from("docentes")
  .select("*")
  .eq("id", user_id)
  .single();
```

### Script de Corrección

```bash
# Reemplazar en todos los archivos users-*.txt
cd /supabase/edge_functions

for file in users-*.txt; do
  sed -i 's/from("perfiles")/from("docentes")/g' "$file"
  sed -i 's/\.eq("id_docente"/\.eq("id"/g' "$file"
done
```

### Verificar Esquema de `docentes`
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'docentes';
```

**Esperado:**
- id (UUID)
- username (varchar)
- nombres (varchar)
- apellidos (varchar)
- activo (boolean)
- created_at (timestamp)

**Si falta campo `cedula`:** Agregarlo
```sql
ALTER TABLE public.docentes 
ADD COLUMN cedula VARCHAR(20) UNIQUE;
```

**Esfuerzo:** 1 hora  
**Testing:** Testear users-get_user, users-create_user, users-list_users

---

## 3️⃣ VERIFICAR/CREAR TABLA `secciones` 🔴 CRÍTICA

### Archivos Afectados (5)
1. `cambiar-seccion.txt` - 2 referencias
2. `inscribir-estudiante.txt` - 1 referencia
3. `repetir-grado.txt` - 2 referencias
4. `promover-estudiante.txt` - 1 referencia
5. `secciones-*.txt` (11 archivos)

### Verificar si Existe
```sql
SELECT EXISTS(
  SELECT FROM information_schema.tables 
  WHERE table_name = 'secciones'
);
```

### Si NO existe, crear:
```sql
CREATE TABLE IF NOT EXISTS public.secciones (
  id_seccion SERIAL PRIMARY KEY,
  grado INTEGER NOT NULL,
  nombre VARCHAR(50),
  anio_escolar_id INTEGER NOT NULL REFERENCES public.anios_escolares(id_anio),
  docente_id UUID,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_secciones_anio ON public.secciones(anio_escolar_id);
CREATE INDEX idx_secciones_grado ON public.secciones(grado);
CREATE INDEX idx_secciones_activo ON public.secciones(activo);

-- RLS
ALTER TABLE public.secciones ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "secciones_read_all" ON public.secciones
  FOR SELECT USING (true);

CREATE POLICY "secciones_write_directivo" ON public.secciones
  FOR ALL USING (4 IN (SELECT current_user_roles()))
  WITH CHECK (4 IN (SELECT current_user_roles()));

CREATE POLICY "secciones_superadmin" ON public.secciones
  FOR ALL USING (5 IN (SELECT current_user_roles()))
  WITH CHECK (5 IN (SELECT current_user_roles()));
```

### Si existe, verificar esquema:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'secciones'
ORDER BY ordinal_position;
```

**Campos requeridos:**
- id_seccion (primary key)
- grado (integer)
- nombre (varchar)
- anio_escolar_id (integer FK)
- docente_id (uuid FK)
- activo (boolean)
- created_at (timestamp)

### Migrar Datos (si existe con otro nombre)
```sql
-- Si la tabla se llama "section" o "secciones_new"
INSERT INTO public.secciones 
SELECT * FROM public.section;  -- Ajustar según corresponda
```

**Esfuerzo:** 2-3 horas  
**Testing:** Testear cambiar-seccion, inscribir-estudiante

---

## 4️⃣ CORREGIR REFERENCIAS EN EDGE FUNCTIONS 🟠 IMPORTANTE

### Problemas Identificados

#### cambiar-seccion.txt
```typescript
// LÍNEA 54 - Error de nombre de campo
// ANTES:
.select("id_seccion, grado_id, activo")  // ❌ grado_id no existe

// DESPUÉS:
.select("id_seccion, grado, activo")  // ✅ usar grado
```

#### inscribir-estudiante.txt
```typescript
// LÍNEA 93 - Error de nombre de campo
// ANTES:
.select("id_anio_escolar, activo")  // ❌ id_anio_escolar no existe

// DESPUÉS:
.select("id_anio, activo")  // ✅ usar id_anio
```

#### repetir-grado.txt
```typescript
// Múltiples errores - mismos cambios que arriba
// grado_id → grado
// id_anio_escolar → id_anio
```

### Script de Verificación y Corrección

```bash
#!/bin/bash

# Verificar todos los archivos .txt
cd /supabase/edge_functions

echo "=== Archivos con 'grado_id' ===" 
grep -l "grado_id" *.txt

echo "=== Archivos con 'id_anio_escolar' ==="
grep -l "id_anio_escolar" *.txt

echo "=== Archivos con 'perfiles' ==="
grep -l 'from("perfiles")' *.txt
```

**Esfuerzo:** 1-2 horas  
**Testing:** Ejecutar cada edge function con datos de prueba

---

## 5️⃣ CREAR EDGE FUNCTIONS FALTANTES 🟠 IMPORTANTE

### Crear: `roles-asignar`
```typescript
// POST /functions/roles-asignar
// Body: { user_id: UUID, role_id: number }

export async function POST(req: Request) {
  const { user_id, role_id } = await req.json();
  
  const supabase = createClient();
  
  // Validar que solo directivo/superadmin puede hacer esto
  const roles = await getCurrentUserRoles(supabase);
  if (![4, 5].some(r => roles.includes(r))) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }
  
  // Asignar rol
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id, role_id }, { onConflict: "user_id,role_id" });
  
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  
  return new Response(JSON.stringify({ ok: true }));
}
```

### Crear: `roles-obtener`
```typescript
// GET /functions/roles-obtener?user_id=UUID

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user_id = url.searchParams.get("user_id");
  
  const supabase = createClient();
  
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user_id);
  
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  
  return new Response(JSON.stringify({ roles: roles.map(r => r.role_id) }));
}
```

### Crear: `evaluaciones-crear`
```typescript
// POST /functions/evaluaciones-crear
// Body: { seccion_id, materia_id, nombre, descripcion, fecha_cierre }

export async function POST(req: Request) {
  const { seccion_id, materia_id, nombre, descripcion, fecha_cierre } = await req.json();
  const supabase = createClient();
  const docente_id = (await supabase.auth.getUser()).data.user.id;
  
  // Verificar que el docente enseña esta materia en esta sección
  const { data: asignacion } = await supabase
    .from("docente_materia_seccion")
    .select("*")
    .eq("docente_id", docente_id)
    .eq("materia_id", materia_id)
    .eq("seccion_id", seccion_id)
    .single();
  
  if (!asignacion) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }
  
  // Crear evaluación
  const { data, error } = await supabase
    .from("evaluaciones")
    .insert({
      docente_id,
      seccion_id,
      materia_id,
      nombre,
      descripcion,
      fecha_cierre,
      estado: "activa"
    });
  
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  
  return new Response(JSON.stringify({ data }));
}
```

**Esfuerzo:** 3-4 horas  
**Testing:** Unit tests para cada función

---

## 📋 CHECKLIST DE CORRECCIONES

### Fase 1: Base de Datos (Día 1)
- [ ] Crear tabla `user_roles`
- [ ] Crear políticas RLS para `user_roles`
- [ ] Migrar datos de roles desde auth.users metadata
- [ ] Verificar/crear tabla `secciones`
- [ ] Crear políticas RLS para `secciones`

### Fase 2: Edge Functions (Días 2-3)
- [ ] Reemplazar `perfiles` → `docentes` en 8 archivos
- [ ] Corregir nombres de campos (grado_id → grado, id_anio_escolar → id_anio)
- [ ] Crear 3 edge functions de roles
- [ ] Testear todas las 36 functions con datos válidos
- [ ] Revisar manejo de errores

### Fase 3: Frontend (Días 4-5)
- [ ] Actualizar auth.js para usar tabla `user_roles`
- [ ] Crear interfaz para asignar roles
- [ ] Conectar módulo de secciones
- [ ] Testear flujos de usuario por rol

### Fase 4: Integración (Día 5)
- [ ] Testeo end-to-end
- [ ] Revisar seguridad RLS
- [ ] Documentar API
- [ ] Deploy a staging

---

## 🧪 TESTING RECOMENDADO

### Unit Tests (Edge Functions)
```bash
# Testear cada función con inputs válidos
curl -X POST https://[project].supabase.co/functions/v1/users-get_user \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"user_id": "[uuid]"}'
```

### Integration Tests
```javascript
// Test en auth.js
async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "docente@test.com",
    password: "password123"
  });
  
  // Verificar que se obtiene el rol correcto
  const token = data.session.access_token;
  const { data: userData } = await supabase.functions.invoke("users-get_user", {
    body: { user_id: data.user.id },
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.assert(userData.rol in [1,2,3,4,5], "Rol válido");
}
```

### Security Tests
```sql
-- Verificar que users normales NO pueden crear roles
-- Ejecutar como usuario autenticado (no admin)
INSERT INTO user_roles (user_id, role_id) VALUES ('[uuid]', 5);
-- Debe retornar: permission denied for schema "public"
```

---

## 📞 CONTACTOS Y REFERENCIAS

### Documentación
- Supabase Docs: https://supabase.com/docs
- PostgreSQL: https://www.postgresql.org/docs/
- RLS Policies: https://supabase.com/docs/guides/auth/row-level-security

### Herramientas Útiles
- Supabase Dashboard: https://app.supabase.com
- SQL Editor: Directamente en dashboard
- Edge Functions Logs: Dashboard → Edge Functions → Logs

---

**Preparado por:** Auditoría Automatizada  
**Validado:** 2026-06-21  
**Estimado Total:** 5-7 días de desarrollo
