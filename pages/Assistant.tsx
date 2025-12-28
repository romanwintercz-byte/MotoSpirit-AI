
import React, { useState, useRef, useEffect } from 'react';
import { getBikerAdvice } from '../services/geminiService';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Čau rider! Jsem MotoSpirit. Potřebuješ poradit s technikou jízdy, servisem nebo výběrem helmy? Ptej se na cokoliv!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await getBikerAdvice(userMsg, messages);
      setMessages(prev => [...prev, { role: 'model', text: response || 'Omlouvám se, něco se pokazilo.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: 'Chyba připojení k AI mozku.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-700 p-4 flex items-center gap-4 border-b border-slate-600">
        <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
          <i className="fas fa-robot text-white text-xl"></i>
        </div>
        <div>
          <h2 className="font-bold text-lg">MotoSpirit AI</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-xs text-slate-400">Online | Expert na motorky</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white rounded-tr-none' 
                : 'bg-slate-700 text-slate-100 rounded-tl-none border border-slate-600'
            } shadow-md`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 p-4 rounded-2xl rounded-tl-none flex gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-700">
        <div className="flex gap-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Napiš zprávu..."
            className="flex-grow bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 p-4 rounded-xl transition-all"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-2">
          AI může dělat chyby. Vždy se řiď návodem k obsluze tvého motocyklu.
        </p>
      </div>
    </div>
  );
};

export default Assistant;
