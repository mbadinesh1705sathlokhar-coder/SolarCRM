import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationEnd, RouterModule } from '@angular/router';
import { ContactsService } from '../../services/contacts.service';
import { OfficeService, Employee } from '../../services/office.service';
import { AuthService } from '../../services/auth.service';
import { MasterListService } from '../../services/master-list.service';
import { Meeting, CallLog, TaskItem, MeetingPurpose, CallStatus, TaskPriority, TaskStatus } from '../../models/contacts.model';
import { Subscription, interval, filter } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.css']
})
export class ContactsComponent implements OnInit, OnDestroy {
  private contactsService = inject(ContactsService);
  private officeService = inject(OfficeService);
  private masterListService = inject(MasterListService);
  authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  activeTab: 'meetings' | 'calls' | 'tasks' = 'meetings';
  private routeSub?: Subscription;
  private timerSub?: Subscription;

  // --- Meetings State ---
  meetings: Meeting[] = [];
  filteredMeetings: Meeting[] = [];
  selectedEngineer: string = 'All';
  selectedPurposeFilter: string = 'All';
  calendarViewMode: 'workweek' | 'week' | 'list' = 'week';
  currentCalendarDate: Date = new Date();
  timeSlots: number[] = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  selectedSlot: { dateStr: string; hour: number } | null = null;

  // Teams Modals (Join with ID & Meet Now)
  isJoinModalOpen = false;
  joinMeetingId = '';
  joinPasscode = '';
  isMeetNowModalOpen = false;
  meetNowTitle = 'Instant Team Meeting';
  
  // Meeting Modal State
  isMeetingModalOpen = false;
  editingMeetingId: number | null = null;
  meetingForm: {
    purpose: MeetingPurpose;
    title: string;
    clientName: string;
    description: string;
    date: string;
    time: string;
    engineer: string;
    coordinator: string;
    location: string;
    status: string;
  } = {
    purpose: 'Client',
    title: '',
    clientName: '',
    description: '',
    date: formatLocalDate(new Date()),
    time: '10:00',
    engineer: 'Karthik Raja',
    coordinator: 'Renuka',
    location: 'Microsoft Teams',
    status: 'Scheduled'
  };

  // Alarm State (15 minutes advance alert)
  activeAlarms: { meeting: Meeting; minutesLeft: number }[] = [];
  dismissedAlarmIds: Set<number> = new Set();
  alarmBannerDismissed = false;

  // Dynamic Master List Configurable Options
  callStatusOptions: string[] = ['New Lead', 'Offer-Submission', 'Queries', 'Negotiation', 'Others'];
  meetingPurposeOptions: string[] = ['Client', 'All', 'Site Plan', 'Site Visit'];
  meetingStatusOptions: string[] = ['Scheduled', 'Completed', 'Cancelled'];
  taskPriorityOptions: string[] = ['High', 'Medium', 'Low'];
  taskStatusOptions: string[] = ['Pending', 'In Progress', 'Completed'];

  // --- Calls State ---
  calls: CallLog[] = [];
  filteredCalls: CallLog[] = [];
  callSearchTerm: string = '';
  callStatusFilter: string = 'All';
  isCallModalOpen = false;
  editingCallId: number | null = null;
  callForm: {
    date: string;
    time: string;
    title: string;
    clientVendorName: string;
    status: CallStatus;
    description: string;
    callerName: string;
    phoneNumber: string;
  } = {
    date: formatLocalDate(new Date()),
    time: '10:00',
    title: '',
    clientVendorName: '',
    status: 'New Lead',
    description: '',
    callerName: 'Renuka',
    phoneNumber: ''
  };

  // --- Tasks State ---
  tasks: TaskItem[] = [];
  filteredTasks: TaskItem[] = [];
  taskSearchTerm: string = '';
  taskStatusFilter: string = 'All';
  taskPriorityFilter: string = 'All';
  isTaskModalOpen = false;
  officeEmployees: Employee[] = [];
  editingTaskId: number | null = null;
  taskForm: {
    title: string;
    assignedFrom: string;
    assignedTo: string;
    dueDate: string;
    priority: TaskPriority;
    status: TaskStatus;
    description: string;
    relatedTo: string;
  } = {
    title: '',
    assignedFrom: 'Dinesh Kumar',
    assignedTo: 'Renuka',
    dueDate: formatLocalDate(new Date()),
    priority: 'Medium',
    status: 'Pending',
    description: '',
    relatedTo: ''
  };

  get employeeNamesList(): string[] {
    const list: string[] = [];
    if (this.officeEmployees && this.officeEmployees.length > 0) {
      this.officeEmployees.forEach(e => {
        if (e.name && !list.includes(e.name)) {
          list.push(e.name);
        }
      });
    }
    if (list.length === 0) {
      return ['Dinesh Kumar', 'Renuka', 'Sathish', 'Soundarajan', 'V Sharath', 'K Karthikeyen', 'Daya', 'Rahul', 'Vairamani'];
    }
    return list;
  }

