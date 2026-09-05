import * as financeService from './finances.service.js'
import { confirmOrderPaymentByCheckout } from '../orders/order.service.js'

export const getSummary = async (req, res) => {
  try {
    const summary = await financeService.getFinancialSummary()
    res.status(200).json({ success: true, data: summary })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}



export const handleRecurrenteWebhook = async (req, res) => {
  const payload = req.body || {}
  const eventType = payload.event_type || payload.type

  if (eventType !== 'intent.succeeded') {
    return res.status(200).json({ received: true, ignored: true })
  }

  try {
    const checkoutId = payload.checkout?.id || payload.checkout?.latest_intent?.id || null
    const successUrl = payload.checkout?.success_url || null

    await confirmOrderPaymentByCheckout({ checkoutId, successUrl })

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('[Recurrente Webhook] Error processing webhook:', error.message)
    return res.status(500).json({ received: false, error: error.message })
  }
}
