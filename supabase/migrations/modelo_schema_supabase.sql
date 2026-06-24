


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."estado_inscripcion" AS ENUM (
    'activo',
    'promovido',
    'retirado',
    'reprobado'
);


ALTER TYPE "public"."estado_inscripcion" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activar_lapso"("p_id_lapso" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  lapso RECORD;
BEGIN
  SELECT * INTO lapso
  FROM lapsos
  WHERE id_lapso = p_id_lapso;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Lapso no existe');
  END IF;

  -- Desactivar otros lapsos del año
  UPDATE lapsos
  SET activo = FALSE
  WHERE id_anio = lapso.id_anio;

  -- Activar este lapso
  UPDATE lapsos
  SET activo = TRUE
  WHERE id_lapso = p_id_lapso;

  RETURN json_build_object(
    'message', 'Lapso activado exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."activar_lapso"("p_id_lapso" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_nota_anual"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_anio_escolar_id INTEGER;
    v_lapsos_contados INTEGER;
    v_suma_notas INTEGER := 0;
    v_promedio INTEGER;
    rec RECORD;
BEGIN
    SELECT i.anio_escolar_id INTO v_anio_escolar_id
    FROM public.inscripciones i
    WHERE i.estudiante_id = NEW.estudiante_id
      AND i.estado IN ('activo', 'activo_pendiente', 'repitente')
    LIMIT 1;

    IF v_anio_escolar_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_lapsos_contados := 0;
    FOR rec IN
        SELECT nl.nota_final
        FROM public.notas_lapso nl
        JOIN public.lapsos l ON l.id_lapso = nl.lapso_id
        WHERE nl.estudiante_id = NEW.estudiante_id
          AND nl.materia_id = NEW.materia_id
          AND l.anio_escolar_id = v_anio_escolar_id
    LOOP
        v_suma_notas := v_suma_notas + rec.nota_final;
        v_lapsos_contados := v_lapsos_contados + 1;
    END LOOP;

    IF v_lapsos_contados = 3 THEN
        v_promedio := ROUND(v_suma_notas / 3.0);
        IF v_promedio > 20 THEN v_promedio := 20; END IF;
        IF v_promedio < 1 THEN v_promedio := 1; END IF;

        INSERT INTO public.notas_anuales (estudiante_id, materia_id, anio_escolar_id, nota_final, aprobado, updated_at)
        VALUES (NEW.estudiante_id, NEW.materia_id, v_anio_escolar_id, v_promedio, (v_promedio >= 10), now())
        ON CONFLICT (estudiante_id, materia_id, anio_escolar_id)
        DO UPDATE SET
            nota_final = EXCLUDED.nota_final,
            aprobado = EXCLUDED.aprobado,
            updated_at = EXCLUDED.updated_at;
    ELSE
        DELETE FROM public.notas_anuales
        WHERE estudiante_id = NEW.estudiante_id
          AND materia_id = NEW.materia_id
          AND anio_escolar_id = v_anio_escolar_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."actualizar_nota_anual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_nota_lapso"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_estudiante_id INTEGER;
    v_materia_id INTEGER;
    v_lapso_id INTEGER;
    v_nota INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_estudiante_id := OLD.estudiante_id;
        SELECT e.materia_id, e.lapso_id INTO v_materia_id, v_lapso_id
        FROM public.evaluaciones e WHERE e.id_evaluacion = OLD.evaluacion_id;
    ELSE
        v_estudiante_id := NEW.estudiante_id;
        SELECT e.materia_id, e.lapso_id INTO v_materia_id, v_lapso_id
        FROM public.evaluaciones e WHERE e.id_evaluacion = NEW.evaluacion_id;
    END IF;

    v_nota := public.calcular_nota_lapso(v_estudiante_id, v_materia_id, v_lapso_id);

    INSERT INTO public.notas_lapso (estudiante_id, materia_id, lapso_id, nota_final)
    VALUES (v_estudiante_id, v_materia_id, v_lapso_id, v_nota)
    ON CONFLICT (estudiante_id, materia_id, lapso_id)
    DO UPDATE SET nota_final = EXCLUDED.nota_final;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."actualizar_nota_lapso"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_promedio_final"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  est INT;
  insc INT;
  resultado JSON;
BEGIN
  est := NEW.estudiante_id;
  
  SELECT id_inscripcion INTO insc
  FROM inscripciones
  WHERE estudiante_id = est
    AND estado = 'activo'
  LIMIT 1;

  IF insc IS NULL THEN
    RETURN NEW;
  END IF;

  resultado := calcular_promedio_estudiante(est, insc);

  UPDATE inscripciones
  SET promedio_final = (resultado->>'promedio_final')::NUMERIC
  WHERE id_inscripcion = insc;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."actualizar_promedio_final"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."agregar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  existe_seccion INTEGER;
  existe_materia INTEGER;
BEGIN
  -- Validar que la sección exista
  SELECT id_seccion INTO existe_seccion
  FROM secciones
  WHERE id_seccion = p_id_seccion;

  IF existe_seccion IS NULL THEN
    RETURN json_build_object('error', 'La sección no existe');
  END IF;

  -- Validar que la materia exista
  SELECT id_materia INTO existe_materia
  FROM materias
  WHERE id_materia = p_id_materia;

  IF existe_materia IS NULL THEN
    RETURN json_build_object('error', 'La materia no existe');
  END IF;

  -- Validar duplicado
  IF EXISTS (
    SELECT 1 FROM seccion_materias
    WHERE id_seccion = p_id_seccion
      AND id_materia = p_id_materia
  ) THEN
    RETURN json_build_object('error', 'La materia ya está asignada a esta sección');
  END IF;

  -- Insertar materia en la sección
  INSERT INTO seccion_materias (id_seccion, id_materia)
  VALUES (p_id_seccion, p_id_materia);

  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Materia agregada correctamente a la sección',
    'id_seccion', p_id_seccion,
    'id_materia', p_id_materia
  );
END;
$$;


ALTER FUNCTION "public"."agregar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."asignar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  existe_relacion INTEGER;
  es_docente INTEGER;
BEGIN
  -- Validar que la materia esté asignada a la sección
  SELECT 1 INTO existe_relacion
  FROM seccion_materias
  WHERE id_seccion = p_id_seccion
    AND id_materia = p_id_materia;

  IF existe_relacion IS NULL THEN
    RETURN json_build_object('error', 'La materia no está asignada a esta sección');
  END IF;

  -- Validar que el usuario tenga rol docente (id_rol = 1)
  SELECT 1 INTO es_docente
  FROM user_roles
  WHERE user_id = p_id_docente
    AND id_rol = 1;

  IF es_docente IS NULL THEN
    RETURN json_build_object('error', 'El usuario no tiene rol docente');
  END IF;

  -- Asignar docente
  UPDATE seccion_materias
  SET id_docente = p_id_docente
  WHERE id_seccion = p_id_seccion
    AND id_materia = p_id_materia;

  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Docente asignado correctamente',
    'id_seccion', p_id_seccion,
    'id_materia', p_id_materia,
    'id_docente', p_id_docente
  );
END;
$$;


