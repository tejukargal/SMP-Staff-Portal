import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  type User,
} from 'firebase/auth';
import { app } from './config';

export const auth = getAuth(app);

// Session-only persistence: closing the browser/tab clears the auth state,
// so the login screen is always shown on a fresh open.
void setPersistence(auth, browserSessionPersistence);

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
