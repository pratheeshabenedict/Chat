import React from 'react';

const MessageList = ({ messages }) => {
  return (
    <div className="flex-1 overflow-y-auto mb-4 px-2 space-y-2">
      {messages.map((msg, index) => (
        <div
          key={index}
          className="bg-blue-100 px-3 py-2 rounded-lg shadow text-sm"
        >
          {msg}
        </div>
      ))}
    </div>
  );
};
//styling
export default MessageList;
