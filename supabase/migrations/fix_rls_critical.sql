-- ============================================================================
-- FIX CRÍTICO: RLS para evaluaciones_notas y audit_log
-- ============================================================================
-- Problema: Estas tablas tienen RLS ENABLED pero SIN POLÍTICAS
-- Impacto: Nadie puede acceder a evaluaciones_notas ni audit_log
-- Solución: Agregar políticas de lectura y escritura apropiadas

-- ============================================================================
-- 1. EVALUACIONES_NOTAS - Políticas de lectura y escritura
-- ============================================================================

-- Docentes: Solo sus propias notas de evaluación
CREATE POLICY IF NOT EXISTS "evaluaciones_notas_docente_read" 
ON "public"."evaluaciones_notas" 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM "public"."evaluaciones" e
    WHERE e."id" = "evaluaciones_notas"."evaluacion_id"
    AND e."docente_id" = "auth"."uid"()
  )
);

-- Estudiantes: Sus propias notas de evaluación
CREATE POLICY IF NOT EXISTS "evaluaciones_notas_estudiante_read" 
ON "public"."evaluaciones_notas" 
FOR SELECT 
USING (
  "evaluaciones_notas"."estudiante_id" IN (
    SELECT "estudiante_id" FROM "public"."inscripciones"
    WHERE EXISTS (
      SELECT 1 FROM "public"."perfiles" p
      WHERE p."id" = "auth"."uid"()
      AND p."id" = (SELECT "id" FROM "public"."auth"."users" WHERE "id" = "auth"."uid"())
    )
  )
);

-- Control de Estudios (rol 2), Asesor (rol 3), Directivo (rol 4), Superadmin (rol 5)
CREATE POLICY IF NOT EXISTS "evaluaciones_notas_admin_read" 
ON "public"."evaluaciones_notas" 
FOR SELECT 
USING (
  (2 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
  OR (3 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
  OR (4 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
  OR (5 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
);

-- Docentes: Pueden escribir sus notas de evaluación
CREATE POLICY IF NOT EXISTS "evaluaciones_notas_docente_write" 
ON "public"."evaluaciones_notas" 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."evaluaciones" e
    WHERE e."id" = "evaluaciones_notas"."evaluacion_id"
    AND e."docente_id" = "auth"."uid"()
  )
);

-- Docentes: Pueden actualizar sus notas de evaluación
CREATE POLICY IF NOT EXISTS "evaluaciones_notas_docente_update" 
ON "public"."evaluaciones_notas" 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM "public"."evaluaciones" e
    WHERE e."id" = "evaluaciones_notas"."evaluacion_id"
    AND e."docente_id" = "auth"."uid"()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."evaluaciones" e
    WHERE e."id" = "evaluaciones_notas"."evaluacion_id"
    AND e."docente_id" = "auth"."uid"()
  )
);

-- Superadmin: Acceso total a evaluaciones_notas
CREATE POLICY IF NOT EXISTS "evaluaciones_notas_superadmin_all" 
ON "public"."evaluaciones_notas" 
TO "authenticated" 
USING (5 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
WITH CHECK (5 IN (SELECT "public"."current_user_roles"() AS "id_rol"));

-- ============================================================================
-- 2. AUDIT_LOG - Políticas de lectura
-- ============================================================================

-- Control de Estudios, Asesor, Directivo, Superadmin: Pueden ver audit log
CREATE POLICY IF NOT EXISTS "audit_log_admin_read" 
ON "public"."audit_log" 
FOR SELECT 
USING (
  (2 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
  OR (3 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
  OR (4 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
  OR (5 IN (SELECT "public"."current_user_roles"() AS "id_rol"))
);

-- Docentes: Solo pueden ver registros de su propia acción
CREATE POLICY IF NOT EXISTS "audit_log_docente_read" 
ON "public"."audit_log" 
FOR SELECT 
USING ("user_id" = "auth"."uid"());

-- Superadmin: Acceso total a audit_log
CREATE POLICY IF NOT EXISTS "audit_log_superadmin_all" 
ON "public"."audit_log" 
TO "authenticated" 
USING (5 IN (SELECT "public"."current_user_roles"() AS "id_rol"));

-- ============================================================================
-- 3. VERIFICACIÓN - Confirmar que RLS está habilitado
-- ============================================================================
-- Asegurar que RLS está enabled (redundancia)
ALTER TABLE IF EXISTS "public"."evaluaciones_notas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."audit_log" ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "evaluaciones_notas_docente_read" ON "public"."evaluaciones_notas" 
IS 'Docentes acceden a sus propias evaluaciones';

COMMENT ON POLICY "evaluaciones_notas_docente_write" ON "public"."evaluaciones_notas" 
IS 'Docentes pueden registrar evaluaciones';

COMMENT ON POLICY "audit_log_admin_read" ON "public"."audit_log" 
IS 'Directivo y Superadmin ven auditoría completa';
