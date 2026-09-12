import User from '../users/user.model.js';
import Order from '../orders/order.model.js';
import BotMemory from './botMemory.model.js';
import { isOperatingNow } from '../settings/settings.service.js';
import { getAICompletion, prepareBotContext } from './ai.service.js';
import { sendWhatsAppMessage } from './whatsapp.service.js';
import { sendInstagramMessage } from './instagram.service.js';
import { normalizePhone } from '../helpers/order.helper.js';
import { scanMessage, sanitizeForContext } from './security.service.js';
import BotConversation from './conversation.model.js';

/**
 * Archiva el intercambio para que el admin pueda verlo.
 *
 * Va aparte de BotMemory a proposito: esa es la ventana de contexto del modelo
 * (10 mensajes) y se recorta; esto es el historial. Nunca debe tumbar la
 * atencion al cliente, asi que cualquier error aqui solo se registra.
 */
const archivarIntercambio = async ({ contactId, platform, displayName, userId, entrante, saliente, securityAction, riskScore }) => {
  try {
    const nuevos = [];
    if (entrante) nuevos.push({ role: 'user', content: entrante, at: new Date(), securityAction, riskScore });
    if (saliente) nuevos.push({ role: 'assistant', content: saliente, at: new Date() });
    if (nuevos.length === 0) return;

    await BotConversation.findOneAndUpdate(
      { contactId, platform },
      {
        $push: { messages: { $each: nuevos, $slice: -500 } },
        $set: {
          lastMessageAt: new Date(),
          ...(displayName ? { displayName } : {}),
          ...(userId ? { userId } : {}),
        },
        $inc: {
          totalMessages: nuevos.length,
          flaggedCount: securityAction && securityAction !== 'ALLOW' ? 1 : 0,
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('[Conversaciones] No se pudo archivar el intercambio:', error.message);
  }
};

export const processIncomingMessage = async (rawPhone, messageText, platform = 'whatsapp') => {
  try {
    const phone = platform === 'whatsapp' ? normalizePhone(rawPhone) : rawPhone;

    // 1. Identify or Create User
    let user = await User.findOne({ phone: phone });
    
    // 2. Get Order History
    let orderHistory = [];
    if (user) {
      orderHistory = await Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5);
    }

    // 3. Get or Create Bot Memory
    let memory = await BotMemory.findOne({ phone: phone });
    if (!memory) {
      memory = new BotMemory({ phone: phone, lastMessages: [] });
    }

    // La cuarentena VENCE. Antes era permanente y no habia forma de revertirla
    // salvo editando Mongo a mano: tres mensajes marcados desde un telefono
    // dejaban a ese cliente sin atencion para siempre, en silencio. Con el
    // webhook de Instagram abierto, ademas, se podia usar contra un cliente
    // real haciendose pasar por el.
    const CUARENTENA_HORAS = 24;
    if (memory.securityFlags && memory.securityFlags.isQuarantined) {
      const desde = memory.securityFlags.lastFlagAt?.getTime() || 0;
      const vencida = Date.now() - desde > CUARENTENA_HORAS * 60 * 60 * 1000;
      if (vencida) {
        memory.securityFlags.isQuarantined = false;
        memory.securityFlags.totalFlags = 0;
        await memory.save();
        console.warn(`[Security] Cuarentena vencida para ${phone}: se reanuda la atencion.`);
      } else {
        console.warn(`[Security] ${phone} en cuarentena (vence ${CUARENTENA_HORAS}h despues del ultimo flag). Mensaje ignorado.`);
        return { success: true, ignored: true };
      }
    }

    // 4. Security Scan (PRE-AI)
    const securityResult = scanMessage(messageText, phone, platform);

    if (securityResult.action === 'RESET') {
      memory.lastMessages = [];
      await memory.save();
    } else if (securityResult.action === 'BLOCK') {
      memory.securityFlags.totalFlags += 1;
      memory.securityFlags.lastFlagAt = new Date();
      if (memory.securityFlags.totalFlags >= 3) {
         memory.securityFlags.isQuarantined = true;
      }
      await memory.save();
      const blockMessage = "Lo siento, no puedo procesar esa solicitud.";
      // Lo bloqueado es lo mas importante de poder ver despues.
      await archivarIntercambio({
        contactId: phone,
        platform,
        entrante: messageText,
        saliente: blockMessage,
        securityAction: 'BLOCK',
        riskScore: securityResult?.riskScore ?? null,
      });
      if (platform === 'instagram') await sendInstagramMessage(phone, blockMessage);
      else await sendWhatsAppMessage(phone, blockMessage);
      return { success: true, blocked: true };
    }

    // 5. Get Operating Hours
    const operatingHours = await isOperatingNow();

    // 6. Prepare Secure AI Context
    // Instead of sending raw user/assistant messages to the LLM (which risks role hijacking),
    // we generate a safe plain-text summary of the conversation history.
    const conversationSummary = sanitizeForContext(memory.lastMessages);
    
    let safeMessageText = messageText;
    if (securityResult.action === 'SANITIZE') {
       safeMessageText = "[MENSAJE DEL CLIENTE CON POSIBLE INYECCIÓN IGNORADA] " + messageText;
    }

    const systemPrompt = prepareBotContext(user?.name, orderHistory, operatingHours, conversationSummary);
    
    // Build message thread for AI. We ONLY send the system prompt and the current user message.
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: safeMessageText }
    ];

    // 7. Get AI Response
    let aiResponse = await getAICompletion(messages);

    // 8. Extraction of Name if provided by AI
    // Security check: Make sure the user didn't try to inject [SET_NAME] directly in their message
    const userInjectedName = messageText.match(/\[SET_NAME:/i);
    const nameMatch = aiResponse.match(/\[SET_NAME:\s*(.+?)\]/);
    
    if (nameMatch && !userInjectedName) {
      const extractedName = nameMatch[1].trim();
      await updateUserName(phone, extractedName);
      console.log(`Nombre actualizado para ${phone}: ${extractedName}`);
    }
    
    // Always clean the response from the tag before sending to the user
    aiResponse = aiResponse.replace(/\[SET_NAME:\s*.+?\]/gi, '').trim();

    // 9. Save to Memory
    memory.lastMessages.push({ role: 'user', content: safeMessageText });
    memory.lastMessages.push({ role: 'assistant', content: aiResponse });
    await memory.save();

    await archivarIntercambio({
      contactId: phone,
      platform,
      displayName: user?.name || '',
      userId: user?._id || null,
      entrante: messageText,
      saliente: aiResponse,
      securityAction: securityResult?.action || 'ALLOW',
      riskScore: securityResult?.riskScore ?? null,
    });
    
    // 10. Send Message
    if (platform === 'instagram') {
      await sendInstagramMessage(phone, aiResponse);
    } else {
      await sendWhatsAppMessage(phone, aiResponse);
    }

    return { success: true };
  } catch (error) {
    console.error('Error in Bot Service:', error);
    throw error;
  }
};

export const updateUserName = async (phone, name) => {
  let user = await User.findOne({ phone: phone });
  if (user) {
    user.name = name;
    await user.save();
  } else {
    user = new User({
      phone: phone,
      name: name,
      authProvider: 'GUEST',
      role: 'CLIENT',
      status: 'approved'
    });
    await user.save();
  }
  return user;
};
