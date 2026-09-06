import { Router } from 'express';
import { 
  getInventoryItems, 
  saveInventoryItem, 
  deleteInventoryItem, 
  renameInventoryItem,
  updateInventoryItemDetails,
  adjustInventoryStock, 
  previewRecipeConsumption, 
  getInventoryLogs, 
  getAvailablePlates, 
  getPublicInventoryOptions, 
  toggleInventoryItemStatus, 
  syncInventory, 
  updateInventoryItemStock,
  getLastPurchases,
  getPortions,
  updatePortion,
  createPackagingProduct,
  getIngredientCostHistory
} from './inventory.controller.js';
import {
  getTransformationProcesses,
  saveTransformationProcess,
  getRecipes,
  saveRecipe,
  deleteRecipe,
  seedCatalog,
  getMermaSummary,
  deletePortion
} from './transformation.controller.js';
import { verifyAuthToken } from '../middlewares/auth.middleware.js';
import { requireApprovedStatus, requireRole } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../helpers/constants.js';

const router = Router();

router.get('/available', getAvailablePlates);
router.get('/public-options', getPublicInventoryOptions);

router.use(verifyAuthToken, requireApprovedStatus);
router.get('/', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), getInventoryItems);
router.get('/logs', requireRole([USER_ROLES.ADMIN]), getInventoryLogs);

// --- Jerarquia: procesos de transformacion y recetas ---
// Todo producto terminado nace de un proceso (donde se mide la merma) y/o de
// una receta (configuracion de transformacion guardada).
router.get('/processes', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), getTransformationProcesses);
router.post('/processes', requireRole([USER_ROLES.ADMIN]), saveTransformationProcess);
router.get('/recipes', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), getRecipes);
router.post('/recipes', requireRole([USER_ROLES.ADMIN]), saveRecipe);
router.put('/recipes/:id', requireRole([USER_ROLES.ADMIN]), saveRecipe);
router.delete('/recipes/:id', requireRole([USER_ROLES.ADMIN]), deleteRecipe);
router.get('/merma-summary', requireRole([USER_ROLES.ADMIN]), getMermaSummary);
router.post('/catalog/seed', requireRole([USER_ROLES.ADMIN]), seedCatalog);
router.get('/last-purchases', requireRole([USER_ROLES.ADMIN]), getLastPurchases);
router.get('/:name/cost-history', requireRole([USER_ROLES.ADMIN]), getIngredientCostHistory);
router.get('/portions', requireRole([USER_ROLES.ADMIN]), getPortions);
router.put('/portions/:name', requireRole([USER_ROLES.ADMIN]), updatePortion);
router.delete('/portions/:name', requireRole([USER_ROLES.ADMIN]), deletePortion);
router.post('/packaging', requireRole([USER_ROLES.ADMIN]), createPackagingProduct);
router.post('/', requireRole([USER_ROLES.ADMIN]), saveInventoryItem);
router.post('/sync', requireRole([USER_ROLES.ADMIN]), syncInventory);
router.delete('/:name', requireRole([USER_ROLES.ADMIN]), deleteInventoryItem);
router.patch('/:name/details', requireRole([USER_ROLES.ADMIN]), updateInventoryItemDetails);
router.patch('/:name/rename', requireRole([USER_ROLES.ADMIN]), renameInventoryItem);
router.patch('/:name/stock', requireRole([USER_ROLES.ADMIN]), adjustInventoryStock);
router.patch('/:name/direct-stock', requireRole([USER_ROLES.ADMIN]), updateInventoryItemStock);
router.patch('/:name/toggle-status', requireRole([USER_ROLES.ADMIN]), toggleInventoryItemStatus);
router.post('/preview-consumption', requireRole([USER_ROLES.ADMIN, USER_ROLES.CHEF]), previewRecipeConsumption);

export default router;
