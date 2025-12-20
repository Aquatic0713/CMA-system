import { UserProfile, IncidentReport, Unit, DispatchTask } from '../types';

// --- GOOGLE SHEETS API CONFIGURATION ---
// ⚠️ 請在此處填入您的 Google Apps Script 部署網址 (Web App URL)
// 格式通常為: https://script.google.com/macros/s/......./exec
// 每次在 GAS 點擊「建立新部署」後，都會產生一個新網址，請務必更新此處。
const RAW_SCRIPT_URL: string = "https://script.google.com/macros/s/AKfycbwdpYR_oFDQ0Qje_GiFJsplxtkE2xu-GMyjOm2xyOq9ebUjZJSLCssgdu1gUkEMb5wKfQ/exec";
const GOOGLE_SCRIPT_URL = RAW_SCRIPT_URL.trim();

// Check if Cloud is configured
const isCloudEnabled = GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_SCRIPT_URL_HERE" && GOOGLE_SCRIPT_URL.length > 0;

if (!isCloudEnabled) {
    console.warn("System: Google Script URL not set. Falling back to LocalStorage (Offline Mode).");
} else {
    console.log("System: Google Sheets API Connected");
}

// Export status checker for UI
export const isCloudMode = () => isCloudEnabled;

// Local Keys (Only for Session & Offline Fallback)
const USER_KEY = 'milstat_user_v3'; 
const ROSTER_KEY_LOCAL = 'milstat_roster_v3';
const REPORTS_KEY_LOCAL = 'milstat_reports_v3';
const TASKS_KEY_LOCAL = 'milstat_tasks_v3';

// --- Helper for API Calls ---
async function callApi(action: string, payload: any = {}) {
    if (!isCloudEnabled) throw new Error("Cloud not enabled");
    
    // Google Apps Script requires text/plain for CORS simple requests usually.
    // We use POST to avoid payload size limits of GET.
    
    let response;
    try {
        response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ action, ...payload })
        });
    } catch (netErr) {
        throw new Error("網路連線失敗，無法存取 Google Script。請檢查您的網路狀況。");
    }

    // First get text, then try to parse JSON. 
    // This prevents crashing if GAS returns an HTML error page (like 404 or 500).
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        // If it contains "script.google.com", it's likely a Google error page
        console.error("API Parse Error. Raw response:", text);
        if (text.includes("Google Drive") || text.includes("script.google.com")) {
            throw new Error("無法連結後端腳本。請確認：1.網址正確 2.部署權限設為「任何人」 3.是否已建立「新部署」。");
        }
        throw new Error(`伺服器回傳無效格式 (非 JSON)。回應片段: ${text.substring(0, 50)}...`);
    }

    if (data.status === 'error') {
        // Specific handling for the "getLastRow" error which indicates old code
        if (data.message && (data.message.includes('getLastRow') || data.message.includes('reading \'getLastRow\''))) {
            throw new Error("後端程式碼版本過舊。請回到 GAS 編輯器，確認程式碼已更新，並務必執行「部署」>「建立新部署」以套用變更。");
        }
        throw new Error(data.message);
    }
    
    return data.data;
}

// --- Local User Session (Always Local) ---
export const saveUserProfile = (profile: UserProfile): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
};

export const getUserProfile = (): UserProfile | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearUserProfile = (): void => {
  localStorage.removeItem(USER_KEY);
};

// --- Roster Management ---

export const updateRoster = async (profile: UserProfile): Promise<void> => {
  if (isCloudEnabled) {
      await callApi('update_roster', { profile });
  } else {
      const existingJson = localStorage.getItem(ROSTER_KEY_LOCAL);
      let roster: UserProfile[] = existingJson ? JSON.parse(existingJson) : [];
      roster = roster.filter(p => !(p.unit === profile.unit && p.positionKey === profile.positionKey));
      roster.push(profile);
      localStorage.setItem(ROSTER_KEY_LOCAL, JSON.stringify(roster));
  }
};

export const removeFromRoster = async (unit: Unit, positionKey: string): Promise<void> => {
  if (isCloudEnabled) {
      await callApi('remove_roster', { unit, positionKey });
  } else {
      const existingJson = localStorage.getItem(ROSTER_KEY_LOCAL);
      if (!existingJson) return;
      let roster: UserProfile[] = JSON.parse(existingJson);
      roster = roster.filter(p => !(p.unit === unit && p.positionKey === positionKey));
      localStorage.setItem(ROSTER_KEY_LOCAL, JSON.stringify(roster));
  }
};

export const getRoster = async (unit: Unit): Promise<UserProfile[]> => {
  if (isCloudEnabled) {
      return await callApi('get_roster', { unit });
  } else {
      const data = localStorage.getItem(ROSTER_KEY_LOCAL);
      if (!data) return [];
      const roster: UserProfile[] = JSON.parse(data);
      return roster.filter(p => p.unit === unit);
  }
};

// --- Reports Management ---

