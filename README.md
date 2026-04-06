# Sendery CRM — Sistema Administrativo

Sistema CRM-contable personalizado para **Sendery Outdoor Lifestyle®**, empresa de senderismo y agencia de viajes en Ensenada, Baja California, México.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5.4 |
| Base de datos | SQLite en el navegador vía `sql.js` (WebAssembly) |
| Persistencia | IndexedDB (automática, sin servidor) |
| Gráficas | Recharts |
| Generación de PDFs | jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 (carga dinámica desde CDN) |
| Exportación / Importación | xlsx |
| Íconos | Lucide React |
| Fuentes | Oswald (títulos) + DM Sans (UI) — Google Fonts |
| Routing | React Router v6 |

> **Sin instalación de servidor externo.** Todo corre localmente en el navegador. Los datos persisten en IndexedDB entre sesiones.

---

## Instalación y uso

```bash
# 1. Instalar dependencias
cd sendery-crm
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173

# 3. Build de producción (opcional)
npm run build
```

---

## Estructura del proyecto

```
sendery-crm/
├── public/
│   ├── favicon.svg
│   └── sendery-logo.png          ← COLOCAR AQUÍ el logo PNG para los PDFs
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── db/
│   │   ├── database.js            # SQLite: esquema, seed, API de consultas
│   │   └── DBContext.jsx          # Provider con pantalla de carga
│   ├── utils/
│   │   └── format.js              # formatMXN, formatDate, generateFolio, etc.
│   ├── components/
│   │   ├── Sidebar.jsx            # Navegación lateral colapsable
│   │   └── Layout.jsx             # PageHeader, Card, Btn, Modal, Table, etc.
│   └── modules/
│       ├── Dashboard/
│       │   └── Dashboard.jsx
│       ├── Eventos/
│       │   ├── EventosList.jsx
│       │   └── EventoDetalle.jsx
│       ├── Clientes/
│       │   └── Clientes.jsx
│       ├── Gastos/
│       │   └── Gastos.jsx
│       ├── Proveedores/
│       │   └── Proveedores.jsx
│       ├── CuentasBancarias/
│       │   └── CuentasBancarias.jsx
│       ├── Reportes/
│       │   ├── Reportes.jsx
│       │   └── pdfGenerator.js
│       └── Importador/
│           └── Importador.jsx
├── index.html
├── vite.config.js
└── package.json
```

---

## Módulos implementados

### Dashboard
- 5 KPIs en tiempo real: ingresos del mes, eventos activos, clientes nuevos, cuentas por cobrar, saldo en bancos
- Gráfica de barras: Ingresos vs Gastos por evento (altura 280px, etiquetas a -40°)
- Gráfica de líneas: Evolución mensual (6 meses)
- Gráfica de pie: Distribución de gastos por categoría (etiquetas fontSize 11 con margen)
- Panel de próximos eventos activos
- Tabla de saldos pendientes por cliente
- Tabla de pagos recientes

### Módulo 1 — Eventos
- Listado en cards con ocupación, utilidad y saldo pendiente visual
- Filtros por tipo (caminata / viaje) y estado (activo / cerrado / cancelado)
- Formulario de alta y edición en modal
- **Vista de detalle** con:
  - Resumen financiero del evento (acordado, cobrado, por cobrar, gastos, utilidad)
  - Subregistro de participantes con barra de progreso de pago
  - Desglose de abonos por participante (expandible) con **botón de recibo PDF por abono individual**
  - Registro de abonos con actualización automática de saldo y movimiento bancario
  - Tabla de gastos asociados al evento

### Módulo 2 — Clientes (CRM)
- Listado con búsqueda por nombre, email y teléfono
- Filtro por ciudad
- Panel lateral de detalle con historial de eventos y estado de cuenta
- Métricas por cliente: total de eventos, monto pagado histórico, deuda activa
- Alta y edición en modal

### Módulo 3 — Gastos
- Registro de egresos con categoría, evento asociado, proveedor y cuenta bancaria
- Filtros por categoría, evento y texto libre
- Tarjetas de resumen por categoría (clickeable para filtrar)
- Al registrar un gasto, afecta automáticamente el saldo de la cuenta bancaria origen

