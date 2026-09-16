import Inventory from './inventory.model.js'
import InventoryLog from './inventoryLog.model.js'
import Portion from './portion.model.js'
import Purchase from '../purchases/purchase.model.js'
import PurchaseAllocation from '../purchases/purchase-allocation.model.js'
import { convertAmountToCatalogUnit, consumeFifoBatches } from './inventory.service.js'
import { canonicalUnit, assertKnownUnit } from '../helpers/units.js'
import { roundMoney, roundUnitCost } from '../helpers/money.js'
import { INVENTORY_CATALOG_MAP } from '../helpers/constants.js'

// ============================================================
// RECTIFICACION DE INVENTARIO
// ============================================================
//
// Una rectificacion NO es una compra. No registra gasto del mes: declara lo
// que hay. Sirve para el corte de arranque y despues para el dia a dia — se
// cayo una olla, se echo a perder algo, el conteo no cuadra.
//
// Por que existe esto y no basta el boton de stock de la app:
//
//   Inventory.stock            -> cuanto hay. Es lo que la app usa para vender.
//   PurchaseAllocation         -> cuanto queda por costear y a que costo (FIFO).
//
// `/:name/stock` y `/:name/direct-stock` mueven SOLO el primero. Los lotes
// quedan intactos, asi que despues de un conteo la venta sale bien pero el
// costo de cada plato se sigue sacando de lotes que ya no corresponden. Esto
// mueve las dos capas juntas.
//
// Asimetria deliberada entre subir y bajar:
//
//   ALTA (hacia arriba)  El valor no existe todavia: hay que crearlo. Exige
//                        costo unitario. Sin el, el producto sale gratis y
//                        todo margen que lo toque miente.
//   BAJA (hacia abajo)   El valor ya existe en los lotes: NO se inventa, se
//                        consume FIFO. Se registra como MERMA, no como OUT,
//                        para que la perdida no se confunda con venta.
// ============================================================

const normalizar = (valor = '') => String(valor || '').trim().toLowerCase()

const MODOS = new Set(['CORTE', 'AJUSTE'])

const errorPeticion = (mensaje) => {
  const error = new Error(mensaje)
  error.statusCode = 400
  return error
}

// Resuelve el item de Inventario y su unidad de catalogo. No crea nada: el
// plan se arma antes de escribir, y en dry-run no debe quedar rastro.
const resolverItem = async (nombre) => {
  const name = normalizar(nombre)
  if (!name) throw errorPeticion('Cada item necesita un nombre.')

  const enBase = await Inventory.findOne({ name })
  const enCatalogo = INVENTORY_CATALOG_MAP[name]

  if (!enBase && !enCatalogo) {
    throw errorPeticion(`"${nombre}" no existe en inventario ni en el catalogo. Crealo primero en Stock.`)
  }

  return {
    name,
    doc: enBase || null,
    unidadCatalogo: enBase?.unit || enCatalogo?.unit || 'und',
    categoria: enBase?.category || enCatalogo?.category || 'Otros',
    stockActual: Number(enBase?.stock || 0)
  }
}

// Cuanto vale hoy una unidad de este producto segun los lotes vivos. Se usa
// solo para ESTIMAR el valor de una baja en el dry-run; la baja real toma el
// costo del FIFO al ejecutarse.
const costoUnitarioVigente = async (name) => {
  const lote = await PurchaseAllocation.findOne({ stockItemName: name, remainingQuantity: { $gt: 0 } })
    .sort({ allocationDate: 1, createdAt: 1 })
    .select('costPerProducedUnit')
    .lean()
  return lote ? Number(lote.costPerProducedUnit || 0) : null
}

