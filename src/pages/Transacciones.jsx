import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

const TIPOS = ['⬇ Gasto', '⬆ Ingreso', '🏦 Transf. a TR', '🏦 Transf. desde Santander', '📈 Compra ETF']

export default function Transacciones() {
  const [transacciones, setTransacciones] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroCuenta, setFiltroCuenta] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha: '', importe: '', tipo: '⬇ Gasto', descripcion: '', cuenta_id: '' })
  const [saving, setSaving] = useState(false)

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
    const mes = new Date(form.fecha).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
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

  if (loading) return <div style={{ color: 'var(--text2)', padding: '40px' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>💳 Transacciones</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: 'var(--blue)', color: 'white', border: 'none',
          borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600',
        }}>+ Nueva</button>
      </div>

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
            borderRadius: '12px', padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{t.fecha}</div>
              <div style={{ fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.descripcion || t.tipo}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                {t.cuentas?.nombre}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                fontWeight: '700', fontSize: '15px', whiteSpace: 'nowrap',
                color: t.importe > 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {t.importe > 0 ? '+' : ''}{fmt(t.importe)}
              </div>
              <button onClick={() => eliminar(t.id)} style={{
                background: 'none', border: 'none', color: 'var(--text2)',
                cursor: 'pointer', fontSize: '16px', padding: '2px',
              }}>🗑️</button>
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