### Módulo 4 — Proveedores
- Directorio con tipo de servicio y RFC
- Panel lateral de historial de pagos
- Registro de pagos con afectación automática a cuenta bancaria

### Módulo 5 — Cuentas Bancarias
- Resumen total consolidado de saldos en banner de marca
- Cards individuales por cuenta (cheques / ahorro / efectivo)
- Historial de movimientos con saldo acumulado calculado
- Registro manual de movimientos (ingreso / egreso)

### Módulo 6 — Reportes y PDFs
Tres tabs:

**Estado de Resultados** — filtro año/mes, KPIs, gráfica mensual, exportación PDF con membrete
**Reporte por Evento** — selector de evento, participantes, gastos, exportación PDF
**Flujo de Efectivo** — tabla mensual entradas/salidas/neto, totales anuales

### Módulo 7 — Importador de Excel
- Drag & drop de archivo `.xlsx`
- Compatible con formato `SENDERY_IMPORTAR.xlsx` (ver columnas requeridas abajo)
- Preview de primeros 10 registros con estadísticas del archivo
- Importación en chunks de 30 filas para no bloquear UI
- Barra de progreso en tiempo real
- Anti-duplicados por folio via tabla `excel_imports_log`
- **Herramientas de mantenimiento**:
  - Limpiar historial de importación (solo `excel_imports_log`, sin tocar datos)
  - Limpiar datos de muestra (borra clientes, eventos, abonos, gastos, movimientos; resetea saldos a $0)

---

## Generación de PDFs

### Recibo por abono individual (`generarReciboPorAbono`)
Nuevo diseño que replica el formato del recibo original de Excel:
- Header amarillo `#E8C547` con logo a la izquierda (imagen `/public/sendery-logo.png` o texto fallback) y FECHA + FOLIO a la derecha
- Título `R E C I B O` centrado 34pt en verde oscuro
- Cuerpo: RECIBO DE / LA CANTIDAD DE [n] PESOS o USD / POR CONCEPTO DE / FECHA DE EVENTO
- Área de firmas al pie
- Accesible desde cada fila de abono en la vista de detalle de evento

### Recibo histórico por participante (`generarReciboEvento`)
- Tabla de todos los abonos del participante
- Resumen financiero (acordado / abonado / saldo)
- Sello "LIQUIDADO" si saldo = 0

### Reporte de evento (`generarReporteEvento`)
- Tabla de participantes con estado de pago
- Tabla de gastos del evento
- Cuadro de utilidad

### Estado de resultados (`generarEstadoResultados`)
- Período filtrado
- Desglose ingresos y gastos
- Bloque de utilidad/pérdida neta

**Todos los PDFs incluyen:** banner amarillo con logo SENDERY, folio único autogenerado, fecha de emisión, footer verde oscuro con datos de empresa.

**Logo:** Para activar la imagen en PDFs, guardar el archivo como:
```
C:\Users\crist\.claude\sendery-crm\public\sendery-logo.png
```
Si no existe, los PDFs muestran el texto `SENDERY / OUTDOOR LIFESTYLE®` como respaldo automático.

---

## Paleta de marca

| Variable | Color | Uso |
|---|---|---|
| Forest | `#2C3A1A` | Sidebar, textos principales, headers |
| Olive | `#4A5E28` | Hover, botones secundarios |
| Sun | `#E8C547` | Botones CTA, banner PDF |
| Sand | `#C4A97D` | Bordes suaves, fondos secundarios |
| Cream | `#F5F0E8` | Fondo principal |

**Estados de pago:**
- Liquidado: fondo `#EAF0D8` / texto `#2C3A1A`
- Abono parcial: fondo `#FFF3CC` / texto `#7A5A00`
- Sin pago / Vencido: fondo `#FCECEA` / texto `#8B1A1A`

---

## Base de datos — Esquema

