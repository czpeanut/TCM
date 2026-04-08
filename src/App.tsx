import { useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1108] text-[#8b9e87] flex items-center justify-center font-mono">
        <div className="text-2xl animate-pulse">系統初始化中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a1108] text-[#8b9e87] flex flex-col items-center justify-center font-mono p-4">
        <div className="border border-[#4a6b46] p-8 max-w-md w-full relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#73ff4b]"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#73ff4b]"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#73ff4b]"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#73ff4b]"></div>
          
          <h1 className="text-3xl text-[#c4e8b7] mb-6 text-center tracking-widest">班級<br/><span className="text-xl text-[#8b9e87]">資訊管理系統</span></h1>
          <p className="text-center mb-8 text-sm">存取受限。需要身分驗證。</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-[#4a6b46]/20 border border-[#4a6b46] hover:bg-[#d97b29] hover:text-black hover:border-[#d97b29] transition-colors py-3 font-bold tracking-wider"
          >
            授權存取
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} onLogout={logout} />;
}
