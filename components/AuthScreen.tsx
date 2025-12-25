import React, { useState, useEffect } from 'react';
import { Unit, Role, UserProfile, getUnitId } from '../types';
import { saveUserProfile, updateRoster, getRoster, isCloudMode } from '../services/storageService';
import { ShieldCheck, UserPlus, Loader2, Wifi, WifiOff, AlertTriangle, Info, Table2 } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (profile: UserProfile) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [unit, setUnit] = useState<Unit>(Unit.C1);
  const [role, setRole] = useState<Role>(Role.SOLDIER);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  
  // Sub-selection states
  const [hqRole, setHqRole] = useState('實習連長');
  const [platoonRole, setPlatoonRole] = useState('一排排長');
  const [staffRole, setStaffRole] = useState('人事士');
  const [squadNum, setSquadNum] = useState('1');
  const [soldierNum, setSoldierNum] = useState('1');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Connection Test State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Options Data
  const hqOptions = ["實習連長", "實習副連長", "實習連輔導長", "實習連士官督導長"];
  const platoonOptions = ["一排排長", "二排排長", "三排排長"];
  const staffOptions = ["人事士", "訓練士", "後勤士", "政戰士", "軍械士", "資安士"];
  const squadOptions = Array.from({length: 12}, (_, i) => (i + 1).toString());
  const soldierMemberOptions = Array.from({length: 10}, (_, i) => (i + 1).toString());

  // Helper to interpret errors into user-friendly messages
  const getFriendlyErrorMessage = (e: any): string => {
      const msg = e.message || e.toString();
      
      if (msg.includes('getLastRow') || msg.includes('reading \'getLastRow\'')) {
          return "Google Script 程式碼過舊。請至 GAS 編輯器確認已貼上最新程式碼，並務必執行「部署」>「建立新部署」！";
      }
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          return "無法連線至 Google Script。請檢查：1.網路連線 2.網址正確性 3.部署權限是否為「任何人」。";
      }
      if (msg.includes('Unexpected token') || msg.includes('非 JSON')) {
          return "伺服器回應錯誤 (HTML)。通常是部署網址錯誤，或權限不足 (需設為「任何人」)。";
      }
      return msg;
  };

  const handleTestConnection = async () => {
      setTestStatus('testing');
      setTestMessage('連線中...');
      try {
          // Try to fetch roster for current unit as a test
          const data = await getRoster(unit);
          setTestStatus('success');
          setTestMessage(`連線成功！讀取到 ${data.length} 筆資料。請檢查您的 Google Sheet 是否已自動建立 "Roster" 等工作表 (Tabs)。`);
      } catch (e: any) {
          setTestStatus('fail');
          console.error("Test Connection Failed:", e);
          let msg = "連線失敗。";
          
          if (!isCloudMode()) {
             msg = "連線失敗：未設定雲端網址，目前為單機模式。";
          } else {
             msg = `連線失敗：${getFriendlyErrorMessage(e)}`;
          }
          
          setTestMessage(msg);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!name.trim()) {
      setError('請輸入姓名');
      setIsSubmitting(false);
      return;
    }
    if (!studentId.trim()) {
      setError('請輸入學號');
      setIsSubmitting(false);
      return;
    }

    let positionName = "";
    let baseKey = "";
    
    // Generate Base Key
    switch (role) {
      case Role.CADET_HQ:
        positionName = hqRole;
        const hqIdx = hqOptions.indexOf(hqRole) + 1;
        baseKey = `HQ_${hqIdx}`;
        break;
      case Role.CADET_PLATOON:
        positionName = platoonRole;
        const plIdx = platoonOptions.indexOf(platoonRole) + 1;
        baseKey = `PL_${plIdx}`;
        break;
      case Role.STAFF:
        positionName = staffRole;
        const stIdx = staffOptions.indexOf(staffRole) + 1;
        baseKey = `ST_${stIdx}`;
        break;
      case Role.SQUAD_LEADER:
        positionName = `第${squadNum}班班長`;
        baseKey = `SQ_${squadNum.padStart(2, '0')}_L`;
        break;
      case Role.SOLDIER:
        positionName = `第${squadNum}班第${soldierNum}員`;
        baseKey = `SQ_${squadNum.padStart(2, '0')}_${soldierNum.padStart(2, '0')}`;
        break;
    }

    // Append Unit ID to make it globally unique (e.g., PL_1_1, PL_1_14)
    const unitId = getUnitId(unit);
    const positionKey = `${baseKey}_${unitId}`;

    try {
        // Async Check for duplicates in Cloud
        const currentRoster = await getRoster(unit);
        const existingUser = currentRoster.find(u => u.positionKey === positionKey);
        
        if (existingUser) {
            setError(`綁定失敗：此職位 (${positionName}) 已被「${existingUser.name}」綁定。若需變更，請原使用者先解除綁定。`);
            setIsSubmitting(false);
            return;
        }

        const profile: UserProfile = {
          unit,
          role,
          name,
          studentId,
          positionName,
          positionKey
        };

        saveUserProfile(profile); // Local Session
        await updateRoster(profile); // Cloud Roster
        
        onLogin(profile);
    } catch (err: any) {
        console.error(err);
        setError(getFriendlyErrorMessage(err));
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-slate-800 p-6 text-center">
            <div className="mx-auto bg-slate-700 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="text-blue-400 w-8 h-8" />
            </div>
          <h1 className="text-2xl font-bold text-white">身分驗證與綁定</h1>
          <p className="text-slate-400 text-sm mt-2">請設定您的所屬單位與職位</p>
        </div>

        <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-col items-center space-y-2">
             <button 
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="text-xs flex items-center text-slate-500 hover:text-blue-600 transition-colors"
             >
                {testStatus === 'testing' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wifi className="w-3 h-3 mr-1" />}
                診斷雲端連線
             </button>
             
             {/* New Tip regarding tabs */}
             <div className="text-[10px] text-slate-400 flex items-center bg-yellow-50 px-2 py-1 rounded border border-yellow-100 w-full justify-center">
                <Table2 className="w-3 h-3 mr-1 text-yellow-600" />
                <span>注意：資料將寫入 Google Sheet 底部的 "Roster" 工作表</span>
             </div>
        </div>
        
        {testMessage && (
            <div className={`p-3 text-xs text-center border-b ${testStatus === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {testMessage}
            </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-left border border-red-100 flex items-start animate-fade-in">
                    <span className="mr-2 mt-0.5 flex-shrink-0"><AlertTriangle className="w-4 h-4"/></span>
                    <span className="break-all">{error}</span>
                </div>
            )}

          {/* Unit Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">所屬連隊</label>
            <select
              className="w-full border-slate-300 rounded-md shadow-sm p-2 border bg-slate-50"
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
            >
              {Object.values(Unit).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Name Input */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                <input
                type="text"
                className="w-full border-slate-300 rounded-md shadow-sm p-2 border"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入姓名"
                />
            </div>
             {/* Student ID Input */}
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">學號</label>
                <input
                type="text"
                className="w-full border-slate-300 rounded-md shadow-sm p-2 border"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="請輸入學號"
                />
            </div>
          </div>

          {/* Main Role Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">身分類別</label>
            <div className="grid grid-cols-2 gap-2">
                {Object.values(Role).map((r) => (
                    <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`text-sm py-2 px-3 rounded-md border transition-colors ${role === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                    >
                        {r}
                    </button>
                ))}
            </div>
          </div>

          {/* Dynamic Sub-selection Area */}
          <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">職位細節設定</label>
            
            {role === Role.CADET_HQ && (
                <select value={hqRole} onChange={(e) => setHqRole(e.target.value)} className="w-full border p-2 rounded">
                    {hqOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            )}

            {role === Role.CADET_PLATOON && (
                <select value={platoonRole} onChange={(e) => setPlatoonRole(e.target.value)} className="w-full border p-2 rounded">
                    {platoonOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            )}

            {role === Role.STAFF && (
                <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} className="w-full border p-2 rounded">
                    {staffOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            )}

            {role === Role.SQUAD_LEADER && (
                <div className="flex items-center space-x-2">
                     <span className="text-sm">第</span>
                     <select value={squadNum} onChange={(e) => setSquadNum(e.target.value)} className="border p-2 rounded flex-1">
                        {squadOptions.map(o => <option key={o} value={o}>{o}</option>)}
                     </select>
                     <span className="text-sm">班 班長</span>
                </div>
            )}

            {role === Role.SOLDIER && (
                <div className="space-y-3">
                     <div className="flex items-center space-x-2">
                        <span className="text-sm w-8">班級</span>
                        <select value={squadNum} onChange={(e) => setSquadNum(e.target.value)} className="border p-2 rounded flex-1">
                            {squadOptions.map(o => <option key={o} value={o}>第 {o} 班</option>)}
                        </select>
                     </div>
                     <div className="flex items-center space-x-2">
                        <span className="text-sm w-8">人員</span>
                        <select value={soldierNum} onChange={(e) => setSoldierNum(e.target.value)} className="border p-2 rounded flex-1">
                            {soldierMemberOptions.map(o => <option key={o} value={o}>第 {o} 員</option>)}
                        </select>
                     </div>
                </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
                <UserPlus className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? "處理中..." : "確認綁定"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;