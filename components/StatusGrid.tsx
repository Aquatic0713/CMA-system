import React, { useMemo } from 'react';
import { IncidentReport, generateGridStructure, GridSlot, UserProfile } from '../types';
import { User } from 'lucide-react';

interface StatusGridProps {
  reports: IncidentReport[];
  roster?: UserProfile[]; 
}

const StatusGrid: React.FC<StatusGridProps> = ({ reports, roster = [] }) => {
  // Map of positionKey -> Report
  const reportMap = useMemo(() => {
    const map: Record<string, IncidentReport> = {};
    reports.forEach((r) => {
      map[r.positionKey] = r;
    });
    return map;
  }, [reports]);

  // Map of positionKey -> UserProfile (from Roster)
  const rosterMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    roster.forEach((p) => {
      map[p.positionKey] = p;
    });
    return map;
  }, [roster]);

  const gridStructure = useMemo(() => generateGridStructure(), []);

  // Group slots by their rowGroup for visual separation
  const groupedSlots = useMemo(() => {
    const groups: Record<string, GridSlot[]> = {};
    const order: string[] = []; // maintain order of appearance

    gridStructure.forEach(slot => {
      if (!groups[slot.rowGroup]) {
        groups[slot.rowGroup] = [];
        order.push(slot.rowGroup);
      }
      groups[slot.rowGroup].push(slot);
    });
    return { groups, order };
  }, [gridStructure]);

  return (
    <div className="bg-white rounded-md shadow-sm border border-slate-300 overflow-hidden">
        
        {/* --- MOBILE VIEW (Vertical Groups with Grids) --- */}
        <div className="block lg:hidden">
            {groupedSlots.order.map((groupName) => (
                <div key={groupName} className="border-b border-slate-200 last:border-b-0">
                    {/* Sticky Header for Group */}
                    <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-sm sticky top-0 z-10 border-b border-slate-200 flex justify-between items-center shadow-sm">
                        <span>{groupName}</span>
                        <span className="text-xs font-normal text-slate-400">
                            {groupedSlots.groups[groupName].length} 員
                        </span>
                    </div>
                    
                    {/* User Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 bg-slate-50">
                        {groupedSlots.groups[groupName].map((slot) => {
                            const report = reportMap[slot.key];
                            const rosterUser = rosterMap[slot.key];
                            const displayName = report?.userName || rosterUser?.name || "";
                            const displayId = report?.studentId || rosterUser?.studentId || ""; // Added ID retrieval
                            const hasReport = !!report;

                            return (
                                <div 
                                    key={slot.key}
                                    className={`
                                        relative flex flex-col items-center justify-center p-2 rounded border text-center transition-colors min-h-[85px]
                                        ${hasReport 
                                            ? 'bg-red-50 border-red-200 shadow-sm' 
                                            : displayName ? 'bg-white border-slate-200' : 'bg-slate-50/50 border-slate-100'
                                        }
                                    `}
                                >
                                    {/* Position Label (Tiny) */}
                                    <div className="text-[10px] text-slate-400 mb-0.5 leading-none truncate w-full">
                                        {slot.label.replace(groupName, '').replace('班長', '班長').replace('第', '').replace('員', '') || slot.label}
                                    </div>

                                    {/* Name */}
                                    <div className={`font-bold text-sm leading-tight mb-0.5 w-full truncate ${hasReport ? 'text-slate-800' : 'text-slate-700'}`}>
                                        {displayName || "-"}
                                    </div>

                                    {/* Student ID (Added) */}
                                    {displayId && (
                                        <div className="text-[10px] text-slate-400 font-mono leading-tight mb-1">
                                            {displayId}
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    {hasReport ? (
                                        <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full truncate max-w-full">
                                            {report.content}
                                        </span>
                                    ) : (
                                        displayName && <span className="text-[10px] text-green-600 font-medium">在隊</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>

        {/* --- DESKTOP VIEW (Horizontal Spreadsheet) --- */}
        <div className="hidden lg:block overflow-x-auto">
            <div className="min-w-[900px] flex flex-col">
                {groupedSlots.order.map((groupName) => (
                    <div key={groupName} className="flex border-b border-slate-300 last:border-b-0 h-28">
                        {/* Row Header */}
                        <div className="w-20 flex-shrink-0 bg-slate-200 border-r border-slate-300 flex items-center justify-center p-2 shadow-inner">
                            <span className="text-sm font-bold text-slate-700 text-center leading-tight tracking-widest writing-vertical-rl">
                                {groupName}
                            </span>
                        </div>

                        {/* Slots container */}
                        <div className="flex-1 flex flex-nowrap overflow-x-auto bg-slate-50">
                            {groupedSlots.groups[groupName].map((slot) => {
                                const report = reportMap[slot.key];
                                const rosterUser = rosterMap[slot.key];
                                const displayName = report?.userName || rosterUser?.name || "";
                                const displayId = report?.studentId || rosterUser?.studentId || "";
                                const hasUser = !!displayName;
                                const hasReport = !!report;

                                return (
                                    <div 
                                        key={slot.key} 
                                        className="flex-1 min-w-[85px] max-w-[160px] border-r border-slate-200 last:border-r-0 flex flex-col bg-white transition-all hover:bg-slate-50"
                                    >
                                        <div 
                                            className="bg-slate-100 text-slate-600 text-[10px] font-semibold text-center py-1.5 border-b border-slate-200 px-1 truncate" 
                                            title={slot.label}
                                        >
                                            {slot.label}
                                        </div>

                                        <div className="flex-1 flex flex-col justify-center items-center p-1 gap-0.5">
                                            {hasUser ? (
                                                <>
                                                    <div className="text-sm font-bold text-slate-900 leading-tight text-center w-full truncate px-1">
                                                        {displayName}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono leading-tight tracking-tight">
                                                        {displayId}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="h-full flex items-center justify-center">
                                                    <span className="text-slate-200 text-lg select-none">-</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div 
                                            className={`h-8 flex items-center justify-center text-xs font-bold px-1 overflow-hidden border-t ${
                                                hasReport 
                                                    ? 'bg-red-50 text-red-600 border-red-100 shadow-inner' 
                                                    : 'bg-white text-slate-300 border-slate-100'
                                            }`}
                                        >
                                            {hasReport ? report.content : (hasUser ? "" : "---")}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex-1 bg-slate-50/50"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default StatusGrid;