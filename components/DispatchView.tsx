import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Unit, TIME_SLOTS, getTodayString, DispatchTask, IncidentReport } from '../types';
import { getRoster, getReports, getTasks, saveTask, deleteTask, addDutyReports, removeDutyReports } from '../services/storageService';
import { Briefcase, Calendar, Clock, Check, Users, Trash2, UserPlus, Info, List, PlusSquare, CheckCircle, Circle, Loader2 } from 'lucide-react';

interface DispatchViewProps {
  user: UserProfile;
}

interface Candidate {
  profile: UserProfile;
  dailyTaskCount: number;
}

const DispatchView: React.FC<DispatchViewProps> = ({ user }) => {
  const [date, setDate] = useState(getTodayString());
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [taskName, setTaskName] = useState('');
  const [requiredCount, setRequiredCount] = useState(1);
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  
  // Mobile Tab State: 'assign' or 'list'
  const [activeMobileTab, setActiveMobileTab] = useState<'assign' | 'list'>('assign');
  
  const [roster, setRoster] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [existingTasks, setExistingTasks] = useState<DispatchTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Quick options for tasks
  const quickTaskOptions = ["搬運公差", "打掃環境", "器材保養", "文書協助", "各班公差"];

  // Initialize time slot to current time
  useEffect(() => {
    const currentHour = new Date().getHours();
    const foundSlot = TIME_SLOTS.find(slot => {
        const parts = slot.split('-');
        const s = parseInt(parts[0].split(':')[0]);
        const e = parseInt(parts[1].split(':')[0]);
        return currentHour >= s && currentHour < e;
    });
    if (foundSlot) setTimeSlot(foundSlot);
    
    fetchData();
  }, [user.unit]);

  const fetchData = async () => {
    setLoading(true);
    const [r, rep, tasks] = await Promise.all([
        getRoster(user.unit),
        getReports(user.unit),
        getTasks(user.unit)
    ]);
    setRoster(r);
    setReports(rep);
    setExistingTasks(tasks);
    setLoading(false);
  };

  // Logic to filter and sort candidates
  const candidates: Candidate[] = useMemo(() => {
    // 1. Identify people who have an incident report for THIS date and THIS time slot
    const busyKeys = new Set<string>();
    
    reports.forEach(r => {
        if (r.date === date && r.timeSlot === timeSlot) {
            busyKeys.add(r.positionKey);
        }
    });

    // 2. Identify people already assigned to OTHER tasks in THIS time slot
    existingTasks.forEach(t => {
        if (t.date === date && t.timeSlot === timeSlot) {
            t.assignees.forEach(k => busyKeys.add(k));
        }
    });

    // 3. Calculate daily task count for everyone for THIS date
    const dailyCounts: Record<string, number> = {};
    existingTasks.forEach(t => {
        if (t.date === date) {
            t.assignees.forEach(k => {
                dailyCounts[k] = (dailyCounts[k] || 0) + 1;
            });
        }
    });

    // 4. Filter roster
    const available = roster.filter(p => !busyKeys.has(p.positionKey));

    // 5. Map to Candidate object
    const mapped = available.map(p => ({
        profile: p,
        dailyTaskCount: dailyCounts[p.positionKey] || 0
    }));

    // 6. Sort: Least tasks first (Ascending)
    return mapped.sort((a, b) => a.dailyTaskCount - b.dailyTaskCount);

  }, [roster, reports, existingTasks, date, timeSlot]);

  const toggleSelection = (positionKey: string) => {
    const newSet = new Set(selectedAssignees);
    if (newSet.has(positionKey)) {
        newSet.delete(positionKey);
    } else {
        newSet.add(positionKey);
    }
    setSelectedAssignees(newSet);
  };

  const handleDispatch = async () => {
    if (!taskName.trim()) {
        alert("請輸入公差名稱");
        return;
    }
    if (selectedAssignees.size === 0) {
        alert("請至少選擇一名人員");
        return;
    }

    setProcessing(true);
    const assigneeList: string[] = Array.from(selectedAssignees);
    // Find names for snapshot
    const names: string[] = assigneeList.map(key => {
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
        status: 'pending' // Default status
    };

    try {
        await saveTask(newTask);
        // Auto-create "Duty" reports for these users
        await addDutyReports(newTask);

        await fetchData(); // Refresh to update counts and lists
        
        // Reset Form
        setTaskName('');
        setSelectedAssignees(new Set());
        
        // Optional: Switch to list view on mobile to show success
        if (window.innerWidth < 1024) {
            setActiveMobileTab('list');
        }
    } catch(e) {
        alert("派遣失敗，請檢查網路");
    } finally {
        setProcessing(false);
    }
  };

  const toggleTaskStatus = async (task: DispatchTask) => {
      const newStatus = task.status === 'pending' ? 'completed' : 'pending';
      const updatedTask: DispatchTask = { ...task, status: newStatus };
      
      try {
        // Update Task Status in Storage
        await saveTask(updatedTask);

        // Handle Side Effects on Incident Reports
        if (newStatus === 'completed') {
            // If completed, remove the "Duty" reports
            await removeDutyReports(updatedTask);
        } else {
            // If toggled back to pending, re-add "Duty" reports
            await addDutyReports(updatedTask);
        }

        fetchData();
      } catch (e) {
          alert("狀態更新失敗");
      }
  };

  const handleDeleteTask = async (task: DispatchTask) => {
    if(confirm("確定要取消此公差派遣嗎？這將會一併移除人員的公差事故。")) {
        await deleteTask(task.id);
        // Also ensure reports are cleaned up
        await removeDutyReports(task);
        fetchData();
    }
  };

  // Filter tasks for current view
  const currentSlotTasks = existingTasks.filter(t => t.date === date && t.timeSlot === timeSlot);

  // --- Render Functions (Defined here to avoid component re-mount issues) ---

  const renderConfigPanel = () => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex-shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
            <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
            派遣設定
        </h2>

        <div className="space-y-4">
            {/* iOS Fix: Change grid-cols-2 to grid-cols-1 on small screens (default) and sm:grid-cols-2 for larger */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">日期</label>
                    <div className="relative">
                        <input 
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full text-sm border-slate-300 rounded-md p-2 pl-8 border bg-white min-w-0"
                        />
                        <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">時段</label>
                    <select
                        value={timeSlot}
                        onChange={(e) => setTimeSlot(e.target.value)}
                        className="w-full text-sm border-slate-300 rounded-md p-2 border bg-white min-w-0"
                    >
                        {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">公差名稱</label>
                {/* Quick Options */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {quickTaskOptions.map(opt => (
                        <button
                            key={opt}
                            onClick={() => setTaskName(opt)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                                taskName === opt 
                                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
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
                    className="w-full text-sm border-slate-300 rounded-md p-2 border focus:ring-2 focus:ring-blue-500"
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
                    className="w-full text-sm border-slate-300 rounded-md p-2 border"
                />
            </div>

            <button
                onClick={handleDispatch}
                disabled={!taskName || selectedAssignees.size === 0 || processing}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition flex items-center justify-center font-medium"
            >
                {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Check className="w-4 h-4 mr-2" />}
                {processing ? "處理中..." : "確認派遣"}
            </button>
        </div>
    </div>
  );

  const renderTaskList = () => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden min-h-[300px] lg:min-h-0">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700">此時段已派遣任務 ({currentSlotTasks.length})</h3>
            {/* Mobile-only info */}
            <span className="lg:hidden text-xs text-slate-500">{date} {timeSlot}</span>
        </div>
        <div className="overflow-y-auto p-3 space-y-3 flex-1">
            {currentSlotTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-8">
                    <List className="w-10 h-10 mb-2 opacity-20" />
                    目前無派遣紀錄
                </div>
            ) : (
                currentSlotTasks.map(task => {
                    const isCompleted = task.status === 'completed';
                    return (
                        <div key={task.id} className={`border rounded p-3 text-sm transition-colors ${isCompleted ? 'bg-slate-100 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => toggleTaskStatus(task)}
                                        className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all ${
                                            isCompleted 
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        }`}
                                    >
                                        {isCompleted ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                        <span>{isCompleted ? "已完成" : "未完成"}</span>
                                    </button>
                                    <span className={`font-bold text-base ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                        {task.taskName}
                                    </span>
                                </div>
                                <button onClick={() => handleDeleteTask(task)} className="text-slate-400 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mb-2">
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
                            
                            <div className="text-xs text-slate-400 flex items-center justify-end border-t border-slate-200/50 pt-2 mt-2">
                                <Clock className="w-3 h-3 mr-1" />
                                派遣時間：{new Date(task.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                    排序：本日公差次數 (由少至多)
                </p>
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-200">
                    公差次數
                </span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200">
                    目前無事故
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
                                {/* Daily Count Badge */}
                                <div className={`
                                    absolute top-2 right-2 text-xs font-bold px-1.5 rounded-md border
                                    ${isSelected 
                                        ? 'bg-blue-500 text-white border-blue-400' 
                                        : dailyTaskCount === 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                    }
                                `} title="本日公差次數">
                                    {dailyTaskCount}
                                </div>

                                <div className={`text-[10px] font-semibold mb-1 ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                                    {profile.positionName}
                                </div>
                                <div className={`font-bold text-lg truncate w-full pr-6 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
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
        <div className="flex flex-col h-[calc(100vh-140px)] lg:hidden">
            {/* Mobile Tab Header */}
            <div className="flex border-b border-slate-200 bg-white mb-2 sticky top-0 z-20">
                <button
                    onClick={() => setActiveMobileTab('assign')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center border-b-2 transition-colors ${
                        activeMobileTab === 'assign' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500'
                    }`}
                >
                    <PlusSquare className="w-4 h-4 mr-2" />
                    任務派發
                </button>
                <button
                    onClick={() => setActiveMobileTab('list')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center border-b-2 transition-colors ${
                        activeMobileTab === 'list' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500'
                    }`}
                >
                    <List className="w-4 h-4 mr-2" />
                    任務清單 ({currentSlotTasks.length})
                </button>
            </div>

            {/* Mobile Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeMobileTab === 'assign' ? (
                    <div className="h-full overflow-y-auto pb-4 space-y-4">
                        {renderConfigPanel()}
                        {renderPersonnelSelector()}
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto pb-4">
                         {renderTaskList()}
                    </div>
                )}
            </div>
        </div>

        {/* --- DESKTOP LAYOUT (Split View) --- */}
        <div className="hidden lg:grid grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
             {/* Left Column */}
            <div className="col-span-4 flex flex-col space-y-4 h-full overflow-hidden">
                {renderConfigPanel()}
                {renderTaskList()}
            </div>
            {/* Right Column */}
            <div className="col-span-8 flex flex-col h-full overflow-hidden">
                {renderPersonnelSelector()}
            </div>
        </div>
    </>
  );
};

export default DispatchView;