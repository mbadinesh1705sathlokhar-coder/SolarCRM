import { Component, inject, OnInit, OnDestroy, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of, timer } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContactsService } from '../../services/contacts.service';
import { AuthService } from '../../services/auth.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { Meeting, MeetingAlarm, CallLog, TaskItem } from '../../models/contacts.model';

export interface NotificationItem {
  id: string;
  category: 'task' | 'call' | 'meeting';
  type: 'task-assigned' | 'task-received' | 'task-team' | 'call' | 'meeting' | 'alarm';
  title: string;
  message: string;
  timeInfo?: string;
  statusBadge?: string;
  statusClass?: string;
  tagBadge?: string;
  tagClass?: string;
  route: string;
  queryParams?: any;
  targetId?: number;
  isAlarm?: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private contactsService = inject(ContactsService);
  authService = inject(AuthService);
  pushService = inject(PushNotificationService);
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);

  activeTopMenu = 'Dashboard';

  topMenuItems = [
    { label: 'Dashboard', route: '/home' },
    { label: 'Sales', route: '/sales/leads' },
    { label: 'Finances', route: '/payment-ledger' },
    { label: 'Office', route: '/office/employees' },
    { label: 'Inventory', route: '/inventory/indent' },
    { label: 'Analytics', route: '/awarded-sites' },
    { label: 'Calls', route: '/activity/calls' }
  ];

  get visibleTopMenuItems() {
    return this.topMenuItems.filter(item => {
      if (item.label === 'Dashboard') return true;
      if (item.label === 'Sales') return this.authService.canViewModule('sales');
      if (item.label === 'Finances') return this.authService.canViewModule('finance');
      if (item.label === 'Office') return this.authService.isAdmin();
      if (item.label === 'Inventory') return this.authService.canViewModule('inventory');
      if (item.label === 'Analytics') return true; // Awarded sites / Analytics page accessible to all
      if (item.label === 'Calls') return this.authService.canViewModule('activity');
      return true;
    });
  }

  // Notifications State
  notifications: NotificationItem[] = [];
  dismissedNotificationIds = new Set<string>();
  private readonly NOTIF_STORAGE_KEY = 'sathlokhar_dismissed_notifications';
  activeTabFilter: 'all' | 'task' | 'call' | 'meeting' = 'all';

  isNotificationOpen = false;
  isProfileOpen = false;
  private alarmSub?: Subscription;
  private refreshSub?: Subscription;
  private routerSub?: Subscription;

  activeAlarms: MeetingAlarm[] = [];
  pendingCompletions: { [id: string]: { secondsLeft: number; timerId: any } } = {};

  ngOnInit(): void {
    this.loadDismissedNotifications();
    this.updateActiveMenu(this.router.url);
    this.routerSub = this.router.events.subscribe(evt => {
      if (evt instanceof NavigationEnd) {
        this.updateActiveMenu(evt.urlAfterRedirects || evt.url);
      }
    });

    // Refresh notifications periodically (every 20s)
    this.refreshSub = timer(0, 20000).subscribe(() => {
      this.loadAllNotifications();
    });

    // Silently auto-subscribe device to push notifications in the background if granted
    const currentUser = this.authService.currentUser();
    if (currentUser?.name && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      this.pushService.requestPermissionAndSubscribe(currentUser.name).catch(() => {});
    }
  }

  private loadDismissedNotifications(): void {
    try {
      const saved = localStorage.getItem(this.NOTIF_STORAGE_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          this.dismissedNotificationIds = new Set(arr);
        }
      }
    } catch (e) {
      console.error('Failed to load dismissed notifications from localStorage', e);
    }
  }

  private saveDismissedNotifications(): void {
    try {
      const arr = Array.from(this.dismissedNotificationIds);
      const trimmed = arr.length > 1000 ? arr.slice(arr.length - 1000) : arr;
      localStorage.setItem(this.NOTIF_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save dismissed notifications to localStorage', e);
    }
  }

  restoreDismissed(event?: Event): void {
    event?.stopPropagation();
    this.dismissedNotificationIds.clear();
    try {
      localStorage.removeItem(this.NOTIF_STORAGE_KEY);
    } catch (e) {}
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    Object.values(this.pendingCompletions).forEach(p => clearInterval(p.timerId));
    this.pendingCompletions = {};
  }

  loadAllNotifications(): void {
    const user = this.authService.currentUser();
    const userName = (user?.name || '').trim();
    const userLower = userName.toLowerCase();
    const isAdmin = this.authService.isAdmin();

    forkJoin({
      tasks: this.contactsService.getTasks().pipe(catchError(() => of([]))),
      calls: this.contactsService.getCalls().pipe(catchError(() => of([]))),
      meetings: this.contactsService.getMeetings().pipe(catchError(() => of([])))
    }).subscribe(({ tasks, calls, meetings }) => {
      const list: NotificationItem[] = [];

      // 1. Process Meetings (All tracked upcoming meetings for user)
      for (const meeting of meetings) {
        if (meeting.status === 'Completed' || meeting.status === 'Cancelled') continue;

        const engineer = (meeting.engineer || '').trim().toLowerCase();
        const coordinator = (meeting.coordinator || '').trim().toLowerCase();
        const isAll = (meeting.purpose || '').toLowerCase() === 'all';
        const isMyMeeting = userLower && (engineer.includes(userLower) || userLower.includes(engineer) || coordinator.includes(userLower) || userLower.includes(coordinator));

        if (isMyMeeting || isAdmin || isAll) {
          list.push({
            id: `meeting-${meeting.id}`,
            category: 'meeting',
            type: 'meeting',
            title: `Meeting: ${meeting.purpose || 'Client'} (${meeting.time || ''})`,
            message: `Meeting with ${meeting.clientName || meeting.title || 'Client'}${meeting.location ? ' at ' + meeting.location : ''}`,
            timeInfo: `${meeting.time || ''} on ${meeting.date || ''}`.trim(),
            tagBadge: 'MEETING',
            tagClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
            statusBadge: meeting.status || 'Scheduled',
            statusClass: 'bg-light text-dark border',
            route: '/activity/meetings',
            queryParams: { viewMeetingId: meeting.id },
            targetId: meeting.id
          });
        }
      }

      // 2. Process Tasks
      // "what are the meeting/task are there for her that should be tracked"
      for (const task of tasks) {
        if (task.status === 'Completed') continue;

        const assignedTo = (task.assignedTo || '').trim();
        const assignedFrom = (task.assignedFrom || '').trim();
        const toLower = assignedTo.toLowerCase();
        const fromLower = assignedFrom.toLowerCase();

        const isReceivedByMe = userLower && (toLower === userLower || toLower.includes(userLower) || userLower.includes(toLower) || (isAdmin && toLower === 'admin'));
        const isAssignedByMe = userLower && (fromLower === userLower || fromLower.includes(userLower) || userLower.includes(fromLower) || (isAdmin && fromLower === 'admin'));

        if (isReceivedByMe) {
          list.push({
            id: `task-${task.id || task.taskId}`,
            category: 'task',
            type: 'task-received',
            title: 'Task Assigned to You',
            message: `You received a task from ${assignedFrom || 'Management'}: "${task.title}"`,
            timeInfo: task.dueDate ? `Due: ${task.dueDate}` : undefined,
            tagBadge: 'TASK ASSIGNED',
            tagClass: 'bg-primary-subtle text-primary border border-primary-subtle',
            statusBadge: task.status || 'Pending',
            statusClass: task.status === 'Completed' ? 'bg-success-subtle text-success' : (task.status === 'In Progress' ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'),
            route: '/activity/tasks',
            targetId: task.id
          });
        } else if (isAssignedByMe) {
          list.push({
            id: `task-${task.id || task.taskId}`,
            category: 'task',
            type: 'task-assigned',
            title: 'Task Delegated by You',
            message: `You assigned a task to ${assignedTo}: "${task.title}"`,
            timeInfo: task.dueDate ? `Due: ${task.dueDate}` : undefined,
            tagBadge: 'TASK DELEGATED',
            tagClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
            statusBadge: task.status || 'Pending',
            statusClass: task.status === 'Completed' ? 'bg-success-subtle text-success' : 'bg-light text-dark border',
            route: '/activity/tasks',
            targetId: task.id
          });
        } else if (isAdmin) {
          // Admin overview of team tasks
          list.push({
            id: `task-${task.id || task.taskId}`,
            category: 'task',
            type: 'task-team',
            title: `Task: ${assignedFrom || 'Admin'} → ${assignedTo || 'Team'}`,
            message: `"${task.title}" (${task.status})`,
            timeInfo: task.dueDate ? `Due: ${task.dueDate}` : undefined,
            tagBadge: 'TEAM TASK',
            tagClass: 'bg-light text-dark border border-secondary-subtle',
            statusBadge: task.status || 'Pending',
            statusClass: task.status === 'Completed' ? 'bg-success-subtle text-success' : 'bg-light text-dark border',
            route: '/activity/tasks',
            targetId: task.id
          });
        }
      }

      // 3. Process Calls
      for (const call of calls) {
        const caller = (call.callerName || '').trim();
        const callerLower = caller.toLowerCase();
        const isMyCall = userLower && (callerLower === userLower || callerLower.includes(userLower) || userLower.includes(callerLower));

        if (isMyCall || isAdmin) {
          list.push({
            id: `call-${call.id}`,
            category: 'call',
            type: 'call',
            title: isMyCall ? 'Client Call' : `Call by ${caller || 'Staff'}`,
            message: `Call with ${call.clientVendorName}: "${call.title}" (${call.status})`,
            timeInfo: `${call.time || ''} ${call.date || ''}`.trim(),
            tagBadge: 'CALL',
            tagClass: 'bg-success-subtle text-success border border-success-subtle',
            statusBadge: call.status || 'Call',
            statusClass: 'bg-light text-dark border',
            route: '/activity/calls',
            targetId: call.id
          });
        }
      }

      this.notifications = list;
      this.cdr.markForCheck();
    });
  }

  get filteredNotifications(): NotificationItem[] {
    let list = this.notifications.filter(n => !this.dismissedNotificationIds.has(n.id));
    if (this.activeTabFilter !== 'all') {
      list = list.filter(n => n.category === this.activeTabFilter);
    }
    return list;
  }

  get totalUnreadCount(): number {
    return this.notifications.filter(n => !this.dismissedNotificationIds.has(n.id)).length;
  }

  get taskCount(): number {
    return this.notifications.filter(n => !this.dismissedNotificationIds.has(n.id) && n.category === 'task').length;
  }

  get callCount(): number {
    return this.notifications.filter(n => !this.dismissedNotificationIds.has(n.id) && n.category === 'call').length;
  }

  get meetingCount(): number {
    return this.notifications.filter(n => !this.dismissedNotificationIds.has(n.id) && n.category === 'meeting').length;
  }

  setFilter(filter: 'all' | 'task' | 'call' | 'meeting', event: Event): void {
    event.stopPropagation();
    this.activeTabFilter = filter;
    this.cdr.markForCheck();
  }

  onNotificationClick(item: NotificationItem, event?: Event): void {
    event?.stopPropagation();
    this.isNotificationOpen = false;

    if (item.category === 'meeting' && item.targetId) {
      this.contactsService.targetMeetingId$.next(item.targetId);
    }

    if (item.queryParams) {
      this.router.navigate([item.route], { queryParams: item.queryParams });
    } else {
      this.router.navigate([item.route]);
    }
  }

  startCompletionCountdown(item: NotificationItem, event: Event): void {
    event.stopPropagation();
    if (this.pendingCompletions[item.id]) return;

    this.pendingCompletions[item.id] = {
      secondsLeft: 10,
      timerId: setInterval(() => {
        const pending = this.pendingCompletions[item.id];
        if (!pending) return;
        pending.secondsLeft -= 1;
        if (pending.secondsLeft <= 0) {
          this.commitCompletion(item);
        }
        this.cdr.markForCheck();
      }, 1000)
    };
    this.cdr.markForCheck();
  }

  cancelCompletionCountdown(item: NotificationItem, event?: Event): void {
    event?.stopPropagation();
    if (this.pendingCompletions[item.id]) {
      clearInterval(this.pendingCompletions[item.id].timerId);
      delete this.pendingCompletions[item.id];
      this.cdr.markForCheck();
    }
  }

  forceCompleteNow(item: NotificationItem, event?: Event): void {
    event?.stopPropagation();
    this.commitCompletion(item);
  }

  private commitCompletion(item: NotificationItem): void {
    if (this.pendingCompletions[item.id]) {
      clearInterval(this.pendingCompletions[item.id].timerId);
      delete this.pendingCompletions[item.id];
    }

    item.statusBadge = 'Completed';
    item.statusClass = 'bg-success-subtle text-success';

    const finalize = () => {
      this.dismissedNotificationIds.add(item.id);
      this.saveDismissedNotifications();
      if (item.category === 'meeting' && item.targetId) {
        this.contactsService.dismissAlarm(item.targetId);
      }
      this.loadAllNotifications();
    };

    if (item.category === 'task' && item.targetId) {
      this.contactsService.updateTask(item.targetId, { status: 'Completed' }).subscribe({
        next: () => setTimeout(finalize, 800),
        error: () => setTimeout(finalize, 800)
      });
    } else if (item.category === 'meeting' && item.targetId) {
      this.contactsService.updateMeeting(item.targetId, { status: 'Completed' }).subscribe({
        next: () => setTimeout(finalize, 800),
        error: () => setTimeout(finalize, 800)
      });
    } else {
      setTimeout(finalize, 800);
    }

    this.cdr.markForCheck();
  }

  dismissNotification(id: string, event: Event): void {
    event.stopPropagation();
    if (this.pendingCompletions[id]) {
      clearInterval(this.pendingCompletions[id].timerId);
      delete this.pendingCompletions[id];
    }
    this.dismissedNotificationIds.add(id);
    this.saveDismissedNotifications();

    if (id.startsWith('alarm-')) {
      const meetingId = Number(id.replace('alarm-', ''));
      if (!isNaN(meetingId)) this.contactsService.dismissAlarm(meetingId);
    } else if (id.startsWith('meeting-')) {
      const meetingId = Number(id.replace('meeting-', ''));
      if (!isNaN(meetingId)) this.contactsService.dismissAlarm(meetingId);
    }

    this.cdr.markForCheck();
  }

  dismissAll(event?: Event): void {
    event?.stopPropagation();
    Object.values(this.pendingCompletions).forEach(p => clearInterval(p.timerId));
    this.pendingCompletions = {};
    this.notifications.forEach(n => this.dismissedNotificationIds.add(n.id));
    this.saveDismissedNotifications();
    this.contactsService.dismissAll();
    this.cdr.markForCheck();
  }

  enablePushNotifications(event?: Event): void {
    event?.stopPropagation();
    const user = this.authService.currentUser();
    const userName = user?.name || 'Staff';
    this.pushService.requestPermissionAndSubscribe(userName).then(success => {
      this.cdr.markForCheck();
    });
  }

  sendTestPushNotification(event?: Event): void {
    event?.stopPropagation();
    const user = this.authService.currentUser();
    const userName = user?.name || 'Staff';
    this.pushService.sendTestNotification(userName).subscribe();
  }

  private updateActiveMenu(url: string): void {
    if (url.includes('/home')) {
      this.activeTopMenu = 'Dashboard';
    } else if (url.includes('/sales') || url.includes('/awarded-sites')) {
      this.activeTopMenu = 'Sales';
    } else if (url.includes('/payment-ledger') || url.includes('/expense-ledger') || url.includes('/warehouse-expenses') || url.includes('/vendor-ledger') || url.includes('/expo-expenses') || url.includes('/finances')) {
      this.activeTopMenu = 'Finances';
    } else if (url.includes('/office')) {
      this.activeTopMenu = 'Office';
    } else if (url.includes('/inventory')) {
      this.activeTopMenu = 'Inventory';
    } else if (url.includes('/contacts') || url.includes('/activity')) {
      this.activeTopMenu = 'Calls';
    } else if (url.includes('/dashboard') || url.includes('/projects')) {
      this.activeTopMenu = 'Analytics';
    }
    this.cdr.markForCheck();
  }

  selectMenu(item: { label: string; route: string }): void {
    this.activeTopMenu = item.label;
    this.router.navigateByUrl(item.route);
  }

  toggleNotification(event: Event): void {
    event.stopPropagation();
    this.isNotificationOpen = !this.isNotificationOpen;
    if (this.isNotificationOpen) {
      this.isProfileOpen = false;
      this.loadAllNotifications();
    }
  }

  toggleProfile(event: Event): void {
    event.stopPropagation();
    this.isProfileOpen = !this.isProfileOpen;
    if (this.isProfileOpen) this.isNotificationOpen = false;
    this.cdr.markForCheck();
  }

  navigateToEmployees(event?: Event): void {
    event?.stopPropagation();
    this.isProfileOpen = false;
    this.router.navigate(['/office/employees']);
  }

  logout(event?: Event): void {
    event?.stopPropagation();
    this.isProfileOpen = false;
    this.authService.logout();
  }

  isUploadingPhoto = false;

  openPhotoModal(event?: Event): void {
    event?.stopPropagation();
    this.authService.openPhotoModal();
  }

  closePhotoModal(): void {
    this.authService.closePhotoModal();
  }

  onPhotoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    this.isUploadingPhoto = true;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      this.authService.updateUserPhoto(base64Data).subscribe({
        next: () => {
          this.isUploadingPhoto = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isUploadingPhoto = false;
          this.cdr.markForCheck();
        }
      });
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    this.isUploadingPhoto = true;
    this.authService.updateUserPhoto('').subscribe({
      next: () => {
        this.isUploadingPhoto = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isUploadingPhoto = false;
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isNotificationOpen = false;
      this.isProfileOpen = false;
      this.cdr.markForCheck();
    }
  }
}
