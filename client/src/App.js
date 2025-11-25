import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [raffles, setRaffles] = useState([]);
  const [newRaffleName, setNewRaffleName] = useState('');
  const [newParticipantName, setNewParticipantName] = useState('');

  useEffect(() => {
    fetch('/api/raffles')
      .then(res => res.json())
      .then(data => setRaffles(data));

    socket.on('winnerDrawn', (updatedRaffle) => {
      setRaffles(prevRaffles =>
        prevRaffles.map(raffle =>
          raffle.id === updatedRaffle.id ? updatedRaffle : raffle
        )
      );
    });

    return () => {
      socket.off('winnerDrawn');
    };
  }, []);

  const handleCreateRaffle = () => {
    fetch('/api/raffles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRaffleName }),
    })
      .then(res => res.json())
      .then(newRaffle => {
        setRaffles([...raffles, newRaffle]);
        setNewRaffleName('');
      });
  };

  const handleAddParticipant = (raffleId) => {
    fetch(`/api/raffles/${raffleId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newParticipantName }),
    })
      .then(res => res.json())
      .then(newParticipant => {
        const updatedRaffles = raffles.map(raffle => {
          if (raffle.id === raffleId) {
            return { ...raffle, participants: [...raffle.participants, newParticipant] };
          }
          return raffle;
        });
        setRaffles(updatedRaffles);
        setNewParticipantName('');
      });
  };

  const handleDrawWinner = (raffleId) => {
    fetch(`/api/raffles/${raffleId}/draw`, {
      method: 'POST',
    });
  };

  return (
    <div>
      <h1>Raffle Website</h1>
      <div>
        <input
          type="text"
          value={newRaffleName}
          onChange={(e) => setNewRaffleName(e.target.value)}
          placeholder="New Raffle Name"
        />
        <button onClick={handleCreateRaffle}>Create Raffle</button>
      </div>
      <div>
        {raffles.map(raffle => (
          <div key={raffle.id} style={{ border: '1px solid black', margin: '10px', padding: '10px' }}>
            <h2>{raffle.name}</h2>
            <div>
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Participant Name"
              />
              <button onClick={() => handleAddParticipant(raffle.id)}>Add Participant</button>
            </div>
            <h3>Participants:</h3>
            <ul>
              {raffle.participants.map(p => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
            <button onClick={() => handleDrawWinner(raffle.id)}>Draw Winner</button>
            {raffle.winner && <h3>Winner: {raffle.winner.name}</h3>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
