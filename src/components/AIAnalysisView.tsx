import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ClassData, StudentData, QuizScoreData, ExamData } from '../types';
import { GoogleGenAI } from '@google/genai';
import { Brain, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

export default function AIAnalysisView({ user }: { user: User }) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const q = query(collection(db, 'classes'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const classList: ClassData[] = [];
        snapshot.forEach(doc => classList.push({ id: doc.id, ...doc.data() } as ClassData));
        setClasses(classList);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'classes');
      }
    };
    fetchClasses();
  }, [user.uid]);

  const handleAnalyze = async () => {
    if (!selectedClassId) return;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setAnalysis('錯誤：未偵測到 Gemini API Key。請在系統設定中配置 API 金鑰後再試。');
      return;
    }

    setIsAnalyzing(true);
    setAnalysis('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      // Gather all data for the selected class
      const classData = classes.find(c => c.id === selectedClassId);
      
      const studentsQ = query(
        collection(db, 'students'), 
        where('classId', '==', selectedClassId),
        where('userId', '==', user.uid)
      );
      const studentsSnap = await getDocs(studentsQ);
      const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentData));

      const scoresQ = query(
        collection(db, 'quizScores'), 
        where('classId', '==', selectedClassId),
        where('userId', '==', user.uid)
      );
      const scoresSnap = await getDocs(scoresQ);
      const scores = scoresSnap.docs.map(d => d.data() as QuizScoreData);

      const examsQ = query(
        collection(db, 'exams'), 
        where('classId', '==', selectedClassId),
        where('userId', '==', user.uid)
      );
      const examsSnap = await getDocs(examsQ);
      const exams = examsSnap.docs.map(d => d.data() as ExamData);

      const logsQ = query(
        collection(db, 'classLogs'), 
        where('classId', '==', selectedClassId),
        where('userId', '==', user.uid)
      );
      const logsSnap = await getDocs(logsQ);
      const logs = logsSnap.docs.map(d => d.data() as any); // Using any or importing ClassLogData

      // Prepare prompt
      const prompt = `
        您是一位親切且專業的教學助理。請根據下方的班級數據，提供老師實用的建議與分析。
        
        ${question ? `老師特別想問的問題是：「${question}」\n請優先針對這個問題進行回答與分析。` : '請分析哪些學生需要特別輔導、建議具體的教學干預措施，並針對即將到來的考試評估班級進度。'}
        
        回覆風格請保持自然、親切，像是一般的 AI 對話回覆，不要太過生硬或像正式的戰略報告。
        請使用 Markdown 格式。
        重要：必須使用繁體中文回答。

        班級資訊：
        名稱：${classData?.name}
        年級：${classData?.grade}
        學校：${classData?.school}
        學校特色：${classData?.schoolFeatures}
        目前進度：${classData?.currentProgress}
        下次小考內容：${classData?.nextQuizContent}

        課程日誌（進度歷史與備註）：
        ${logs.sort((a,b) => b.date.localeCompare(a.date)).map(l => `- ${l.date}: ${l.content}${l.notes ? ` (備註: ${l.notes})` : ''}${l.studentEvents ? ` [學生狀況: ${Object.entries(l.studentEvents).map(([sid, e]) => `${students.find(st => st.id === sid)?.name || '未知'}: ${e}`).join(', ')}]` : ''}`).join('\n')}

        即將到來的考試：
        ${exams.map(e => `- ${e.name} 於 ${e.date} (範圍: ${e.scope})`).join('\n')}

        學生狀態與備註：
        ${students.map(s => `- ${s.name}: ${s.status || '無狀態'}${s.notes ? ` (備註: ${s.notes})` : ''}`).join('\n')}

        近期小考成績：
        ${scores.map(s => {
          const studentName = students.find(st => st.id === s.studentId)?.name || '未知';
          return `- ${studentName} 於 ${s.date} 得到 ${s.score} 分`;
        }).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAnalysis(response.text || 'No analysis generated.');
    } catch (error: any) {
      console.error("AI Analysis Error", error);
      if (error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'multiple collections');
      }
      setAnalysis('錯誤：無法生成分析。請檢查系統權限或日誌。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 border-b border-[#4a6b46] pb-2">
        <h2 className="text-xl text-[#c4e8b7] tracking-widest flex items-center">
          <Brain className="mr-2" /> AI 教學分析建議
        </h2>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-[#0a1108] border border-[#4a6b46] p-2 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none flex-1"
          >
            <option value="">選擇要分析的班級</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
          </select>
          <button 
            onClick={handleAnalyze}
            disabled={!selectedClassId || isAnalyzing}
            className="bg-[#4a6b46]/20 border border-[#4a6b46] p-2 md:px-6 hover:bg-[#73ff4b] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isAnalyzing ? <Loader2 className="animate-spin mr-2" size={16} /> : <Brain className="mr-2" size={16} />}
            {isAnalyzing ? '分析中...' : '開始分析'}
          </button>
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-xs text-[#4a6b46] uppercase tracking-widest">提問區 (選填)</label>
          <textarea 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：請幫我分析陳小明的成績趨勢，或是針對下次段考範圍給予教學建議..."
            className="w-full bg-[#0a1108] border border-[#4a6b46] p-3 text-[#c4e8b7] focus:border-[#73ff4b] focus:outline-none min-h-[80px] text-sm"
          />
        </div>
      </div>

      <div className="flex-1 border border-[#4a6b46] bg-[#0a1108]/80 p-6 overflow-y-auto relative">
        {!analysis && !isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center text-[#4a6b46] text-center p-4">
            請選擇班級並輸入問題（選填），然後點擊「開始分析」
          </div>
        )}
        
        {isAnalyzing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#73ff4b]">
            <Loader2 className="animate-spin mb-4" size={32} />
            <div className="tracking-widest animate-pulse text-center">正在為您分析數據...</div>
          </div>
        )}

        {analysis && !isAnalyzing && (
          <div className="prose prose-invert prose-p:text-[#8b9e87] prose-headings:text-[#c4e8b7] prose-strong:text-[#d97b29] prose-ul:text-[#8b9e87] max-w-none">
            <Markdown>{analysis}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
