import User from '../users/user.model.js';
import Order from '../orders/order.model.js';
import BotMemory from './botMemory.model.js';
import { getOperatingHoursSetting } from '../settings/settings.service.js';
import { getAICompletion, prepareBotContext } from './ai.service.js';
import { sendWhatsAppMessage } from './whatsapp.service.js';
import { normalizePhone } from '../helpers/order.helper.js';

export const processIncomingMessage = async (rawPhone, messageText) => {
  try {
    const phone = normalizePhone(rawPhone);

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

    // 4. Get Operating Hours
    const operatingHours = await getOperatingHoursSetting();

    // 5. Prepare AI Context
    const systemPrompt = prepareBotContext(user?.name, orderHistory, operatingHours);
    
    // Build message thread for AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...memory.lastMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: messageText }
    ];

    // 5. Get AI Response
    let aiResponse = await getAICompletion(messages);

    // 6. Extraction of Name if provided by AI
    const nameMatch = aiResponse.match(/\[SET_NAME:\s*(.+?)\]/);
    if (nameMatch) {
      const extractedName = nameMatch[1].trim();
      await updateUserName(phone, extractedName);
      // Clean the response from the tag
      aiResponse = aiResponse.replace(/\[SET_NAME:\s*.+?\]/, '').trim();
      console.log(`Nombre actualizado para ${phone}: ${extractedName}`);
    }

    // 7. Save to Memory
    memory.lastMessages.push({ role: 'user', content: messageText });
    memory.lastMessages.push({ role: 'assistant', content: aiResponse });
    await memory.save();
    
    // 8. Send WhatsApp Message
    await sendWhatsAppMessage(phone, aiResponse);

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
