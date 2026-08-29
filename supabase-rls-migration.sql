-- ================================================================
-- SENDERY CRM — Migración de seguridad: Row Level Security (RLS)
-- Ejecutar en: Supabase Dashboard → SQL Editor (proyecto de producción)
--
-- Por qué: las tablas se crearon sin RLS. Con la anon key (pública,
-- va incrustada en el bundle del frontend) cualquier persona podía
-- leer y escribir TODA la información: clientes, cuentas bancarias,
-- saldos, abonos y pagos. Esta migración cierra el acceso: solo
-- usuarios autenticados (con sesión válida de Supabase Auth) pueden
-- leer o escribir datos.
--
-- Requisito previo: haber creado al menos un usuario en
-- Authentication → Users (ver instrucciones al final de este archivo).
-- ================================================================

-- 1) Activar RLS en todas las tablas
ALTER TABLE cuentas_bancarias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_proveedores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE excel_imports_log   ENABLE ROW LEVEL SECURITY;

-- 2) Políticas: solo usuarios autenticados pueden hacer CUALQUIER
--    operación (SELECT/INSERT/UPDATE/DELETE). No hay separación por
--    usuario porque este es un sistema interno de un solo equipo,
--    no una app multi-cliente — el control de acceso importante es
--    "adentro / afuera", no "cada quien ve solo lo suyo".
--
--    Si en el futuro quieres roles distintos (ej. un vendedor que
--    solo vea sus propios clientes), estas políticas son el lugar
--    para agregar esa lógica con auth.uid().

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cuentas_bancarias','proveedores','clientes','eventos',
    'participantes','abonos','gastos','pagos_proveedores',
    'movimientos','excel_imports_log'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "authenticated_full_access" ON %I;', t
    );
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON %I
         FOR ALL
         USING (auth.role() = ''authenticated'')
         WITH CHECK (auth.role() = ''authenticated'');',
      t
    );
  END LOOP;
END $$;

-- ================================================================
-- PASO MANUAL REQUERIDO (no se puede hacer por SQL):
--
-- 1. Ve a Supabase Dashboard → Authentication → Users → "Add user"
--    y crea una cuenta (email + password) para cada persona del
--    equipo que deba usar el CRM.
--
-- 2. Ve a Authentication → Providers → Email y VERIFICA que
--    "Allow new users to sign up" esté DESACTIVADO (para que nadie
--    externo pueda crear su propia cuenta desde la pantalla de login
--    de la app). Las cuentas solo se crean manualmente desde aquí.
--
-- 3. Después de correr este script, prueba con la anon key SIN
--    sesión (por ejemplo con curl) que ya NO puedes leer datos:
--
--    curl "https://<tu-proyecto>.supabase.co/rest/v1/clientes?select=*" \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    Debe regresar una lista vacía [] (bloqueado por RLS), no los
--    datos reales.
-- ================================================================
