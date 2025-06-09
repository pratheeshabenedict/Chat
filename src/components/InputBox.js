import React, { useState } from 'react';

const InputBox = ({ sendMessage }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() !== '') {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 border border-gray-300 px-3 py-2 rounded-xl text-sm focus:outline-none"
      />
      <button
        onClick={handleSend}
        className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-600"
      >
        Send
      </button>
    </div>
  );
};

export default InputBox;
