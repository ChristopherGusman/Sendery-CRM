-- ================================================================
-- SENDERY CRM — Migración anti-duplicados
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- QUÉ ESTABA PASANDO AL REGISTRAR ABONOS
-- --------------------------------------
-- 1) El botón "Registrar Abono" no tenía candado. Mientras Supabase
--    respondía, el botón seguía activo y sin señal de que estuviera
--    trabajando. Dos clics = dos abonos.
--
-- 2) El folio se generaba con precisión de MINUTO, así que dos abonos
--    registrados dentro del mismo minuto salían con el MISMO folio, y
--    dos recibos distintos se imprimían con el mismo número.
--
-- 3) Cuando eso pasaba, el movimiento bancario del segundo abono
--    chocaba con el índice único de movimientos(referencia) y no se
--    creaba — pero el saldo de la cuenta se sumaba de todos modos.
--    Resultado: la cuenta bancaria no cuadra con sus propios
--    movimientos.
--
-- 4) El saldo del participante se calculaba restando sobre el valor
--    que traía la pantalla, no sobre los abonos reales. Si la vista
--    estaba desfasada, el saldo quedaba mal de forma permanente.
--
-- 5) El estado de cuenta del cliente mezclaba dos fuentes distintas:
--    "Total pagado" se calculaba por abonos.cliente_id y el historial
--    por abonos.participante_id. Los abonos de un participante sin
--    cliente vinculado quedaban en cliente_id = NULL y desaparecían
--    del total, aunque sí aparecían en el historial.
--
-- 6) Nada impedía inscribir al mismo cliente DOS VECES en el mismo
--    evento. Cuando pasa, el evento sale repetido en su estado de
--    cuenta y su deuda se cuenta doble.
--
-- Todo eso ya está corregido en el código. Este script limpia lo que
-- ya quedó mal en la base y pone candados para que no se repita.
--
-- CÓMO USARLO
-- -----------
-- Corre el PASO 0 completo y LEE los resultados antes de seguir. Los
-- pasos marcados ⚠️ borran o modifican datos. Haz backup primero:
-- Supabase Dashboard → Database → Backups.
-- ================================================================


-- ================================================================
-- PASO 0 — DIAGNÓSTICO (solo lectura, no cambia nada)
-- ================================================================

-- 0.1 Abonos con el MISMO folio (colisión de folio por minuto).
--     Estos son duplicados seguros: se pueden borrar sin pensarlo.
SELECT referencia, COUNT(*) AS copias, MIN(monto) AS monto,
       MIN(fecha) AS fecha, array_agg(id ORDER BY id) AS ids
FROM abonos
WHERE referencia IS NOT NULL AND referencia <> ''
GROUP BY referencia
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 0.2 Abonos "gemelos": mismo participante, misma fecha, mismo monto,
--     pero folio distinto. Son el resultado típico de capturar el
--     mismo pago dos veces.
--     ⚠️ NO se borran automáticamente: dos pagos iguales el mismo día
--     pueden ser legítimos. Revísalos uno por uno.
SELECT a.participante_id, p.nombre_cliente, e.nombre AS evento,
       a.fecha, a.monto, COUNT(*) AS copias,
       array_agg(a.id ORDER BY a.id)          AS ids,
       array_agg(a.referencia ORDER BY a.id)  AS folios
FROM abonos a
JOIN participantes p ON p.id = a.participante_id
JOIN eventos e       ON e.id = a.evento_id
GROUP BY a.participante_id, p.nombre_cliente, e.nombre, a.fecha, a.monto
HAVING COUNT(*) > 1
ORDER BY a.fecha DESC;

-- 0.3 Clientes inscritos más de una vez en el mismo evento.
--     Esto hace que el evento salga repetido en su estado de cuenta y
--     que su deuda se cuente doble.
SELECT p.cliente_id, c.nombre AS cliente, p.evento_id, e.nombre AS evento,
       COUNT(*) AS inscripciones,
       array_agg(p.id ORDER BY p.id)                   AS participante_ids,
       array_agg(p.monto_total_acordado ORDER BY p.id) AS montos_acordados
