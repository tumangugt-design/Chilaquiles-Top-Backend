'use strict';

import mongoose from 'mongoose';

let listenersAttached = false;

export const dbConnection = async () => {
  try {
    if (!listenersAttached) {
      mongoose.connection.on('error', (error) => {
        console.log('MongoDB | Connection error:', error?.message || error);
      });
      mongoose.connection.on('connecting', () => {
        console.log('MongoDB | Try connecting');
      });
      mongoose.connection.on('connected', () => {
        console.log('MongoDB | Connected to MongoDB');
      });
      mongoose.connection.on('open', () => {
        console.log('MongoDB | Connected to Database');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB | Reconnected to MongoDB');
      });
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB | Disconnected');
      });
      listenersAttached = true;
    }

    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 50,
    });

    return mongoose.connection;
  } catch (error) {
    console.log('Database connection failed:', error?.message || error);
    throw error;
  }
};
