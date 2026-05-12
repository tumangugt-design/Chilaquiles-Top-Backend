import User from '../users/user.model.js';
import Order from '../orders/order.model.js';
import BotMemory from './botMemory.model.js';
import { getAICompletion, prepareBotContext } from './ai.service.js';
import { sendWhatsAppMessage } from './whatsapp.service.js';

export const processIncomingMessage = async (phone, messageText) => {
  try {
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

    // 4. Prepare AI Context
    const systemPrompt = prepareBotContext(user?.name, orderHistory);
    
    // Build message thread for AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...memory.lastMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: messageText }
    ];

    // 5. Get AI Response
    const aiResponse = await getAICompletion(messages);

    // 6. Update User Name if AI detected it (Optional but smart)
    // For now, let's just wait for the user to explicitly say "Me llamo X" 
    // or let the AI handle the flow.

    // 7. Save to Memory
    memory.lastMessages.push({ role: 'user', content: messageText });
    memory.lastMessages.push({ role: 'assistant', content: aiResponse });
    await memory.save();

    // 8. If the user mentioned their name and we don't have it, we could try to extract it.
    // However, the simplest is to let the bot ask and the user reply.
    // If we want to be more proactive, we can add logic to update the user model.
    // Let's check if the user exists. If not, we'll create a "Guest" user when we have the name.
    
    // 9. Send WhatsApp Message
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
