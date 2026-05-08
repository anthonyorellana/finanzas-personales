import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const TIPOS = ['⬇ Gasto', '⬆ Ingreso', '🏦 Transf. a TR', '🏦 Transf. desde Santander', '📈 Compra ETF']

export default function Transacciones() {
  const [transacciones, setTransacciones] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroCuenta, setFiltroCuenta] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState({ fecha: '', importe: '', tipo: '⬇ Gasto', descripcion: '', cuenta_id: '' })
  const [saving, setSaving] = useState(false)
  const [importPreview, setImportPreview] = useState([])
  const [importando, setImportando] = useState(false)
  const [cuentaImport, setCuentaImport] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('transacciones').select('*, cuentas(nombre)').order('fecha', { ascending: false }),
      supabase.from('cuentas').select('*'),
    ])
    setTransacciones(t || [])
    setCuentas(c || [])
    setLoading(false)
  }

  const meses = [...new Set(transacciones.map(t => t.mes).filter(Boolean))].sort().reverse()
  const filtradas = transacciones.filter(t => {
    if (filtroMes && t.mes !== filtroMes) return false
    if (filtroCuenta && t.cuenta_id !== filtroCuenta) return false
    return true
  })

  async function guardar() {
    if (!form.fecha || !form.importe || !form.cuenta_id) return
    setSaving(true)
    const fecha = new Date(form.fecha)
    const mes = fecha.toLocaleString('es-ES', { month: 'short', year: 'numeric' })
      .replace('.', '').replace(/^\w/, c => c.toUpperCase())
    await supabase.from('transacciones').insert([{ ...form, importe: Number(form.importe), mes }])
    setForm({ fecha: '', importe: '', tipo: '⬇ Gasto', descripcion: '', cuenta_id: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta transacción?')) return
    await supabase.from('transacciones').delete().eq('id', id)
    load()
  }

function parsearExcel(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    const resultado = []
    for (const row of rows) {
      const posibleFecha = row[0]
      const posibleImporte = row[3]
      const posibleConcepto = row[2]

      // Solo filas con fecha en formato DD/MM/YYYY
      if (typeof posibleFecha !== 'string' || !posibleFecha.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue

      const [d, m, y] = posibleFecha.split('/')
      const fecha = `${y}-${m}-${d}`

      // Limpiar importe: guión especial, puntos de miles, coma decimal
      const importeStr = String(posibleImporte)
        .replace('−', '-')   // guión especial → normal
        .replace(/\./g, '')  // quitar puntos de miles
        .replace(',', '.')   // coma → punto decimal
      const importe = parseFloat(importeStr)

      if (isNaN(importe)) continue

      const fechaObj = new Date(fecha)
      const mes = fechaObj.toLocaleString('es-ES', { month: 'short', year: 'numeric' })
        .replace('.', '').replace(/^\w/, c => c.toUpperCase())

      const descripcion = String(posibleConcepto).trim()
      const tipo = importe > 0 ? '⬆ Ingreso' : '⬇ Gasto'

      resultado.push({ fecha, mes, importe, tipo, descripcion })
    }
    setImportPreview(resultado)
  }
  reader.readAsBinaryString(file)
}

  async function confirmarImport() {
    if (!cuentaImport || importPreview.length === 0) return
    setImportando(true)
    const rows = importPreview.map(r => ({ ...r, cuenta_id: cuentaImport }))
    await supabase.from('transacciones').insert(rows)
    setImportPreview([])
    setShowImport(false)
    setCuentaImport('')
    setImportando(false)
    load()
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>💳 Transacciones</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { setShowImport(!showImport); setShowForm(false) }} style={{
            background: 'var(--purple)', color: 'white', border: 'none',
            borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600',
          }}>📥 Importar Excel</button>
          <button onClick={() => { setShowForm(!showForm); setShowImport(false) }} style={{
            background: 'var(--blue)', color: 'white', border: 'none',
            borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600',
          }}>+ Nueva</button>
        </div>
      </div>

      {/* Importar Excel */}
      {showImport && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>📥 Importar extracto Excel del Santander</div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Cuenta destino</div>
              <select value={cuentaImport} onChange={e => setCuentaImport(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                }}>
                <option value="">Selecciona cuenta...</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Archivo Excel (.xlsx)</div>
              <input type="file" accept=".xlsx" onChange={parsearExcel}
                style={{
                  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                }} />
            </div>
          </div>

          {importPreview.length > 0 && (
            <>
              <div style={{ fontSize: '13px', color: 'var(--green)', marginBottom: '12px' }}>
                ✅ {importPreview.length} transacciones detectadas — revisa antes de importar
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
                {importPreview.slice(0, 10).map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: '13px',
                    padding: '6px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ color: 'var(--text2)' }}>{r.fecha}</span>
                    <span style={{ flex: 1, margin: '0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion || r.tipo}</span>
                    <span style={{ color: r.importe > 0 ? 'var(--green)' : 'var(--red)', fontWeight: '600' }}>
                      {r.importe > 0 ? '+' : ''}{fmt(r.importe)}
                    </span>
                  </div>
                ))}
                {importPreview.length > 10 && (
                  <div style={{ fontSize: '12px', color: 'var(--text2)', padding: '8px 0' }}>
                    ...y {importPreview.length - 10} más
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={confirmarImport} disabled={importando || !cuentaImport} style={{
                  background: 'var(--green)', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', fontWeight: '600',
                }}>{importando ? 'Importando...' : `Importar ${importPreview.length} transacciones`}</button>
                <button onClick={() => { setImportPreview([]); setShowImport(false) }} style={{
                  background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '9px 20px', cursor: 'pointer',
                }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Formulario nueva transacción */}
      {showForm && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Nueva transacción</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Fecha', key: 'fecha', type: 'date' },
              { label: 'Importe (€)', key: 'importe', type: 'number' },
              { label: 'Descripción', key: 'descripcion', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ flex: '1', minWidth: '150px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>{label}</div>
                <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                  }} />
              </div>
            ))}
            <div style={{ flex: '1', minWidth: '150px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Tipo</div>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                style={{
                  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                }}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>Cuenta</div>
              <select value={form.cuenta_id} onChange={e => setForm({ ...form, cuenta_id: e.target.value })}
                style={{
                  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
                }}>
                <option value="">Selecciona...</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={guardar} disabled={saving} style={{
              background: 'var(--green)', color: 'white', border: 'none',
              borderRadius: '8px', padding: '9px 20px', cursor: 'pointer', fontWeight: '600',
            }}>{saving ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => setShowForm(false)} style={{
              background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '9px 20px', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
          }}>
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filtroCuenta} onChange={e => setFiltroCuenta(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px',
          }}>
          <option value="">Todas las cuentas</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div style={{ fontSize: '13px', color: 'var(--text2)', alignSelf: 'center' }}>
          {filtradas.length} transacciones
        </div>
      </div>

  {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtradas.map(t => (
          <div key={t.id} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{t.fecha}</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', background: 'var(--bg3)', padding: '2px 6px', borderRadius: '4px' }}>
                  {t.cuentas?.nombre}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontWeight: '700', fontSize: '14px',
                  color: t.importe > 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {t.importe > 0 ? '+' : ''}{fmt(t.importe)}
                </span>
                <button onClick={() => eliminar(t.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text2)',
                  cursor: 'pointer', fontSize: '14px', padding: '2px',
                }}>🗑️</button>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '1.4' }}>
              {t.descripcion || t.tipo}
            </div>
          </div>
        ))}
        {filtradas.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '40px' }}>
            No hay transacciones
          </div>
        )}
      </div>
    </div>
  )
}