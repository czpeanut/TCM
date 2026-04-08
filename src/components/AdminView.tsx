import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ClassData, ClassLogData, UserProfileData } from '../types';
import { Search, Shield, User as UserIcon, Calendar, ChevronRight, Users, BookOpen } from 'lucide-react';

export default function AdminView({ user }: { user: User }) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [logs, setLogs] = useState<ClassLogData[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfileData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all user profiles
    const qProfiles = query(collection(db, 'userProfiles'), orderBy('updatedAt', 'desc'));
    const unsubProfiles = onSnapshot(qProfiles, (snapshot) => {
      const list: UserProfileData[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as UserProfileData));
      setUserProfiles(list);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'userProfiles'));

    // Fetch all classes
    const qClasses = query(collection(db, 'classes'), orderBy('createdAt', 'desc'));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      const list: ClassData[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ClassData));
      setClasses(list);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classes'));

    // Fetch all logs
    const qLogs = query(collection(db, 'classLogs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list: ClassLogData[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ClassLogData));
      setLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classLogs'));

    return () => {
      unsubProfiles();
      unsubClasses();
      unsubLogs();
    };
  }, []);

  const filteredProfiles = userProfiles.filter(p => 
    p.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProfile = userProfiles.find(p => p.id === selectedUserId);
  const displayClasses = selectedUserId ? classes.filter(c => c.userId === selectedUserId) : [];
  const displayLogs = selectedUserId ? logs.filter(l => l.userId === selectedUserId) : [];

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-[#4a6b46]">正在讀取全局數據...</div>;
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#d97b29] pb-2 gap-4">
        <h2 className="text-xl text-[#d97b29] flex items-center tracking-widest">
          <Shield className="mr-2" size={20} /> 管理員後台
        </h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#4a6b46]" size={16} />
          <input 
            type="text" 
            placeholder="搜尋老師名稱、Email 或 ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#0a1108] border border-[#4a6b46] pl-8 pr-4 py-1 text-sm text-[#c4e8b7] focus:border-[#d97b29] focus:outline-none w-full md:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
        {/* User Selection List */}
        <div className="lg:col-span-1 flex flex-col space-y-4 border-r border-[#4a6b46]/30 pr-4">
          <h3 className="text-[#73ff4b] text-sm font-bold flex items-center">
            <Users size={14} className="mr-2" /> 老師列表 ({userProfiles.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
            {filteredProfiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => setSelectedUserId(profile.id!)}
                className={`w-full text-left p-3 border transition-colors group ${selectedUserId === profile.id ? 'border-[#d97b29] bg-[#d97b29]/10' : 'border-[#4a6b46]/30 bg-[#0a1108]/50 hover:border-[#4a6b46]'}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-[#c4e8b7]">{profile.teacherName}</div>
                  <ChevronRight size={14} className={selectedUserId === profile.id ? 'text-[#d97b29]' : 'text-[#4a6b46]'} />
                </div>
                <div className="text-[10px] text-[#4a6b46] mt-1 truncate">{profile.email}</div>
                <div className="text-[9px] text-[#4a6b46]/60 mt-0.5 font-mono">ID: {profile.id}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected User Data */}
        <div className="lg:col-span-2 flex flex-col space-y-6 overflow-hidden">
          {!selectedUserId ? (
            <div className="h-full flex flex-col items-center justify-center text-[#4a6b46] space-y-4 border border-dashed border-[#4a6b46]/30 rounded-lg">
              <UserIcon size={48} className="opacity-20" />
              <p>請從左側選擇一位老師以查看詳細資料</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2 scrollbar-hide">
              <div className="p-4 border border-[#d97b29]/30 bg-[#d97b29]/5">
                <h4 className="text-[#d97b29] font-bold mb-1">{selectedProfile?.teacherName} 的教學概況</h4>
                <div className="text-xs text-[#8b9e87] flex space-x-4">
                  <span>班級數: {displayClasses.length}</span>
                  <span>總日誌數: {displayLogs.length}</span>
                </div>
              </div>

              {/* Classes */}
              <div className="space-y-3">
                <h3 className="text-[#73ff4b] text-sm font-bold flex items-center">
                  <BookOpen size={14} className="mr-2" /> 班級列表
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayClasses.map(cls => (
                    <div key={cls.id} className="border border-[#4a6b46]/30 p-3 bg-[#0a1108]/50">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-[#c4e8b7] text-sm">{cls.name}</div>
                        <div className="text-[10px] bg-[#4a6b46]/20 px-1 text-[#4a6b46]">{cls.grade}</div>
                      </div>
                      {cls.school && <div className="text-[10px] text-[#8b9e87] mt-1">@{cls.school}</div>}
                    </div>
                  ))}
                  {displayClasses.length === 0 && <div className="col-span-full text-xs text-[#4a6b46] italic">尚無班級資料</div>}
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-3">
                <h3 className="text-[#73ff4b] text-sm font-bold flex items-center">
                  <Calendar size={14} className="mr-2" /> 課程日誌
                </h3>
                <div className="space-y-3">
                  {displayLogs.map(log => {
                    const cls = classes.find(c => c.id === log.classId);
                    return (
                      <div key={log.id} className="border border-[#4a6b46]/30 p-4 bg-[#0a1108]/50">
                        <div className="flex justify-between text-xs text-[#d97b29] mb-2 font-bold">
                          <span>{log.date}</span>
                          <span>{cls?.name || '未知班級'}</span>
                        </div>
                        <div className="text-sm text-[#c4e8b7] whitespace-pre-wrap">{log.content}</div>
                        {log.homework && (
                          <div className="mt-2 pt-2 border-t border-[#4a6b46]/20">
                            <div className="text-[10px] text-[#4a6b46] uppercase">作業</div>
                            <div className="text-xs text-[#8b9e87] italic">{log.homework}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {displayLogs.length === 0 && <div className="text-xs text-[#4a6b46] italic">尚無日誌紀錄</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
