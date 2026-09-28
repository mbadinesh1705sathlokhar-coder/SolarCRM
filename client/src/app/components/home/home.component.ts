import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SalesService } from '../../services/sales.service';
import { SitePlanService, SitePlanItem } from '../../services/site-plan.service';
import { ContactsService } from '../../services/contacts.service';
import { InventoryService, Indent, GatePass, WarehouseMaterial, CartItem } from '../../services/inventory.service';
import { ProjectService } from '../../services/project.service';
import { OfficeService, Employee } from '../../services/office.service';
import { SalesLead } from '../../models/sales.model';
import { TaskItem, TaskPriority, TaskStatus, Meeting, CallLog } from '../../models/contacts.model';
import { Project, ClientPayment, SiteExpense } from '../../models/project.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  authService = inject(AuthService);
  private salesService = inject(SalesService);
  private sitePlanService = inject(SitePlanService);
  private contactsService = inject(ContactsService);
  private inventoryService = inject(InventoryService);
  private projectService = inject(ProjectService);
  private officeService = inject(OfficeService);
  private cdr = inject(ChangeDetectorRef);

  // User Profile & Role Info
  currentUser = this.authService.currentUser();
  userResponsibility: 'Sales' | 'Engineers' | 'Admin' | 'Purchase' = 'Sales';
  isAdmin = false;

  // --- Dynamic Timeframe Controls ---
  timeframePreset: 'week' | 'month' | 'year' | 'all' | 'custom' = 'month';
  fromDateStr = '';
  toDateStr = '';

  // --- Sales & Admin Dashboard Core Metrics ---
  awardedSitesCount = 0;
  awardedValue = 0;
  receivedValue = 0;
  poWoRegisteredCount = 0;
  poWoTotalAmount = 0;

  // --- Purchase Dashboard Core Metrics ---
  totalExpensesValue = 0;
  totalClientPaymentsValue = 0;

  // --- Sales Pipeline Metrics ---
  newLeadsCount = 0;
  followUpLeadsCount = 0;
  siteVisitPlannedCount = 0;
  siteVisitCompletedCount = 0;
  negotiationCount = 0;

  // --- Engineer Metrics ---
  assignedSitePlansCount = 0;
  upcomingMeetingsCount = 0;
  activeTasksCount = 0;
  engineerIndentsCount = 0; // Strictly respective engineer's indents

  // --- Inventory & Procurement Metrics ---
  totalIndentsCount = 0;
  warehouseTotalMaterialsCount = 0;
  warehouseLowStockCount = 0;
  gatePassesCount = 0;
  cartItemsCount = 0;

  // --- Raw Data Storage ---
  allProjects: Project[] = [];
  filteredAwardedProjects: Project[] = [];

  allPayments: ClientPayment[] = [];
  filteredPayments: ClientPayment[] = [];

  allExpenses: SiteExpense[] = [];
  filteredExpenses: SiteExpense[] = [];
  filteredPoWoExpenses: SiteExpense[] = [];

  allIndents: Indent[] = [];
  myIndents: Indent[] = [];

  allGatePasses: GatePass[] = [];
  warehouseMaterials: WarehouseMaterial[] = [];

  allMeetings: Meeting[] = [];
  allCalls: CallLog[] = [];
  allSitePlans: SitePlanItem[] = [];
  allEmployees: Employee[] = [];

  // --- Breakdown Drilldown Modal ---
  isBreakdownModalOpen = false;
  breakdownActiveTab: 'awarded' | 'payments' | 'powo' | 'expenses' = 'awarded';
  breakdownSearchTerm = '';

  // --- Activities Allotted Section ---
  activityActiveTab: 'todos' | 'tasks' | 'meetings' | 'calls' | 'siteplans' = 'todos';
  adminEmployeeFilter = 'all';

  // --- To-Do / Task Management State ---
  todos: TaskItem[] = [];
  todoFilter: 'all' | 'pending' | 'completed' = 'all';
  isTodoModalOpen = false;
  isEditMode = false;
  todoForm: Partial<TaskItem> = this.getEmptyTodo(false);

  // Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  ngOnInit(): void {
    this.detectUserRole();
    this.initDefaultTimeframe();
    this.loadAllDashboardData();

    // Re-sync with MySQL database to get latest permissions configured by Admin
    this.authService.refreshCurrentUser().subscribe((user) => {
      if (user) {
        this.detectUserRole();
        this.loadAllDashboardData();
        this.cdr.markForCheck();
      }
    });
  }

  detectUserRole(): void {
    const user = this.authService.currentUser();
    this.currentUser = user;
    this.isAdmin = this.authService.isAdmin();

    const resp = (user?.responsibility || '').trim().toLowerCase();
    if (this.isAdmin || resp === 'admin') {
      this.userResponsibility = 'Admin';
    } else if (resp === 'purchase' || resp.includes('purchase')) {
      this.userResponsibility = 'Purchase';
    } else if (resp === 'engineers' || resp.includes('engineer') || (user?.designation || '').toLowerCase().includes('engineer')) {
      this.userResponsibility = 'Engineers';
    } else {
      this.userResponsibility = 'Sales';
    }
  }

  // --- Timeframe Presets (Week, Month, Year, Custom) ---
  initDefaultTimeframe(): void {
    this.setTimeframe('month', false);
  }

  setTimeframe(preset: 'week' | 'month' | 'year' | 'all', apply = true): void {
    this.timeframePreset = preset;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      this.fromDateStr = '';
      this.toDateStr = '';
    } else if (preset === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const start = new Date(now.getFullYear(), now.getMonth(), diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      this.fromDateStr = formatYMD(start);
      this.toDateStr = formatYMD(end);
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.fromDateStr = formatYMD(start);
      this.toDateStr = formatYMD(end);
    } else if (preset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      this.fromDateStr = formatYMD(start);
      this.toDateStr = formatYMD(end);
    }

    if (apply) {
      this.applyTimeframeFilter();
    }
  }

  onCustomDateChange(): void {
    this.timeframePreset = 'custom';
    this.applyTimeframeFilter();
  }

  parseAnyDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const str = String(val).trim();
    if (!str || str === '-' || str === 'null' || str === 'undefined') return null;

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }

    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1;
      const d = parseInt(ymdMatch[3], 10);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }

    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    return null;
  }

  isWithinTimeframe(dateVal: any): boolean {
    if (!this.fromDateStr && !this.toDateStr) return true;
    const d = this.parseAnyDate(dateVal);
    if (!d) return false;

    if (this.fromDateStr) {
      const from = this.parseAnyDate(this.fromDateStr);
      if (from) {
        from.setHours(0, 0, 0, 0);
        if (d < from) return false;
      }
    }

    if (this.toDateStr) {
      const to = this.parseAnyDate(this.toDateStr);
      if (to) {
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    }

    return true;
  }

  isPoWo(paymentThrough?: string): boolean {
    if (!paymentThrough) return false;
    const clean = paymentThrough.trim().toUpperCase().replace(/[\s.]/g, '');
    return clean === 'PO' || clean === 'WO' || clean === 'PO/WO' || clean.includes('PO') || clean.includes('WO');
  }

  loadAllDashboardData(): void {
    const userName = (this.currentUser?.name || '').trim();

    // 1. Load Projects (Awarded Sites)
    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allProjects = res.data;
          this.applyTimeframeFilter();
        }
      },
      error: () => {}
    });

    // 2. Load Client Payments
    this.projectService.getPayments().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allPayments = res.data;
          this.applyTimeframeFilter();
        }
      },
      error: () => {}
    });

    // 3. Load Site Expenses
    this.projectService.getExpenses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allExpenses = res.data;
          this.applyTimeframeFilter();
        }
      },
      error: () => {}
    });

    // 4. Load Sales Leads
    this.salesService.getLeads().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.calculateSalesMetrics(res.data);
        }
      },
      error: () => {}
    });

    // 5. Load Indents
    this.inventoryService.getIndents().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allIndents = res.data;
          this.totalIndentsCount = res.data.length;
          this.filterEngineerIndents();
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // 6. Load Warehouse Materials
    this.inventoryService.getWarehouseMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.warehouseMaterials = res.data;
          this.warehouseTotalMaterialsCount = res.data.length;
          const lowStocks = res.data.filter(m =>
            (m.status || '').toLowerCase() === 'low stock' ||
            (m.status || '').toLowerCase() === 'out of stock' ||
            (Number(m.inStock) || 0) <= 5
          );
          this.warehouseLowStockCount = lowStocks.length;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // 7. Load Gate Passes
    this.inventoryService.getGatePasses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allGatePasses = res.data;
          this.gatePassesCount = res.data.length;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // 8. Load Cart Items
    this.inventoryService.getCartItems().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.cartItemsCount = res.data.length;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // 9. Load Activities (Site Plans, Meetings, Calls, Tasks, Employees)
    this.sitePlanService.getSitePlans('', true).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allSitePlans = res.data;
          this.applyActivitiesFilter();
        }
      },
      error: () => {}
    });

    this.contactsService.getMeetings().subscribe({
      next: (meetings) => {
        this.allMeetings = meetings;
        this.applyActivitiesFilter();
      },
      error: () => {}
    });

    this.contactsService.getCalls().subscribe({
      next: (calls) => {
        this.allCalls = calls;
        this.applyActivitiesFilter();
      },
      error: () => {}
    });

    this.contactsService.getTasks().subscribe({
      next: (tasks) => {
        this.todos = tasks;
        this.applyActivitiesFilter();
      },
      error: () => {}
    });

    this.officeService.getEmployees().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.allEmployees = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  // --- Recalculate Metrics based on Timeframe Selection ---
  applyTimeframeFilter(): void {
    // 1. Filter Awarded Sites (Projects)
    this.filteredAwardedProjects = this.allProjects.filter(p => {
      const d = p.awardedDate || p.createdAt;
      return this.isWithinTimeframe(d);
    });
    this.awardedSitesCount = this.filteredAwardedProjects.length;
    this.awardedValue = this.filteredAwardedProjects.reduce((sum, p) => sum + (Number(p.siteValue) || 0), 0);

    // 2. Filter Client Payments
    this.filteredPayments = this.allPayments.filter(p => {
      const d = p.paymentDate || p.createdAt;
      return this.isWithinTimeframe(d);
    });
    this.receivedValue = this.filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    this.totalClientPaymentsValue = this.receivedValue;

    // 3. Filter Site Expenses & PO/WO Registered
    this.filteredExpenses = this.allExpenses.filter(e => {
      const d = e.expenseDate || e.createdAt;
      return this.isWithinTimeframe(d);
    });
    this.totalExpensesValue = this.filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    this.filteredPoWoExpenses = this.filteredExpenses.filter(e => this.isPoWo(e.paymentThrough));
    this.poWoRegisteredCount = this.filteredPoWoExpenses.length;
    this.poWoTotalAmount = this.filteredPoWoExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    this.cdr.markForCheck();
  }

  // --- Strict Engineer Indent Scoping ---
  filterEngineerIndents(): void {
    const userName = (this.currentUser?.name || '').trim().toLowerCase();

    const isMatch = (engineerName?: string) => {
      if (!engineerName) return false;
      const clean = engineerName.trim().toLowerCase();
      return clean === userName || clean.includes(userName) || userName.includes(clean);
    };

    if (this.isAdmin) {
      this.engineerIndentsCount = this.allIndents.length;
      this.myIndents = [...this.allIndents];
    } else {
      this.myIndents = this.allIndents.filter(ind => isMatch(ind.siteEngineer));
      this.engineerIndentsCount = this.myIndents.length;
    }
  }

  // --- Sales Leads Metrics ---
  calculateSalesMetrics(leads: SalesLead[]): void {
    const userName = (this.currentUser?.name || '').trim().toLowerCase();

    const relevantLeads = this.isAdmin
      ? leads
      : leads.filter(l => {
          const handler = (l.leadHandler || '').toLowerCase();
          return handler === userName || handler.includes(userName) || userName.includes(handler);
        });

    this.newLeadsCount = relevantLeads.filter(l => (l.leadStatus || '').toLowerCase() === 'new').length;
    const planned = relevantLeads.filter(l => (l.leadStatus || '').toLowerCase() === 'site visit planned').length;
    const completed = relevantLeads.filter(l => (l.leadStatus || '').toLowerCase() === 'site visit completed').length;
    const neg = relevantLeads.filter(l => (l.leadStatus || '').toLowerCase() === 'negotiation').length;

    this.siteVisitPlannedCount = planned;
    this.siteVisitCompletedCount = completed;
    this.negotiationCount = neg;
    this.followUpLeadsCount = planned + completed + neg;

    this.cdr.markForCheck();
  }

  // --- Allotted Activities Filter (Admin drilldown or individual employee) ---
  applyActivitiesFilter(): void {
    const currentUserName = (this.currentUser?.name || '').trim().toLowerCase();
    const filterUser = this.isAdmin && this.adminEmployeeFilter !== 'all'
      ? this.adminEmployeeFilter.trim().toLowerCase()
      : (this.isAdmin ? '' : currentUserName);

    const matchesFilter = (name?: string, secondName?: string) => {
      if (!filterUser) return true; // Admin viewing all
      const n1 = (name || '').trim().toLowerCase();
      const n2 = (secondName || '').trim().toLowerCase();
      return n1 === filterUser || n1.includes(filterUser) || filterUser.includes(n1) ||
             n2 === filterUser || n2.includes(filterUser) || filterUser.includes(n2);
    };

    // 1. Site Plans
    const matchedPlans = this.allSitePlans.filter(sp => matchesFilter(sp.engineerName, sp.assignedBy));
    this.assignedSitePlansCount = matchedPlans.length;

    // 2. Meetings
    const activeMeetings = this.allMeetings.filter(m => {
      if (m.status === 'Completed' || m.status === 'Cancelled') return false;
      return matchesFilter(m.engineer, m.coordinator);
    });
    this.upcomingMeetingsCount = activeMeetings.length;

    // 3. Tasks
    const activeTasks = this.todos.filter(t => {
      if (t.status === 'Completed') return false;
      return matchesFilter(t.assignedTo, t.assignedFrom);
    });
    this.activeTasksCount = activeTasks.length;

    this.cdr.markForCheck();
  }

  onAdminEmployeeFilterChange(): void {
    this.applyActivitiesFilter();
  }

  get filteredMeetingsList(): Meeting[] {
    const currentUserName = (this.currentUser?.name || '').trim().toLowerCase();
    const filterUser = this.isAdmin && this.adminEmployeeFilter !== 'all'
      ? this.adminEmployeeFilter.trim().toLowerCase()
      : (this.isAdmin ? '' : currentUserName);

    if (!filterUser) return this.allMeetings;
    return this.allMeetings.filter(m => {
      const eng = (m.engineer || '').toLowerCase();
      const coord = (m.coordinator || '').toLowerCase();
      return eng.includes(filterUser) || filterUser.includes(eng) || coord.includes(filterUser) || filterUser.includes(coord);
    });
  }

  get filteredCallsList(): CallLog[] {
    const currentUserName = (this.currentUser?.name || '').trim().toLowerCase();
    const filterUser = this.isAdmin && this.adminEmployeeFilter !== 'all'
      ? this.adminEmployeeFilter.trim().toLowerCase()
      : (this.isAdmin ? '' : currentUserName);

    if (!filterUser) return this.allCalls;
    return this.allCalls.filter(c => {
      const caller = (c.callerName || '').toLowerCase();
      return caller.includes(filterUser) || filterUser.includes(caller);
    });
  }

  get filteredSitePlansList(): SitePlanItem[] {
    const currentUserName = (this.currentUser?.name || '').trim().toLowerCase();
    const filterUser = this.isAdmin && this.adminEmployeeFilter !== 'all'
      ? this.adminEmployeeFilter.trim().toLowerCase()
      : (this.isAdmin ? '' : currentUserName);

    if (!filterUser) return this.allSitePlans;
    return this.allSitePlans.filter(sp => {
      const eng = (sp.engineerName || '').toLowerCase();
      const by = (sp.assignedBy || '').toLowerCase();
      return eng.includes(filterUser) || filterUser.includes(eng) || by.includes(filterUser) || filterUser.includes(by);
    });
  }

  // --- Breakdown Modal Logic ---
  openBreakdownModal(tab: 'awarded' | 'payments' | 'powo' | 'expenses'): void {
    this.breakdownActiveTab = tab;
    this.breakdownSearchTerm = '';
    this.isBreakdownModalOpen = true;
    this.cdr.markForCheck();
  }

  closeBreakdownModal(): void {
    this.isBreakdownModalOpen = false;
    this.cdr.markForCheck();
  }

  get breakdownAwardedList(): Project[] {
    if (!this.breakdownSearchTerm.trim()) return this.filteredAwardedProjects;
    const q = this.breakdownSearchTerm.toLowerCase();
    return this.filteredAwardedProjects.filter(p =>
      (p.clientName || '').toLowerCase().includes(q) ||
      (p.siteId || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q) ||
      (p.orderBy || '').toLowerCase().includes(q)
    );
  }

  get breakdownPaymentsList(): ClientPayment[] {
    if (!this.breakdownSearchTerm.trim()) return this.filteredPayments;
    const q = this.breakdownSearchTerm.toLowerCase();
    return this.filteredPayments.filter(p =>
      (p.clientName || '').toLowerCase().includes(q) ||
      (p.siteId || '').toLowerCase().includes(q) ||
      (p.paymentMode || '').toLowerCase().includes(q) ||
      (p.referenceNo || '').toLowerCase().includes(q)
    );
  }

  get breakdownPoWoList(): SiteExpense[] {
    if (!this.breakdownSearchTerm.trim()) return this.filteredPoWoExpenses;
    const q = this.breakdownSearchTerm.toLowerCase();
    return this.filteredPoWoExpenses.filter(e =>
      (e.clientName || '').toLowerCase().includes(q) ||
      (e.siteId || '').toLowerCase().includes(q) ||
      (e.purpose || '').toLowerCase().includes(q) ||
      (e.billVoucher || '').toLowerCase().includes(q) ||
      (e.paymentThrough || '').toLowerCase().includes(q) ||
      (e.vendorName || '').toLowerCase().includes(q)
    );
  }

  get breakdownExpensesList(): SiteExpense[] {
    if (!this.breakdownSearchTerm.trim()) return this.filteredExpenses;
    const q = this.breakdownSearchTerm.toLowerCase();
    return this.filteredExpenses.filter(e =>
      (e.clientName || '').toLowerCase().includes(q) ||
      (e.siteId || '').toLowerCase().includes(q) ||
      (e.purpose || '').toLowerCase().includes(q) ||
      (e.billVoucher || '').toLowerCase().includes(q) ||
      (e.paidBy || '').toLowerCase().includes(q)
    );
  }

  // --- To-Do / Task Management ---
  get allFilteredItems(): TaskItem[] {
    let list = this.todos;
    const currentUserName = (this.currentUser?.name || '').trim().toLowerCase();
    const filterUser = this.isAdmin && this.adminEmployeeFilter !== 'all'
      ? this.adminEmployeeFilter.trim().toLowerCase()
      : (this.isAdmin ? '' : currentUserName);

    if (filterUser) {
      list = list.filter(t => {
        const to = (t.assignedTo || '').toLowerCase();
        const from = (t.assignedFrom || '').toLowerCase();
        return to.includes(filterUser) || filterUser.includes(to) || from.includes(filterUser) || filterUser.includes(from);
      });
    }

    if (this.todoFilter === 'pending') {
      list = list.filter(t => t.status !== 'Completed');
    } else if (this.todoFilter === 'completed') {
      list = list.filter(t => t.status === 'Completed');
    }
    return list;
  }

  get filteredTasks(): TaskItem[] {
    return this.allFilteredItems.filter(t => (t.relatedTo || '').trim().toLowerCase() !== 'to-do' && (t.relatedTo || '').trim().toLowerCase() !== 'to-dos');
  }

  get filteredTodosList(): TaskItem[] {
    return this.allFilteredItems.filter(t => (t.relatedTo || '').trim().toLowerCase() === 'to-do' || (t.relatedTo || '').trim().toLowerCase() === 'to-dos');
  }

  get filteredTodos(): TaskItem[] {
    return this.allFilteredItems;
  }

  openAddTodoModal(isTodo: boolean = false): void {
    this.isEditMode = false;
    this.todoForm = this.getEmptyTodo(isTodo);
    this.isTodoModalOpen = true;
    this.cdr.markForCheck();
  }

  openEditTodoModal(todo: TaskItem): void {
    this.isEditMode = true;
    this.todoForm = { ...todo };
    this.isTodoModalOpen = true;
    this.cdr.markForCheck();
  }

  closeTodoModal(): void {
    this.isTodoModalOpen = false;
    this.todoForm = this.getEmptyTodo(false);
    this.cdr.markForCheck();
  }

  saveTodo(): void {
    if (!this.todoForm.title?.trim()) {
      this.showToast('Please enter a title for the item.', 'danger');
      return;
    }

    if (this.isEditMode && this.todoForm.id) {
      this.contactsService.updateTask(this.todoForm.id, this.todoForm).subscribe({
        next: (updated) => {
          const idx = this.todos.findIndex(t => t.id === updated.id);
          if (idx !== -1) {
            this.todos[idx] = updated;
          }
          this.showToast('Item updated successfully!', 'success');
          this.applyActivitiesFilter();
          this.closeTodoModal();
        },
        error: () => this.showToast('Failed to update item.', 'danger')
      });
    } else {
      this.contactsService.createTask(this.todoForm).subscribe({
        next: (created) => {
          this.todos.unshift(created);
          this.showToast('New item added!', 'success');
          this.applyActivitiesFilter();
          this.closeTodoModal();
        },
        error: () => this.showToast('Failed to create item.', 'danger')
      });
    }
  }

  canChangeTodoStatus(todo: TaskItem): boolean {
    if (this.isAdmin) return true;
    const currentName = (this.currentUser?.name || '').trim().toLowerCase();
    const assignedTo = (todo.assignedTo || '').trim().toLowerCase();
    return assignedTo === currentName || assignedTo.includes(currentName) || currentName.includes(assignedTo);
  }

  toggleTodoStatus(todo: TaskItem, event?: Event): void {
    event?.stopPropagation();
    if (!todo.id) return;

    if (!this.canChangeTodoStatus(todo)) {
      this.showToast(`Only the assigned employee (${todo.assignedTo}) can change this task's status.`, 'info');
      return;
    }

    const newStatus: TaskStatus = todo.status === 'Completed' ? 'Pending' : 'Completed';
    todo.status = newStatus;

    this.contactsService.updateTask(todo.id, { status: newStatus }).subscribe({
      next: () => {
        this.applyActivitiesFilter();
        this.cdr.markForCheck();
      },
      error: () => {
        todo.status = newStatus === 'Completed' ? 'Pending' : 'Completed';
        this.applyActivitiesFilter();
        this.cdr.markForCheck();
      }
    });
  }

  deleteTodo(todo: TaskItem, event?: Event): void {
    event?.stopPropagation();
    if (!todo.id) return;
    const id = todo.id;

    this.contactsService.deleteTask(id).subscribe({
      next: () => {
        this.todos = this.todos.filter(t => t.id !== id);
        this.showToast('Item removed.', 'info');
        this.applyActivitiesFilter();
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to remove item.', 'danger')
    });
  }

  getEmptyTodo(isTodo: boolean = false): Partial<TaskItem> {
    const today = new Date().toISOString().substring(0, 10);
    return {
      title: '',
      dueDate: today,
      time: '10:00 AM',
      description: '',
      priority: 'Medium',
      status: 'Pending',
      assignedTo: this.currentUser?.name || 'Self',
      assignedFrom: this.currentUser?.name || 'Self',
      relatedTo: isTodo ? 'To-Do' : 'Task'
    };
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    try {
      const d = this.parseAnyDate(dateStr);
      if (d) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  goTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 3500);
  }
}
