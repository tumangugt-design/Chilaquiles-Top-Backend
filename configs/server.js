import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { dbConnection } from './mongo.js';
import { initFirebaseAdmin } from './firebase.js';
import { seedAdminUser } from '../src/users/user.service.js';
import { seedInventory } from '../src/inventory/inventory.service.js';
import authRoutes from '../src/auth/auth.routes.js';
import userRoutes from '../src/users/user.routes.js';
import orderRoutes from '../src/orders/order.routes.js';
import inventoryRoutes from '../src/inventory/inventory.routes.js';

const middlewares = (app) => {
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(helmet());
  app.use(morgan('dev'));
};

const routes = (app) => {
  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, message: 'Chilaquiles Top API ready' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/inventory', inventoryRoutes);
};

const connectDependencies = async () => {
  await dbConnection();
  initFirebaseAdmin();
  await seedAdminUser();
  await seedInventory();
};

export const initServer = async () => {
  const app = express();
  const port = process.env.PORT || 5000;

  middlewares(app);
  await connectDependencies();
  routes(app);

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};
