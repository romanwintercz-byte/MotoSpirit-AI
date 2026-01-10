
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Listen for changes in localStorage to update profile pic
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('motospirit_user');
      if (saved) setUser(JSON.parse(saved));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  const navItems = [
    { path: '/', label: 'Domů', icon: 'fa-home' },
    { path: '/garage', label: 'Garáž', icon: 'fa-motorcycle' },
    { path: '/planner', label: 'Plánovač', icon: 'fa-map-location-dot' },
    { path: '/assistant', label: 'AI Asistent', icon: 'fa-robot' },
  ];

  return (
    <nav className="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <i className="fas fa-helmet-safety text-white text-xl"></i>
          </div>
          <span className="font-brand text-2xl font-bold tracking-tighter text-white">
            MOTO<span className="text-orange-500">SPIRIT</span>
          </span>
        </Link>
        
        <div className="hidden md:flex gap-8">
          {navItems.map(item => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center gap-2 font-semibold transition-colors ${
                location.pathname === item.path ? 'text-orange-500' : 'text-slate-300 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon}`}></i>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button className="bg-slate-700 hover:bg-slate-600 p-2 rounded-full transition-colors hidden sm:block">
            <i className="fas fa-bell"></i>
          </button>
          <Link to="/garage" className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-white overflow-hidden border-2 border-slate-700 shadow-lg">
            {user?.avatar ? (
              <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
            ) : (
              user?.name ? user.name[0].toUpperCase() : 'R'
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
