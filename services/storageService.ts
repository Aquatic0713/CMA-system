import { UserProfile, IncidentReport, Unit, DispatchTask } from '../types';

// --- GOOGLE SHEETS API CONFIGURATION ---
// ⚠️ 請在此處填入您的 Google Apps Script 部署網址 (Web App URL)
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
        throw new Error("網路連線失敗");
    }

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        if (text.includes("Google Drive") || text.includes("script.google.com")) {
            throw new Error("無法連結後端腳本");
        }
        throw new Error(`伺服器回傳無效格式`);
    }

    if (data.status === 'error') {
        throw new Error(data.message);
    }
    
    return data.data;
}

// --- Local User Session ---
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
      const data = await callApi('get_roster', { unit });
      // FIREWALL: Double check unit matches to prevent cross-unit data leaks from backend bugs
      return Array.isArray(data) ? data.filter((u: any) => u.unit === unit) : [];
  } else {
      const data = localStorage.getItem(ROSTER_KEY_LOCAL);
      if (!data) return [];
      const roster: UserProfile[] = JSON.parse(data);
      return roster.filter(p => p.unit === unit);
  }
};

// --- Reports Management ---

export const saveReport = async (report: IncidentReport): Promise<void> => {
  // Ensure status has a default of '進行中'
  const finalReport = { ...report, status: report.status || '進行中' };

  if (isCloudEnabled) {
      const safeTime = finalReport.timeSlot.replace(/:/g, '');
      const docId = `${finalReport.unit}_${finalReport.positionKey}_${finalReport.date}_${safeTime}`;
      // Override ID with deterministic one
      finalReport.id = docId;
      await callApi('save_report', { report: finalReport });
  } else {
      const existingCheck = localStorage.getItem(REPORTS_KEY_LOCAL);
      const reports: IncidentReport[] = existingCheck ? JSON.parse(existingCheck) : [];
      const filtered = reports.filter(
        (r) => !(r.unit === finalReport.unit && 
               r.positionKey === finalReport.positionKey && 
               r.date === finalReport.date && 
               r.timeSlot === finalReport.timeSlot)
      );
      filtered.push(finalReport);
      localStorage.setItem(REPORTS_KEY_LOCAL, JSON.stringify(filtered));
  }
};

export const getReports = async (unit: Unit): Promise<IncidentReport[]> => {
  if (isCloudEnabled) {
      const data = await callApi('get_reports', { unit });
      // FIREWALL: Client-side filtering
      return Array.isArray(data) ? data.filter((r: any) => r.unit === unit) : [];
  } else {
      const data = localStorage.getItem(REPORTS_KEY_LOCAL);
      if (!data) return [];
      const reports: IncidentReport[] = JSON.parse(data);
      return reports.filter((r) => r.unit === unit);
  }
};

export const getMyReports = async (positionKey: string, unit: Unit): Promise<IncidentReport[]> => {
  // Always fetch fresh data for the user
  const reports = await getReports(unit);
  return reports.filter(r => r.positionKey === positionKey);
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

// --- Dispatch Tasks Management (Dual Storage) ---

// Helper: Operate on LocalStorage for Tasks
const updateLocalTask = (task: DispatchTask) => {
    const existingCheck = localStorage.getItem(TASKS_KEY_LOCAL);
    const tasks: DispatchTask[] = existingCheck ? JSON.parse(existingCheck) : [];
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
        tasks[index] = task;
    } else {
        tasks.push(task);
    }
    localStorage.setItem(TASKS_KEY_LOCAL, JSON.stringify(tasks));
};

const deleteLocalTask = (taskId: string) => {
    const data = localStorage.getItem(TASKS_KEY_LOCAL);
    if (!data) return;
    const tasks: DispatchTask[] = JSON.parse(data);
    const newTasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(TASKS_KEY_LOCAL, JSON.stringify(newTasks));
};

const getLocalTasks = (unit: Unit): DispatchTask[] => {
    const data = localStorage.getItem(TASKS_KEY_LOCAL);
    if (!data) return [];
    const tasks: DispatchTask[] = JSON.parse(data);
    return tasks.filter(t => t.unit === unit);
};

export const saveTask = async (task: DispatchTask): Promise<void> => {
    // 1. Always save to LocalStorage (Shadow Copy) for immediate persistence
    updateLocalTask(task);

    // 2. Try saving to Cloud if enabled
    if (isCloudEnabled) {
        try {
            await callApi('save_task', { task });
        } catch (e) {
            console.warn("Cloud save_task failed, using local copy.", e);
            // We do NOT throw here. We rely on local copy to keep UI working.
        }
    }
};

export const getTasks = async (unit: Unit): Promise<DispatchTask[]> => {
    let cloudTasks: DispatchTask[] | null = null;
    
    // 1. Try fetching from Cloud
    if (isCloudEnabled) {
        try {
            const rawData = await callApi('get_tasks', { unit });
            // FIREWALL: Client-side filtering
            if (Array.isArray(rawData)) {
                cloudTasks = rawData.filter((t: any) => t.unit === unit);
            }
        } catch (e) {
            console.warn("Cloud get_tasks failed/unsupported, falling back to local.", e);
        }
    }

    // 2. Get Local Data
    const localTasks = getLocalTasks(unit);

    // 3. Strategy: 
    if (cloudTasks && cloudTasks.length > 0) {
        return cloudTasks;
    }

    // Fallback
    return localTasks;
};

export const deleteTask = async (taskId: string): Promise<void> => {
    // 1. Always delete from LocalStorage
    deleteLocalTask(taskId);

    // 2. Try delete from Cloud
    if (isCloudEnabled) {
        try {
            await callApi('delete_task', { id: taskId });
        } catch (e) {
            console.warn("Cloud delete_task failed", e);
        }
    }
};

// --- Sync Functions: Task <-> Reports ---

export const addDutyReports = async (task: DispatchTask, providedRoster?: UserProfile[]): Promise<void> => {
    const roster = providedRoster || await getRoster(task.unit);
    if (!roster || roster.length === 0) return;

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
            timestamp: Date.now(),
            status: task.status // Sync status from Task to Reports
        };
        
        return saveReport(report);
    });
    
    await Promise.all(promises);
};

export const removeDutyReports = async (task: DispatchTask): Promise<void> => {
    // 1. Get all reports first
    const allReports = await getReports(task.unit);
    
    // 2. Filter strictly
    const reportsToDelete = allReports.filter(r => 
        r.date === task.date &&
        r.timeSlot === task.timeSlot &&
        r.content === "公差" &&
        task.assignees.includes(r.positionKey)
    );

    // 3. Delete them one by one
    const deletePromises = reportsToDelete.map(r => deleteReport(r.id));
    await Promise.all(deletePromises);
};