| Tabla | Descripción |
|---|---|
| `eventos` | Caminatas y viajes con estado y cupo |
| `participantes` | Subregistro por evento con saldo pendiente |
| `abonos` | Pagos individuales por participante |
| `clientes` | CRM con datos de contacto |
| `gastos` | Egresos categorizados |
| `proveedores` | Directorio con RFC |
| `pagos_proveedores` | Historial de pagos a proveedores |
| `cuentas_bancarias` | Cuentas con saldo actual |
| `movimientos` | Historial de entradas y salidas por cuenta |
| `excel_imports_log` | Control anti-duplicados de importación (folio PK) |

---

## Importador de Excel — Formato requerido

### Archivo: `SENDERY_IMPORTAR.xlsx`

| Columna | Descripción | Ejemplo |
|---|---|---|
| `FOLIO` | Identificador único de la fila (PK anti-duplicado) | `ABN-001` |
| `FECHA_ABONO` | Fecha del movimiento en formato DD/MM/YYYY | `16/04/2025` |
| `NOMBRE_CLIENTE` | Nombre del cliente (ABONO) o concepto del gasto (GASTO) | `JUAN PEREZ` |
| `CODIGO_EVENTO` | Código corto del evento | `CEV-01` |
| `NOMBRE_EVENTO` | Nombre completo del evento | `SIERRA SAN PEDRO MÁRTIR` |
| `FECHA_EVENTO` | Fecha del evento en formato DD/MM/YYYY | `20/04/2025` |
| `MONTO` | Monto del movimiento (positivo o negativo) | `850.00` / `-250.00` |
| `CUENTA_BANCO` | Nombre de la cuenta bancaria | `BANCOMER NINEL` |
| `TIPO` | Tipo de registro | `ABONO` o `GASTO` |

### Lógica de importación
- **`TIPO = ABONO`** → Crea cliente con `NOMBRE_CLIENTE`, crea/busca evento, registra abono, genera movimiento bancario de ingreso
- **`TIPO = GASTO`** → No crea cliente. Registra gasto usando `NOMBRE_CLIENTE` como concepto, genera movimiento de egreso

**Valores aceptados en columna TIPO:**

| Variantes aceptadas | Se interpreta como |
|---|---|
| `ABONO`, `A`, `PAGO`, `P`, `COBRO`, `INGRESO`, `IN` | ABONO |
| `GASTO`, `G`, `EGRESO`, `E`, `SALIDA`, `S`, `DEVOLUCION`, `DEV` | GASTO |
| Vacío / `-` / `N/A` | Infiere por signo del monto |
| Cualquier otro valor | Infiere por signo del monto + registra advertencia |

### Mapeo de cuentas bancarias

| Nombre en Excel | Banco | Titular | Tipo |
|---|---|---|---|
| `BANCOMER NINEL` | Bancomer | Ninel (Sendery) | cheques |
| `BANCOMER OCTAVIO` | Bancomer | Octavio (Sendery) | cheques |
| `BANCO AZTECA` | Banco Azteca | Sendery Outdoor | cheques |
| `EFECTIVO` | Efectivo | Caja General | efectivo |
| `EFECTIVO OCTAVIO` | Efectivo | Octavio (Sendery) | efectivo |
| `STP` | STP | Sendery Outdoor | ahorro |
| `SPIN` | SPIN by OXXO | Sendery Outdoor | ahorro |

---

## ⚠️ Problemas conocidos y pendientes

### 🔴 CRÍTICO — Importador: 468 registros omitidos

**Síntoma:** Al importar `SENDERY_IMPORTAR.xlsx`, el resultado muestra:
- Clientes creados: **0**
- Abonos registrados: **0**
- Gastos registrados: **0**
- Registros omitidos: **468**
- Eventos creados: **15** *(solo en el primer intento; quedan huérfanos en DB)*

**Intentos de fix realizados:**

1. **Intento 1 (archivo original `VIAJES_SENDERY_2026.xlsx`):**
   - Columnas: `#`, `FECHA`, `NOMBRE`, `CEV`, `EVENTO`, `FECHA EVENTO ` (espacio al final), `ABONO ` (espacio), `CUENTA `
   - Resultado: 515 omitidos. Causa probable: folios ya registrados en `excel_imports_log` de pruebas anteriores.

