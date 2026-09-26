export type MeetingPurpose = 'Client' | 'All' | 'Site Plan' | 'Site Visit' | 'Personal' | string;

export interface Meeting {
  id?: number;
  purpose: MeetingPurpose;
  title?: string;
  clientName?: string;
  description?: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  engineer?: string;
  coordinator?: string;
  location?: string;
  status?: string;    // 'Scheduled' | 'Completed' | 'Cancelled' | string
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingAlarm {
  meeting: Meeting;
  minutesLeft: number;
}

export type CallStatus = 'New Lead' | 'Offer-Submission' | 'Queries' | 'Negotiation' | 'Others' | string;

export interface CallLog {
  id?: number;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  title: string;
  clientVendorName: string;
  status: CallStatus;
  description?: string;
  callerName?: string;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskPriority = 'High' | 'Medium' | 'Low' | string;
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | string;

export interface TaskItem {
  id?: number;
  taskId?: string;
  title: string;
  assignedFrom?: string;
  assignedTo: string;
  dueDate?: string;    // YYYY-MM-DD
  time?: string;       // HH:mm or 10:00 AM
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  relatedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}