FROM participantes p
JOIN clientes c ON c.id = p.cliente_id
JOIN eventos  e ON e.id = p.evento_id
WHERE p.cliente_id IS NOT NULL
GROUP BY p.cliente_id, c.nombre, p.evento_id, e.nombre
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 0.4 Abonos que no aparecen en ningún estado de cuenta porque su
--     participante no está vinculado a un cliente.
SELECT COUNT(*) AS abonos_huerfanos, SUM(a.monto) AS monto_invisible
FROM abonos a
JOIN participantes p ON p.id = a.participante_id
WHERE p.cliente_id IS NULL;

-- 0.5 Participantes cuyo saldo guardado no cuadra con sus abonos
SELECT p.id, p.nombre_cliente, e.nombre AS evento,
       p.monto_total_acordado,
       COALESCE(SUM(a.monto), 0)  AS pagado_real,
       p.saldo_pendiente          AS saldo_guardado,
       GREATEST(0, p.monto_total_acordado - COALESCE(SUM(a.monto), 0)) AS saldo_correcto
FROM participantes p
JOIN eventos e     ON e.id = p.evento_id
LEFT JOIN abonos a ON a.participante_id = p.id
GROUP BY p.id, e.nombre
HAVING p.saldo_pendiente
       <> GREATEST(0, p.monto_total_acordado - COALESCE(SUM(a.monto), 0))
ORDER BY ABS(p.saldo_pendiente
       - GREATEST(0, p.monto_total_acordado - COALESCE(SUM(a.monto), 0))) DESC;

-- 0.6 Abonos cuyo movimiento bancario nunca se creó (el caso del
--     punto 3: el movimiento chocó por folio repetido pero el saldo
--     de la cuenta sí se movió).
SELECT a.id, a.fecha, a.monto, a.referencia, a.cuenta_destino,
       p.nombre_cliente
FROM abonos a
JOIN participantes p ON p.id = a.participante_id
LEFT JOIN movimientos m ON m.referencia = a.referencia
WHERE a.referencia IS NOT NULL
  AND m.id IS NULL
ORDER BY a.fecha DESC;


-- ================================================================
-- PASO 1 — NORMALIZAR REFERENCIAS VACÍAS A NULL
--
-- En un índice único cada NULL cuenta como distinto (varios registros
-- sin referencia conviven sin problema), pero varias cadenas vacías ''
-- chocarían entre sí.
-- ================================================================

UPDATE abonos      SET referencia  = NULL WHERE referencia  = '';
UPDATE gastos      SET comprobante = NULL WHERE comprobante = '';
UPDATE movimientos SET referencia  = NULL WHERE referencia  = '';


-- ================================================================
-- PASO 2 — BORRAR DUPLICADOS DE FOLIO IDÉNTICO  ⚠️ DESTRUCTIVO
--
-- Solo toca lo que reportó 0.1: registros con exactamente la misma
-- referencia. Conserva el más antiguo (id más bajo).
-- ================================================================

BEGIN;

DELETE FROM abonos a
USING abonos b
WHERE a.referencia IS NOT NULL
  AND a.referencia = b.referencia
  AND a.id > b.id;

DELETE FROM gastos g
USING gastos h
WHERE g.comprobante IS NOT NULL
  AND g.comprobante = h.comprobante
  AND g.id > h.id;

DELETE FROM movimientos m
USING movimientos n
WHERE m.referencia IS NOT NULL
  AND m.referencia = n.referencia
  AND m.id > n.id;

COMMIT;
-- (si algo no cuadra, en lugar de COMMIT ejecuta:  ROLLBACK; )