2. **Intento 2 (nuevo archivo `SENDERY_IMPORTAR.xlsx` con columnas limpias):**
   - Columnas: `FOLIO`, `FECHA_ABONO`, `NOMBRE_CLIENTE`, `CODIGO_EVENTO`, `NOMBRE_EVENTO`, `FECHA_EVENTO`, `MONTO`, `CUENTA_BANCO`, `TIPO`
   - Lógica cambiada: usar columna `TIPO` en lugar de signo del monto
   - Resultado: mismo error — 468 omitidos, 0 abonos/gastos
   - Causa identificada: los valores de la columna `TIPO` en el Excel no coincidían con `"ABONO"` / `"GASTO"` exactamente

3. **Intento 3 (detección robusta de TIPO):**
   - Se amplió el check de TIPO para aceptar variantes (`A`, `P`, `G`, `E`, etc.)
   - Se agregó fallback: si TIPO es desconocido, inferir por signo del monto
   - Se agregó diagnóstico en el panel de Advertencias para ver valores reales de TIPO
   - Se limpió `excel_imports_log` automáticamente al iniciar cada importación
   - **Resultado: pendiente de prueba** — no se ha vuelto a ejecutar la importación

**Causa raíz sospechada (sin confirmar):**
El valor real de la columna `TIPO` en el archivo Excel podría ser un número (`1`/`0`), una fórmula calculada, o un valor con caracteres invisibles/unicode que no pasa ninguno de los checks de string.

**Próximos pasos para diagnosticar:**
1. Volver a importar con el código actual y revisar el panel de **Advertencias** — ahora muestra exactamente qué valores tiene la columna TIPO
2. Si el panel dice `Valores de columna TIPO no reconocidos: [valor]`, agregar ese valor exacto a la lista de variantes aceptadas
3. Alternativa: abrir `SENDERY_IMPORTAR.xlsx` en Excel, seleccionar una celda de la columna TIPO, y verificar en la barra de fórmulas el valor exacto (sin espacios, sin formato)
4. Si el problema persiste, considerar eliminar la columna TIPO del Excel y dejar que el importador infiera siempre por signo del monto (los gastos ya vienen negativos)

---

### 🟡 PENDIENTE — Logo en PDFs

**Síntoma:** Los recibos PDF muestran texto `SENDERY / OUTDOOR LIFESTYLE®` en lugar del logo de imagen.

**Causa:** El archivo `sendery-logo.png` no se ha colocado en la carpeta `public/`.

**Fix:** Guardar el logo como:
```
C:\Users\crist\.claude\sendery-crm\public\sendery-logo.png
```
El sistema cargará el logo automáticamente sin modificar código.

---

### 🟡 PENDIENTE — Datos de muestra en producción

**Síntoma:** El sistema arranca con 3 cuentas bancarias, 5 proveedores, 10 clientes y 5 eventos de prueba (seed data).

**Impacto:** Si se importa el Excel histórico sin limpiar primero, los datos de muestra se mezclan con los reales.

**Fix disponible:** En **Importar Excel → Herramientas de mantenimiento → "Limpiar datos de muestra"** (borra todo excepto proveedores y estructura de cuentas, resetea saldos a $0).

**Nota:** Esta acción es irreversible. Ejecutar solo cuando se tenga el archivo Excel listo para reimportar inmediatamente.

---

## Notas de desarrollo

- La base de datos se inicializa una sola vez; los datos de muestra no se reinsertan en sesiones posteriores
- Los saldos de cuentas bancarias se actualizan automáticamente al registrar abonos y gastos
- Los PDFs se generan completamente en el cliente, sin peticiones a servidor externo
- El sidebar es colapsable para ganar espacio en pantallas pequeñas
- Fuente base: 18px en `index.html` para legibilidad en pantallas 13"–27"
- `sql.js` requiere headers COOP/COEP para SharedArrayBuffer (configurados en `vite.config.js` y `index.html`)
