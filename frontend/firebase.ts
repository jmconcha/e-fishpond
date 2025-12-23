// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAN_24YoeOkLkl2ELKf_USZtTtMJ6ddGSQ",
  authDomain: "e-fishpond.firebaseapp.com",
  databaseURL: "https://e-fishpond-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-fishpond",
  storageBucket: "e-fishpond.firebasestorage.app",
  messagingSenderId: "90603907240",
  appId: "1:90603907240:web:898f0a981a49af1cf47a9d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);