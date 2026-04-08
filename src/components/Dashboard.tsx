import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { LogOut, Users, Brain, BookOpen, Menu, Shield, UserCircle } from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfileData } from '../types';
import ClassesView from './ClassesView';
import AdminView from './AdminView';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type ViewState = 'CLASSES' | 'ADMIN';

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<ViewState>('CLASSES');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [tempTeacherName, setTempTeacherName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isAdmin = user.email === 'ssonic551@gmail.com';

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'userProfiles', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfileData);
        setShowProfileSetup(false);
      } else {
        setShowProfileSetup(true);
      }
    });
    return () => unsub();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempTeacherName.trim()) return;
    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, 'userProfiles', user.uid), {
        teacherName: tempTeacherName.trim(),
        email: user.email,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1108] text-[#8b9e87] font-mono flex flex-col">
      {/* Profile Setup Modal */}
      {showProfileSetup && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0a1108] border border-[#73ff4b] p-8 max-w-md w-full relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#73ff4b]"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#73ff4b]"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#73ff4b]"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#73ff4b]"></div>
            
            <h2 className="text-xl text-[#73ff4b] mb-6 tracking-widest flex items-center">
              <UserCircle className="mr-2" /> 初始化教師資訊
            </h2>
            <p className="text-sm mb-6 text-[#8b9e87]">歡迎使用系統。請先設定您的教師名稱，這將用於日誌與分析識別。</p>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs text-[#4a6b46] mb-1">教師姓名</label>
                <input 
                  type="text" 
                  value={tempTeacherName}
                  onChange={(e) => setTempTeacherName(e.target.value)}
                  placeholder="例如: 王小明 老師"
                  className="w-full bg-transparent border border-[#4a6b46] p-3 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isSavingProfile}
                className="w-full bg-[#4a6b46]/20 border border-[#4a6b46] hover:bg-[#73ff4b] hover:text-black transition-colors py-3 font-bold disabled:opacity-50"
              >
                {isSavingProfile ? '儲存中...' : '確認進入系統'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-[#4a6b46] p-4 flex justify-between items-center bg-[#0a1108] relative z-20">
        <div className="flex items-center space-x-2 md:space-x-4">
          <button 
            className="md:hidden text-[#73ff4b] hover:text-[#d97b29]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl md:text-2xl text-[#73ff4b] tracking-widest font-bold flex items-center">
            班級<span className="text-sm text-[#8b9e87] ml-2 font-normal hidden sm:inline">資訊管理系統</span>
          </h1>
          <div className="hidden md:block h-6 w-px bg-[#4a6b46] mx-4"></div>
          <span className="hidden md:inline text-sm tracking-widest">DODnetSYSTEMS &gt;&gt;</span>
        </div>
        <div className="flex items-center space-x-4 md:space-x-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs text-[#73ff4b]">{userProfile?.teacherName || '未設定'}</span>
            <span className="text-[10px] text-[#4a6b46]">{user.email?.toUpperCase()}</span>
          </div>
          <button onClick={onLogout} className="flex items-center space-x-2 hover:text-[#d97b29] transition-colors">
            <LogOut size={16} />
            <span className="text-sm hidden sm:inline">登出</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 absolute md:static top-0 left-0 h-full w-48 border-r border-[#4a6b46] p-4 flex flex-col space-y-2 bg-[#0a1108] z-10 transition-transform duration-300 ease-in-out`}>
          <div className="absolute top-4 right-0 w-2 h-8 bg-[#73ff4b] hidden md:block"></div>
          <div className="text-xs mb-4 text-[#4a6b46]">選單</div>
          
          <button 
            onClick={() => { setCurrentView('CLASSES'); setIsMobileMenuOpen(false); }}
            className={`text-left p-2 border border-transparent hover:border-[#4a6b46] transition-colors flex items-center space-x-2 ${currentView === 'CLASSES' ? 'bg-[#d97b29] text-black font-bold' : ''}`}
          >
            <BookOpen size={16} />
            <span>班級管理</span>
          </button>

          {isAdmin && (
            <button 
              onClick={() => { setCurrentView('ADMIN'); setIsMobileMenuOpen(false); }}
              className={`text-left p-2 border border-transparent hover:border-[#4a6b46] transition-colors flex items-center space-x-2 ${currentView === 'ADMIN' ? 'bg-[#d97b29] text-black font-bold' : ''}`}
            >
              <Shield size={16} />
              <span>管理員後台</span>
            </button>
          )}
        </aside>

        {/* Overlay for mobile menu */}
        {isMobileMenuOpen && (
          <div 
            className="absolute inset-0 bg-black/50 z-0 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-2 md:p-6 overflow-y-auto relative w-full">
          {/* Decorative Corners - Hidden on very small screens */}
          <div className="hidden sm:block absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-[#4a6b46] pointer-events-none"></div>
          <div className="hidden sm:block absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-[#4a6b46] pointer-events-none"></div>
          <div className="hidden sm:block absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-[#4a6b46] pointer-events-none"></div>
          <div className="hidden sm:block absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-[#4a6b46] pointer-events-none"></div>

          <div className="h-full p-2 md:p-4 border border-[#4a6b46]/30 bg-[#0a1108]/50 overflow-x-hidden">
            {currentView === 'CLASSES' && <ClassesView user={user} />}
            {currentView === 'ADMIN' && isAdmin && <AdminView user={user} />}
          </div>
        </main>
      </div>
    </div>
  );
}
