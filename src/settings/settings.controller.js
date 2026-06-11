import { getOperatingHoursSetting, isOperatingNow, updateOperatingHoursSetting } from './settings.service.js'
import Setting from './settings.model.js'
import { sendPromotionBlastMessage } from '../bot/whatsapp.service.js'
import User from '../users/user.model.js'
import { Campaign } from './campaign.model.js'
import { generateMarketingMessage } from '../bot/ai.service.js'

const ALLOWED_PROMOTION_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const validatePublicImageUrl = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD', redirect: 'follow' })
    const contentType = response.headers.get('content-type') || ''

    return (
      response.ok &&
      ALLOWED_PROMOTION_IMAGE_MIME_TYPES.some(type => contentType.toLowerCase().includes(type))
    )
  } catch (error) {
    console.error('[Promotion Blast] Invalid image URL:', error.message)
    return false
  }
}

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

export const sendPromotionBlast = async (req, res) => {
  try {
    const { promotionId, promoName, description, price, validUntil, marketingMessage, imageUrl } = req.body;
    
    if (!promoName || !description || !price || !validUntil || !marketingMessage || !imageUrl) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios (nombre, descripción, precio, vigencia, mensaje de marketing e imagen).' });
    }

    const isValidImage = await validatePublicImageUrl(imageUrl);
    if (!isValidImage) {
      return res.status(400).json({
        message: 'La URL de imagen no es válida. Debe ser pública y devolver image/jpeg, image/png o image/webp.'
      });
    }
    
    let clients = await User.find({ role: 'CLIENT', phone: { $exists: true, $ne: '' } });
    
    // TEMPORAL: Filtrar para enviar solo al número de prueba
    clients = clients.filter(c => c.phone && c.phone.includes('32136131'));

    if (!clients || clients.length === 0) {
      return res.status(400).json({ message: 'No hay clientes registrados con teléfono o no se encontró el número de prueba.' });
    }

    const campaign = await Campaign.create({
      promotionId: promotionId || 'custom',
      imageUrl,
      description: marketingMessage, // Guardamos el mensaje de marketing como descripción de la campaña para referencia
      totalTarget: clients.length,
      status: 'PROCESSING'
    });

    res.status(200).json({ message: `Iniciando envío de promoción a ${clients.length} clientes.`, campaignId: campaign._id });

    // Background processing by batches
    setImmediate(async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < clients.length; i++) {
        try {
          const client = clients[i];
          const result = await sendPromotionBlastMessage(client.phone, {
            promoName,
            description,
            price,
            validUntil,
            marketingMessage,
            imageUrl
          });
          if (result.sent) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }
        
        // Wait 150ms between messages to avoid Meta rate limits
        await new Promise(r => setTimeout(r, 150));
      }

      campaign.sentCount = sentCount;
      campaign.failedCount = failedCount;
      campaign.status = 'COMPLETED';
      await campaign.save();
      console.log(`[Promotion Blast] Finished. Sent: ${sentCount}, Failed: ${failedCount}`);
    });

  } catch (error) {
    return res.status(500).json({ message: 'Error al iniciar campaña', error: error.message });
  }
}

export const generateMarketing = async (req, res) => {
  try {
    const promoData = req.body;
    if (!promoData.promoName || !promoData.description || !promoData.price || !promoData.validUntil) {
      return res.status(400).json({ message: 'Faltan datos de la promoción para generar el mensaje.' });
    }

    const marketingMessage = await generateMarketingMessage(promoData);
    return res.status(200).json({ marketingMessage });
  } catch (error) {
    return res.status(500).json({ message: 'Error al generar el mensaje de marketing', error: error.message });
  }
}

export const getCampaignHistory = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    return res.status(200).json(campaigns);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener el historial', error: error.message });
  }
}