export const saveReport = async (report: IncidentReport): Promise<void> => {
  if (isCloudEnabled) {
      const safeTime = report.timeSlot.replace(/:/g, '');
      const docId = `${report.unit}_${report.positionKey}_${report.date}_${safeTime}`;
      const finalReport = { ...report, id: docId };
      
      await callApi('save_report', { report: finalReport });
  } else {
      const existingCheck = localStorage.getItem(REPORTS_KEY_LOCAL);
      const reports: IncidentReport[] = existingCheck ? JSON.parse(existingCheck) : [];
      const index = reports.findIndex(
        (r) => r.unit === report.unit && 
               r.positionKey === report.positionKey && 
               r.date === report.date && 
               r.timeSlot === report.timeSlot
      );
      if (index >= 0) {
        reports[index] = report;
      } else {
        reports.push(report);
      }
      localStorage.setItem(REPORTS_KEY_LOCAL, JSON.stringify(reports));
  }
};

export const getReports = async (unit: Unit): Promise<IncidentReport[]> => {
  if (isCloudEnabled) {
      return await callApi('get_reports', { unit });
  } else {
      const data = localStorage.getItem(REPORTS_KEY_LOCAL);
      if (!data) return [];
      const reports: IncidentReport[] = JSON.parse(data);
      return reports.filter((r) => r.unit === unit);
  }
};

export const getMyReports = async (positionKey: string, unit: Unit): Promise<IncidentReport[]> => {
  if (isCloudEnabled) {
      const reports = await getReports(unit);
      return reports.filter(r => r.positionKey === positionKey);
  } else {
      const reports = await getReports(unit);
      return reports.filter((r) => r.positionKey === positionKey);
  }
};

export const deleteReport = async (reportId: string): Promise<void> => {
    if (isCloudEnabled) {
        await callApi('delete_report', { id: reportId });
    } else {
        const data = localStorage.getItem(REPORTS_KEY_LOCAL);
        if (!data) return;
        const reports: IncidentReport[] = JSON.parse(data);
        const newReports = reports.filter(r => r.id !== reportId);
        localStorage.setItem(REPORTS_KEY_LOCAL, JSON.stringify(newReports));
    }
}

// --- Dispatch Tasks Management ---

export const saveTask = async (task: DispatchTask): Promise<void> => {
    if (isCloudEnabled) {
        await callApi('save_task', { task });
    } else {
        const existingCheck = localStorage.getItem(TASKS_KEY_LOCAL);
        const tasks: DispatchTask[] = existingCheck ? JSON.parse(existingCheck) : [];
        const index = tasks.findIndex(t => t.id === task.id);
        if (index >= 0) {
            tasks[index] = task;
        } else {
            tasks.push(task);
        }
        localStorage.setItem(TASKS_KEY_LOCAL, JSON.stringify(tasks));
    }
};

export const getTasks = async (unit: Unit): Promise<DispatchTask[]> => {
    if (isCloudEnabled) {
        return await callApi('get_tasks', { unit });
    } else {
        const data = localStorage.getItem(TASKS_KEY_LOCAL);
        if (!data) return [];
        const tasks: DispatchTask[] = JSON.parse(data);
        return tasks.filter(t => t.unit === unit);
    }
};

export const deleteTask = async (taskId: string): Promise<void> => {
    if (isCloudEnabled) {
        await callApi('delete_task', { id: taskId });
    } else {
        const data = localStorage.getItem(TASKS_KEY_LOCAL);
        if (!data) return;
        const tasks: DispatchTask[] = JSON.parse(data);
        const newTasks = tasks.filter(t => t.id !== taskId);
        localStorage.setItem(TASKS_KEY_LOCAL, JSON.stringify(newTasks));
    }
};

// --- Sync Functions: Task <-> Reports ---

export const addDutyReports = async (task: DispatchTask): Promise<void> => {
    const roster = await getRoster(task.unit);
    const promises = task.assignees.map(async (assigneeKey) => {
        const userProfile = roster.find(u => u.positionKey === assigneeKey);
        if (!userProfile) return; 

        const safeTime = task.timeSlot.replace(/:/g, '');
        const docId = `${task.unit}_${userProfile.positionKey}_${task.date}_${safeTime}`;

        const report: IncidentReport = {
            id: docId,
            positionKey: userProfile.positionKey,
            userName: userProfile.name,
            studentId: userProfile.studentId,
            positionName: userProfile.positionName,
            unit: task.unit,
            date: task.date,
            timeSlot: task.timeSlot,
            content: "公差",
            timestamp: Date.now()
        };
        return saveReport(report);
    });
    await Promise.all(promises);
};

export const removeDutyReports = async (task: DispatchTask): Promise<void> => {
    if (isCloudEnabled) {
        const allReports = await getReports(task.unit);
        const reportsToDelete = allReports.filter(r => 
            r.date === task.date &&
            r.timeSlot === task.timeSlot &&
            r.content === "公差" &&
            task.assignees.includes(r.positionKey)
        );
        const deletePromises = reportsToDelete.map(r => deleteReport(r.id));
        await Promise.all(deletePromises);
    } else {
        const existingCheck = localStorage.getItem(REPORTS_KEY_LOCAL);
        if (!existingCheck) return;
        let reports: IncidentReport[] = JSON.parse(existingCheck);
        reports = reports.filter(r => {
            const isMatch = 
                r.unit === task.unit &&
                r.date === task.date &&
                r.timeSlot === task.timeSlot &&
                task.assignees.includes(r.positionKey) &&
                r.content === "公差";
            return !isMatch; 
        });
        localStorage.setItem(REPORTS_KEY_LOCAL, JSON.stringify(reports));
    }
};