  getEmployeeDisplayName(name?: string): string {
    if (!name || name === 'Admin') return 'Dinesh Kumar';
    return name;
  }

  swapTaskAssignments(): void {
    const temp = this.taskForm.assignedFrom;
    this.taskForm.assignedFrom = this.taskForm.assignedTo;
    this.taskForm.assignedTo = temp;
    this.cdr.markForCheck();
  }

  // Dynamic Engineers list from Office Employees
  get dynamicEngineersList(): string[] {
    const list: string[] = [];
    if (this.officeEmployees && this.officeEmployees.length > 0) {
      this.officeEmployees.forEach(e => {
        const resp = (e.responsibility || '').toLowerCase();
        const des = (e.designation || '').toLowerCase();
        if (resp.includes('engineer') || des.includes('engineer') || des.includes('engg') || des.includes('technical')) {
          if (e.name && !list.includes(e.name)) {
            list.push(e.name);
          }
        }
      });
    }
    if (list.length === 0) {
      list.push('Soundarajan', 'Rahul', 'Vairamani');
    }
    if (this.meetingForm?.engineer && !list.includes(this.meetingForm.engineer)) {
      list.push(this.meetingForm.engineer);
    }
    return list;
  }

  // Backwards compatibility for any templates referencing engineersList
  get engineersList(): string[] {
    return this.dynamicEngineersList;
  }

  coordinatorsList = ['Renuka', 'Dinesh Kumar', 'Priya S'];
  adminShowAllMeetings = true;

  toggleAdminMeetingsView(showAll: boolean): void {
    this.adminShowAllMeetings = showAll;
    this.filterMeetings();
  }

  pendingViewMeetingId: number | null = null;
  private queryParamsSub?: Subscription;
  private targetMeetingSub?: Subscription;

