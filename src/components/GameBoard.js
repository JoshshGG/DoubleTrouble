import React, { useState, useEffect } from 'react';
import { ref, set, get, update, onValue, off, onDisconnect } from 'firebase/database';
import { database } from '../firebase';
import './GameBoard.css';

const GameBoard = ({ roomCode, playerId, playerName, isHost, onLeaveRoom }) => {
  const AVAILABLE_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 10];

  // Firebase references
  const roomRef = ref(database, `rooms/${roomCode}`);
  const playersRef = ref(database, `rooms/${roomCode}/players`);
  const gameStateRef = ref(database, `rooms/${roomCode}/gameState`);

  // Local state
  const [roomData, setRoomData] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [localCardPositions, setLocalCardPositions] = useState({});
  const [draggingCard, setDraggingCard] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [cardStartPos, setCardStartPos] = useState({ x: 0, y: 0 });
  const lastUpdateRef = React.useRef(Date.now());
  const lastPointerRef = React.useRef({ x: 0, y: 0 });
  const gameBoardRef = React.useRef(null);
  const [playedStartPos, setPlayedStartPos] = useState({ x: 0, y: 0 });
  const [isCardPlayed, setIsCardPlayed] = useState(false);
  const [hasPlayedCard, setHasPlayedCard] = useState(false);
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalWinner, setFinalWinner] = useState(null);
  const [error, setError] = useState('');
  const [selectionResult, setSelectionResult] = useState(null);
  const [playedCardOffsets, setPlayedCardOffsets] = useState({ player1: { x: 0, y: 0 }, player2: { x: 0, y: 0 } });
  const [centerDraggingSlot, setCenterDraggingSlot] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer Effect
  useEffect(() => {
    let interval;
    if (roomData?.gameState === 'playing' && roomData?.startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - roomData.startTime);
      }, 10);
    } else if (roomData?.gameState === 'finished') {
      // Keep the final time
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [roomData?.gameState, roomData?.startTime]);

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
  };

  // Helper functions
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const generateHands = () => {
    const nums = shuffleArray(AVAILABLE_NUMBERS);
    const p1Nums = nums.slice(0, 4);
    const p2Nums = nums.slice(4, 8);
    const timestamp = Date.now();
    return {
      p1: p1Nums.map((n, index) => ({ id: `p1-${n}-${timestamp}-${index}`, name: `H${n}`, value: n })),
      p2: p2Nums.map((n, index) => ({ id: `p2-${n}-${timestamp}-${index}`, name: `H${n}`, value: n })),
    };
  };

  // Initialize player in room
  useEffect(() => {
    let unmounting = false;
    const initializePlayer = async () => {
      try {
        const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
        const snapshot = await get(playerRef);
        
        // Register onDisconnect hooks directly to the database connection lifecycle
        // We only mark the player as isConnected: false, and DO NOT delete the room 
        // to allow the remaining player to still see the screen as requested.
        onDisconnect(playerRef).update({ isConnected: false });
        
        if (!snapshot.exists()) {
          await set(playerRef, {
            name: playerName,
            isHost: isHost,
            score: 0,
            hand: [],
            isConnected: true,
            joinedAt: Date.now()
          });
        } else {
          // Update connection status
          await update(playerRef, { isConnected: true });
        }
      } catch (error) {
        console.error('Error initializing player:', error);
        setError('Failed to join room');
      }
    };

    initializePlayer();

    // Cleanup: Mark as disconnected when component unmounts
    return () => {
      unmounting = true;
      const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
      update(playerRef, { isConnected: false }).catch(err => {
        // Silently fail if we're already disconnected from DB
      });
    };
  }, [roomCode, playerId, playerName, isHost]);

  // Listen for room updates
  useEffect(() => {
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        updateLocalState(data);
      } else {
        // Room was explicitly deleted by the host disconnecting
        setError('The host has closed the room.');
      }
    });

    return () => off(roomRef, 'value', unsubscribe);
  }, [roomCode]);

  // Update local state based on Firebase data
  const updateLocalState = (data) => {
    const playerIdsCheck = Object.keys(data.players || {});
    const opponentId = playerIdsCheck.find(id => id !== playerId);
    if (opponentId && data.players[opponentId] && data.players[opponentId].isConnected === false) {
      if (data.players[opponentId].name) {
        setError(`${data.players[opponentId].name} has left the game.`);
      }
    }
    if (data.gameState === 'finished') {
      setIsGameOver(true);
      setFinalWinner(data.finalWinner);
    } else {
      setIsGameOver(false);
      setFinalWinner(null);
    }

    setShowCardSelection(data.showCardSelection || false);
    setWinner(data.winner);
    
    // Check if cards are played
    if (data.playedCards && data.playedCards.player1 && data.playedCards.player2) {
      setIsCardPlayed(true);
    } else {
      setIsCardPlayed(false);
    }

    // Sync local played state with Firebase
    const playerIds = Object.keys(data.players || {});
    const isPlayer1 = playerIds[0] === playerId;
    const playerSlot = isPlayer1 ? 'player1' : 'player2';

    if (data.playedCards && data.playedCards[playerSlot]) {
      setHasPlayedCard(true);
    } else {
      setHasPlayedCard(false);
      if (!data.showCardSelection) {
        setSelectedCard(null);
      }
    }

    // Sync played card offsets
    if (data.playedCards) {
      const offsets = { 
        player1: data.playedCards.player1?.offset || { x: 0, y: 0 },
        player2: data.playedCards.player2?.offset || { x: 0, y: 0 }
      };
      setPlayedCardOffsets(prev => {
        // Only update if we're not currently dragging these slots to avoid jumpiness
        const next = { ...prev };
        if (centerDraggingSlot !== 'player1') next.player1 = offsets.player1;
        if (centerDraggingSlot !== 'player2') next.player2 = offsets.player2;
        return next;
      });
    } else {
      setPlayedCardOffsets({ player1: { x: 0, y: 0 }, player2: { x: 0, y: 0 } });
    }
  };

  // Get current player's hand
  const getCurrentPlayerHand = () => {
    if (!roomData || !roomData.players) return [];
    const player = roomData.players[playerId];
    return player?.hand || [];
  };

  // Get opponent's hand (for display purposes, we'll show it face down)
  const getOpponentHand = () => {
    if (!roomData || !roomData.players) return [];
    const playerIds = Object.keys(roomData.players);
    const opponentId = playerIds.find(id => id !== playerId);
    if (opponentId) {
      const opponent = roomData.players[opponentId];
      return opponent?.hand || [];
    }
    return [];
  };

  // Get current player's score
  const getCurrentPlayerScore = () => {
    if (!roomData || !roomData.players) return 0;
    const player = roomData.players[playerId];
    return player ? player.score : 0;
  };

  // Get opponent's score
  const getOpponentScore = () => {
    if (!roomData || !roomData.players) return 0;
    const playerIds = Object.keys(roomData.players);
    const opponentId = playerIds.find(id => id !== playerId);
    if (opponentId) {
      const opponent = roomData.players[opponentId];
      return opponent ? opponent.score : 0;
    }
    return 0;
  };

  // Get waiting message when one player has played
  const getWaitingMessage = () => {
    if (!roomData || !roomData.playedCards || showCardSelection) return '';
    
    const p1Played = roomData.playedCards.player1;
    const p2Played = roomData.playedCards.player2;
    
    if (p1Played && !p2Played) {
      const playerIds = Object.keys(roomData.players);
      const isPlayer1 = playerIds[0] === playerId;
      return isPlayer1 ? 'Waiting for opponent...' : 'Your turn to play!';
    } else if (!p1Played && p2Played) {
      const playerIds = Object.keys(roomData.players);
      const isPlayer1 = playerIds[0] === playerId;
      return isPlayer1 ? 'Your turn to play!' : 'Waiting for opponent...';
    }
    
    return '';
  };

  // Start game (only host can do this)
  const startGame = async () => {
    if (!isHost || !roomData) return;

    const playerIds = Object.keys(roomData.players);
    if (playerIds.length < 2) {
      setError('Need at least 2 players to start the game');
      return;
    }

    const { p1, p2 } = generateHands();
    const updates = {
      gameState: 'playing',
      [`players/${playerIds[0]}/hand`]: p1,
      [`players/${playerIds[1]}/hand`]: p2,
      playedCards: {},
      showCardSelection: false,
      winner: null,
      currentPlayer: playerIds[0],
      startTime: Date.now(),
      roundCount: 1
    };

    try {
      await update(roomRef, updates);
      setError('');
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game');
    }
  };

  // Handle card selection
  const handleCardClick = (cardId) => {
    if (!roomData || roomData.gameState !== 'playing' || hasPlayedCard) return;

    const currentHand = getCurrentPlayerHand();
    const isMyCard = currentHand.some(card => card.id === cardId);

    if (!isCardPlayed && isMyCard) {
      setSelectedCard(selectedCard === cardId ? null : cardId);
    } else if (showCardSelection && winner === playerId && roomData.playedCards) {
      // Handle card selection for scoring
      const p1Card = roomData.playedCards.player1;
      const p2Card = roomData.playedCards.player2;
      
      if (p1Card && cardId === p1Card.id) {
        handleCardSelection(p1Card);
      } else if (p2Card && cardId === p2Card.id) {
        handleCardSelection(p2Card);
      }
    }
  };

  const handlePointerDown = (e, cardId) => {
    if (showCardSelection || isCardPlayed || hasPlayedCard || roomData?.gameState !== 'playing') return;
    setDraggingCard(cardId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    
    const currentPos = localCardPositions[cardId] || 
                      (roomData.players[playerId]?.cardPositions?.[cardId]) || 
                      { x: 0, y: 0 };
    setCardStartPos(currentPos);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e, cardId) => {
    if (draggingCard !== cardId) return;

    let allowedClientX = e.clientX;
    let allowedClientY = e.clientY;
    
    if (gameBoardRef.current) {
      const boardRect = gameBoardRef.current.getBoundingClientRect();
      const middleY = boardRect.top + boardRect.height / 2;
      // Clamp coordinates to keep card strictly on player's half
      allowedClientY = Math.max(middleY + 60, Math.min(boardRect.bottom - 60, e.clientY));
      allowedClientX = Math.max(boardRect.left + 50, Math.min(boardRect.right - 50, e.clientX));
    }
    
    lastPointerRef.current = { x: allowedClientX, y: allowedClientY };

    const dx = allowedClientX - dragStartPos.x;
    const dy = allowedClientY - dragStartPos.y;
    const newX = cardStartPos.x + dx;
    const newY = cardStartPos.y + dy;
    
    setLocalCardPositions(prev => ({
      ...prev,
      [cardId]: { x: newX, y: newY }
    }));

    if (Date.now() - lastUpdateRef.current > 50) {
      update(roomRef, {
        [`players/${playerId}/cardPositions/${cardId}`]: { x: newX, y: newY }
      });
      lastUpdateRef.current = Date.now();
    }
  };

  const handlePointerUp = async (e, cardId) => {
    if (draggingCard !== cardId) return;
    setDraggingCard(null);
    e.target.releasePointerCapture(e.pointerId);

    const pos = localCardPositions[cardId];
    if (!pos) return;

    let isSnapped = false;
    let snapTargetPos = { x: pos.x, y: pos.y };

    if (gameBoardRef.current) {
      const boardRect = gameBoardRef.current.getBoundingClientRect();
      const middleY = boardRect.top + boardRect.height / 2;
      const centerX = boardRect.left + boardRect.width / 2;
      
      const snapCenterX = centerX;
      const snapCenterY = middleY + 20 + 94.5;
      
      const pointerX = e.clientX;
      const pointerY = e.clientY;
      
      const dropDist = Math.sqrt(Math.pow(pointerX - snapCenterX, 2) + Math.pow(pointerY - snapCenterY, 2));
      
      if (dropDist < 150) {
        isSnapped = true;
        // Snap visually slightly up towards middle
        snapTargetPos = { x: pos.x, y: pos.y - 40 }; 
      }
    }

    if (isSnapped) {
      setLocalCardPositions(prev => ({
        ...prev,
        [cardId]: snapTargetPos
      }));
      await update(roomRef, {
        [`players/${playerId}/cardPositions/${cardId}`]: snapTargetPos
      });
      setSelectedCard(cardId);
      handlePlayCard(cardId);
    } else {
      update(roomRef, {
        [`players/${playerId}/cardPositions/${cardId}`]: pos
      });
    }
  };

  const handlePlayedPointerDown = (e, slot) => {
     if (!roomData?.playedCards?.[slot]) return;
     
     const playerIds = Object.keys(roomData.players || {});
     const isPlayer1 = playerIds[0] === playerId;
     const mySlot = isPlayer1 ? 'player1' : 'player2';
     const oppSlot = isPlayer1 ? 'player2' : 'player1';

     // Permission check
     if (showCardSelection) {
       // Any player can move cards during selection phase for fun/visuals
     } else {
       if (slot !== mySlot || roomData?.playedCards?.[oppSlot]) return; // Only move own card if opponent hasn't played
     }

     setCenterDraggingSlot(slot);
     setPlayedStartPos({ x: e.clientX, y: e.clientY });
     e.target.setPointerCapture(e.pointerId);
  };
  
  const handlePlayedPointerMove = (e) => {
     if (!centerDraggingSlot) return;
     const dx = e.clientX - playedStartPos.x;
     const dy = e.clientY - playedStartPos.y;
     
     setPlayedCardOffsets(prev => ({
       ...prev,
       [centerDraggingSlot]: { x: dx, y: dy }
     }));

     // Sync to Firebase if in selection phase so opponent can see the "moving around"
     if (showCardSelection && Date.now() - lastUpdateRef.current > 50) {
       update(roomRef, {
         [`playedCards/${centerDraggingSlot}/offset`]: { x: dx, y: dy }
       });
       lastUpdateRef.current = Date.now();
     }
  };
  
  const handlePlayedPointerUp = async (e) => {
     if (!centerDraggingSlot) return;
     const slot = centerDraggingSlot;
     const offset = playedCardOffsets[slot];
     
     setCenterDraggingSlot(null);
     e.target.releasePointerCapture(e.pointerId);
     
     const playerIds = Object.keys(roomData.players || {});
     const isPlayer1 = playerIds[0] === playerId;
     const mySlot = isPlayer1 ? 'player1' : 'player2';
     
     if (!showCardSelection) {
        // Snap out logic for playing phase (only for own card)
        if (slot === mySlot && (Math.abs(offset.x) > 100 || Math.abs(offset.y) > 100)) {
            const currentHand = getCurrentPlayerHand();
            const myPlayedCard = roomData.playedCards[mySlot];
            const updatedHand = currentHand.map(card => card.id === myPlayedCard.id ? { ...card, isPlayed: false } : card);
            
            const updates = {
               [`playedCards/${mySlot}`]: null,
               [`players/${playerId}/hand`]: updatedHand,
               [`players/${playerId}/cardPositions/${myPlayedCard.id}`]: { x: 0, y: 0 }
            };
            
            setHasPlayedCard(false);
            setIsCardPlayed(false);
            setSelectedCard(null);
            setLocalCardPositions(prev => {
              const next = {...prev};
              delete next[myPlayedCard.id];
              return next;
            });
            
            await update(roomRef, updates);
        }
        
        // Reset offset locally (Firebase will be updated by room state reset if snapped out)
        setPlayedCardOffsets(prev => ({ ...prev, [slot]: { x: 0, y: 0 } }));
     } else {
        // Selection phase logic
        let selectionTriggered = false;
        
        // If dragged significantly down (towards player info) and winner is current player, select it
        if (offset.y > 150 && winner === playerId) {
          selectionTriggered = true;
          handleCardSelection(roomData.playedCards[slot]);
        }
        
        if (!selectionTriggered) {
          // Snap back
          setPlayedCardOffsets(prev => ({ ...prev, [slot]: { x: 0, y: 0 } }));
          await update(roomRef, {
            [`playedCards/${slot}/offset`]: { x: 0, y: 0 }
          });
        }
     }
  };

  // Play selected card
  const handlePlayCard = async (overrideCardId) => {
    const targetCardId = overrideCardId && typeof overrideCardId === 'string' ? overrideCardId : selectedCard;
    if (!targetCardId || !roomData || isCardPlayed || hasPlayedCard) return;

    const currentHand = getCurrentPlayerHand();
    const playerCard = currentHand.find(card => card.id === targetCardId);

    if (!playerCard) return;

    // Mark that this player has played their card
    setHasPlayedCard(true);

    // Determine which player slot this is
    const playerIds = Object.keys(roomData.players);
    const isPlayer1 = playerIds[0] === playerId;
    const playerSlot = isPlayer1 ? 'player1' : 'player2';

    // Map tracking flag natively instead of explicitly mutating standard array logic. Keeps placeholder flexbox width identically active.
    const updatedHand = currentHand.map(card => card.id === targetCardId ? { ...card, isPlayed: true } : card);
    
    const updates = {
      [`playedCards/${playerSlot}`]: playerCard,
      [`players/${playerId}/hand`]: updatedHand
    };

    try {
      await update(roomRef, updates);
      
      // If both cards are played, determine winner
      setTimeout(() => {
        checkAndDetermineWinner();
      }, 500);
      
    } catch (error) {
      console.error('Error playing card:', error);
      setError('Failed to play card');
      setHasPlayedCard(false); // Reset on error
    }
  };

  // Check if both players have played and determine winner
  const checkAndDetermineWinner = async () => {
    const snapshot = await get(roomRef);
    const data = snapshot.val();
    
    if (data.playedCards && data.playedCards.player1 && data.playedCards.player2) {
      const p1Card = data.playedCards.player1;
      const p2Card = data.playedCards.player2;
      
      const p1Value = p1Card.value || parseInt(p1Card.name.substring(1));
      const p2Value = p2Card.value || parseInt(p2Card.name.substring(1));

    const bigger = Math.max(p1Value, p2Value);
    const smaller = Math.min(p1Value, p2Value);

      let roundWinner = null;
      const playerIds = Object.keys(data.players);
      
    if (bigger <= 2 * smaller) {
        roundWinner = p1Value === bigger ? playerIds[0] : playerIds[1];
      } else {
        roundWinner = p1Value === smaller ? playerIds[0] : playerIds[1];
      }
      
      const updates = {
        winner: roundWinner,
        showCardSelection: true,
        // Keep the randomized order for cards, but revert their physical offsets to fixed
        cardDisplayOrder: Math.random() > 0.5 ? ['player1', 'player2'] : ['player2', 'player1']
      };
      
      await update(roomRef, updates);
    }
  };

  // Handle card selection for scoring
  const handleCardSelection = async (selectedCardForScore) => {
    if (!roomData || !roomData.playedCards) return;

    const p1Card = roomData.playedCards.player1;
    const p2Card = roomData.playedCards.player2;
    const playerIds = Object.keys(roomData.players);
    
    if (!p1Card || !p2Card || playerIds.length < 2) return;

    const winnerId = winner;
    const loserId = playerIds.find(id => id !== winnerId);
    
    // Calculate score
    const cardValue = selectedCardForScore.value || parseInt(selectedCardForScore.name.substring(1));
    
    // Determine which card goes to loser
    const unselectedCard = selectedCardForScore.id === p1Card.id ? p2Card : p1Card;
    
    // Create a unique version of the unselected card to avoid duplicate keys
    const uniqueUnselectedCard = {
      ...unselectedCard,
      id: `${unselectedCard.id}-returned-${Date.now()}`
    };
    
    console.log('Card Selection Details:', {
      selectedCard: selectedCardForScore,
      selectedCardValue: cardValue,
      unselectedCard: uniqueUnselectedCard,
      winnerId: winnerId,
      loserId: loserId,
      winnerCurrentScore: roomData.players[winnerId].score || 0,
      newWinnerScore: (roomData.players[winnerId].score || 0) + cardValue
    });
    // Delete visibility mapping token
    delete uniqueUnselectedCard.isPlayed;
    
    const p1Hand = (roomData.players[playerIds[0]].hand || []).filter(c => !c.isPlayed);
    const p2Hand = (roomData.players[playerIds[1]].hand || []).filter(c => !c.isPlayed);

    if (loserId === playerIds[0]) p1Hand.push(uniqueUnselectedCard);
    if (loserId === playerIds[1]) p2Hand.push(uniqueUnselectedCard);
    
    const p1ScoreObj = playerIds[0] === winnerId ? (roomData.players[winnerId].score || 0) + cardValue : (roomData.players[playerIds[0]].score || 0);
    const p2ScoreObj = playerIds[1] === winnerId ? (roomData.players[winnerId].score || 0) + cardValue : (roomData.players[playerIds[1]].score || 0);

    const winnerScoredCards = roomData.players[winnerId].scoredCards || [];
    winnerScoredCards.push(selectedCardForScore);

    // Randomize hand card locations for the new round
    const p1Positions = {};
    p1Hand.forEach(card => {
      p1Positions[card.id] = { x: Math.floor(Math.random() * 200 - 100), y: Math.floor(Math.random() * 40 - 20) };
    });
    
    const p2Positions = {};
    p2Hand.forEach(card => {
      p2Positions[card.id] = { x: Math.floor(Math.random() * 200 - 100), y: Math.floor(Math.random() * 40 - 20) };
    });

    const isGameOverAfterThis = p1Hand.length === 0 || p2Hand.length === 0;

    const updates = {
      [`players/${winnerId}/score`]: p1ScoreObj > p2ScoreObj ? (winnerId === playerIds[0] ? p1ScoreObj : p2ScoreObj) : (winnerId === playerIds[0] ? p1ScoreObj : p2ScoreObj),
      [`players/${winnerId}/scoredCards`]: winnerScoredCards,
      [`players/${playerIds[0]}/hand`]: p1Hand,
      [`players/${playerIds[1]}/hand`]: p2Hand,
      [`players/${playerIds[0]}/cardPositions`]: p1Positions,
      [`players/${playerIds[1]}/cardPositions`]: p2Positions,
      playedCards: null,
      showCardSelection: false,
      winner: null,
      roundCount: isGameOverAfterThis ? (roomData.roundCount || 1) : (roomData.roundCount || 1) + 1
    };
    
    // Explicit array length victory check directly avoiding timeouts.
    if (p1Hand.length === 0 || p2Hand.length === 0) {
      updates.gameState = 'finished';
      if (p1ScoreObj > p2ScoreObj) updates.finalWinner = playerIds[0];
      else if (p2ScoreObj > p1ScoreObj) updates.finalWinner = playerIds[1];
      else updates.finalWinner = 'draw';
    }
    
    console.log('Updating Firebase with:', updates);
    
    try {
      await update(roomRef, updates);
      console.log('Successfully updated Firebase');
      
      // Show selection result
      setSelectionResult({
        selectedCard: selectedCardForScore,
        cardValue: cardValue,
        winnerName: roomData.players[winnerId].name,
        unselectedCard: uniqueUnselectedCard,
        loserName: roomData.players[loserId].name
      });
      
      // Clear selection result after 3 seconds
      setTimeout(() => {
        setSelectionResult(null);
      }, 3000);
      
      // Reset the played card state for next round
      setHasPlayedCard(false);
      setSelectedCard(null);
      
    } catch (error) {
      console.error('Error handling card selection:', error);
      setError('Failed to process card selection');
    }
  };

  // Reset game (only host)
  const resetGame = async () => {
    if (!isHost) return;
    
    const updates = {
      gameState: 'waiting',
      playedCards: {},
      showCardSelection: false,
      winner: null,
      finalWinner: null,
      startTime: null,
      roundCount: 0
    };
    
    // Reset player scores and hands
    const playerIds = Object.keys(roomData.players);
    playerIds.forEach(id => {
      updates[`players/${id}/score`] = 0;
      updates[`players/${id}/hand`] = [];
      updates[`players/${id}/scoredCards`] = [];
    });
    
    try {
      await update(roomRef, updates);
      setError('');
    } catch (error) {
      console.error('Error resetting game:', error);
      setError('Failed to reset game');
    }
  };

  // Leave room
  const leaveRoom = async () => {
    try {
      const playerRef = ref(database, `rooms/${roomCode}/players/${playerId}`);
      
      // We don't delete the room here anymore, even if host is leaving.
      // We just update the player as isConnected: false and navigate back.
      onDisconnect(playerRef).cancel();
      await update(playerRef, { isConnected: false });
      
      onLeaveRoom();
    } catch (error) {
      console.error('Error leaving room:', error);
      onLeaveRoom(); // Leave anyway
    }
  };



  if (!roomData) {
    return (
      <div className="game-container">
        <div className="loading">Loading room...</div>
      </div>
    );
  }

  const currentHand = getCurrentPlayerHand();
  const opponentHand = getOpponentHand();
  const currentScore = getCurrentPlayerScore();
  const opponentScore = getOpponentScore();
  const playerIds = Object.keys(roomData.players || {});
  const opponentId = playerIds.find(id => id !== playerId);
  const opponentName = opponentId && roomData.players[opponentId] ? roomData.players[opponentId].name : 'Opponent';

  return (
    <div className="game-container">
      {/* Room Info Header */}
      <div className="room-header">
        <div className="room-info">
          <div className="room-badge">Room: {roomCode}</div>
          <div className="room-players">Players: {playerIds.length}/2</div>
          {(roomData.gameState === 'playing' || roomData.gameState === 'finished') && (
            <>
              <div className="round-counter">Round {roomData.roundCount || 1}</div>
              <div className="game-timer">{formatTime(elapsedTime)}</div>
            </>
          )}
        </div>
        <button className="leave-room-btn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Game Status */}
      {roomData.gameState === 'waiting' && (
        <div className="waiting-room">
          <h3>Waiting for players...</h3>
          <p>Players in room:</p>
          <ul>
            {Object.values(roomData.players || {}).map((player, index) => (
              <li key={index}>
                {player.name} {player.isHost ? '(Host)' : ''}
              </li>
            ))}
          </ul>
          {isHost && playerIds.length >= 2 && (
            <button className="start-game-btn" onClick={startGame}>
              Start Game
            </button>
          )}
        </div>
      )}

      {/* Main Game Board */}
      {(roomData.gameState === 'playing' || roomData.gameState === 'finished') && (
        <>
      {/* Main Section - Realtime Play Area */}
      <div className="main-section">
            {/* Opponent Info */}
        <div className="player-info player2-info">
              <div className="player-name">{opponentName}</div>
              <div className="player-score">SCORE = {opponentScore}</div>
              <div className="scored-cards-container">
                <div className="scored-cards">
                  {(roomData.players[opponentId]?.scoredCards || []).map((card, idx) => (
                    <img 
                      key={`${card.id}-${idx}`} 
                      src={`${process.env.PUBLIC_URL}/images/${card.name}.png`} 
                      className="mini-scored-card" 
                      title={card.name}
                    />
                  ))}
                </div>
              </div>
        </div>

        {/* Main Game Board */}
        <div className={`game-board ${showCardSelection ? 'selection-active' : ''}`} ref={gameBoardRef}>
          <div className="field-divider"></div>
          
          <div 
            className="snap-point opponent-snap"
          >
            {(() => {
              // Determine which card slot content belongs here (top)
              let slotToDisplay = playerIds[0] === playerId ? 'player2' : 'player1'; // Default: opponent's slot
              
              if (showCardSelection && roomData.cardDisplayOrder) {
                // In selection phase, use the randomized order: index 0 goes to "Opponent Snap" (Top)
                slotToDisplay = roomData.cardDisplayOrder[0];
              }

              const cardToShow = roomData.playedCards?.[slotToDisplay];
              if (!cardToShow) return "Opponent";

              return (
                <div 
                    className={`card-slot ${showCardSelection && winner === playerId ? 'selectable' : ''}`}
                    onPointerDown={(e) => handlePlayedPointerDown(e, slotToDisplay)}
                    onPointerMove={handlePlayedPointerMove}
                    onPointerUp={handlePlayedPointerUp}
                    onPointerCancel={handlePlayedPointerUp}
                    style={{ 
                        transform: `translate(${playedCardOffsets[slotToDisplay].x}px, ${playedCardOffsets[slotToDisplay].y}px)`,
                        transition: centerDraggingSlot === slotToDisplay ? 'none' : 'transform 0.1s linear',
                        zIndex: centerDraggingSlot === slotToDisplay ? 200 : 10,
                        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto',
                        touchAction: 'none'
                    }}
                    onClick={(e) => {
                        if (showCardSelection && winner === playerId && !centerDraggingSlot) {
                            handleCardSelection(cardToShow);
                        }
                    }}
                >
                    <img 
                        src={`${process.env.PUBLIC_URL}/images/${cardToShow.name}.png`} 
                        className="card-image" 
                        style={{ filter: showCardSelection ? 'none' : 'brightness(0)', pointerEvents: 'none', objectFit: 'contain' }} 
                    />
                </div>
              );
            })()}
          </div>
          
          <div 
            className="snap-point player-snap"
          >
            {(() => {
              // Determine which card slot content belongs here (bottom)
              let slotToDisplay = playerIds[0] === playerId ? 'player1' : 'player2'; // Default: player's own slot
              
              if (showCardSelection && roomData.cardDisplayOrder) {
                // In selection phase, use the randomized order: index 1 goes to "Player Snap" (Bottom)
                slotToDisplay = roomData.cardDisplayOrder[1];
              }

              const cardToShow = roomData.playedCards?.[slotToDisplay];
              if (!cardToShow) return "Play Here";

              return (
                <div 
                    className={`card-slot ${showCardSelection && winner === playerId ? 'selectable' : ''}`}
                    onPointerDown={(e) => handlePlayedPointerDown(e, slotToDisplay)}
                    onPointerMove={handlePlayedPointerMove}
                    onPointerUp={handlePlayedPointerUp}
                    onPointerCancel={handlePlayedPointerUp}
                    style={{
                        transform: `translate(${playedCardOffsets[slotToDisplay].x}px, ${playedCardOffsets[slotToDisplay].y}px)`,
                        transition: centerDraggingSlot === slotToDisplay ? 'none' : 'transform 0.1s linear',
                        zIndex: centerDraggingSlot === slotToDisplay ? 200 : 10,
                        touchAction: 'none',
                        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto'
                    }}
                    onClick={(e) => {
                        if (showCardSelection && winner === playerId && !centerDraggingSlot) {
                            handleCardSelection(cardToShow);
                        }
                    }}
                >
                    <img src={`${process.env.PUBLIC_URL}/images/${cardToShow.name}.png`} className="card-image" style={{ pointerEvents: 'none', objectFit: 'contain' }} />
                </div>
              );
            })()}
          </div>
              {isGameOver && (
                <div className="selection-message-overlay">
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
                    {finalWinner === playerId && 'You won!'}
                    {finalWinner && finalWinner !== playerId && finalWinner !== 'draw' && 'You lose!'}
                    {finalWinner === 'draw' && "It's a tie!"}
                  </div>
                  <div style={{ fontSize: '18px', marginBottom: '16px' }}>
                    Final Scores:
                    <br />
                    {playerName}: {currentScore}
                    <br />
                    {opponentName}: {opponentScore}
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <button className="reset-btn" onClick={leaveRoom}>New Game (Back to Menu)</button>
                  </div>
                </div>
              )}

              {/* Opponent's Cards */}
           <div className="player-cards player2-cards">
                {opponentHand.map((card) => {
                  const oppId = Object.keys(roomData.players).find(id => id !== playerId);
                  const oppPos = roomData.players[oppId]?.cardPositions?.[card.id] || { x: 0, y: 0 };
                  
                  return (
                    <div 
                      key={`opponent-${card.id}`} 
                      className="card-slot disabled"
                      style={{
                        transform: `translate(${-oppPos.x}px, ${-oppPos.y}px)`,
                        transition: 'transform 0.1s linear',
                        visibility: card.isPlayed ? 'hidden' : 'visible'
                      }}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL}/images/${card.name}.png`}
                        alt="Hidden"
                        className="card-image"
                        draggable="false"
                        style={{ 
                          filter: showCardSelection ? 'none' : 'brightness(0)',
                          pointerEvents: showCardSelection ? 'auto' : 'none',
                          userSelect: 'none'
                        }}
                      />
                    </div>
                  );
                })}
           </div>

          {/* Central Play Zone Messages */}
          <div className="play-zone">
                
                {/* Show waiting message or selection message */}
                {getWaitingMessage() && !showCardSelection && (
                  <div className="waiting-message">
                    {getWaitingMessage()}
                  </div>
                )}
                
            {showCardSelection && (
              <div className="selection-message-overlay">
                    {winner === playerId ? 'Drag card down to score or click it:' : `${roomData.players[winner]?.name} is choosing...`}
                  </div>
                )}

          </div>

              {/* Player's Cards */}
          <div className="player-cards player1-cards">
                {currentHand.map((card) => {
                  const pos = localCardPositions[card.id] || 
                              (roomData.players[playerId]?.cardPositions?.[card.id]) || 
                              { x: 0, y: 0 };
                  const isDragging = draggingCard === card.id;

                  return (
                    <div 
                      key={`player-${card.id}`} 
                      className={`card-slot ${selectedCard === card.id ? 'selected' : ''} ${isCardPlayed && !showCardSelection ? 'disabled' : ''} ${(showCardSelection && winner === playerId && roomData.playedCards && (roomData.playedCards.player1?.id === card.id || roomData.playedCards.player2?.id === card.id)) ? 'selectable' : ''}`}
                      onPointerDown={(e) => handlePointerDown(e, card.id)}
                      onPointerMove={(e) => handlePointerMove(e, card.id)}
                      onPointerUp={(e) => handlePointerUp(e, card.id)}
                      onPointerCancel={(e) => handlePointerUp(e, card.id)}
                      style={{
                        transform: `translate(${pos.x}px, ${pos.y}px)`,
                        transition: isDragging ? 'none' : 'transform 0.1s linear',
                        zIndex: isDragging ? 200 : 1,
                        touchAction: 'none',
                        visibility: card.isPlayed ? 'hidden' : 'visible'
                      }}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL}/images/${card.name}.png`}
                        alt={card.name}
                        className="card-image"
                        draggable="false"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      />
                    </div>
                  );
                })}
          </div>
        </div>

            {/* Player Controls */}
        <div className="player1-controls">
          <div className="player-info player1-info">
                <div className="player-name">{playerName}</div>
                <div className="player-score">SCORE = {currentScore}</div>
                <div className="scored-cards-container">
                  <div className="scored-cards">
                    {(roomData.players[playerId]?.scoredCards || []).map((card, idx) => (
                      <img 
                        key={`${card.id}-${idx}`} 
                        src={`${process.env.PUBLIC_URL}/images/${card.name}.png`} 
                        className="mini-scored-card" 
                        title={card.name}
                      />
                    ))}
                  </div>
                </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default GameBoard;