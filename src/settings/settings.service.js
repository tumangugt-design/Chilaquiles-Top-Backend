import Setting from './settings.model.js'
import { getGuatemalaParts } from '../helpers/timezone.helper.js'

export const DEFAULT_OPERATING_HOURS = {
  weekly: {
    0: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
    1: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
    2: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
    3: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
    4: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
    5: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
    6: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
  },
  specialDates: {},
  dateRanges: [],
  // Legacy support
  isOpen: true,
  openTime: '08:00',
  closeTime: '17:00'
}

const OPERATING_HOURS_KEY = 'operating-hours'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const sanitizeTime = (value = '') => {
  const text = String(value || '').trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : ''
}

const normalizeDaySchedule = (value = {}, fallback = {}) => ({
  isOpen: value?.isOpen === undefined ? Boolean(fallback?.isOpen) : Boolean(value.isOpen),
  openTime: sanitizeTime(value?.openTime) || sanitizeTime(fallback?.openTime) || '08:00',
  closeTime: sanitizeTime(value?.closeTime) || sanitizeTime(fallback?.closeTime) || '17:00',
  ...(value?.note ? { note: String(value.note) } : {}),
})

const normalizeWeekly = (weekly = {}) => {
  return DAY_KEYS.reduce((acc, dayKey, index) => {
    const current = weekly?.[dayKey] || weekly?.[String(index)] || weekly?.[index]
    const fallback = DEFAULT_OPERATING_HOURS.weekly[index] || { isOpen: true, openTime: '08:00', closeTime: '17:00' }
    acc[dayKey] = normalizeDaySchedule(current, fallback)
    return acc
  }, {})
}

const normalizeOperatingHours = (value = {}) => {
  const merged = { ...DEFAULT_OPERATING_HOURS, ...(value || {}) }

  return {
    ...merged,
    weekly: normalizeWeekly(merged.weekly),
    specialDates: merged.specialDates || {},
    dateRanges: Array.isArray(merged.dateRanges) ? merged.dateRanges : [],
    isOpen: merged.isOpen === undefined ? true : Boolean(merged.isOpen),
    openTime: sanitizeTime(merged.openTime) || '08:00',
    closeTime: sanitizeTime(merged.closeTime) || '17:00',
  }
}

export const getOperatingHoursSetting = async () => {
  const existing = await Setting.findOne({ key: OPERATING_HOURS_KEY })
  if (!existing) {
    const created = await Setting.create({ key: OPERATING_HOURS_KEY, value: normalizeOperatingHours(DEFAULT_OPERATING_HOURS) })
    return created.value
  }

  const normalized = normalizeOperatingHours(existing.value || {})

  // Si existía el formato viejo con llaves 0-6, se migra sin afectar lo demás.
  if (JSON.stringify(existing.value || {}) !== JSON.stringify(normalized)) {
    existing.value = normalized
    await existing.save()
  }

  return normalized
}

export const updateOperatingHoursSetting = async (payload = {}) => {
  const normalized = normalizeOperatingHours(payload)
  const updated = await Setting.findOneAndUpdate(
    { key: OPERATING_HOURS_KEY },
    { $set: { value: normalized } },
    { new: true, upsert: true }
  )
  return normalizeOperatingHours(updated.value)
}

