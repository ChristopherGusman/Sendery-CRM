# PROMPT PARA LOVABLE — Sendery CRM

Copia y pega este prompt completo en Lovable. Puedes dividirlo en fases si Lovable tiene limite de caracteres: primero la Fase 1 (base + dashboard + eventos), luego Fase 2 (clientes + gastos + proveedores), Fase 3 (cuentas bancarias + reportes), y Fase 4 (importador Excel + PDFs).

---

## PROMPT COMPLETO

```
Construye un sistema CRM-contable completo en español llamado "Sendery CRM" para Sendery Outdoor Lifestyle, una empresa mexicana de senderismo y agencia de viajes con sede en Ensenada, Baja California, Mexico.

=== IDENTIDAD VISUAL (OBLIGATORIO EN TODO EL SISTEMA) ===

PALETA DE COLORES (usar consistentemente en TODA la aplicacion):
- Forest Green #2C3A1A — sidebar, textos principales, headers, fondos oscuros
- Olive #4A5E28 — botones secundarios, hover states, badges positivos
- Sun Yellow #E8C547 — botones CTA principales, acentos, highlights
- Sand #C4A97D — bordes suaves, fondos terciarios, separadores
- Cream #F5F0E8 — fondo general de la aplicacion (NO blanco puro)

TIPOGRAFIA:
- Titulos y numeros grandes: Google Font "Oswald" (bold, uppercase, letter-spacing 0.5px)
- Textos de UI, parrafos, labels: Google Font "DM Sans" (regular 400, semibold 600)
- Tamano base: 16px
- Los montos y KPIs deben usar Oswald bold para que destaquen visualmente

ESTADOS DE PAGO (badges con estos colores exactos):
- Liquidado: fondo #EAF0D8, texto #2C3A1A
- Abono parcial: fondo #FFF3CC, texto #7A5A00
- Sin pago: fondo #FCECEA, texto #8B1A1A

FORMATO DE MONEDA: Siempre pesos mexicanos con Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' })
FORMATO DE FECHA: "15 abr 2025" para fechas cortas, "15 de abril de 2025" para fechas largas

=== ESTRUCTURA DE NAVEGACION ===

Sidebar izquierdo colapsable (fondo Forest Green #2C3A1A, texto Sand #C4A97D, icono activo Sun Yellow #E8C547) con estos items:
1. Dashboard (icono LayoutDashboard)
2. Eventos (icono Calendar)
3. Clientes (icono Users)
4. Gastos (icono Receipt)
5. Proveedores (icono Truck)
6. Cuentas Bancarias (icono Landmark)
7. Reportes (icono BarChart3)
8. --- (linea divisoria) ---
9. Importar Excel (icono FileUp)

Al colapsar, solo mostrar iconos. El item activo debe tener fondo rgba(255,255,255,0.08) y texto Sun Yellow.
Logo "SENDERY" en Oswald bold en la parte superior del sidebar. Debajo: "OUTDOOR LIFESTYLE" en DM Sans 9px uppercase.

=== BASE DE DATOS — TABLAS SUPABASE ===

Crear EXACTAMENTE estas tablas con Row Level Security deshabilitado (es uso interno):

TABLA "eventos":
- id: uuid PK default gen_random_uuid()
- nombre: text NOT NULL (nombre del evento, ej: "Sierra San Pedro Martir")
- tipo: text NOT NULL check in ('caminata','viaje')
- fecha: date NOT NULL (fecha del evento)
- lugar: text NOT NULL
- ejecutor: text NOT NULL (nombre de quien organiza)
- costo_total: numeric default 0
- cupo_maximo: integer default 0 (0 = sin limite)
- estado: text default 'activo' check in ('activo','cerrado','cancelado')
- notas: text
- created_at: timestamptz default now()

TABLA "clientes":
- id: uuid PK default gen_random_uuid()
- nombre: text NOT NULL
- telefono: text
- email: text
- ciudad: text default 'Ensenada'
- fecha_registro: date default current_date
- notas: text
- created_at: timestamptz default now()

TABLA "participantes" (inscripciones a eventos):
- id: uuid PK default gen_random_uuid()
- evento_id: uuid NOT NULL references eventos(id) on delete cascade
- cliente_id: uuid references clientes(id)
- nombre_cliente: text NOT NULL (nombre desplegado, puede no tener cliente vinculado)
- monto_total_acordado: numeric default 0 (cuanto debe pagar en total)
- saldo_pendiente: numeric default 0 (cuanto falta por pagar)
- cuenta_destino_pago: text (ej: "BBVA 4521")
- fecha_ultimo_pago: date
- notas: text
- created_at: timestamptz default now()

TABLA "abonos" (pagos parciales de participantes):
- id: uuid PK default gen_random_uuid()
- participante_id: uuid NOT NULL references participantes(id) on delete cascade
- evento_id: uuid NOT NULL references eventos(id)
- cliente_id: uuid references clientes(id)
- fecha: date NOT NULL
- monto: numeric NOT NULL (siempre positivo)
- referencia: text (folio o referencia del pago)
- cuenta_destino: text (nombre de la cuenta bancaria destino)
- notas: text
- created_at: timestamptz default now()

TABLA "gastos":
- id: uuid PK default gen_random_uuid()
- fecha: date NOT NULL
- concepto: text NOT NULL
- categoria: text NOT NULL check in ('transporte','alimentacion','hospedaje','equipo','marketing','otro')
- importe: numeric NOT NULL (siempre positivo)
- moneda: text default 'MXN'
- ubicacion: text
- evento_id: uuid references eventos(id) (gasto asociado a un evento especifico)
- proveedor_id: uuid references proveedores(id)
- cuenta_bancaria_id: uuid references cuentas_bancarias(id)
- comprobante: text
- created_at: timestamptz default now()

TABLA "proveedores":
- id: uuid PK default gen_random_uuid()
- nombre: text NOT NULL
- tipo_servicio: text NOT NULL (ej: "Transporte", "Alimentacion", "Hospedaje")
- telefono: text
- email: text
- rfc: text
- notas: text
- created_at: timestamptz default now()

TABLA "pagos_proveedores":
- id: uuid PK default gen_random_uuid()
- proveedor_id: uuid NOT NULL references proveedores(id) on delete cascade
- fecha: date NOT NULL
- concepto: text NOT NULL
- importe: numeric NOT NULL
- cuenta_bancaria_id: uuid references cuentas_bancarias(id)
- referencia: text
- created_at: timestamptz default now()

TABLA "cuentas_bancarias":
- id: uuid PK default gen_random_uuid()
- banco: text NOT NULL (ej: "Bancomer", "Efectivo", "STP")
- ultimos_4: text NOT NULL (ultimos 4 digitos o codigo corto)
- titular: text NOT NULL
- tipo: text NOT NULL check in ('cheques','ahorro','efectivo')
- saldo_actual: numeric default 0
- created_at: timestamptz default now()

TABLA "movimientos" (historial de entradas/salidas por cuenta):
- id: uuid PK default gen_random_uuid()
- cuenta_id: uuid NOT NULL references cuentas_bancarias(id) on delete cascade
- fecha: date NOT NULL
- tipo: text NOT NULL check in ('ingreso','egreso')
- concepto: text NOT NULL
- importe: numeric NOT NULL (siempre positivo)
- referencia: text
- evento_id: uuid references eventos(id)
- created_at: timestamptz default now()

TABLA "excel_imports_log" (control anti-duplicados para importacion):
- folio: text PRIMARY KEY
- tipo: text
- evento_id: uuid
- fecha_import: timestamptz default now()

=== MODULO 1: DASHBOARD ===

Pagina principal al entrar. Mostrar:

FILA 1 — 5 tarjetas KPI horizontales con:
- Ingresos del mes (suma de abonos del mes actual) — icono DollarSign, color Forest Green
- Eventos activos (count de eventos con estado='activo') — icono Calendar, color Olive
- Clientes nuevos del mes (count de clientes registrados este mes) — icono UserPlus, color Sun Yellow
- Cuentas por cobrar (suma de saldo_pendiente de todos los participantes) — icono AlertCircle, color rojo #8B1A1A
- Saldo en bancos (suma de saldo_actual de cuentas_bancarias) — icono Landmark, color Forest Green
Cada tarjeta: fondo blanco, borde sutil Sand, border-radius 12px. Label en DM Sans 12px gris, valor en Oswald bold 28px.

FILA 2 — Dos graficas lado a lado (usar Recharts):
- IZQUIERDA: BarChart "Ingresos vs Gastos por Evento" — barras verdes (ingresos) y rojas (gastos) agrupadas. Altura 280px. Etiquetas del eje X rotadas -40 grados, con interval={0} y altura de eje 90px para que no se traslapen. Margen inferior de 80px.
- DERECHA: LineChart "Evolucion Mensual" — linea verde de ingresos, linea roja de gastos, ultimos 6 meses. Area sombreada debajo.

FILA 3 — PieChart + Tabla:
- IZQUIERDA: PieChart "Gastos por Categoria" — colores: transporte=#4A5E28, alimentacion=#E8C547, hospedaje=#C4A97D, equipo=#8B6914, marketing=#6B7B4F, otro=#999. Altura 260px. Labels con fontSize 11, margenes 20-30px para evitar overflow.
- DERECHA: Tabla "Saldos Pendientes" — 5 clientes con mayor deuda, columnas: Cliente, Evento, Saldo, Estado (badge de color)

FILA 4 — Panel "Proximos Eventos" (eventos activos proximos, max 5) y "Pagos Recientes" (ultimos 10 abonos registrados)

=== MODULO 2: EVENTOS ===

LISTADO:
- Grid de cards (3 columnas en desktop, 1 en movil)
- Cada card: nombre del evento en Oswald, badge tipo (Caminata verde / Viaje amarillo), fecha, lugar, ejecutor
- Barra de ocupacion visual (participantes / cupo_maximo) con porcentaje
- Mini-resumen financiero: acordado, cobrado, saldo pendiente
- Badge de estado (Activo/Cerrado/Cancelado)
- Filtros arriba: dropdown por tipo (caminata/viaje), dropdown por estado, barra de busqueda por nombre
- Boton "Nuevo Evento" (Sun Yellow) que abre modal con formulario

MODAL CREAR/EDITAR EVENTO:
Campos: nombre (text, required), tipo (select: caminata/viaje), fecha (date), lugar (text), ejecutor (text), cupo maximo (number), estado (select), notas (textarea)

VISTA DE DETALLE DE EVENTO (pagina completa al hacer clic en un evento):
- Header con nombre del evento, badge tipo, fecha, lugar
- Boton "Volver a eventos"

SECCION "Resumen Financiero" — 5 mini-cards horizontales:
  - Total acordado (suma monto_total_acordado de participantes)
  - Ingresos reales (suma de abonos)
  - Por cobrar (suma saldo_pendiente) — rojo si > 0
  - Total gastos (suma de gastos del evento)
  - Utilidad (ingresos - gastos) — rojo si negativo

SECCION "Participantes":
- Lista de participantes del evento, cada uno con:
  - Avatar circular con iniciales (fondo #EAF0D8)
  - Nombre, badge de estado de pago (Liquidado/Parcial/Sin pago)
  - Total acordado, saldo pendiente
  - Barra de progreso de pago (verde si 100%, amarillo si >50%, sand si <50%)
  - Porcentaje de avance
  - Botones: "Abonar" (abre modal), icono editar, icono eliminar
  - Fila EXPANDIBLE: al hacer clic en el participante, mostrar tabla con todos sus abonos (fecha, monto, referencia, cuenta, boton PDF por cada abono)
- Boton "Agregar participante" arriba

MODAL "Registrar Abono":
- Info del participante arriba (total acordado, saldo pendiente)
- Campos: fecha (date, default hoy), monto (number, required, placeholder con saldo maximo), referencia (text, se genera automaticamente si se deja vacio), cuenta destino (select de cuentas_bancarias), notas (text)
- Al guardar:
  1. Insertar en tabla abonos
  2. Actualizar saldo_pendiente del participante (restar monto)
  3. Insertar movimiento bancario de tipo "ingreso" en la cuenta seleccionada
  4. Actualizar saldo_actual de la cuenta bancaria (sumar monto)

SECCION "Gastos del Evento":
- Tabla con gastos asociados (filtrados por evento_id)
- Columnas: Fecha, Concepto, Categoria (badge), Proveedor, Importe (rojo)
- Fila de total al final

=== MODULO 3: CLIENTES (CRM) ===

LISTADO:
- Tabla con columnas: Nombre, Telefono, Email, Ciudad, Fecha registro, # Eventos
- Barra de busqueda que filtra por nombre, telefono y email simultaneamente
- Filtro por ciudad (dropdown)
- Boton "Nuevo Cliente" en header

PANEL LATERAL DE DETALLE (al hacer clic en un cliente):
- Se abre panel a la derecha (no pagina nueva)
- Datos del cliente editables
- HISTORIAL DE EVENTOS: lista de eventos donde participo, con monto pagado y saldo pendiente por cada uno
- Metricas resumen: total de eventos, monto pagado historico, deuda activa total

MODAL CREAR/EDITAR CLIENTE:
Campos: nombre (required), telefono, email, ciudad (default "Ensenada"), notas

=== MODULO 4: GASTOS ===

LISTADO:
- Tarjetas de resumen por categoria arriba (6 categorias: transporte, alimentacion, hospedaje, equipo, marketing, otro). Cada tarjeta muestra el total gastado en esa categoria. Hacer clic en una tarjeta filtra la tabla.
- Tabla debajo con TODOS los gastos: Fecha, Concepto, Categoria (badge), Evento asociado, Proveedor, Cuenta, Importe (rojo bold)
- Filtros: por categoria, por evento, busqueda por concepto
- Boton "Registrar Gasto"

MODAL CREAR GASTO:
Campos: fecha (date, default hoy), concepto (text, required), categoria (select 6 opciones), importe (number, required), moneda (MXN default), evento asociado (select de eventos, opcional), proveedor (select de proveedores, opcional), cuenta bancaria (select, required)
Al guardar:
1. Insertar en gastos
2. Insertar movimiento de tipo "egreso" en la cuenta seleccionada
3. Restar importe del saldo_actual de la cuenta bancaria

=== MODULO 5: PROVEEDORES ===

LISTADO:
- Tabla: Nombre, Tipo de servicio, Telefono, Email, RFC, Total pagado
- Busqueda por nombre
- Boton "Nuevo Proveedor"

PANEL LATERAL DE DETALLE:
- Datos del proveedor editables
- Historial de pagos (tabla: fecha, concepto, importe, cuenta)
- Boton "Registrar Pago" que abre modal

MODAL PAGO A PROVEEDOR:
Campos: fecha, concepto, importe, cuenta bancaria (select), referencia
Al guardar: insertar pago, insertar movimiento egreso, restar saldo de cuenta

=== MODULO 6: CUENTAS BANCARIAS ===

BANNER SUPERIOR: fondo Forest Green #2C3A1A, texto "Saldo consolidado total" con la suma de TODOS los saldos en Oswald bold 32px color Sun Yellow

GRID DE CARDS (una por cuenta):
- Cada card: logo/icono del banco, nombre (ej: "Bancomer ···4521"), titular, tipo (badge: cheques/ahorro/efectivo)
- Saldo actual grande en Oswald bold
- Color del saldo: verde si positivo, rojo si negativo
- Boton "Ver movimientos" y boton "Registrar movimiento"

MODAL MOVIMIENTO MANUAL:
Campos: tipo (select: ingreso/egreso), fecha, concepto, importe, referencia, evento asociado (opcional)
Al guardar: insertar movimiento, sumar o restar del saldo segun tipo

VISTA DE MOVIMIENTOS (al hacer clic en una cuenta):
- Tabla: Fecha, Tipo (badge verde ingreso / rojo egreso), Concepto, Referencia, Importe, Saldo acumulado
- El saldo acumulado se calcula fila por fila: empezando de 0, sumando ingresos y restando egresos
- Filtro por rango de fechas

DATOS INICIALES — crear estas 7 cuentas al iniciar:
1. Bancomer - Ninel (Sendery) - cheques - NIL1
2. Bancomer - Octavio (Sendery) - cheques - OCT2
3. Banco Azteca - Sendery Outdoor - cheques - AZT3
4. Efectivo - Caja General - efectivo - EFE1
5. Efectivo - Octavio (Sendery) - efectivo - EFE2
6. STP - Sendery Outdoor - ahorro - STP1
7. SPIN by OXXO - Sendery Outdoor - ahorro - SPN1

=== MODULO 7: REPORTES ===

Tres tabs: "Estado de Resultados", "Reporte por Evento", "Flujo de Efectivo"

TAB 1 — ESTADO DE RESULTADOS:
- Filtros: ano (select) y mes (select, o "Todo el ano")
- 3 KPIs: Total Ingresos (verde), Total Gastos (rojo), Utilidad Neta (verde si positiva, rojo si negativa)
- Grafica de barras: ingresos vs gastos mes a mes
- Tabla desglose: ingresos por evento y gastos por categoria
- Boton "Exportar PDF"

TAB 2 — REPORTE POR EVENTO:
- Selector de evento
- Tabla de participantes con: nombre, total acordado, abonado, saldo, estado
- Tabla de gastos del evento
- Cuadro de utilidad (ingresos - gastos)
- Boton "Exportar PDF"

TAB 3 — FLUJO DE EFECTIVO:
- Tabla mensual: mes, entradas, salidas, neto
- Fila de totales anuales
- Saldos actuales por cuenta bancaria

=== MODULO 8: IMPORTADOR DE EXCEL ===

ESTE MODULO ES CRITICO. Debe importar datos historicos desde un archivo SENDERY_IMPORTAR.xlsx con estas columnas:
FOLIO, FECHA_ABONO, NOMBRE_CLIENTE, CODIGO_EVENTO, NOMBRE_EVENTO, FECHA_EVENTO, MONTO, CUENTA_BANCO, TIPO

PANTALLA PRINCIPAL (paso 1):
- Area de drag & drop grande con icono de Excel, texto "Soltar archivo aqui o hacer clic para seleccionar"
- Aceptar solo .xlsx y .xls
- Debajo: card con el mapeo de cuentas bancarias (tabla de 7 cuentas y sus equivalencias)

PREVIEW (paso 2, despues de cargar archivo):
- Banner con nombre del archivo y conteo total de registros
- 4 mini-cards: cuantos son ABONO, cuantos son GASTO, clientes unicos, eventos unicos
- Tabla preview de los primeros 10 registros con columnas mapeadas
- Aviso amarillo con las reglas de importacion
- Botones "Cancelar" y "Importar N registros"

LOGICA DE IMPORTACION:
IMPORTANTE — La deteccion del TIPO debe ser MUY FLEXIBLE:
- Si la columna TIPO tiene "ABONO", "A", "PAGO", "P", "COBRO", "INGRESO" (cualquier mayuscula/minuscula) → tratar como ABONO
- Si la columna TIPO tiene "GASTO", "G", "EGRESO", "E", "SALIDA", "DEVOLUCION" → tratar como GASTO
- Si TIPO esta vacio o no se reconoce → INFERIR POR EL SIGNO DEL MONTO: positivo = ABONO, negativo = GASTO
- Guardar en un log los valores de TIPO que no se reconocieron para mostrar al final como advertencia

Para cada fila TIPO = ABONO:
1. Buscar o crear cliente con NOMBRE_CLIENTE (buscar por nombre exacto ignorando mayusculas)
2. Buscar o crear evento con NOMBRE_EVENTO + CODIGO_EVENTO + FECHA_EVENTO
3. Buscar o crear participante (vinculo cliente-evento)
4. Insertar abono con el MONTO (valor absoluto)
5. Actualizar monto_total_acordado del participante (sumar monto)
6. Buscar o crear cuenta bancaria segun CUENTA_BANCO (mapear a las 7 cuentas predefinidas)
7. Insertar movimiento bancario de ingreso
8. Actualizar saldo de cuenta bancaria

Para cada fila TIPO = GASTO:
1. NO crear cliente
2. Buscar o crear evento
3. Insertar gasto con NOMBRE_CLIENTE como concepto y Math.abs(MONTO) como importe
4. Insertar movimiento bancario de egreso
5. Restar del saldo de cuenta bancaria

Anti-duplicados: usar tabla excel_imports_log con FOLIO como PK. Antes de insertar, verificar que el folio no exista. Al inicio de cada importacion, LIMPIAR esta tabla para permitir reimportar desde cero.

Parseo de fechas: aceptar DD/MM/YYYY, YYYY-MM-DD, objetos Date de Excel, numeros seriales de Excel

PROGRESO (paso 3):
- Spinner animado con barra de progreso
- Texto "Procesando X de Y registros (Z%)"
- Procesar en lotes de 30 para no bloquear la UI

RESULTADO (paso 4):
- Banner verde "Importacion Completada"
- 5 cards: Clientes creados, Eventos creados, Abonos registrados, Gastos registrados, Registros omitidos
- Panel de advertencias si hubo errores o valores de TIPO no reconocidos
- Botones "Importar otro archivo" y "Ver Dashboard"

HERRAMIENTAS DE MANTENIMIENTO (visibles en paso 1):
- Boton "Limpiar historial de importacion" — borra SOLO excel_imports_log, con confirmacion
- Boton "Limpiar datos de muestra" — borra TODOS los datos de clientes, eventos, participantes, abonos, gastos, movimientos. Resetea saldos de cuentas a $0. Con doble confirmacion. NO borrar proveedores ni cuentas bancarias.

Mapeo de cuentas bancarias para la importacion:
"BANCOMER NINEL" → Bancomer, Ninel (Sendery), cheques
"BANCOMER OCTAVIO" → Bancomer, Octavio (Sendery), cheques
"BANCO AZTECA" → Banco Azteca, Sendery Outdoor, cheques
"EFECTIVO" → Efectivo, Caja General, efectivo
"EFECTIVO OCTAVIO" → Efectivo, Octavio (Sendery), efectivo
"STP" → STP, Sendery Outdoor, ahorro
"SPIN" → SPIN by OXXO, Sendery Outdoor, ahorro

=== GENERACION DE PDFs ===

Usar jsPDF con jspdf-autotable para generar recibos y reportes en PDF.

RECIBO POR ABONO INDIVIDUAL (boton en cada fila de abono expandida):
- Formato carta vertical
- Header: fondo amarillo #E8C547 de 50mm de alto. Logo a la izquierda (texto "SENDERY" en Oswald 20pt + "OUTDOOR LIFESTYLE" 7.5pt debajo, todo en verde #2C3A1A). A la derecha: "FECHA:" con fecha actual y "FOLIO:" con folio autogenerado, en verde.
- Linea separadora verde 1px
- Titulo: "R E C I B O" centrado, Helvetica bold 34pt, verde oscuro
- Cuerpo con labels en bold y valores en normal, 11pt:
  - RECIBO DE: [nombre del participante en MAYUSCULAS]
  - LA CANTIDAD DE: $[monto] PESOS
  - POR CONCEPTO DE: [nombre del evento en MAYUSCULAS]
  - FECHA DE EVENTO: [fecha larga en MAYUSCULAS]
  - REFERENCIA: [si existe]
  - CUENTA DESTINO: [si existe]
- Linea decorativa sand
- Area de firmas al pie: dos lineas horizontales con "FIRMA AUTORIZADA / Sendery Outdoor Lifestyle" y "FIRMA DE CONFORMIDAD / [nombre del cliente]"
- Footer: barra verde oscuro con texto "Sendery Outdoor Lifestyle · Ensenada, BC · Sistema CRM v1.0"

RECIBO HISTORICO POR PARTICIPANTE (boton en la fila del participante):
- Misma estetica de header/footer
- Titulo "RECIBO DE PAGO"
- Datos del evento en caja cream
- Badge tipo evento (CAMINATA/VIAJE) en olive, ancho fijo 22mm
- Datos del cliente
- Tabla autoTable con todos los abonos: Fecha, Referencia, Cuenta, Monto
- Resumen financiero: total acordado, total abonado, saldo pendiente
- Si saldo = 0: sello "LIQUIDADO" con opacidad 0.12, 28pt, angulo -12 grados
- Area de firmas

REPORTE DE EVENTO:
- Header con datos del evento
- Tabla de participantes con estado de pago (colores por estado)
- Tabla de gastos
- Cuadro de utilidad

ESTADO DE RESULTADOS:
- Tabla de ingresos por evento
- Tabla de gastos por categoria
- Cuadro de utilidad neta

=== DATOS DE SEED (DATOS DE MUESTRA INICIALES) ===

NO incluir datos de muestra de clientes, eventos ni abonos. Solo crear las 7 cuentas bancarias listadas arriba con saldo $0. El sistema debe arrancar limpio para importar datos reales.

=== REGLAS GENERALES DE UI/UX ===

1. Todos los formularios en modales con overlay oscuro, border-radius 14px, padding 24px
2. Los campos requeridos llevan asterisco rojo
3. Las tablas deben tener filas alternas en cream #F5F0E8 y blanco
4. Los botones primarios: fondo Sun Yellow #E8C547, texto Forest Green #2C3A1A, hover darken 10%
5. Los botones secundarios: fondo Olive #4A5E28, texto blanco
6. Los botones outline: borde Sand, texto Forest Green
7. Los botones de peligro: fondo #FCECEA, texto #8B1A1A
8. Los badges: border-radius 6px, padding 2px 8px, font DM Sans 11px semibold
9. Las cards: fondo blanco, border 1px solid rgba(196,169,125,0.2), border-radius 12px, padding 20px
10. Confirmacion antes de eliminar cualquier registro
11. Toast notifications para acciones exitosas (verde) y errores (rojo)
12. Responsive: 3 columnas en desktop, 2 en tablet, 1 en movil
13. Sidebar colapsable con animacion suave de 200ms
14. Todos los montos con formato MXN ($1,234.56)
15. Todas las fechas en espanol ("15 abr 2025")
```

