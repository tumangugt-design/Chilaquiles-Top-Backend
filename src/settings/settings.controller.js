import { getOperatingHoursSetting, isOperatingNow, updateOperatingHoursSetting } from './settings.service.js'

export const getOperatingHours = async (req, res) => {
  try {
    const settings = await getOperatingHoursSetting()
    const currentSchedule = await isOperatingNow()

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json({
      ...settings,
      today: currentSchedule,
      isCurrentlyOpen: Boolean(currentSchedule?.isCurrentlyOpen),
      todayIsOpen: currentSchedule?.isOpen !== false,
      openTime: currentSchedule?.openTime || '',
      closeTime: currentSchedule?.closeTime || '',
      note: currentSchedule?.note || '',
    })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cargar el horario', error: error.message })
  }
}

export const updateOperatingHours = async (req, res) => {
  try {
    const settings = await updateOperatingHoursSetting(req.body)
    const currentSchedule = await isOperatingNow()

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json({
      message: 'Horario actualizado',
      settings: {
        ...settings,
        today: currentSchedule,
        isCurrentlyOpen: Boolean(currentSchedule?.isCurrentlyOpen),
        todayIsOpen: currentSchedule?.isOpen !== false,
        openTime: currentSchedule?.openTime || '',
        closeTime: currentSchedule?.closeTime || '',
        note: currentSchedule?.note || '',
      }
    })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo actualizar el horario', error: error.message })
  }
}
