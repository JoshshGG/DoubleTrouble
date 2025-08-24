import React, { useState, useEffect } from 'react';
import { firestoreService, realtimeService, databaseUtils } from '../services/databaseService';
import './FirebaseExample.css';

const FirebaseExample = () => {
  // State for Firestore
  const [firestoreTasks, setFirestoreTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  // State for Realtime Database
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // State for UI
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('firestore');

  // Load Firestore tasks on component mount
  useEffect(() => {
    loadFirestoreTasks();
  }, []);

  // Set up Realtime Database listener
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToData('messages', (data) => {
      if (data) {
        const messagesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setRealtimeMessages(messagesArray.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setRealtimeMessages([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // ===== FIRESTORE OPERATIONS =====

  const loadFirestoreTasks = async () => {
    setLoading(true);
    const result = await firestoreService.getCollection('tasks');
    if (result.success) {
      setFirestoreTasks(result.data);
    } else {
      console.error('Error loading tasks:', result.error);
    }
    setLoading(false);
  };

  const addFirestoreTask = async () => {
    if (!newTask.trim()) return;

    const taskData = {
      title: newTask,
      completed: false,
      createdAt: databaseUtils.getTimestamp(),
      updatedAt: databaseUtils.getTimestamp()
    };

    const validation = databaseUtils.validateData(taskData, ['title']);
    if (!validation.isValid) {
      alert('Validation errors: ' + validation.errors.join(', '));
      return;
    }

    const result = await firestoreService.createDocument('tasks', taskData);
    if (result.success) {
      setNewTask('');
      loadFirestoreTasks();
    } else {
      console.error('Error adding task:', result.error);
    }
  };

  const updateFirestoreTask = async (taskId, updates) => {
    const result = await firestoreService.updateDocument('tasks', taskId, {
      ...updates,
      updatedAt: databaseUtils.getTimestamp()
    });
    if (result.success) {
      loadFirestoreTasks();
    } else {
      console.error('Error updating task:', result.error);
    }
  };

  const deleteFirestoreTask = async (taskId) => {
    const result = await firestoreService.deleteDocument('tasks', taskId);
    if (result.success) {
      loadFirestoreTasks();
    } else {
      console.error('Error deleting task:', result.error);
    }
  };

  const toggleTaskComplete = (task) => {
    updateFirestoreTask(task.id, { completed: !task.completed });
  };

  const startEditingTask = (task) => {
    setEditingTask({ ...task });
  };

  const saveEditedTask = () => {
    if (editingTask) {
      updateFirestoreTask(editingTask.id, { title: editingTask.title });
      setEditingTask(null);
    }
  };

  const cancelEditing = () => {
    setEditingTask(null);
  };

  // ===== REALTIME DATABASE OPERATIONS =====

  const addRealtimeMessage = async () => {
    if (!newMessage.trim()) return;

    const messageData = {
      text: newMessage,
      timestamp: databaseUtils.getTimestamp(),
      user: 'User' + Math.floor(Math.random() * 1000)
    };

    const result = await realtimeService.pushData('messages', messageData);
    if (result.success) {
      setNewMessage('');
    } else {
      console.error('Error adding message:', result.error);
    }
  };

  const deleteRealtimeMessage = async (messageId) => {
    const result = await realtimeService.deleteData(`messages/${messageId}`);
    if (!result.success) {
      console.error('Error deleting message:', result.error);
    }
  };

  return (
    <div className="firebase-example">
      <h1>Firebase Database Example</h1>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={activeTab === 'firestore' ? 'active' : ''}
          onClick={() => setActiveTab('firestore')}
        >
          Firestore (Cloud)
        </button>
        <button 
          className={activeTab === 'realtime' ? 'active' : ''}
          onClick={() => setActiveTab('realtime')}
        >
          Realtime Database
        </button>
      </div>

      {/* Firestore Tab */}
      {activeTab === 'firestore' && (
        <div className="tab-content">
          <h2>Firestore Tasks</h2>
          
          {/* Add Task Form */}
          <div className="add-form">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Enter a new task..."
              onKeyPress={(e) => e.key === 'Enter' && addFirestoreTask()}
            />
            <button onClick={addFirestoreTask}>Add Task</button>
          </div>

          {/* Loading Indicator */}
          {loading && <div className="loading">Loading tasks...</div>}

          {/* Tasks List */}
          <div className="tasks-list">
            {firestoreTasks.map(task => (
              <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                {editingTask && editingTask.id === task.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      value={editingTask.title}
                      onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                      onKeyPress={(e) => e.key === 'Enter' && saveEditedTask()}
                    />
                    <button onClick={saveEditedTask}>Save</button>
                    <button onClick={cancelEditing}>Cancel</button>
                  </div>
                ) : (
                  <div className="task-content">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTaskComplete(task)}
                    />
                    <span className="task-title">{task.title}</span>
                    <span className="task-date">
                      {databaseUtils.formatDate(task.createdAt)}
                    </span>
                    <div className="task-actions">
                      <button onClick={() => startEditingTask(task)}>Edit</button>
                      <button onClick={() => deleteFirestoreTask(task.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {firestoreTasks.length === 0 && !loading && (
            <div className="empty-state">No tasks yet. Add one above!</div>
          )}
        </div>
      )}

      {/* Realtime Database Tab */}
      {activeTab === 'realtime' && (
        <div className="tab-content">
          <h2>Realtime Messages</h2>
          
          {/* Add Message Form */}
          <div className="add-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Enter a message..."
              onKeyPress={(e) => e.key === 'Enter' && addRealtimeMessage()}
            />
            <button onClick={addRealtimeMessage}>Send Message</button>
          </div>

          {/* Messages List */}
          <div className="messages-list">
            {realtimeMessages.map(message => (
              <div key={message.id} className="message-item">
                <div className="message-header">
                  <span className="message-user">{message.user}</span>
                  <span className="message-time">
                    {databaseUtils.formatDate(message.timestamp)}
                  </span>
                  <button 
                    className="delete-btn"
                    onClick={() => deleteRealtimeMessage(message.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="message-text">{message.text}</div>
              </div>
            ))}
          </div>

          {realtimeMessages.length === 0 && (
            <div className="empty-state">No messages yet. Send one above!</div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>Configuration Required</h3>
        <p>
          To use this component, you need to:
        </p>
        <ol>
          <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer">Firebase Console</a></li>
          <li>Enable Firestore and Realtime Database in your project</li>
          <li>Update the configuration in <code>src/firebase.js</code> with your project details</li>
          <li>Set up security rules for your databases</li>
        </ol>
      </div>
    </div>
  );
};

export default FirebaseExample;