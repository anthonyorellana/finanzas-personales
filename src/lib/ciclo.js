export const fmtDia = (d) =>
  d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export function getCicloFechas(offset) {
  const hoy = new Date()
  let year = hoy.getFullYear()
  let month = hoy.getMonth()
  if (hoy.getDate() < 28) {
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
  }
  month += offset
  while (month < 0) { month += 12; year -= 1 }
  while (month > 11) { month -= 12; year += 1 }
  const inicio = new Date(year, month, 28)
  let ey = year, em = month + 1
  if (em > 11) { em = 0; ey += 1 }
  const fin = new Date(ey, em, 27)
  return { inicio, fin }
}
