import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, IncidentReport, TIME_SLOTS, getDateOffsetString, normalizeDate } from '../types';
import { getReports, getRoster } from '../services/storageService';
import StatusGrid from './StatusGrid';
import { RefreshCw, Filter, AlertCircle, FileText, Users, UserCheck, AlertTriangle, Clock, PlayCircle, PauseCircle } from 'lucide-react';

interface DutyOfficerViewProps {
  user: UserProfile;
}

const DutyOfficerView: React.FC<DutyOfficerViewProps> = ({ user }) => {
  // Date State: Default to today (offset 0)
  const [dateOffset, setDateOffset] = useState(0); 
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  
  // New State: Controls whether the UI automatically switches time slots
  const [isAutoTracking, setIsAutoTracking] = useState(true);

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [roster, setRoster] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Helper: Find the time slot corresponding to the current real-world time
  const findCurrentSlot = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    return TIME_SLOTS.find(slot => {
        const parts = slot.split('-');
        const s = parseInt(parts[0].split(':')[0]);
        const e = parseInt(parts[1].split(':')[0]);
        return currentHour >= s && currentHour < e;
    }) || TIME_SLOTS[0];
  }, []);

  const fetchData = useCallback(async () => {
    // Now async
    const [allUnitReports, unitRoster] = await Promise.all([
        getReports(user.unit),
        getRoster(user.unit)
    ]);
    setReports(allUnitReports);
    setRoster(unitRoster);
  }, [user.unit]);

  // Initial Load
  useEffect(() => {
    setLoading(true);
    fetchData().then(() => setLoading(false));

    // If initial load is today, ensure we start with the correct slot
    if (dateOffset === 0) {
        setSelectedTimeSlot(findCurrentSlot());
        setIsAutoTracking(true);
    }
  }, [dateOffset]); // Removed fetchData/findCurrentSlot from dependencies to prevent loop, relied on onmount logic for init

  // Rolling Adjustment & Live Data Sync
  useEffect(() => {
    const interval = setInterval(() => {
        // 1. Always refresh data (background sync)
        fetchData();

        // 2. Only auto-switch time slot IF user hasn't manually taken control (isAutoTracking === true)
        if (dateOffset === 0 && isAutoTracking) {
            const nowSlot = findCurrentSlot();
            setSelectedTimeSlot(prevSlot => {
                if (prevSlot !== nowSlot) {
                    return nowSlot;
                }
                return prevSlot;
            });
        }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [dateOffset, isAutoTracking, fetchData, findCurrentSlot]);

  // Handler for manual time slot change
  const handleManualSlotChange = (newSlot: string) => {
    setSelectedTimeSlot(newSlot);
    // CRITICAL: Disable auto-tracking so the system doesn't force it back
    if (dateOffset === 0) {
        setIsAutoTracking(false);
    }
  };

  // Handler to re-enable auto tracking
  const enableAutoTracking = () => {
    setDateOffset(0);
    setSelectedTimeSlot(findCurrentSlot());
    setIsAutoTracking(true);
  };

  // Derived Data Calculation
  const targetDate = getDateOffsetString(dateOffset);

  // Filter: Match TimeSlot AND Date (Robust comparison using normalizeDate)
  const currentSlotReports = reports.filter(r => 
    r.timeSlot === selectedTimeSlot && 
    normalizeDate(r.date) === targetDate
  );
  
  // Statistics Logic
  const totalStrength = roster.length; 
  const incidentCount = currentSlotReports.length; 
  const actualStrength = Math.max(0, totalStrength - incidentCount); 

  // UI State for "Live Mode" visualization
  const isLive = dateOffset === 0 && isAutoTracking;

  return (
    <div className="space-y-6">
      
      {/* 1. Statistics Dashboard */}
      <div className="grid grid-cols-3 gap-4">
        {/* Expected */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center relative overflow-hidden transition-transform hover:scale-105">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
            <div className="flex items-center space-x-2 mb-1 text-slate-500">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">應到人數</span>
            </div>
            <div className="text-3xl font-extrabold text-slate-700">
                {totalStrength} <span className="text-sm font-normal text-slate-400">員</span>
            </div>
        </div>

        {/* Actual */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center relative overflow-hidden transition-transform hover:scale-105">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <div className="flex items-center space-x-2 mb-1 text-green-600">
                <UserCheck className="w-4 h-4" />
                <span className="text-sm font-medium">實到人數</span>
            </div>
            <div className="text-3xl font-extrabold text-green-600">
                {actualStrength} <span className="text-sm font-normal text-green-400">員</span>
            </div>
        </div>

        {/* Incidents */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center relative overflow-hidden transition-transform hover:scale-105">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <div className="flex items-center space-x-2 mb-1 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">事故人數</span>
            </div>
            <div className="text-3xl font-extrabold text-red-600">
                {incidentCount} <span className="text-sm font-normal text-red-400">員</span>
            </div>
        </div>
      </div>

      {/* 2. Control Panel */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 space-y-4">
        
        {/* Top Row: Date Selection Tabs */}
        <div className="flex justify-center border-b border-slate-100 pb-4">
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => { setDateOffset(-1); setIsAutoTracking(false); }}
                    className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${dateOffset === -1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    昨日 ({getDateOffsetString(-1).slice(5)})
                </button>
                <button
                    onClick={enableAutoTracking}
                    className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${dateOffset === 0 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    今日 ({getDateOffsetString(0).slice(5)})
                </button>
                <button
                    onClick={() => { setDateOffset(1); setIsAutoTracking(false); }}
                    className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${dateOffset === 1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    明日 ({getDateOffsetString(1).slice(5)})
                </button>
             </div>
        </div>

        {/* Bottom Row: Time and Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
                {/* Live Mode Toggle Button */}
                <button 
                    onClick={enableAutoTracking}
                    disabled={isLive}
                    className={`p-2 rounded-full transition-all ${
                        isLive 
                            ? 'bg-green-100 text-green-700 cursor-default' 
                            : 'bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 cursor-pointer'
                    }`}
                    title={isLive ? "自動追蹤中" : "點擊切換回即時自動追蹤"}
                >
                    {isLive ? <Clock className="w-5 h-5 animate-pulse" /> : <PlayCircle className="w-5 h-5" />}
                </button>

                <div>
                    <div className="flex items-center gap-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            {isLive ? (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    當前時段 (自動追蹤)
                                </>
                            ) : (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    手動檢視模式
                                </>
                            )}
                        </label>
                        {!isLive && dateOffset === 0 && (
                            <button 
                                onClick={enableAutoTracking}
                                className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                            >
                                回到現在
                            </button>
                        )}
                    </div>
                    
                    <select
                        value={selectedTimeSlot}
                        onChange={(e) => handleManualSlotChange(e.target.value)}
                        className={`mt-1 block w-48 border-none text-lg font-bold focus:ring-0 p-0 bg-transparent cursor-pointer ${isLive ? 'text-slate-800' : 'text-blue-700'}`}
                    >
                        {TIME_SLOTS.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center space-x-4 justify-between md:justify-end">
                <div className="flex items-center space-x-2">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            圖表
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            清單
                        </button>
                    </div>

                    <button 
                        onClick={() => {
                            setLoading(true);
                            fetchData().then(() => setLoading(false));
                        }} 
                        className={`p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-transform ${loading ? 'animate-spin' : ''}`}
                        title="手動更新資料"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* 3. Main Content Area */}
      {viewMode === 'grid' ? (
        <div className="animate-fade-in">
            <div className={`mb-2 px-3 py-2 text-sm flex items-center rounded border transition-colors ${
                isLive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
                {isLive ? <Clock className="w-4 h-4 mr-2" /> : <Filter className="w-4 h-4 mr-2" />}
                <span>
                    {isLive 
                        ? `即時監控模式：系統自動顯示 ${targetDate} ${selectedTimeSlot} 最新狀態。` 
                        : `手動檢視模式：您正在查看 ${targetDate} ${selectedTimeSlot} 的紀錄。`
                    }
                </span>
            </div>
            <StatusGrid reports={currentSlotReports} roster={roster} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">職稱</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">姓名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">日期</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">事故內容</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">最後更新</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {currentSlotReports.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    此時段尚無事故回報
                                </td>
                            </tr>
                        ) : (
                            currentSlotReports.map((report) => (
                                <tr key={report.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                        {report.positionName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {report.userName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {normalizeDate(report.date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                            {report.content}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {new Date(report.timestamp).toLocaleTimeString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default DutyOfficerView;