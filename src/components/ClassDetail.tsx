import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ClassData, ExamData, StudentData, QuizScoreData, ClassLogData } from '../types';
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface ClassDetailProps {
  classData: ClassData;
  onBack: () => void;
  user: User;
}

type Tab = 'INFO' | 'EXAMS' | 'STUDENTS' | 'SCORES' | 'LOGS';

const TAB_LABELS: Record<Tab, string> = {
  INFO: '基本資訊',
  EXAMS: '考試日程',
  STUDENTS: '學生名單',
  SCORES: '成績紀錄',
  LOGS: '課程日誌'
};

export default function ClassDetail({ classData, onBack, user }: ClassDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('INFO');
  const [editData, setEditData] = useState<ClassData>(classData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditData(classData);
  }, [classData]);

  // Data states
  const [students, setStudents] = useState<StudentData[]>([]);
  const [exams, setExams] = useState<ExamData[]>([]);
  const [scores, setScores] = useState<QuizScoreData[]>([]);
  const [classLogs, setClassLogs] = useState<ClassLogData[]>([]);

  // New entry states
  const [newStudent, setNewStudent] = useState({ name: '', status: '', notes: '' });
  const [newExam, setNewExam] = useState({ name: '', date: '', scope: '' });
  const [newLog, setNewLog] = useState<{
    date: string;
    content: string;
    homework: string;
    attendance: Record<string, boolean>;
    notes: string;
    studentEvents: Record<string, string>;
  }>({ date: '', content: '', homework: '', attendance: {}, notes: '', studentEvents: {} });
  
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogData, setEditingLogData] = useState<ClassLogData | null>(null);
  const [confirmingDeleteLogId, setConfirmingDeleteLogId] = useState<string | null>(null);

  // Batch score states
  const [batchScoreDate, setBatchScoreDate] = useState('');
  const [batchScores, setBatchScores] = useState<Record<string, string>>({});

  const latestLog = classLogs.length > 0 ? [...classLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null;

  const upcomingExams = exams
    .filter(e => new Date(e.date).getTime() >= new Date().setHours(0,0,0,0))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nearestExam = upcomingExams[0];
  const daysToExam = nearestExam ? Math.ceil((new Date(nearestExam.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;
  const showExamWarning = daysToExam !== null && daysToExam <= 21 && daysToExam >= 0;

  useEffect(() => {
    if (!classData.id) return;

    // Fetch Students
    const qStudents = query(
      collection(db, 'students'), 
      where('classId', '==', classData.id),
      where('userId', '==', user.uid)
    );
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const list: StudentData[] = [];
      const attendanceMap: Record<string, boolean> = {};
      snapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as StudentData;
        list.push(data);
        attendanceMap[doc.id] = true;
      });
      setStudents(list);
      setNewLog(prev => ({ ...prev, attendance: { ...attendanceMap, ...prev.attendance } }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

    // Fetch Exams
    const qExams = query(
      collection(db, 'exams'), 
      where('classId', '==', classData.id),
      where('userId', '==', user.uid)
    );
    const unsubExams = onSnapshot(qExams, (snapshot) => {
      const list: ExamData[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ExamData));
      setExams(list);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'exams'));

    // Fetch Scores
    const qScores = query(
      collection(db, 'quizScores'), 
      where('classId', '==', classData.id),
      where('userId', '==', user.uid)
    );
    const unsubScores = onSnapshot(qScores, (snapshot) => {
      const list: QuizScoreData[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as QuizScoreData));
      setScores(list);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'quizScores'));

    // Fetch Logs
    const qLogs = query(
      collection(db, 'classLogs'), 
      where('classId', '==', classData.id),
      where('userId', '==', user.uid)
    );
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list: ClassLogData[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ClassLogData));
      setClassLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classLogs'));

    return () => {
      unsubStudents();
      unsubExams();
      unsubScores();
      unsubLogs();
    };
  }, [classData.id]);

  const handleUpdateClass = async () => {
    if (!classData.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const isPastPromotionDay = currentMonth > 7 || (currentMonth === 7 && now.getDate() >= 1);
      const promotionYear = isPastPromotionDay ? currentYear : currentYear - 1;

      const classRef = doc(db, 'classes', classData.id);
      await updateDoc(classRef, {
        name: editData.name || '',
        grade: editData.grade || '',
        school: editData.school || '',
        schoolFeatures: editData.schoolFeatures || '',
        currentProgress: editData.currentProgress || '',
        nextQuizContent: editData.nextQuizContent || '',
        lastPromotedYear: promotionYear
      });
    } catch (err) {
      setError('儲存班級資訊失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !classData.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, 'students'), {
        userId: user.uid,
        classId: classData.id,
        name: newStudent.name,
        status: newStudent.status,
        notes: newStudent.notes
      });
      setNewStudent({ name: '', status: '', notes: '' });
    } catch (err) {
      setError('新增學生失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.name || !newExam.date || !classData.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, 'exams'), {
        userId: user.uid,
        classId: classData.id,
        name: newExam.name,
        date: newExam.date,
        scope: newExam.scope
      });
      setNewExam({ name: '', date: '', scope: '' });
    } catch (err) {
      setError('新增考試日程失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'exams', examId));
    } catch (err) {
      setError('刪除考試日程失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSaveScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchScoreDate || !classData.id) return;
    
    setIsSaving(true);
    setError(null);
    try {
      const promises = Object.entries(batchScores).map(([studentId, scoreStr]) => {
        if (!scoreStr) return Promise.resolve();
        return addDoc(collection(db, 'quizScores'), {
          userId: user.uid,
          classId: classData.id,
          studentId,
          date: batchScoreDate,
          score: Number(scoreStr)
        });
      });
      await Promise.all(promises);
      setBatchScoreDate('');
      setBatchScores({});
    } catch (err) {
      setError('儲存成績失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.date || !newLog.content || !classData.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, 'classLogs'), {
        userId: user.uid,
        classId: classData.id,
        date: newLog.date,
        content: newLog.content,
        homework: newLog.homework,
        attendance: newLog.attendance,
        notes: newLog.notes,
        studentEvents: newLog.studentEvents,
        createdAt: new Date()
      });
      setNewLog({ 
        date: '', 
        content: '', 
        homework: '', 
        attendance: students.reduce((acc, s) => ({ ...acc, [s.id!]: true }), {}),
        notes: '',
        studentEvents: {}
      });
    } catch (err) {
      setError('新增日誌失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLogId || !editingLogData || !classData.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const logRef = doc(db, 'classLogs', editingLogId);
      await updateDoc(logRef, {
        date: editingLogData.date,
        content: editingLogData.content,
        homework: editingLogData.homework || '',
        attendance: editingLogData.attendance || {},
        notes: editingLogData.notes || '',
        studentEvents: editingLogData.studentEvents || {}
      });
      setEditingLogId(null);
      setEditingLogData(null);
    } catch (err) {
      setError('更新日誌失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'classLogs', logId));
      setConfirmingDeleteLogId(null);
    } catch (err) {
      setError('刪除日誌失敗');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-[#4a6b46] pb-2 gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="hover:text-[#d97b29] transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl text-[#c4e8b7] tracking-widest truncate">{editData.name} <span className="text-sm text-[#4a6b46]">[{editData.grade}]</span></h2>
        </div>
        <div className="flex space-x-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm border whitespace-nowrap shrink-0 ${activeTab === tab ? 'border-[#d97b29] text-[#d97b29] bg-[#d97b29]/10' : 'border-[#4a6b46] hover:border-[#73ff4b]'}`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 border border-red-500 bg-red-500/10 text-red-500 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-white">✕</button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-2">
        
        {/* INFO TAB */}
        {activeTab === 'INFO' && (
          <div className="space-y-6">
            {showExamWarning && (
              <div className="p-4 border border-[#d97b29] bg-[#d97b29]/10 text-[#d97b29] flex items-start space-x-3">
                <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                <div>
                  <div className="font-bold mb-1">考試時間將近 ({nearestExam.date} - {nearestExam.name})</div>
                  <div className="text-sm">請確認進度是否已經教授完畢。</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs text-[#4a6b46] mb-1">班級名稱</label>
                <input 
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full p-2 border border-[#4a6b46] bg-[#0a1108] focus:border-[#73ff4b] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#4a6b46] mb-1">年級</label>
                <input 
                  type="text"
                  value={editData.grade || ''}
                  onChange={(e) => setEditData({...editData, grade: e.target.value})}
                  className="w-full p-2 border border-[#4a6b46] bg-[#0a1108] focus:border-[#73ff4b] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#4a6b46] mb-1">學校</label>
                <input 
                  type="text"
                  value={editData.school || ''}
                  onChange={(e) => setEditData({...editData, school: e.target.value})}
                  className="w-full p-2 border border-[#4a6b46] bg-[#0a1108] focus:border-[#73ff4b] focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-[#4a6b46] mb-1">學校考試特色</label>
              <textarea 
                value={editData.schoolFeatures || ''}
                onChange={(e) => setEditData({...editData, schoolFeatures: e.target.value})}
                className="w-full p-2 border border-[#4a6b46] bg-[#0a1108] focus:border-[#73ff4b] focus:outline-none h-24 resize-none"
                placeholder="輸入學校考試特色..."
              />
            </div>

            <div>
              <label className="block text-xs text-[#4a6b46] mb-1">目前進度 (自動抓取最新日誌)</label>
              <div className="w-full p-3 border border-[#4a6b46] bg-[#0a1108]/50 text-[#c4e8b7] min-h-[6rem] whitespace-pre-wrap">
                {latestLog ? latestLog.content : '尚無日誌紀錄...'}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#4a6b46] mb-1">下週小考內容</label>
              <textarea 
                value={editData.nextQuizContent || ''}
                onChange={(e) => setEditData({...editData, nextQuizContent: e.target.value})}
                className="w-full p-2 border border-[#4a6b46] bg-[#0a1108] focus:border-[#73ff4b] focus:outline-none h-24 resize-none"
                placeholder="輸入下週小考內容..."
              />
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleUpdateClass}
                disabled={isSaving}
                className="flex items-center justify-center w-full md:w-auto space-x-2 bg-[#4a6b46]/20 border border-[#4a6b46] px-6 py-2 hover:bg-[#d97b29] hover:text-black hover:border-[#d97b29] transition-colors"
              >
                <Save size={16} />
                <span>{isSaving ? '儲存中...' : '儲存變更'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'STUDENTS' && (
          <div>
            <form onSubmit={handleAddStudent} className="flex flex-col md:flex-row gap-4 mb-6 p-4 border border-[#4a6b46] bg-[#0a1108]">
              <input 
                type="text" 
                placeholder="學生姓名" 
                value={newStudent.name}
                onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none md:w-1/4"
                required
              />
              <input 
                type="text" 
                placeholder="狀態" 
                value={newStudent.status}
                onChange={(e) => setNewStudent({...newStudent, status: e.target.value})}
                className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none md:w-1/4"
              />
              <input 
                type="text" 
                placeholder="備註" 
                value={newStudent.notes}
                onChange={(e) => setNewStudent({...newStudent, notes: e.target.value})}
                className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none flex-1"
              />
              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-[#4a6b46]/20 border border-[#4a6b46] p-2 md:px-4 hover:bg-[#73ff4b] hover:text-black transition-colors flex items-center justify-center disabled:opacity-50"
              >
                <Plus size={16} className="mr-2" /> {isSaving ? '處理中...' : '新增'}
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="border-b border-[#4a6b46] text-[#4a6b46] text-xs">
                    <th className="p-2 w-1/4">姓名</th>
                    <th className="p-2 w-1/4">狀態</th>
                    <th className="p-2">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id} className="border-b border-[#4a6b46]/30 hover:bg-[#4a6b46]/10">
                      <td className="p-2 text-[#c4e8b7]">{student.name}</td>
                      <td className="p-2">{student.status || '-'}</td>
                      <td className="p-2 text-xs text-[#8b9e87]">{student.notes || '-'}</td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-[#4a6b46]">未找到學生</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXAMS TAB */}
        {activeTab === 'EXAMS' && (
          <div>
            <form onSubmit={handleAddExam} className="flex flex-col md:flex-row gap-4 mb-6 p-4 border border-[#4a6b46] bg-[#0a1108]">
              <input 
                type="text" 
                placeholder="考試名稱" 
                value={newExam.name}
                onChange={(e) => setNewExam({...newExam, name: e.target.value})}
                className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none md:w-1/4"
                required
              />
              <input 
                type="date" 
                value={newExam.date}
                onChange={(e) => setNewExam({...newExam, date: e.target.value})}
                className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                required
              />
              <input 
                type="text" 
                placeholder="考試範圍" 
                value={newExam.scope}
                onChange={(e) => setNewExam({...newExam, scope: e.target.value})}
                className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none flex-1"
              />
              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-[#4a6b46]/20 border border-[#4a6b46] p-2 md:px-4 hover:bg-[#73ff4b] hover:text-black transition-colors flex items-center justify-center disabled:opacity-50"
              >
                <Plus size={16} className="mr-2" /> {isSaving ? '處理中...' : '新增'}
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#4a6b46] text-[#4a6b46] text-xs">
                    <th className="p-2 w-32">日期</th>
                    <th className="p-2 w-1/4">名稱</th>
                    <th className="p-2">範圍</th>
                    <th className="p-2 w-16 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.sort((a,b) => a.date.localeCompare(b.date)).map(exam => (
                    <tr key={exam.id} className="border-b border-[#4a6b46]/30 hover:bg-[#4a6b46]/10">
                      <td className="p-2 text-[#d97b29]">{exam.date}</td>
                      <td className="p-2 text-[#c4e8b7]">{exam.name}</td>
                      <td className="p-2">{exam.scope || '-'}</td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => handleDeleteExam(exam.id!)}
                          disabled={isSaving}
                          className="text-[#4a6b46] hover:text-red-500 transition-colors disabled:opacity-50"
                          title="刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {exams.length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-[#4a6b46]">未找到考試</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCORES TAB */}
        {activeTab === 'SCORES' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-[#73ff4b] mb-4 font-bold">批次輸入成績</h3>
              <form onSubmit={handleBatchSaveScores} className="p-4 border border-[#4a6b46] bg-[#0a1108]">
                <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm text-[#4a6b46]">測驗日期：</label>
                  <input 
                    type="date" 
                    value={batchScoreDate}
                    onChange={(e) => setBatchScoreDate(e.target.value)}
                    className="bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                    required
                  />
                </div>
                
                {students.length > 0 ? (
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-left border-collapse min-w-[300px]">
                      <thead>
                        <tr className="border-b border-[#4a6b46] text-[#4a6b46] text-xs">
                          <th className="p-2 w-1/2">學生姓名</th>
                          <th className="p-2 w-1/2">成績</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(student => (
                          <tr key={student.id} className="border-b border-[#4a6b46]/30 hover:bg-[#4a6b46]/10">
                            <td className="p-2 text-[#c4e8b7]">{student.name}</td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                min="0" max="100"
                                placeholder="輸入成績"
                                value={batchScores[student.id!] || ''}
                                onChange={(e) => setBatchScores({...batchScores, [student.id!]: e.target.value})}
                                className="bg-transparent border border-[#4a6b46] p-1 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none w-24"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-[#4a6b46] mb-4">請先新增學生名單</div>
                )}
                
                <button 
                  type="submit" 
                  disabled={isSaving || !batchScoreDate || students.length === 0}
                  className="bg-[#4a6b46]/20 border border-[#4a6b46] px-6 py-2 hover:bg-[#73ff4b] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Save size={16} className="mr-2" /> {isSaving ? '儲存中...' : '儲存批次成績'}
                </button>
              </form>
            </div>

            <div>
              <h3 className="text-[#73ff4b] mb-4 font-bold">歷史成績紀錄</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr className="border-b border-[#4a6b46] text-[#4a6b46] text-xs">
                      <th className="p-2 w-32">日期</th>
                      <th className="p-2 w-1/2">學生</th>
                      <th className="p-2">成績</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.sort((a,b) => b.date.localeCompare(a.date)).map(score => {
                      const student = students.find(s => s.id === score.studentId);
                      return (
                        <tr key={score.id} className="border-b border-[#4a6b46]/30 hover:bg-[#4a6b46]/10">
                          <td className="p-2">{score.date}</td>
                          <td className="p-2 text-[#c4e8b7]">{student?.name || '未知'}</td>
                          <td className={`p-2 font-bold ${score.score < 60 ? 'text-red-500' : 'text-[#73ff4b]'}`}>{score.score}</td>
                        </tr>
                      );
                    })}
                    {scores.length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-[#4a6b46]">未找到成績</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'LOGS' && (
          <div className="space-y-6">
            {editingLogId && editingLogData ? (
              <form onSubmit={handleUpdateLog} className="flex flex-col gap-4 p-4 border border-[#d97b29] bg-[#d97b29]/5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[#d97b29] font-bold">編輯日誌</h3>
                  <button type="button" onClick={() => { setEditingLogId(null); setEditingLogData(null); }} className="text-[#4a6b46] hover:text-white">取消</button>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="md:w-1/4">
                    <label className="block text-xs text-[#4a6b46] mb-1">日期</label>
                    <input 
                      type="date" 
                      value={editingLogData.date}
                      onChange={(e) => setEditingLogData({...editingLogData, date: e.target.value})}
                      className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-[#4a6b46] mb-1">課程進度 / 內容</label>
                    <textarea 
                      placeholder="輸入課程進度或日誌內容..." 
                      value={editingLogData.content}
                      onChange={(e) => setEditingLogData({...editingLogData, content: e.target.value})}
                      className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none h-20 resize-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-1">作業內容</label>
                  <textarea 
                    placeholder="輸入作業內容..." 
                    value={editingLogData.homework || ''}
                    onChange={(e) => setEditingLogData({...editingLogData, homework: e.target.value})}
                    className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none h-16 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-1">課堂備註</label>
                  <textarea 
                    placeholder="輸入課堂備註..." 
                    value={editingLogData.notes || ''}
                    onChange={(e) => setEditingLogData({...editingLogData, notes: e.target.value})}
                    className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none h-16 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-2">學生狀況紀錄</label>
                  <div className="space-y-2">
                    {students.map(student => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <span className="text-xs text-[#4a6b46] w-16 shrink-0 truncate">{student.name}</span>
                        <input 
                          type="text"
                          placeholder="紀錄該學生今日狀況..."
                          value={editingLogData.studentEvents?.[student.id!] || ''}
                          onChange={(e) => setEditingLogData({
                            ...editingLogData,
                            studentEvents: { ...editingLogData.studentEvents, [student.id!]: e.target.value }
                          })}
                          className="flex-1 bg-transparent border border-[#4a6b46]/30 p-1 text-xs text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-2">學生出席狀況</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {students.map(student => (
                      <label key={student.id} className="flex items-center space-x-2 cursor-pointer p-2 border border-[#4a6b46]/30 hover:bg-[#4a6b46]/10">
                        <input 
                          type="checkbox"
                          checked={editingLogData.attendance?.[student.id!] ?? true}
                          onChange={(e) => setEditingLogData({
                            ...editingLogData, 
                            attendance: { ...editingLogData.attendance, [student.id!]: e.target.checked }
                          })}
                          className="form-checkbox h-4 w-4 text-[#73ff4b] bg-transparent border-[#4a6b46] rounded focus:ring-0"
                        />
                        <span className="text-sm truncate">{student.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-[#d97b29]/20 border border-[#d97b29] p-2 md:px-8 text-[#d97b29] hover:bg-[#d97b29] hover:text-black transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    <Save size={16} className="mr-2" /> {isSaving ? '儲存中...' : '儲存修改'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddLog} className="flex flex-col gap-4 p-4 border border-[#4a6b46] bg-[#0a1108]">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="md:w-1/4">
                    <label className="block text-xs text-[#4a6b46] mb-1">日期</label>
                    <input 
                      type="date" 
                      value={newLog.date}
                      onChange={(e) => setNewLog({...newLog, date: e.target.value})}
                      className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-[#4a6b46] mb-1">課程進度 / 內容</label>
                    <textarea 
                      placeholder="輸入課程進度或日誌內容..." 
                      value={newLog.content}
                      onChange={(e) => setNewLog({...newLog, content: e.target.value})}
                      className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none h-20 resize-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-1">作業內容</label>
                  <textarea 
                    placeholder="輸入作業內容..." 
                    value={newLog.homework}
                    onChange={(e) => setNewLog({...newLog, homework: e.target.value})}
                    className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none h-16 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-1">課堂備註</label>
                  <textarea 
                    placeholder="輸入課堂備註..." 
                    value={newLog.notes}
                    onChange={(e) => setNewLog({...newLog, notes: e.target.value})}
                    className="w-full bg-transparent border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none h-16 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-2">學生狀況紀錄</label>
                  <div className="space-y-2">
                    {students.map(student => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <span className="text-xs text-[#4a6b46] w-16 shrink-0 truncate">{student.name}</span>
                        <input 
                          type="text"
                          placeholder="紀錄該學生今日狀況..."
                          value={newLog.studentEvents[student.id!] || ''}
                          onChange={(e) => setNewLog({
                            ...newLog,
                            studentEvents: { ...newLog.studentEvents, [student.id!]: e.target.value }
                          })}
                          className="flex-1 bg-transparent border border-[#4a6b46]/30 p-1 text-xs text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#4a6b46] mb-2">學生出席狀況</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {students.map(student => (
                      <label key={student.id} className="flex items-center space-x-2 cursor-pointer p-2 border border-[#4a6b46]/30 hover:bg-[#4a6b46]/10">
                        <input 
                          type="checkbox"
                          checked={newLog.attendance[student.id!] ?? true}
                          onChange={(e) => setNewLog({
                            ...newLog, 
                            attendance: { ...newLog.attendance, [student.id!]: e.target.checked }
                          })}
                          className="form-checkbox h-4 w-4 text-[#73ff4b] bg-transparent border-[#4a6b46] rounded focus:ring-0"
                        />
                        <span className="text-sm truncate">{student.name}</span>
                      </label>
                    ))}
                    {students.length === 0 && <div className="col-span-full text-xs text-[#4a6b46]">請先新增學生名單</div>}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-[#4a6b46]/20 border border-[#4a6b46] p-2 md:px-8 hover:bg-[#73ff4b] hover:text-black transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    <Plus size={16} className="mr-2" /> {isSaving ? '處理中...' : '新增日誌'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {classLogs.sort((a,b) => b.date.localeCompare(a.date)).map(log => (
                <div key={log.id} className="border border-[#4a6b46]/50 p-4 bg-[#0a1108]/50 hover:border-[#73ff4b]/50 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[#d97b29] text-sm font-bold">{log.date}</div>
                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingLogId(log.id!); setEditingLogData(log); }}
                        className="text-[#4a6b46] hover:text-[#73ff4b] transition-colors"
                        title="編輯"
                      >
                        <Save size={16} />
                      </button>
                      {confirmingDeleteLogId === log.id ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-red-500 font-bold">確認刪除？</span>
                          <button 
                            onClick={() => handleDeleteLog(log.id!)}
                            className="text-red-500 hover:text-white bg-red-500/20 px-2 py-0.5 border border-red-500 text-xs"
                          >
                            是
                          </button>
                          <button 
                            onClick={() => setConfirmingDeleteLogId(null)}
                            className="text-[#4a6b46] hover:text-white text-xs"
                          >
                            否
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => { setEditingLogId(log.id!); setEditingLogData(log); }}
                            className="text-[#4a6b46] hover:text-[#73ff4b]"
                            title="編輯"
                          >
                            <Save size={16} />
                          </button>
                          <button 
                            onClick={() => setConfirmingDeleteLogId(log.id!)}
                            className="text-[#4a6b46] hover:text-red-500"
                            title="刪除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <div className="text-xs text-[#4a6b46] mb-1 uppercase tracking-tighter">課程進度</div>
                      <div className="text-[#c4e8b7] whitespace-pre-wrap mb-4">{log.content}</div>
                      
                      {log.homework && (
                        <div className="mb-4">
                          <div className="text-xs text-[#4a6b46] mb-1 uppercase tracking-tighter">作業內容</div>
                          <div className="text-[#8b9e87] whitespace-pre-wrap italic">{log.homework}</div>
                        </div>
                      )}

                      {log.notes && (
                        <div className="mb-4 p-2 bg-[#4a6b46]/5 border-l-2 border-[#4a6b46]">
                          <div className="text-xs text-[#4a6b46] mb-1 uppercase tracking-tighter">課堂備註</div>
                          <div className="text-xs text-[#8b9e87] italic">{log.notes}</div>
                        </div>
                      )}

                      {log.studentEvents && Object.values(log.studentEvents).some(v => v) && (
                        <div className="mb-4">
                          <div className="text-xs text-[#4a6b46] mb-1 uppercase tracking-tighter">學生狀況紀錄</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            {Object.entries(log.studentEvents).map(([sid, event]) => {
                              if (!event) return null;
                              const s = students.find(st => st.id === sid);
                              return (
                                <div key={sid} className="text-[11px] flex space-x-2">
                                  <span className="text-[#d97b29] shrink-0">[{s?.name || '未知'}]:</span>
                                  <span className="text-[#8b9e87]">{event}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-l border-[#4a6b46]/30 pl-4">
                      <div className="text-xs text-[#4a6b46] mb-2 uppercase tracking-tighter">出席狀況</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {students.map(s => {
                          const isPresent = log.attendance?.[s.id!] ?? true;
                          return (
                            <div key={s.id} className="flex items-center space-x-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${isPresent ? 'bg-[#73ff4b]' : 'bg-red-500'}`}></div>
                              <span className={`text-xs ${isPresent ? 'text-[#8b9e87]' : 'text-red-500/70 line-through'}`}>{s.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {classLogs.length === 0 && (
                <div className="p-4 text-center text-[#4a6b46] border border-[#4a6b46]/30">未找到課程日誌</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
