import Setting from './settings.model.js'

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

const sanitizeTime = (value = '') => {
  const text = String(value || '').trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : ''
}

export const getOperatingHoursSetting = async () => {
  const existing = await Setting.findOne({ key: OPERATING_HOURS_KEY })
  if (!existing) {
    const created = await Setting.create({ key: OPERATING_HOURS_KEY, value: DEFAULT_OPERATING_HOURS })
    return created.value
  }
  // Merge with defaults to ensure all fields exist
  return { ...DEFAULT_OPERATING_HOURS, ...(existing.value || {}) }
}

export const updateOperatingHoursSetting = async (payload = {}) => {
  const updated = await Setting.findOneAndUpdate(
    { key: OPERATING_HOURS_KEY },
    { $set: { value: payload } },
    { new: true, upsert: true }
  )
  return updated.value
}

const toMinutes = (value = '') => {
  const [hour, minute] = String(value || '').split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

const getGuatemalaDateTime = () => {
  const now = new Date()
  const guatemalaString = now.toLocaleString('en-US', { timeZone: 'America/Guatemala' })
  const gtDate = new Date(guatemalaString)
  
  const year = gtDate.getFullYear()
  const month = String(gtDate.getMonth() + 1).padStart(2, '0')
  const day = String(gtDate.getDate()).padStart(2, '0')
  const dateString = `${year}-${month}-${day}`
  
  const hour = gtDate.getHours()
  const minute = gtDate.getMinutes()
  const totalMinutes = hour * 60 + minute
  const dayOfWeek = gtDate.getDay()

  return { dateString, totalMinutes, dayOfWeek }
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
  if (!schedule && settings.weekly && settings.weekly[dayOfWeek]) {
    schedule = settings.weekly[dayOfWeek]
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

export const seedSettings = async () => {
  const existing = await Setting.findOne({ key: OPERATING_HOURS_KEY })
  if (!existing) {
    await Setting.create({ key: OPERATING_HOURS_KEY, value: DEFAULT_OPERATING_HOURS })
    console.log('Settings seeded: operating-hours')
  }
}
