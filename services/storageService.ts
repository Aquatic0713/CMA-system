import { UserProfile, IncidentReport, Unit, DispatchTask } from '../types';

// --- GOOGLE SHEETS API CONFIGURATION ---
// ⚠️ 請在此處填入您的 Google Apps Script 部署網址 (Web App URL)
// 格式通常為: https://script.google.com/macros/s/......./exec
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwS_ArM_Dg4maJIqIKR-vxoXbD1Wm5pxz_HsQbQ5vqHCX5W3Tdz6GqDhJpgsBM_lZobBA/exec";

// Check if Cloud is configured
const isCloudEnabled = GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_SCRIPT_URL_HERE";
if (!isCloudEnabled) {
    console.warn("System: Google Script URL not set. Falling back to LocalStorage (Offline Mode).");
} else {
    console.log("System: Google Sheets API Connected");
}

// Local Keys (Only for Session & Offline Fallback)
const USER_KEY = 'milstat_user_v3'; 
const ROSTER_KEY_LOCAL = 'milstat_roster_v3';
const REPORTS_KEY_LOCAL = 'milstat_reports_v3';
const TASKS_KEY_LOCAL = 'milstat_tasks_v3';

// --- Helper for API Calls ---
async function callApi(action: string, payload: any = {}) {
    if (!isCloudEnabled) throw new Error("Cloud not enabled");
    
    // Google Apps Script requires text/plain for CORS simple requests usually, 
    // but we use URL parameters for GET and body for POST.
    // To avoid CORS preflight issues with GAS, we use POST for everything typically,
    // or we use standard fetch. GAS redirects POST requests.
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8', // Important for GAS to avoid CORS preflight options
        },
        body: JSON.stringify({ action, ...payload })
    });

    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
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
      // API returns all or filtered by unit. Let's ask API to filter.
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
      // Deterministic ID logic matches previous versions
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
      // Fetch unit reports and filter client side, or api side.
      // Doing client side filter for simplicity as getReports is cached often.
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
    
    // For Google Sheets, performing multiple individual calls is slow.
    // However, to keep it simple, we use Promise.all. 
    // Ideally, we would create a batch update API endpoint, but that requires more complex GAS code.
    
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
        // We use a specialized batch delete API call if we wanted to be efficient,
        // but for now we reuse delete logic or simpler filtering on server side.
        // Let's implement a 'batch_delete_duty' on GAS side? 
        // No, let's keep it simple: client logic is robust.
        // We fetch reports, find matches, and delete them.
        
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