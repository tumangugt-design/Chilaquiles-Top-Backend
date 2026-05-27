import SecurityLog from './securityLog.model.js';

export const scanMessage = (text, phone, platform) => {
  const normalizedText = text.toLowerCase();
  let riskScore = 0;
  const patterns = [];

  // 1. Prompt Injection Patterns
  const injectionKeywords = [
    'ignora', 'olvida', 'instrucciones anteriores', 'actúa como', 'eres ahora', 
    'nuevo sistema', 'nueva regla', 'nuevo comportamiento', 'bypass', 'system prompt',
    'developer mode', 'modo desarrollador', 'override'
  ];
  
  for (const keyword of injectionKeywords) {
    if (normalizedText.includes(keyword)) {
      riskScore += 40;
      patterns.push(`Injection keyword: ${keyword}`);
    }
  }

  // 2. Role Hijacking Patterns
  const roleKeywords = [
    '[instrucción', 'role: system', 'role: assistant', 'system:', 'assistant:', 
    '[set_name:', 'regla:', 'reglas:'
  ];

  for (const keyword of roleKeywords) {
    if (normalizedText.includes(keyword)) {
      riskScore += 50;
      patterns.push(`Role hijacking keyword: ${keyword}`);
    }
  }

  // 3. Phishing / Fake URLs (Only allow chilaquilestop.com and whatsapp/ig links)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    if (!url.includes('chilaquilestop.com') && !url.includes('wa.me') && !url.includes('instagram.com')) {
      riskScore += 60;
      patterns.push(`Untrusted URL: ${url}`);
    }
  }

  // Action decision
  let action = 'ALLOW';
  if (riskScore >= 80) {
    action = 'BLOCK';
  } else if (riskScore >= 40) {
    action = 'SANITIZE';
  }

  // Log if suspicious
  if (riskScore > 0) {
    logSecurityEvent(phone, platform, patterns, riskScore, text, action);
  }

  return { isSuspicious: riskScore > 0, riskScore, patterns, action };
};

export const sanitizeForContext = (lastMessages) => {
  if (!lastMessages || lastMessages.length === 0) return "No hay conversación previa.";

  // Format the context securely to avoid role injection
  let safeContext = "Resumen de la conversación reciente:\n";
  lastMessages.forEach(msg => {
    const roleName = msg.role === 'user' ? 'Cliente' : 'Bot';
    // Remove any potential injection characters from the content
    const safeContent = msg.content.replace(/\[|\]/g, '(').replace(/\n/g, ' ');
    safeContext += `- ${roleName}: ${safeContent}\n`;
  });

  return safeContext;
};

const logSecurityEvent = async (phone, platform, patterns, riskScore, messageText, action) => {
  try {
    const truncatedMessage = messageText.length > 500 ? messageText.substring(0, 500) + '...' : messageText;
    await SecurityLog.create({
      phone,
      platform,
      patterns,
      riskScore,
      originalMessage: truncatedMessage,
      action
    });
    console.log(`[Security] Logged event for ${phone}: Score ${riskScore}, Action: ${action}`);
  } catch (error) {
    console.error('[Security] Failed to log security event:', error);
  }
};
