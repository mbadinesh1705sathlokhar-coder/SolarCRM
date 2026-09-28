import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { Project, SiteExpense } from '../../models/project.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { RouterModule } from '@angular/router';
import { OfficeService } from '../../services/office.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-expense-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './expense-ledger.component.html',
  styleUrls: ['./expense-ledger.component.css']
})
export class ExpenseLedgerComponent implements OnInit, AfterViewInit, OnDestroy {
  private projectService = inject(ProjectService);
  private officeService = inject(OfficeService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('topScrollWrapper') topScrollWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('dataTableEl') dataTableEl?: ElementRef<HTMLTableElement>;

  tableScrollWidth = 0;
  tableClientWidth = 0;
  private isSyncingTop = false;
  private isSyncingBottom = false;
  private resizeObserver?: ResizeObserver;

  projects: Project[] = [];
  expenses: SiteExpense[] = [];
  loading = false;
  searchQuery = '';
  marginFilter: 'All' | 'HasExpenses' | 'ZeroExpenses' = 'All';
  siteIdSortDirection: 'asc' | 'desc' | 'none' = 'none';

  // Pagination for Client List (114 clients + 1 central warehouse)
  currentPage = 1;
  pageSize = 20;

  // Central Warehouse Entity (Only in Expense Ledger for material receipts, not in Project Master)
  warehouseEntity: Project = {
    siteId: 'WAREHOUSE',
    clientName: 'Warehouse : Sathlokhar H.O',
    location: 'Sathlokhar H.O',
    awardedDate: '-',
    contactNo: '-',
    emailId: '-',
    address: 'Sathlokhar H.O, Central Store & Materials Inventory',
    siteCapacity: 'Stock Store',
    siteValue: 0,
    siteType: 'Central Warehouse',
    systemType: 'Central Inventory',
    siteCategory: 'Material Stock',
    clientType: 'Internal Store',
    saleType: 'Internal',
    orderBy: 'OFFICE',
    received: 0,
    due: 0,
    siteExpenses: 1440675,
    margin: 0,
    marginPercentage: 0,
    materialsSupply: true,
    installation: false,
    ebProcess: false,
    documents: false,
    warranty: false,
    handedOver: false
  };

  // --- CLIENT-SPECIFIC EXPENSE MODAL STATE ---
  isClientModalOpen = false;
  selectedProjectRef: Project | null = null;
  clientExpensesList: SiteExpense[] = [];
  loadingClientExpenses = false;

  // Form State for Adding / Editing Expense within Client Modal
  isAddingOrEditingExpense = false;
  isEditingPastRecord = false;
  editingExpenseId: number | null = null;
  editingOriginalAmount: number = 0;

  formData = {
    dateInput: '', // dd-mm-yyyy
    siteId: '',
    clientName: '',
    clientSiteName: '',
    paymentThrough: 'Petty Cash',
    purpose: 'Consumables',
    paidBy: 'OFFICE',
    vendor: '',
    remarks: '',
    billVoucher: 'Not Submitted',
    invoiceNo: '',
    amount: null as number | null
  };

  // Quick Invoice Modal for Bill Voucher toggle
  isInvoiceModalOpen = false;
  invoiceModalExpense: SiteExpense | null = null;
  invoiceModalInput = '';
  invoiceModalDate = '';

  // Quick Client Picker Modal (when clicking "+ Record New Expense" at top of page)
  isClientPickerOpen = false;
  clientPickerSearch = '';

  alertMessage: { text: string; type: 'success' | 'danger' } | null = null;

  // Select dropdown option arrays matching user's real project requirements
  paymentThroughOptions = ['Petty Cash', 'P.O', 'Accounts', 'W.O', '(Blanks)'];

  // Vendor options dynamically fetched from Account -> Office -> Vendor List
  vendorOptions: string[] = [];

  purposeOptions = [
    'Consumables',
    'Solar MMS',
    'Solar Panels',
    'Solar Inverters',
    'Solar I&C Works',
    'TATA SPG Package',
    'Solar Cables',
    'DB Boxes',
    'Earthing Materials',
    'Lightning Arrestors',
    'Civil Work Labour',
    'Material Transport',
    'Panel Cleaning Liquid',
    'Rental Tools',
    'Safety Certificates',
    'Solar CEIG Works',
    'Solar Meters',
    'Tools Asset',
    'Walkway / Hand Rails',
    'Zero Export Device',
    'Cable Tray Materials',
    'Cables',
    'Expo / Event Expenses',
    'Labour/Manpower',
    '(Blanks)'
  ];

  // Employee options dynamically fetched from Account -> Office -> Employees
  paidByOptions: string[] = ['OFFICE'];

  billVoucherOptions = ['Submitted', 'Not Submitted', '(Blanks)'];

  loadVendorsFromOffice(): void {
    this.officeService.getVendors().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const names = res.data.map(v => v.vendorName).filter(Boolean);
          if (this.formData.vendor && !names.includes(this.formData.vendor)) {
            names.push(this.formData.vendor);
          }
          this.vendorOptions = Array.from(new Set(names));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadEmployeesFromOffice(): void {
    this.officeService.getEmployees().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const names = res.data.map(e => e.name).filter(Boolean);
          const list = ['OFFICE', ...names];
          if (this.formData.paidBy && !list.includes(this.formData.paidBy)) {
            list.push(this.formData.paidBy);
          }
          this.paidByOptions = Array.from(new Set(list));
          this.cdr.markForCheck();
        }
      }
    });
  }

  isPoWo(paymentThrough?: string): boolean {
    if (!paymentThrough) return false;
    const clean = paymentThrough.trim().toUpperCase().replace(/[\s.]/g, '');
    return clean === 'PO' || clean === 'WO';
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadExpenses();
    this.loadVendorsFromOffice();
    this.loadEmployeesFromOffice();
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

  loadProjects(): void {
    const cached = this.projectService.getCachedProjects();
    if (cached && cached.length > 0) {
      this.projects = cached;
      const dbWh = cached.find(p => (p.siteId || '').toUpperCase() === 'WAREHOUSE');
      if (dbWh) {
        this.warehouseEntity = { ...this.warehouseEntity, ...dbWh };
      }
      this.loading = false;
      this.updateTableWidth();
    } else {
      this.loading = true;
    }
    this.cdr.markForCheck();

    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success) {
          this.projects = res.data;
          const dbWh = (res.data || []).find(p => (p.siteId || '').toUpperCase() === 'WAREHOUSE');
          if (dbWh) {
            this.warehouseEntity = { ...this.warehouseEntity, ...dbWh };
          }
          this.updateTableWidth();
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadExpenses(): void {
    const cached = this.projectService.getCachedExpenses();
    if (cached) {
      this.expenses = cached;
      const whRecords = this.expenses.filter(e => (e.siteId || '').toUpperCase() === 'WAREHOUSE');
      const whSum = whRecords.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      this.warehouseEntity.siteExpenses = whSum;
      this.updateTableWidth();
      this.cdr.markForCheck();
    }

    this.projectService.getExpenses().subscribe({
      next: (res) => {
        if (res.success) {
          this.expenses = res.data;
          const whRecords = this.expenses.filter(e => (e.siteId || '').toUpperCase() === 'WAREHOUSE');
          const whSum = whRecords.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
          this.warehouseEntity.siteExpenses = whSum;
          this.updateTableWidth();
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error loading expenses:', err);
        this.cdr.markForCheck();
      }
    });
  }

  // Customer site projects only (excluding WAREHOUSE if present in projects database)
  get customerProjects(): Project[] {
    return this.projects.filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE');
  }

  // Combined entities (Single Central Warehouse + Customer Site Projects)
  get allEntities(): Project[] {
    return [this.warehouseEntity, ...this.customerProjects];
  }

  // Summary Metrics calculated from entities
  get totalSiteExpenses(): number {
    return this.customerProjects.reduce((acc, p) => acc + (Number(p.siteExpenses) || 0), 0);
  }

  get totalWarehouseExpenses(): number {
    return Number(this.warehouseEntity.siteExpenses) || 0;
  }

  get totalAllExpenses(): number {
    return this.totalSiteExpenses + this.totalWarehouseExpenses;
  }

  get totalMargin(): number {
    return this.customerProjects.reduce((acc, p) => acc + (Number(p.margin) || 0), 0);
  }

  get totalContractValue(): number {
    return this.customerProjects.reduce((acc, p) => acc + (Number(p.siteValue) || 0), 0);
  }

  get totalClientsCount(): number {
    return this.customerProjects.length;
  }

  get totalEntitiesCount(): number {
    return this.allEntities.length;
  }

  // Filtered clients (114 Clients, excluding Warehouse entity)
  get filteredClients(): Project[] {
    let list = this.customerProjects;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.siteId?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.orderBy?.toLowerCase().includes(q)
      );
    }
    if (this.marginFilter === 'HasExpenses') {
      list = list.filter(p => (Number(p.siteExpenses) || 0) > 0);
    } else if (this.marginFilter === 'ZeroExpenses') {
      list = list.filter(p => (Number(p.siteExpenses) || 0) <= 0);
    }

    if (this.siteIdSortDirection !== 'none') {
      const dir = this.siteIdSortDirection;
      list = [...list].sort((a, b) => {
        if (a.siteId === 'WAREHOUSE') return -1;
        if (b.siteId === 'WAREHOUSE') return 1;

        const idA = a.siteId || '';
        const idB = b.siteId || '';
        const matchA = idA.match(/\d+/);
        const matchB = idB.match(/\d+/);
        const numA = matchA ? parseInt(matchA[0], 10) : NaN;
        const numB = matchB ? parseInt(matchB[0], 10) : NaN;

        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) {
            return dir === 'asc' ? numA - numB : numB - numA;
          }
        }
        return dir === 'asc'
          ? idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
          : idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return list;
  }

  toggleSiteIdSort(): void {
    if (this.siteIdSortDirection === 'none') {
      this.siteIdSortDirection = 'asc';
    } else if (this.siteIdSortDirection === 'asc') {
      this.siteIdSortDirection = 'desc';
    } else {
      this.siteIdSortDirection = 'asc';
    }
    this.currentPage = 1;
    this.updateTableWidth();
    this.cdr.markForCheck();
  }

  get paginatedClients(): Project[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredClients.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredClients.length / this.pageSize) || 1;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateTableWidth();
    }
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updateTableWidth();
  }

  onMarginFilterChange(): void {
    this.currentPage = 1;
    this.updateTableWidth();
  }

  // Date helper methods for dd-mm-yyyy and HTML datepicker
  onDatePickerChange(isoDate: string): void {
    if (isoDate) {
      this.formData.dateInput = this.toDisplayDate(isoDate);
    }
  }

  openDatePicker(picker: HTMLInputElement): void {
    try {
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
      } else {
        picker.click();
      }
    } catch {
      picker.click();
    }
  }

  toDisplayDate(isoStr: string | undefined): string {
    if (!isoStr) return '';
    const trimmed = String(isoStr).trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        return `${dd}-${mm}-${yyyy}`;
      }
    }
    return trimmed;
  }

  toIsoDate(inputStr: string | undefined): string {
    if (!inputStr) return new Date().toISOString().slice(0, 10);
    const trimmed = String(inputStr).trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3 && parts[2].length === 4) {
        const dd = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        return `${yyyy}-${mm}-${dd}`;
      }
      if (parts.length === 3 && parts[0].length === 4) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return trimmed;
  }

  getTodayDisplayDate(): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  deriveMoPFromDate(dateStr: string): string {
    const iso = this.toIsoDate(dateStr);
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  }

  // --- CLIENT PICKER MODAL (TOP "+ Record New Expense" BUTTON) ---
  openClientPicker(): void {
    this.clientPickerSearch = '';
    this.isClientPickerOpen = true;
  }

  closeClientPicker(): void {
    this.isClientPickerOpen = false;
  }

  get filteredPickerProjects(): Project[] {
    if (!this.clientPickerSearch) return this.allEntities;
    const q = this.clientPickerSearch.toLowerCase().trim();
    return this.allEntities.filter(p =>
      p.siteId?.toLowerCase().includes(q) ||
      p.clientName?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    );
  }

  selectClientFromPicker(p: Project): void {
    this.isClientPickerOpen = false;
    this.openClientExpenseModal(p, true);
  }

  // --- CLIENT-SPECIFIC EXPENSE MODAL METHODS ---

  /**
   * Open the client-specific expense modal.
   * Only displays the particular client (or Central Warehouse), their past expenses, and allows adding/editing expenses.
   */
  openClientExpenseModal(clientOrSiteId: Project | string, startAdding: boolean = false): void {
    let siteId = '';
    if (typeof clientOrSiteId === 'string') {
      siteId = clientOrSiteId.trim();
      if (siteId.toUpperCase() === 'WAREHOUSE') {
        this.selectedProjectRef = this.warehouseEntity;
      } else {
        this.selectedProjectRef = this.projects.find(p => p.siteId.toLowerCase() === siteId.toLowerCase()) || null;
      }
    } else {
      this.selectedProjectRef = clientOrSiteId;
      siteId = clientOrSiteId.siteId;
    }

    if (!siteId) return;

    // Instant pre-population from in-memory expenses
    const cleanSiteId = siteId.replace(/:/g, '').trim().toLowerCase();
    const matched = this.expenses.filter(e => (e.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId);
    this.clientExpensesList = matched.length > 0 ? [...matched] : [];

    this.isClientModalOpen = true;
    this.isAddingOrEditingExpense = false;
    this.isEditingPastRecord = false;
    this.editingExpenseId = null;
    this.loadVendorsFromOffice();
    this.loadEmployeesFromOffice();
    this.cdr.markForCheck();

    this.loadClientExpenses(siteId, startAdding);
  }

  loadClientExpenses(siteId: string, triggerAddAfterLoad: boolean = false): void {
    const cleanSiteId = siteId.replace(/:/g, '').trim().toLowerCase();
    if (this.clientExpensesList.length === 0) {
      this.loadingClientExpenses = true;
    }
    this.cdr.markForCheck();

    this.projectService.getExpenses({ siteId }).subscribe({
      next: (res) => {
        if (res.success) {
          this.clientExpensesList = res.data;

          if (this.selectedProjectRef) {
            this.selectedProjectRef.siteExpenses = res.totalAmount;
            if (this.selectedProjectRef.siteId.toUpperCase() === 'WAREHOUSE') {
              this.warehouseEntity.siteExpenses = res.totalAmount;
            } else {
              const siteVal = Number(this.selectedProjectRef.siteValue) || 0;
              this.selectedProjectRef.margin = Math.max(0, siteVal - res.totalAmount);
              this.selectedProjectRef.marginPercentage = siteVal > 0 ? parseFloat(((this.selectedProjectRef.margin / siteVal) * 100).toFixed(2)) : 0;
            }
          }
        }
        this.loadingClientExpenses = false;
        if (triggerAddAfterLoad) {
          this.startAddNewExpense();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading client expenses:', err);
        this.loadingClientExpenses = false;
        if (this.clientExpensesList.length === 0) {
          this.clientExpensesList = this.expenses.filter(e => (e.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId);
        }
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Reveal the "+ Add New Expense" form specifically for this client/warehouse.
   * Site ID is automatically filled and locked.
   */
  startAddNewExpense(): void {
    if (!this.selectedProjectRef) return;
    if (!this.canAdd()) {
      this.showAlert('You do not have permission to add expense records.', 'danger');
      return;
    }

    this.isAddingOrEditingExpense = true;
    this.isEditingPastRecord = false;
    this.editingExpenseId = null;
    this.editingOriginalAmount = 0;

    const isWh = this.selectedProjectRef.siteId.toUpperCase() === 'WAREHOUSE';

    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: isWh
        ? 'Warehouse : Sathlokhar H.O'
        : `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.siteCapacity || '5'}KW, ${this.selectedProjectRef.clientName}, ${this.selectedProjectRef.location || 'Chennai'}`,
      paymentThrough: isWh ? 'P.O' : 'Petty Cash',
      purpose: isWh ? 'Solar Panels' : 'Consumables',
      paidBy: 'OFFICE',
      vendor: '',
      remarks: isWh ? 'Materials received in warehouse' : '',
      billVoucher: 'Submitted',
      invoiceNo: '',
      amount: null
    };

    this.scrollToExpenseForm();
  }

  /**
   * Edit an existing past expense record for this client.
   */
  startEditPastRecord(e: SiteExpense): void {
    if (!this.selectedProjectRef) return;
    if (!this.canEdit()) {
      this.showAlert('You do not have permission to edit expense records.', 'danger');
      return;
    }

    this.isAddingOrEditingExpense = true;
    this.isEditingPastRecord = true;
    this.editingExpenseId = e.id || null;
    this.editingOriginalAmount = Number(e.amount) || 0;

    const displayDate = e.formattedDate || this.toDisplayDate(e.expenseDate);

    if (e.vendorName && !this.vendorOptions.includes(e.vendorName)) {
      this.vendorOptions = [e.vendorName, ...this.vendorOptions];
    }
    if (e.paidBy && !this.paidByOptions.includes(e.paidBy)) {
      this.paidByOptions = [e.paidBy, ...this.paidByOptions];
    }

    this.formData = {
      dateInput: displayDate,
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: e.clientSiteName || `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.clientName}`,
      paymentThrough: e.paymentThrough || 'Petty Cash',
      purpose: e.purpose || 'Consumables',
      paidBy: e.paidBy || 'OFFICE',
      vendor: e.vendorName || '',
      remarks: e.remarks || '',
      billVoucher: e.billVoucher || 'Not Submitted',
      invoiceNo: e.invoiceNo || '',
      amount: e.amount
    };

    this.scrollToExpenseForm();
  }

  private scrollToExpenseForm(): void {
    setTimeout(() => {
      const el = document.getElementById('expense-form-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  }

  cancelExpenseSubForm(): void {
    this.isAddingOrEditingExpense = false;
    this.isEditingPastRecord = false;
    this.editingExpenseId = null;
    this.editingOriginalAmount = 0;
  }

  closeClientModal(): void {
    this.isClientModalOpen = false;
    this.selectedProjectRef = null;
    this.clientExpensesList = [];
    this.cancelExpenseSubForm();
  }

  // Sum of client expenses
  get clientTotalExpenses(): number {
    if (!this.clientExpensesList.length) return Number(this.selectedProjectRef?.siteExpenses) || 0;
    return this.clientExpensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  get clientCurrentMargin(): number {
    const siteVal = Number(this.selectedProjectRef?.siteValue) || 0;
    return siteVal - this.clientTotalExpenses;
  }

  get clientCurrentMarginPercentage(): number {
    const siteVal = Number(this.selectedProjectRef?.siteValue) || 0;
    if (siteVal <= 0) return 0;
    return parseFloat(((this.clientCurrentMargin / siteVal) * 100).toFixed(2));
  }

  // Live preview calculations while typing in the amount field
  get liveNewExpenses(): number {
    const base = this.clientTotalExpenses;
    const inputAmt = Number(this.formData.amount) || 0;
    if (this.isEditingPastRecord) {
      return base - this.editingOriginalAmount + inputAmt;
    }
    return base + inputAmt;
  }

  get liveNewMargin(): number {
    const siteVal = Number(this.selectedProjectRef?.siteValue) || 0;
    return siteVal - this.liveNewExpenses;
  }

  get liveNewMarginPct(): number {
    const siteVal = Number(this.selectedProjectRef?.siteValue) || 0;
    if (siteVal <= 0) return 0;
    return parseFloat(((this.liveNewMargin / siteVal) * 100).toFixed(2));
  }

  submitClientExpense(): void {
    if (!this.selectedProjectRef) return;

    if (this.isEditingPastRecord && !this.canEdit()) {
      this.showAlert('You do not have permission to edit expense records.', 'danger');
      return;
    }
    if (!this.isEditingPastRecord && !this.canAdd()) {
      this.showAlert('You do not have permission to add expense records.', 'danger');
      return;
    }

    if (!this.formData.amount || this.formData.amount <= 0) {
      this.showAlert('Please enter a valid positive expense amount.', 'danger');
      return;
    }

    const isoDate = this.toIsoDate(this.formData.dateInput);
    const mop = this.deriveMoPFromDate(this.formData.dateInput);
    const isWh = this.selectedProjectRef.siteId.toUpperCase() === 'WAREHOUSE';

    if (this.formData.billVoucher === 'Submitted' && !this.formData.invoiceNo?.trim()) {
      const entered = prompt('Please enter the Invoice Number for this Submitted Bill Voucher:');
      if (entered !== null) {
        this.formData.invoiceNo = entered.trim();
      }
    }

    const payload: Partial<SiteExpense> = {
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: this.formData.clientSiteName || `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.clientName}`,
      expenseDate: isoDate,
      mop,
      amount: Number(this.formData.amount),
      paymentThrough: this.formData.paymentThrough,
      purpose: this.formData.purpose,
      paidBy: this.formData.paidBy,
      vendorName: this.formData.vendor || '',
      remarks: this.formData.remarks || '',
      billVoucher: this.formData.billVoucher || 'Not Submitted',
      invoiceNo: this.formData.billVoucher === 'Submitted' ? (this.formData.invoiceNo || '') : ''
    };

    if (this.isEditingPastRecord && this.editingExpenseId) {
      this.projectService.updateExpense(this.editingExpenseId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            const successMsg = isWh
              ? `Warehouse expense voucher updated to ₹ ${Number(res.data.amount).toLocaleString('en-IN')}. Ledger updated!`
              : `Expense for ${res.data.clientName} (${res.data.siteId}) updated to ₹ ${Number(res.data.amount).toLocaleString('en-IN')}. Dashboard synchronized!`;
            this.showAlert(successMsg, 'success');
            this.isAddingOrEditingExpense = false;
            this.loadClientExpenses(this.selectedProjectRef!.siteId);
            this.loadExpenses();
            if (!isWh) this.loadProjects();
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error updating expense', 'danger')
      });
    } else {
      this.projectService.createExpense(payload).subscribe({
        next: (res) => {
          if (res.success) {
            const successMsg = isWh
              ? `Material receipt voucher of ₹ ${Number(res.data.amount).toLocaleString('en-IN')} recorded for Warehouse!`
              : `Expense of ₹ ${Number(res.data.amount).toLocaleString('en-IN')} for ${res.data.clientName} added! Dashboard Site Expenses & Margin synchronized.`;
            this.showAlert(successMsg, 'success');
            this.isAddingOrEditingExpense = false;
            this.loadClientExpenses(this.selectedProjectRef!.siteId);
            this.loadExpenses();
            if (!isWh) this.loadProjects();
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error recording expense', 'danger')
      });
    }
  }

  // --- QUICK INVOICE NO. MODAL HANDLERS FOR BILL VOUCHER ---
  openInvoiceModal(e: SiteExpense): void {
    if (!this.canEdit()) {
      this.showAlert('You do not have permission to edit invoices.', 'danger');
      return;
    }
    this.invoiceModalExpense = e;
    this.invoiceModalInput = e.invoiceNo || '';
    this.invoiceModalDate = e.expenseDate ? e.expenseDate.substring(0, 10) : '';
    this.isInvoiceModalOpen = true;
  }

  closeInvoiceModal(): void {
    this.isInvoiceModalOpen = false;
    this.invoiceModalExpense = null;
    this.invoiceModalInput = '';
    this.invoiceModalDate = '';
  }

  saveInvoiceModal(): void {
    if (!this.canEdit()) {
      this.showAlert('You do not have permission to edit invoices.', 'danger');
      return;
    }
    if (!this.invoiceModalExpense || !this.invoiceModalExpense.id) return;

    const trimmedInv = this.invoiceModalInput.trim();
    const payload: Partial<SiteExpense> = {
      billVoucher: 'Submitted',
      invoiceNo: trimmedInv
    };
    if (this.invoiceModalDate) {
      payload.expenseDate = this.invoiceModalDate;
    }

    this.projectService.updateExpense(this.invoiceModalExpense.id, payload).subscribe({
      next: (res) => {
        if (res.success && this.invoiceModalExpense) {
          this.invoiceModalExpense.billVoucher = 'Submitted';
          this.invoiceModalExpense.invoiceNo = trimmedInv;
          if (this.invoiceModalDate) {
            this.invoiceModalExpense.expenseDate = this.invoiceModalDate;
          }
          this.showAlert(`Bill Voucher marked as Submitted with Invoice #${trimmedInv || 'N/A'}.`, 'success');
          if (this.selectedProjectRef) {
            this.loadClientExpenses(this.selectedProjectRef.siteId);
          }
        }
        this.closeInvoiceModal();
      },
      error: (err) => {
        this.showAlert(err.error?.message || 'Failed to update invoice number.', 'danger');
        this.closeInvoiceModal();
      }
    });
  }

  markAsNotSubmittedFromModal(): void {
    if (!this.canEdit()) {
      this.showAlert('You do not have permission to edit invoices.', 'danger');
      return;
    }
    if (!this.invoiceModalExpense || !this.invoiceModalExpense.id) return;

    const payload: Partial<SiteExpense> = {
      billVoucher: 'Not Submitted',
      invoiceNo: ''
    };

    this.projectService.updateExpense(this.invoiceModalExpense.id, payload).subscribe({
      next: (res) => {
        if (res.success && this.invoiceModalExpense) {
          this.invoiceModalExpense.billVoucher = 'Not Submitted';
          this.invoiceModalExpense.invoiceNo = '';
          this.showAlert('Bill Voucher marked as Not Submitted.', 'success');
          if (this.selectedProjectRef) {
            this.loadClientExpenses(this.selectedProjectRef.siteId);
          }
        }
        this.closeInvoiceModal();
      },
      error: (err) => {
        this.showAlert(err.error?.message || 'Failed to update voucher status.', 'danger');
        this.closeInvoiceModal();
      }
    });
  }

  deleteClientExpenseRow(e: SiteExpense): void {
    if (!e.id || !this.selectedProjectRef) return;
    if (!this.canDelete()) {
      this.showAlert('You do not have permission to delete expense records.', 'danger');
      return;
    }
    const isWh = this.selectedProjectRef.siteId.toUpperCase() === 'WAREHOUSE';
    const confirmMsg = isWh
      ? `Are you sure you want to delete warehouse expense/voucher of ₹ ${Number(e.amount).toLocaleString('en-IN')} (${e.purpose || 'Material'})?\n\nWarehouse total will be immediately recalculated.`
      : `Are you sure you want to delete expense of ₹ ${Number(e.amount).toLocaleString('en-IN')} (${e.purpose || 'Expense'}) for ${this.selectedProjectRef.clientName}?\n\nDashboard Site Expenses will be immediately recalculated.`;

    if (confirm(confirmMsg)) {
      this.projectService.deleteExpense(e.id).subscribe({
        next: (res) => {
          if (res.success) {
            this.showAlert('Expense removed and balance recalculated.', 'success');
            this.loadClientExpenses(this.selectedProjectRef!.siteId);
            this.loadExpenses();
            if (!isWh) this.loadProjects();
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error deleting expense', 'danger')
      });
    }
  }

  deleteClientAllExpenses(p: Project, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!this.canDelete()) {
      this.showAlert('You do not have permission to delete expense records.', 'danger');
      return;
    }
    const isWh = p.siteId.toUpperCase() === 'WAREHOUSE';
    const confirmMsg = isWh
      ? `Are you sure you want to clear ALL recorded material receipts & expenses for WAREHOUSE?\n\nThis will reset Warehouse Expenses to ₹0.`
      : `Are you sure you want to delete/clear ALL recorded expenses for "${p.clientName}" (${p.siteId})?\n\nThis will reset Site Expenses to ₹0 and recalculate Margin in the Dashboard.`;

    if (confirm(confirmMsg)) {
      this.projectService.deleteExpensesBySite(p.siteId).subscribe({
        next: (res) => {
          if (res.success) {
            this.showAlert(`All expenses for ${p.clientName} cleared.`, 'success');
            this.loadExpenses();
            if (isWh) {
              this.warehouseEntity.siteExpenses = 0;
            } else {
              this.loadProjects();
            }
            if (this.isClientModalOpen && this.selectedProjectRef?.siteId === p.siteId) {
              this.loadClientExpenses(p.siteId);
            }
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error clearing expenses', 'danger')
      });
    }
  }

  showAlert(text: string, type: 'success' | 'danger'): void {
    this.alertMessage = { text, type };
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.alertMessage?.text === text) {
        this.alertMessage = null;
        this.cdr.markForCheck();
      }
    }, 6000);
  }

  // --- PDF EXPORT METHODS ---

  /**
   * Export all unique clients with their site expenses and profit margin as a PDF.
   */
  exportAllClientsPdf(): void {
    if (!this.filteredClients.length) {
      this.showAlert('No clients to export to PDF.', 'danger');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header Title & Brand
    doc.setFontSize(15);
    doc.setTextColor(190, 18, 60); // Crimson Rose Brand
    doc.text('SOLAR SATHLOKHAR - CLIENT EXPENSES LEDGER & MARGIN SUMMARY', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Clients: ${this.filteredClients.length} Sites | Total Expenses: ₹ ${(this.totalSiteExpenses || 0).toLocaleString('en-IN')} | Total Margin: ₹ ${(this.totalMargin || 0).toLocaleString('en-IN')}`, 14, 19);

    const headers = [
      ['S.No', 'Site ID', 'Client Name', 'Location', 'Capacity', 'Site Value (₹)', 'Site Expenses (₹)', 'Net Margin (₹)', 'Margin %', 'Status']
    ];

    const body = this.filteredClients.map((c, idx) => {
      const isWh = (c.siteId || '').toUpperCase() === 'WAREHOUSE';
      return [
        idx + 1,
        c.siteId || '',
        c.clientName || '',
        c.location || '',
        isWh ? 'Central Stock' : (c.siteCapacity ? `${c.siteCapacity} kW` : ''),
        isWh ? '— (Stock)' : (c.siteValue ? Number(c.siteValue).toLocaleString('en-IN') : '0'),
        c.siteExpenses ? Number(c.siteExpenses).toLocaleString('en-IN') : '0',
        isWh ? '—' : (c.margin ? Number(c.margin).toLocaleString('en-IN') : '0'),
        isWh ? 'Stock' : `${c.marginPercentage || 0}%`,
        (Number(c.siteExpenses) || 0) > 0 ? (isWh ? 'Stock Incurred' : 'Expenses Recorded') : 'Zero Expenses'
      ];
    });

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [190, 18, 60], // Crimson
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [255, 241, 242]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { fontStyle: 'bold', cellWidth: 18 },
        2: { cellWidth: 46 },
        3: { cellWidth: 28 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 28 },
        6: { halign: 'right', cellWidth: 28 },
        7: { halign: 'right', cellWidth: 28 },
        8: { halign: 'center', cellWidth: 18 },
        9: { halign: 'center', cellWidth: 28 }
      }
    });

    doc.save(`Solar_Sathlokhar_Expenses_Summary_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showAlert('Expenses summary PDF exported successfully!', 'success');
  }

  /**
   * Export the individual client's full expense ledger statement with all vouchers as a PDF.
   */
  exportClientStatementPdf(): void {
    if (!this.selectedProjectRef) return;
    const p = this.selectedProjectRef;
    const isWh = p.siteId.toUpperCase() === 'WAREHOUSE';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;

    // 1. Top Brand Header Banner
    doc.setFillColor(isWh ? 30 : 190, isWh ? 41 : 18, isWh ? 59 : 60); // Slate dark for Warehouse, Crimson for client
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line (Gold)
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 228, 230);
    doc.text(isWh ? 'CENTRAL WAREHOUSE MATERIAL RECEIPT & EXPENSE STATEMENT' : 'CLIENT EXPENSES LEDGER & PROCUREMENT STATEMENT', margin, 17);

    doc.setFontSize(8);
    doc.text(`Entity: ${p.siteId}  |  Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, margin, 23);

    // 2. Overview Section
    let currentY = 35;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(isWh ? 30 : 190, isWh ? 41 : 18, isWh ? 59 : 60);
    doc.text(`${p.clientName} (${p.siteId})`, margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(isWh ? `Central Materials & Equipment Store  |  Location: Sathlokhar H.O  |  Internal Inventory Ledger` : `${p.siteCapacity || '5'} kW  |  ${p.siteType || 'Residential'}  |  ${p.location || 'Chennai'}  |  Awarded: ${p.awardedDate || '-'}  |  Manager: ${p.orderBy || '-'}`, margin, currentY + 5);

    currentY += 10;

    // Financial Summary Table
    const summaryHead = isWh
      ? [['Central Store / Facility', 'Total Incurred Material Expenses', 'Total Vouchers Count', 'Inventory Status']]
      : [['Site Contract Value', 'Total Expenses Incurred', 'Net Margin', 'Margin %', 'Vouchers Count']];

    const summaryBody = isWh
      ? [
          [
            'Warehouse : Sathlokhar H.O',
            `INR ${(Number(this.clientTotalExpenses) || 0).toLocaleString('en-IN')}`,
            `${this.clientExpensesList.length} Material Receipts / Vouchers`,
            'Active Central Stock'
          ]
        ]
      : [
          [
            `INR ${(Number(p.siteValue) || 0).toLocaleString('en-IN')}`,
            `INR ${(Number(this.clientTotalExpenses) || 0).toLocaleString('en-IN')}`,
            `INR ${(Number(this.clientCurrentMargin) || 0).toLocaleString('en-IN')}`,
            `${this.clientCurrentMarginPercentage}%`,
            `${this.clientExpensesList.length} Vouchers`
          ]
        ];

    autoTable(doc, {
      startY: currentY,
      head: summaryHead,
      body: summaryBody,
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        halign: 'center'
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold'
      }
    });

    const finalYSummary = (doc as any).lastAutoTable.finalY || currentY + 20;
    currentY = finalYSummary + 6;

    // 3. Itemized Expense Vouchers Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(isWh ? 'Itemized Material Receipts & Warehouse Incurred Transactions' : 'Itemized Expense Transactions & Procurement Records', margin, currentY);

    currentY += 3;

    const voucherHeaders = [
      ['#', 'Date', 'Purpose', 'Payment Through', 'Paid By', 'Remarks', 'Bill Voucher', 'Amount (₹)']
    ];

    const voucherBody = this.clientExpensesList.map((e, idx) => [
      idx + 1,
      e.formattedDate || this.toDisplayDate(e.expenseDate),
      e.purpose || 'Consumables',
      e.paymentThrough || 'Petty Cash',
      e.paidBy || 'OFFICE',
      e.remarks || '—',
      e.billVoucher || 'Not Submitted',
      Number(e.amount).toLocaleString('en-IN')
    ]);

    if (voucherBody.length === 0) {
      voucherBody.push(['-', '-', 'No expenses recorded yet', '-', '-', '-', '-', '0.00']);
    }

    autoTable(doc, {
      startY: currentY,
      head: voucherHeaders,
      body: voucherBody,
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: isWh ? [30, 41, 59] : [190, 18, 60],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 20 },
        2: { cellWidth: 32 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 38 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }
      }
    });

    doc.save(`${isWh ? 'Warehouse_Expenses_Statement' : 'Expense_Statement_' + p.siteId}_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showAlert(`Statement for ${p.clientName} exported as PDF!`, 'success');
  }

  // --- PERMISSION CHECKS ---
  canAdd(): boolean {
    return this.authService.canAdd('finance');
  }

  canEdit(): boolean {
    return this.authService.canEdit('finance');
  }

  canDelete(): boolean {
    return this.authService.canDelete('finance');
  }
}
