import React, { useState, useEffect } from 'react';
import { ref, set, get, onValue, off } from 'firebase/database';
import { database } from '../firebase';

const RoomManager = ({ onJoinRoom }) => {
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    const roomsRef = ref(database, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).filter(room => {
          const players = Object.values(room.players || {});
          const connectedCount = players.filter(p => p.isConnected).length;
          const totalPlayers = players.length;

          // 1. Delete rooms with 0 connected players that are older than 5 minutes
          // (Simple cleanup to keep the list fresh)
          const age = Date.now() - (room.createdAt || 0);
          if (connectedCount === 0 && (age > 300000 || totalPlayers === 0)) {
            // We don't delete here to avoid side effects in a filter, 
            // but we definitely hide it.
            return false;
          }

          // 2. Hide rooms that are finished (they've served their purpose)
          if (room.gameState === 'finished') return false;

          // 3. Waiting rooms: show if not full or if there's at least one person there
          if (room.gameState === 'waiting') {
            return connectedCount > 0 && totalPlayers < (room.maxPlayers || 2);
          }

          // 4. Playing rooms: only show as "In Progress" if exactly 2 people are connected
          if (room.gameState === 'playing') {
            return connectedCount === 2;
          }

          return false;
        });

        // Add a cleanup for truly empty rooms (0 players at all)
        Object.keys(data).forEach(key => {
          const room = data[key];
          if (!room.players || Object.keys(room.players).length === 0) {
            const age = Date.now() - (room.createdAt || 0);
            if (age > 60000) { // 1 minute
              set(ref(database, `rooms/${key}`), null);
            }
          }
        });

        // Sort by newest first
        roomsList.sort((a, b) => b.createdAt - a.createdAt);
        setActiveRooms(roomsList);
      } else {
        setActiveRooms([]);
      }
    });

    return () => off(roomsRef, 'value', unsubscribe);
  }, []);

  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const code = generateRoomCode();
      const roomRef = ref(database, `rooms/${code}`);

      // Check if room already exists
      const snapshot = await get(roomRef);
      if (snapshot.exists()) {
        createRoom(); // Try again
        return;
      }

      // Create room
      await set(roomRef, {
        code: code,
        players: {},
        gameState: 'waiting',
        createdAt: Date.now(),
        maxPlayers: 2
      });

      onJoinRoom(code, playerName.trim(), true); // true = is host
    } catch (error) {
      console.error('Error creating room:', error);
      setError('Failed to create room. Please try again.');
      setIsCreating(false);
    }
  };

  const joinSpecificRoom = async (roomCode) => {
    if (!playerName.trim()) {
      setError('Please enter your name in the input box before joining a room');
      return;
    }

    setError('');

    try {
      const roomRef = ref(database, `rooms/${roomCode}`);
      const snapshot = await get(roomRef);

      if (!snapshot.exists()) {
        setError('Room not found.');
        return;
      }

      const roomData = snapshot.val();
      const connectedCount = Object.values(roomData.players || {}).filter(p => p.isConnected).length;

      if (roomData.gameState !== 'waiting' && connectedCount >= roomData.maxPlayers) {
        setError('Game is already in progress and full.');
        return;
      }

      if (connectedCount >= roomData.maxPlayers) {
        setError('Room is full.');
        return;
      }

      onJoinRoom(roomCode, playerName.trim(), false); // false = not host
    } catch (error) {
      console.error('Error joining room:', error);
      setError('Failed to join room. Please try again.');
    }
  };

  return (
    <div className="room-manager">
      <div className="room-container">
        <h2>Double Trouble Online</h2>

        <div className="player-setup">
          <input
            type="text"
            placeholder="Step 1: Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createRoom()}
          />
        </div>

        <div className="room-actions">
          <button
            className="create-btn"
            onClick={createRoom}
            disabled={!playerName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Step 2: Create a New Room'}
          </button>

          <div className="divider">
            <span>OR JOIN AN ACTIVE ROOM</span>
          </div>

          <div className="active-rooms-list" style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
            {activeRooms.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', margin: '20px 0' }}>
                No active rooms available.<br /><br />Click "Create a New Room" to start playing!
              </div>
            ) : (
              activeRooms.map(room => {
                const hostName = room.players ? Object.values(room.players).find(p => p.isHost)?.name || 'Someone' : 'Someone';
                return (
                  <div key={room.id} className="room-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '8px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: '1.2em', color: '#FFD700', marginBottom: '4px' }}>Room {room.code}</strong>
                      <span style={{ fontSize: '0.9em', color: 'white', opacity: 0.9 }}>Host: {hostName}</span>
                    </div>
                    <button
                      onClick={() => joinSpecificRoom(room.code)}
                      disabled={!playerName.trim() || (room.gameState === 'playing' && Object.values(room.players || {}).filter(p => p.isConnected).length >= 2)}
                      style={{
                        padding: '10px 24px',
                        background: (room.gameState === 'playing' && Object.values(room.players || {}).filter(p => p.isConnected).length === 2) ? '#666' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: playerName.trim() && (room.gameState !== 'playing' || Object.values(room.players || {}).filter(p => p.isConnected).length < room.maxPlayers) ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        transition: 'background 0.2s',
                        opacity: (room.gameState === 'playing' && Object.values(room.players || {}).filter(p => p.isConnected).length === 2) ? 0.7 : 1
                      }}
                    >
                      {room.gameState === 'playing' && Object.values(room.players || {}).filter(p => p.isConnected).length === 2 ? 'In Progress' : (Object.values(room.players || {}).filter(p => p.isConnected).length >= (room.maxPlayers || 2) ? 'Full' : 'Join')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

      </div>
    </div>
  );
};

export default RoomManager;
