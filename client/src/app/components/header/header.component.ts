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
  activeTabFilter: 'all' | 'task' | 'call' | 'meeting' = 'all';

  isNotificationOpen = false;
  isProfileOpen = false;
  private alarmSub?: Subscription;
  private refreshSub?: Subscription;
  private routerSub?: Subscription;

  activeAlarms: MeetingAlarm[] = [];

  ngOnInit(): void {
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
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.routerSub?.unsubscribe();
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
            tagClass: 'bg-purple-subtle text-purple border border-purple-subtle',
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

  dismissNotification(id: string, event: Event): void {
    event.stopPropagation();
    this.dismissedNotificationIds.add(id);
    if (id.startsWith('alarm-')) {
      const meetingId = Number(id.replace('alarm-', ''));
      if (!isNaN(meetingId)) this.contactsService.dismissAlarm(meetingId);
    }
    this.cdr.markForCheck();
  }

  dismissAll(event?: Event): void {
    event?.stopPropagation();
    this.notifications.forEach(n => this.dismissedNotificationIds.add(n.id));
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
    } else if (url.includes('/sales')) {
      this.activeTopMenu = 'Sales';
    } else if (url.includes('/payment-ledger') || url.includes('/expense-ledger') || url.includes('/vendor-ledger') || url.includes('/finances')) {
      this.activeTopMenu = 'Finances';
    } else if (url.includes('/office')) {
      this.activeTopMenu = 'Office';
    } else if (url.includes('/inventory')) {
      this.activeTopMenu = 'Inventory';
    } else if (url.includes('/contacts') || url.includes('/activity')) {
      this.activeTopMenu = 'Calls';
    } else if (url.includes('/dashboard') || url.includes('/awarded-sites') || url.includes('/projects')) {
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isNotificationOpen = false;
      this.isProfileOpen = false;
      this.cdr.markForCheck();
    }
  }
}
