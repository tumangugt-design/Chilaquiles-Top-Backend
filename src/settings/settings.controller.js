import { getOperatingHoursSetting, isOperatingNow, updateOperatingHoursSetting } from './settings.service.js'
import Setting from './settings.model.js'

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

export const getPromotions = async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: 'promotions' })
    const promos = doc ? doc.value : []
    
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(promos)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron cargar las promociones', error: error.message })
  }
}

export const updatePromotions = async (req, res) => {
  try {
    const promotions = req.body
    if (!Array.isArray(promotions)) {
      return res.status(400).json({ message: 'El formato de promociones debe ser un arreglo' })
    }

    const updated = await Setting.findOneAndUpdate(
      { key: 'promotions' },
      { $set: { value: promotions } },
      { new: true, upsert: true }
    )

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(updated.value)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron guardar las promociones', error: error.message })
  }
}