ALTER FUNCTION "public"."asignar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_nota_lapso"("p_estudiante_id" integer, "p_materia_id" integer, "p_lapso_id" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    total_ponderado DECIMAL := 0;
    rec RECORD;
    nota_redondeada INTEGER;
BEGIN
    FOR rec IN
        SELECT e.porcentaje, c.nota
        FROM public.evaluaciones e
        JOIN public.calificaciones c ON c.evaluacion_id = e.id_evaluacion
        WHERE e.materia_id = p_materia_id
          AND e.lapso_id = p_lapso_id
          AND c.estudiante_id = p_estudiante_id
    LOOP
        total_ponderado := total_ponderado + (rec.nota * (rec.porcentaje / 100.0));
    END LOOP;

    nota_redondeada := ROUND(total_ponderado);
    IF nota_redondeada > 20 THEN nota_redondeada := 20;
    ELSIF nota_redondeada < 1 THEN nota_redondeada := 1;
    END IF;

    RETURN nota_redondeada;
END;
$$;


ALTER FUNCTION "public"."calcular_nota_lapso"("p_estudiante_id" integer, "p_materia_id" integer, "p_lapso_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_promedio_estudiante"("p_estudiante" integer, "p_inscripcion" integer) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  lapso1 NUMERIC := 0;
  lapso2 NUMERIC := 0;
  lapso3 NUMERIC := 0;
  final NUMERIC := 0;
BEGIN

  -- LAPSO 1
  SELECT COALESCE(SUM((n.nota / 20.0) * e.porcentaje), 0)
  INTO lapso1
  FROM evaluaciones_notas n
  JOIN evaluaciones_lapsos e ON e.id_evaluacion = n.evaluacion_id
  WHERE n.estudiante_id = p_estudiante
    AND e.lapso_id = 1;

  -- LAPSO 2
  SELECT COALESCE(SUM((n.nota / 20.0) * e.porcentaje), 0)
  INTO lapso2
  FROM evaluaciones_notas n
  JOIN evaluaciones_lapsos e ON e.id_evaluacion = n.evaluacion_id
  WHERE n.estudiante_id = p_estudiante
    AND e.lapso_id = 2;

  -- LAPSO 3
  SELECT COALESCE(SUM((n.nota / 20.0) * e.porcentaje), 0)
  INTO lapso3
  FROM evaluaciones_notas n
  JOIN evaluaciones_lapsos e ON e.id_evaluacion = n.evaluacion_id
  WHERE n.estudiante_id = p_estudiante
    AND e.lapso_id = 3;

  -- PROMEDIO FINAL
  final := ROUND((lapso1 + lapso2 + lapso3) / 3.0, 2);

  RETURN json_build_object(
    'lapso1', lapso1,
    'lapso2', lapso2,
    'lapso3', lapso3,
    'promedio_final', final
  );

END;
$$;


ALTER FUNCTION "public"."calcular_promedio_estudiante"("p_estudiante" integer, "p_inscripcion" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cambiar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  existe_relacion INTEGER;
  es_docente INTEGER;
  docente_actual UUID;
BEGIN
  -- Validar que la materia esté asignada a la sección
  SELECT id_docente INTO docente_actual
  FROM seccion_materias
  WHERE id_seccion = p_id_seccion
    AND id_materia = p_id_materia;

  IF docente_actual IS NULL THEN
    RETURN json_build_object('error', 'La materia no está asignada a esta sección');
  END IF;

  -- Validar que el nuevo docente tenga rol docente (id_rol = 1)
  SELECT 1 INTO es_docente
  FROM user_roles
  WHERE user_id = p_id_docente
    AND id_rol = 1;

  IF es_docente IS NULL THEN
    RETURN json_build_object('error', 'El usuario no tiene rol docente');
  END IF;

  -- Actualizar docente
  UPDATE seccion_materias
  SET id_docente = p_id_docente
  WHERE id_seccion = p_id_seccion
    AND id_materia = p_id_materia;

  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Docente cambiado correctamente',
    'id_seccion', p_id_seccion,
    'id_materia', p_id_materia,
    'docente_anterior', docente_actual,
    'docente_nuevo', p_id_docente
  );
END;
$$;


ALTER FUNCTION "public"."cambiar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cerrar_anio_escolar"("p_id_anio" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  existe INTEGER;
BEGIN
  -- Validar existencia
  SELECT id_anio INTO existe
  FROM anios_escolares
  WHERE id_anio = p_id_anio;

  IF existe IS NULL THEN
    RETURN json_build_object('error', 'Año escolar no existe');
  END IF;

  -- Cerrar año
  UPDATE anios_escolares
  SET activo = FALSE
  WHERE id_anio = p_id_anio;

  -- Cerrar lapsos asociados
  UPDATE lapsos
  SET activo = FALSE
  WHERE id_anio = p_id_anio;

  RETURN json_build_object(
    'message', 'Año escolar cerrado exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."cerrar_anio_escolar"("p_id_anio" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cerrar_lapso"("p_id_lapso" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  existe INTEGER;
BEGIN
  SELECT id_lapso INTO existe
  FROM lapsos
  WHERE id_lapso = p_id_lapso;

  IF existe IS NULL THEN
    RETURN json_build_object('error', 'Lapso no existe');
  END IF;

  UPDATE lapsos
  SET activo = FALSE
  WHERE id_lapso = p_id_lapso;

  RETURN json_build_object(
    'message', 'Lapso cerrado exitosamente'
  );
END;
$$;


ALTER FUNCTION "public"."cerrar_lapso"("p_id_lapso" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_lapso_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.lapsos
        WHERE anio_escolar_id = NEW.anio_escolar_id
          AND id_lapso != COALESCE(NEW.id_lapso, -1)
          AND (fecha_inicio, fecha_fin) OVERLAPS (NEW.fecha_inicio, NEW.fecha_fin)
    ) THEN
        RAISE EXCEPTION 'Las fechas del lapso se solapan con otro lapso en el mismo año escolar.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_lapso_overlap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clonar_seccion"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  origen RECORD;
  nueva_id INTEGER;
  materias_copiadas INTEGER := 0;
BEGIN
  -- 1. Validar que la sección origen exista
  SELECT *
  INTO origen
  FROM secciones
  WHERE id_seccion = p_id_seccion_origen;

  IF origen IS NULL THEN
    RETURN json_build_object('error', 'La sección origen no existe');
  END IF;

  -- 2. Crear la nueva sección
  INSERT INTO secciones (nombre, grado, letra, anio_escolar_id, activo)
  VALUES (
    p_nombre_nuevo,
    origen.grado,
    p_letra_nueva,
    origen.anio_escolar_id,
    origen.activo
  )
  RETURNING id_seccion INTO nueva_id;

  -- 3. Copiar materias y docentes asignados
  INSERT INTO seccion_materias (id_seccion, id_materia, id_docente)
  SELECT
    nueva_id,
    sm.id_materia,
    sm.id_docente
  FROM seccion_materias sm
  WHERE sm.id_seccion = p_id_seccion_origen;

  GET DIAGNOSTICS materias_copiadas = ROW_COUNT;

  -- 4. Retornar resultado
  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Sección clonada correctamente',
    'id_seccion_nueva', nueva_id,
    'materias_copiadas', materias_copiadas
  );
END;
$$;


ALTER FUNCTION "public"."clonar_seccion"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clonar_seccion_otro_anio"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text", "p_id_anio_destino" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  origen RECORD;
  nueva_id INTEGER;
  materias_copiadas INTEGER := 0;
BEGIN
  -- 1. Validar que la sección origen exista
  SELECT *
  INTO origen
  FROM secciones
  WHERE id_seccion = p_id_seccion_origen;

  IF origen IS NULL THEN
    RETURN json_build_object('error', 'La sección origen no existe');
  END IF;

  -- 2. Validar que el año escolar destino exista
  IF NOT EXISTS (
    SELECT 1 FROM anios_escolares WHERE id_anio = p_id_anio_destino
  ) THEN
    RETURN json_build_object('error', 'El año escolar destino no existe');
  END IF;

  -- 3. Crear la nueva sección en el año destino
  INSERT INTO secciones (nombre, grado, letra, anio_escolar_id, activo)
  VALUES (
    p_nombre_nuevo,
    origen.grado,
    p_letra_nueva,
    p_id_anio_destino,
    origen.activo
  )
  RETURNING id_seccion INTO nueva_id;

  -- 4. Copiar materias y docentes asignados
  INSERT INTO seccion_materias (id_seccion, id_materia, id_docente)
  SELECT
    nueva_id,
    sm.id_materia,
    sm.id_docente
  FROM seccion_materias sm
  WHERE sm.id_seccion = p_id_seccion_origen;

  GET DIAGNOSTICS materias_copiadas = ROW_COUNT;

  -- 5. Retornar resultado
  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Sección clonada correctamente hacia otro año escolar',
    'id_seccion_nueva', nueva_id,
    'anio_destino', p_id_anio_destino,
    'materias_copiadas', materias_copiadas
  );
END;
$$;


ALTER FUNCTION "public"."clonar_seccion_otro_anio"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text", "p_id_anio_destino" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_anio_escolar"("p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  anio_activo INTEGER;
  nuevo_id INTEGER;
BEGIN
  -- Validar que no exista un año activo
  SELECT id_anio INTO anio_activo
  FROM anios_escolares
  WHERE activo = TRUE
  LIMIT 1;

  IF anio_activo IS NOT NULL THEN
    RETURN json_build_object(
      'error', 'Ya existe un año escolar activo'
    );
  END IF;

  -- Crear año escolar
  INSERT INTO anios_escolares (nombre, fecha_inicio, fecha_fin, activo)
  VALUES (p_nombre, p_fecha_inicio, p_fecha_fin, TRUE)
  RETURNING id_anio INTO nuevo_id;

  RETURN json_build_object(
    'message', 'Año escolar creado exitosamente',
    'id_anio', nuevo_id
  );
END;
$$;


ALTER FUNCTION "public"."crear_anio_escolar"("p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_lapso"("p_id_anio" integer, "p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  anio RECORD;
  solapado INTEGER;
  nuevo_id INTEGER;
BEGIN
  -- Validar año escolar
  SELECT * INTO anio
  FROM anios_escolares
  WHERE id_anio = p_id_anio;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Año escolar no existe');
  END IF;

  -- Validar fechas dentro del año escolar
  IF p_fecha_inicio < anio.fecha_inicio OR p_fecha_fin > anio.fecha_fin THEN
    RETURN json_build_object('error', 'Las fechas del lapso deben estar dentro del año escolar');
  END IF;

  -- Validar solapamiento
  SELECT id_lapso INTO solapado
  FROM lapsos
  WHERE id_anio = p_id_anio
    AND (
      p_fecha_inicio BETWEEN fecha_inicio AND fecha_fin OR
      p_fecha_fin BETWEEN fecha_inicio AND fecha_fin
    )
  LIMIT 1;

  IF solapado IS NOT NULL THEN
    RETURN json_build_object('error', 'El lapso se solapa con otro existente');
  END IF;

  -- Crear lapso
  INSERT INTO lapsos (id_anio, nombre, fecha_inicio, fecha_fin, activo)
  VALUES (p_id_anio, p_nombre, p_fecha_inicio, p_fecha_fin, FALSE)
  RETURNING id_lapso INTO nuevo_id;

  RETURN json_build_object(
    'message', 'Lapso creado exitosamente',
    'id_lapso', nuevo_id
  );
END;
$$;


ALTER FUNCTION "public"."crear_lapso"("p_id_anio" integer, "p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_seccion"("p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  nueva_id INTEGER;
BEGIN
  -- Validar año escolar existente
  IF NOT EXISTS (
    SELECT 1 FROM anios_escolares WHERE id_anio = p_anio_escolar_id
  ) THEN
    RETURN json_build_object('error', 'El año escolar no existe');
  END IF;

  -- Validar duplicado
  IF EXISTS (
    SELECT 1 FROM secciones
    WHERE grado = p_grado
      AND letra = p_letra
      AND anio_escolar_id = p_anio_escolar_id
  ) THEN
    RETURN json_build_object('error', 'La sección ya existe en este año escolar');
  END IF;

  INSERT INTO secciones (nombre, grado, letra, anio_escolar_id, activo)
  VALUES (p_nombre, p_grado, p_letra, p_anio_escolar_id, TRUE)
  RETURNING id_seccion INTO nueva_id;

  RETURN json_build_object(
    'ok', TRUE,
    'id_seccion', nueva_id
  );
END;
$$;


ALTER FUNCTION "public"."crear_seccion"("p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_roles"() RETURNS SETOF integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT id_rol FROM public.user_roles WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."editar_seccion"("p_id_seccion" integer, "p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  existe_seccion INTEGER;
BEGIN
  -- Validar que la sección exista
  SELECT id_seccion INTO existe_seccion
  FROM secciones
  WHERE id_seccion = p_id_seccion;

  IF existe_seccion IS NULL THEN
    RETURN json_build_object('error', 'La sección no existe');
  END IF;

  -- Validar que el año escolar exista
  IF NOT EXISTS (
    SELECT 1 FROM anios_escolares WHERE id_anio = p_anio_escolar_id
  ) THEN
    RETURN json_build_object('error', 'El año escolar no existe');
  END IF;

  -- Validar duplicado (grado + letra + año)
  IF EXISTS (
    SELECT 1 FROM secciones
    WHERE grado = p_grado
      AND letra = p_letra
      AND anio_escolar_id = p_anio_escolar_id
      AND id_seccion <> p_id_seccion
  ) THEN
    RETURN json_build_object('error', 'Ya existe una sección con ese grado y letra en este año escolar');
  END IF;

  -- Actualizar sección
  UPDATE secciones
  SET 
    nombre = p_nombre,
    grado = p_grado,
    letra = p_letra,
    anio_escolar_id = p_anio_escolar_id,
    updated_at = NOW()
  WHERE id_seccion = p_id_seccion;

  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Sección actualizada correctamente',
    'id_seccion', p_id_seccion
  );
END;
$$;


ALTER FUNCTION "public"."editar_seccion"("p_id_seccion" integer, "p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_audit_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_regid text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_regid := COALESCE(
            OLD.id::text,
            OLD.id_estudiante::text,
            OLD.id_inscripcion::text,
            OLD.id_calificacion::text,
            NULL
        );
        INSERT INTO public.audit_log(tabla, operacion, registro_id, usuario, cambios, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, v_regid, auth.uid(), jsonb_build_object('old', v_old), now());
        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_regid := COALESCE(
            NEW.id::text,
            NEW.id_estudiante::text,
            NEW.id_inscripcion::text,
            NEW.id_calificacion::text,
            NULL
        );
        INSERT INTO public.audit_log(tabla, operacion, registro_id, usuario, cambios, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, v_regid, auth.uid(), jsonb_build_object('old', v_old, 'new', v_new), now());
        RETURN NEW;

    ELSIF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
        v_regid := COALESCE(
            NEW.id::text,
            NEW.id_estudiante::text,
            NEW.id_inscripcion::text,
            NEW.id_calificacion::text,
            NULL
        );
        INSERT INTO public.audit_log(tabla, operacion, registro_id, usuario, cambios, created_at)
        VALUES (TG_TABLE_NAME, TG_OP, v_regid, auth.uid(), jsonb_build_object('new', v_new), now());
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."fn_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_prevenir_inscripcion_duplicada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verificar si ya existe una inscripción del estudiante en el mismo año escolar
  IF EXISTS (
    SELECT 1
    FROM public.inscripciones i
    WHERE i.estudiante_id = NEW.estudiante_id
      AND i.anio_escolar_id = NEW.anio_escolar_id
      AND i.id_inscripcion <> NEW.id_inscripcion
  ) THEN
    RAISE EXCEPTION 'El estudiante ya está inscrito en este año escolar.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_prevenir_inscripcion_duplicada"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_retirar_estudiante"("p_id_inscripcion" integer, "p_usuario" "uuid" DEFAULT "auth"."uid"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- 1. Verificar que la inscripción existe
  SELECT TRUE INTO v_exists
  FROM public.inscripciones
  WHERE id_inscripcion = p_id_inscripcion;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'La inscripción no existe.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Verificar que no esté ya retirada
  IF EXISTS (
    SELECT 1
    FROM public.inscripciones
    WHERE id_inscripcion = p_id_inscripcion
      AND estado = 'retirado'
  ) THEN
    RAISE EXCEPTION 'El estudiante ya está retirado.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Actualizar estado
  UPDATE public.inscripciones
  SET estado = 'retirado'
  WHERE id_inscripcion = p_id_inscripcion;

  -- 4. Retornar JSON limpio
  RETURN json_build_object(
    'ok', true,
    'mensaje', 'Estudiante retirado correctamente.',
    'id_inscripcion', p_id_inscripcion
  );
END;
$$;


ALTER FUNCTION "public"."fn_retirar_estudiante"("p_id_inscripcion" integer, "p_usuario" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.perfiles (id, username, nombres, apellidos, cedula, activo)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'nombres',
        NEW.raw_user_meta_data->>'apellidos',
        NEW.raw_user_meta_data->>'cedula',   -- Si se pasa la cédula en metadatos, se guarda
        true
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_role"("p_roles" integer[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    select exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.id_rol = any(p_roles)
    );
$$;


ALTER FUNCTION "public"."has_any_role"("p_roles" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_role" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    select exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.id_rol = p_role
    );
$$;


ALTER FUNCTION "public"."has_role"("p_role" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_materias_seccion"("p_id_seccion" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'ok', TRUE,
      'materias',
      json_agg(
        json_build_object(
          'id_materia', m.id_materia,
          'nombre_materia', m.nombre,
          'id_docente', sm.id_docente,
          'docente', CASE 
                        WHEN sm.id_docente IS NOT NULL THEN (
                          SELECT json_build_object(
                            'id', d.id,
                            'nombres', d.nombres,
                            'apellidos', d.apellidos
                          )
                          FROM docentes d
                          WHERE d.id = sm.id_docente
                        )
                        ELSE NULL
                      END
        )
      )
    )
    FROM seccion_materias sm
    JOIN materias m ON m.id_materia = sm.id_materia
    WHERE sm.id_seccion = p_id_seccion
  );
END;
$$;


ALTER FUNCTION "public"."listar_materias_seccion"("p_id_seccion" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_secciones"("p_anio_escolar_id" integer, "p_activo" boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'ok', TRUE,
      'secciones',
      json_agg(
        json_build_object(
          'id_seccion', s.id_seccion,
          'nombre', s.nombre,
          'grado', s.grado,
          'letra', s.letra,
          'anio_escolar_id', s.anio_escolar_id,
          'activo', s.activo
        )
      )
    )
    FROM secciones s
    WHERE s.anio_escolar_id = p_anio_escolar_id
      AND (p_activo IS NULL OR s.activo = p_activo)
  );
END;
$$;


ALTER FUNCTION "public"."listar_secciones"("p_anio_escolar_id" integer, "p_activo" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."anios_escolares" (
    "id_anio" integer NOT NULL,
    "nombre" character varying(20) NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fechas_validas" CHECK (("fecha_fin" >= "fecha_inicio"))
);


ALTER TABLE "public"."anios_escolares" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_anio_activo"() RETURNS SETOF "public"."anios_escolares"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM anios_escolares
  WHERE activo = TRUE
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."obtener_anio_activo"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lapsos" (
    "id_lapso" integer NOT NULL,
    "anio_escolar_id" integer,
    "numero_lapso" integer NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "activo" boolean DEFAULT true,
    "inicio_carga" timestamp with time zone,
    "fin_carga" timestamp with time zone,
    CONSTRAINT "fechas_lapso_validas" CHECK (("fecha_fin" >= "fecha_inicio")),
    CONSTRAINT "lapsos_numero_lapso_check" CHECK (("numero_lapso" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."lapsos" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_lapsos"("p_id_anio" integer) RETURNS SETOF "public"."lapsos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM lapsos
  WHERE id_anio = p_id_anio
  ORDER BY fecha_inicio;
END;
$$;


ALTER FUNCTION "public"."obtener_lapsos"("p_id_anio" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promover_estudiantes"("p_anio_origen_id" integer, "p_anio_destino_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    est RECORD;
    v_materias_reprobadas INTEGER;
    v_nuevo_grado INTEGER;
    v_nueva_seccion_id INTEGER;
    v_estado_inscripcion VARCHAR(20);
BEGIN
    FOR est IN
        SELECT i.estudiante_id, i.seccion_id, s.grado, s.letra
        FROM public.inscripciones i
        JOIN public.secciones s ON s.id_seccion = i.seccion_id
        WHERE i.anio_escolar_id = p_anio_origen_id
          AND i.estado IN ('activo', 'activo_pendiente', 'repitente')
    LOOP
        SELECT COUNT(*) INTO v_materias_reprobadas
        FROM public.notas_anuales
        WHERE estudiante_id = est.estudiante_id
          AND anio_escolar_id = p_anio_origen_id
          AND aprobado = false;

        IF v_materias_reprobadas = 0 THEN
            v_nuevo_grado := est.grado + 1;
            v_estado_inscripcion := 'activo';
        ELSIF v_materias_reprobadas IN (1, 2) THEN
            v_nuevo_grado := est.grado + 1;
            v_estado_inscripcion := 'activo_pendiente';
        ELSE
            v_nuevo_grado := est.grado;
            v_estado_inscripcion := 'repitente';
        END IF;

        IF v_nuevo_grado <= 5 THEN
            SELECT id_seccion INTO v_nueva_seccion_id
            FROM public.secciones
            WHERE grado = v_nuevo_grado
              AND letra = est.letra
              AND anio_escolar_id = p_anio_destino_id
            LIMIT 1;

            IF v_nueva_seccion_id IS NOT NULL THEN
                INSERT INTO public.inscripciones (estudiante_id, seccion_id, anio_escolar_id, estado)
                VALUES (est.estudiante_id, v_nueva_seccion_id, p_anio_destino_id, v_estado_inscripcion);

                IF v_materias_reprobadas >= 3 THEN
                    UPDATE public.inscripciones SET estado = 'reprobado'
                    WHERE estudiante_id = est.estudiante_id AND anio_escolar_id = p_anio_origen_id;
                ELSE
                    UPDATE public.inscripciones SET estado = 'promovido'
                    WHERE estudiante_id = est.estudiante_id AND anio_escolar_id = p_anio_origen_id;
                END IF;
            END IF;
        ELSE
            IF v_materias_reprobadas = 0 THEN
                UPDATE public.inscripciones SET estado = 'graduado'
                WHERE estudiante_id = est.estudiante_id AND anio_escolar_id = p_anio_origen_id;
            ELSE
                UPDATE public.inscripciones SET estado = 'por_reparar'
                WHERE estudiante_id = est.estudiante_id AND anio_escolar_id = p_anio_origen_id;
            END IF;
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."promover_estudiantes"("p_anio_origen_id" integer, "p_anio_destino_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prueba_mostrar"("texto" "text", "resultado" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RAISE NOTICE '% : %', texto, resultado;
END;
$$;


ALTER FUNCTION "public"."prueba_mostrar"("texto" "text", "resultado" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quitar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  existe_relacion INTEGER;
BEGIN
  -- Validar que la relación exista
  SELECT 1 INTO existe_relacion
  FROM seccion_materias
  WHERE id_seccion = p_id_seccion
    AND id_materia = p_id_materia;

  IF existe_relacion IS NULL THEN
    RETURN json_build_object('error', 'La materia no está asignada a esta sección');
  END IF;

  -- Eliminar relación
  DELETE FROM seccion_materias
  WHERE id_seccion = p_id_seccion
    AND id_materia = p_id_materia;

  RETURN json_build_object(
    'ok', TRUE,
    'mensaje', 'Materia removida correctamente de la sección',
    'id_seccion', p_id_seccion,
    'id_materia', p_id_materia
  );
END;
$$;


ALTER FUNCTION "public"."quitar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_seccion"("p_id_seccion" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_estado_actual BOOLEAN;
BEGIN
  -- Validar que la sección exista
  SELECT activo INTO v_estado_actual
  FROM secciones
  WHERE id_seccion = p_id_seccion;

  IF v_estado_actual IS NULL THEN
    RETURN json_build_object('error', 'La sección no existe');
  END IF;

  -- Cambiar estado
  UPDATE secciones
  SET activo = NOT v_estado_actual
  WHERE id_seccion = p_id_seccion;

  RETURN json_build_object(
    'ok', TRUE,
    'id_seccion', p_id_seccion,
    'nuevo_estado', NOT v_estado_actual
  );
END;
$$;


ALTER FUNCTION "public"."toggle_seccion"("p_id_seccion" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_calificacion_ventana"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_lapso record;
    v_periodo_activo boolean;
BEGIN
    SELECT l.* INTO v_lapso
    FROM public.evaluaciones e
    JOIN public.lapsos l ON l.id_lapso = e.lapso_id
    WHERE e.id_evaluacion = COALESCE(NEW.evaluacion_id, OLD.evaluacion_id)
    LIMIT 1;

    IF v_lapso IS NULL THEN
        RAISE EXCEPTION 'Evaluación o lapso no encontrado.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.periodos_academicos p
        WHERE p.id_periodo = v_lapso.anio_escolar_id
          AND p.activo = true
    ) INTO v_periodo_activo;

    IF NOT v_periodo_activo THEN
        RAISE EXCEPTION 'El periodo académico asociado no está activo.';
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF v_lapso.inicio_carga IS NOT NULL AND v_lapso.fin_carga IS NOT NULL THEN
            IF now() < v_lapso.inicio_carga OR now() > v_lapso.fin_carga THEN
                RAISE EXCEPTION 'Fuera de la ventana de carga de notas para este lapso.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_calificacion_ventana"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_porcentaje_evaluacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    total_actual DECIMAL(7,2);
    conteo_evals INTEGER;
BEGIN
    SELECT COALESCE(SUM(porcentaje),0) INTO total_actual
    FROM public.evaluaciones
    WHERE materia_id = NEW.materia_id
      AND seccion_id = NEW.seccion_id
      AND lapso_id = NEW.lapso_id
      AND (TG_OP = 'INSERT' OR id_evaluacion != NEW.id_evaluacion);

    IF total_actual + NEW.porcentaje > 100 THEN
        RAISE EXCEPTION 'La suma de porcentajes supera el 100%% (actual: %, nuevo: %)', total_actual, NEW.porcentaje;
    END IF;

    IF NEW.porcentaje > 25 THEN
        RAISE EXCEPTION 'Cada evaluación no puede superar 25%% de la nota del lapso.';
    END IF;

    SELECT COUNT(*) INTO conteo_evals
    FROM public.evaluaciones
    WHERE materia_id = NEW.materia_id
      AND seccion_id = NEW.seccion_id
      AND lapso_id = NEW.lapso_id
      AND (TG_OP = 'INSERT' OR id_evaluacion != NEW.id_evaluacion);

    IF conteo_evals + 1 > 7 THEN
        RAISE EXCEPTION 'No se permiten más de 7 evaluaciones por materia/sección/lapso.';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_porcentaje_evaluacion"() OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."anios_escolares_id_anio_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."anios_escolares_id_anio_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."anios_escolares_id_anio_seq" OWNED BY "public"."anios_escolares"."id_anio";



CREATE TABLE IF NOT EXISTS "public"."asesores_seccion" (
    "id_asesoria" integer NOT NULL,
    "docente_id" "uuid" NOT NULL,
    "seccion_id" integer NOT NULL,
    "anio_escolar_id" integer NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asesores_seccion" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."asesores_seccion_id_asesoria_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."asesores_seccion_id_asesoria_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."asesores_seccion_id_asesoria_seq" OWNED BY "public"."asesores_seccion"."id_asesoria";



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" integer NOT NULL,
    "tabla" "text" NOT NULL,
    "operacion" "text" NOT NULL,
    "registro_id" "text",
    "usuario" "uuid",
    "cambios" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."calificaciones" (
    "id_calificacion" integer NOT NULL,
    "evaluacion_id" integer,
    "estudiante_id" integer,
    "nota" numeric(5,2) NOT NULL,
    "observaciones" "text",
    CONSTRAINT "calificaciones_nota_check" CHECK ((("nota" >= (1)::numeric) AND ("nota" <= (20)::numeric)))
);


ALTER TABLE "public"."calificaciones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."calificaciones_id_calificacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."calificaciones_id_calificacion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."calificaciones_id_calificacion_seq" OWNED BY "public"."calificaciones"."id_calificacion";



CREATE TABLE IF NOT EXISTS "public"."docente_materia_seccion" (
    "id_asignacion" integer NOT NULL,
    "docente_id" "uuid",
    "materia_id" integer,
    "seccion_id" integer,
    "anio_escolar_id" integer,
    "activo" boolean DEFAULT true
);


ALTER TABLE "public"."docente_materia_seccion" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."docente_materia_seccion_id_asignacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."docente_materia_seccion_id_asignacion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."docente_materia_seccion_id_asignacion_seq" OWNED BY "public"."docente_materia_seccion"."id_asignacion";



CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "cedula" character varying(20),
    "username" "text" NOT NULL,
    "nombres" "text",
    "apellidos" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "id_rol" integer NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."docentes" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."username",
    "p"."nombres",
    "p"."apellidos",
    "p"."activo"
   FROM ("public"."perfiles" "p"
     JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "p"."id")))
  WHERE ("ur"."id_rol" = 1);


ALTER VIEW "public"."docentes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estudiantes" (
    "id_estudiante" integer NOT NULL,
    "cedula" character varying(20) NOT NULL,
    "nombres" character varying(100) NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "fecha_nacimiento" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sexo" "text",
    "direccion" "text",
    "telefono" "text",
    "representante" "text",
    "telefono_representante" "text",
    "activo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "estudiantes_sexo_check" CHECK (("sexo" = ANY (ARRAY['M'::"text", 'F'::"text"])))
);


ALTER TABLE "public"."estudiantes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."estudiantes_id_estudiante_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."estudiantes_id_estudiante_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."estudiantes_id_estudiante_seq" OWNED BY "public"."estudiantes"."id_estudiante";



CREATE TABLE IF NOT EXISTS "public"."evaluaciones" (
    "id_evaluacion" integer NOT NULL,
    "docente_id" "uuid",
    "materia_id" integer,
    "seccion_id" integer,
    "lapso_id" integer,
    "nombre" character varying(200) NOT NULL,
    "porcentaje" numeric(5,2) NOT NULL,
    "instrumento" character varying(100),
    "tecnica" character varying(100),
    "fecha_creacion" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "evaluaciones_porcentaje_check" CHECK ((("porcentaje" > (0)::numeric) AND ("porcentaje" <= (100)::numeric)))
);


ALTER TABLE "public"."evaluaciones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."evaluaciones_id_evaluacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evaluaciones_id_evaluacion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evaluaciones_id_evaluacion_seq" OWNED BY "public"."evaluaciones"."id_evaluacion";



CREATE TABLE IF NOT EXISTS "public"."evaluaciones_lapsos" (
    "id_evaluacion" integer NOT NULL,
    "seccion_id" integer NOT NULL,
    "materia_id" integer NOT NULL,
    "docente_id" "uuid" NOT NULL,
    "lapso_id" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "tecnica" "text",
    "instrumento" "text",
    "porcentaje" integer,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "evaluaciones_lapsos_porcentaje_check" CHECK ((("porcentaje" > 0) AND ("porcentaje" <= 25)))
);


ALTER TABLE "public"."evaluaciones_lapsos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."evaluaciones_lapsos_id_evaluacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evaluaciones_lapsos_id_evaluacion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evaluaciones_lapsos_id_evaluacion_seq" OWNED BY "public"."evaluaciones_lapsos"."id_evaluacion";



CREATE TABLE IF NOT EXISTS "public"."evaluaciones_notas" (
    "id_nota" integer NOT NULL,
    "evaluacion_id" integer NOT NULL,
    "estudiante_id" integer NOT NULL,
    "nota" integer,
    "observacion" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "evaluaciones_notas_nota_check" CHECK ((("nota" >= 0) AND ("nota" <= 20)))
);


ALTER TABLE "public"."evaluaciones_notas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."evaluaciones_notas_id_nota_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."evaluaciones_notas_id_nota_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."evaluaciones_notas_id_nota_seq" OWNED BY "public"."evaluaciones_notas"."id_nota";



CREATE TABLE IF NOT EXISTS "public"."inscripciones" (
    "id_inscripcion" integer NOT NULL,
    "estudiante_id" integer NOT NULL,
    "seccion_id" integer NOT NULL,
    "anio_escolar_id" integer NOT NULL,
    "estado" "public"."estado_inscripcion" DEFAULT 'activo'::"public"."estado_inscripcion",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inscripciones_estado_check" CHECK ((("estado")::"text" = ANY (ARRAY[('activo'::character varying)::"text", ('promovido'::character varying)::"text", ('retirado'::character varying)::"text", ('reprobado'::character varying)::"text"])))
);


ALTER TABLE "public"."inscripciones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."inscripciones_id_inscripcion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."inscripciones_id_inscripcion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."inscripciones_id_inscripcion_seq" OWNED BY "public"."inscripciones"."id_inscripcion";



CREATE SEQUENCE IF NOT EXISTS "public"."lapsos_id_lapso_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lapsos_id_lapso_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lapsos_id_lapso_seq" OWNED BY "public"."lapsos"."id_lapso";



CREATE TABLE IF NOT EXISTS "public"."materias" (
    "id_materia" integer NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "descripcion" "text"
);


ALTER TABLE "public"."materias" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."materias_id_materia_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."materias_id_materia_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."materias_id_materia_seq" OWNED BY "public"."materias"."id_materia";



CREATE TABLE IF NOT EXISTS "public"."notas_anuales" (
    "id_nota_anual" integer NOT NULL,
    "estudiante_id" integer,
    "materia_id" integer,
    "anio_escolar_id" integer,
    "nota_final" numeric(5,2) NOT NULL,
    "aprobado" boolean NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notas_anuales_nota_final_check" CHECK ((("nota_final" >= (1)::numeric) AND ("nota_final" <= (20)::numeric)))
);


ALTER TABLE "public"."notas_anuales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notas_anuales_id_nota_anual_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notas_anuales_id_nota_anual_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notas_anuales_id_nota_anual_seq" OWNED BY "public"."notas_anuales"."id_nota_anual";



CREATE TABLE IF NOT EXISTS "public"."notas_lapso" (
    "id_nota_lapso" integer NOT NULL,
    "estudiante_id" integer,
    "materia_id" integer,
    "lapso_id" integer,
    "nota_final" numeric(5,2) NOT NULL,
    CONSTRAINT "notas_lapso_nota_final_check" CHECK ((("nota_final" >= (1)::numeric) AND ("nota_final" <= (20)::numeric)))
);


ALTER TABLE "public"."notas_lapso" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notas_lapso_id_nota_lapso_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notas_lapso_id_nota_lapso_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notas_lapso_id_nota_lapso_seq" OWNED BY "public"."notas_lapso"."id_nota_lapso";



CREATE TABLE IF NOT EXISTS "public"."periodos_academicos" (
    "id_periodo" integer NOT NULL,
    "nombre" character varying(50) NOT NULL,
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "activo" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."periodos_academicos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."periodos_academicos_id_periodo_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."periodos_academicos_id_periodo_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."periodos_academicos_id_periodo_seq" OWNED BY "public"."periodos_academicos"."id_periodo";



CREATE TABLE IF NOT EXISTS "public"."rol" (
    "id_rol" integer NOT NULL,
    "nombre" character varying(50) NOT NULL
);


ALTER TABLE "public"."rol" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seccion_materias" (
    "id_seccion" integer NOT NULL,
    "id_materia" integer NOT NULL,
    "id_docente" "uuid"
);


ALTER TABLE "public"."seccion_materias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."secciones" (
    "id_seccion" integer NOT NULL,
    "nombre" character varying(10) NOT NULL,
    "grado" integer NOT NULL,
    "letra" character varying(1) NOT NULL,
    "anio_escolar_id" integer,
    "activo" boolean DEFAULT true,
    CONSTRAINT "secciones_grado_check" CHECK ((("grado" >= 1) AND ("grado" <= 5)))
);


ALTER TABLE "public"."secciones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."secciones_id_seccion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."secciones_id_seccion_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."secciones_id_seccion_seq" OWNED BY "public"."secciones"."id_seccion";



ALTER TABLE ONLY "public"."anios_escolares" ALTER COLUMN "id_anio" SET DEFAULT "nextval"('"public"."anios_escolares_id_anio_seq"'::"regclass");



ALTER TABLE ONLY "public"."asesores_seccion" ALTER COLUMN "id_asesoria" SET DEFAULT "nextval"('"public"."asesores_seccion_id_asesoria_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."calificaciones" ALTER COLUMN "id_calificacion" SET DEFAULT "nextval"('"public"."calificaciones_id_calificacion_seq"'::"regclass");



ALTER TABLE ONLY "public"."docente_materia_seccion" ALTER COLUMN "id_asignacion" SET DEFAULT "nextval"('"public"."docente_materia_seccion_id_asignacion_seq"'::"regclass");



ALTER TABLE ONLY "public"."estudiantes" ALTER COLUMN "id_estudiante" SET DEFAULT "nextval"('"public"."estudiantes_id_estudiante_seq"'::"regclass");



ALTER TABLE ONLY "public"."evaluaciones" ALTER COLUMN "id_evaluacion" SET DEFAULT "nextval"('"public"."evaluaciones_id_evaluacion_seq"'::"regclass");



ALTER TABLE ONLY "public"."evaluaciones_lapsos" ALTER COLUMN "id_evaluacion" SET DEFAULT "nextval"('"public"."evaluaciones_lapsos_id_evaluacion_seq"'::"regclass");



ALTER TABLE ONLY "public"."evaluaciones_notas" ALTER COLUMN "id_nota" SET DEFAULT "nextval"('"public"."evaluaciones_notas_id_nota_seq"'::"regclass");



ALTER TABLE ONLY "public"."inscripciones" ALTER COLUMN "id_inscripcion" SET DEFAULT "nextval"('"public"."inscripciones_id_inscripcion_seq"'::"regclass");



ALTER TABLE ONLY "public"."lapsos" ALTER COLUMN "id_lapso" SET DEFAULT "nextval"('"public"."lapsos_id_lapso_seq"'::"regclass");



ALTER TABLE ONLY "public"."materias" ALTER COLUMN "id_materia" SET DEFAULT "nextval"('"public"."materias_id_materia_seq"'::"regclass");



ALTER TABLE ONLY "public"."notas_anuales" ALTER COLUMN "id_nota_anual" SET DEFAULT "nextval"('"public"."notas_anuales_id_nota_anual_seq"'::"regclass");



ALTER TABLE ONLY "public"."notas_lapso" ALTER COLUMN "id_nota_lapso" SET DEFAULT "nextval"('"public"."notas_lapso_id_nota_lapso_seq"'::"regclass");



ALTER TABLE ONLY "public"."periodos_academicos" ALTER COLUMN "id_periodo" SET DEFAULT "nextval"('"public"."periodos_academicos_id_periodo_seq"'::"regclass");



ALTER TABLE ONLY "public"."secciones" ALTER COLUMN "id_seccion" SET DEFAULT "nextval"('"public"."secciones_id_seccion_seq"'::"regclass");



ALTER TABLE ONLY "public"."anios_escolares"
    ADD CONSTRAINT "anios_escolares_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."anios_escolares"
    ADD CONSTRAINT "anios_escolares_pkey" PRIMARY KEY ("id_anio");



ALTER TABLE ONLY "public"."asesores_seccion"
    ADD CONSTRAINT "asesores_seccion_docente_id_seccion_id_anio_escolar_id_key" UNIQUE ("docente_id", "seccion_id", "anio_escolar_id");



ALTER TABLE ONLY "public"."asesores_seccion"
    ADD CONSTRAINT "asesores_seccion_pkey" PRIMARY KEY ("id_asesoria");



ALTER TABLE ONLY "public"."asesores_seccion"
    ADD CONSTRAINT "asesores_seccion_seccion_id_anio_escolar_id_key" UNIQUE ("seccion_id", "anio_escolar_id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_evaluacion_id_estudiante_id_key" UNIQUE ("evaluacion_id", "estudiante_id");



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id_calificacion");



ALTER TABLE ONLY "public"."docente_materia_seccion"
    ADD CONSTRAINT "docente_materia_seccion_docente_id_materia_id_seccion_id_an_key" UNIQUE ("docente_id", "materia_id", "seccion_id", "anio_escolar_id");



ALTER TABLE ONLY "public"."docente_materia_seccion"
    ADD CONSTRAINT "docente_materia_seccion_pkey" PRIMARY KEY ("id_asignacion");



ALTER TABLE ONLY "public"."estudiantes"
    ADD CONSTRAINT "estudiantes_cedula_key" UNIQUE ("cedula");



ALTER TABLE ONLY "public"."estudiantes"
    ADD CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id_estudiante");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_docente_id_materia_id_seccion_id_lapso_id_nomb_key" UNIQUE ("docente_id", "materia_id", "seccion_id", "lapso_id", "nombre");



ALTER TABLE ONLY "public"."evaluaciones_lapsos"
    ADD CONSTRAINT "evaluaciones_lapsos_pkey" PRIMARY KEY ("id_evaluacion");



ALTER TABLE ONLY "public"."evaluaciones_notas"
    ADD CONSTRAINT "evaluaciones_notas_pkey" PRIMARY KEY ("id_nota");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id_evaluacion");



ALTER TABLE ONLY "public"."inscripciones"
    ADD CONSTRAINT "inscripciones_estudiante_id_anio_escolar_id_key" UNIQUE ("estudiante_id", "anio_escolar_id");



ALTER TABLE ONLY "public"."inscripciones"
    ADD CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id_inscripcion");



ALTER TABLE ONLY "public"."lapsos"
    ADD CONSTRAINT "lapsos_anio_escolar_id_numero_lapso_key" UNIQUE ("anio_escolar_id", "numero_lapso");



ALTER TABLE ONLY "public"."lapsos"
    ADD CONSTRAINT "lapsos_pkey" PRIMARY KEY ("id_lapso");



ALTER TABLE ONLY "public"."materias"
    ADD CONSTRAINT "materias_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."materias"
    ADD CONSTRAINT "materias_pkey" PRIMARY KEY ("id_materia");



ALTER TABLE ONLY "public"."notas_anuales"
    ADD CONSTRAINT "notas_anuales_estudiante_id_materia_id_anio_escolar_id_key" UNIQUE ("estudiante_id", "materia_id", "anio_escolar_id");



ALTER TABLE ONLY "public"."notas_anuales"
    ADD CONSTRAINT "notas_anuales_pkey" PRIMARY KEY ("id_nota_anual");



ALTER TABLE ONLY "public"."notas_lapso"
    ADD CONSTRAINT "notas_lapso_estudiante_id_materia_id_lapso_id_key" UNIQUE ("estudiante_id", "materia_id", "lapso_id");



ALTER TABLE ONLY "public"."notas_lapso"
    ADD CONSTRAINT "notas_lapso_pkey" PRIMARY KEY ("id_nota_lapso");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_cedula_key" UNIQUE ("cedula");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."periodos_academicos"
    ADD CONSTRAINT "periodos_academicos_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."periodos_academicos"
    ADD CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id_periodo");



ALTER TABLE ONLY "public"."rol"
    ADD CONSTRAINT "rol_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."rol"
    ADD CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol");



ALTER TABLE ONLY "public"."seccion_materias"
    ADD CONSTRAINT "seccion_materias_pkey" PRIMARY KEY ("id_seccion", "id_materia");



ALTER TABLE ONLY "public"."secciones"
    ADD CONSTRAINT "secciones_grado_letra_anio_escolar_id_key" UNIQUE ("grado", "letra", "anio_escolar_id");



ALTER TABLE ONLY "public"."secciones"
    ADD CONSTRAINT "secciones_nombre_anio_escolar_id_key" UNIQUE ("nombre", "anio_escolar_id");



ALTER TABLE ONLY "public"."secciones"
    ADD CONSTRAINT "secciones_pkey" PRIMARY KEY ("id_seccion");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "id_rol");



CREATE INDEX "idx_asesores_seccion_docente" ON "public"."asesores_seccion" USING "btree" ("docente_id");



CREATE INDEX "idx_calificaciones_estudiante" ON "public"."calificaciones" USING "btree" ("estudiante_id");



CREATE INDEX "idx_calificaciones_evaluacion" ON "public"."calificaciones" USING "btree" ("evaluacion_id");



CREATE INDEX "idx_docente_materia_seccion_docente" ON "public"."docente_materia_seccion" USING "btree" ("docente_id");



CREATE INDEX "idx_evaluaciones_docente" ON "public"."evaluaciones" USING "btree" ("docente_id");



CREATE INDEX "idx_inscripciones_anio" ON "public"."inscripciones" USING "btree" ("anio_escolar_id");



CREATE INDEX "idx_lapsos_anio" ON "public"."lapsos" USING "btree" ("anio_escolar_id");



CREATE INDEX "idx_notas_anuales_anio" ON "public"."notas_anuales" USING "btree" ("anio_escolar_id");



CREATE INDEX "idx_notas_anuales_estudiante" ON "public"."notas_anuales" USING "btree" ("estudiante_id");



CREATE INDEX "idx_notas_lapso_estudiante" ON "public"."notas_lapso" USING "btree" ("estudiante_id");



CREATE INDEX "idx_notas_lapso_materia" ON "public"."notas_lapso" USING "btree" ("materia_id");



CREATE INDEX "idx_perfiles_cedula" ON "public"."perfiles" USING "btree" ("cedula");



CREATE INDEX "idx_perfiles_nombres_apellidos" ON "public"."perfiles" USING "btree" ("nombres", "apellidos");



CREATE INDEX "idx_seccion_materias_docente" ON "public"."seccion_materias" USING "btree" ("id_docente");



CREATE INDEX "idx_seccion_materias_seccion" ON "public"."seccion_materias" USING "btree" ("id_seccion");



CREATE INDEX "idx_secciones_anio" ON "public"."secciones" USING "btree" ("anio_escolar_id");



CREATE OR REPLACE TRIGGER "audit_calificaciones" AFTER INSERT OR DELETE OR UPDATE ON "public"."calificaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log"();



CREATE OR REPLACE TRIGGER "audit_evaluaciones" AFTER INSERT OR DELETE OR UPDATE ON "public"."evaluaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log"();



CREATE OR REPLACE TRIGGER "audit_inscripciones" AFTER INSERT OR DELETE OR UPDATE ON "public"."inscripciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log"();



CREATE OR REPLACE TRIGGER "audit_perfiles" AFTER INSERT OR DELETE OR UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log"();



CREATE OR REPLACE TRIGGER "audit_periodos" AFTER INSERT OR DELETE OR UPDATE ON "public"."periodos_academicos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log"();



CREATE OR REPLACE TRIGGER "before_evaluacion_porcentaje" BEFORE INSERT OR UPDATE ON "public"."evaluaciones" FOR EACH ROW EXECUTE FUNCTION "public"."validar_porcentaje_evaluacion"();



CREATE OR REPLACE TRIGGER "tg_lapso_overlap" BEFORE INSERT OR UPDATE ON "public"."lapsos" FOR EACH ROW EXECUTE FUNCTION "public"."check_lapso_overlap"();



CREATE OR REPLACE TRIGGER "trg_actualizar_promedio" AFTER INSERT OR DELETE OR UPDATE ON "public"."evaluaciones_notas" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_promedio_final"();



CREATE OR REPLACE TRIGGER "trg_prevenir_inscripcion_duplicada" BEFORE INSERT OR UPDATE ON "public"."inscripciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_prevenir_inscripcion_duplicada"();



CREATE OR REPLACE TRIGGER "trigger_calificaciones" AFTER INSERT OR DELETE OR UPDATE ON "public"."calificaciones" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_nota_lapso"();



CREATE OR REPLACE TRIGGER "trigger_nota_anual" AFTER INSERT OR UPDATE ON "public"."notas_lapso" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_nota_anual"();



CREATE OR REPLACE TRIGGER "trigger_validar_calificacion_ventana" BEFORE INSERT OR UPDATE ON "public"."calificaciones" FOR EACH ROW EXECUTE FUNCTION "public"."validar_calificacion_ventana"();



ALTER TABLE ONLY "public"."asesores_seccion"
    ADD CONSTRAINT "asesores_seccion_anio_escolar_id_fkey" FOREIGN KEY ("anio_escolar_id") REFERENCES "public"."anios_escolares"("id_anio") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asesores_seccion"
    ADD CONSTRAINT "asesores_seccion_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."asesores_seccion"
    ADD CONSTRAINT "asesores_seccion_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "public"."secciones"("id_seccion") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "public"."estudiantes"("id_estudiante") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calificaciones"
    ADD CONSTRAINT "calificaciones_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "public"."evaluaciones"("id_evaluacion") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."docente_materia_seccion"
    ADD CONSTRAINT "docente_materia_seccion_anio_escolar_id_fkey" FOREIGN KEY ("anio_escolar_id") REFERENCES "public"."anios_escolares"("id_anio");



ALTER TABLE ONLY "public"."docente_materia_seccion"
    ADD CONSTRAINT "docente_materia_seccion_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."docente_materia_seccion"
    ADD CONSTRAINT "docente_materia_seccion_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id_materia");



ALTER TABLE ONLY "public"."docente_materia_seccion"
    ADD CONSTRAINT "docente_materia_seccion_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "public"."secciones"("id_seccion");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_lapso_id_fkey" FOREIGN KEY ("lapso_id") REFERENCES "public"."lapsos"("id_lapso");



ALTER TABLE ONLY "public"."evaluaciones_lapsos"
    ADD CONSTRAINT "evaluaciones_lapsos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."evaluaciones_lapsos"
    ADD CONSTRAINT "evaluaciones_lapsos_lapso_id_fkey" FOREIGN KEY ("lapso_id") REFERENCES "public"."lapsos"("id_lapso");



ALTER TABLE ONLY "public"."evaluaciones_lapsos"
    ADD CONSTRAINT "evaluaciones_lapsos_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id_materia");



ALTER TABLE ONLY "public"."evaluaciones_lapsos"
    ADD CONSTRAINT "evaluaciones_lapsos_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "public"."secciones"("id_seccion");



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id_materia");



ALTER TABLE ONLY "public"."evaluaciones_notas"
    ADD CONSTRAINT "evaluaciones_notas_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "public"."estudiantes"("id_estudiante");



ALTER TABLE ONLY "public"."evaluaciones_notas"
    ADD CONSTRAINT "evaluaciones_notas_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "public"."evaluaciones_lapsos"("id_evaluacion") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluaciones"
    ADD CONSTRAINT "evaluaciones_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "public"."secciones"("id_seccion");



ALTER TABLE ONLY "public"."inscripciones"
    ADD CONSTRAINT "inscripciones_anio_escolar_id_fkey" FOREIGN KEY ("anio_escolar_id") REFERENCES "public"."anios_escolares"("id_anio");



ALTER TABLE ONLY "public"."inscripciones"
    ADD CONSTRAINT "inscripciones_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "public"."estudiantes"("id_estudiante") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inscripciones"
    ADD CONSTRAINT "inscripciones_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "public"."secciones"("id_seccion");



ALTER TABLE ONLY "public"."lapsos"
    ADD CONSTRAINT "lapsos_anio_escolar_id_fkey" FOREIGN KEY ("anio_escolar_id") REFERENCES "public"."anios_escolares"("id_anio") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_anuales"
    ADD CONSTRAINT "notas_anuales_anio_escolar_id_fkey" FOREIGN KEY ("anio_escolar_id") REFERENCES "public"."anios_escolares"("id_anio");



ALTER TABLE ONLY "public"."notas_anuales"
    ADD CONSTRAINT "notas_anuales_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "public"."estudiantes"("id_estudiante") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_anuales"
    ADD CONSTRAINT "notas_anuales_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id_materia");



ALTER TABLE ONLY "public"."notas_lapso"
    ADD CONSTRAINT "notas_lapso_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "public"."estudiantes"("id_estudiante") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_lapso"
    ADD CONSTRAINT "notas_lapso_lapso_id_fkey" FOREIGN KEY ("lapso_id") REFERENCES "public"."lapsos"("id_lapso");



ALTER TABLE ONLY "public"."notas_lapso"
    ADD CONSTRAINT "notas_lapso_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "public"."materias"("id_materia");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seccion_materias"
    ADD CONSTRAINT "seccion_materias_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."seccion_materias"
    ADD CONSTRAINT "seccion_materias_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "public"."materias"("id_materia");



ALTER TABLE ONLY "public"."seccion_materias"
    ADD CONSTRAINT "seccion_materias_id_seccion_fkey" FOREIGN KEY ("id_seccion") REFERENCES "public"."secciones"("id_seccion") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."secciones"
    ADD CONSTRAINT "secciones_anio_escolar_id_fkey" FOREIGN KEY ("anio_escolar_id") REFERENCES "public"."anios_escolares"("id_anio") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."rol"("id_rol");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;



CREATE POLICY "anios_directivo" ON "public"."anios_escolares" USING ((4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



ALTER TABLE "public"."anios_escolares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anios_read_all" ON "public"."anios_escolares" FOR SELECT USING (true);



CREATE POLICY "asesores_delete" ON "public"."asesores_seccion" FOR DELETE USING ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "asesores_docente_read" ON "public"."asesores_seccion" FOR SELECT USING (("docente_id" = "auth"."uid"()));



CREATE POLICY "asesores_gestion" ON "public"."asesores_seccion" USING (((3 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "asesores_insert" ON "public"."asesores_seccion" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "asesores_read_others" ON "public"."asesores_seccion" FOR SELECT USING (((2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



ALTER TABLE "public"."asesores_seccion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asesores_select" ON "public"."asesores_seccion" FOR SELECT USING (("public"."has_any_role"(ARRAY[1, 2, 3, 4, 5]) OR ("docente_id" = "auth"."uid"())));



CREATE POLICY "asesores_update" ON "public"."asesores_seccion" FOR UPDATE USING ("public"."has_any_role"(ARRAY[3, 4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "asignacion_docente_read" ON "public"."docente_materia_seccion" FOR SELECT USING ((("docente_id" = "auth"."uid"()) AND (1 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "asignacion_evaldoc" ON "public"."docente_materia_seccion" USING (((3 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calificaciones_asesor_read" ON "public"."calificaciones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."evaluaciones" "e"
     JOIN "public"."inscripciones" "i" ON (("i"."estudiante_id" = "calificaciones"."estudiante_id")))
     JOIN "public"."asesores_seccion" "a" ON ((("a"."seccion_id" = "i"."seccion_id") AND ("a"."anio_escolar_id" = "i"."anio_escolar_id"))))
  WHERE (("e"."id_evaluacion" = "calificaciones"."evaluacion_id") AND ("a"."docente_id" = "auth"."uid"()) AND ("a"."activo" = true)))));



CREATE POLICY "calificaciones_control_read" ON "public"."calificaciones" FOR SELECT USING (((2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "calificaciones_delete" ON "public"."calificaciones" FOR DELETE USING ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "calificaciones_docente_own" ON "public"."calificaciones" USING ((EXISTS ( SELECT 1
   FROM "public"."evaluaciones" "e"
  WHERE (("e"."id_evaluacion" = "calificaciones"."evaluacion_id") AND ("e"."docente_id" = "auth"."uid"())))));



CREATE POLICY "calificaciones_insert" ON "public"."calificaciones" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."evaluaciones" "e"
     JOIN "public"."lapsos" "l" ON (("l"."id_lapso" = "e"."lapso_id")))
     JOIN "public"."periodos_academicos" "p" ON (("p"."id_periodo" = "l"."anio_escolar_id")))
  WHERE (("e"."id_evaluacion" = "calificaciones"."evaluacion_id") AND ("e"."docente_id" = "auth"."uid"()) AND ("p"."activo" = true) AND (("l"."inicio_carga" IS NULL) OR ("l"."inicio_carga" <= "now"())) AND (("l"."fin_carga" IS NULL) OR ("l"."fin_carga" >= "now"()))))));



CREATE POLICY "calificaciones_select" ON "public"."calificaciones" FOR SELECT USING (("public"."has_any_role"(ARRAY[3, 4, 5, 2]) OR (EXISTS ( SELECT 1
   FROM "public"."evaluaciones" "e"
  WHERE (("e"."id_evaluacion" = "calificaciones"."evaluacion_id") AND ("e"."docente_id" = "auth"."uid"()))))));



CREATE POLICY "calificaciones_update" ON "public"."calificaciones" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."evaluaciones" "e"
     JOIN "public"."lapsos" "l" ON (("l"."id_lapso" = "e"."lapso_id")))
     JOIN "public"."periodos_academicos" "p" ON (("p"."id_periodo" = "l"."anio_escolar_id")))
  WHERE (("e"."id_evaluacion" = "calificaciones"."evaluacion_id") AND ("e"."docente_id" = "auth"."uid"()) AND ("p"."activo" = true) AND (("l"."inicio_carga" IS NULL) OR ("l"."inicio_carga" <= "now"())) AND (("l"."fin_carga" IS NULL) OR ("l"."fin_carga" >= "now"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."evaluaciones" "e"
     JOIN "public"."lapsos" "l" ON (("l"."id_lapso" = "e"."lapso_id")))
     JOIN "public"."periodos_academicos" "p" ON (("p"."id_periodo" = "l"."anio_escolar_id")))
  WHERE (("e"."id_evaluacion" = "calificaciones"."evaluacion_id") AND ("e"."docente_id" = "auth"."uid"()) AND ("p"."activo" = true) AND (("l"."inicio_carga" IS NULL) OR ("l"."inicio_carga" <= "now"())) AND (("l"."fin_carga" IS NULL) OR ("l"."fin_carga" >= "now"()))))));



CREATE POLICY "deny_delete_notas_anuales" ON "public"."notas_anuales" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "deny_delete_notas_lapso" ON "public"."notas_lapso" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "deny_insert_perfiles" ON "public"."perfiles" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "deny_update_notas_anuales" ON "public"."notas_anuales" FOR UPDATE TO "authenticated" USING (false);



CREATE POLICY "deny_update_notas_lapso" ON "public"."notas_lapso" FOR UPDATE TO "authenticated" USING (false);



CREATE POLICY "deny_write_notas_anuales" ON "public"."notas_anuales" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "deny_write_notas_lapso" ON "public"."notas_lapso" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "dms_delete" ON "public"."docente_materia_seccion" FOR DELETE USING ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "dms_insert" ON "public"."docente_materia_seccion" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "dms_select" ON "public"."docente_materia_seccion" FOR SELECT USING (("public"."has_any_role"(ARRAY[1, 2, 3, 4, 5]) OR ("docente_id" = "auth"."uid"())));



CREATE POLICY "dms_update" ON "public"."docente_materia_seccion" FOR UPDATE USING ("public"."has_any_role"(ARRAY[3, 4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[3, 4, 5]));



ALTER TABLE "public"."docente_materia_seccion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estudiantes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estudiantes_control" ON "public"."estudiantes" USING (((2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "estudiantes_delete" ON "public"."estudiantes" FOR DELETE USING ("public"."has_any_role"(ARRAY[2, 4, 5]));



CREATE POLICY "estudiantes_insert" ON "public"."estudiantes" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[2, 4, 5]));



CREATE POLICY "estudiantes_select" ON "public"."estudiantes" FOR SELECT USING (("public"."has_any_role"(ARRAY[3, 4, 5, 2]) OR (EXISTS ( SELECT 1
   FROM ("public"."inscripciones" "i"
     JOIN "public"."docente_materia_seccion" "dms" ON (("dms"."seccion_id" = "i"."seccion_id")))
  WHERE (("i"."estudiante_id" = "estudiantes"."id_estudiante") AND ("dms"."docente_id" = "auth"."uid"()))))));



CREATE POLICY "estudiantes_update" ON "public"."estudiantes" FOR UPDATE USING ("public"."has_any_role"(ARRAY[2, 4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[2, 4, 5]));



ALTER TABLE "public"."evaluaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluaciones_delete" ON "public"."evaluaciones" FOR DELETE USING ("public"."has_any_role"(ARRAY[3, 4, 5]));



CREATE POLICY "evaluaciones_docente_own" ON "public"."evaluaciones" USING ((("docente_id" = "auth"."uid"()) AND (1 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "evaluaciones_insert" ON "public"."evaluaciones" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[3, 4, 5]));



ALTER TABLE "public"."evaluaciones_lapsos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluaciones_notas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluaciones_read_evaldoc_directivo" ON "public"."evaluaciones" FOR SELECT USING (((3 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "evaluaciones_select" ON "public"."evaluaciones" FOR SELECT USING (("public"."has_any_role"(ARRAY[2, 3, 4, 5]) OR ("docente_id" = "auth"."uid"())));



CREATE POLICY "evaluaciones_update" ON "public"."evaluaciones" FOR UPDATE USING ("public"."has_any_role"(ARRAY[3, 4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[3, 4, 5]));



ALTER TABLE "public"."inscripciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inscripciones_control" ON "public"."inscripciones" USING (((2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "inscripciones_delete" ON "public"."inscripciones" FOR DELETE USING ("public"."has_any_role"(ARRAY[2, 4, 5]));



CREATE POLICY "inscripciones_insert" ON "public"."inscripciones" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[2, 4, 5]));



CREATE POLICY "inscripciones_read_docente_asesor" ON "public"."inscripciones" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."docente_materia_seccion"
  WHERE (("docente_materia_seccion"."docente_id" = "auth"."uid"()) AND ("docente_materia_seccion"."seccion_id" = "inscripciones"."seccion_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."asesores_seccion"
  WHERE (("asesores_seccion"."docente_id" = "auth"."uid"()) AND ("asesores_seccion"."seccion_id" = "inscripciones"."seccion_id") AND ("asesores_seccion"."activo" = true)))) OR (2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "inscripciones_select" ON "public"."inscripciones" FOR SELECT USING (("public"."has_any_role"(ARRAY[3, 4, 5, 2]) OR (EXISTS ( SELECT 1
   FROM "public"."docente_materia_seccion" "dms"
  WHERE (("dms"."seccion_id" = "inscripciones"."seccion_id") AND ("dms"."docente_id" = "auth"."uid"()))))));



CREATE POLICY "inscripciones_update" ON "public"."inscripciones" FOR UPDATE USING ("public"."has_any_role"(ARRAY[2, 4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[2, 4, 5]));



ALTER TABLE "public"."lapsos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lapsos_delete" ON "public"."lapsos" FOR DELETE USING ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "lapsos_directivo" ON "public"."lapsos" USING ((4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "lapsos_insert" ON "public"."lapsos" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "lapsos_read_all" ON "public"."lapsos" FOR SELECT USING (true);



CREATE POLICY "lapsos_select" ON "public"."lapsos" FOR SELECT USING ("public"."has_any_role"(ARRAY[2, 3, 4, 5]));



CREATE POLICY "lapsos_update" ON "public"."lapsos" FOR UPDATE USING ("public"."has_any_role"(ARRAY[4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[4, 5]));



ALTER TABLE "public"."materias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materias_directivo_all" ON "public"."materias" USING ((4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "materias_read_all" ON "public"."materias" FOR SELECT USING (true);



CREATE POLICY "materias_select" ON "public"."materias" FOR SELECT USING ("public"."has_any_role"(ARRAY[1, 2, 3, 4, 5]));



ALTER TABLE "public"."notas_anuales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notas_anuales_asesor_read" ON "public"."notas_anuales" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."inscripciones" "i"
     JOIN "public"."asesores_seccion" "a" ON ((("a"."seccion_id" = "i"."seccion_id") AND ("a"."anio_escolar_id" = "i"."anio_escolar_id"))))
  WHERE (("i"."estudiante_id" = "notas_anuales"."estudiante_id") AND ("a"."docente_id" = "auth"."uid"()) AND ("a"."activo" = true)))));



CREATE POLICY "notas_anuales_control_read" ON "public"."notas_anuales" FOR SELECT USING (((2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "notas_anuales_docente_read" ON "public"."notas_anuales" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."docente_materia_seccion" "dms"
  WHERE (("dms"."docente_id" = "auth"."uid"()) AND ("dms"."materia_id" = "notas_anuales"."materia_id") AND ("dms"."anio_escolar_id" = "notas_anuales"."anio_escolar_id")))));



CREATE POLICY "notas_anuales_select" ON "public"."notas_anuales" FOR SELECT USING (("public"."has_any_role"(ARRAY[3, 4, 5, 2]) OR (EXISTS ( SELECT 1
   FROM "public"."docente_materia_seccion" "dms"
  WHERE (("dms"."materia_id" = "notas_anuales"."materia_id") AND ("dms"."docente_id" = "auth"."uid"()))))));



ALTER TABLE "public"."notas_lapso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notas_lapso_asesor_read" ON "public"."notas_lapso" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."inscripciones" "i"
     JOIN "public"."asesores_seccion" "a" ON ((("a"."seccion_id" = "i"."seccion_id") AND ("a"."anio_escolar_id" = "i"."anio_escolar_id"))))
  WHERE (("i"."estudiante_id" = "notas_lapso"."estudiante_id") AND ("a"."docente_id" = "auth"."uid"()) AND ("a"."activo" = true)))));



CREATE POLICY "notas_lapso_control_read" ON "public"."notas_lapso" FOR SELECT USING (((2 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "notas_lapso_docente_read" ON "public"."notas_lapso" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."docente_materia_seccion" "dms"
  WHERE (("dms"."docente_id" = "auth"."uid"()) AND ("dms"."materia_id" = "notas_lapso"."materia_id") AND ("dms"."anio_escolar_id" = ( SELECT "lapsos"."anio_escolar_id"
           FROM "public"."lapsos"
          WHERE ("lapsos"."id_lapso" = "notas_lapso"."lapso_id")))))));



CREATE POLICY "notas_lapso_select" ON "public"."notas_lapso" FOR SELECT USING (("public"."has_any_role"(ARRAY[3, 4, 5, 2]) OR (EXISTS ( SELECT 1
   FROM "public"."docente_materia_seccion" "dms"
  WHERE (("dms"."materia_id" = "notas_lapso"."materia_id") AND ("dms"."docente_id" = "auth"."uid"()))))));



ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_directivo_all" ON "public"."perfiles" USING ((4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "perfiles_insert_directivo_superadmin" ON "public"."perfiles" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "perfiles_select_self_or_directivo" ON "public"."perfiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."has_any_role"(ARRAY[4, 5])));



CREATE POLICY "perfiles_self_read" ON "public"."perfiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "perfiles_update_directivo" ON "public"."perfiles" FOR UPDATE USING ("public"."has_any_role"(ARRAY[4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "perfiles_update_self" ON "public"."perfiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."periodos_academicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "periodos_delete" ON "public"."periodos_academicos" FOR DELETE USING ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "periodos_insert" ON "public"."periodos_academicos" FOR INSERT WITH CHECK ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "periodos_select" ON "public"."periodos_academicos" FOR SELECT USING ("public"."has_any_role"(ARRAY[1, 2, 3, 4, 5]));



CREATE POLICY "periodos_update" ON "public"."periodos_academicos" FOR UPDATE USING ("public"."has_any_role"(ARRAY[4, 5])) WITH CHECK ("public"."has_any_role"(ARRAY[4, 5]));



ALTER TABLE "public"."rol" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seccion_materias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "secciones_directivo" ON "public"."secciones" USING ((4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "secciones_read_all" ON "public"."secciones" FOR SELECT USING (true);



CREATE POLICY "secciones_select" ON "public"."secciones" FOR SELECT USING ("public"."has_any_role"(ARRAY[1, 2, 3, 4, 5]));



CREATE POLICY "superadmin_all_anios_escolares" ON "public"."anios_escolares" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_asesores_seccion" ON "public"."asesores_seccion" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_calificaciones" ON "public"."calificaciones" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_docente_materia_seccion" ON "public"."docente_materia_seccion" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_estudiantes" ON "public"."estudiantes" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_evaluaciones" ON "public"."evaluaciones" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_inscripciones" ON "public"."inscripciones" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_lapsos" ON "public"."lapsos" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_materias" ON "public"."materias" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_notas_anuales" ON "public"."notas_anuales" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_notas_lapso" ON "public"."notas_lapso" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_perfiles" ON "public"."perfiles" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_rol" ON "public"."rol" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_secciones" ON "public"."secciones" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



CREATE POLICY "superadmin_all_user_roles" ON "public"."user_roles" TO "authenticated" USING ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))) WITH CHECK ((5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete" ON "public"."user_roles" FOR DELETE USING ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "user_roles_gestion" ON "public"."user_roles" USING (((4 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles")) OR (5 IN ( SELECT "public"."current_user_roles"() AS "current_user_roles"))));



CREATE POLICY "user_roles_insert" ON "public"."user_roles" FOR INSERT WITH CHECK (("public"."has_role"(5) OR ("public"."has_role"(4) AND ("id_rol" <> ALL (ARRAY[4, 5])))));



CREATE POLICY "user_roles_select" ON "public"."user_roles" FOR SELECT USING ("public"."has_any_role"(ARRAY[4, 5]));



CREATE POLICY "user_roles_self_read" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_roles_update" ON "public"."user_roles" FOR UPDATE USING ("public"."has_any_role"(ARRAY[4, 5])) WITH CHECK (("public"."has_role"(5) OR ("public"."has_role"(4) AND ("id_rol" <> ALL (ARRAY[4, 5])))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."activar_lapso"("p_id_lapso" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."activar_lapso"("p_id_lapso" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."activar_lapso"("p_id_lapso" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_nota_anual"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_nota_anual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_nota_anual"() TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_nota_lapso"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_nota_lapso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_nota_lapso"() TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_promedio_final"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_promedio_final"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_promedio_final"() TO "service_role";



GRANT ALL ON FUNCTION "public"."agregar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."agregar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."agregar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."asignar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."asignar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."asignar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_nota_lapso"("p_estudiante_id" integer, "p_materia_id" integer, "p_lapso_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_nota_lapso"("p_estudiante_id" integer, "p_materia_id" integer, "p_lapso_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_nota_lapso"("p_estudiante_id" integer, "p_materia_id" integer, "p_lapso_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_promedio_estudiante"("p_estudiante" integer, "p_inscripcion" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_promedio_estudiante"("p_estudiante" integer, "p_inscripcion" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_promedio_estudiante"("p_estudiante" integer, "p_inscripcion" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cambiar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cambiar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cambiar_docente_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer, "p_id_docente" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cerrar_anio_escolar"("p_id_anio" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cerrar_anio_escolar"("p_id_anio" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cerrar_anio_escolar"("p_id_anio" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cerrar_lapso"("p_id_lapso" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cerrar_lapso"("p_id_lapso" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cerrar_lapso"("p_id_lapso" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_lapso_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_lapso_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_lapso_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clonar_seccion"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."clonar_seccion"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clonar_seccion"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."clonar_seccion_otro_anio"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text", "p_id_anio_destino" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."clonar_seccion_otro_anio"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text", "p_id_anio_destino" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."clonar_seccion_otro_anio"("p_id_seccion_origen" integer, "p_nombre_nuevo" "text", "p_letra_nueva" "text", "p_id_anio_destino" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_anio_escolar"("p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."crear_anio_escolar"("p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_anio_escolar"("p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_lapso"("p_id_anio" integer, "p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."crear_lapso"("p_id_anio" integer, "p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_lapso"("p_id_anio" integer, "p_nombre" "text", "p_fecha_inicio" "date", "p_fecha_fin" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_seccion"("p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."crear_seccion"("p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_seccion"("p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."editar_seccion"("p_id_seccion" integer, "p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."editar_seccion"("p_id_seccion" integer, "p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."editar_seccion"("p_id_seccion" integer, "p_nombre" "text", "p_grado" integer, "p_letra" "text", "p_anio_escolar_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_audit_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_audit_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_audit_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_prevenir_inscripcion_duplicada"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_prevenir_inscripcion_duplicada"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_prevenir_inscripcion_duplicada"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_retirar_estudiante"("p_id_inscripcion" integer, "p_usuario" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_retirar_estudiante"("p_id_inscripcion" integer, "p_usuario" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_retirar_estudiante"("p_id_inscripcion" integer, "p_usuario" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_any_role"("p_roles" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_any_role"("p_roles" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_role"("p_roles" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("p_role" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("p_role" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("p_role" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."listar_materias_seccion"("p_id_seccion" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."listar_materias_seccion"("p_id_seccion" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_materias_seccion"("p_id_seccion" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."listar_secciones"("p_anio_escolar_id" integer, "p_activo" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."listar_secciones"("p_anio_escolar_id" integer, "p_activo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_secciones"("p_anio_escolar_id" integer, "p_activo" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."anios_escolares" TO "anon";
GRANT ALL ON TABLE "public"."anios_escolares" TO "authenticated";
GRANT ALL ON TABLE "public"."anios_escolares" TO "service_role";



GRANT ALL ON FUNCTION "public"."obtener_anio_activo"() TO "anon";
GRANT ALL ON FUNCTION "public"."obtener_anio_activo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_anio_activo"() TO "service_role";



GRANT ALL ON TABLE "public"."lapsos" TO "anon";
GRANT ALL ON TABLE "public"."lapsos" TO "authenticated";
GRANT ALL ON TABLE "public"."lapsos" TO "service_role";



GRANT ALL ON FUNCTION "public"."obtener_lapsos"("p_id_anio" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."obtener_lapsos"("p_id_anio" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_lapsos"("p_id_anio" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."promover_estudiantes"("p_anio_origen_id" integer, "p_anio_destino_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."promover_estudiantes"("p_anio_origen_id" integer, "p_anio_destino_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."promover_estudiantes"("p_anio_origen_id" integer, "p_anio_destino_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."prueba_mostrar"("texto" "text", "resultado" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."prueba_mostrar"("texto" "text", "resultado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."prueba_mostrar"("texto" "text", "resultado" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."quitar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."quitar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."quitar_materia_seccion"("p_id_seccion" integer, "p_id_materia" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_seccion"("p_id_seccion" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_seccion"("p_id_seccion" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_seccion"("p_id_seccion" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_calificacion_ventana"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_calificacion_ventana"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_calificacion_ventana"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_porcentaje_evaluacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_porcentaje_evaluacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_porcentaje_evaluacion"() TO "service_role";


















GRANT ALL ON SEQUENCE "public"."anios_escolares_id_anio_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."anios_escolares_id_anio_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."anios_escolares_id_anio_seq" TO "service_role";



GRANT ALL ON TABLE "public"."asesores_seccion" TO "anon";
GRANT ALL ON TABLE "public"."asesores_seccion" TO "authenticated";
GRANT ALL ON TABLE "public"."asesores_seccion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."asesores_seccion_id_asesoria_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."asesores_seccion_id_asesoria_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."asesores_seccion_id_asesoria_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."calificaciones" TO "anon";
GRANT ALL ON TABLE "public"."calificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."calificaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."calificaciones_id_calificacion_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."calificaciones_id_calificacion_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."calificaciones_id_calificacion_seq" TO "service_role";



GRANT ALL ON TABLE "public"."docente_materia_seccion" TO "anon";
GRANT ALL ON TABLE "public"."docente_materia_seccion" TO "authenticated";
GRANT ALL ON TABLE "public"."docente_materia_seccion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."docente_materia_seccion_id_asignacion_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."docente_materia_seccion_id_asignacion_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."docente_materia_seccion_id_asignacion_seq" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."docentes" TO "anon";
GRANT ALL ON TABLE "public"."docentes" TO "authenticated";
GRANT ALL ON TABLE "public"."docentes" TO "service_role";



GRANT ALL ON TABLE "public"."estudiantes" TO "anon";
GRANT ALL ON TABLE "public"."estudiantes" TO "authenticated";
GRANT ALL ON TABLE "public"."estudiantes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."estudiantes_id_estudiante_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."estudiantes_id_estudiante_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."estudiantes_id_estudiante_seq" TO "service_role";



GRANT ALL ON TABLE "public"."evaluaciones" TO "anon";
GRANT ALL ON TABLE "public"."evaluaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluaciones_id_evaluacion_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluaciones_id_evaluacion_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluaciones_id_evaluacion_seq" TO "service_role";



GRANT ALL ON TABLE "public"."evaluaciones_lapsos" TO "anon";
GRANT ALL ON TABLE "public"."evaluaciones_lapsos" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluaciones_lapsos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluaciones_lapsos_id_evaluacion_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluaciones_lapsos_id_evaluacion_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluaciones_lapsos_id_evaluacion_seq" TO "service_role";



GRANT ALL ON TABLE "public"."evaluaciones_notas" TO "anon";
GRANT ALL ON TABLE "public"."evaluaciones_notas" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluaciones_notas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."evaluaciones_notas_id_nota_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."evaluaciones_notas_id_nota_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."evaluaciones_notas_id_nota_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inscripciones" TO "anon";
GRANT ALL ON TABLE "public"."inscripciones" TO "authenticated";
GRANT ALL ON TABLE "public"."inscripciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inscripciones_id_inscripcion_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inscripciones_id_inscripcion_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inscripciones_id_inscripcion_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lapsos_id_lapso_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lapsos_id_lapso_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lapsos_id_lapso_seq" TO "service_role";



GRANT ALL ON TABLE "public"."materias" TO "anon";
GRANT ALL ON TABLE "public"."materias" TO "authenticated";
GRANT ALL ON TABLE "public"."materias" TO "service_role";



GRANT ALL ON SEQUENCE "public"."materias_id_materia_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."materias_id_materia_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."materias_id_materia_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notas_anuales" TO "anon";
GRANT ALL ON TABLE "public"."notas_anuales" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_anuales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notas_anuales_id_nota_anual_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notas_anuales_id_nota_anual_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notas_anuales_id_nota_anual_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notas_lapso" TO "anon";
GRANT ALL ON TABLE "public"."notas_lapso" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_lapso" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notas_lapso_id_nota_lapso_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notas_lapso_id_nota_lapso_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notas_lapso_id_nota_lapso_seq" TO "service_role";



GRANT ALL ON TABLE "public"."periodos_academicos" TO "anon";
GRANT ALL ON TABLE "public"."periodos_academicos" TO "authenticated";
GRANT ALL ON TABLE "public"."periodos_academicos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."periodos_academicos_id_periodo_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."periodos_academicos_id_periodo_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."periodos_academicos_id_periodo_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rol" TO "anon";
GRANT ALL ON TABLE "public"."rol" TO "authenticated";
GRANT ALL ON TABLE "public"."rol" TO "service_role";



GRANT ALL ON TABLE "public"."seccion_materias" TO "anon";
GRANT ALL ON TABLE "public"."seccion_materias" TO "authenticated";
GRANT ALL ON TABLE "public"."seccion_materias" TO "service_role";



GRANT ALL ON TABLE "public"."secciones" TO "anon";
GRANT ALL ON TABLE "public"."secciones" TO "authenticated";
GRANT ALL ON TABLE "public"."secciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."secciones_id_seccion_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."secciones_id_seccion_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."secciones_id_seccion_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































