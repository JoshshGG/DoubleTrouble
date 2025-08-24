import React, { useState } from 'react';
import './GameBoard.css';

const GameBoard = () => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [isCardPlayed, setIsCardPlayed] = useState(false);
  const [opponentSelectedCard, setOpponentSelectedCard] = useState(null);
  const [playedCards, setPlayedCards] = useState({ player1: null, player2: null });
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [winner, setWinner] = useState(null); // Can be 'player1', 'player2', or 'draw'


  // Sample cards for Player 2 (opponent) - using different Hearts cards
  const player2Cards = [
    { id: 1, name: 'H1' },
    { id: 2, name: 'H2' },
    { id: 3, name: 'H3' },
    { id: 4, name: 'H4' },
  ];

  // Sample cards for Player 1 (user) - using different Hearts cards
  const player1Cards = [
    { id: 5, name: 'H5' },
    { id: 6, name: 'H6' },
    { id: 7, name: 'H7' },
    { id: 8, name: 'H8' },
  ];

  const handleCardClick = (cardId) => {
    if (!isCardPlayed) {
      setSelectedCard(selectedCard === cardId ? null : cardId);
    }
  };

  const handlePlayCard = () => {
    if (selectedCard) {
      setIsCardPlayed(true);
      
      // Opponent plays a random card
      const randomIndex = Math.floor(Math.random() * player2Cards.length);
      const opponentCard = player2Cards[randomIndex];
      setOpponentSelectedCard(opponentCard.id);
      
      // Set played cards
      const player1Card = player1Cards.find(card => card.id === selectedCard);
      setPlayedCards({
        player1: player1Card,
        player2: opponentCard
      });

      // Call the winner determination function here!
      determineWinner(player1Card, opponentCard);
      
      console.log(`Player 1 played: ${player1Card.name}`);
      console.log(`Player 2 played: ${opponentCard.name}`);
    }
  };

  const handleReset = () => {
    setSelectedCard(null);
    setIsCardPlayed(false);
    setOpponentSelectedCard(null);
    setPlayedCards({ player1: null, player2: null });
  };

  const determineWinner = (p1Card, p2Card) => {
  // Extract the number from the card name string (e.g., 'H5' -> 5)
  const p1Value = parseInt(p1Card.name.substring(1));
  const p2Value = parseInt(p2Card.name.substring(1));

  let roundWinner = null;
  let winningCardValue;
  let losingCardValue;

  // Determine the bigger and smaller number
  const bigger = Math.max(p1Value, p2Value);
  const smaller = Math.min(p1Value, p2Value);

  // Apply your game rules
  if (bigger <= 2 * smaller) {
    // The bigger number wins
    if (p1Value === bigger) {
      roundWinner = 'player1';
      console.log(`Player 1 won`);
    } else {
      roundWinner = 'player2';
      console.log(`Player 2 won`);
    }
  } else {
    // The smaller number wins
    if (p1Value === smaller) {
      roundWinner = 'player1';
      console.log(`Player 1 won`);
    } else {
      roundWinner = 'player2';
      console.log(`Player 2 won`);
    }
  }

  // Update the state for the winner and scores
  setWinner(roundWinner);
  if (roundWinner === 'player1') {
    setPlayer1Score(prevScore => prevScore + winningCardValue);
  } else if (roundWinner === 'player2') {
    setPlayer2Score(prevScore => prevScore + winningCardValue);
  }

};

  return (
    <div className="game-container">
      {/* Left Section - Main Game Board */}
      <div className="left-section">
        {/* Player 2 Info */}
        <div className="player-info player2-info">
          <div className="player-name">Player 2</div>
          <div className="player-score">SCORE = 0</div>
        </div>

        {/* Main Game Board */}
        <div className="game-board">
          {/* Player 2's Cards */}
          <div className="player-cards player2-cards">
            {player2Cards.map((card) => (
              <div 
                key={card.id} 
                className={`card-slot ${opponentSelectedCard === card.id ? 'selected' : ''} ${isCardPlayed ? 'disabled' : ''} ${opponentSelectedCard === card.id && isCardPlayed ? 'moving-to-center-down' : ''}`}
              >
                <img
                  src={`${process.env.PUBLIC_URL}/images/${card.name}.png`}
                  alt={card.name}
                  className="card-image"
                />
              </div>
            ))}
          </div>

          {/* Central Play Zone */}
          <div className="play-zone">
            {/* No longer creating new cards in center - moving cards will stay there */}
          </div>

          {/* Player 1's Cards */}
          <div className="player-cards player1-cards">
            {player1Cards.map((card) => (
              <div 
                key={card.id} 
                className={`card-slot ${selectedCard === card.id ? 'selected' : ''} ${isCardPlayed ? 'disabled' : ''} ${selectedCard === card.id && isCardPlayed ? 'moving-to-center-up' : ''}`}
                onClick={() => handleCardClick(card.id)}
              >
                <img
                  src={`${process.env.PUBLIC_URL}/images/${card.name}.png`}
                  alt={card.name}
                  className="card-image"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Player 1 Controls and Info */}
        <div className="player1-controls">
          <div className="player-info player1-info">
            <div className="player-name">Player 1</div>
            <div className="player-score">SCORE = 0</div>
          </div>
          
          {/* Play Card Button */}
          {selectedCard && !isCardPlayed && (
            <button className="play-card-btn" onClick={handlePlayCard}>
              Play Card
            </button>
          )}
          
          {/* Reset Button (for testing) */}
          {isCardPlayed && (
            <button className="reset-btn" onClick={handleReset}>
              Reset
            </button>
          )}
          
          <div className="timer">3:00</div>
        </div>
      </div>

      {/* Right Section - Card Grid and Resign */}
      <div className="right-section">
        {/* Card Grid */}
        <div className="card-grid">
          <div className="grid-row">
            <div className="grid-card-slot"></div>
            <div className="grid-card-slot"></div>
            <div className="grid-card-slot"></div>
            <div className="grid-card-slot"></div>
          </div>
          <div className="grid-row">
            <div className="grid-card-slot"></div>
            <div className="grid-card-slot"></div>
            <div className="grid-card-slot"></div>
            <div className="grid-card-slot"></div>
          </div>
        </div>

        {/* Resign Button */}
        <button className="resign-btn">Resign</button>
      </div>
    </div>
  );
};

export default GameBoard;
