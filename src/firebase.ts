import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { UserRole } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export interface FirebaseUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  authProvider: 'google';
}

const VALID_ROLES: UserRole[] = [
  'candidat',
  'enseignant',
  'directeur_ced',
  'doctorant',
  'agent',
  'admin',
];

function sanitizeUserFields(user: User) {
  const cleanEmail = (user.email || '').trim().toLowerCase().slice(0, 254);
  const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : 'Utilisateur Google';
  const cleanDisplayName = (user.displayName || fallbackName).trim().slice(0, 120);
  const cleanPhotoURL = (user.photoURL || '').trim().slice(0, 500);

  return {
    uid: user.uid,
    email: cleanEmail,
    displayName: cleanDisplayName,
    photoURL: cleanPhotoURL,
  };
}

export async function syncGoogleUserProfile(user: User): Promise<FirebaseUserProfile> {
  const sanitized = sanitizeUserFields(user);
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap && existingSnap.exists()) {
    const data = existingSnap.data();
    const storedRole: UserRole = VALID_ROLES.includes(data.role) ? data.role : 'candidat';

    const needsProfileRefresh =
      data.displayName !== sanitized.displayName ||
      (data.photoURL || '') !== sanitized.photoURL;

    if (needsProfileRefresh) {
      const updatePayload: Record<string, unknown> = {
        displayName: sanitized.displayName,
        updatedAt: serverTimestamp(),
      };
      if (sanitized.photoURL) {
        updatePayload.photoURL = sanitized.photoURL;
      }
      try {
        await updateDoc(userRef, updatePayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }

    return {
      uid: user.uid,
      email: sanitized.email || data.email || '',
      displayName: sanitized.displayName || data.displayName || '',
      photoURL: sanitized.photoURL || data.photoURL || '',
      role: storedRole,
      authProvider: 'google',
    };
  }

  const createPayload: Record<string, unknown> = {
    uid: sanitized.uid,
    email: sanitized.email,
    displayName: sanitized.displayName,
    role: 'candidat',
    authProvider: 'google',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (sanitized.photoURL) {
    createPayload.photoURL = sanitized.photoURL;
  }

  try {
    await setDoc(userRef, createPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  return {
    uid: sanitized.uid,
    email: sanitized.email,
    displayName: sanitized.displayName,
    photoURL: sanitized.photoURL,
    role: 'candidat',
    authProvider: 'google',
  };
}

export async function signInWithGoogle(): Promise<{
  user: User;
  profile: FirebaseUserProfile;
}> {
  const credential = await signInWithPopup(auth, googleProvider);
  const profile = await syncGoogleUserProfile(credential.user);
  return { user: credential.user, profile };
}

export async function signOutFirebase(): Promise<void> {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export { onAuthStateChanged };
export type { User as FirebaseUser };
