import admin from 'firebase-admin';

let firebaseEnabled = false;
let firebaseInitialized = false;

const getAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  return {
    projectId,
    clientEmail,
    privateKey,
    databaseURL,
    storageBucket,
    hasAdminCredentials: Boolean(projectId && clientEmail && privateKey)
  };
};

export const initFirebaseAdmin = () => {
  try {
    const adminObj = admin.default || admin;
    const { projectId, clientEmail, privateKey, databaseURL } = getAdminConfig();
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'chilaquiles-top.appspot.com';

    if (!adminObj.apps || !adminObj.apps.length) {
      if (projectId && clientEmail && privateKey) {
        adminObj.initializeApp({
          credential: adminObj.credential.cert({
            projectId,
            clientEmail,
            privateKey
          }),
          ...(databaseURL ? { databaseURL } : {}),
          storageBucket
        });
      } else {
        console.log('[Firebase] Inicializando con Application Default Credentials');
        adminObj.initializeApp({
          ...(databaseURL ? { databaseURL } : {}),
          storageBucket
        });
      }
    }

    firebaseEnabled = true;
    firebaseInitialized = true;
    return adminObj;
  } catch (error) {
    firebaseEnabled = false;
    firebaseInitialized = false;
    console.error('Firebase Admin init error:', error?.message || error);
    return null;
  }
};

export const getFirebaseAdmin = () => {
  const adminObj = admin.default || admin;
  if (!firebaseInitialized) {
    initFirebaseAdmin();
  }
  return adminObj.apps && adminObj.apps.length ? adminObj : null;
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

export const getFirebaseStorage = () => {
  const app = getFirebaseAdmin();
  const adminObj = admin.default || admin;
  return app ? adminObj.storage().bucket() : null;
};

export const isFirebaseEnabled = () => {
  const adminObj = admin.default || admin;
  if (!firebaseInitialized) {
    initFirebaseAdmin();
  }
  return firebaseEnabled && adminObj.apps && adminObj.apps.length > 0;
};

export default admin;