const toMinutes = (value = '') => {
  const [hour, minute] = String(value || '').split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

const getGuatemalaDateTime = () => {
  const gt = getGuatemalaParts()
  const totalMinutes = gt.hour * 60 + gt.minute

  return { dateString: gt.dateString, totalMinutes, dayOfWeek: gt.dayOfWeek }
}

export const isOperatingNow = async () => {
  const settings = await getOperatingHoursSetting()
  const { dateString, totalMinutes, dayOfWeek } = getGuatemalaDateTime()

  let schedule = null

  // 1. Check special dates (exceptions)
  if (settings.specialDates && settings.specialDates[dateString]) {
    schedule = settings.specialDates[dateString]
  }

  // 2. Check date ranges
  if (!schedule && settings.dateRanges && Array.isArray(settings.dateRanges)) {
    // Sort ranges by start date descending to get the most specific/recent one if they overlap
    const activeRange = settings.dateRanges.find(r => dateString >= r.start && dateString <= r.end)
    if (activeRange) {
      schedule = activeRange
    }
  }

  // 3. Check weekly schedule
  if (!schedule && settings.weekly) {
    const dayKey = DAY_KEYS[dayOfWeek]
    schedule = settings.weekly[dayKey] || settings.weekly[String(dayOfWeek)] || settings.weekly[dayOfWeek]
  }

  // 4. Fallback to legacy
  if (!schedule) {
    schedule = { isOpen: settings.isOpen, openTime: settings.openTime, closeTime: settings.closeTime }
  }

  if (!schedule.isOpen) return { ...schedule, isCurrentlyOpen: false }

  const open = toMinutes(schedule.openTime)
  const close = toMinutes(schedule.closeTime)
  
  if (open === null || close === null) return { ...schedule, isCurrentlyOpen: true }

  let isCurrentlyOpen = false
  if (open === close) {
    isCurrentlyOpen = true
  } else if (open < close) {
    isCurrentlyOpen = totalMinutes >= open && totalMinutes <= close
  } else {
    isCurrentlyOpen = totalMinutes >= open || totalMinutes <= close
  }

  return { ...schedule, isCurrentlyOpen }
}

// Validacion de forma minima antes de guardar promociones. No impone reglas
// de negocio nuevas (ej. no obliga precio, porque el formulario actual
// permite dejarlo vacio mientras se arma la promo) - solo evita que quede
// guardado un arreglo con ids duplicados, sin nombre, o con rango de fechas
// invertido, que es lo que puede corromper silenciosamente el Setting
// completo (updatePromotions reemplaza el arreglo entero cada vez).
export const validatePromotionsPayload = (promotions) => {
  const errors = []
  const seenIds = new Set()

  promotions.forEach((promo, index) => {
    const label = `Promocion #${index + 1}`

    if (!promo || typeof promo !== 'object' || Array.isArray(promo)) {
      errors.push(`${label}: debe ser un objeto.`)
      return
    }

    const id = promo.id !== undefined && promo.id !== null ? String(promo.id) : ''
    if (!id) {
      errors.push(`${label}: falta id.`)
    } else if (seenIds.has(id)) {
      errors.push(`${label}: id duplicado (${id}).`)
    } else {
      seenIds.add(id)
    }

    if (!promo.name || !String(promo.name).trim()) {
      errors.push(`${label} (${id || 'sin id'}): falta nombre.`)
    }

    const price = promo.promoPrice ?? promo.price
    if (price !== undefined && price !== null && price !== '' && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      errors.push(`${label} (${id || 'sin id'}): precio invalido.`)
    }

    if (promo.startDate && promo.endDate && String(promo.startDate) > String(promo.endDate)) {
      errors.push(`${label} (${id || 'sin id'}): la fecha de inicio es posterior a la de fin.`)
    }
  })

  return { ok: errors.length === 0, errors }
}

// Promociones vencidas nunca se "eliminan": se desactivan solas la primera vez
// que alguien pide la lista (admin, Location o Size), usando la fecha de
// Guatemala. Esto evita depender de un cron en proceso (deshabilitado en este
// backend, ver survey.cron.js) y evita que cada pantalla reimplemente su
// propia comparacion de fechas -> una sola fuente de verdad.
export const deactivateExpiredPromotions = async () => {
  const doc = await Setting.findOne({ key: 'promotions' })
  const promos = Array.isArray(doc?.value) ? doc.value : []
  if (promos.length === 0) return promos

  const today = getGuatemalaParts().dateString
  let changed = false

  const updated = promos.map((promo) => {
    if (promo && promo.isActive && promo.endDate && today > promo.endDate) {
      changed = true
      return { ...promo, isActive: false, deactivatedReason: 'expired' }
    }
    return promo
  })

  if (!changed) return promos

  const saved = await Setting.findOneAndUpdate(
    { key: 'promotions' },
    { $set: { value: updated } },
    { new: true }
  )

  return saved.value
}

export const seedSettings = async () => {
  const existing = await Setting.findOne({ key: OPERATING_HOURS_KEY })
  if (!existing) {
    await Setting.create({ key: OPERATING_HOURS_KEY, value: DEFAULT_OPERATING_HOURS })
    console.log('Settings seeded: operating-hours')
  }

  const existingPromos = await Setting.findOne({ key: 'promotions' })
  if (!existingPromos) {
    await Setting.create({ key: 'promotions', value: [] })
    console.log('Settings seeded: promotions')
  }

  const existingCoupons = await Setting.findOne({ key: 'coupons' })
  if (!existingCoupons) {
    await Setting.create({ key: 'coupons', value: [] })
    console.log('Settings seeded: coupons')
  }
}
