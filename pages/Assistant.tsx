
import React, { useState, useRef, useEffect } from 'react';
import { getBikerAdvice } from '../services/geminiService';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('motospirit_chat');
    return saved ? JSON.parse(saved) : [
      { role: 'model', text: 'Čau rider! Jsem MotoSpirit. Jak ti můžu dneska pomoct s tvou mašinou?' }
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
      setMessages(prev => [...prev, { role: 'model', text: response || 'Omlouvám se, motor AI vynechal.' }]);
    } catch (err: any) {
      let errorMsg = 'Chyba připojení. Zkontroluj Engine Status na úvodní stránce.';
      if (err.message === "MISSING_API_KEY") {
        errorMsg = 'AI klíč není aktivní. Klikni na "Aktivovat AI" na úvodní obrazovce.';
      }
      setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm("Smazat historii chatu z mobilu?")) {
      setMessages([{ role: 'model', text: 'Historie smazána. Jak můžu pomoct?' }]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-10rem)] flex flex-col glass-panel rounded-3xl overflow-hidden shadow-2xl animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-800/80 p-4 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center shadow-lg">
            <i className="fas fa-robot text-white"></i>
          </div>
          <div>
            <h2 className="font-bold">MotoSpirit AI</h2>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Aktivní systém</p>
          </div>
        </div>
        <button onClick={clearChat} className="text-slate-500 hover:text-red-500 p-2 transition-colors">
          <i className="fas fa-trash-can"></i>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] p-4 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white rounded-tr-none shadow-orange-900/20' 
                : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
            } shadow-lg`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none flex gap-2 border border-slate-700">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900/80 border-t border-slate-800">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ptej se na servis nebo techniku..."
            className="flex-grow bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
