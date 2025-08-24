import React from 'react';
import './CardDisplay.css';

const CardDisplay = () => {
  // Array of 10 cards (H1 to H10)
  const cards = [
    { id: 1, suit: 'H', number: 1, name: 'H1' },
    { id: 2, suit: 'H', number: 2, name: 'H2' },
    { id: 3, suit: 'H', number: 3, name: 'H3' },
    { id: 4, suit: 'H', number: 4, name: 'H4' },
    { id: 5, suit: 'H', number: 5, name: 'H5' },
    { id: 6, suit: 'H', number: 6, name: 'H6' },
    { id: 7, suit: 'H', number: 7, name: 'H7' },
    { id: 8, suit: 'H', number: 8, name: 'H8' },
    { id: 9, suit: 'H', number: 9, name: 'H9' },
    { id: 10, suit: 'H', number: 10, name: 'H10' },
  ];

  return (
    <div className="card-display">
      <div className="cards-container">
        {cards.map((card) => (
          <div key={card.id} className="card-wrapper">
            <img
              src={`${process.env.PUBLIC_URL}/images/${card.name}.png`}
              alt={`${card.suit}${card.number}`}
              className="card-image"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardDisplay;
