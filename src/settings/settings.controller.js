import { getOperatingHoursSetting, isOperatingNow, updateOperatingHoursSetting } from './settings.service.js'

export const getOperatingHours = async (req, res) => {
  try {
    const settings = await getOperatingHoursSetting()
    const isCurrentlyOpen = await isOperatingNow()
    return res.status(200).json({ ...settings, isCurrentlyOpen })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cargar el horario', error: error.message })
  }
}

export const updateOperatingHours = async (req, res) => {
  try {
    const settings = await updateOperatingHoursSetting(req.body)
    const isCurrentlyOpen = await isOperatingNow()
    return res.status(200).json({ message: 'Horario actualizado', settings: { ...settings, isCurrentlyOpen } })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo actualizar el horario', error: error.message })
  }
}
