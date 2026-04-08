import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ClassData } from '../types';
import ClassDetail from './ClassDetail';
import { Plus, X } from 'lucide-react';
import { getPromotedGrade, shouldPromote } from '../lib/gradeUtils';

export default function ClassesView({ user }: { user: User }) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', grade: '', school: '' });

  useEffect(() => {
    const q = query(collection(db, 'classes'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classList: ClassData[] = [];
      snapshot.forEach((doc) => {
        classList.push({ id: doc.id, ...doc.data() } as ClassData);
      });
      setClasses(classList);
      
      // Automatic Grade Promotion Logic (7/1)
      const now = new Date();
      const currentYear = now.getFullYear();
      
      classList.forEach(async (cls) => {
        if (shouldPromote(cls.lastPromotedYear, cls.createdAt)) {
          const newGrade = getPromotedGrade(cls.grade);
          if (newGrade !== cls.grade) {
            try {
              const classRef = doc(db, 'classes', cls.id!);
              await updateDoc(classRef, {
                grade: newGrade,
                lastPromotedYear: currentYear
              });
              console.log(`Class ${cls.name} promoted to ${newGrade}`);
            } catch (err) {
              console.error(`Failed to promote class ${cls.name}`, err);
            }
          } else {
            // If grade didn't change (e.g. already graduated), just update the year to avoid re-checking
            try {
              const classRef = doc(db, 'classes', cls.id!);
              await updateDoc(classRef, {
                lastPromotedYear: currentYear
              });
            } catch (err) {
              console.error(`Failed to update promotion year for class ${cls.name}`, err);
            }
          }
        }
      });
      
      // Sync selected class if it's currently open
      if (selectedClass) {
        const updated = classList.find(c => c.id === selectedClass.id);
        if (updated) setSelectedClass(updated);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'classes');
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name || !newClass.grade) return;

    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const isPastPromotionDay = currentMonth > 7 || (currentMonth === 7 && now.getDate() >= 1);
      const promotionYear = isPastPromotionDay ? currentYear : currentYear - 1;

      await addDoc(collection(db, 'classes'), {
        userId: user.uid,
        name: newClass.name,
        grade: newClass.grade,
        school: newClass.school,
        lastPromotedYear: promotionYear,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewClass({ name: '', grade: '', school: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    }
  };

  if (selectedClass) {
    return <ClassDetail classData={selectedClass} onBack={() => setSelectedClass(null)} user={user} />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-[#4a6b46] pb-2 gap-4">
        <h2 className="text-xl text-[#c4e8b7] tracking-widest">班級管理</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-2 bg-[#4a6b46]/20 border border-[#4a6b46] px-4 py-2 hover:bg-[#d97b29] hover:text-black hover:border-[#d97b29] transition-colors text-sm w-full sm:w-auto justify-center"
        >
          <Plus size={16} />
          <span>新增班級</span>
        </button>
      </div>

      {isAdding && (
        <div className="mb-6 p-4 border border-[#73ff4b] bg-[#0a1108] relative">
          <button onClick={() => setIsAdding(false)} className="absolute top-2 right-2 hover:text-[#d97b29]">
            <X size={20} />
          </button>
          <h3 className="text-[#73ff4b] mb-4">初始化新班級</h3>
          <form onSubmit={handleAddClass} className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder="班級名稱" 
              value={newClass.name}
              onChange={(e) => setNewClass({...newClass, name: e.target.value})}
              className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none flex-1"
              required
            />
            <input 
              type="text" 
              placeholder="年級 (例: 高一)" 
              value={newClass.grade}
              onChange={(e) => setNewClass({...newClass, grade: e.target.value})}
              className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none md:w-32"
              required
            />
            <input 
              type="text" 
              placeholder="學校" 
              value={newClass.school}
              onChange={(e) => setNewClass({...newClass, school: e.target.value})}
              className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none flex-1"
            />
            <button type="submit" className="bg-[#4a6b46]/20 border border-[#4a6b46] p-2 md:px-6 hover:bg-[#73ff4b] hover:text-black transition-colors">
              確認
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {classes.map(cls => (
          <div 
            key={cls.id} 
            onClick={() => setSelectedClass(cls)}
            className="border border-[#4a6b46] p-4 cursor-pointer hover:border-[#d97b29] hover:bg-[#4a6b46]/10 transition-all group relative"
          >
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#73ff4b] opacity-0 group-hover:opacity-100"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#73ff4b] opacity-0 group-hover:opacity-100"></div>
            
            <h3 className="text-lg text-[#c4e8b7] font-bold mb-2 group-hover:text-[#d97b29] truncate">{cls.name}</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-[#4a6b46]">年級:</span> {cls.grade}</p>
              <p className="truncate"><span className="text-[#4a6b46]">學校:</span> {cls.school || '無'}</p>
            </div>
          </div>
        ))}
        {classes.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-10 text-[#4a6b46]">
            未偵測到班級。請初始化新班級以開始。
          </div>
        )}
      </div>
    </div>
  );
}