// ------------------------------------------------------------
// PLAN
// ------------------------------------------------------------
// Dry-run y ejecucion usan EXACTAMENTE esta misma funcion. Si el plan se
// calculara dos veces por caminos distintos, lo que aprobo el usuario y lo
// que se escribe podrian no ser lo mismo.
const armarPlan = async ({ modo, items = [] }) => {
  const declarados = new Map()

  for (const bruto of items) {
    const item = await resolverItem(bruto?.nombre)
    if (declarados.has(item.name)) {
      throw errorPeticion(`"${item.name}" viene repetido en la lista.`)
    }

    const cantidadCruda = Number(bruto?.cantidad)
    if (Number.isNaN(cantidadCruda) || cantidadCruda < 0) {
      throw errorPeticion(`Cantidad invalida para "${item.name}". Tiene que ser un numero mayor o igual a cero.`)
    }

    const unidadEntrada = canonicalUnit(bruto?.unidad || item.unidadCatalogo)
    assertKnownUnit(unidadEntrada, `unidad de "${item.name}"`)

    // convertAmountToCatalogUnit revienta con cero — y cero es una cantidad
    // perfectamente valida aca (declarar que no queda nada).
    const cantidadFinal = cantidadCruda > 0
      ? convertAmountToCatalogUnit(cantidadCruda, unidadEntrada, item.unidadCatalogo)
      : 0

    // El costo se declara por unidad de ENTRADA (lo natural: "la libra me
    // costo Q15"), y se convierte a la unidad de catalogo dividiendo por el
    // factor que ya aplicamos a la cantidad.
    const costoUnitarioEntrada = bruto?.costoUnitario === undefined || bruto?.costoUnitario === null || bruto?.costoUnitario === ''
      ? null
      : Number(bruto.costoUnitario)

    if (costoUnitarioEntrada !== null && (Number.isNaN(costoUnitarioEntrada) || costoUnitarioEntrada < 0)) {
      throw errorPeticion(`Costo unitario invalido para "${item.name}".`)
    }

    const factor = cantidadFinal > 0 && cantidadCruda > 0 ? cantidadFinal / cantidadCruda : 1
    const costoPorUnidadCatalogo = costoUnitarioEntrada === null
      ? null
      : roundUnitCost(costoUnitarioEntrada / factor)

    declarados.set(item.name, {
      ...item,
      cantidadDeclarada: cantidadFinal,
      entrada: { cantidad: cantidadCruda, unidad: unidadEntrada, costoUnitario: costoUnitarioEntrada },
      costoPorUnidadCatalogo
    })
  }

  // En CORTE entra TODO el inventario, no solo lo declarado: lo que no se
  // menciona se declara en cero. Es lo que hace que sea un corte y no un
  // ajuste parcial.
  if (modo === 'CORTE') {
    const todos = await Inventory.find({}).select('name unit category stock').lean()
    for (const inv of todos) {
      if (declarados.has(inv.name)) continue
      declarados.set(inv.name, {
        name: inv.name,
        doc: inv,
        unidadCatalogo: inv.unit || 'und',
        categoria: inv.category || 'Otros',
        stockActual: Number(inv.stock || 0),
        cantidadDeclarada: 0,
        entrada: { cantidad: 0, unidad: inv.unit || 'und', costoUnitario: null },
        costoPorUnidadCatalogo: null
      })
    }
  }

  const lineas = []
  const advertencias = []

  for (const item of declarados.values()) {
    // En CORTE el stock previo se borra entero, asi que la alta es la
    // cantidad declarada completa. En AJUSTE solo se mueve la diferencia.
    const delta = modo === 'CORTE'
      ? item.cantidadDeclarada
      : roundMoney(item.cantidadDeclarada - item.stockActual)

    let accion = 'SIN_CAMBIO'
    if (delta > 0) accion = 'ALTA'
    else if (delta < 0) accion = 'BAJA'

    let valor = null
    if (accion === 'ALTA') {
      if (item.costoPorUnidadCatalogo === null) {
        advertencias.push(`"${item.name}": subis ${Math.abs(delta)} ${item.unidadCatalogo} sin costo unitario. Va a entrar a Q0.00 y todo plato que lo use va a reportar margen inflado.`)
      }
      valor = roundMoney(Math.abs(delta) * Number(item.costoPorUnidadCatalogo || 0))
    } else if (accion === 'BAJA') {
      const vigente = await costoUnitarioVigente(item.name)
      if (vigente === null) {
        advertencias.push(`"${item.name}": baja de ${Math.abs(delta)} ${item.unidadCatalogo} pero no hay lotes vivos de donde sacar el costo. La merma se registra en cantidad, con costo Q0.00.`)
        valor = 0
      } else {
        valor = roundMoney(Math.abs(delta) * vigente)
      }
    }

    lineas.push({
      producto: item.name,
      categoria: item.categoria,
      unidad: item.unidadCatalogo,
      stockActual: roundMoney(item.stockActual),
      stockDeclarado: roundMoney(item.cantidadDeclarada),
      accion,
      delta: roundMoney(delta),
      costoUnitario: item.costoPorUnidadCatalogo,
      valorEstimado: valor,
      declaradoComo: item.entrada
    })
  }

  lineas.sort((a, b) => a.producto.localeCompare(b.producto))

  const valorAlta = roundMoney(lineas.filter((l) => l.accion === 'ALTA').reduce((s, l) => s + Number(l.valorEstimado || 0), 0))
  const valorBaja = roundMoney(lineas.filter((l) => l.accion === 'BAJA').reduce((s, l) => s + Number(l.valorEstimado || 0), 0))

  return {
    lineas,
    advertencias,
    resumen: {
      productos: lineas.length,
      altas: lineas.filter((l) => l.accion === 'ALTA').length,
      bajas: lineas.filter((l) => l.accion === 'BAJA').length,
      sinCambio: lineas.filter((l) => l.accion === 'SIN_CAMBIO').length,
      valorQueEntra: valorAlta,
      valorQueSale: valorBaja,
      valorInventarioResultante: valorAlta
    }
  }
}

