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

export const getCalculatorCosts = async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: 'calculator_costs' })
    const costs = doc ? doc.value : {}
    
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(costs)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron cargar los costos de la calculadora', error: error.message })
  }
}

export const updateCalculatorCosts = async (req, res) => {
  try {
    const costs = req.body
    if (typeof costs !== 'object' || costs === null) {
      return res.status(400).json({ message: 'El formato de costos debe ser un objeto' })
    }

    const updated = await Setting.findOneAndUpdate(
      { key: 'calculator_costs' },
      { $set: { value: costs } },
      { new: true, upsert: true }
    )

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(updated.value)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron guardar los costos de la calculadora', error: error.message })
  }
}

export const getCoupons = async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: 'coupons' })
    const coupons = doc ? doc.value : []
    
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(coupons)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron cargar los cupones', error: error.message })
  }
}

export const updateCoupons = async (req, res) => {
  try {
    const coupons = req.body
    if (!Array.isArray(coupons)) {
      return res.status(400).json({ message: 'El formato de cupones debe ser un arreglo' })
    }

    const normalized = coupons.map(c => ({
      code: String(c.code || '').trim().toUpperCase(),
      discountPercent: Math.max(0, Math.min(100, Number(c.discountPercent || 0))),
      maxUses: Math.max(1, Number(c.maxUses || 1)),
      usedCount: Math.max(0, Number(c.usedCount || 0)),
      isActive: c.isActive !== false
    })).filter(c => c.code)

    const updated = await Setting.findOneAndUpdate(
      { key: 'coupons' },
      { $set: { value: normalized } },
      { new: true, upsert: true }
    )

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(updated.value)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron guardar los cupones', error: error.message })
  }
}

export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body
    if (!code) {
      return res.status(400).json({ message: 'El código de cupón es requerido' })
    }

    const doc = await Setting.findOne({ key: 'coupons' })
    const coupons = doc ? doc.value : []
    const cleanCode = String(code).trim().toUpperCase()

    const coupon = coupons.find(c => c.code === cleanCode)
    if (!coupon) {
      return res.status(400).json({ message: 'Cupón no encontrado o inválido' })
    }

    if (!coupon.isActive) {
      return res.status(400).json({ message: 'El cupón no está activo' })
    }

    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'El cupón ha agotado su cantidad de usos' })
    }

    return res.status(200).json({
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      maxUses: coupon.maxUses,
      usedCount: coupon.usedCount,
      isActive: coupon.isActive
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error validando cupón', error: error.message })
  }
}

