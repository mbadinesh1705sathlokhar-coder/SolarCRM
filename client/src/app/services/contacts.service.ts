import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, BehaviorSubject, Subscription, timer, tap } from 'rxjs';
import { Meeting, CallLog, TaskItem, MeetingAlarm } from '../models/contacts.model';

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/contacts';

  // --- Real-time 15-Min Meeting Alarms State ---
  activeAlarms$ = new BehaviorSubject<MeetingAlarm[]>([]);
  targetMeetingId$ = new BehaviorSubject<number | null>(null);
  dismissedAlarmIds = new Set<number>();
  private alarmSub?: Subscription;

  constructor() {
    this.clearLegacyDemoCache();
    this.initAlarmChecker();
  }

  private clearLegacyDemoCache(): void {
    try {
      localStorage.removeItem('sathlokhar_meetings');
      localStorage.removeItem('sathlokhar_calls');
      localStorage.removeItem('sathlokhar_tasks');
    } catch (e) {
      // Ignore
    }
  }

  initAlarmChecker(): void {
    if (this.alarmSub) return;
    // Check alarms immediately and then every 20 seconds
    this.alarmSub = timer(0, 20000).subscribe(() => {
      this.checkMeetingAlarms();
    });
  }

  checkMeetingAlarms(): void {
    this.getMeetings().subscribe(meetings => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const newAlarms: MeetingAlarm[] = [];

      for (const m of meetings) {
        if (m.date === todayStr && m.status !== 'Completed' && m.status !== 'Cancelled') {
          if (!m.time) continue;
          const [hours, minutes] = m.time.split(':').map(Number);
          const meetingTime = new Date();
          meetingTime.setHours(hours, minutes, 0, 0);

          const diffMs = meetingTime.getTime() - now.getTime();
          const diffMinutes = Math.round(diffMs / 60000);

          // Within next 15 minutes and not past by more than 15 minutes
          if (diffMinutes >= -15 && diffMinutes <= 15) {
            if (!this.dismissedAlarmIds.has(m.id || 0)) {
              newAlarms.push({ meeting: m, minutesLeft: Math.max(0, diffMinutes) });
            }
          }
        }
      }

      const prevLength = this.activeAlarms$.value.length;
      this.activeAlarms$.next(newAlarms);

      if (prevLength === 0 && newAlarms.length > 0) {
        this.playAlarmChime();
      }
    });
  }

  dismissAlarm(meetingId?: number): void {
    if (meetingId) {
      this.dismissedAlarmIds.add(meetingId);
      const current = this.activeAlarms$.value.filter(a => a.meeting.id !== meetingId);
      this.activeAlarms$.next(current);
    } else {
      this.activeAlarms$.value.forEach(a => {
        if (a.meeting.id) this.dismissedAlarmIds.add(a.meeting.id);
      });
      this.activeAlarms$.next([]);
    }
  }

  dismissAll(): void {
    this.dismissAlarm();
  }

  playAlarmChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start(now);
      osc2.start(now + 0.12);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch {
      // Audio context might be restricted before interaction
    }
  }

  // --- Meetings ---
  getMeetings(): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(`${this.apiUrl}/meetings`).pipe(
      catchError(err => {
        console.warn('Backend unavailable, using local meetings cache:', err);
        const cached = localStorage.getItem('sathlokhar_meetings');
        return of(cached ? JSON.parse(cached) : this.getDefaultMeetings());
      })
    );
  }

  createMeeting(meeting: Partial<Meeting>): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.apiUrl}/meetings`, meeting).pipe(
      tap(() => this.checkMeetingAlarms()),
      catchError(err => {
        console.warn('Backend unavailable, saving meeting locally:', err);
        const newMeeting: Meeting = {
          id: Date.now(),
          purpose: meeting.purpose || 'Client',
          title: meeting.title,
          clientName: meeting.clientName,
          description: meeting.description,
          date: meeting.date || new Date().toISOString().split('T')[0],
          time: meeting.time || '10:00',
          engineer: meeting.engineer,
          coordinator: meeting.coordinator || 'Renuka',
          location: meeting.location,
          status: meeting.status || 'Scheduled'
        };
        const cached = this.getLocalMeetings();
        cached.push(newMeeting);
        localStorage.setItem('sathlokhar_meetings', JSON.stringify(cached));
        this.checkMeetingAlarms();
        return of(newMeeting);
      })
    );
  }

  updateMeeting(id: number, meeting: Partial<Meeting>): Observable<Meeting> {
    return this.http.put<Meeting>(`${this.apiUrl}/meetings/${id}`, meeting).pipe(
      tap(() => this.checkMeetingAlarms()),
      catchError(err => {
        const cached = this.getLocalMeetings();
        const idx = cached.findIndex(m => m.id === id);
        if (idx !== -1) {
          cached[idx] = { ...cached[idx], ...meeting };
          localStorage.setItem('sathlokhar_meetings', JSON.stringify(cached));
          this.checkMeetingAlarms();
          return of(cached[idx]);
        }
        return of(meeting as Meeting);
      })
    );
  }

  deleteMeeting(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/meetings/${id}`).pipe(
      tap(() => this.checkMeetingAlarms()),
      catchError(() => {
        const cached = this.getLocalMeetings().filter(m => m.id !== id);
        localStorage.setItem('sathlokhar_meetings', JSON.stringify(cached));
        this.checkMeetingAlarms();
        return of({ success: true });
      })
    );
  }

  // --- Calls ---
  getCalls(): Observable<CallLog[]> {
    return this.http.get<CallLog[]>(`${this.apiUrl}/calls`).pipe(
      catchError(err => {
        console.warn('Backend unavailable, using local calls cache:', err);
        const cached = localStorage.getItem('sathlokhar_calls');
        return of(cached ? JSON.parse(cached) : this.getDefaultCalls());
      })
    );
  }

  createCall(call: Partial<CallLog>): Observable<CallLog> {
    return this.http.post<CallLog>(`${this.apiUrl}/calls`, call).pipe(
      catchError(err => {
        const newCall: CallLog = {
          id: Date.now(),
          date: call.date || new Date().toISOString().split('T')[0],
          time: call.time || '10:00',
          title: call.title || 'Client Discussion',
          clientVendorName: call.clientVendorName || 'Client',
          status: call.status || 'New Lead',
          description: call.description || '',
          callerName: call.callerName || 'Renuka',
          phoneNumber: call.phoneNumber || ''
        };
        const cached = this.getLocalCalls();
        cached.unshift(newCall);
        localStorage.setItem('sathlokhar_calls', JSON.stringify(cached));
        return of(newCall);
      })
    );
  }

  deleteCall(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/calls/${id}`).pipe(
      catchError(() => {
        const cached = this.getLocalCalls().filter(c => c.id !== id);
        localStorage.setItem('sathlokhar_calls', JSON.stringify(cached));
        return of({ success: true });
      })
    );
  }

  // --- Tasks ---
  getTasks(): Observable<TaskItem[]> {
    return this.http.get<TaskItem[]>(`${this.apiUrl}/tasks`).pipe(
      catchError(err => {
        console.warn('Backend unavailable, using local tasks cache:', err);
        const cached = localStorage.getItem('sathlokhar_tasks');
        return of(cached ? JSON.parse(cached) : this.getDefaultTasks());
      })
    );
  }

  createTask(task: Partial<TaskItem>): Observable<TaskItem> {
    return this.http.post<TaskItem>(`${this.apiUrl}/tasks`, task).pipe(
      catchError(err => {
        const cached = this.getLocalTasks();
        const newTask: TaskItem = {
          id: Date.now(),
          taskId: `TSK-${100 + cached.length + 1}`,
          title: task.title || 'New Task',
          assignedFrom: task.assignedFrom || 'Admin',
          assignedTo: task.assignedTo || 'Unassigned',
          dueDate: task.dueDate || new Date().toISOString().split('T')[0],
          priority: task.priority || 'Medium',
          status: task.status || 'Pending',
          description: task.description || '',
          relatedTo: task.relatedTo || ''
        };
        cached.unshift(newTask);
        localStorage.setItem('sathlokhar_tasks', JSON.stringify(cached));
        return of(newTask);
      })
    );
  }

  updateTask(id: number, task: Partial<TaskItem>): Observable<TaskItem> {
    return this.http.put<TaskItem>(`${this.apiUrl}/tasks/${id}`, task).pipe(
      catchError(() => {
        const cached = this.getLocalTasks();
        const idx = cached.findIndex(t => t.id === id);
        if (idx !== -1) {
          cached[idx] = { ...cached[idx], ...task };
          localStorage.setItem('sathlokhar_tasks', JSON.stringify(cached));
          return of(cached[idx]);
        }
        return of(task as TaskItem);
      })
    );
  }

  deleteTask(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/tasks/${id}`).pipe(
      catchError(() => {
        const cached = this.getLocalTasks().filter(t => t.id !== id);
        localStorage.setItem('sathlokhar_tasks', JSON.stringify(cached));
        return of({ success: true });
      })
    );
  }

  // --- Helpers for offline / fallback ---
  private getLocalMeetings(): Meeting[] {
    const cached = localStorage.getItem('sathlokhar_meetings');
    return cached ? JSON.parse(cached) : this.getDefaultMeetings();
  }

  private getLocalCalls(): CallLog[] {
    const cached = localStorage.getItem('sathlokhar_calls');
    return cached ? JSON.parse(cached) : this.getDefaultCalls();
  }

  private getLocalTasks(): TaskItem[] {
    const cached = localStorage.getItem('sathlokhar_tasks');
    return cached ? JSON.parse(cached) : this.getDefaultTasks();
  }

  private getDefaultMeetings(): Meeting[] {
    return [];
  }

  private getDefaultCalls(): CallLog[] {
    return [];
  }

  private getDefaultTasks(): TaskItem[] {
    return [];
  }
}
