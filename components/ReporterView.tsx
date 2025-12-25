import React, { useState, useEffect } from 'react';
import { UserProfile, IncidentReport, TIME_SLOTS, getTodayString, normalizeDate } from '../types';
import { saveReport, getMyReports, deleteReport } from '../services/storageService';
import { Send, Trash2, History, Calendar, Loader2, AlertTriangle } from 'lucide-react';

interface ReporterViewProps {
  user: UserProfile;
}

const ReporterView: React.FC<ReporterViewProps> = ({ user }) => {
  const [date, setDate] = useState(getTodayString());
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [content, setContent] = useState('');
  const [history, setHistory] = useState<IncidentReport[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Deletion Modal State
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Updated quick options
  const quickOptions = ["出列", "轉診", "補修", "公差", "衛哨", "休假", "上課", "代表隊"];

  useEffect(() => {
    // Determine current/next time slot based on current hour
    const currentHour = new Date().getHours();
    const foundSlot = TIME_SLOTS.find(slot => {
        const parts = slot.split('-');
        const s = parseInt(parts[0].split(':')[0]);
        const e = parseInt(parts[1].split(':')[0]);
        return currentHour >= s && currentHour < e;
    });
    if (foundSlot) setTimeSlot(foundSlot);
    
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await getMyReports(user.positionKey, user.unit);
    setHistory(data.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    const newReport: IncidentReport = {
      id: Date.now().toString(), // Will be overridden in storageService with deterministic ID
      positionKey: user.positionKey,
      userName: user.name,
      studentId: user.studentId, 
      positionName: user.positionName,
      unit: user.unit,
      date: date,
      timeSlot,
      content,
      timestamp: Date.now(),
      status: 'pending' // Default status for manual reports
    };

    try {
        await saveReport(newReport);
        setSuccessMsg('事故回報成功！');
        setTimeout(() => setSuccessMsg(''), 3000);
        setContent('');
        await loadHistory();
    } catch (e) {
        alert("回報失敗，請檢查網路");
    } finally {
        setSubmitting(false);
    }
  };

  const executeDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
        await deleteReport(reportToDelete);
        await loadHistory();
    } catch(e) {
        alert("刪除失敗");
    } finally {
        setIsDeleting(false);
        setReportToDelete(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Report Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-4">
             <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <span className="w-1 h-6 bg-blue-600 rounded-full mr-2"></span>
                新增事故回報
            </h2>
            <p className="text-sm text-slate-500 ml-3">{user.positionName} - {user.name}</p>
        </div>
       
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">日期</label>
                <div className="relative">
                    <input 
                        type="date"
                        required
                        min={getTodayString()} /* Added restriction to prevent past dates */
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full border-slate-300 rounded-md shadow-sm p-2 pl-10 border bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">時段</label>
                <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full border-slate-300 rounded-md shadow-sm p-2 border bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                ))}
                </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">事故內容 (事由)</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {quickOptions.map(opt => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => setContent(opt)}
                        className={`text-xs px-3 py-1 rounded-full border ${content === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="請輸入或選擇事由..."
              className="w-full border-slate-300 rounded-md shadow-sm p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center bg-blue-700 text-white py-3 px-4 rounded-md hover:bg-blue-800 transition shadow-md disabled:bg-blue-400"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2" />}
            {submitting ? "提交中..." : "提交回報"}
          </button>
        </form>

        {successMsg && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded-md text-center animate-pulse">
                {successMsg}
            </div>
        )}
      </div>

      {/* History List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center">
                <History className="w-5 h-5 text-slate-500 mr-2" />
                <h3 className="font-semibold text-slate-700">我的回報紀錄</h3>
            </div>
            {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>
        
        {history.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
                {loading ? "載入中..." : "尚無紀錄"}
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {history.map((record) => (
                    <div key={record.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition">
                        <div>
                            <div className="flex items-center text-xs text-slate-500 mb-1">
                                <span className="mr-2">{normalizeDate(record.date)}</span>
                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {record.timeSlot}
                                </span>
                            </div>
                            <span className="text-slate-800 font-medium">{record.content}</span>
                        </div>
                        <button 
                            onClick={() => setReportToDelete(record.id)}
                            className="text-slate-400 hover:text-red-500 p-2"
                            title="刪除"
                            type="button"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>

       {/* Delete Confirmation Modal */}
       {reportToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 transform transition-all">
                    <div className="p-6">
                        <div className="flex items-center space-x-3 text-red-600 mb-4">
                            <div className="bg-red-100 p-2 rounded-full">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">確認刪除紀錄？</h3>
                        </div>
                        
                        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                            您確定要刪除這筆事故回報嗎？<br/>
                            <span className="text-slate-400 text-xs block mt-1">刪除後將無法復原。</span>
                        </p>

                        <div className="flex space-x-3">
                            <button 
                                onClick={() => setReportToDelete(null)}
                                className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={executeDeleteReport}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center"
                            >
                                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {isDeleting ? "處理中..." : "確定刪除"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ReporterView;