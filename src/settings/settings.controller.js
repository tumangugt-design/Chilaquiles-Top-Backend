import { getOperatingHoursSetting, isOperatingNow, updateOperatingHoursSetting, deactivateExpiredPromotions, validatePromotionsPayload, getDeliveryConfig as getDeliveryConfigService, updateDeliveryConfig as updateDeliveryConfigService } from './settings.service.js'
import Setting from './settings.model.js'
import { getTaxConfig as getTaxConfigService, updateTaxConfig as updateTaxConfigService } from '../finances/finances.service.js'
import { sendPromotionBlastMessage } from '../bot/whatsapp.service.js'
import User from '../users/user.model.js'
import { Campaign } from './campaign.model.js'
import { generateMarketingMessage } from '../bot/ai.service.js'
import { costPromotion, validatePromotionMargin, proposePackaging } from './promotion-costing.service.js'

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
    // Antes de responder, apaga sola cualquier promocion cuya fecha de fin ya
    // paso -> admin, Location y Size reciben siempre el mismo estado real,
    // sin que cada pantalla tenga que revisar fechas por su cuenta.
    const promos = await deactivateExpiredPromotions()

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(promos)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron cargar las promociones', error: error.message })
  }
}

/**
 * Cuesta una promo con el lote FIFO vigente, la valida contra el margen neto
 * y le sella el resultado. Es el unico lugar donde se decide si una promo
 * puede guardarse: lo usan tanto el guardado masivo como el de una sola, para
 * que no existan dos reglas distintas para la misma decision.
 */
const costAndStampPromotion = async (promo) => {
  const plates = Array.isArray(promo?.plates) ? promo.plates : []

  // Promo de formato legado sin plates[]: no hay como costearla, se guarda
  // tal cual para no romper historial.
  if (plates.length === 0) return { ok: true, promo }

  const verdict = await validatePromotionMargin(plates, {
    price: promo.promoPrice ?? promo.price,
    minMarginPercent: promo.minMarginAlertPercent,
    allowLowMargin: promo.allowLowMargin === true,
    packagingMode: promo.packagingMode || 'porPlato',
    sharedPackaging: promo.packaging || null,
    paymentMethod: promo.paymentMethod || 'tarjeta',
  })

  if (!verdict.ok) {
    return {
      ok: false,
      rejection: {
        id: promo.id,
        name: promo.name,
        reason: verdict.reason,
        message: verdict.message,
        margin: verdict.costing.margin,
        netMargin: verdict.costing.netMargin,
        breakdown: verdict.breakdown,
      },
    }
  }

  const { costing } = verdict
  return {
    ok: true,
    promo: {
      ...promo,
      estimatedTotalCost: costing.totalCost,
      estimatedProfit: costing.profit,
      estimatedMargin: costing.margin,
      // Lo que de verdad queda despues del IVA, Recurrente y el ISR.
      estimatedNetProfit: costing.netProfit,
      estimatedNetMargin: costing.netMargin,
      fiscalSnapshot: costing.fiscal,
      costCoverage: costing.coverage,
      costedAt: costing.costedAt,
    },
  }
}

/** Quita la marca de "vencida" cuando la promo se guarda activa de nuevo. */
const clearStaleDeactivation = (promo) => {
  if (promo?.isActive && promo?.deactivatedReason) {
    const { deactivatedReason, ...rest } = promo
    return rest
  }
  return promo
}

export const updatePromotions = async (req, res) => {
  try {
    const promotions = req.body
    if (!Array.isArray(promotions)) {
      return res.status(400).json({ message: 'El formato de promociones debe ser un arreglo' })
    }

    const { ok, errors } = validatePromotionsPayload(promotions)
    if (!ok) {
      return res.status(400).json({ message: 'Las promociones no tienen una estructura valida', errors })
    }

    const cleaned = promotions.map(clearStaleDeactivation)

    // El costo lo calcula el servidor, no el navegador. Antes llegaban
    // estimatedTotalCost / estimatedProfit / estimatedMargin ya masticados
    // por el cliente y se guardaban sin verificar: nada impedia guardar una
    // promo a perdida, y ningun agente podia crear una costeada.
    const sanitized = []
    const rejected = []

    for (const promo of cleaned) {
      const result = await costAndStampPromotion(promo)
      if (result.ok) sanitized.push(result.promo)
      else rejected.push(result.rejection)
    }

    if (rejected.length > 0) {
      return res.status(400).json({
        message: 'Hay promociones que no cumplen el margen minimo',
        rejected,
        hint: 'Subi el precio, ajusta la composicion, o guarda con allowLowMargin: true si es intencional.',
      })
    }

    const updated = await Setting.findOneAndUpdate(
      { key: 'promotions' },
      { $set: { value: sanitized } },
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

/**
 * Guarda UNA promocion, sin tocar las demas.
 *
 * El guardado masivo (PATCH /promotions) reescribe la lista entera: para
 * cambiarle el precio a una promo hay que reenviar todas, y desde que el
 * servidor valida el margen, una promo vieja mal costeada puede bloquear el
 * guardado de una nueva. Aqui solo se cuesta y se valida la que se manda; el
 * resto de la lista se conserva tal como esta guardada.
 *
 * PUT /settings/promotions/:id  — crea si no existe, reemplaza si existe.
 */
export const upsertPromotion = async (req, res) => {
  try {
    const { id } = req.params
    const incoming = req.body

    if (!id) return res.status(400).json({ message: 'Falta el id de la promocion' })
    if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) {
      return res.status(400).json({ message: 'El cuerpo debe ser una promocion' })
    }

    const promo = clearStaleDeactivation({ ...incoming, id })

    const { ok: validShape, errors } = validatePromotionsPayload([promo])
    if (!validShape) {
      return res.status(400).json({ message: 'La promocion no tiene una estructura valida', errors })
    }

    const result = await costAndStampPromotion(promo)
    if (!result.ok) {
      return res.status(400).json({
        message: result.rejection.message,
        rejected: [result.rejection],
        hint: 'Subi el precio, ajusta la composicion, o guarda con allowLowMargin: true si es intencional.',
      })
    }

    const doc = await Setting.findOne({ key: 'promotions' })
    const current = Array.isArray(doc?.value) ? doc.value : []
    const idx = current.findIndex((p) => p?.id === id)
    const next = idx >= 0
      ? current.map((p, i) => (i === idx ? result.promo : p))
      : [...current, result.promo]

    const updated = await Setting.findOneAndUpdate(
      { key: 'promotions' },
      { $set: { value: next } },
      { new: true, upsert: true }
    )

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(idx >= 0 ? 200 : 201).json({ promotion: result.promo, promotions: updated.value })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo guardar la promocion', error: error.message })
  }
}

/** DELETE /settings/promotions/:id — quita una sola, sin revalidar las demas. */
export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ message: 'Falta el id de la promocion' })

    const doc = await Setting.findOne({ key: 'promotions' })
    const current = Array.isArray(doc?.value) ? doc.value : []
    const next = current.filter((p) => p?.id !== id)

    if (next.length === current.length) {
      return res.status(404).json({ message: 'Esa promocion ya no existe' })
    }

    const updated = await Setting.findOneAndUpdate(
      { key: 'promotions' },
      { $set: { value: next } },
      { new: true, upsert: true }
    )

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    return res.status(200).json({ promotions: updated.value })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo eliminar la promocion', error: error.message })
  }
}

