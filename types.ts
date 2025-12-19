export enum Unit {
  C1 = "學一連",
  C2 = "學二連",
  C3 = "學三連",
  C4 = "學四連",
  C5 = "學五連",
  C6 = "學六連",
  C7 = "學七連",
  C8 = "學八連",
  C9 = "學九連",
  C10 = "學十連",
  C11 = "學十一連",
  C12 = "學十二連",
  C13 = "學十三連",
  C14 = "學十四連",
}

export enum Role {
  CADET_HQ = "實習連部",
  CADET_PLATOON = "實習排部",
  STAFF = "幕僚",
  SQUAD_LEADER = "班長",
  SOLDIER = "班兵",
}

export interface UserProfile {
  name: string;
  studentId: string; // Added Student ID
  unit: Unit;
  role: Role;
  positionName: string; // The display name of the specific job (e.g., "實習連長", "第一班班長")
  positionKey: string; // The unique ID for grid sorting (e.g., "HQ_1", "SQ_01_L")
}

export interface IncidentReport {
  id: string;
  positionKey: string;
  userName: string;
  studentId: string; // Added Student ID to report snapshot
  positionName: string;
  unit: Unit;
  date: string; // Format: YYYY-MM-DD
  timeSlot: string;
  content: string; 
  timestamp: number;
}

export interface DispatchTask {
  id: string;
  unit: Unit;
  date: string;
  timeSlot: string;
  taskName: string;
  assignees: string[]; // Array of positionKeys
  assigneeNames: string[]; // Snapshot of names for easy display
  timestamp: number;
  status: 'pending' | 'completed'; // Added status
}

// Updated to full hourly slots based on user request for precision (e.g., 08:00-09:00)
export const TIME_SLOTS = [
  "05:00-06:00",
  "06:00-07:00",
  "07:00-08:00",
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
  "19:00-20:00",
  "20:00-21:00",
  "21:00-22:00",
];

// Helper to define the Grid Structure
export interface GridSlot {
  key: string;
  label: string;
  rowGroup: string;
}

// Generate the specific grid structure requested
export const generateGridStructure = (): GridSlot[] => {
  const slots: GridSlot[] = [];

  // Row 1: HQ
  slots.push(
    { key: "HQ_1", label: "實習連長", rowGroup: "連部" },
    { key: "HQ_2", label: "實習副連長", rowGroup: "連部" },
    { key: "HQ_3", label: "實習連輔導長", rowGroup: "連部" },
    { key: "HQ_4", label: "實習連士官督導長", rowGroup: "連部" }
  );

  // Row 2: Platoon
  slots.push(
    { key: "PL_1", label: "一排排長", rowGroup: "排部" },
    { key: "PL_2", label: "二排排長", rowGroup: "排部" },
    { key: "PL_3", label: "三排排長", rowGroup: "排部" }
  );

  // Row 3: Staff
  const staffOrder = ["人事士", "訓練士", "後勤士", "政戰士", "軍械士", "資安士"];
  staffOrder.forEach((s, i) => {
    slots.push({ key: `ST_${i+1}`, label: s, rowGroup: "幕僚" });
  });

  // Row 4-15: Squads (1-12)
  for (let s = 1; s <= 12; s++) {
    const squadPrefix = `SQ_${s.toString().padStart(2, '0')}`;
    const rowName = `第${s}班`;
    
    // Squad Leader
    slots.push({ key: `${squadPrefix}_L`, label: `${rowName}班長`, rowGroup: rowName });
    
    // Members 1-10
    for (let m = 1; m <= 10; m++) {
      slots.push({ 
        key: `${squadPrefix}_${m.toString().padStart(2, '0')}`, 
        label: `${rowName}第${m}員`, 
        rowGroup: rowName 
      });
    }
  }

  return slots;
};

// Utility to get today's date string in YYYY-MM-DD local time
export const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export const getDateOffsetString = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};