import { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Dashboard from './components/Dashboard';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a1108] text-[#ff4b4b] flex flex-col items-center justify-center font-mono p-4">
          <div className="border border-[#ff4b4b] p-8 max-w-2xl w-full">
            <h1 className="text-2xl mb-4">系統發生錯誤</h1>
            <pre className="bg-black/50 p-4 overflow-auto text-xs whitespace-pre-wrap">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 border border-[#ff4b4b] hover:bg-[#ff4b4b] hover:text-black transition-colors"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Auth state change error:", error);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1108] text-[#8b9e87] flex items-center justify-center font-mono">
        <div className="text-2xl animate-pulse">系統初始化中...</div>
      </div>
    );
  }

  const content = !user ? (
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
  ) : (
    <Dashboard user={user} onLogout={logout} />
  );

  return (
    <ErrorBoundary>
      {content}
    </ErrorBoundary>
  );
}