// Respaldo de lo que el CORTE va a borrar. Se devuelve en el dry-run para
// poder guardarlo fuera de la base antes de ejecutar.
const fotografiarEstado = async () => {
  const [inventario, compras, lotes, logs] = await Promise.all([
    Inventory.find({}).lean(),
    Purchase.find({}).lean(),
    PurchaseAllocation.find({}).lean(),
    InventoryLog.find({}).sort({ createdAt: -1 }).limit(2000).lean()
  ])
  return {
    tomadaEn: new Date().toISOString(),
    conteos: {
      inventario: inventario.length,
      compras: compras.length,
      lotes: lotes.length,
      logs: logs.length
    },
    inventario,
    compras,
    lotes,
    logs
  }
}

// ------------------------------------------------------------
// EJECUCION
// ------------------------------------------------------------
const crearLoteRectificacion = async ({ item, cantidad, costoUnitario, motivo }) => {
  const costo = Number(costoUnitario || 0)
  const inheritedCost = roundMoney(cantidad * costo)

  return PurchaseAllocation.create({
    rawInputs: [],
    origin: 'RECTIFICACION',
    stockItemName: item.producto,
    producedQuantity: cantidad,
    producedUnit: item.unidad,
    remainingQuantity: cantidad,
    isDepleted: false,
    inheritedCost,
    costPerProducedUnit: roundUnitCost(costo),
    processNames: [],
    recipeName: `Rectificacion: ${motivo}`.slice(0, 200)
  })
}

