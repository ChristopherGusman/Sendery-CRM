import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { DBProvider } from './db/DBContext.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './modules/Dashboard/Dashboard.jsx'
import EventosList from './modules/Eventos/EventosList.jsx'
import EventoDetalle from './modules/Eventos/EventoDetalle.jsx'
import Clientes from './modules/Clientes/Clientes.jsx'
import Gastos from './modules/Gastos/Gastos.jsx'
import Proveedores from './modules/Proveedores/Proveedores.jsx'
import CuentasBancarias from './modules/CuentasBancarias/CuentasBancarias.jsx'
import Reportes from './modules/Reportes/Reportes.jsx'
import Importador from './modules/Importador/Importador.jsx'

export default function App() {
  return (
    <DBProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/eventos" element={<EventosList />} />
          <Route path="/eventos/:id" element={<EventoDetalle />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/cuentas" element={<CuentasBancarias />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/importador" element={<Importador />} />
        </Routes>
      </Layout>
    </DBProvider>
  )
}
