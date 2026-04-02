import React, { useState } from 'react';
import './App.css';
import RoomManager from './components/RoomManager';
import GameBoard from './components/GameBoard';

function App() {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [playerInfo, setPlayerInfo] = useState(null);

  const handleJoinRoom = (roomCode, playerName, isHost) => {
    const playerId = `player${Date.now()}`;
    setCurrentRoom(roomCode);
    setPlayerInfo({ 
      id: playerId, 
      name: playerName, 
      isHost: isHost,
      roomCode: roomCode
    });
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setPlayerInfo(null);
  };

  if (!currentRoom || !playerInfo) {
    return (
      <div className="App">
        <RoomManager onJoinRoom={handleJoinRoom} />
      </div>
    );
  }

  return (
    <div className="App">
      <GameBoard 
        roomCode={currentRoom}
        playerId={playerInfo.id}
        playerName={playerInfo.name}
        isHost={playerInfo.isHost}
        onLeaveRoom={handleLeaveRoom}
      />
    </div>
  );
}

export default App;
