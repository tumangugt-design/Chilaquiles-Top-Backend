// Migración NO destructiva: convierte las Campaign (envíos masivos de WhatsApp,
// pestaña antigua "Campañas") en registros ContentDraft (la "Pieza" unificada de
// Marketing), para que aparezcan en el historial único de Piezas junto con lo
// generado en Estudio de Contenido.
//
// - No borra ni modifica la colección Campaign original.
// - Es seguro volver a correrlo: cada Campaign migrada guarda su _id en
//   migratedFromCampaignId, y se salta si ya existe.
//
// Uso:  node scripts/migrate-legacy-campaigns-to-content.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { dbConnection } from '../configs/mongo.js';
import { Campaign } from '../src/settings/campaign.model.js';
import { ContentDraft } from '../src/content/models/ContentDraft.model.js';

const mapStatus = (campaignStatus) => {
  if (campaignStatus === 'COMPLETED') return 'published';
  if (campaignStatus === 'FAILED') return 'failed';
  return 'draft'; // PROCESSING (quedó a medias en su momento)
};

const mapWhatsappStatus = (campaignStatus) => {
  if (campaignStatus === 'COMPLETED') return 'sent';
  if (campaignStatus === 'FAILED') return 'failed';
  return 'processing';
};

async function run() {
  await dbConnection();
  console.log('Conectado a MongoDB. Buscando campañas legadas...');

  const campaigns = await Campaign.find({}).sort({ createdAt: 1 });
  console.log(`Encontradas ${campaigns.length} campañas.`);

  let migrated = 0;
  let skipped = 0;

  for (const c of campaigns) {
    const alreadyMigrated = await ContentDraft.findOne({ migratedFromCampaignId: String(c._id) });
    if (alreadyMigrated) {
      skipped++;
      continue;
    }

    const doc = new ContentDraft({
      title: `Envío WhatsApp — ${(c.description || c.promotionId || 'Promoción').slice(0, 60)}`,
      objective: 'promotion',
      source: 'admin',
      promotionId: c.promotionId && c.promotionId !== 'custom' ? c.promotionId : null,
      status: mapStatus(c.status),
      platforms: ['whatsapp'],
      formats: ['whatsapp_message'],
      copy: { whatsappText: c.description || '' },
      visual: { imageUrl: c.imageUrl || '' },
      whatsapp: {
        status: mapWhatsappStatus(c.status),
        message: c.description || '',
        totalTarget: c.totalTarget || 0,
        sentCount: c.sentCount || 0,
        failedCount: c.failedCount || 0,
        sentAt: c.status === 'COMPLETED' ? c.updatedAt : null
      },
      migratedFromCampaignId: String(c._id)
    });

    await doc.save();
    // Preservamos la fecha original de la campaña para que el historial quede ordenado correctamente.
    await ContentDraft.updateOne({ _id: doc._id }, { $set: { createdAt: c.createdAt, updatedAt: c.updatedAt } });

    migrated++;
  }

  console.log(`Listo. Migradas: ${migrated}. Ya existentes (omitidas): ${skipped}. Total revisadas: ${campaigns.length}.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
