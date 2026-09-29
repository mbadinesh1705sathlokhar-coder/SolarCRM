import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectService } from '../../services/project.service';
import { Project, SummaryMetrics, ClientPayment } from '../../models/project.model';

import { RouterModule, Router } from '@angular/router';
import { MasterListService } from '../../services/master-list.service';
import { AuthService } from '../../services/auth.service';
import { OfficeService } from '../../services/office.service';

interface FilterOption {
  label: string;
  selected: boolean;
}

@Component({
  selector: 'app-project-master',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-master.component.html',
  styleUrls: ['./project-master.component.css']
})
export class ProjectMasterComponent implements OnInit, OnDestroy, AfterViewInit {
  private projectService = inject(ProjectService);
  private masterListService = inject(MasterListService);
  public authService = inject(AuthService);
  private officeService = inject(OfficeService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  isAwardedSitesView = false;

  canAdd(): boolean {
    return this.authService.canAdd('sales');
  }

  canEdit(): boolean {
    return this.authService.canEdit('sales');
  }

  canDelete(): boolean {
    return this.authService.canDelete('sales');
  }

  projects: Project[] = [];
  filteredProjects: Project[] = [];
  metrics: SummaryMetrics | null = null;
  loading = false;
  errorMsg = '';
  successMsg = '';

  // Top Horizontal Scrollbar Elements & State
  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('topScrollContainer') topScrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('dataTable') dataTable!: ElementRef<HTMLTableElement>;

  tableScrollWidth = 4600;
  private isSyncingScroll = false;
  private resizeObserver: ResizeObserver | null = null;

  // Chart Instances & Modes
  financialChart: Chart | null = null;
  financialChartMode: 'bar' | 'pie' = 'bar'; // Default to bar graph for Financial distribution as requested
  progressChart: Chart | null = null;

  // Global search
  searchTerm = '';

  // Dropdown filter configurations matching user screenshots
  // Dropdown filter configurations matching user requirements:
  // Site Type: Residential, Industrial, Ground Mount
  siteTypeOptions: FilterOption[] = [
    { label: 'Residential', selected: true },
    { label: 'Industrial', selected: true },
    { label: 'Ground Mount', selected: true },
    { label: 'Commercial', selected: true }
  ];
  siteTypeSearch = '';
  siteTypeFilterOpen = false;

  // System Type: Ongrid, offgrid, Hybrid
  systemTypeOptions: FilterOption[] = [
    { label: 'Ongrid', selected: true },
    { label: 'offgrid', selected: true },
    { label: 'Hybrid', selected: true }
  ];
  systemTypeSearch = '';
  systemTypeFilterOpen = false;

  // Site Category: TATA SPG, Waree, Premier, Other
  siteCategoryOptions: FilterOption[] = [
    { label: 'TATA SPG', selected: true },
    { label: 'Waree', selected: true },
    { label: 'Premier', selected: true },
    { label: 'Other', selected: true }
  ];
  siteCategorySearch = '';
  siteCategoryFilterOpen = false;

  // Pagination for Project Master Table (defaults to minimum 20 records per page)
  currentPage = 1;
  pageSize: number | 'All' = 20;
  pageSizeOptions: (number | 'All')[] = [20, 50, 100, 'All'];

  // Client Details Modal & Chart State
  isDetailsModalOpen = false;
  selectedProject: Project | null = null;

  // Client Type: Individual, Company, Institutional
  clientTypeOptions: FilterOption[] = [
    { label: 'Individual', selected: true },
    { label: 'Company', selected: true },
    { label: 'Institutional', selected: true }
  ];
  clientTypeSearch = '';
  clientTypeFilterOpen = false;

  // Site ID Sort State: 'desc' (big to small - default) | 'asc' (small to big)
  siteIdSortDirection: 'asc' | 'desc' | 'none' = 'desc';

  // Order By
  orderByOptions: FilterOption[] = [
    { label: 'K KARTHIKEYAN', selected: true },
    { label: 'K SATHISH', selected: true },
    { label: 'S KARTHIKEYAN', selected: true },
    { label: 'SOUNDARARAJAN M', selected: true },
    { label: 'V SHARATH', selected: true }
  ];
  orderBySearch = '';
  orderByFilterOpen = false;

  // Dynamic Master List Option Arrays (Managed via Office -> Add List)
  masterSiteTypes: string[] = ['Car Port', 'Commercial', 'Floating', 'Ground Mount', 'Industrial', 'Residential', 'Residential Common'];
  saleTypeOptions: string[] = ['B2C', 'Direct B2B', 'Retailer B2B'];
  masterClientTypes: string[] = ['Assosiation', 'Company', 'Govt. Org', 'Individual', 'Institutional'];
  masterSystemTypes: string[] = ['Hybrid', 'Off Grid', 'On Gird', 'Solar Pump'];
  siteStageOptions: string[] = ['EB Work in Process', 'Handed Over', 'I&C Completed', 'Installation Inprocess', 'Material Procurement', 'Project Awarded', 'Site Commissioned'];
  siteStatusOptions: string[] = ['Not Started', 'Materials Supplied', 'I&C Completed', 'EB Work in Process', 'Site Commissioned', 'Handed Over'];
  invoiceTypeOptions: string[] = ['Material Supply', 'I&C Works', 'CEIG Documentation', 'Supply and I&C work'];
  invoiceStatusOptions: string[] = ['Billed', 'Partly Billed', 'Not Billed'];
  paymentModeOptions: string[] = ['Bank Transfer / NEFT', 'Bank Transfer / IMPS', 'Cheque / DD', 'UPI', 'Bank Deposit'];

  loadMasterListOptions(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
            const normalize = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
            const findItems = (title: string, def: string[]) => {
              const target = normalize(title);
              const match = res.data.find(l => normalize(l.title) === target);
              return match && match.items && match.items.length > 0 ? match.items : def;
            };
          this.masterSiteTypes = findItems('Site_Type', this.masterSiteTypes);
          this.saleTypeOptions = findItems('Sale_Type', this.saleTypeOptions);
          this.masterClientTypes = findItems('Client_Type', this.masterClientTypes);
          this.masterSystemTypes = findItems('Sys_Type', this.masterSystemTypes);
          this.siteStageOptions = findItems('Site Stage', this.siteStageOptions);
          this.siteStatusOptions = findItems('Site Status', this.siteStatusOptions);
          this.invoiceTypeOptions = findItems('Invoice Type', this.invoiceTypeOptions);
          this.invoiceStatusOptions = findItems('Invoice Status', this.invoiceStatusOptions);
          this.paymentModeOptions = findItems('Payment Mode', this.paymentModeOptions);
          this.cdr.markForCheck();
        }
      }
    });
  }

  salesTeamOptions: string[] = ['Renuka', 'Daya'];

  loadSalesTeamOptions(): void {
    const cached = this.officeService.getCachedEmployees();
    if (cached && cached.length > 0) {
      this.extractSalesTeam(cached);
    } else {
      this.officeService.getEmployees().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.extractSalesTeam(res.data);
          }
        },
        error: () => {}
      });
    }
  }

  private extractSalesTeam(emps: any[]): void {
    const sales = emps
      .filter(e => (e.responsibility || '').toLowerCase().includes('sales') || (e.designation || '').toLowerCase().includes('sales'))
      .map(e => e.name);
    if (sales.length > 0) {
      this.salesTeamOptions = Array.from(new Set(sales));
    }
  }

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  currentProjectId: number | null = null;
  modalTab: 'basic' | 'config' | 'finance' | 'milestones' = 'basic';

  // Form Model
  projectForm: Partial<Project> = this.getEmptyProject();

  // Delete modal
  deleteModalOpen = false;
  projectToDelete: Project | null = null;

  // Dedicated Client Payment Ledger Modal State
  isPaymentModalOpen = false;
  activePaymentProject: Project | null = null;
  clientPaymentsList: ClientPayment[] = [];
  loadingClientPayments = false;
  isAddingOrEditingPayment = false;
  isEditingPastRecord = false;
  editingPaymentId: number | null = null;
  editingOriginalAmount = 0;

  paymentFormData = {
    dateInput: '',
    siteId: '',
    clientName: '',
    clientSiteName: '',
    paymentMode: 'Bank Transfer / NEFT',
    remarks: '',
    amount: null as number | null
  };

  ngOnInit(): void {
    this.checkRouteContext();
    this.router.events.subscribe(() => {
      this.checkRouteContext();
    });
    this.loadData();
    this.loadMasterListOptions();
    this.loadSalesTeamOptions();
  }

  private checkRouteContext(): void {
    const url = (this.router.url || '').toLowerCase();
    this.isAwardedSitesView = url.includes('awarded-sites');
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
    this.setupResizeObserver();
    setTimeout(() => this.measureTableWidth(), 100);
    setTimeout(() => this.measureTableWidth(), 500);
    setTimeout(() => this.measureTableWidth(), 1200);
  }

  setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.measureTableWidth();
      });
      if (this.tableContainer?.nativeElement) {
        this.resizeObserver.observe(this.tableContainer.nativeElement);
      }
      if (this.dataTable?.nativeElement) {
        this.resizeObserver.observe(this.dataTable.nativeElement);
      }
    }
  }

  // --- TOP HORIZONTAL SCROLLBAR SYNCHRONIZATION ---

  onTopScroll(): void {
    if (this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    if (this.tableContainer?.nativeElement && this.topScrollContainer?.nativeElement) {
      const topEl = this.topScrollContainer.nativeElement;
      const tableEl = this.tableContainer.nativeElement;
      const maxTop = topEl.scrollWidth - topEl.clientWidth;
      const maxTable = tableEl.scrollWidth - tableEl.clientWidth;

      if (maxTop > 0 && maxTable > 0) {
        tableEl.scrollLeft = (topEl.scrollLeft / maxTop) * maxTable;
      } else {
        tableEl.scrollLeft = topEl.scrollLeft;
      }
    }
    requestAnimationFrame(() => { this.isSyncingScroll = false; });
  }

  onTableScroll(): void {
    if (this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    if (this.topScrollContainer?.nativeElement && this.tableContainer?.nativeElement) {
      const topEl = this.topScrollContainer.nativeElement;
      const tableEl = this.tableContainer.nativeElement;
      const maxTop = topEl.scrollWidth - topEl.clientWidth;
      const maxTable = tableEl.scrollWidth - tableEl.clientWidth;

      if (maxTop > 0 && maxTable > 0) {
        topEl.scrollLeft = (tableEl.scrollLeft / maxTable) * maxTop;
      } else {
        topEl.scrollLeft = tableEl.scrollLeft;
      }
    }
    requestAnimationFrame(() => { this.isSyncingScroll = false; });
  }

  scrollToStart(): void {
    if (this.topScrollContainer?.nativeElement) {
      this.topScrollContainer.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  scrollToEnd(): void {
    if (this.topScrollContainer?.nativeElement) {
      this.topScrollContainer.nativeElement.scrollTo({
        left: this.topScrollContainer.nativeElement.scrollWidth,
        behavior: 'smooth'
      });
    }
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollTo({
        left: this.tableContainer.nativeElement.scrollWidth,
        behavior: 'smooth'
      });
    }
  }

  scrollByAmount(amount: number): void {
    if (this.topScrollContainer?.nativeElement) {
      this.topScrollContainer.nativeElement.scrollBy({ left: amount, behavior: 'smooth' });
    }
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.measureTableWidth();
  }

  measureTableWidth(): void {
    if (!this.tableContainer?.nativeElement) return;
    const tableEl = this.tableContainer.nativeElement;
    const dataTableEl = this.dataTable?.nativeElement;

    const actualWidth = Math.max(
      tableEl.scrollWidth || 0,
      dataTableEl?.scrollWidth || 0,
      dataTableEl?.offsetWidth || 0,
      4600
    );

    if (actualWidth > 0 && Math.abs(actualWidth - this.tableScrollWidth) > 5) {
      this.tableScrollWidth = actualWidth;
    }
  }

  setFinancialChartMode(mode: 'bar' | 'pie'): void {
    this.financialChartMode = mode;
    setTimeout(() => {
      this.renderCharts();
    }, 60);
  }

  getEmptyProject(): Partial<Project> {
    return {
      awardedDate: new Date().toISOString().substring(0, 10),
      siteId: '',
      clientName: '',
      location: '',
      contactNo: '',
      emailId: '',
      address: '',
      siteCapacity: '',
      siteValue: 0,
      siteType: 'Residential',
      systemType: 'Ongrid',
      siteCategory: 'TATA SPG',
      clientType: 'Individual',
      saleType: 'B2C',
      orderBy: 'K KARTHIKEYAN',
      leadBy: '',
      received: 0,
      siteExpenses: 0,
      materialsSupply: false,
      installation: false,
      ebProcess: false,
      documents: false,
      warranty: false,
      handedOver: false
    };
  }

  loadData(): void {
    // 0ms instant display from cache if available
    const cached = this.projectService.getCachedProjects();
    if (cached && cached.length > 0) {
      this.projects = cached.filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE' && !(p.clientName || '').toLowerCase().includes('warehouse'));
      this.initFilterOptions(this.projects);
      this.applyFilters();
      this.loading = false;
    } else {
      this.loading = true;
    }
    this.cdr.markForCheck();

    this.projectService.getProjects().subscribe({
      next: (res) => {
        this.projects = (res.data || []).filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE' && !(p.clientName || '').toLowerCase().includes('warehouse'));
        this.initFilterOptions(this.projects);
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
        setTimeout(() => this.measureTableWidth(), 100);
        setTimeout(() => this.measureTableWidth(), 600);
      },
      error: (err) => {
        this.errorMsg = 'Failed to load projects from server.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });

    this.loadMetrics();
  }

  initFilterOptions(projects: Project[]): void {
    if (!projects || projects.length === 0) return;

    const populateOptions = (currentOptions: FilterOption[], field: keyof Project): FilterOption[] => {
      const labels = new Set<string>(currentOptions.map(o => o.label));
      projects.forEach(p => {
        const val = p[field];
        if (typeof val === 'string' && val.trim()) {
          const exists = Array.from(labels).some(l => l.toLowerCase().trim() === val.toLowerCase().trim());
          if (!exists) {
            labels.add(val.trim());
          }
        }
      });
      return Array.from(labels).map(lbl => {
        const found = currentOptions.find(o => o.label.toLowerCase() === lbl.toLowerCase());
        return { label: lbl, selected: found ? found.selected : true };
      });
    };

    this.siteTypeOptions = populateOptions(this.siteTypeOptions, 'siteType');
    this.systemTypeOptions = populateOptions(this.systemTypeOptions, 'systemType');
    this.siteCategoryOptions = populateOptions(this.siteCategoryOptions, 'siteCategory');
    this.clientTypeOptions = populateOptions(this.clientTypeOptions, 'clientType');
    this.orderByOptions = populateOptions(this.orderByOptions, 'orderBy');
  }

  loadMetrics(): void {
    const cached = this.projectService.getCachedMetrics();
    if (cached) {
      this.metrics = cached;
      this.cdr.markForCheck();
      setTimeout(() => this.renderCharts(), 50);
    }

    this.projectService.getSummaryMetrics().subscribe({
      next: (res) => {
        this.metrics = res.data;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.renderCharts();
        }, 100);
      },
      error: (err) => {
        console.error('Failed to load metrics:', err);
      }
    });
  }

  // --- TABLE PAGINATION GETTERS & METHODS ---
  get totalPages(): number {
    if (this.pageSize === 'All') return 1;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return Math.max(1, Math.ceil(this.filteredProjects.length / size));
  }

  get paginatedProjects(): Project[] {
    if (this.pageSize === 'All') {
      return this.filteredProjects;
    }
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    const start = (this.currentPage - 1) * size;
    return this.filteredProjects.slice(start, start + size);
  }

  get displayStartRecord(): number {
    if (this.filteredProjects.length === 0) return 0;
    if (this.pageSize === 'All') return 1;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return (this.currentPage - 1) * size + 1;
  }

  get displayEndRecord(): number {
    if (this.filteredProjects.length === 0) return 0;
    if (this.pageSize === 'All') return this.filteredProjects.length;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return Math.min(this.currentPage * size, this.filteredProjects.length);
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const current = this.currentPage;
    const pages: number[] = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1);
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push(-1);
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1);
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollTop = 0;
    }
    this.cdr.markForCheck();
  }

  onPageSizeChange(newSize: number | 'All'): void {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  getRecordIndex(indexOnPage: number): number {
    if (this.pageSize === 'All') return indexOnPage + 1;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return (this.currentPage - 1) * size + indexOnPage + 1;
  }

  // Filter Methods
  toggleFilter(filterName: 'siteType' | 'systemType' | 'siteCategory' | 'clientType' | 'orderBy', event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const wasOpen = this.isFilterOpen(filterName);
    this.closeAllFilters();
    if (!wasOpen) {
      if (filterName === 'siteType') this.siteTypeFilterOpen = true;
      if (filterName === 'systemType') this.systemTypeFilterOpen = true;
      if (filterName === 'siteCategory') this.siteCategoryFilterOpen = true;
      if (filterName === 'clientType') this.clientTypeFilterOpen = true;
      if (filterName === 'orderBy') this.orderByFilterOpen = true;
    }
  }

  isFilterOpen(filterName: string): boolean {
    if (filterName === 'siteType') return this.siteTypeFilterOpen;
    if (filterName === 'systemType') return this.systemTypeFilterOpen;
    if (filterName === 'siteCategory') return this.siteCategoryFilterOpen;
    if (filterName === 'clientType') return this.clientTypeFilterOpen;
    if (filterName === 'orderBy') return this.orderByFilterOpen;
    return false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-container')) {
      this.closeAllFilters();
    }
  }

  closeAllFilters(): void {
    this.siteTypeFilterOpen = false;
    this.systemTypeFilterOpen = false;
    this.siteCategoryFilterOpen = false;
    this.clientTypeFilterOpen = false;
    this.orderByFilterOpen = false;
  }

  isAllSelected(options: FilterOption[]): boolean {
    return options.length > 0 && options.every(o => o.selected);
  }

  toggleSelectAll(options: FilterOption[]): void {
    const allSelected = this.isAllSelected(options);
    options.forEach(o => o.selected = !allSelected);
    this.currentPage = 1;
    this.applyFilters();
  }

  onFilterCheckboxChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  filteredOptions(options: FilterOption[], search: string): FilterOption[] {
    if (!search.trim()) return options;
    return options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  }

  applyFilters(): void {
    const allSiteTypes = this.isAllSelected(this.siteTypeOptions);
    const allSystemTypes = this.isAllSelected(this.systemTypeOptions);
    const allSiteCategories = this.isAllSelected(this.siteCategoryOptions);
    const allClientTypes = this.isAllSelected(this.clientTypeOptions);
    const allOrderBys = this.isAllSelected(this.orderByOptions);

    const selectedSiteTypes = this.siteTypeOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());
    const selectedSystemTypes = this.systemTypeOptions.filter(o => o.selected).map(o => o.label.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const selectedSiteCategories = this.siteCategoryOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());
    const selectedClientTypes = this.clientTypeOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());
    const selectedOrderBys = this.orderByOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());

    const term = this.searchTerm.trim().toLowerCase();

    this.filteredProjects = this.projects.filter(p => {
      // Global search
      if (term) {
        const matchesSearch = (
          (p.siteId || '').toLowerCase().includes(term) ||
          (p.clientName || '').toLowerCase().includes(term) ||
          (p.location || '').toLowerCase().includes(term) ||
          (p.contactNo || '').toLowerCase().includes(term) ||
          (p.emailId || '').toLowerCase().includes(term) ||
          (p.orderBy || '').toLowerCase().includes(term) ||
          (p.siteType || '').toLowerCase().includes(term) ||
          (p.systemType || '').toLowerCase().includes(term) ||
          (p.siteCategory || '').toLowerCase().includes(term) ||
          (p.clientType || '').toLowerCase().includes(term)
        );
        if (!matchesSearch) return false;
      }

      // Site Type filter (Residential, Industrial, Ground Mount, Commercial)
      if (!allSiteTypes) {
        if (selectedSiteTypes.length === 0) return false;
        const st = (p.siteType || '').toLowerCase().trim();
        if (!selectedSiteTypes.includes(st)) return false;
      }

      // System Type filter (Ongrid / On Grid, offgrid / Off Grid, Hybrid)
      if (!allSystemTypes) {
        if (selectedSystemTypes.length === 0) return false;
        const sysNorm = (p.systemType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchSys = selectedSystemTypes.some(s => s === sysNorm || (s === 'ongrid' && sysNorm === 'ongrid') || (s === 'offgrid' && sysNorm === 'offgrid'));
        if (!matchSys) return false;
      }

      // Site Category filter (TATA SPG, Waree / Waaree, Premier, Other)
      if (!allSiteCategories) {
        if (selectedSiteCategories.length === 0) return false;
        const cat = (p.siteCategory || '').toLowerCase().trim();
        const matchCat = selectedSiteCategories.some(sel => {
          if (sel.includes('tata') && cat.includes('tata')) return true;
          if ((sel.includes('ware') || sel.includes('waare')) && (cat.includes('ware') || cat.includes('waare'))) return true;
          if (sel.includes('premier') && cat.includes('premier')) return true;
          if (sel.includes('other') && cat.includes('other')) return true;
          return cat.includes(sel) || sel.includes(cat);
        });
        if (!matchCat) return false;
      }

      // Client Type filter (Individual, Company, Institutional)
      if (!allClientTypes) {
        if (selectedClientTypes.length === 0) return false;
        const ct = (p.clientType || '').toLowerCase().trim();
        if (!selectedClientTypes.includes(ct)) return false;
      }

      // Order By filter
      if (!allOrderBys) {
        if (selectedOrderBys.length === 0) return false;
        const ob = (p.orderBy || '').toLowerCase().trim();
        if (!selectedOrderBys.includes(ob)) return false;
      }

      return true;
    });

    // Site ID Numerical Sort (Small to Big / Big to Small)
    if (this.siteIdSortDirection !== 'none') {
      const dir = this.siteIdSortDirection;
      this.filteredProjects.sort((a, b) => {
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

    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    this.cdr.markForCheck();
  }

  toggleSiteIdSort(): void {
    this.siteIdSortDirection = this.siteIdSortDirection === 'desc' ? 'asc' : 'desc';
    this.currentPage = 1;
    this.applyFilters();
  }

  setSiteIdSort(dir: 'asc' | 'desc'): void {
    this.siteIdSortDirection = dir;
    this.currentPage = 1;
    this.applyFilters();
  }

  resetAllFilters(): void {
    this.searchTerm = '';
    this.siteIdSortDirection = 'desc';
    this.siteTypeOptions.forEach(o => o.selected = true);
    this.systemTypeOptions.forEach(o => o.selected = true);
    this.siteCategoryOptions.forEach(o => o.selected = true);
    this.clientTypeOptions.forEach(o => o.selected = true);
    this.orderByOptions.forEach(o => o.selected = true);
    this.currentPage = 1;
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() ||
      this.siteIdSortDirection !== 'desc' ||
      !this.isAllSelected(this.siteTypeOptions) ||
      !this.isAllSelected(this.systemTypeOptions) ||
      !this.isAllSelected(this.siteCategoryOptions) ||
      !this.isAllSelected(this.clientTypeOptions) ||
      !this.isAllSelected(this.orderByOptions);
  }

  // Get single-column stage for project
  getMilestoneStage(p: Project): string {
    if (p.documents) return 'Documents';
    if (p.ebProcess) return 'EB Process';
    if (p.installation) return 'Installation';
    if (p.materialsSupply) return 'Material Supply';
    return 'Pending';
  }

  // Handle stage dropdown change in single column
  onStageChange(p: Project, stage: string): void {
    if (!p.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }

    let payload: any = {};
    if (stage === 'Pending') {
      payload = {
        materialsSupply: false,
        installation: false,
        ebProcess: false,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'Material Supply') {
      payload = {
        materialsSupply: true,
        installation: false,
        ebProcess: false,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'Installation') {
      payload = {
        materialsSupply: true,
        installation: true,
        ebProcess: false,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'EB Process') {
      payload = {
        materialsSupply: true,
        installation: true,
        ebProcess: true,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'Documents') {
      payload = {
        materialsSupply: true,
        installation: true,
        ebProcess: true,
        documents: true
      };
    }

    Object.assign(p, payload);
    this.recalculateLocalProject(p);

    this.projectService.updateProject(p.id, payload).subscribe({
      next: (res) => {
        if (res?.data) {
          Object.assign(p, res.data);
          this.recalculateLocalProject(p);
        }
        this.loadMetrics();
      },
      error: (err) => {
        console.error('Failed to update stage:', err);
        this.showToast('Failed to update project stage', 'error');
      }
    });
  }

  onWarrantyToggle(p: Project, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.setMilestone(p, 'warranty', isChecked);
  }

  onHandedOverToggle(p: Project, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.setMilestone(p, 'handedOver', isChecked);
  }

  // Milestone change from table dropdown
  onMilestoneSelectChange(project: Project, field: string, value: any): void {
    const boolVal = value === true || value === 'true';
    this.setMilestone(project, field, boolVal);
  }

  setMilestone(project: Project, field: string, newVal: boolean): void {
    if (!project.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    const currentVal = Boolean((project as any)[field]);
    if (currentVal === newVal) return;

    (project as any)[field] = newVal;
    this.recalculateLocalProject(project);

    this.projectService.toggleMilestone(project.id, field, newVal).subscribe({
      next: (res) => {
        Object.assign(project, res.data);
        this.loadMetrics();
      },
      error: (err) => {
        (project as any)[field] = currentVal;
        this.recalculateLocalProject(project);
        this.showToast('Failed to update milestone status', 'error');
      }
    });
  }

  // Quick Toggle Milestone from table row
  toggleMilestone(project: Project, field: string): void {
    if (!project.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    const currentVal = Boolean((project as any)[field]);
    const newVal = !currentVal;

    // Optimistic UI update
    (project as any)[field] = newVal;
    this.recalculateLocalProject(project);

    this.projectService.toggleMilestone(project.id, field, newVal).subscribe({
      next: (res) => {
        Object.assign(project, res.data);
        this.loadMetrics();
      },
      error: (err) => {
        // Revert on error
        (project as any)[field] = currentVal;
        this.recalculateLocalProject(project);
        this.showToast('Failed to update milestone status', 'error');
      }
    });
  }

  recalculateLocalProject(p: Project): void {
    const ticks = [
      Boolean(p.materialsSupply),
      Boolean(p.installation),
      Boolean(p.ebProcess),
      Boolean(p.documents),
      Boolean(p.warranty),
      Boolean(p.handedOver)
    ];
    const checkedCount = ticks.filter(Boolean).length;
    p.completedPercentage = checkedCount === 6 ? 100.00 : parseFloat((checkedCount * 16.67).toFixed(2));
    if (p.completedPercentage > 100) p.completedPercentage = 100.00;
    p.workInProgressPercentage = checkedCount === 6 ? 0.00 : parseFloat((100 - p.completedPercentage).toFixed(2));

    const siteVal = parseFloat(p.siteValue as any) || 0;
    const recv = parseFloat(p.received as any) || 0;
    const exp = parseFloat(p.siteExpenses as any) || 0;
    p.due = siteVal - recv;
    p.margin = recv - exp;
    p.marginPercentage = siteVal > 0 ? parseFloat(((p.margin / siteVal) * 100).toFixed(2)) : 0;
  }

  // Modal Open / Close
  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add new projects.', 'error');
      return;
    }
    this.isEditMode = false;
    this.currentProjectId = null;
    this.projectForm = this.getEmptyProject();
    let maxNum = 400;
    this.projects.forEach(p => {
      if (p.siteId) {
        const match = p.siteId.match(/SP(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    this.projectForm.siteId = `SP${maxNum + 1}`;
    this.modalTab = 'basic';
    this.isModalOpen = true;
    this.cdr.markForCheck();
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const clean = dateStr.substring(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return clean;
  }

  openEditModal(project: Project): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    this.isEditMode = true;
    this.currentProjectId = project.id || null;
    this.projectForm = { ...project };
    this.modalTab = 'basic';
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  confirmDeleteFromModal(): void {
    if (this.currentProjectId) {
      const project = this.projects.find(p => p.id === this.currentProjectId);
      if (project) {
        this.closeModal();
        this.confirmDelete(project);
      }
    }
  }

  // Calculated properties in form
  get formDue(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const recv = parseFloat(this.projectForm.received as any) || 0;
    return Math.max(0, val - recv);
  }

  get formMargin(): number {
    const recv = parseFloat(this.projectForm.received as any) || 0;
    const exp = parseFloat(this.projectForm.siteExpenses as any) || 0;
    return recv - exp;
  }

  get formReceivedPct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const recv = parseFloat(this.projectForm.received as any) || 0;
    if (val <= 0) return 0;
    return Math.min(100, parseFloat(((recv / val) * 100).toFixed(1)));
  }

  get formDuePct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const due = this.formDue;
    if (val <= 0) return 0;
    return Math.min(100, parseFloat(((due / val) * 100).toFixed(1)));
  }

  get formExpensePct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const exp = parseFloat(this.projectForm.siteExpenses as any) || 0;
    if (val <= 0) return 0;
    return Math.min(100, parseFloat(((exp / val) * 100).toFixed(1)));
  }

  get formMarginPct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const margin = this.formMargin;
    if (val <= 0) return 0;
    return parseFloat(((margin / val) * 100).toFixed(1));
  }

  get formNetCashflow(): number {
    const recv = parseFloat(this.projectForm.received as any) || 0;
    const exp = parseFloat(this.projectForm.siteExpenses as any) || 0;
    return recv - exp;
  }

  get formCompleted(): number {
    const ticks = [
      this.projectForm.materialsSupply,
      this.projectForm.installation,
      this.projectForm.ebProcess,
      this.projectForm.documents,
      this.projectForm.warranty,
      this.projectForm.handedOver
    ];
    const count = ticks.filter(Boolean).length;
    return count === 6 ? 100 : parseFloat((count * 16.67).toFixed(2));
  }

  get formWip(): number {
    return this.formCompleted === 100 ? 0 : parseFloat((100 - this.formCompleted).toFixed(2));
  }

  get formMilestoneStage(): string {
    if (this.projectForm.documents) return 'Documents';
    if (this.projectForm.ebProcess) return 'EB Process';
    if (this.projectForm.installation) return 'Installation';
    if (this.projectForm.materialsSupply) return 'Material Supply';
    return 'Pending';
  }

  onFormStageChange(stage: string): void {
    if (stage === 'Pending') {
      this.projectForm.materialsSupply = false;
      this.projectForm.installation = false;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'Material Supply') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = false;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'Installation') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = true;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'EB Process') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = true;
      this.projectForm.ebProcess = true;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'Documents') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = true;
      this.projectForm.ebProcess = true;
      this.projectForm.documents = true;
    }
  }

  saveProject(): void {
    if (!this.projectForm.siteId?.trim() || !this.projectForm.clientName?.trim()) {
      this.showToast('Site ID and Client Name are required.', 'error');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'error');
      return;
    }

    if (this.isEditMode && this.currentProjectId) {
      this.projectService.updateProject(this.currentProjectId, this.projectForm).subscribe({
        next: (res) => {
          this.showToast('Project updated successfully!', 'success');
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.showToast(err.error?.message || 'Failed to update project.', 'error');
        }
      });
    } else {
      this.projectService.createProject(this.projectForm).subscribe({
        next: (res) => {
          this.showToast('Project created successfully!', 'success');
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.showToast(err.error?.message || 'Failed to create project.', 'error');
        }
      });
    }
  }

  // Delete Action
  confirmDelete(project: Project): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete projects.', 'error');
      return;
    }
    this.projectToDelete = project;
    this.deleteModalOpen = true;
  }

  executeDelete(): void {
    if (!this.projectToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete projects.', 'error');
      return;
    }
    this.projectService.deleteProject(this.projectToDelete.id).subscribe({
      next: () => {
        this.showToast('Project deleted successfully.', 'success');
        this.deleteModalOpen = false;
        this.projectToDelete = null;
        this.loadData();
      },
      error: (err) => {
        this.showToast('Failed to delete project.', 'error');
      }
    });
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    if (type === 'success') {
      this.successMsg = msg;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.successMsg = '';
        this.cdr.markForCheck();
      }, 4000);
    } else {
      this.errorMsg = msg;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.errorMsg = '';
        this.cdr.markForCheck();
      }, 4000);
    }
  }

  // Export to CSV
  exportToCsv(): void {
    if (this.filteredProjects.length === 0) {
      this.showToast('No projects to export.', 'error');
      return;
    }

    const headers = [
      'Awarded Date', 'Site ID', 'Client Name', 'Location', 'Contact No', 'Email ID', 'Address',
      'Site Capacity', 'Site Value', 'Site Type', 'System Type', 'Site Category', 'Client Type',
      'Sale Type', 'Order By', 'Received', 'Due', 'Site Expenses', 'Margin %',
      'Materials Supply', 'Installation', 'EB Process', 'Documents', 'Warranty', 'Handed Over',
      'Work in Process %', 'Completed %'
    ];

    const rows = this.filteredProjects.map(p => [
      p.awardedDate || '',
      `"${p.siteId || ''}"`,
      `"${p.clientName || ''}"`,
      `"${p.location || ''}"`,
      `"${p.contactNo || ''}"`,
      `"${p.emailId || ''}"`,
      `"${(p.address || '').replace(/"/g, '""')}"`,
      `"${p.siteCapacity || ''}"`,
      p.siteValue || 0,
      `"${p.siteType || ''}"`,
      `"${p.systemType || ''}"`,
      `"${p.siteCategory || ''}"`,
      `"${p.clientType || ''}"`,
      `"${p.saleType || ''}"`,
      `"${p.orderBy || ''}"`,
      p.received || 0,
      p.due || 0,
      p.siteExpenses || 0,
      `"${p.marginPercentage || 0}%"`,
      p.materialsSupply ? 'Yes' : 'No',
      p.installation ? 'Yes' : 'No',
      p.ebProcess ? 'Yes' : 'No',
      p.documents ? 'Yes' : 'No',
      p.warranty ? 'Yes' : 'No',
      p.handedOver ? 'Yes' : 'No',
      `${p.workInProgressPercentage}%`,
      `${p.completedPercentage}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Project_Master_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToPdf(): void {
    if (!this.filteredProjects.length) {
      this.errorMsg = 'No projects to export to PDF';
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header Title & Brand
    doc.setFontSize(15);
    doc.setTextColor(15, 118, 110); // Teal brand
    doc.text('SOLAR SATHLOKHAR - PROJECT MASTER & FINANCIAL PORTFOLIO', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Filtered Count: ${this.filteredProjects.length} Projects | Portfolio Value: ₹${(this.metrics?.totalSiteValue || 0).toLocaleString('en-IN')}`, 14, 19);

    const headers = [
      ['Site ID', 'Client Name', 'Location', 'Cap', 'Site Value (₹)', 'Received (₹)', 'Due (₹)', 'Expenses (₹)', 'Margin %', 'WIP', 'Done']
    ];

    const body = this.filteredProjects.map(p => [
      p.siteId || '',
      p.clientName || '',
      p.location || '',
      p.siteCapacity ? `${p.siteCapacity} kW` : '',
      p.siteValue ? Number(p.siteValue).toLocaleString('en-IN') : '0',
      p.received ? Number(p.received).toLocaleString('en-IN') : '0',
      p.due ? Number(p.due).toLocaleString('en-IN') : '0',
      p.siteExpenses ? Number(p.siteExpenses).toLocaleString('en-IN') : '0',
      `${p.marginPercentage || 0}%`,
      `${p.workInProgressPercentage}%`,
      `${p.completedPercentage}%`
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 18 },
        1: { cellWidth: 40 },
        2: { cellWidth: 26 },
        3: { cellWidth: 16 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 26 },
        6: { halign: 'right', cellWidth: 26 },
        7: { halign: 'right', cellWidth: 26 },
        8: { halign: 'right', cellWidth: 26 },
        9: { halign: 'center', cellWidth: 16 },
        10: { halign: 'center', cellWidth: 16 }
      }
    });

    doc.save(`Solar_Sathlokhar_Projects_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.successMsg = 'Project Master PDF exported successfully!';
  }

  // Client Details Modal & Chart Visualizers
  openClientDetails(project: Project): void {
    this.selectedProject = project;
    this.isDetailsModalOpen = true;
    setTimeout(() => {
      this.renderCharts();
    }, 150);
  }

  exportProjectDetailsPdf(): void {
    if (!this.selectedProject) return;
    const p = this.selectedProject;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    // 1. Top Brand Header Banner
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line (Amber)
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 251, 241);
    doc.text('PROJECT TECHNICAL & FINANCIAL SUMMARY REPORT', margin, 17);

    doc.setFontSize(8);
    doc.text(`Site ID: ${p.siteId}  |  Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, margin, 23);

    // 2. Client Overview Section
    let currentY = 35;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 118, 110);
    doc.text(`${p.clientName} (${p.siteId})`, margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${p.siteCapacity || '5'} kW  |  ${p.siteType || 'Residential'}  |  ${p.location || 'Chennai'}  |  Awarded: ${p.awardedDate || '-'}  |  Manager: ${p.orderBy || '-'}`, margin, currentY + 5);

    currentY += 9;

    // Table: Project Specifications
    autoTable(doc, {
      startY: currentY,
      head: [['Specification Attribute', 'Project Detail', 'Commercial Parameter', 'Value']],
      body: [
        ['Client Name', p.clientName || '-', 'Site ID', p.siteId || '-'],
        ['Site Capacity', `${p.siteCapacity || '-'} kW`, 'Site Value', `INR ${(Number(p.siteValue) || 0).toLocaleString('en-IN')}`],
        ['Site Type', p.siteType || '-', 'Received Payment', `INR ${(Number(p.received) || 0).toLocaleString('en-IN')}`],
        ['System Type', p.systemType || '-', 'Due Recoverable', `INR ${(Number(p.due) || 0).toLocaleString('en-IN')}`],
        ['Site Category', p.siteCategory || '-', 'Site Expenses', `INR ${(Number(p.siteExpenses) || 0).toLocaleString('en-IN')}`],
        ['Sale Type', p.saleType || '-', 'Net Profit Margin', `INR ${(Number(p.margin) || 0).toLocaleString('en-IN')} (${p.marginPercentage || 0}%)`],
        ['Location', p.location || '-', 'Execution Status', `${p.completedPercentage}% Done (WIP: ${p.workInProgressPercentage}%)`],
        ['Order Managed By', p.orderBy || '-', 'Contact / Phone', p.contactNo || 'Not Provided'],
        ['Client Email', p.emailId || 'Not Provided', 'Installation Address', p.address || 'Not Provided']
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 1.6,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38, textColor: [51, 65, 85] },
        1: { cellWidth: 53 },
        2: { fontStyle: 'bold', cellWidth: 42, textColor: [51, 65, 85] },
        3: { cellWidth: 49 }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    const finalYInfo = (doc as any).lastAutoTable.finalY || currentY + 50;
    currentY = finalYInfo + 5;

    // 3. Milestone Execution Progress Table
    autoTable(doc, {
      startY: currentY,
      head: [['Materials Supply', 'Installation', 'EB Process', 'Documents', 'Warranty', 'Handed Over', 'Overall Status']],
      body: [
        [
          p.materialsSupply ? 'COMPLETED' : 'PENDING',
          p.installation ? 'COMPLETED' : 'PENDING',
          p.ebProcess ? 'COMPLETED' : 'PENDING',
          p.documents ? 'COMPLETED' : 'PENDING',
          p.warranty ? 'COMPLETED' : 'PENDING',
          p.handedOver ? 'COMPLETED' : 'PENDING',
          `${p.completedPercentage}% Completed`
        ]
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        halign: 'center'
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold'
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.cell.raw === 'COMPLETED') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'PENDING') {
            data.cell.styles.textColor = [148, 163, 184];
          } else if (String(data.cell.raw).includes('Completed')) {
            data.cell.styles.textColor = [15, 118, 110];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    const finalYMilestones = (doc as any).lastAutoTable.finalY || currentY + 20;
    currentY = finalYMilestones + 5;

    // 4. Embed Visual Charts if available
    const financialCanvas = (document.getElementById('financialBarChart') || document.getElementById('financialPieChart')) as HTMLCanvasElement;
    const donutCanvas = document.getElementById('progressDonutChart') as HTMLCanvasElement;

    if (financialCanvas && donutCanvas) {
      try {
        const finDataUrl = financialCanvas.toDataURL('image/png');
        const donutDataUrl = donutCanvas.toDataURL('image/png');

        const chartWidth = 85;
        const chartHeight = 50;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text('Financial Distribution (INR)', margin + 12, currentY + 2);
        doc.text('Execution Progress Breakdown', margin + contentWidth / 2 + 12, currentY + 2);

        doc.addImage(finDataUrl, 'PNG', margin, currentY + 4, chartWidth, chartHeight);
        doc.addImage(donutDataUrl, 'PNG', margin + contentWidth / 2 + 5, currentY + 4, chartWidth, chartHeight);

        currentY += chartHeight + 8;
      } catch (err) {
        console.warn('Could not export chart canvas to PDF:', err);
      }
    }

    // 5. Footer & Sign-off
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 280, pageWidth - margin, 280);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Record ID: #${p.id || 1}  |  Solar Sathlokhar Management System  |  Confidential Client Report`, margin, 285);
    doc.text('Authorized Signature: _______________________', pageWidth - margin - 65, 285);

    // 6. Action: Show in PDF (open in new tab) AND Save to File
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');

    const cleanSiteId = (p.siteId || 'Site').trim();
    const cleanClientName = (p.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Solar_Sathlokhar_${cleanSiteId}_${cleanClientName}_Report.pdf`);

    this.successMsg = `Project report for ${p.clientName} generated in PDF!`;
  }

  closeClientDetails(): void {
    this.isDetailsModalOpen = false;
    this.destroyCharts();
    this.selectedProject = null;
  }

  editFromDetailsModal(): void {
    if (!this.selectedProject) return;
    const proj = this.selectedProject;
    this.closeClientDetails();
    this.openEditModal(proj);
  }

  destroyCharts(): void {
    if (this.financialChart) {
      this.financialChart.destroy();
      this.financialChart = null;
    }
    if (this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }
  }

  renderCharts(): void {
    if (!this.selectedProject) return;
    this.destroyCharts();

    const p = this.selectedProject;
    const siteVal = Number(p.siteValue) || 0;
    const received = Math.max(0, Number(p.received) || 0);
    const due = Math.max(0, Number(p.due) || 0);
    const expenses = Math.max(0, Number(p.siteExpenses) || 0);
    const margin = Math.max(0, Number(p.margin) || 0);

    // 1. Financial Distribution: Bar Graph (Default) or Pie Chart
    const barCanvas = document.getElementById('financialBarChart') as HTMLCanvasElement;
    const pieCanvas = document.getElementById('financialPieChart') as HTMLCanvasElement;

    if (this.financialChartMode === 'bar' && barCanvas) {
      this.financialChart = new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: ['Received Payment', 'Pending Due', 'Site Expenses', 'Net Margin'],
          datasets: [{
            label: 'Amount (₹)',
            data: [received, due, expenses, margin],
            backgroundColor: [
              '#10b981', // green for received
              '#ef4444', // red for due
              '#f59e0b', // amber for expenses
              '#0f766e'  // teal for margin
            ],
            borderColor: [
              '#059669',
              '#dc2626',
              '#d97706',
              '#115e59'
            ],
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.55
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
                font: { size: 9.5, weight: 'bold' }
              },
              grid: {
                color: '#f1f5f9'
              }
            },
            x: {
              ticks: {
                font: { size: 10, weight: 'bold' },
                color: '#334155'
              },
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = Number(context.parsed.y) || 0;
                  const pct = siteVal > 0 ? ((val / siteVal) * 100).toFixed(1) : '0';
                  return ` Amount: ₹${val.toLocaleString('en-IN')} (${pct}% of Site Value)`;
                }
              }
            }
          }
        }
      });
    } else if (this.financialChartMode === 'pie' && pieCanvas) {
      this.financialChart = new Chart(pieCanvas, {
        type: 'pie',
        data: {
          labels: ['Received Payment', 'Pending Due', 'Site Expenses', 'Net Margin'],
          datasets: [{
            data: [received, due, expenses, margin],
            backgroundColor: [
              '#10b981',
              '#ef4444',
              '#f59e0b',
              '#0f766e'
            ],
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 12,
                font: { size: 11, weight: 'bold' }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = Number(context.parsed) || 0;
                  const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                  return ` ${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 2. Project Progress: Clean, Full-size Donut Chart
    const donutCanvas = document.getElementById('progressDonutChart') as HTMLCanvasElement;
    if (donutCanvas) {
      const completed = p.completedPercentage || 0;
      const wip = p.workInProgressPercentage || (100 - completed);

      this.progressChart = new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Milestones Completed', 'Work In Process (Pending)'],
          datasets: [{
            data: [completed, wip],
            backgroundColor: [
              '#0f766e', // teal
              '#fde047'  // warm yellow
            ],
            borderColor: ['#0f766e', '#facc15'],
            borderWidth: 1.5,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 12,
                font: { size: 11, weight: 'bold' }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.label}: ${context.parsed}%`
              }
            }
          }
        }
      });
    }
  }

  // --- DEDICATED CLIENT PAYMENT LEDGER METHODS ---

  // Format Helper: Converts yyyy-mm-dd to dd-mm-yyyy
  toDisplayDate(isoStr: string | undefined): string {
    if (!isoStr) return '';
    const trimmed = String(isoStr).trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return trimmed;
  }

  toIsoDate(inputStr: string | undefined): string {
    if (!inputStr) return new Date().toISOString().slice(0, 10);
    const trimmed = String(inputStr).trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
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

  getOrdinalLabel(count: number): string {
    const n = count + 1;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return `${n}${suffix} Payment`;
  }

  openClientPaymentLedger(p: Project): void {
    this.activePaymentProject = p;
    this.isPaymentModalOpen = true;
    this.isAddingOrEditingPayment = false;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;

    // Fast instant pre-population from cached payments
    const cleanSiteId = (p.siteId || '').replace(/:/g, '').trim().toLowerCase();
    const cached = this.projectService.getCachedPayments();
    if (cached && cached.length > 0) {
      const matched = cached.filter(pay => (pay.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId);
      this.clientPaymentsList = matched.length > 0 ? [...matched] : [];
    } else {
      this.clientPaymentsList = [];
    }

    this.loadClientPayments(p.siteId);
  }

  loadClientPayments(siteId: string, triggerAdd: boolean = false): void {
    const cleanSiteId = (siteId || '').replace(/:/g, '').trim();
    if (this.clientPaymentsList.length === 0) {
      this.loadingClientPayments = true;
    }
    this.cdr.markForCheck();

    this.projectService.getPayments({ siteId: cleanSiteId }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.clientPaymentsList = res.data;
          if (this.activePaymentProject) {
            this.activePaymentProject.received = res.totalAmount;
            this.activePaymentProject.due = Math.max(0, (Number(this.activePaymentProject.siteValue) || 0) - res.totalAmount);
          }
        }
        this.loadingClientPayments = false;
        this.cdr.markForCheck();
        if (triggerAdd) this.startAddNewPayment();
      },
      error: (err) => {
        console.error('Error loading client payments:', err);
        this.loadingClientPayments = false;
        const cached = this.projectService.getCachedPayments();
        if (cached && this.clientPaymentsList.length === 0) {
          this.clientPaymentsList = cached.filter(pay => (pay.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId.toLowerCase());
        }
        this.cdr.markForCheck();
      }
    });
  }

  startAddNewPayment(): void {
    if (!this.activePaymentProject) return;
    this.isAddingOrEditingPayment = true;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;
    this.editingOriginalAmount = 0;

    const nextRemark = this.getOrdinalLabel(this.clientPaymentsList.length);
    this.paymentFormData = {
      dateInput: this.getTodayDisplayDate(),
      siteId: this.activePaymentProject.siteId,
      clientName: this.activePaymentProject.clientName,
      clientSiteName: `${this.activePaymentProject.siteId} : ${this.activePaymentProject.siteCapacity || '5'}KW, ${this.activePaymentProject.clientName}, ${this.activePaymentProject.location || 'Chennai'}`,
      paymentMode: 'Bank Transfer / NEFT',
      remarks: nextRemark,
      amount: null
    };
  }

  startEditPastRecord(p: ClientPayment): void {
    if (!this.activePaymentProject) return;
    this.isAddingOrEditingPayment = true;
    this.isEditingPastRecord = true;
    this.editingPaymentId = p.id || null;
    this.editingOriginalAmount = Number(p.amount) || 0;

    const displayDate = p.formattedDate || this.toDisplayDate(p.paymentDate);
    this.paymentFormData = {
      dateInput: displayDate,
      siteId: this.activePaymentProject.siteId,
      clientName: this.activePaymentProject.clientName,
      clientSiteName: p.clientSiteName || `${this.activePaymentProject.siteId} : ${this.activePaymentProject.clientName}`,
      paymentMode: p.paymentMode || 'Bank Transfer / NEFT',
      remarks: p.remarks || '',
      amount: p.amount
    };
  }

  cancelPaymentSubForm(): void {
    this.isAddingOrEditingPayment = false;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;
    this.editingOriginalAmount = 0;
  }

  closePaymentModal(): void {
    this.isPaymentModalOpen = false;
    this.activePaymentProject = null;
    this.clientPaymentsList = [];
    this.cancelPaymentSubForm();
  }

  get clientTotalReceived(): number {
    if (!this.clientPaymentsList.length) return Number(this.activePaymentProject?.received) || 0;
    return this.clientPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  get clientCurrentDue(): number {
    const siteVal = Number(this.activePaymentProject?.siteValue) || 0;
    return Math.max(0, siteVal - this.clientTotalReceived);
  }

  get liveNewReceived(): number {
    const base = this.clientTotalReceived;
    const inputAmt = Number(this.paymentFormData.amount) || 0;
    if (this.isEditingPastRecord) {
      return base - this.editingOriginalAmount + inputAmt;
    }
    return base + inputAmt;
  }

  get liveNewDue(): number {
    const siteVal = Number(this.activePaymentProject?.siteValue) || 0;
    return Math.max(0, siteVal - this.liveNewReceived);
  }

  submitClientPayment(): void {
    if (!this.activePaymentProject) return;
    if (!this.paymentFormData.amount || this.paymentFormData.amount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    const isoDate = this.toIsoDate(this.paymentFormData.dateInput);
    const mop = this.deriveMoPFromDate(this.paymentFormData.dateInput);

    const payload: Partial<ClientPayment> = {
      siteId: this.activePaymentProject.siteId,
      clientName: this.activePaymentProject.clientName,
      clientSiteName: this.paymentFormData.clientSiteName || `${this.activePaymentProject.siteId} : ${this.activePaymentProject.clientName}`,
      paymentDate: isoDate,
      mop,
      amount: Number(this.paymentFormData.amount),
      paymentMode: this.paymentFormData.paymentMode || 'Bank Transfer / NEFT',
      remarks: this.paymentFormData.remarks || ''
    };

    if (this.isEditingPastRecord && this.editingPaymentId) {
      this.projectService.updatePayment(this.editingPaymentId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMsg = `Payment for ${res.data.clientName} updated to ₹ ${Number(res.data.amount).toLocaleString('en-IN')}. Dashboard synchronized!`;
            this.isAddingOrEditingPayment = false;
            this.loadClientPayments(this.activePaymentProject!.siteId);
            this.loadData();
          }
        },
        error: (err) => alert(err.error?.message || 'Error updating payment')
      });
    } else {
      this.projectService.createPayment(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMsg = `Payment of ₹ ${Number(res.data.amount).toLocaleString('en-IN')} added for ${res.data.clientName}. Dashboard synchronized!`;
            this.isAddingOrEditingPayment = false;
            this.loadClientPayments(this.activePaymentProject!.siteId);
            this.loadData();
          }
        },
        error: (err) => alert(err.error?.message || 'Error recording payment')
      });
    }
  }

  deleteClientPaymentRow(p: ClientPayment): void {
    if (!p.id || !this.activePaymentProject) return;
    if (confirm(`Delete payment of ₹ ${Number(p.amount).toLocaleString('en-IN')} (${p.remarks || 'Installment'}) for ${this.activePaymentProject.clientName}?\n\nDashboard Received will be immediately recalculated.`)) {
      this.projectService.deletePayment(p.id).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMsg = 'Payment removed and Dashboard balance recalculated.';
            this.loadClientPayments(this.activePaymentProject!.siteId);
            this.loadData();
          }
        },
        error: (err) => alert(err.error?.message || 'Error deleting payment')
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
