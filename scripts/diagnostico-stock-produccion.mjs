// Diagnostico de SOLO LECTURA - no escribe nada en la base de datos.
//
// Por cada producto que tiene lotes de producción (PurchaseAllocation),
// compara cuanto se ha producido históricamente contra el stock actual en
// Inventory. Sirve para detectar el hueco que dejaban los lotes producidos
// ANTES del fix de createProductionBatch (que ahora sí acredita stock
// automáticamente): esos lotes viejos costearon y consumieron materia
// prima, pero nunca sumaron su producedQuantity al stock vendible.
//
// Uso: node scripts/diagnostico-stock-produccion.mjs
// Requiere MONGODB_URI disponible en el entorno (mismo que usa el server).
import mongoose from 'mongoose';
import 'dotenv/config';

const PurchaseAllocation = mongoose.model('PurchaseAllocation', new mongoose.Schema({}, { strict: false, timestamps: true }));
const Inventory = mongoose.model('Inventory', new mongoose.Schema({}, { strict: false, timestamps: true }));

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no está definido en el entorno. Este script no modifica nada, solo necesita poder leer.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const agg = await PurchaseAllocation.aggregate([
    { $group: {
        _id: '$stockItemName',
        totalProduced: { $sum: '$producedQuantity' },
        unit: { $first: '$producedUnit' },
        batches: { $sum: 1 },
        first: { $min: '$allocationDate' },
        last: { $max: '$allocationDate' }
    } },
    { $sort: { _id: 1 } }
  ]);

  console.log(`Productos con lotes de producción registrados: ${agg.length}\n`);

  for (const row of agg) {
    const inv = await Inventory.findOne({ name: row._id }).lean();
    console.log(`- ${row._id}: ${row.batches} lote(s), total producido histórico = ${row.totalProduced} ${row.unit} (primero: ${row.first?.toISOString().slice(0, 10)}, último: ${row.last?.toISOString().slice(0, 10)})`);
    console.log(inv ? `    Inventory.stock actual = ${inv.stock} ${inv.unit}` : '    Inventory: NO EXISTE ese item todavía');
  }

  console.log('\nEste script no corrige nada automáticamente: si un producto tiene lotes viejos (antes del fix) que nunca se reflejaron en Stock, decide manualmente cuánto sumar (ej. vía un ajuste de stock con motivo "corrección histórica: lote de producción pre-fix").');

  await mongoose.disconnect();
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