export const rectificarInventario = async ({
  modo = 'AJUSTE',
  motivo = '',
  items = [],
  dryRun = true,
  confirmarBorrado = false,
  actor = null
} = {}) => {
  const modoNormalizado = String(modo || '').trim().toUpperCase()
  if (!MODOS.has(modoNormalizado)) {
    throw errorPeticion(`Modo invalido: "${modo}". Usa CORTE o AJUSTE.`)
  }

  const motivoLimpio = String(motivo || '').trim()
  if (!motivoLimpio) {
    throw errorPeticion('El motivo es obligatorio. Es lo unico que explica el movimiento dentro de seis meses.')
  }

  if (!Array.isArray(items) || (modoNormalizado === 'AJUSTE' && items.length === 0)) {
    throw errorPeticion('Mandá al menos un item.')
  }

  const plan = await armarPlan({ modo: modoNormalizado, items })

  if (dryRun) {
    return {
      dryRun: true,
      modo: modoNormalizado,
      motivo: motivoLimpio,
      ...plan,
      ...(modoNormalizado === 'CORTE' ? { respaldo: await fotografiarEstado() } : {}),
      siguientePaso: modoNormalizado === 'CORTE'
        ? 'Guardá el respaldo fuera de la base. Para ejecutar: dryRun:false y confirmarBorrado:true.'
        : 'Para ejecutar: dryRun:false.'
    }
  }

  // Segundo candado: borrar historial no puede pasar por descuido.
  if (modoNormalizado === 'CORTE' && confirmarBorrado !== true) {
    throw errorPeticion('CORTE borra compras, lotes y logs. Mandá confirmarBorrado:true para autorizarlo.')
  }

  const ejecutado = { borrado: null, altas: [], bajas: [], sinCambio: 0 }

  if (modoNormalizado === 'CORTE') {
    const [compras, lotes, logs] = await Promise.all([
      Purchase.deleteMany({}),
      PurchaseAllocation.deleteMany({}),
      InventoryLog.deleteMany({})
    ])
    ejecutado.borrado = {
      compras: compras.deletedCount,
      lotes: lotes.deletedCount,
      logs: logs.deletedCount
    }
  }

  for (const linea of plan.lineas) {
    if (linea.accion === 'SIN_CAMBIO' && modoNormalizado === 'AJUSTE') {
      ejecutado.sinCambio += 1
      continue
    }

    const stockPrevio = modoNormalizado === 'CORTE' ? 0 : linea.stockActual
    const stockFinal = linea.stockDeclarado

    if (linea.accion === 'ALTA' && linea.delta > 0) {
      await crearLoteRectificacion({
        item: linea,
        cantidad: linea.delta,
        costoUnitario: linea.costoUnitario,
        motivo: motivoLimpio
      })
      ejecutado.altas.push({ producto: linea.producto, cantidad: linea.delta, valor: linea.valorEstimado })
    }

    if (linea.accion === 'BAJA' && linea.delta < 0) {
      // El costo lo pone el FIFO, no nosotros. Si no hay lotes devuelve null
      // y la merma queda registrada en cantidad sin costo — ya se advirtio
      // en el plan.
      const consumo = await consumeFifoBatches(linea.producto, Math.abs(linea.delta), linea.unidad)
      ejecutado.bajas.push({
        producto: linea.producto,
        cantidad: Math.abs(linea.delta),
        costoReal: consumo?.totalCost ?? null
      })
    }

    const item = await Inventory.findOneAndUpdate(
      { name: linea.producto },
      { $set: { stock: stockFinal } },
      { new: true, upsert: false }
    )
    if (!item) continue

    // Portion tiene que existir para que el descuento por pedido encuentre la
    // porcion del producto. En un CORTE que borro todo, si falta, se crea.
    const tienePorcion = await Portion.exists({ name: linea.producto })
    if (!tienePorcion) {
      await Portion.create({
        name: linea.producto,
        usedPerPlate: INVENTORY_CATALOG_MAP[linea.producto]?.usedPerPlate || 1,
        unit: linea.unidad,
        price: 0
      })
    }

    if (stockPrevio !== stockFinal || linea.accion !== 'SIN_CAMBIO') {
      await InventoryLog.create({
        ingredient: item._id,
        ingredientName: item.name,
        // MERMA para bajas, IN para altas, ADJUSTMENT para el resto.
        type: linea.accion === 'BAJA' ? 'MERMA' : (linea.accion === 'ALTA' ? 'IN' : 'ADJUSTMENT'),
        amount: Math.abs(linea.delta),
        previousStock: stockPrevio,
        newStock: stockFinal,
        totalPrice: linea.valorEstimado,
        unitPrice: linea.costoUnitario,
        userId: actor?._id,
        userName: actor?.name,
        reason: `[RECTIFICACION ${modoNormalizado}] ${motivoLimpio}`
      })
    }
  }

  return {
    dryRun: false,
    modo: modoNormalizado,
    motivo: motivoLimpio,
    ejecutado,
    resumen: plan.resumen,
    advertencias: plan.advertencias
  }
}