  ngOnInit(): void {
    this.checkCurrentTab();

    // Listen to router navigation events so sidebar links switch tab immediately
    this.routeSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkCurrentTab();
    });

    // Listen to query params for direct deep-linking from notifications
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const viewId = params['viewMeetingId'] ? Number(params['viewMeetingId']) : null;
      if (viewId) {
        this.activeTab = 'meetings';
        const found = this.meetings.find(m => m.id === viewId);
        if (found) {
          this.openEditMeetingModal(found);
        } else {
          this.pendingViewMeetingId = viewId;
        }
      }
    });

    // Listen to in-app service target meeting ID
    this.targetMeetingSub = this.contactsService.targetMeetingId$.subscribe(id => {
      if (id) {
        this.activeTab = 'meetings';
        const found = this.meetings.find(m => m.id === id);
        if (found) {
          this.openEditMeetingModal(found);
        } else {
          this.pendingViewMeetingId = id;
        }
        this.contactsService.targetMeetingId$.next(null);
      }
    });

    this.loadAllData();
  }

  checkCurrentTab(): void {
    const url = (this.router.url || '').toLowerCase();
    if (url.includes('/calls')) {
      this.activeTab = 'calls';
    } else if (url.includes('/tasks')) {
      this.activeTab = 'tasks';
    } else {
      this.activeTab = 'meetings';
    }

    // Scroll to top of main content when tab changes
    window.scrollTo({ top: 0, behavior: 'instant' });
    const mainEl = document.querySelector('.main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }

    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.queryParamsSub?.unsubscribe();
    this.targetMeetingSub?.unsubscribe();
  }

  switchTab(tab: 'meetings' | 'calls' | 'tasks'): void {
    this.activeTab = tab;
    this.router.navigate(['/activity', tab]);
    this.checkCurrentTab();
  }

  loadAllData(): void {
    this.loadMasterLists();
    this.loadMeetings();
    this.loadCalls();
    this.loadTasks();
    this.loadOfficeEmployees();
  }

  loadMasterLists(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const normalize = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
          const findItems = (title: string, def: string[]) => {
            const target = normalize(title);
            const match = res.data.find(l => normalize(l.title) === target);
            return match && match.items && match.items.length > 0 ? match.items : def;
          };
          this.callStatusOptions = findItems('Call Status', this.callStatusOptions);
          this.meetingPurposeOptions = findItems('Meeting Purpose', this.meetingPurposeOptions);
          this.meetingStatusOptions = findItems('Meeting Status', this.meetingStatusOptions);
          this.taskPriorityOptions = findItems('Task Priority', this.taskPriorityOptions);
          this.taskStatusOptions = findItems('Task Status', this.taskStatusOptions);
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  loadOfficeEmployees(): void {
    this.officeService.getEmployees().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.officeEmployees = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  // ==========================================
  // 1. MEETINGS LOGIC & 15-MIN ALARM
  // ==========================================
  loadMeetings(): void {
    this.contactsService.getMeetings().subscribe(meetings => {
      this.meetings = meetings;
      this.filterMeetings();
      if (this.pendingViewMeetingId) {
        const found = this.meetings.find(m => m.id === this.pendingViewMeetingId);
        if (found) {
          this.openEditMeetingModal(found);
          this.pendingViewMeetingId = null;
        }
      }
      this.checkMeetingAlarms();
      this.cdr.markForCheck();
    });
  }

  filterMeetings(): void {
    const currentUser = this.authService.currentUser();
    const isAdmin = this.authService.isAdmin();
    const currentName = (currentUser?.name || '').trim().toLowerCase();

    this.filteredMeetings = this.meetings.filter(m => {
      // If admin and adminShowAllMeetings is true, display all meetings
      if (isAdmin && this.adminShowAllMeetings) {
        return true;
      }

      // If purpose is 'All', it applies to all employees!
      if (m.purpose === 'All') {
        return true;
      }

      // Otherwise (staff or admin viewing 'My Meetings'):
      // Only show meetings where current user is coordinator or engineer
      const cord = (m.coordinator || '').trim().toLowerCase();
      const eng = (m.engineer || '').trim().toLowerCase();

      return cord === currentName || 
             eng === currentName || 
             cord.includes(currentName) || 
             eng.includes(currentName);
    });
    this.cdr.markForCheck();
  }

  onEngineerFilterChange(): void {
    this.filterMeetings();
  }

  onPurposeFilterChange(): void {
    this.filterMeetings();
  }

  openNewMeetingModal(purpose: MeetingPurpose = 'Client'): void {
    if (!this.canAdd()) {
      alert('You do not have permission to schedule meetings.');
      return;
    }
    this.editingMeetingId = null;
    const currentUserName = this.authService.currentUser()?.name || 'Dinesh Kumar';
    const firstEngineer = this.dynamicEngineersList[0] || 'Soundarajan';
    this.meetingForm = {
      purpose,
      title: '',
      clientName: '',
      description: '',
      date: formatLocalDate(new Date()),
      time: '10:00',
      engineer: firstEngineer,
      coordinator: currentUserName,
      location: 'Microsoft Teams',
      status: 'Scheduled'
    };
    this.isMeetingModalOpen = true;
  }

  openEditMeetingModal(meeting: Meeting): void {
    this.selectedSlot = null;
    this.editingMeetingId = meeting.id || null;
    const currentUserName = this.authService.currentUser()?.name || 'Dinesh Kumar';
    this.meetingForm = {
      purpose: meeting.purpose,
      title: meeting.title || '',
      clientName: meeting.clientName || '',
      description: meeting.description || '',
      date: meeting.date,
      time: meeting.time,
      engineer: meeting.engineer || this.dynamicEngineersList[0] || 'Soundarajan',
      coordinator: meeting.coordinator || currentUserName,
      location: meeting.location || 'Microsoft Teams',
      status: meeting.status || 'Scheduled'
    };
    this.isMeetingModalOpen = true;
  }

  closeMeetingModal(): void {
    this.isMeetingModalOpen = false;
    this.editingMeetingId = null;
    this.selectedSlot = null;
  }

  saveMeeting(): void {
    let titleToSave = this.meetingForm.title;
    if (this.meetingForm.purpose === 'Client') {
      titleToSave = titleToSave || `Client Meeting: ${this.meetingForm.clientName}`;
    } else if (this.meetingForm.purpose === 'All') {
      titleToSave = titleToSave || 'All Employees Meeting';
      if (!this.meetingForm.clientName) {
        this.meetingForm.clientName = 'All Staff';
      }
    } else if (this.meetingForm.purpose === 'Site Plan' || this.meetingForm.purpose === 'Site Visit') {
      titleToSave = titleToSave || `Site Plan: ${this.meetingForm.clientName}`;
    }

    const payload: Partial<Meeting> = {
      purpose: this.meetingForm.purpose,
      title: titleToSave,
      clientName: this.meetingForm.clientName,
      description: this.meetingForm.description,
      date: this.meetingForm.date,
      time: this.meetingForm.time,
      engineer: (this.meetingForm.purpose === 'Site Plan' || this.meetingForm.purpose === 'Site Visit') ? this.meetingForm.engineer : undefined,
      coordinator: this.meetingForm.coordinator,
      location: this.meetingForm.location || (this.meetingForm.purpose === 'Site Plan' ? 'On-site Inspection' : 'Microsoft Teams'),
      status: this.meetingForm.status
    };

    if (this.editingMeetingId) {
      if (!this.canEdit()) {
        alert('You do not have permission to edit meetings.');
        return;
      }
      this.contactsService.updateMeeting(this.editingMeetingId, payload).subscribe(() => {
        this.loadMeetings();
        this.closeMeetingModal();
      });
    } else {
      if (!this.canAdd()) {
        alert('You do not have permission to schedule meetings.');
        return;
      }
      this.contactsService.createMeeting(payload).subscribe(() => {
        this.loadMeetings();
        this.closeMeetingModal();
      });
    }
  }

  deleteMeeting(meeting: Meeting, event: Event): void {
    event.stopPropagation();
    if (!meeting.id) return;
    if (!this.canDelete()) {
      alert('You do not have permission to delete meetings.');
      return;
    }
    if (confirm(`Are you sure you want to delete meeting "${meeting.title || meeting.clientName}"?`)) {
      this.contactsService.deleteMeeting(meeting.id).subscribe(() => {
        this.loadMeetings();
      });
    }
  }

  // 15-Minute Alarm Checker
  checkMeetingAlarms(): void {
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const newAlarms: { meeting: Meeting; minutesLeft: number }[] = [];

    for (const m of this.meetings) {
      if (m.date === todayStr && m.status !== 'Completed' && m.status !== 'Cancelled') {
        const [hours, minutes] = m.time.split(':').map(Number);
        const meetingTime = new Date();
        meetingTime.setHours(hours, minutes, 0, 0);

        const diffMs = meetingTime.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / 60000);

        // Within next 15 minutes and not already past by more than 5 minutes
        if (diffMinutes >= -2 && diffMinutes <= 15) {
          if (!this.dismissedAlarmIds.has(m.id || 0)) {
            newAlarms.push({ meeting: m, minutesLeft: Math.max(0, diffMinutes) });
          }
        }
      }
    }

    const previouslyEmpty = this.activeAlarms.length === 0;
    this.activeAlarms = newAlarms;
    this.cdr.markForCheck();

    // Play chime sound if new alarm just fired
    if (previouslyEmpty && newAlarms.length > 0) {
      this.playAlarmChime();
    }
  }

  dismissAlarm(meetingId?: number): void {
    if (meetingId) {
      this.dismissedAlarmIds.add(meetingId);
      this.contactsService.dismissAlarm(meetingId);
      this.activeAlarms = this.activeAlarms.filter(a => a.meeting.id !== meetingId);
    } else {
      this.activeAlarms.forEach(a => {
        if (a.meeting.id) {
          this.dismissedAlarmIds.add(a.meeting.id);
          this.contactsService.dismissAlarm(a.meeting.id);
        }
      });
      this.activeAlarms = [];
    }
    this.cdr.markForCheck();
  }

  private playAlarmChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const now = ctx.currentTime;
      // Dual-tone chime (Teams meeting reminder style)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.35);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn('Audio chime could not play:', e);
    }
  }

  // Teams Calendar Date & Grid Helpers
  getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay(); // 0 is Sun, 1 is Mon...
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  getWeekDays(): { name: string; dateStr: string; dateNum: string; isToday: boolean; fullDate: Date }[] {
    const monday = this.getMonday(this.currentCalendarDate);
    const count = 7; // Always include 7 days: Monday to Sunday
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayStr = formatLocalDate(new Date());
    const days = [];

    for (let i = 0; i < count; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatLocalDate(d);
      const dateNum = d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`;
      days.push({
        name: dayNames[i],
        dateStr,
        dateNum,
        isToday: dateStr === todayStr,
        fullDate: d
      });
    }
    return days;
  }

  formatHourLabel(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  getMeetingsForSlot(dateStr: string, hour: number): Meeting[] {
    return this.filteredMeetings.filter(m => {
      if (m.date !== dateStr) return false;
      if (!m.time) return false;
      const h = parseInt(m.time.split(':')[0], 10);
      return h === hour;
    });
  }

  getTileSubtitle(m: Meeting): string {
    if (m.purpose === 'All') {
      return (m.description && m.description.trim() !== m.title?.trim()) ? m.description : 'All Staff';
    }
    if (m.purpose === 'Client') {
      if (m.clientName && m.title && m.clientName.trim().toLowerCase() !== m.title.trim().toLowerCase()) {
        return m.clientName;
      }
      return m.description || 'Client Meeting';
    }
    if (m.purpose === 'Site Visit' || m.purpose === 'Site Plan') {
      return m.engineer ? `Site: ${m.engineer}` : (m.clientName || 'Site Plan');
    }
    return m.description || 'Internal';
  }

  onSlotClick(dateStr: string, hour: number): void {
    this.selectedSlot = { dateStr, hour };
    const formattedHour = (hour < 10 ? '0' : '') + hour + ':00';
    this.openNewMeetingModal('Client');
    this.meetingForm.date = dateStr;
    this.meetingForm.time = formattedHour;
  }

  getCurrentTimeOffsetPercent(): number {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (currentHour < 8 || currentHour > 19) return -1;
    const totalMinutes = (currentHour - 8) * 60 + currentMinute;
    const totalGridMinutes = 12 * 60; // 8 AM to 8 PM = 12 hours
    return (totalMinutes / totalGridMinutes) * 100;
  }

  isCurrentTimeVisible(): boolean {
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const days = this.getWeekDays();
    const hasToday = days.some(d => d.dateStr === todayStr);
    const hour = now.getHours();
    return hasToday && hour >= 8 && hour <= 19;
  }

  getMeetingsForDate(dateStr: string): Meeting[] {
    return this.filteredMeetings.filter(m => m.date === dateStr);
  }

  prevWeek(): void {
    const d = new Date(this.currentCalendarDate);
    d.setDate(d.getDate() - 7);
    this.currentCalendarDate = d;
  }

  nextWeek(): void {
    const d = new Date(this.currentCalendarDate);
    d.setDate(d.getDate() + 7);
    this.currentCalendarDate = d;
  }

  todayWeek(): void {
    this.currentCalendarDate = new Date();
  }

  // --- Teams Top Toolbar Modals ---
  openJoinModal(): void {
    this.joinMeetingId = '';
    this.joinPasscode = '';
    this.isJoinModalOpen = true;
  }

  closeJoinModal(): void {
    this.isJoinModalOpen = false;
  }

  joinMeetingSubmit(): void {
    if (!this.joinMeetingId) {
      alert('Please enter a Meeting ID');
      return;
    }
    alert(`Connecting to Microsoft Teams Meeting ID: ${this.joinMeetingId}...`);
    this.isJoinModalOpen = false;
  }

  openMeetNowModal(): void {
    this.meetNowTitle = 'Instant Team Meeting - ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.isMeetNowModalOpen = true;
  }

  closeMeetNowModal(): void {
    this.isMeetNowModalOpen = false;
  }

  startMeetNow(): void {
    const now = new Date();
    const newMeeting: Partial<Meeting> = {
      title: this.meetNowTitle,
      purpose: 'Personal',
      date: formatLocalDate(now),
      time: now.toTimeString().substring(0, 5),
      location: 'Microsoft Teams Instant Call',
      status: 'Scheduled',
      coordinator: 'Renuka'
    };
    this.contactsService.createMeeting(newMeeting).subscribe(() => {
      this.loadMeetings();
      this.closeMeetNowModal();
      alert(`Instant Teams Meeting "${this.meetNowTitle}" created successfully!`);
    });
  }

  // ==========================================
  // 2. CALLS LOGIC (FOR SALES TEAM)
  // ==========================================
  loadCalls(): void {
    this.contactsService.getCalls().subscribe(calls => {
      this.calls = calls;
      this.filterCalls();
      this.cdr.markForCheck();
    });
  }

  filterCalls(): void {
    this.filteredCalls = this.calls.filter(c => {
      const matchesSearch = !this.callSearchTerm || 
        c.clientVendorName.toLowerCase().includes(this.callSearchTerm.toLowerCase()) ||
        c.title.toLowerCase().includes(this.callSearchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(this.callSearchTerm.toLowerCase()));
      const matchesStatus = this.callStatusFilter === 'All' || c.status === this.callStatusFilter;
      return matchesSearch && matchesStatus;
    });
    this.cdr.markForCheck();
  }

  openNewCallModal(): void {
    if (!this.canAdd()) {
      alert('You do not have permission to log calls.');
      return;
    }
    this.editingCallId = null;
    this.callForm = {
      date: formatLocalDate(new Date()),
      time: new Date().toTimeString().substring(0, 5),
      title: '',
      clientVendorName: '',
      status: (this.callStatusOptions.length > 0 ? this.callStatusOptions[0] : 'New Lead') as CallStatus,
      description: '',
      callerName: 'Renuka',
      phoneNumber: ''
    };
    this.isCallModalOpen = true;
    this.cdr.markForCheck();
  }

  openEditCallModal(call: CallLog): void {
    if (!this.canEdit()) {
      alert('You do not have permission to edit call logs.');
      return;
    }
    this.editingCallId = call.id || null;
    this.callForm = {
      date: call.date ? call.date.substring(0, 10) : formatLocalDate(new Date()),
      time: call.time || '10:00',
      title: call.title || '',
      clientVendorName: call.clientVendorName || '',
      status: (call.status || 'New Lead') as CallStatus,
      description: call.description || '',
      callerName: call.callerName || 'Renuka',
      phoneNumber: call.phoneNumber || ''
    };
    this.isCallModalOpen = true;
    this.cdr.markForCheck();
  }

  closeCallModal(): void {
    this.isCallModalOpen = false;
    this.editingCallId = null;
    this.cdr.markForCheck();
  }

  saveCall(): void {
    if (!this.callForm.title || !this.callForm.clientVendorName) {
      alert('Please provide Title and Client/Vendor Name');
      return;
    }

    if (this.editingCallId) {
      if (!this.canEdit()) {
        alert('You do not have permission to edit call logs.');
        return;
      }
      this.contactsService.updateCall(this.editingCallId, this.callForm).subscribe(() => {
        this.loadCalls();
        this.closeCallModal();
        this.cdr.markForCheck();
      });
    } else {
      this.contactsService.createCall(this.callForm).subscribe(() => {
        this.loadCalls();
        this.closeCallModal();
        this.cdr.markForCheck();
      });
    }
  }

  deleteCall(call: CallLog): void {
    if (!call.id) return;
    if (!this.canDelete()) {
      alert('You do not have permission to delete call logs.');
      return;
    }
    if (confirm(`Are you sure you want to delete call log for "${call.clientVendorName}"?`)) {
      this.contactsService.deleteCall(call.id).subscribe(() => {
        this.loadCalls();
        this.cdr.markForCheck();
      });
    }
  }

  getCallStatusCount(status: CallStatus): number {
    return this.calls.filter(c => c.status === status).length;
  }

  formatCallDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const clean = dateStr.substring(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  formatTime12Hour(timeStr?: string): string {
    if (!timeStr) return '';
    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
      return timeStr;
    }
    const parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].substring(0, 2);
      if (isNaN(hours)) return timeStr;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const hoursStr = hours < 10 ? '0' + hours : '' + hours;
      return `${hoursStr}:${minutes} ${ampm}`;
    }
    return timeStr;
  }

  // ==========================================
  // 3. TASKS LOGIC (DATA TABLE FORMAT)
  // ==========================================
  loadTasks(): void {
    this.contactsService.getTasks().subscribe(tasks => {
      this.tasks = tasks;
      this.filterTasks();
      this.cdr.markForCheck();
    });
  }

  filterTasks(): void {
    const currentUser = this.authService.currentUser();
    const isAdmin = this.authService.isAdmin();
    const currentName = (currentUser?.name || '').trim().toLowerCase();

    this.filteredTasks = this.tasks.filter(t => {
      // If not admin: only the assigned employee (or the person who assigned it) can see this task!
      if (!isAdmin) {
        const to = (t.assignedTo || '').trim().toLowerCase();
        const from = (t.assignedFrom || '').trim().toLowerCase();
        const isAssignedToMe = to === currentName || to.includes(currentName) || currentName.includes(to);
        const isAssignedByMe = from === currentName || from.includes(currentName) || currentName.includes(from);
        if (!isAssignedToMe && !isAssignedByMe) {
          return false;
        }
      }

      const matchesSearch = !this.taskSearchTerm ||
        t.title.toLowerCase().includes(this.taskSearchTerm.toLowerCase()) ||
        (t.assignedFrom && t.assignedFrom.toLowerCase().includes(this.taskSearchTerm.toLowerCase())) ||
        (t.assignedTo && t.assignedTo.toLowerCase().includes(this.taskSearchTerm.toLowerCase())) ||
        (t.relatedTo && t.relatedTo.toLowerCase().includes(this.taskSearchTerm.toLowerCase()));
      const matchesStatus = this.taskStatusFilter === 'All' || t.status === this.taskStatusFilter;
      const matchesPriority = this.taskPriorityFilter === 'All' || t.priority === this.taskPriorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
    this.cdr.markForCheck();
  }

  canChangeTaskStatus(task: TaskItem): boolean {
    if (this.authService.isAdmin()) return true;
    const currentName = (this.authService.currentUser()?.name || '').trim().toLowerCase();
    const assignedTo = (task.assignedTo || '').trim().toLowerCase();
    return assignedTo === currentName || assignedTo.includes(currentName) || currentName.includes(assignedTo);
  }

  openNewTaskModal(): void {
    if (!this.canAdd()) {
      alert('You do not have permission to add new tasks.');
      return;
    }
    this.editingTaskId = null;
    const names = this.employeeNamesList;
    this.taskForm = {
      title: '',
      assignedFrom: names[0] || 'Dinesh Kumar',
      assignedTo: names[1] || 'Renuka',
      dueDate: formatLocalDate(new Date()),
      priority: 'Medium',
      status: 'Pending',
      description: '',
      relatedTo: ''
    };
    this.isTaskModalOpen = true;
    this.cdr.markForCheck();
  }

  openEditTaskModal(task: TaskItem): void {
    if (!this.canEdit()) {
      alert('You do not have permission to edit tasks.');
      return;
    }
    this.editingTaskId = task.id || null;
    const fromVal = (!task.assignedFrom || task.assignedFrom === 'Admin') ? 'Dinesh Kumar' : task.assignedFrom;
    this.taskForm = {
      title: task.title,
      assignedFrom: fromVal,
      assignedTo: task.assignedTo || 'Renuka',
      dueDate: task.dueDate ? task.dueDate.substring(0, 10) : formatLocalDate(new Date()),
      priority: task.priority,
      status: task.status,
      description: task.description || '',
      relatedTo: task.relatedTo || ''
    };
    this.isTaskModalOpen = true;
    this.cdr.markForCheck();
  }

  closeTaskModal(): void {
    this.isTaskModalOpen = false;
    this.cdr.markForCheck();
  }

  saveTask(): void {
    if (!this.taskForm.title || !this.taskForm.assignedTo) {
      alert('Please provide Task Title and Assignee');
      return;
    }

    if (this.editingTaskId) {
      if (!this.canEdit()) {
        alert('You do not have permission to edit tasks.');
        return;
      }
      this.contactsService.updateTask(this.editingTaskId, this.taskForm).subscribe(() => {
        this.loadTasks();
        this.closeTaskModal();
        this.cdr.markForCheck();
      });
    } else {
      if (!this.canAdd()) {
        alert('You do not have permission to add new tasks.');
        return;
      }
      this.contactsService.createTask(this.taskForm).subscribe(() => {
        this.loadTasks();
        this.closeTaskModal();
        this.cdr.markForCheck();
      });
    }
  }

  updateTaskStatus(task: TaskItem, newStatus: TaskStatus): void {
    if (!task.id) return;
    if (!this.canChangeTaskStatus(task)) {
      alert(`Only the assigned employee (${this.getEmployeeDisplayName(task.assignedTo)}) can change this task's status.`);
      return;
    }
    this.contactsService.updateTask(task.id, { status: newStatus }).subscribe({
      next: () => {
        task.status = newStatus;
        this.filterTasks();
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to update task status.');
      }
    });
  }

  deleteTask(task: TaskItem): void {
    if (!task.id) return;
    if (!this.canDelete()) {
      alert('You do not have permission to delete tasks.');
      return;
    }
    if (confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      this.contactsService.deleteTask(task.id).subscribe(() => {
        this.loadTasks();
      });
    }
  }

  // --- PERMISSION CHECKS ---
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  canAdd(): boolean {
    return this.authService.canAdd(this.activeTab) || this.authService.canAdd('activity');
  }

  canEdit(): boolean {
    return this.authService.canEdit(this.activeTab) || this.authService.canEdit('activity');
  }

  canDelete(): boolean {
    return this.authService.canDelete(this.activeTab) || this.authService.canDelete('activity');
  }

  exportCallsToPdf(): void {
    const list = this.filteredCalls;
    if (list.length === 0) {
      alert('No sales call records available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(219, 39, 119);
    doc.text('SOLAR SATHLOKHAR - SALES CALL LOGS REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Calls: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Date', 'Time', 'Client / Vendor Name', 'Call Title / Subject', 'Status', 'Discussion / Description', 'Employee / Caller']
    ];

    const body = list.map((c, idx) => [
      idx + 1,
      this.formatCallDate(c.date),
      this.formatTime12Hour(c.time) || '—',
      c.clientVendorName || '—',
      c.title || '—',
      c.status || '—',
      c.description || '—',
      c.callerName || '—'
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 242, 248] }
    });

    doc.save(`Sales_Calls_${new Date().toISOString().substring(0, 10)}.pdf`);
  }

  exportTasksToPdf(): void {
    const list = this.filteredTasks;
    if (list.length === 0) {
      alert('No tasks available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - TASK MANAGEMENT REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Tasks: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Task Title', 'Assigned From', 'Assigned To', 'Due Date', 'Priority', 'Status', 'Related Client / Project', 'Description']
    ];

    const body = list.map((t, idx) => [
      idx + 1,
      t.title || '—',
      t.assignedFrom || '—',
      t.assignedTo || '—',
      t.dueDate ? this.formatCallDate(t.dueDate) : '—',
      t.priority || 'Medium',
      t.status || 'Pending',
      t.relatedTo || '—',
      t.description || '—'
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] }
    });

    doc.save(`Tasks_Report_${new Date().toISOString().substring(0, 10)}.pdf`);
  }

  exportCallsToExcel(): void {
    if (!this.filteredCalls || this.filteredCalls.length === 0) {
      alert('No sales call records available to export to Excel.');
      return;
    }
    const headers = ['S.No', 'Date', 'Time', 'Client / Vendor Name', 'Call Title / Subject', 'Status', 'Discussion / Description', 'Employee / Caller'];
    const rows = this.filteredCalls.map((c, idx) => [
      idx + 1,
      `"${this.formatCallDate(c.date)}"`,
      `"${this.formatTime12Hour(c.time) || ''}"`,
      `"${(c.clientVendorName || '').replace(/"/g, '""')}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.status || ''}"`,
      `"${(c.description || '').replace(/"/g, '""')}"`,
      `"${c.callerName || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Calls_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothCallsPdfAndExcel(): void {
    this.exportCallsToPdf();
    setTimeout(() => {
      this.exportCallsToExcel();
    }, 450);
  }

  exportTasksToExcel(): void {
    if (!this.filteredTasks || this.filteredTasks.length === 0) {
      alert('No tasks available to export to Excel.');
      return;
    }
    const headers = ['S.No', 'Task Title', 'Assigned From', 'Assigned To', 'Due Date', 'Priority', 'Status', 'Related Client / Project', 'Description'];
    const rows = this.filteredTasks.map((t, idx) => [
      idx + 1,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.assignedFrom || ''}"`,
      `"${t.assignedTo || ''}"`,
      `"${t.dueDate ? this.formatCallDate(t.dueDate) : ''}"`,
      `"${t.priority || 'Medium'}"`,
      `"${t.status || 'Pending'}"`,
      `"${(t.relatedTo || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Tasks_Report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothTasksPdfAndExcel(): void {
    this.exportTasksToPdf();
    setTimeout(() => {
      this.exportTasksToExcel();
    }, 450);
  }

  @ViewChild('excelFileInput') excelFileInputRef?: ElementRef;

  triggerExcelImport(): void {
    if (this.excelFileInputRef) {
      this.excelFileInputRef.nativeElement.click();
    }
  }

  onExcelUploadSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawRows || rawRows.length === 0) {
          alert('The uploaded Excel file contains no data rows.');
          return;
        }

        const today = new Date().toISOString().substring(0, 10);

        if (this.activeTab === 'calls') {
          const callsBatch: Partial<CallLog>[] = rawRows.map((row, idx) => {
            const getVal = (keys: string[]) => {
              for (const k of keys) {
                const matchedKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
                if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                  return String(row[matchedKey]).trim();
                }
              }
              return '';
            };

            return {
              date: getVal(['date', 'call date']) || today,
              time: getVal(['time', 'call time']) || '10:00',
              clientVendorName: getVal(['client vendor name', 'client name', 'client', 'name']) || `Client ${idx + 1}`,
              title: getVal(['call title', 'title', 'subject']) || 'Sales Followup',
              status: (getVal(['status']) || 'Connected') as CallStatus,
              description: getVal(['discussion', 'description', 'notes', 'remarks']) || 'Imported via Excel',
              callerName: getVal(['caller name', 'caller', 'employee']) || 'Employee'
            };
          });

          let completed = 0;
          callsBatch.forEach(c => {
            this.contactsService.createCall(c as any).subscribe({
              next: () => {
                completed++;
                if (completed === callsBatch.length) {
                  this.loadCalls();
                  alert(`Successfully imported ${completed} sales call records from Excel!`);
                }
              },
              error: () => {
                completed++;
                if (completed === callsBatch.length) {
                  this.loadCalls();
                  alert(`Imported ${completed} call records from Excel.`);
                }
              }
            });
          });
        } else if (this.activeTab === 'tasks') {
          const tasksBatch: Partial<TaskItem>[] = rawRows.map((row, idx) => {
            const getVal = (keys: string[]) => {
              for (const k of keys) {
                const matchedKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
                if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                  return String(row[matchedKey]).trim();
                }
              }
              return '';
            };

            return {
              title: getVal(['task title', 'title', 'subject']) || `Task ${idx + 1}`,
              assignedFrom: getVal(['assigned from', 'from', 'creator']) || 'Admin',
              assignedTo: getVal(['assigned to', 'to', 'assignee']) || 'Employee',
              dueDate: getVal(['due date', 'due', 'date']) || today,
              priority: (getVal(['priority']) || 'Medium') as TaskPriority,
              status: (getVal(['status']) || 'Pending') as TaskStatus,
              relatedTo: getVal(['related client', 'related project', 'related to']) || 'General',
              description: getVal(['description', 'notes', 'remarks']) || 'Imported via Excel'
            };
          });

          let completed = 0;
          tasksBatch.forEach(t => {
            this.contactsService.createTask(t as any).subscribe({
              next: () => {
                completed++;
                if (completed === tasksBatch.length) {
                  this.loadTasks();
                  alert(`Successfully imported ${completed} tasks from Excel!`);
                }
              },
              error: () => {
                completed++;
                if (completed === tasksBatch.length) {
                  this.loadTasks();
                  alert(`Imported ${completed} task records from Excel.`);
                }
              }
            });
          });
        }

        input.value = '';
      } catch (err: any) {
        console.error('Excel upload error:', err);
        alert('Failed to parse Excel file: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  clearAllCalls(): void {
    if (confirm('Are you sure you want to clear ALL sales call records? This will delete all current call logs so you can upload a clean Excel file.')) {
      this.contactsService.clearAllCalls().subscribe({
        next: () => {
          alert('All call records cleared successfully.');
          this.loadCalls();
        },
        error: (err) => {
          alert('Failed to clear records: ' + (err?.message || 'Error'));
        }
      });
    }
  }

  clearAllTasks(): void {
    if (confirm('Are you sure you want to clear ALL task records? This will delete all current tasks so you can upload a clean Excel file.')) {
      this.contactsService.clearAllTasks().subscribe({
        next: () => {
          alert('All task records cleared successfully.');
          this.loadTasks();
        },
        error: (err) => {
          alert('Failed to clear records: ' + (err?.message || 'Error'));
        }
      });
    }
  }
}
