import { firestore, database } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  onValue, 
  off 
} from 'firebase/database';

// ===== FIRESTORE OPERATIONS =====

export const firestoreService = {
  // Create a new document
  async createDocument(collectionName, data) {
    try {
      const docRef = await addDoc(collection(firestore, collectionName), data);
      return { id: docRef.id, success: true };
    } catch (error) {
      console.error('Error creating document: ', error);
      return { success: false, error };
    }
  },

  // Read a single document
  async getDocument(collectionName, docId) {
    try {
      const docRef = doc(firestore, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { 
          id: docSnap.id, 
          data: docSnap.data(), 
          success: true 
        };
      } else {
        return { success: false, error: 'Document not found' };
      }
    } catch (error) {
      console.error('Error getting document: ', error);
      return { success: false, error };
    }
  },

  // Read all documents from a collection
  async getCollection(collectionName) {
    try {
      const querySnapshot = await getDocs(collection(firestore, collectionName));
      const documents = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      return { data: documents, success: true };
    } catch (error) {
      console.error('Error getting collection: ', error);
      return { success: false, error };
    }
  },

  // Update a document
  async updateDocument(collectionName, docId, data) {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await updateDoc(docRef, data);
      return { success: true };
    } catch (error) {
      console.error('Error updating document: ', error);
      return { success: false, error };
    }
  },

  // Delete a document
  async deleteDocument(collectionName, docId) {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting document: ', error);
      return { success: false, error };
    }
  },

  // Real-time listener for a collection
  subscribeToCollection(collectionName, callback) {
    const unsubscribe = onSnapshot(collection(firestore, collectionName), (snapshot) => {
      const documents = [];
      snapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      callback(documents);
    });
    return unsubscribe;
  },

  // Query documents with conditions
  async queryDocuments(collectionName, conditions = [], orderByField = null) {
    try {
      let q = collection(firestore, collectionName);
      
      // Apply where conditions
      conditions.forEach(condition => {
        q = query(q, where(condition.field, condition.operator, condition.value));
      });
      
      // Apply ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField));
      }
      
      const querySnapshot = await getDocs(q);
      const documents = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return { data: documents, success: true };
    } catch (error) {
      console.error('Error querying documents: ', error);
      return { success: false, error };
    }
  }
};

// ===== REALTIME DATABASE OPERATIONS =====

export const realtimeService = {
  // Create/Set data
  async setData(path, data) {
    try {
      const dataRef = ref(database, path);
      await set(dataRef, data);
      return { success: true };
    } catch (error) {
      console.error('Error setting data: ', error);
      return { success: false, error };
    }
  },

  // Push data (generates unique key)
  async pushData(path, data) {
    try {
      const dataRef = ref(database, path);
      const newRef = await push(dataRef, data);
      return { id: newRef.key, success: true };
    } catch (error) {
      console.error('Error pushing data: ', error);
      return { success: false, error };
    }
  },

  // Read data once
  async getData(path) {
    try {
      const dataRef = ref(database, path);
      const snapshot = await get(dataRef);
      
      if (snapshot.exists()) {
        return { 
          data: snapshot.val(), 
          success: true 
        };
      } else {
        return { success: false, error: 'No data available' };
      }
    } catch (error) {
      console.error('Error getting data: ', error);
      return { success: false, error };
    }
  },

  // Update data
  async updateData(path, updates) {
    try {
      const dataRef = ref(database, path);
      await update(dataRef, updates);
      return { success: true };
    } catch (error) {
      console.error('Error updating data: ', error);
      return { success: false, error };
    }
  },

  // Delete data
  async deleteData(path) {
    try {
      const dataRef = ref(database, path);
      await remove(dataRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting data: ', error);
      return { success: false, error };
    }
  },

  // Real-time listener
  subscribeToData(path, callback) {
    const dataRef = ref(database, path);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    });
    
    // Return function to unsubscribe
    return () => off(dataRef, 'value', unsubscribe);
  }
};

// ===== UTILITY FUNCTIONS =====

export const databaseUtils = {
  // Generate timestamp
  getTimestamp() {
    return Date.now();
  },

  // Format date
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString();
  },

  // Validate data before saving
  validateData(data, requiredFields = []) {
    const errors = [];
    
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};