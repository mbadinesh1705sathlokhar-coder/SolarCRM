import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OfficeService, Employee, EmployeeAccessPermissions, ModuleAccess } from '../../../services/office.service';
import { AuthService } from '../../../services/auth.service';
import { MasterListService } from '../../../services/master-list.service';

export interface NavPageDefinition {
  key: string;
  name: string;
  category: 'sales' | 'finance' | 'activity' | 'inventory' | 'office';
  categoryLabel: string;
  icon: string;
  badgeBg: string;
  badgeColor: string;
  description: string;
}

export const NAV_PAGES_LIST: NavPageDefinition[] = [
  // Sales
  { key: 'campaigns', name: 'Campaigns', category: 'sales', categoryLabel: 'Sales', icon: 'bi-megaphone', badgeBg: '#f7fee7', badgeColor: '#4d7c0f', description: 'Marketing campaigns and lead generation initiatives' },
  { key: 'leads', name: 'Leads', category: 'sales', categoryLabel: 'Sales', icon: 'bi-person-lines-fill', badgeBg: '#f7fee7', badgeColor: '#4d7c0f', description: 'Customer leads, inquiries and qualification stages' },
  { key: 'oppurtunities', name: 'Oppurtunities', category: 'sales', categoryLabel: 'Sales', icon: 'bi-lightning-charge', badgeBg: '#f7fee7', badgeColor: '#4d7c0f', description: 'Sales opportunities, deal stages and order values' },
  { key: 'awarded-sites', name: 'Awarded sites', category: 'sales', categoryLabel: 'Sales', icon: 'bi-building-check', badgeBg: '#f7fee7', badgeColor: '#4d7c0f', description: 'Awarded project sites and execution analytics' },

  // Finances
  { key: 'payment-ledger', name: 'Client Payment ledger', category: 'finance', categoryLabel: 'Finances', icon: 'bi-wallet2', badgeBg: '#faf5ff', badgeColor: '#7e22ce', description: 'Client payment inflows, dues and balance history' },
  { key: 'expense-ledger', name: 'Expenses Ledger', category: 'finance', categoryLabel: 'Finances', icon: 'bi-receipt', badgeBg: '#faf5ff', badgeColor: '#7e22ce', description: 'Site expense disbursements and vendor PO/WO vouchers' },
  { key: 'vendor-ledger', name: 'Vendor Ledger', category: 'finance', categoryLabel: 'Finances', icon: 'bi-truck', badgeBg: '#faf5ff', badgeColor: '#7e22ce', description: 'Vendor liability ledgers, payments and credit terms' },

  // Activity
  { key: 'meetings', name: 'Meetings', category: 'activity', categoryLabel: 'Activity', icon: 'bi-calendar-check', badgeBg: '#f0f9ff', badgeColor: '#0369a1', description: 'Client, vendor, site and team meeting schedules' },
  { key: 'calls', name: 'Calls', category: 'activity', categoryLabel: 'Activity', icon: 'bi-telephone-fill', badgeBg: '#fdf2f8', badgeColor: '#be185d', description: 'Call logs, follow-ups and discussion records' },
  { key: 'tasks', name: 'Tasks', category: 'activity', categoryLabel: 'Activity', icon: 'bi-card-checklist', badgeBg: '#fffbeb', badgeColor: '#b45309', description: 'Daily employee tasks, assignments and checklists' },
  { key: 'site-plan', name: 'Site Plan', category: 'activity', categoryLabel: 'Activity', icon: 'bi-geo-alt-fill', badgeBg: '#f0fdf4', badgeColor: '#15803d', description: 'Site survey schedules, locations and engineer visits' },

  // Inventory
  { key: 'indent', name: 'Indent', category: 'inventory', categoryLabel: 'Inventory', icon: 'bi-file-earmark-text', badgeBg: '#f0fdfa', badgeColor: '#0f766e', description: 'Site material indent requisitions by engineers' },
  { key: 'warehouse', name: 'Warehouse', category: 'inventory', categoryLabel: 'Inventory', icon: 'bi-box-seam', badgeBg: '#f0fdfa', badgeColor: '#0f766e', description: 'Warehouse stock balance and materials availability' },
  { key: 'gate-pass', name: 'Gate Pass', category: 'inventory', categoryLabel: 'Inventory', icon: 'bi-pass', badgeBg: '#f0fdfa', badgeColor: '#0f766e', description: 'Material inward and outward dispatch gate passes' },
  { key: 'cart', name: 'Add to cart', category: 'inventory', categoryLabel: 'Inventory', icon: 'bi-cart3', badgeBg: '#f0fdfa', badgeColor: '#0f766e', description: 'Procurement requisition cart and orders' },

  // Office
  { key: 'office-employees', name: 'Employees', category: 'office', categoryLabel: 'Office', icon: 'bi-person-badge', badgeBg: '#fef3c7', badgeColor: '#92400e', description: 'Employee master, directory and access management' },
  { key: 'office-add-list', name: 'Add List', category: 'office', categoryLabel: 'Office', icon: 'bi-card-checklist', badgeBg: '#fef3c7', badgeColor: '#92400e', description: 'System dropdown master configuration lists' }
];

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.css']
})
export class EmployeesComponent implements OnInit, AfterViewInit, OnDestroy {
  private officeService = inject(OfficeService);
  private masterListService = inject(MasterListService);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Horizontal Scroll Synchronizer
  @ViewChild('topScrollWrapper') topScrollWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('dataTableEl') dataTableEl?: ElementRef<HTMLTableElement>;

