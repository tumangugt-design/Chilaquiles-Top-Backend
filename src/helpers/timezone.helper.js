export const GUATEMALA_TIMEZONE = 'America/Guatemala'
export const GUATEMALA_UTC_OFFSET_MINUTES = -6 * 60

const pad2 = (value) => String(value).padStart(2, '0')

export const getGuatemalaParts = (date = new Date()) => {
  const gtTime = new Date(date.getTime() + GUATEMALA_UTC_OFFSET_MINUTES * 60 * 1000)
  return {
    year: gtTime.getUTCFullYear(),
    month: gtTime.getUTCMonth() + 1,
    day: gtTime.getUTCDate(),
    hour: gtTime.getUTCHours(),
    minute: gtTime.getUTCMinutes(),
    second: gtTime.getUTCSeconds(),
    millisecond: gtTime.getUTCMilliseconds(),
    dayOfWeek: gtTime.getUTCDay(),
    dateString: `${gtTime.getUTCFullYear()}-${pad2(gtTime.getUTCMonth() + 1)}-${pad2(gtTime.getUTCDate())}`,
  }
}

export const guatemalaLocalToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 }) => {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - GUATEMALA_UTC_OFFSET_MINUTES * 60 * 1000)
}

export const addUtcDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

export const getGuatemalaDayRange = (date = new Date()) => {
  const parts = getGuatemalaParts(date)
  const start = guatemalaLocalToUtc({ year: parts.year, month: parts.month, day: parts.day })
  return { start, end: addUtcDays(start, 1), parts }
}

export const getGuatemalaWeekRange = (date = new Date()) => {
  const parts = getGuatemalaParts(date)
  // Semana operativa de lunes a domingo en horario de Guatemala.
  const daysSinceMonday = (parts.dayOfWeek + 6) % 7
  const start = guatemalaLocalToUtc({ year: parts.year, month: parts.month, day: parts.day - daysSinceMonday })
  return { start, end: addUtcDays(start, 7), parts }
}

export const getGuatemalaMonthRange = (date = new Date()) => {
  const parts = getGuatemalaParts(date)
  const start = guatemalaLocalToUtc({ year: parts.year, month: parts.month, day: 1 })
  const end = parts.month === 12
    ? guatemalaLocalToUtc({ year: parts.year + 1, month: 1, day: 1 })
    : guatemalaLocalToUtc({ year: parts.year, month: parts.month + 1, day: 1 })
  return { start, end, parts }
}

export const getGuatemalaOrderDatePrefix = (date = new Date()) => {
  const parts = getGuatemalaParts(date)
  return `${pad2(parts.day)}${pad2(parts.month)}`
}
