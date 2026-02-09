// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeAuth, connectAuthEmulator } from 'firebase/auth';

// TODO: Add SDKs for Firebase products that you want to use

const USE_FIREBASE_EMULATOR =
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DB_URL,
  projectId: 'e-fishpond',
  storageBucket: 'e-fishpond.firebasestorage.app',
  messagingSenderId: '90603907240',
  appId: '1:90603907240:web:898f0a981a49af1cf47a9d',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
// export const auth = initializeAuth(app, {
//   persistence: getReactNativePersistence(ReactNativeAsyncStorage)
// });
export const auth = initializeAuth(app);

// local firebase, emulator setup

if (USE_FIREBASE_EMULATOR) {
  console.log('Using Firebase Emulator');
  connectAuthEmulator(
    auth,
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'http://192.168.1.23:9099',
  );
  connectDatabaseEmulator(
    database,
    process.env.EXPO_PUBLIC_HOST || '192.168.1.23',
    parseInt(process.env.EXPO_PUBLIC_DB_PORT || '9000'),
  );
} else {
  console.log('Using Production Firebase');
}