  tableScrollWidth = 0;
  tableClientWidth = 0;
  private isSyncingTop = false;
  private isSyncingBottom = false;
  private resizeObserver?: ResizeObserver;

  employees: Employee[] = [];
  loading = false;
  searchTerm = '';

  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Table password visibility state
  showPasswordMap: { [id: number]: boolean } = {};
  modalShowPassword = false;

  // Add / Edit Modal
  isModalOpen = false;
  isEditMode = false;
  employeeForm: Partial<Employee> = this.getEmptyEmployee();
  employeeToEdit: Employee | null = null;

  // Access Permissions Modal State (Granular Nav Pages)
  isAccessModalOpen = false;
  employeeForAccess: Employee | null = null;
  activeNavCategory: 'all' | 'sales' | 'finance' | 'activity' | 'inventory' | 'office' = 'all';
  navSearchTerm = '';
  savingAccess = false;
  navPagesList = NAV_PAGES_LIST;
  accessForm: EmployeeAccessPermissions = {
    sales: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    finance: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    activity: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    inventory: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    office: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    navPages: {}
  };

  // Delete Modal
  isDeleteModalOpen = false;
  employeeToDelete: Employee | null = null;

  roleOptions = ['employee', 'admin'];
  responsibilityOptions = ['Sales', 'Engineers', 'Admin', 'Purchase'];

  designationOptions: string[] = [
    'Business Development Executive',
    'Junior Business Development Executive',
    'Junior Engineer',
    'Senior Engineer',
    'Asst. Manager',
    'General Manager',
    'Admin',
    'Project Manager'
  ];

  ngOnInit(): void {
    const cached = this.officeService.getCachedEmployees();
    if (cached.length > 0) {
      this.employees = cached;
      this.loading = false;
      this.updateTableWidth();
    } else {
      this.loading = true;
    }
    this.loadEmployees();
    this.loadMasterOptions();
  }