/**
 * Costeo de una promocion sin guardarla.
 *
 * Es el mismo calculo que corre al guardar, expuesto aparte para que el
 * formulario muestre costo, utilidad y margen en vivo mientras se arma la
 * promo, y para que el agente pueda proponer un precio antes de crearla.
 * Una sola fuente de verdad: si aqui pasa, al guardar pasa.
 *
 * body: { plates[], price, packagingMode, sharedPackaging, minMarginPercent, allowLowMargin }
 */
export const costPromotionPreview = async (req, res) => {
  try {
    const { plates, price, packagingMode = 'porPlato', sharedPackaging, minMarginPercent, allowLowMargin, paymentMethod = 'tarjeta' } = req.body || {}

    if (!Array.isArray(plates) || plates.length === 0) {
      return res.status(400).json({ message: 'Se necesita al menos un plato para costear la promocion' })
    }

    // Empaque compartido sin lista: el servidor la propone. Asi el formulario
    // no tiene que adivinar cuantos vasitos van; solo muestra la propuesta y
    // deja ajustarla.
    let proposal = null
    let packaging = sharedPackaging || null
    if (packagingMode === 'compartido' && !packaging) {
      proposal = proposePackaging(plates, 'compartido')
      packaging = proposal.items
    }

    const verdict = await validatePromotionMargin(plates, {
      price,
      minMarginPercent,
      allowLowMargin: allowLowMargin === true,
      packagingMode,
      sharedPackaging: packaging,
      paymentMethod,
    })

    res.set('Cache-Control', 'no-store')

    return res.status(200).json({
      costing: verdict.costing,
      ok: verdict.ok,
      reason: verdict.reason || null,
      message: verdict.message || null,
      threshold: verdict.threshold ?? null,
      breakdown: verdict.breakdown ?? null,
      proposal,
    })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo costear la promocion', error: error.message })
  }
}

/**
 * Propuesta de empaque para un conjunto de platos, con el porque de cada
 * linea. No cuesta nada ni guarda nada: sirve para que el formulario (o el
 * agente) muestre "esto es lo que se necesita" antes de decidir.
 *
 * body: { plates[], mode }
 */
export const proposePromotionPackaging = async (req, res) => {
  try {
    const { plates, mode = 'compartido' } = req.body || {}

    if (!Array.isArray(plates) || plates.length === 0) {
      return res.status(400).json({ message: 'Se necesita al menos un plato para proponer el empaque' })
    }

    const { items, reasoning } = proposePackaging(plates, mode)
    const costing = await costPromotion(plates, { packagingMode: 'compartido', sharedPackaging: items })

    res.set('Cache-Control', 'no-store')

    return res.status(200).json({ mode, items, reasoning, packagingCost: costing.sharedPackaging })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo proponer el empaque', error: error.message })
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

    if (!clients || clients.length === 0) {
      return res.status(400).json({ message: 'No hay clientes registrados con teléfono.' });
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

export const getTaxConfig = async (req, res) => {
  try {
    const config = await getTaxConfigService()
    return res.status(200).json(config)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cargar la configuracion fiscal', error: error.message })
  }
}

export const updateTaxConfig = async (req, res) => {
  try {
    const updated = await updateTaxConfigService(req.body || {})
    return res.status(200).json(updated)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo guardar la configuracion fiscal', error: error.message })
  }
}


export const getDeliveryConfig = async (req, res) => {
  try {
    const config = await getDeliveryConfigService()
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return res.status(200).json(config)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cargar la configuracion de reparto', error: error.message })
  }
}

export const updateDeliveryConfig = async (req, res) => {
  try {
    const updated = await updateDeliveryConfigService(req.body || {})
    return res.status(200).json(updated)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo guardar la configuracion de reparto', error: error.message })
  }
}
