import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let firebaseEnabled = false;
let firebaseInitialized = false;

const getAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'chilaquiles-top.appspot.com';

  return {
    projectId,
    clientEmail,
    privateKey,
    databaseURL,
    storageBucket
  };
};

export const initFirebaseAdmin = () => {
  try {
    const { projectId, clientEmail, privateKey, databaseURL, storageBucket } = getAdminConfig();

    if (getApps().length === 0) {
      if (projectId && clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          }),
          ...(databaseURL ? { databaseURL } : {}),
          storageBucket
        });
      } else {
        console.log('[Firebase] Inicializando con Application Default Credentials');
        initializeApp({
          ...(databaseURL ? { databaseURL } : {}),
          storageBucket
        });
      }
    }

    firebaseEnabled = true;
    firebaseInitialized = true;
    return getApps()[0];
  } catch (error) {
    firebaseEnabled = false;
    firebaseInitialized = false;
    console.error('Firebase Admin init error:', error?.message || error);
    return null;
  }
};

export const getFirebaseAdmin = () => {
  if (!firebaseInitialized) {
    initFirebaseAdmin();
  }
  return getApps().length > 0 ? getApps()[0] : null;
};

export const getFirebaseAuth = () => {
  return getFirebaseAdmin() ? getAuth() : null;
};

export const getFirebaseRealtimeDb = () => {
  return getFirebaseAdmin() && process.env.FIREBASE_DATABASE_URL ? getDatabase() : null;
};

export const getFirebaseFirestore = () => {
  return getFirebaseAdmin() ? getFirestore() : null;
};

export const getFirebaseStorage = () => {
  return getFirebaseAdmin() ? getStorage().bucket() : null;
};

export const isFirebaseEnabled = () => {
  if (!firebaseInitialized) {
    initFirebaseAdmin();
  }
  return firebaseEnabled && getApps().length > 0;
};

export default getApps;
