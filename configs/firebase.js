import admin from 'firebase-admin';

let firebaseEnabled = false;
let firebaseInitialized = false;

const getAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  return {
    projectId,
    clientEmail,
    privateKey,
    databaseURL,
    hasAdminCredentials: Boolean(projectId && clientEmail && privateKey)
  };
};

export const initFirebaseAdmin = () => {
  try {
    const { projectId, clientEmail, privateKey, databaseURL, hasAdminCredentials } = getAdminConfig();

    if (!hasAdminCredentials) {
      firebaseEnabled = false;
      firebaseInitialized = false;
      console.warn('Firebase Admin SDK credentials are missing');
      return null;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        }),
        ...(databaseURL ? { databaseURL } : {})
      });
    }

    firebaseEnabled = true;
    firebaseInitialized = true;
    return admin;
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
  return admin.apps.length ? admin : null;
};

export const getFirebaseAuth = () => {
  const app = getFirebaseAdmin();
  return app ? admin.auth() : null;
};

export const getFirebaseRealtimeDb = () => {
  const app = getFirebaseAdmin();
  return app && process.env.FIREBASE_DATABASE_URL ? admin.database() : null;
};

export const getFirebaseFirestore = () => {
  const app = getFirebaseAdmin();
  return app ? admin.firestore() : null;
};

export const isFirebaseEnabled = () => {
  if (!firebaseInitialized) {
    initFirebaseAdmin();
  }
  return firebaseEnabled && admin.apps.length > 0;
};

export default admin;
