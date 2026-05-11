import Setting from './settings.model.js'

export const DEFAULT_OPERATING_HOURS = {
  isOpen: true,
  openTime: '08:00',
  closeTime: '17:00',
}

const OPERATING_HOURS_KEY = 'operating-hours'

const sanitizeTime = (value = '') => {
  const text = String(value || '').trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : ''
}

export const normalizeOperatingHours = (payload = {}) => {
  const isOpen = Boolean(payload.isOpen)
  const openTime = sanitizeTime(payload.openTime)
  const closeTime = sanitizeTime(payload.closeTime)
  return { isOpen, openTime, closeTime }
}

export const getOperatingHoursSetting = async () => {
  const existing = await Setting.findOne({ key: OPERATING_HOURS_KEY })
  if (!existing) {
    const created = await Setting.create({ key: OPERATING_HOURS_KEY, value: DEFAULT_OPERATING_HOURS })
    return created.value
  }
  return { ...DEFAULT_OPERATING_HOURS, ...(existing.value || {}) }
}

export const updateOperatingHoursSetting = async (payload = {}) => {
  const value = normalizeOperatingHours(payload)
  const updated = await Setting.findOneAndUpdate(
    { key: OPERATING_HOURS_KEY },
    { $set: { value } },
    { new: true, upsert: true }
  )
  return updated.value
}

const toMinutes = (value = '') => {
  const [hour, minute] = String(value || '').split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

const getGuatemalaMinutes = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  return (hour % 24) * 60 + minute
}

export const isOperatingNow = async () => {
  const settings = await getOperatingHoursSetting()
  if (!settings.isOpen) return false

  const open = toMinutes(settings.openTime)
  const close = toMinutes(settings.closeTime)
  if (open === null || close === null) return true

  const now = getGuatemalaMinutes()
  if (open === close) return true
  if (open < close) return now >= open && now <= close
  return now >= open || now <= close
}

export const seedSettings = async () => {
  const existing = await Setting.findOne({ key: OPERATING_HOURS_KEY })
  if (!existing) {
    await Setting.create({ key: OPERATING_HOURS_KEY, value: DEFAULT_OPERATING_HOURS })
    console.log('Settings seeded: operating-hours')
  }
}
