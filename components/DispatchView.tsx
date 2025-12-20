import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, Unit, TIME_SLOTS, getTodayString, DispatchTask, IncidentReport } from '../types';
import { getRoster, getReports, getTasks, saveTask, deleteTask, addDutyReports, removeDutyReports } from '../services/storageService';
import { Briefcase, Check, Users, Trash2, Info, List, PlusSquare, CheckCircle, Circle, Loader2, AlertTriangle, RefreshCw, Clock } from 'lucide-react';

interface DispatchViewProps {
  user: UserProfile;
}

interface Candidate {
  profile: UserProfile;
  dailyTaskCount: number;
}

const DispatchView: React.FC<DispatchViewProps> = ({ user }) => {
  // --- UI State ---
  const [date, setDate] = useState(getTodayString());
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [taskName, setTaskName] = useState('');
  const [requiredCount, setRequiredCount] = useState(1);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  
  // Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<'assign' | 'list'>('assign');
  
  // Deletion Modal
  const [taskToDelete, setTaskToDelete] = useState<DispatchTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // --- Data State (Source of Truth for UI) ---
  const [roster, setRoster] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]); // Current reports visible
  const [tasks, setTasks] = useState<DispatchTask[]>([]); // Current tasks list
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Quick options
  const quickTaskOptions = ["搬運公差", "打掃環境", "器材保養", "文書協助", "各班公差"];

  // Initialize
  useEffect(() => {
    const currentHour = new Date().getHours();
    const foundSlot = TIME_SLOTS.find(slot => {
        const parts = slot.split('-');
        const s = parseInt(parts[0].split(':')[0]);
        const e = parseInt(parts[1].split(':')[0]);
        return currentHour >= s && currentHour < e;
    });
    if (foundSlot) setTimeSlot(foundSlot);
    
    initialFetch();
  }, [user.unit]);

  const initialFetch = async () => {
    setLoading(true);
    try {
        const [r, rep, t] = await Promise.all([
            getRoster(user.unit),
            getReports(user.unit),
            getTasks(user.unit)
        ]);
        setRoster(r);
        setReports(rep);
        setTasks(t);
    } catch (error) {
        console.error("Fetch Error:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- Core Calculation Logic ---

  // 1. Candidates List Calculation
  //    Needs to be super responsive to `tasks` and `reports` changes
  const candidates: Candidate[] = useMemo(() => {
    // A. Identify busy people (Existing reports for this slot OR Assigned to other tasks in this slot)
    const busyKeys = new Set<string>();
    
    // Check reports
    reports.forEach(r => {
        if (r.date === date && r.timeSlot === timeSlot) {
            busyKeys.add(r.positionKey);
        }
    });

    // Check tasks (Exclude 'completed' tasks from blocking? Usually completed means done, but let's assume if it's in the list for this slot, they were busy)
    // Actually, if a task is 'completed', user requested that status becomes 'No Incident'.
    // So we only block if task is '進行中' AND matches time slot.
    tasks.forEach(t => {
        if (t.status === '進行中' && t.date === date && t.timeSlot === timeSlot) {
            t.assignees.forEach(k => busyKeys.add(k));
        }
    });

    // B. Calculate daily counts
    //    Count ANY task (pending or completed) that happened TODAY for the person.
    const dailyCounts: Record<string, number> = {};
    tasks.forEach(t => {
        if (t.date === date) {
            t.assignees.forEach(k => {
                dailyCounts[k] = (dailyCounts[k] || 0) + 1;
            });
        }
    });

    // C. Filter and Sort
    const available = roster.filter(p => !busyKeys.has(p.positionKey));
    
    const mapped = available.map(p => ({
        profile: p,
        dailyTaskCount: dailyCounts[p.positionKey] || 0
    }));

    return mapped.sort((a, b) => a.dailyTaskCount - b.dailyTaskCount);

  }, [roster, reports, tasks, date, timeSlot]);

  // --- Actions (Optimistic UI) ---

  const handleDispatch = async () => {
    if (!taskName.trim()) { alert("請輸入公差名稱"); return; }
    if (selectedAssignees.size === 0) { alert("請至少選擇一名人員"); return; }

    setProcessing(true);

    const assigneeList = Array.from(selectedAssignees);
    const names = assigneeList.map(key => {
        const p = roster.find(u => u.positionKey === key);
        return p ? p.name : key;
    });

    const newTask: DispatchTask = {
        id: Date.now().toString(),
        unit: user.unit,
        date,
        timeSlot,
        taskName,
        assignees: assigneeList,
        assigneeNames: names,
        timestamp: Date.now(),
        status: '進行中'
    };

    // 1. OPTIMISTIC UPDATE: Tasks List
    //    Immediately add to list so user sees it.
    const newTasksList = [...tasks, newTask];
    setTasks(newTasksList);

    // 2. OPTIMISTIC UPDATE: Reports
    //    Immediately generate "公差" reports so "Candidate" list updates (removes them)
    //    and "Daily Count" updates (via tasks dependency).
    const newReports: IncidentReport[] = assigneeList.map(key => {
        const p = roster.find(u => u.positionKey === key);
        return {
            id: `${user.unit}_${key}_${date}_${timeSlot.replace(/:/g,'')}`, // Mock ID same as backend
            positionKey: key,
            userName: p?.name || '',
            studentId: p?.studentId || '',
            positionName: p?.positionName || '',
            unit: user.unit,
            date: date,
            timeSlot: timeSlot,
            content: "公差",
            timestamp: Date.now(),
            status: '進行中'
        };
    });
    
    // Filter out any existing reports for these people in this slot to avoid duplicates in local state
    const cleanReports = reports.filter(r => 
        !(r.date === date && r.timeSlot === timeSlot && assigneeList.includes(r.positionKey))
    );
    setReports([...cleanReports, ...newReports]);

    // 3. UI Cleanup
    setTaskName('');
    setSelectedAssignees(new Set());
    if (window.innerWidth < 1024) setActiveMobileTab('list');

    // 4. BACKGROUND SYNC
    try {
        await saveTask(newTask);
        await addDutyReports(newTask, roster);
        // We don't need to re-fetch if successful, our local state is correct.
        // But strictly speaking, good practice to sync eventually.
    } catch(e) {
        alert("背景同步失敗，請檢查網路。");
        // Revert? For now, we keep optimistic state to not jar user, 
        // but normally we would rollback here.
        initialFetch();
    } finally {
        setProcessing(false);
    }
  };

  const toggleTaskStatus = async (task: DispatchTask) => {
      const newStatus: '進行中' | '已完成' = task.status === '進行中' ? '已完成' : '進行中';
      const updatedTask: DispatchTask = { ...task, status: newStatus };
      
      // 1. OPTIMISTIC UPDATE: Task List
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));

      // 2. OPTIMISTIC UPDATE: Reports
      //    If 'completed', remove the '公差' reports.
      //    If 'pending', add them back.
      if (newStatus === '已完成') {
          // Remove reports
          setReports(prev => prev.filter(r => {
             const isMatch = r.date === task.date && r.timeSlot === task.timeSlot && task.assignees.includes(r.positionKey) && r.content === "公差";
             return !isMatch;
          }));
      } else {
          // Add reports back (regenerate objects)
          const restoredReports: IncidentReport[] = task.assignees.map(key => {
            const p = roster.find(u => u.positionKey === key);
            return {
                id: `${user.unit}_${key}_${task.date}_${task.timeSlot.replace(/:/g,'')}`,
                positionKey: key,
                userName: p?.name || '',
                studentId: p?.studentId || '',
                positionName: p?.positionName || '',
                unit: user.unit,
                date: task.date,
                timeSlot: task.timeSlot,
                content: "公差",
                timestamp: Date.now(),
                status: '進行中'
            };
          });
          // Remove potential duplicates first
          setReports(prev => {
              const others = prev.filter(r => !(r.date === task.date && r.timeSlot === task.timeSlot && task.assignees.includes(r.positionKey)));
              return [...others, ...restoredReports];
          });
      }

      // 3. BACKGROUND SYNC
      try {
          await saveTask(updatedTask);
          if (newStatus === '已完成') {
              await removeDutyReports(updatedTask);
          } else {
              await addDutyReports(updatedTask, roster);
          }
      } catch (e) {
          console.error(e);
          // Rollback on fatal error
          initialFetch();
      }
  };

  const executeDeleteTask = async () => {
    if(!taskToDelete) return;
    setIsDeleting(true);
    const task = taskToDelete;

    // 1. OPTIMISTIC UPDATE: Remove task
    setTasks(prev => prev.filter(t => t.id !== task.id));

    // 2. OPTIMISTIC UPDATE: Remove reports (Restore 'No Incident')
    setReports(prev => prev.filter(r => {
        const isMatch = r.date === task.date && r.timeSlot === task.timeSlot && task.assignees.includes(r.positionKey) && r.content === "公差";
        return !isMatch;
    }));

    setTaskToDelete(null);

    // 3. BACKGROUND SYNC
    try {
        await deleteTask(task.id);
        await removeDutyReports(task);
    } catch (e) {
        alert("刪除同步失敗");
        initialFetch();
    } finally {
        setIsDeleting(false);
    }
  };

  const toggleSelection = (key: string) => {
      const newSet = new Set(selectedAssignees);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      setSelectedAssignees(newSet);
  };

  // Helper View: Current slot tasks
  const currentSlotTasks = tasks.filter(t => t.date === date && t.timeSlot === timeSlot);

  // --- UI Components ---

  const renderConfigPanel = () => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 lg:p-5 flex-shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
            <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
            派遣設定
        </h2>
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">日期</label>
                    <input 
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full text-base lg:text-sm border-slate-300 rounded-md py-2 px-2 border bg-white shadow-sm"
                    />
                </div>
                <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">時段</label>
                    <select
                        value={timeSlot}
                        onChange={(e) => setTimeSlot(e.target.value)}
                        className="w-full text-base lg:text-sm border-slate-300 rounded-md py-2 px-2 border bg-white shadow-sm"
                    >
                        {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">公差名稱</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {quickTaskOptions.map(opt => (
                        <button
                            key={opt}
                            onClick={() => setTaskName(opt)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                                taskName === opt ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                <input 
                    type="text"
                    placeholder="輸入名稱..."
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full border-slate-300 rounded-md p-2 border focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-500">預計派遣人數</label>
                    <span className={`text-xs font-bold ${selectedAssignees.size === requiredCount ? 'text-green-600' : 'text-blue-600'}`}>
                        已選 {selectedAssignees.size} / {requiredCount}
                    </span>
                </div>
                <input 
                    type="number"
                    min="1"
                    value={requiredCount}
                    onChange={(e) => setRequiredCount(parseInt(e.target.value) || 1)}
                    className="w-full border-slate-300 rounded-md p-2 border shadow-sm"
                />
            </div>

            <button
                onClick={handleDispatch}
                disabled={!taskName || selectedAssignees.size === 0 || processing}
                className="w-full bg-blue-600 text-white py-3 lg:py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition flex items-center justify-center font-medium shadow-sm active:scale-[0.98]"
            >
                {processing ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Check className="w-5 h-5 mr-2" />}
                {processing ? "處理中..." : "確認派遣"}
            </button>
        </div>
    </div>
  );

  const renderTaskList = () => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden min-h-[300px] lg:min-h-0">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700">此時段已派遣任務 ({currentSlotTasks.length})</h3>
            <button onClick={() => initialFetch()} disabled={loading} className="text-slate-400 hover:text-blue-600" title="重新整理">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-3 flex-1 scrollbar-hide">
            {currentSlotTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-8">
                    <List className="w-10 h-10 mb-2 opacity-20" />
                    目前無派遣紀錄
                </div>
            ) : (
                currentSlotTasks.map(task => {
                    const isCompleted = task.status === '已完成';
                    return (
                        <div key={task.id} className={`border rounded p-3 text-sm transition-colors ${isCompleted ? 'bg-slate-100 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2 min-w-0">
                                    <button 
                                        onClick={() => toggleTaskStatus(task)}
                                        className={`flex-shrink-0 flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all ${
                                            isCompleted 
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        }`}
                                    >
                                        {isCompleted ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                        <span>{isCompleted ? "已完成" : "進行中"}</span>
                                    </button>
                                    <span className={`font-bold text-base truncate ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                        {task.taskName}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setTaskToDelete(task)} 
                                    className="text-slate-400 hover:text-red-500 p-1 flex-shrink-0"
                                    type="button"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                                {task.assigneeNames.map((name, idx) => (
                                    <span key={idx} className={`border px-2 py-1 rounded text-xs shadow-sm ${
                                        isCompleted 
                                            ? 'bg-white border-slate-200 text-slate-400' 
                                            : 'bg-white border-blue-200 text-slate-600'
                                    }`}>
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    </div>
  );

  const renderPersonnelSelector = () => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <h3 className="text-lg font-bold text-slate-800">人員挑選</h3>
                <p className="text-xs text-slate-500 flex items-center mt-1">
                    <Info className="w-3 h-3 mr-1" />
                    數字：本日累計公差次數 (2200後歸零)
                </p>
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-200 whitespace-nowrap">
                    次數
                </span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200 whitespace-nowrap">
                    無事故
                </span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-blue-500"/> : <Users className="w-12 h-12 mb-2 opacity-20" />}
                    <p>{loading ? "載入中..." : "該時段無可用人員"}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {candidates.map(({profile, dailyTaskCount}) => {
                        const isSelected = selectedAssignees.has(profile.positionKey);
                        return (
                            <button
                                key={profile.positionKey}
                                onClick={() => toggleSelection(profile.positionKey)}
                                className={`
                                    relative flex flex-col items-start p-3 rounded-lg border text-left transition-all
                                    ${isSelected 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md transform scale-95' 
                                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                                    }
                                `}
                            >
                                {/* Badge: Counter */}
                                <div className={`
                                    absolute top-2 right-2 text-xs font-bold px-1.5 rounded-md border
                                    ${isSelected 
                                        ? 'bg-blue-500 text-white border-blue-400' 
                                        : dailyTaskCount === 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                    }
                                `}>
                                    {dailyTaskCount}
                                </div>

                                <div className={`text-[10px] font-semibold mb-1 truncate w-[70%] ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                                    {profile.positionName}
                                </div>
                                <div className={`font-bold text-lg truncate w-full pr-1 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                    {profile.name}
                                </div>
                                
                                {isSelected && (
                                    <div className="absolute bottom-2 right-2">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
  );

  return (
    <>
        {/* --- MOBILE LAYOUT (Tabs) --- */}
        <div className="flex flex-col h-[calc(100dvh-140px)] lg:hidden">
            <div className="flex border-b border-slate-200 bg-white mb-2 sticky top-0 z-20 flex-shrink-0">
                <button
                    onClick={() => setActiveMobileTab('assign')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center border-b-2 transition-colors ${activeMobileTab === 'assign' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                >
                    <PlusSquare className="w-4 h-4 mr-2" />
                    任務派發
                </button>
                <button
                    onClick={() => setActiveMobileTab('list')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center border-b-2 transition-colors ${activeMobileTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                >
                    <List className="w-4 h-4 mr-2" />
                    任務清單 ({currentSlotTasks.length})
                </button>
            </div>
            <div className="flex-1 overflow-hidden relative w-full">
                {activeMobileTab === 'assign' ? (
                    <div className="h-full overflow-y-auto pb-4 space-y-4 px-1">{renderConfigPanel()}{renderPersonnelSelector()}</div>
                ) : (
                    <div className="h-full overflow-y-auto pb-4 px-1">{renderTaskList()}</div>
                )}
            </div>
        </div>

        {/* --- DESKTOP LAYOUT --- */}
        <div className="hidden lg:grid grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
            <div className="col-span-4 flex flex-col space-y-4 h-full overflow-hidden">
                {renderConfigPanel()}
                {renderTaskList()}
            </div>
            <div className="col-span-8 flex flex-col h-full overflow-hidden">
                {renderPersonnelSelector()}
            </div>
        </div>

        {/* Delete Confirmation Modal */}
        {taskToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 transform transition-all">
                    <div className="p-6">
                        <div className="flex items-center space-x-3 text-red-600 mb-4">
                            <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="w-6 h-6" /></div>
                            <h3 className="text-lg font-bold text-slate-800">確認取消派遣？</h3>
                        </div>
                        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                            您確定要取消「<span className="font-bold">{taskToDelete.taskName}</span>」嗎？<br/>
                            <span className="text-slate-400 text-xs block mt-1">這將會一併移除已指派人員的公差事故紀錄。</span>
                        </p>
                        <div className="flex space-x-3">
                            <button onClick={() => setTaskToDelete(null)} className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">保留</button>
                            <button onClick={executeDeleteTask} disabled={isDeleting} className="flex-1 py-2.5 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 flex items-center justify-center">
                                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "確定取消"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default DispatchView;