-- ================================================================
-- PASO 2b — GEMELOS (los de 0.2)  ⚠️ REVISIÓN MANUAL
--
-- Estos NO se pueden borrar en bloque sin arriesgarse a eliminar
-- pagos legítimos. Toma los ids que te devolvió 0.2, confirma cuáles
-- sobran y bórralos explícitamente. Ejemplo:
--
--   DELETE FROM abonos WHERE id IN (128, 143, 199);
--
-- Antes de borrar, revisa el detalle:
--
--   SELECT * FROM abonos WHERE id IN (128, 143, 199);
-- ================================================================


-- ================================================================
-- PASO 3 — CANDADOS EN LA BASE DE DATOS
--
-- A partir de aquí la base rechaza por sí sola un registro repetido,
-- aunque el frontend falle. Si un CREATE INDEX falla es que todavía
-- quedan duplicados: vuelve al paso 0.
--
-- Nota: el índice anterior movimientos_ref_unique era PARCIAL (con
-- WHERE). PostgreSQL no admite un índice parcial como destino de
-- ON CONFLICT, así que los upserts que dependían de él fallaban.
-- Se reemplaza por un índice único normal.
-- ================================================================

DROP INDEX IF EXISTS movimientos_ref_unique;

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_referencia_key ON movimientos (referencia);
CREATE UNIQUE INDEX IF NOT EXISTS abonos_referencia_key      ON abonos (referencia);
CREATE UNIQUE INDEX IF NOT EXISTS gastos_comprobante_key     ON gastos (comprobante);

-- Opcional: prohibir de raíz que un cliente se inscriba dos veces en
-- el mismo evento. NO se activa por defecto porque hay casos legítimos
-- (alguien que paga dos lugares como dos registros). El código ya pide
-- confirmación antes de permitirlo. Descomenta solo si en tu operación
-- eso nunca debe pasar:
--
-- CREATE UNIQUE INDEX participantes_cliente_evento_key
--   ON participantes (evento_id, cliente_id)
--   WHERE cliente_id IS NOT NULL;


-- ================================================================
-- PASO 4 — VINCULAR ABONOS A SU CLIENTE
--
-- Arregla el "Total pagado" del estado de cuenta: los abonos cuyo
-- cliente_id quedó en NULL pero cuyo participante sí tiene cliente.
-- ================================================================

UPDATE abonos a
SET cliente_id = p.cliente_id
FROM participantes p
WHERE p.id = a.participante_id
  AND p.cliente_id IS NOT NULL
  AND (a.cliente_id IS NULL OR a.cliente_id <> p.cliente_id);

-- Y vincula participantes sueltos cuyo nombre coincide exactamente con
-- un cliente registrado.
UPDATE participantes p
SET cliente_id = c.id
FROM clientes c
WHERE p.cliente_id IS NULL
  AND lower(trim(p.nombre_cliente)) = lower(trim(c.nombre));


-- ================================================================
-- PASO 5 — UNIR INSCRIPCIONES REPETIDAS  ⚠️ DESTRUCTIVO
--
-- Para lo que reportó 0.3. Conserva el registro más antiguo de cada
-- cliente+evento, le pasa todos los abonos, se queda con el monto
-- acordado MÁS ALTO de los repetidos y borra los sobrantes.
--
-- Si en 0.3 viste inscripciones que SÍ son legítimas (dos lugares
-- pagados por la misma persona), NO corras este bloque: resuelve esos
-- casos a mano.
-- ================================================================

BEGIN;

CREATE TEMP TABLE dups_part AS
SELECT cliente_id, evento_id,
       MIN(id) AS keep_id,
       array_agg(id) AS all_ids,
       MAX(monto_total_acordado) AS monto_max
FROM participantes
WHERE cliente_id IS NOT NULL
GROUP BY cliente_id, evento_id
HAVING COUNT(*) > 1;

-- 5.1 Mover los abonos al registro que se conserva
UPDATE abonos a
SET participante_id = d.keep_id
FROM dups_part d
WHERE a.participante_id = ANY(d.all_ids)
  AND a.participante_id <> d.keep_id;

-- 5.2 Conservar el monto acordado más alto
UPDATE participantes p
SET monto_total_acordado = d.monto_max
FROM dups_part d
WHERE p.id = d.keep_id;

