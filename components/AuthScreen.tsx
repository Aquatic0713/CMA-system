import React, { useState, useEffect } from 'react';
import { Unit, Role, UserProfile } from '../types';
import { saveUserProfile, updateRoster, getRoster } from '../services/storageService';
import { ShieldCheck, UserPlus, Loader2 } from 'lucide-react';

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

  // Options Data
  const hqOptions = ["實習連長", "實習副連長", "實習連輔導長", "實習連士官督導長"];
  const platoonOptions = ["一排排長", "二排排長", "三排排長"];
  const staffOptions = ["人事士", "訓練士", "後勤士", "政戰士", "軍械士", "資安士"];
  const squadOptions = Array.from({length: 12}, (_, i) => (i + 1).toString());
  const soldierMemberOptions = Array.from({length: 10}, (_, i) => (i + 1).toString());

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
    let positionKey = "";

    switch (role) {
      case Role.CADET_HQ:
        positionName = hqRole;
        const hqIdx = hqOptions.indexOf(hqRole) + 1;
        positionKey = `HQ_${hqIdx}`;
        break;
      case Role.CADET_PLATOON:
        positionName = platoonRole;
        const plIdx = platoonOptions.indexOf(platoonRole) + 1;
        positionKey = `PL_${plIdx}`;
        break;
      case Role.STAFF:
        positionName = staffRole;
        const stIdx = staffOptions.indexOf(staffRole) + 1;
        positionKey = `ST_${stIdx}`;
        break;
      case Role.SQUAD_LEADER:
        positionName = `第${squadNum}班班長`;
        positionKey = `SQ_${squadNum.padStart(2, '0')}_L`;
        break;
      case Role.SOLDIER:
        positionName = `第${squadNum}班第${soldierNum}員`;
        positionKey = `SQ_${squadNum.padStart(2, '0')}_${soldierNum.padStart(2, '0')}`;
        break;
    }

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
    } catch (err) {
        console.error(err);
        setError("連線錯誤，請檢查網路或稍後再試。");
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-slate-800 p-6 text-center">
            <div className="mx-auto bg-slate-700 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="text-blue-400 w-8 h-8" />
            </div>
          <h1 className="text-2xl font-bold text-white">身分驗證與綁定</h1>
          <p className="text-slate-400 text-sm mt-2">請設定您的所屬單位與職位</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-left border border-red-100 flex items-start">
                    <span className="mr-2 mt-0.5">⚠️</span>
                    <span>{error}</span>
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