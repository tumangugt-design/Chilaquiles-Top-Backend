const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
require('./config/firebase'); // Init Firebase Admin
const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// API Routes
app.use('/api', routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