-- 5.3 Borrar los registros sobrantes
DELETE FROM participantes p
USING dups_part d
WHERE p.id = ANY(d.all_ids)
  AND p.id <> d.keep_id;

DROP TABLE dups_part;

COMMIT;
-- (si algo no cuadra, en lugar de COMMIT ejecuta:  ROLLBACK; )


-- ================================================================
-- PASO 6 — RECALCULAR SALDOS
-- ================================================================

-- 6.1 Participantes que vinieron del Excel: su monto_total_acordado se
--     construyó sumando abono por abono, así que hay que reconstruirlo
--     desde los abonos que quedaron. Los capturados a mano NO se tocan:
--     ahí el monto acordado es un dato propio, no la suma de los pagos.
UPDATE participantes p
SET monto_total_acordado = COALESCE(
      (SELECT SUM(a.monto) FROM abonos a WHERE a.participante_id = p.id), 0)
FROM eventos e
WHERE e.id = p.evento_id
  AND e.lugar = 'Importado de Excel';

-- 6.2 Saldo pendiente de todos, calculado desde los abonos reales
UPDATE participantes p
SET saldo_pendiente = GREATEST(
      0,
      p.monto_total_acordado - COALESCE(
        (SELECT SUM(a.monto) FROM abonos a WHERE a.participante_id = p.id), 0)
    );

-- 6.3 Saldos de cuentas bancarias — REVISAR ANTES DE APLICAR.
--     Compara el saldo guardado contra la suma de sus movimientos. Si
--     tus cuentas tienen un saldo inicial que nunca se registró como
--     movimiento, la diferencia es NORMAL y no debes correr el UPDATE.
SELECT c.id, c.banco, c.ultimos_4, c.saldo_actual AS saldo_guardado,
       COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe
                         ELSE -m.importe END), 0) AS suma_movimientos,
       c.saldo_actual - COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe
                                          ELSE -m.importe END), 0) AS diferencia
FROM cuentas_bancarias c
LEFT JOIN movimientos m ON m.cuenta_id = c.id
GROUP BY c.id
ORDER BY ABS(c.saldo_actual - COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe
                                                ELSE -m.importe END), 0)) DESC;

-- Descomenta SOLO si confirmaste que las cuentas no tienen saldo
-- inicial fuera de movimientos:
--
-- UPDATE cuentas_bancarias c
-- SET saldo_actual = COALESCE(
--       (SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.importe ELSE -m.importe END)
--        FROM movimientos m WHERE m.cuenta_id = c.id), 0);


-- ================================================================
-- PASO 7 — VERIFICACIÓN FINAL (las tres consultas deben dar 0 filas)
-- ================================================================

-- 7.1 Sin folios repetidos
SELECT 'abonos' AS tabla, referencia AS clave, COUNT(*)
FROM abonos WHERE referencia IS NOT NULL
GROUP BY referencia HAVING COUNT(*) > 1
UNION ALL
SELECT 'gastos', comprobante, COUNT(*)
FROM gastos WHERE comprobante IS NOT NULL
GROUP BY comprobante HAVING COUNT(*) > 1
UNION ALL
SELECT 'movimientos', referencia, COUNT(*)
FROM movimientos WHERE referencia IS NOT NULL
GROUP BY referencia HAVING COUNT(*) > 1;

-- 7.2 Sin inscripciones repetidas
SELECT cliente_id, evento_id, COUNT(*)
FROM participantes WHERE cliente_id IS NOT NULL
GROUP BY cliente_id, evento_id HAVING COUNT(*) > 1;

-- 7.3 Sin saldos descuadrados
SELECT p.id, p.nombre_cliente
FROM participantes p
LEFT JOIN abonos a ON a.participante_id = p.id
GROUP BY p.id
HAVING p.saldo_pendiente
       <> GREATEST(0, p.monto_total_acordado - COALESCE(SUM(a.monto), 0));
