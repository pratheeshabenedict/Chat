import React from 'react';
import ChatBox from './components/ChatBox';
import './index.css'//tailwind 
function App() {
  return (
    <div className="bg-grey-100 min-h-screen flex items-center justify-center">
      <div className="text-3xl text-blue-500 font-bold">CHAT </div>

      <ChatBox />
    </div>
  );
}

export default App;
