import mongoose from 'mongoose';

// ============================================================
// HISTORIAL DE CONVERSACIONES DEL BOT
//
// BotMemory guarda solo los ultimos 10 mensajes, porque es la ventana de
// contexto que se le pasa al modelo — no un archivo. Esto es el archivo: cada
// mensaje que entra y cada respuesta que sale, con su hora, su canal y la
// marca de seguridad si la tuvo.
//
// Para que existe: el dueno no tiene visibilidad de lo que el bot conversa con
// los clientes. No para responder — para eso esta el bot — sino para ver si
// alguien esta reportando algo, si el bot se traba, y quien esta tocando la
// puerta. Los datos ya pasaban por el servidor; solo no se guardaban.
// ============================================================

const mensajeSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  at: { type: Date, default: Date.now },
  // Marca del escaner de seguridad, cuando la hubo (ALLOW / SANITIZE / BLOCK).
  securityAction: { type: String, default: null },
  riskScore: { type: Number, default: null },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  // Para WhatsApp es el telefono normalizado; para Instagram, el IGSID.
  // Ojo: un contacto de Instagram NUNCA tiene telefono — asi es como Meta lo
  // entrega, no es una anomalia.
  contactId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['whatsapp', 'instagram'], required: true, index: true },

  displayName: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  messages: { type: [mensajeSchema], default: [] },

  lastMessageAt: { type: Date, default: Date.now, index: true },
  totalMessages: { type: Number, default: 0 },
  flaggedCount: { type: Number, default: 0 },
  isQuarantined: { type: Boolean, default: false },
}, { timestamps: true });

conversationSchema.index({ contactId: 1, platform: 1 }, { unique: true });

export default mongoose.model('BotConversation', conversationSchema);
