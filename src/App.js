import './App.css';
import GameBoard from './components/GameBoard';
import FirebaseExample from './components/FirebaseExample';

function App() {
  return (
    <div className="App">
      <FirebaseExample />
      <GameBoard />
    </div>
  );
}

export default App;
