import React, { useState, useEffect } from 'react';
import { UserProfile, Role } from './types';
import { getUserProfile, clearUserProfile } from './services/storageService';
import AuthScreen from './components/AuthScreen';
import ReporterView from './components/ReporterView';
import DutyOfficerView from './components/DutyOfficerView';
import DispatchView from './components/DispatchView';
import { LogOut, User as UserIcon, Shield, Briefcase, Edit, AlertTriangle, X } from 'lucide-react';

// Extended view roles to handle the "Dispatch" mode which isn't a strict Role but a View Mode
type ViewMode = Role | 'DISPATCH_MODE';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  
  // State for Custom Confirmation Modal
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    const profile = getUserProfile();
    if (profile) {
      setUser(profile);
      setViewMode(profile.role);
    }
  }, []);

  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    setViewMode(profile.role);
  };

  // Open the modal instead of using window.confirm
  const requestResetIdentity = () => {
    setShowResetModal(true);
  };

  // Execute the actual reset
  const confirmResetIdentity = () => {
    clearUserProfile();
    setUser(null);
    setViewMode(null);
    setShowResetModal(false);
  };

  // Logic: Duty Officer Mode is only for Cadet HQ and Platoon Leaders
  const isDutyOfficerCapable = (role: Role) => {
    return [Role.CADET_HQ, Role.CADET_PLATOON].includes(role);
  };

  // Determine which component to render
  const renderContent = () => {
    if (!user) return null;

    if (viewMode === 'DISPATCH_MODE' && isDutyOfficerCapable(user.role)) {
        return (
            <div className="animate-fade-in">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">派遣公差模式</h2>
                    <p className="text-slate-500">檢視人力狀況並分派任務</p>
                </div>
                <DispatchView user={user} />
            </div>
        );
    }

    if (viewMode && isDutyOfficerCapable(user.role) && viewMode !== Role.SOLDIER) {
        // Default Duty Officer View (Stats)
        return (
            <div className="animate-fade-in">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">部隊掌握 (值星官)</h2>
                    <p className="text-slate-500">檢視同單位所有人員事故狀況</p>
                </div>
                <DutyOfficerView user={user} />
            </div>
        );
    }

    // Default: Personal Report Mode
    return (
        <div className="animate-fade-in">
             <div className="mb-6 max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-800">個人事故回報</h2>
                <p className="text-slate-500">填寫您的動態與事由</p>
            </div>
            <ReporterView user={user} />
        </div>
    );
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-6 h-6 text-blue-400 mr-3" />
              <div>
                <h1 className="text-lg font-bold leading-none">CMA system</h1>
                <span className="text-xs text-slate-400 font-mono tracking-wider">{user.unit}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Profile Info - Clickable to Edit */}
              <div 
                className="hidden md:flex flex-col items-end mr-2 cursor-pointer group" 
                onClick={requestResetIdentity}
                title="點擊以修正資料 (解除綁定)"
              >
                <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-medium group-hover:text-blue-300 transition-colors">{user.name}</span>
                    <Edit className="w-3 h-3 text-slate-500 group-hover:text-blue-300" />
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 rounded">{user.positionName}</span>
              </div>
              
              <button 
                onClick={requestResetIdentity}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition"
                title="解除綁定 / 重新輸入資料"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-header for Role Switching (Only for Duty Officers) */}
        {isDutyOfficerCapable(user.role) && (
            <div className="bg-slate-800 border-t border-slate-700">
                <div className="max-w-7xl mx-auto px-4 flex space-x-2 py-2 text-sm overflow-x-auto">
                   
                   {/* 1. Duty Officer View */}
                   <button
                        onClick={() => setViewMode(user.role)}
                        className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1 rounded transition ${
                            (viewMode !== Role.SOLDIER && viewMode !== 'DISPATCH_MODE') 
                            ? 'text-blue-300 bg-slate-900 shadow-inner' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                   >
                       <Shield className="w-4 h-4" />
                       <span>部隊掌握</span>
                   </button>

                   {/* 2. Dispatch Mode (New) */}
                   <button
                        onClick={() => setViewMode('DISPATCH_MODE')}
                        className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1 rounded transition ${
                            viewMode === 'DISPATCH_MODE'
                            ? 'text-amber-300 bg-slate-900 shadow-inner' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                   >
                       <Briefcase className="w-4 h-4" />
                       <span>派遣公差</span>
                   </button>

                   {/* 3. Personal Report Mode */}
                   <button
                        onClick={() => setViewMode(Role.SOLDIER)} 
                        className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1 rounded transition ${
                            viewMode === Role.SOLDIER 
                            ? 'text-green-300 bg-slate-900 shadow-inner' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                   >
                       <UserIcon className="w-4 h-4" />
                       <span>個人回報</span>
                   </button>
                </div>
            </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>

      {/* Custom Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 transform transition-all">
                <div className="p-6">
                    <div className="flex items-center space-x-3 text-amber-600 mb-4">
                        <div className="bg-amber-100 p-2 rounded-full">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">重新設定身分？</h3>
                    </div>
                    
                    <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                        您確定要解除目前的綁定嗎？<br/>
                        <span className="text-slate-400 text-xs block mt-1">這將會清除本機的當前身分設定，讓您重新輸入姓名與職位。</span>
                    </p>

                    <div className="flex space-x-3">
                        <button 
                            onClick={() => setShowResetModal(false)}
                            className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={confirmResetIdentity}
                            className="flex-1 py-2.5 px-4 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            確定重置
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;