---

## NOTAS DE USO PARA LOVABLE

### Si el prompt es muy largo, dividir en estas fases:

**Fase 1:** Copiar desde el inicio hasta el final del MODULO 2 (Eventos). Pedir: "Construye la base del sistema con la identidad visual, el sidebar, la base de datos, el dashboard y el modulo de eventos completo."

**Fase 2:** Copiar MODULOS 3, 4 y 5. Pedir: "Agrega los modulos de Clientes (con panel lateral), Gastos (con cards por categoria y afectacion a cuenta bancaria) y Proveedores (con historial de pagos)."

**Fase 3:** Copiar MODULOS 6 y 7. Pedir: "Agrega Cuentas Bancarias (con banner consolidado, movimientos y saldo acumulado) y Reportes (3 tabs con graficas y exportacion PDF)."

**Fase 4:** Copiar MODULO 8 y GENERACION DE PDFs. Pedir: "Agrega el importador de Excel con deteccion flexible de TIPO y anti-duplicados, y el sistema de generacion de PDFs para recibos y reportes."

### Tips para Lovable:
- Si Lovable no aplica la paleta de colores correctamente, pegar solo la seccion de IDENTIDAD VISUAL como un prompt de correccion
- Si las graficas no se ven bien, pedir ajustes especificos: "En el BarChart del dashboard, rotar las etiquetas -40 grados, poner interval={0} y altura del eje X de 90px"
- Si el importador falla, lo mas importante es que la deteccion de TIPO sea flexible (ver la lista de variantes aceptadas)
