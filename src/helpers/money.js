// ============================================================
// REDONDEO DE DINERO
//
// Dos redondeos distintos, y confundirlos cuesta plata:
//
//  - roundMoney: para cantidades que se COBRAN o se MUESTRAN. Dos decimales,
//    porque el quetzal no tiene mas.
//
//  - roundUnitCost: para costos POR UNIDAD DE CATALOGO — por gramo, por
//    mililitro, por pieza. Ahi dos decimales es el redondeo equivocado: el
//    quantum (Q0.005) es del mismo tamano que el valor. Un lote de 5 litros
//    de salsa que costo Q20 sale a Q0.004/ml y redondeado a centavos queda
//    en Q0.00: el producto pasa a ser gratis para siempre. En el rango
//    normal el error medido iba de +11% a +43%.
//
// Seis decimales cubren hasta una millonesima de quetzal por gramo, que es
// mas fino que cualquier insumo real, y el error deja de existir.
// ============================================================

export const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

export const roundUnitCost = (value) => Math.round(Number(value || 0) * 1e6) / 1e6;
