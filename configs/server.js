import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { dbConnection } from './mongo.js';
import { seedAdminUser } from '../src/users/user.service.js';
import { seedInventory } from '../src/inventory/inventory.service.js';
import { seedSettings } from '../src/settings/settings.service.js';
import authRoutes from '../src/auth/auth.routes.js';
import userRoutes from '../src/users/user.routes.js';
import orderRoutes from '../src/orders/order.routes.js';
import inventoryRoutes from '../src/inventory/inventory.routes.js';
import supplierRoutes from '../src/suppliers/supplier.routes.js';
import purchaseRoutes from '../src/purchases/purchase.routes.js';
import settingsRoutes from '../src/settings/settings.routes.js';
import botRoutes from '../src/bot/bot.routes.js';
import financeRoutes from '../src/finances/finances.routes.js';
import contentRoutes from '../src/content/routes/content.routes.js';
import canvaRoutes from '../src/content/routes/canva.routes.js';

const middlewares = (app) => {
  app.use(cors());
  app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(helmet());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
};

const routes = (app) => {
  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, message: 'Chilaquiles Top API ready' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/bot', botRoutes);
  app.use('/api/finances', financeRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/canva', canvaRoutes);

  // Manejador de error global. Sin esto, Express 5 responde con el stack trace
  // completo cuando NODE_ENV no es 'production': se filtran rutas del
  // contenedor y estructura interna. El detalle va al log, no al cliente.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.statusCode || err.status || 500;
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(status).json({
      message: status >= 500 ? 'Ocurrió un error en el servidor.' : err.message
    });
  });
};

// Ningun seed puede tumbar el arranque. Normalizar datos no es requisito para
// servir trafico: si un seed falla se registra y el servidor levanta igual.
// Antes solo seedInventory estaba protegido; con dos instancias arrancando a la
// vez en Cloud Run, seedSettings podia chocar con un E11000 (la llave de
// Setting es unica) y tumbar las dos — y nadie recibia pedidos.
const seedSeguro = async (nombre, fn) => {
  try {
    await fn();
  } catch (seedError) {
    console.error(`[${nombre}] Falló y se continuó sin él:`, seedError);
  }
};

const connectDependencies = async () => {
  // La base SI es requisito: sin ella no hay nada que servir.
  await dbConnection();
  await seedSeguro('seedAdminUser', seedAdminUser);
  await seedSeguro('seedInventory', seedInventory);
  await seedSeguro('seedSettings', seedSettings);
};

export const initServer = async () => {
  const app = express();
  const port = process.env.PORT || 5000;

  middlewares(app);

  // El puerto se abre ANTES de conectar dependencias: asi /health responde
  // aunque Mongo tarde, y Cloud Run no mata el contenedor por startup timeout.
  routes(app);
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  await connectDependencies();
};
