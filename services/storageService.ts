import { UserProfile, IncidentReport, Unit, DispatchTask } from '../types';

const USER_KEY = 'milstat_user_v3'; 
const REPORTS_KEY = 'milstat_reports_v3';
const ROSTER_KEY = 'milstat_roster_v3';
const TASKS_KEY = 'milstat_tasks_v3';

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

// --- Roster Management (Unit Members Registry) ---
export const updateRoster = (profile: UserProfile): void => {
  const existingJson = localStorage.getItem(ROSTER_KEY);
  let roster: UserProfile[] = existingJson ? JSON.parse(existingJson) : [];
  
  // Remove any existing entry for this specific position in this unit
  roster = roster.filter(p => !(p.unit === profile.unit && p.positionKey === profile.positionKey));
  
  // Add new profile
  roster.push(profile);
  
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
};

export const getRoster = (unit: Unit): UserProfile[] => {
  const data = localStorage.getItem(ROSTER_KEY);
  if (!data) return [];
  const roster: UserProfile[] = JSON.parse(data);
  return roster.filter(p => p.unit === unit);
};

// --- Reports Management ---
export const saveReport = (report: IncidentReport): void => {
  const existingCheck = localStorage.getItem(REPORTS_KEY);
  const reports: IncidentReport[] = existingCheck ? JSON.parse(existingCheck) : [];
  
  // Replace existing report if same user, SAME DATE, and same time slot
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

  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
};

export const getReports = (unit: Unit): IncidentReport[] => {
  const data = localStorage.getItem(REPORTS_KEY);
  if (!data) return [];
  const reports: IncidentReport[] = JSON.parse(data);
  return reports.filter((r) => r.unit === unit);
};

export const getMyReports = (positionKey: string, unit: Unit): IncidentReport[] => {
  const reports = getReports(unit);
  return reports.filter((r) => r.positionKey === positionKey);
};

export const deleteReport = (reportId: string): void => {
    const data = localStorage.getItem(REPORTS_KEY);
    if (!data) return;
    const reports: IncidentReport[] = JSON.parse(data);
    const newReports = reports.filter(r => r.id !== reportId);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(newReports));
}

// --- Dispatch Tasks Management ---

export const saveTask = (task: DispatchTask): void => {
    const existingCheck = localStorage.getItem(TASKS_KEY);
    const tasks: DispatchTask[] = existingCheck ? JSON.parse(existingCheck) : [];
    
    // Check if task exists (for updates)
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
        tasks[index] = task;
    } else {
        tasks.push(task);
    }
    
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
};

export const getTasks = (unit: Unit): DispatchTask[] => {
    const data = localStorage.getItem(TASKS_KEY);
    if (!data) return [];
    const tasks: DispatchTask[] = JSON.parse(data);
    return tasks.filter(t => t.unit === unit);
};

export const deleteTask = (taskId: string): void => {
    const data = localStorage.getItem(TASKS_KEY);
    if (!data) return;
    const tasks: DispatchTask[] = JSON.parse(data);
    const newTasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(TASKS_KEY, JSON.stringify(newTasks));
};

// --- Sync Functions: Task <-> Reports ---

// When a task is Pending, create 'Duty' reports for everyone
export const addDutyReports = (task: DispatchTask): void => {
    const roster = getRoster(task.unit);
    
    task.assignees.forEach(assigneeKey => {
        const userProfile = roster.find(u => u.positionKey === assigneeKey);
        
        // We need user details to create a report. 
        // If user isn't in roster (e.g. wiped data), we can't accurately create a report, skip.
        if (!userProfile) return; 

        const report: IncidentReport = {
            id: `duty_${task.id}_${assigneeKey}`, // Deterministic ID to avoid duplicates if called multiple times
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
        saveReport(report);
    });
};

// When a task is Completed, remove 'Duty' reports for everyone
export const removeDutyReports = (task: DispatchTask): void => {
    const existingCheck = localStorage.getItem(REPORTS_KEY);
    if (!existingCheck) return;
    let reports: IncidentReport[] = JSON.parse(existingCheck);

    // Filter out reports that match this task's context AND have content "公差"
    // We strictly check content="公差" so we don't accidentally delete if someone manually changed it to "Sick" later.
    reports = reports.filter(r => {
        const isMatch = 
            r.unit === task.unit &&
            r.date === task.date &&
            r.timeSlot === task.timeSlot &&
            task.assignees.includes(r.positionKey) &&
            r.content === "公差";
        
        return !isMatch; // Keep if NOT a match
    });

    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
};