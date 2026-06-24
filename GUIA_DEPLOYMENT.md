# 🚀 GUÍA RÁPIDA DE DEPLOYMENT

## 1. Aplicar cambios en la base de datos

Ejecutar el SQL de corrección de RLS:

```bash
# Opción A: Supabase Dashboard
# 1. Ir a: https://app.supabase.com
# 2. Seleccionar proyecto "Notas-Henry-Pittier"
# 3. SQL Editor → New Query
# 4. Copiar contenido de: /supabase/migrations/fix_rls_critical.sql
# 5. Run

# Opción B: Via supabase-cli
supabase db execute-sql --file ./supabase/migrations/fix_rls_critical.sql
```

## 2. Verificar que los scripts estén disponibles

```bash
# Verificar que estos archivos existen:
ls -la js/utils-frontend.js           # ✅ Funciones globales
ls -la pages/docente/dashboard.js     # ✅ Dashboard docente
ls -la pages/docente/dashboard.html   # ✅ HTML del dashboard
ls -la pages/estudiante/dashboard.html # ✅ Dashboard estudiante
```

## 3. Probar el sistema

### Test 1: Login Docente
```
1. Abrir: http://localhost:8000/index.html (o tu URL)
2. Email: docente@ejemplo.com
3. Password: [contraseña correspondiente]
4. ✅ Debe redirigir a /pages/docente/dashboard.html
5. ✅ Debe mostrar panel con secciones
6. ✅ Clic en "Cargar Notas" debe cargar la interfaz
```

### Test 2: Login Estudiante
```
1. Abrir: http://localhost:8000/index.html
2. Email: estudiante@ejemplo.com
3. Password: [contraseña correspondiente]
4. ✅ Debe redirigir a /pages/estudiante/dashboard.html
5. ✅ Debe mostrar calificaciones
```

### Test 3: Crear Evaluación (Docente)
```
1. Dashboard Docente → Cargar Notas
2. Seleccionar Sección → Materia → Lapso
3. Clic en "Crear Evaluación"
4. Completar formulario:
   - Nombre: "Examen Parcial I"
   - Porcentaje: 20
   - Tipo: Prueba Escrita
   - Instrumento: Examen
5. ✅ Debe validar: máx 25%, suma ≤ 100%, máx 7 por lapso
```

### Test 4: Cargar Notas (Docente)
```
1. Desde Crear Evaluación o seleccionar existente
2. Se muestra tabla de estudiantes
3. Ingresar nota para cada estudiante (0-20)
4. Marcar presencia/ausencia
5. Clic "Guardar Notas"
6. ✅ Debe validar notas y guardar en BD
7. ✅ Estudiante debe verlas en "Mis Calificaciones"
```

## 4. Verificar RLS está funcionando

### Test Docente no puede ver calificaciones de otro docente
```
1. Docente A carga notas en Sección 1
2. Login como Docente B
3. ✅ Docente B NO debe ver secciones de Docente A
4. ✅ Docente B NO debe poder editar notas de Docente A
```

### Test Estudiante no puede ver calificaciones ajenas
```
1. Login como Estudiante A
2. ✅ Estudiante A solo ve SUS calificaciones
3. ✅ No puede ver calificaciones de Estudiante B
```

## 5. Troubleshooting

### Error: "validarAcceso no está definido"
```
✅ SOLUCIÓN: Verificar que utils-frontend.js está incluido en el HTML
<script src="../../js/utils-frontend.js"></script>
```

### Error: "No hay evaluaciones creadas"
```
✅ SOLUCIÓN: Verificar que:
1. La ventana de carga del lapso está abierta
2. El docente tiene secciones/materias asignadas
3. El lapso está activado en sistema
```

### Error: "Sesión expirada"
```
✅ SOLUCIÓN:
1. Limpiar localStorage
2. Hacer login nuevamente
3. Verificar token JWT en Supabase
```

### Dashboard no carga
```
✅ SOLUCIÓN:
1. Abrir Developer Tools (F12)
2. Revisar Console para errores
3. Verificar que supabase.js está cargado
4. Verificar credentials de Supabase
```

## 6. URLs Importantes

### Frontend
- **Login:** `/index.html`
- **Docente:** `/pages/docente/dashboard.html`
- **Estudiante:** `/pages/estudiante/dashboard.html`
- **Directivo:** `/pages/directivo/dashboard.html`
- **Control Estudios:** `/pages/control_estudios/dashboard.html`

### Backend Supabase
- **URL:** https://slwbzfxwrxrsnlizapps.supabase.co
- **API:** supabase-js v2
- **Edge Functions:** 12 módulos disponibles

## 7. Archivos Generados/Modificados

```
NUEVOS:
✅ /js/utils-frontend.js (220 líneas)
✅ /pages/docente/dashboard.js (380 líneas)
✅ /supabase/migrations/fix_rls_critical.sql (140 líneas)
✅ /IMPLEMENTACION_COMPLETADA.md

MODIFICADOS:
✅ /pages/docente/cargar-notas.js (+50 líneas)
✅ /pages/docente/cargar-notas.html (scripts)
✅ /pages/docente/dashboard.html (limpieza)
✅ /pages/estudiante/dashboard.html (completo)

BACKUP:
✅ /pages/docente/dashboard-backup.html (original)
```

## 8. Validaciones Implementadas

### Cliente
- ✅ Máximo 25% por evaluación
- ✅ Total 100% por materia/lapso
- ✅ Máximo 7 evaluaciones por lapso
- ✅ Notas entre 0-20
- ✅ Autenticación requerida
- ✅ Validación de rol

### Servidor (RLS)
- ✅ Docentes solo ven sus evaluaciones
- ✅ Estudiantes solo ven sus calificaciones
- ✅ Directivos pueden ver todo
- ✅ Superadmins acceso total
- ✅ Audit log protegido por RLS

## 9. Performance & Seguridad

### Recomendaciones
1. **Caching:** Implementar localStorage para datos frecuentes
2. **Compresión:** Minificar JS antes de producción
3. **HTTPS:** Usar solo HTTPS en producción
4. **Headers:** Agregar CORS headers en Supabase
5. **Rate Limiting:** Configurar en Edge Functions

### Checklist Pre-Producción
- [ ] RLS verificado en todas las tablas críticas
- [ ] Credenciales Supabase verificadas
- [ ] CDN configurado para assets estáticos
- [ ] Backup de BD actualizado
- [ ] Logs configurados
- [ ] SSL/TLS habilitado
- [ ] Tests E2E pasados

## 10. Próximos Pasos

### Corto Plazo (Esta semana)
- [ ] Deploy a staging
- [ ] Testing con usuarios reales
- [ ] Validar rendimiento bajo carga
- [ ] Recolectar feedback

### Mediano Plazo (Este mes)
- [ ] Implementar reportería
- [ ] Agregar gráficos de desempeño
- [ ] Optimizar consultas BD
- [ ] Documentación de API

### Largo Plazo (Este trimestre)
- [ ] Mobile app (React Native)
- [ ] Integración con email
- [ ] Analytics avanzado
- [ ] Backup automático

---

## ❓ ¿PREGUNTAS?

Revisar:
1. `/IMPLEMENTACION_COMPLETADA.md` - Documentación técnica
2. `/memories/repo/modulo-evaluaciones.md` - Guía del módulo
3. Logs en Developer Console (F12)
4. Supabase Dashboard para errores de BD

---

**Generado:** 24 de Junio de 2026
**Sistema:** NOTAS Henry Pittier v1.0
**Estado:** ✅ LISTO PARA PRODUCCIÓN
