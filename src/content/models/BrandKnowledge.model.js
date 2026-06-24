import mongoose from 'mongoose';

const brandKnowledgeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'brand_rule',
      'copy_example',
      'visual_rule',
      'promotion_example',
      'tone_rule',
      'customer_objection',
      'product_info',
      'delivery_info',
      'faq',
      'telegram_learning'
    ],
    required: true
  },
  content: { type: String, required: true },
  tags: [{ type: String }],
  source: {
    type: String,
    enum: ['admin', 'telegram', 'system'],
    default: 'admin'
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const BrandKnowledge = mongoose.models.BrandKnowledge || mongoose.model('BrandKnowledge', brandKnowledgeSchema);
