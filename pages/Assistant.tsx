
import React, { useState, useRef, useEffect } from 'react';
import { getBikerAdvice } from '../services/geminiService';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('motospirit_chat');
    return saved ? JSON.parse(saved) : [
      { role: 'model', text: 'Čau rider! Jsem MotoSpirit. Potřebuješ poradit se servisem, technikou jízdy, nebo jen pokecat o mašinách?' }
    ];
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('motospirit_chat', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await getBikerAdvice(userMsg, messages);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: '❌ Systém je přetížen nebo vyžaduje placený API klíč.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-slate-800/50 rounded-[2.5rem] border border-slate-700 overflow-hidden shadow-2xl animate-fadeIn">
      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-3xl ${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white rounded-tr-none' 
                : 'bg-slate-900/80 text-slate-100 rounded-tl-none border border-slate-700'
            } shadow-xl`}>
              <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900/80 p-5 rounded-3xl rounded-tl-none border border-slate-700 flex gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-slate-900/50 border-t border-slate-700">
        <div className="flex gap-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Napiš MotoSpiritovi..."
            className="flex-grow bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90"
          >
            <i className="fas fa-paper-plane text-white text-lg"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
