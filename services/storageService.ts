import { UserProfile, IncidentReport, Unit } from '../types';

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
  // Ensure status has a default of 'pending'
  const finalReport = { ...report, status: report.status || 'pending' };

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