  loadMasterOptions(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const normalize = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
          const findItems = (title: string, def: string[]) => {
            const target = normalize(title);
            const match = res.data.find(l => normalize(l.title) === target);
            return match && match.items && match.items.length > 0 ? match.items : def;
          };
          this.designationOptions = findItems('Role / Designation', findItems('Designation', this.designationOptions));
          const loadedResp = findItems('Employee Responsibility', findItems('Responsibility', this.responsibilityOptions));
          if (!loadedResp.includes('Purchase')) {
            loadedResp.push('Purchase');
          }
          this.responsibilityOptions = loadedResp;
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  ngAfterViewInit(): void {
    this.updateTableWidth();
    if (typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateTableWidth();
      });
      if (this.tableWrapper?.nativeElement) {
        this.resizeObserver.observe(this.tableWrapper.nativeElement);
      }
      if (this.dataTableEl?.nativeElement) {
        this.resizeObserver.observe(this.dataTableEl.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  updateTableWidth(): void {
    setTimeout(() => {
      if (this.dataTableEl?.nativeElement && this.tableWrapper?.nativeElement) {
        this.tableScrollWidth = this.dataTableEl.nativeElement.scrollWidth;
        this.tableClientWidth = this.tableWrapper.nativeElement.clientWidth;
        if (this.topScrollWrapper?.nativeElement) {
          this.topScrollWrapper.nativeElement.scrollLeft = this.tableWrapper.nativeElement.scrollLeft;
        }
        this.cdr.markForCheck();
      }
    }, 50);
  }

  onTopScroll(): void {
    if (this.isSyncingBottom) return;
    this.isSyncingTop = true;
    if (this.tableWrapper?.nativeElement && this.topScrollWrapper?.nativeElement) {
      this.tableWrapper.nativeElement.scrollLeft = this.topScrollWrapper.nativeElement.scrollLeft;
    }
    requestAnimationFrame(() => {
      this.isSyncingTop = false;
    });
  }

  onTableScroll(): void {
    if (this.isSyncingTop) return;
    this.isSyncingBottom = true;
    if (this.topScrollWrapper?.nativeElement && this.tableWrapper?.nativeElement) {
      this.topScrollWrapper.nativeElement.scrollLeft = this.tableWrapper.nativeElement.scrollLeft;
    }
    requestAnimationFrame(() => {
      this.isSyncingBottom = false;
    });
  }

  toggleTablePassword(emp: Employee, event: Event): void {
    event.stopPropagation();
    if (!emp || emp.id === undefined) return;
    if (!this.isAdmin() && !this.isSelf(emp)) {
      this.showToast('You can only view your own password.', 'info');
      return;
    }
    this.showPasswordMap[emp.id] = !this.showPasswordMap[emp.id];
    this.cdr.markForCheck();
  }

  // --- PERMISSION CHECKS ---
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isSelf(emp: Employee): boolean {
    const curr = this.authService.currentUser();
    if (!curr) return false;
    if (emp.id && curr.id && emp.id === curr.id) return true;
    if (emp.username && curr.username && emp.username.toLowerCase().trim() === curr.username.toLowerCase().trim()) return true;
    if (emp.emailId && curr.emailId && emp.emailId.toLowerCase().trim() === curr.emailId.toLowerCase().trim()) return true;
    if (emp.name && curr.name && emp.name.toLowerCase().trim() === curr.name.toLowerCase().trim()) return true;
    return false;
  }

  canEditPhoto(): boolean {
    if (this.isAdmin()) return true;
    if (this.employeeToEdit) {
      return this.isSelf(this.employeeToEdit);
    }
    return false;
  }

  canEdit(emp: Employee): boolean {
    return this.isAdmin() || this.isSelf(emp) || this.authService.canEdit('office-employees') || this.authService.canEdit('office');
  }

  canDelete(emp: Employee): boolean {
    if (this.isSelf(emp)) return false; // Cannot delete self
    return this.isAdmin() || this.authService.canDelete('office-employees') || this.authService.canDelete('office');
  }

  canAdd(): boolean {
    return this.isAdmin() || this.authService.canAdd('office-employees') || this.authService.canAdd('office');
  }

  canManageAccess(): boolean {
    return this.authService.isAdmin() || 
           (this.authService.currentUser()?.username || '').toLowerCase() === 'mbadinesh1705@gmail.com' ||
           (this.authService.currentUser()?.designation || '').toLowerCase().includes('general manager');
  }

  openAccessModal(emp: Employee, event?: Event): void {
    event?.stopPropagation();
    this.employeeForAccess = emp;
    this.activeNavCategory = 'all';
    this.navSearchTerm = '';

    const p = emp.accessPermissions;
    const existingNavPages = p?.navPages || {};
    const isEmpAdmin = emp.role === 'admin';
    const isEng = (emp.responsibility || '').toLowerCase().includes('engineer');

    const navPages: { [k: string]: ModuleAccess } = {};

    this.navPagesList.forEach(item => {
      if (existingNavPages[item.key]) {
        navPages[item.key] = {
          canView: existingNavPages[item.key].canView !== false,
          canAdd: !!existingNavPages[item.key].canAdd,
          canEdit: !!existingNavPages[item.key].canEdit,
          canDelete: !!existingNavPages[item.key].canDelete
        };
      } else if (p && (p as any)[item.category]) {
        const parentMod = (p as any)[item.category];
        navPages[item.key] = {
          canView: parentMod.canView !== false,
          canAdd: !!parentMod.canAdd,
          canEdit: !!parentMod.canEdit,
          canDelete: !!parentMod.canDelete
        };
      } else {
        if (isEmpAdmin) {
          navPages[item.key] = { canView: true, canAdd: true, canEdit: true, canDelete: true };
        } else if (isEng) {
          const canV = ['awarded-sites', 'site-plan', 'indent', 'warehouse', 'gate-pass', 'cart', 'meetings', 'tasks'].includes(item.key);
          navPages[item.key] = { canView: canV, canAdd: canV, canEdit: canV, canDelete: false };
        } else {
          navPages[item.key] = { canView: true, canAdd: true, canEdit: true, canDelete: false };
        }
      }
    });

    this.accessForm = {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: isEmpAdmin,
      navPages: navPages
    };
    this.syncModuleFromNavPages();
    this.isAccessModalOpen = true;
    this.cdr.markForCheck();
  }

  closeAccessModal(): void {
    this.isAccessModalOpen = false;
    this.employeeForAccess = null;
    this.cdr.markForCheck();
  }

  get visibleNavPages(): NavPageDefinition[] {
    let list = this.navPagesList;
    if (this.activeNavCategory !== 'all') {
      list = list.filter(p => p.category === this.activeNavCategory);
    }
    if (this.navSearchTerm && this.navSearchTerm.trim()) {
      const term = this.navSearchTerm.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
    }
    return list;
  }

  getNavAccess(key: string): ModuleAccess {
    if (!this.accessForm.navPages) {
      this.accessForm.navPages = {};
    }
    if (!this.accessForm.navPages[key]) {
      this.accessForm.navPages[key] = { canView: true, canAdd: true, canEdit: true, canDelete: false };
    }
    return this.accessForm.navPages[key];
  }

  toggleNavView(key: string): void {
    if (!this.canManageAccess()) return;
    const nav = this.getNavAccess(key);
    nav.canView = !nav.canView;
    if (!nav.canView) {
      nav.canAdd = false;
      nav.canEdit = false;
      nav.canDelete = false;
    } else {
      nav.canAdd = true;
      nav.canEdit = true;
      nav.canDelete = false;
    }
    this.syncModuleFromNavPages();
    this.cdr.markForCheck();
  }

  toggleNavAdd(key: string): void {
    if (!this.canManageAccess()) return;
    const nav = this.getNavAccess(key);
    if (!nav.canView) return;
    nav.canAdd = !nav.canAdd;
    this.syncModuleFromNavPages();
    this.cdr.markForCheck();
  }

  toggleNavEdit(key: string): void {
    if (!this.canManageAccess()) return;
    const nav = this.getNavAccess(key);
    if (!nav.canView) return;
    nav.canEdit = !nav.canEdit;
    this.syncModuleFromNavPages();
    this.cdr.markForCheck();
  }

  toggleNavDelete(key: string): void {
    if (!this.canManageAccess()) return;
    const nav = this.getNavAccess(key);
    if (!nav.canView) return;
    nav.canDelete = !nav.canDelete;
    this.syncModuleFromNavPages();
    this.cdr.markForCheck();
  }

  toggleCategoryAll(category: 'sales' | 'finance' | 'activity' | 'inventory' | 'office' | 'all', enable: boolean): void {
    if (!this.canManageAccess()) return;
    const pages = category === 'all' 
      ? this.navPagesList 
      : this.navPagesList.filter(p => p.category === category);

    pages.forEach(p => {
      const nav = this.getNavAccess(p.key);
      nav.canView = enable;
      nav.canAdd = enable;
      nav.canEdit = enable;
      nav.canDelete = false;
    });
    this.syncModuleFromNavPages();
    this.cdr.markForCheck();
  }

  applyRolePreset(preset: 'admin' | 'sales' | 'engineer' | 'viewAll' | 'revokeAll'): void {
    if (!this.canManageAccess()) return;
    this.navPagesList.forEach(p => {
      const nav = this.getNavAccess(p.key);
      if (preset === 'admin') {
        nav.canView = true;
        nav.canAdd = true;
        nav.canEdit = true;
        nav.canDelete = true;
      } else if (preset === 'viewAll') {
        nav.canView = true;
        nav.canAdd = false;
        nav.canEdit = false;
        nav.canDelete = false;
      } else if (preset === 'sales') {
        const isSales = ['campaigns', 'leads', 'oppurtunities', 'awarded-sites', 'meetings', 'calls', 'tasks'].includes(p.key);
        nav.canView = isSales;
        nav.canAdd = isSales;
        nav.canEdit = isSales;
        nav.canDelete = false;
      } else if (preset === 'engineer') {
        const isEng = ['awarded-sites', 'site-plan', 'indent', 'warehouse', 'gate-pass', 'cart', 'meetings', 'tasks'].includes(p.key);
        nav.canView = isEng;
        nav.canAdd = isEng;
        nav.canEdit = isEng;
        nav.canDelete = false;
      } else if (preset === 'revokeAll') {
        nav.canView = false;
        nav.canAdd = false;
        nav.canEdit = false;
        nav.canDelete = false;
      }
    });
    this.syncModuleFromNavPages();
    this.cdr.markForCheck();
  }

  syncModuleFromNavPages(): void {
    if (!this.accessForm.navPages) return;
    const cats: ('sales' | 'finance' | 'activity' | 'inventory' | 'office')[] = ['sales', 'finance', 'activity', 'inventory', 'office'];
    cats.forEach(cat => {
      const pagesInCat = this.navPagesList.filter(p => p.category === cat);
      const anyView = pagesInCat.some(p => this.accessForm.navPages![p.key]?.canView !== false);
      const anyAdd = pagesInCat.some(p => !!this.accessForm.navPages![p.key]?.canAdd);
      const anyEdit = pagesInCat.some(p => !!this.accessForm.navPages![p.key]?.canEdit);
      const anyDelete = pagesInCat.some(p => !!this.accessForm.navPages![p.key]?.canDelete);
      this.accessForm[cat] = {
        canView: anyView,
        canAdd: anyAdd,
        canEdit: anyEdit,
        canDelete: anyDelete
      };
    });
  }

  getCategoryNavCount(category: string): number {
    if (category === 'all') return this.navPagesList.length;
    return this.navPagesList.filter(p => p.category === category).length;
  }

  getCategoryEnabledCount(category: string): number {
    const pages = category === 'all' 
      ? this.navPagesList 
      : this.navPagesList.filter(p => p.category === category);
    return pages.filter(p => this.getNavAccess(p.key).canView).length;
  }

  getTotalEnabledNavCount(): number {
    return this.navPagesList.filter(p => this.getNavAccess(p.key).canView).length;
  }

  saveAccessPermissions(): void {
    if (!this.employeeForAccess?.id) return;
    if (!this.canManageAccess()) {
      this.showToast('Permission denied: Only Admin can configure access rights.', 'danger');
      return;
    }

    this.savingAccess = true;
    const empId = this.employeeForAccess.id;
    this.syncModuleFromNavPages();

    this.officeService.updateEmployee(empId, { accessPermissions: this.accessForm }).subscribe({
      next: (res) => {
        this.savingAccess = false;
        if (res.success) {
          const idx = this.employees.findIndex(e => e.id === empId);
          if (idx !== -1) {
            this.employees[idx] = { ...this.employees[idx], accessPermissions: { ...this.accessForm } };
          }
          if (this.isSelf(this.employeeForAccess!)) {
            const curr = this.authService.currentUser();
            if (curr) {
              this.authService.setCurrentUser({ ...curr, accessPermissions: { ...this.accessForm } });
            }
          }
          this.showToast(`Access permissions updated for ${this.employeeForAccess!.name}!`, 'success');
          this.closeAccessModal();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingAccess = false;
        this.showToast('Failed to update access permissions.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  getAccessSummary(emp: Employee): string {
    if (emp.role === 'admin') return 'Full Control';
    const p = emp.accessPermissions;
    if (!p) return 'All Navs (15)';

    if (p.navPages) {
      const total = this.navPagesList.length;
      const allowed = this.navPagesList.filter(page => p.navPages![page.key]?.canView !== false).length;
      if (allowed === total) {
        const allDelete = this.navPagesList.every(page => !!p.navPages![page.key]?.canDelete);
        if (allDelete) return 'Full Control';
        const allViewOnly = this.navPagesList.every(page => !p.navPages![page.key]?.canAdd && !p.navPages![page.key]?.canEdit);
        if (allViewOnly) return 'View Only (All)';
        return 'All Navs (15)';
      }
      if (allowed === 0) return 'No Access (0)';
      return `${allowed}/${total} Navs`;
    }

    if (p.sales && p.finance && p.activity && p.inventory) {
      const mods = [p.sales, p.finance, p.activity, p.inventory];
      const allFull = mods.every(m => m.canView && m.canAdd && m.canEdit && m.canDelete);
      if (allFull) return 'Full Control';
      const allViewOnly = mods.every(m => m.canView && !m.canAdd && !m.canEdit && !m.canDelete);
      if (allViewOnly) return 'View Only';
      return 'Custom Access';
    }
    return 'All Navs (15)';
  }

  loadEmployees(): void {
    this.officeService.getEmployees().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.employees = res.data;
        }
        this.loading = false;
        this.updateTableWidth();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load employees.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get filteredEmployees(): Employee[] {
    if (!this.searchTerm.trim()) return this.employees;
    const term = this.searchTerm.trim().toLowerCase();
    return this.employees.filter(e =>
      (e.name || '').toLowerCase().includes(term) ||
      (e.designation || '').toLowerCase().includes(term) ||
      (e.responsibility || '').toLowerCase().includes(term) ||
      (e.phoneNo || '').toLowerCase().includes(term) ||
      (e.emailId || '').toLowerCase().includes(term) ||
      (e.username || '').toLowerCase().includes(term) ||
      (e.role || '').toLowerCase().includes(term) ||
      (e.address || '').toLowerCase().includes(term) ||
      (e.experience || '').toLowerCase().includes(term)
    );
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('Only Admin can add new employees.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.employeeForm = this.getEmptyEmployee();
    this.employeeToEdit = null;
    this.modalShowPassword = false;
    this.isModalOpen = true;
  }

  openEditModal(emp: Employee): void {
    if (!this.canEdit(emp)) {
      this.showToast(`Permission denied: You can only change your own credentials.`, 'danger');
      return;
    }
    this.isEditMode = true;
    this.employeeToEdit = emp;
    this.employeeForm = { ...emp };
    this.modalShowPassword = false;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.employeeToEdit = null;
    this.employeeForm = this.getEmptyEmployee();
    this.modalShowPassword = false;
  }

  saveEmployee(): void {
    if (!this.employeeForm.name?.trim()) {
      this.showToast('Employee Name is required.', 'danger');
      return;
    }

    if (this.isEditMode && this.employeeToEdit?.id) {
      // Non-admin can only change own username and password
      const payload: Partial<Employee> = { ...this.employeeForm };
      if (!this.isAdmin()) {
        payload.role = this.employeeToEdit.role || 'employee';
        payload.designation = this.employeeToEdit.designation;
        payload.responsibility = this.employeeToEdit.responsibility || 'Sales';
      }

      this.officeService.updateEmployee(this.employeeToEdit.id, payload).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.employees.findIndex(e => e.id === this.employeeToEdit!.id);
            if (idx !== -1) {
              this.employees[idx] = res.data;
            }
            // Update auth service session if user updated own details
            if (this.isSelf(this.employeeToEdit!)) {
              this.authService.setCurrentUser(res.data);
            }
            this.showToast('Credentials and employee details updated successfully!', 'success');
            this.closeModal();
            this.updateTableWidth();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update employee.', 'danger')
      });
    } else {
      if (!this.isAdmin()) {
        this.showToast('Only Admin can register new employees.', 'danger');
        return;
      }
      this.officeService.createEmployee(this.employeeForm).subscribe({
        next: (res) => {
          if (res.success) {
            this.employees.unshift(res.data);
            this.showToast('New employee added successfully with credentials!', 'success');
            this.closeModal();
            this.updateTableWidth();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add employee.', 'danger')
      });
    }
  }

  confirmDelete(emp: Employee): void {
    if (!this.canDelete(emp)) {
      this.showToast('Only Admin can delete employees.', 'danger');
      return;
    }
    this.employeeToDelete = emp;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.employeeToDelete = null;
  }

  deleteEmployee(): void {
    if (!this.employeeToDelete?.id) return;
    const id = this.employeeToDelete.id;
    this.officeService.deleteEmployee(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.employees = this.employees.filter(e => e.id !== id);
          this.showToast('Employee removed successfully.', 'success');
          this.closeDeleteModal();
          this.updateTableWidth();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete employee.', 'danger')
    });
  }

  onPhotoFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('Profile image must be less than 5MB.', 'danger');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.employeeForm.photo = reader.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.employeeForm.photo = '';
    this.cdr.markForCheck();
  }

  getEmptyEmployee(): Partial<Employee> {
    return {
      name: '',
      designation: 'Business Development Executive',
      phoneNo: '',
      emailId: '',
      address: '',
      experience: '',
      username: '',
      password: '',
      role: 'employee',
      photo: '',
      responsibility: 'Sales',
      accessPermissions: { canView: true, canAdd: true, canEdit: true, canDelete: false }
    };
  }

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 4500);
  }
}
