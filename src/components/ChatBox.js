import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Username Modal Component
const UsernameModal = ({ onSubmit, isVisible }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    if (username.trim().length === 0) {
      setError('Username cannot be empty');
      return;
    }
    if (username.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    setError('');
    onSubmit(username.trim());
  };
//this is the change
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-center">Join Chat</h2>
        <div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={20}
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleSubmit}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Join Chat
          </button>
        </div>
      </div>
    </div>
  );
};

// Connection Status Component
const ConnectionStatus = ({ isConnected }) => {
  return (
    <div className={`text-sm px-2 py-1 rounded-full ${
      isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
    </div>
  );
};

// Typing Indicator Component
const TypingIndicator = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  return (
    <div className="text-sm text-gray-500 italic p-2">
      {typingUsers.length === 1 
        ? `${typingUsers[0]} is typing...`
        : `${typingUsers.join(', ')} are typing...`
      }
    </div>
  );
};

// Message Component
const Message = ({ message, isOwnMessage }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`mb-3 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
      <div className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isOwnMessage 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-200 text-gray-800'
      }`}>
        {!isOwnMessage && (
          <div className="text-xs font-semibold mb-1 opacity-75">
            {message.username}
          </div>
        )}
        <div className="break-words">{message.content}</div>
        <div className={`text-xs mt-1 opacity-75`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};

// Message List Component
const MessageList = ({ messages, currentUserId, typingUsers }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          isOwnMessage={message.userId === currentUserId}
        />
      ))}
      <TypingIndicator typingUsers={typingUsers} />
      <div ref={messagesEndRef} />
    </div>
  );
};

// Input Box Component
const InputBox = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    if (message.trim().length === 0 || isSending || disabled) {
      return;
    }

    if (message.length > 500) {
      alert('Message is too long (max 500 characters)');
      return;
    }

    setIsSending(true);
    await onSendMessage(message);
    setMessage('');
    setIsSending(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t">
      <div className="flex space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled || isSending}
          maxLength={500}
        />
        <button
          onClick={handleSubmit}
          disabled={message.trim().length === 0 || isSending || disabled}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? '...' : 'Send'}
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {message.length}/500 characters
      </div>
    </div>
  );
};

// Main Chat Component
const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      setCurrentUserId(socket.id);
      setError('');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Message events
    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('message_history', (history) => {
      setMessages(history);
    });

    // User events
    socket.on('user_joined', (data) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        content: `${data.username} joined the chat`,
        username: 'System',
        timestamp: data.timestamp,
        userId: 'system',
        isSystem: true
      }]);
    });

    socket.on('user_left', (data) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        content: `${data.username} left the chat`,
        username: 'System',
        timestamp: data.timestamp,
        userId: 'system',
        isSystem: true
      }]);
    });

    socket.on('user_count', (count) => {
      setUserCount(count);
    });

    // Typing events
    socket.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUsers((prev) => [...prev.filter(user => user !== data.username), data.username]);
      } else {
        setTypingUsers((prev) => prev.filter(user => user !== data.username));
      }
    });

    // Error handling
    socket.on('error', (errorData) => {
      setError(errorData.message);
      setTimeout(() => setError(''), 5000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive_message');
      socket.off('message_history');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('user_count');
      socket.off('user_typing');
      socket.off('error');
    };
  }, []);

  const handleUsernameSubmit = (newUsername) => {
    setUsername(newUsername);
    setShowUsernameModal(false);
    socket.emit('user_join', { username: newUsername });
  };

  const sendMessage = async (messageContent) => {
    socket.emit('send_message', { content: messageContent });
  };

  const handleInputChange = () => {
    socket.emit('typing_start');
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop');
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col bg-white shadow-2xl border">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Chat App</h2>
          <p className="text-sm text-gray-600">{userCount} users online</p>
        </div>
        <ConnectionStatus isConnected={isConnected} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList 
        messages={messages} 
        currentUserId={currentUserId}
        typingUsers={typingUsers}
      />

      {/* Input */}
      <InputBox 
        onSendMessage={sendMessage} 
        disabled={!isConnected || !username}
      />

      {/* Username Modal */}
      <UsernameModal 
        onSubmit={handleUsernameSubmit}
        isVisible={showUsernameModal}
      />
    </div>
  );
};

export default ChatBox;