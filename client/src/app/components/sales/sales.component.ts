import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SalesService } from '../../services/sales.service';
import { ProjectService } from '../../services/project.service';
import { MasterListService } from '../../services/master-list.service';
import { SitePlanService } from '../../services/site-plan.service';
import { OfficeService, Employee } from '../../services/office.service';
import { AuthService } from '../../services/auth.service';
import { Project, ClientPayment, SiteExpense } from '../../models/project.model';
import { SalesLead, LeadStatus, LeadHandler, OPPORTUNITY_STATUS_OPTIONS, OpportunityStatus } from '../../models/sales.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface WeeklySalesRecord {
  weekLabel: string; // e.g. "26/09/2026 - 02/10/2026"
  startDate: Date;
  endDate: Date;
  awardedSitesCount: number;
  awardedValue: number;
  clientPaymentReceived: number;
  poWoCount: number;
  awardedProjectsList: Project[];
  paymentsList: ClientPayment[];
  poWoList: SiteExpense[];
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.css']
})
export class SalesComponent implements OnInit, AfterViewInit, OnDestroy {
  private salesService = inject(SalesService);
  private projectService = inject(ProjectService);
  private masterListService = inject(MasterListService);
  private sitePlanService = inject(SitePlanService);
  private officeService = inject(OfficeService);
  authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Horizontal Scroll Synchronizer
  @ViewChild('topScrollWrapper') topScrollWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('dataTableEl') dataTableEl?: ElementRef<HTMLTableElement>;
  @ViewChild('dataTableOppEl') dataTableOppEl?: ElementRef<HTMLTableElement>;

  tableScrollWidth = 0;
  tableClientWidth = 0;
  private isSyncingTop = false;
  private isSyncingBottom = false;
  private resizeObserver?: ResizeObserver;

  // Active View Tab: 'leads' | 'opportunity' | 'dashboard'
  activeTab: 'leads' | 'opportunity' | 'dashboard' = 'leads';

  // Weekly Sales Dashboard State (for Admin)
  dashboardLoading = false;
  weeklyRecords: WeeklySalesRecord[] = [];
  selectedWeeklyRecord: WeeklySalesRecord | null = null;
  dashboardSearchTerm: string = '';
  isWeeklyDetailModalOpen = false;
  weeklyDetailRecord: WeeklySalesRecord | null = null;
  weeklyDetailActiveTab: 'awarded' | 'payments' | 'powo' = 'awarded';
  dashboardProjects: Project[] = [];
  dashboardPayments: ClientPayment[] = [];
  dashboardExpenses: SiteExpense[] = [];

  // Site Visit Planned State
  isSiteVisitModalOpen = false;
  pendingSiteVisitLead: SalesLead | null = null;
  pendingSiteVisitPreviousStatus: string = '';
  pendingSiteVisitSelectEl?: HTMLSelectElement;
  siteVisitForm = {
    date: '',
    time: '10:00',
    engineerName: '',
    description: ''
  };
  engineersList: string[] = [];

  // Award Won Confirmation State
  isAwardConfirmModalOpen = false;
  pendingAwardLead: SalesLead | null = null;
  previousLeadStatus: string = '';
  targetAwardStatus: string = 'Order Won';

  // Qualify Lead Confirmation State (Leads -> Opportunity)
  isQualifyConfirmModalOpen = false;
  pendingQualifyLead: SalesLead | null = null;
  pendingQualifyFormData: Partial<SalesLead> | null = null;
  pendingSelectEl?: HTMLSelectElement;
  previousQualifyStatus: string = 'New';
  targetQualifyStatus: string = 'Qualify';

  // Awarded Site Project Creation Modal State
  isCreateProjectModalOpen = false;
  isSubmittingProject = false;
  awardProjectForm: Partial<Project> = this.getEmptyProject();

  // Dynamic Master List Option Arrays (Loaded from MasterListService)
  masterSiteTypes: string[] = ['Residential', 'Commercial', 'Industrial', 'Ground Mount', 'Car Port', 'Floating', 'Residential Common'];
  masterSystemTypes: string[] = ['Ongrid', 'Off Grid', 'Hybrid', 'Solar Pump'];
  masterClientTypes: string[] = ['Individual', 'Company', 'Institutional', 'Association', 'Govt. Org'];
  saleTypeOptions: string[] = ['B2C', 'Direct B2B', 'Retailer B2B'];
  siteCategoryOptions: string[] = ['TATA SPG', 'Waree', 'Premier', 'Other'];
  orderByOptions: string[] = ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH'];

  // Data
  allLeads: SalesLead[] = [];
  loading = false;
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Filters & Search
  searchTerm = '';
  selectedHandler: string = 'All';
  selectedStatus: string = 'All';
  selectedOpportunityStatus: string = 'All';

  // Handlers and Status options as specified by user
  handlerOptions: string[] = ['Renuka', 'Daya', 'Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Soundarajan'];

  statusOptions: LeadStatus[] = ['New', 'Qualify', 'Unqualify'];
  opportunityStatusOptions: OpportunityStatus[] = OPPORTUNITY_STATUS_OPTIONS;

  // Modals state
  isAddModalOpen = false;
  isEditModalOpen = false;
  isDeleteModalOpen = false;

  leadForm: Partial<SalesLead> = this.getEmptyLead();
  leadToEdit: SalesLead | null = null;
  leadToDelete: SalesLead | null = null;

  ngOnInit(): void {
    this.checkCurrentTab();
    this.router.events.subscribe(() => {
      this.checkCurrentTab();
    });
    this.loadLeads();
    this.loadMasterListOptions();
    this.loadEngineers();
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
      if (this.dataTableOppEl?.nativeElement) {
        this.resizeObserver.observe(this.dataTableOppEl.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  updateTableWidth(): void {
    setTimeout(() => {
      const currentTable = this.activeTab === 'leads' ? this.dataTableEl?.nativeElement : this.dataTableOppEl?.nativeElement;
      if (currentTable && this.tableWrapper?.nativeElement) {
        this.tableScrollWidth = currentTable.scrollWidth;
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

  private checkCurrentTab(): void {
    const url = this.router.url;
    if (url.includes('dashboard')) {
      this.activeTab = 'dashboard';
      this.loadDashboardWeeklyData();
    } else if (url.includes('oppurtunity') || url.includes('opportunity')) {
      this.activeTab = 'opportunity';
    } else {
      this.activeTab = 'leads';
    }
    this.cdr.markForCheck();
    this.updateTableWidth();
  }

  setTab(tab: 'leads' | 'opportunity' | 'dashboard'): void {
    this.activeTab = tab;
    if (tab === 'dashboard') {
      this.router.navigate(['/sales/dashboard']);
      this.loadDashboardWeeklyData();
    } else {
      this.router.navigate([tab === 'opportunity' ? '/sales/oppurtunity' : '/sales/leads']);
    }
    this.cdr.markForCheck();
    this.updateTableWidth();
    setTimeout(() => {
      if (this.resizeObserver) {
        if (this.dataTableEl?.nativeElement) this.resizeObserver.observe(this.dataTableEl.nativeElement);
        if (this.dataTableOppEl?.nativeElement) this.resizeObserver.observe(this.dataTableOppEl.nativeElement);
      }
    }, 100);
  }

  canViewSalesDashboard(): boolean {
    return this.authService.isAdmin() || this.authService.canViewNav('sales-dashboard');
  }

  // --- WEEKLY SALES TRACKER (For Admin) ---
  loadDashboardWeeklyData(): void {
    this.dashboardLoading = true;
    this.cdr.markForCheck();

    this.projectService.getProjects().subscribe({
      next: (projRes) => {
        if (projRes.success && projRes.data) {
          this.dashboardProjects = projRes.data.filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE');
        }
        this.projectService.getPayments().subscribe({
          next: (payRes) => {
            if (payRes.success && payRes.data) {
              this.dashboardPayments = payRes.data;
            }
            this.projectService.getExpenses().subscribe({
              next: (expRes) => {
                if (expRes.success && expRes.data) {
                  this.dashboardExpenses = expRes.data;
                }
                this.computeWeeklySalesRecords();
                this.dashboardLoading = false;
                this.cdr.markForCheck();
              },
              error: () => {
                this.computeWeeklySalesRecords();
                this.dashboardLoading = false;
                this.cdr.markForCheck();
              }
            });
          },
          error: () => {
            this.dashboardLoading = false;
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.dashboardLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  isPoWo(paymentThrough?: string): boolean {
    if (!paymentThrough) return false;
    const clean = paymentThrough.trim().toUpperCase().replace(/[\s.]/g, '');
    return clean === 'PO' || clean === 'WO';
  }

  private parseAnyDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const str = String(val).trim();
    if (!str || str === '-' || str === 'null') return null;

    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }

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

  computeWeeklySalesRecords(): void {
    const pad = (n: number) => String(n).padStart(2, '0');
    // Anchor to 26/09/2026 (today) as explicitly specified by user: 26/09/2026 - 02/10/2026
    const anchor = new Date(2026, 8, 26);
    anchor.setHours(0, 0, 0, 0);

    const records: WeeklySalesRecord[] = [];

    // Generate weekly slots: from +1 week future down to -24 weeks past
    for (let k = 1; k >= -24; k--) {
      const start = new Date(anchor);
      start.setDate(anchor.getDate() + (k * 7));
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const startLabel = `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`;
      const endLabel = `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
      const weekLabel = `${startLabel} - ${endLabel}`;

      // 1. Awarded Projects in this week
      const awardedInWeek = this.dashboardProjects.filter(p => {
        const d = this.parseAnyDate(p.awardedDate || p.createdAt);
        return d && d >= start && d <= end;
      });

      const awardedValue = awardedInWeek.reduce((sum, p) => sum + (Number(p.siteValue) || 0), 0);

      // 2. Client Payments in this week
      const paymentsInWeek = this.dashboardPayments.filter(p => {
        const d = this.parseAnyDate(p.paymentDate || p.createdAt);
        return d && d >= start && d <= end;
      });

      const clientPaymentReceived = paymentsInWeek.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      // 3. PO / WO site expenses in this week
      const poWoInWeek = this.dashboardExpenses.filter(e => {
        if (!this.isPoWo(e.paymentThrough)) return false;
        const d = this.parseAnyDate(e.expenseDate || e.createdAt);
        return d && d >= start && d <= end;
      });

      records.push({
        weekLabel,
        startDate: start,
        endDate: end,
        awardedSitesCount: awardedInWeek.length,
        awardedValue,
        clientPaymentReceived,
        poWoCount: poWoInWeek.length,
        awardedProjectsList: awardedInWeek,
        paymentsList: paymentsInWeek,
        poWoList: poWoInWeek
      });
    }

    this.weeklyRecords = records;

    // Default select current week (26/09/2026 - 02/10/2026) or first record
    const currentWeekRec = this.weeklyRecords.find(w => w.weekLabel.startsWith('26/09/2026')) || this.weeklyRecords[1] || this.weeklyRecords[0];
    this.selectedWeeklyRecord = currentWeekRec || null;
    this.cdr.markForCheck();
  }

  selectWeeklyRecord(w: WeeklySalesRecord): void {
    this.selectedWeeklyRecord = w;
    this.cdr.markForCheck();
  }

  openWeeklyDetailModal(w: WeeklySalesRecord, tab: 'awarded' | 'payments' | 'powo' = 'awarded'): void {
    this.weeklyDetailRecord = w;
    this.weeklyDetailActiveTab = tab;
    this.isWeeklyDetailModalOpen = true;
  }

  closeWeeklyDetailModal(): void {
    this.isWeeklyDetailModalOpen = false;
    this.weeklyDetailRecord = null;
  }

  get filteredWeeklyRecords(): WeeklySalesRecord[] {
    if (!this.dashboardSearchTerm) return this.weeklyRecords;
    const q = this.dashboardSearchTerm.toLowerCase().trim();
    return this.weeklyRecords.filter(w => w.weekLabel.toLowerCase().includes(q));
  }

  exportWeeklySalesPdf(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('SOLAR SATHLOKHAR - WEEKLY SALES PERFORMANCE REPORT', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Scope: Executive Admin Weekly Performance Tracker`, 14, 25);

    const rows = this.weeklyRecords.map((w, idx) => [
      idx + 1,
      w.weekLabel,
      w.awardedSitesCount,
      `Rs. ${w.awardedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Rs. ${w.clientPaymentReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      w.poWoCount
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Week Range (dd/mm/yyyy - dd/mm/yyyy)', 'Total Awarded Sites', 'Awarded Value', 'Client Payment Received', 'No. of PO/WO']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 65, fontStyle: 'bold', halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 50, halign: 'right', textColor: [15, 118, 110], fontStyle: 'bold' },
        4: { cellWidth: 55, halign: 'right', textColor: [21, 128, 61], fontStyle: 'bold' },
        5: { cellWidth: 35, halign: 'center', textColor: [180, 83, 9] }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`Weekly_Sales_Performance_${new Date().toISOString().slice(0, 10)}.pdf`);
    this.showToast('Weekly Sales PDF report downloaded!', 'info');
  }

  loadLeads(): void {
    // 0ms instant display from cache if available
    const cached = this.salesService.getCachedLeads();
    if (cached && cached.length > 0) {
      this.allLeads = cached;
      this.loading = false;
      this.updateTableWidth();
    } else {
      this.loading = true;
    }
    this.cdr.markForCheck();

    this.salesService.getLeads().subscribe({
      next: (res) => {
        if (res.success) {
          this.allLeads = res.data;
        }
        this.loading = false;
        this.updateTableWidth();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading leads:', err);
        this.showToast('Failed to load leads from server.', 'danger');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // --- FILTERED LISTS ---

  isOpportunityStatus(status?: string): boolean {
    if (!status) return false;
    const lower = status.toLowerCase().trim();
    if (lower === 'qualify' || lower === 'oppurtunity' || lower === 'opportunity') return true;
    return this.opportunityStatusOptions.some(s => s.toLowerCase() === lower);
  }

  get scopedLeads(): SalesLead[] {
    // All recorded leads and opportunities are visible to all staff
    return this.allLeads;
  }

  get leadsList(): SalesLead[] {
    let list = this.scopedLeads.filter(l => !this.isOpportunityStatus(l.leadStatus));

    if (this.selectedStatus !== 'All') {
      list = list.filter(l => (l.leadStatus || '').toLowerCase() === this.selectedStatus.toLowerCase());
    }

    if (this.selectedHandler !== 'All') {
      list = list.filter(l => l.leadHandler === this.selectedHandler);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      list = list.filter(l =>
        (l.leadId || '').toLowerCase().includes(term) ||
        (l.leadName || '').toLowerCase().includes(term) ||
        (l.leadContact || '').toLowerCase().includes(term) ||
        (l.leadEmail || '').toLowerCase().includes(term) ||
        (l.leadLocation || '').toLowerCase().includes(term) ||
        (l.leadRemarks || '').toLowerCase().includes(term) ||
        (l.leadHandler || '').toLowerCase().includes(term)
      );
    }

    return list;
  }

  get opportunitiesList(): SalesLead[] {
    let list = this.scopedLeads.filter(l => this.isOpportunityStatus(l.leadStatus));

    if (this.selectedOpportunityStatus !== 'All') {
      list = list.filter(l => (l.leadStatus || '').toLowerCase() === this.selectedOpportunityStatus.toLowerCase());
    }

    if (this.selectedHandler !== 'All') {
      list = list.filter(l => l.leadHandler === this.selectedHandler);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      list = list.filter(l =>
        (l.leadId || '').toLowerCase().includes(term) ||
        (l.leadName || '').toLowerCase().includes(term) ||
        (l.leadContact || '').toLowerCase().includes(term) ||
        (l.leadEmail || '').toLowerCase().includes(term) ||
        (l.leadLocation || '').toLowerCase().includes(term) ||
        (l.leadRemarks || '').toLowerCase().includes(term) ||
        (l.leadHandler || '').toLowerCase().includes(term)
      );
    }

    return list;
  }

  // --- COUNTERS ---
  get totalLeadsCount(): number {
    return this.scopedLeads.filter(l => !this.isOpportunityStatus(l.leadStatus)).length;
  }

  get totalOpportunitiesCount(): number {
    return this.scopedLeads.filter(l => this.isOpportunityStatus(l.leadStatus)).length;
  }

  get newLeadsCount(): number {
    return this.scopedLeads.filter(l => (l.leadStatus || '').toLowerCase() === 'new').length;
  }

  get qualifiedLeadsCount(): number {
    return this.totalOpportunitiesCount;
  }

  get unqualifiedLeadsCount(): number {
    return this.scopedLeads.filter(l => (l.leadStatus || '').toLowerCase() === 'unqualify').length;
  }

  // --- CREATE LEAD ---
  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add new sales leads.', 'info');
      return;
    }
    this.leadForm = this.getEmptyLead();
    const currUser = this.authService.currentUser();
    if (!this.authService.isAdmin() && currUser?.name) {
      const matched = this.handlerOptions.find(h => h.toLowerCase() === currUser.name.toLowerCase() || currUser.name.toLowerCase().includes(h.toLowerCase()));
      if (matched) {
        this.leadForm.leadHandler = matched;
      }
    }
    this.salesService.getNextLeadId().subscribe({
      next: (res) => {
        if (res.success && res.nextLeadId) {
          this.leadForm.leadId = res.nextLeadId;
        }
        this.isAddModalOpen = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.leadForm.leadId = 'SLD-101';
        this.isAddModalOpen = true;
        this.cdr.markForCheck();
      }
    });
  }

  closeAddModal(): void {
    this.isAddModalOpen = false;
    this.cdr.markForCheck();
  }

  saveNewLead(): void {
    if (!this.leadForm.leadName?.trim()) {
      this.showToast('Please enter the Lead Name.', 'danger');
      return;
    }

    this.salesService.createLead(this.leadForm).subscribe({
      next: (res) => {
        if (res.success) {
          const created = res.data;
          this.allLeads.unshift(created);
          this.closeAddModal();

          if (this.isOpportunityStatus(created.leadStatus)) {
            this.showToast(`Lead ${created.leadId} created with status '${created.leadStatus}' and added to Oppurtunity tab!`, 'success');
            this.setTab('opportunity');
          } else {
            this.showToast(`New Lead ${created.leadId} registered successfully!`, 'success');
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to create sales lead.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // --- EDIT LEAD ---
  openEditModal(lead: SalesLead): void {
    const isOpp = this.isOpportunityStatus(lead.leadStatus);
    if (isOpp) {
      if (!this.canEditOpportunity()) {
        this.showToast('Only Admin can edit opportunities. View only.', 'info');
        return;
      }
    } else {
      if (!this.canEditLead()) {
        this.showToast('Only Admin can edit lead details. View only.', 'info');
        return;
      }
    }
    this.leadToEdit = lead;
    this.leadForm = { ...lead };
    this.isEditModalOpen = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.leadToEdit = null;
    this.cdr.markForCheck();
  }

  saveEditLead(): void {
    if (!this.leadToEdit?.id) return;
    if (!this.leadForm.leadName?.trim()) {
      this.showToast('Please enter the Lead Name.', 'danger');
      return;
    }

    const previousStatus = this.leadToEdit.leadStatus;
    const newStatus = this.leadForm.leadStatus || 'New';
    const wasOpp = this.isOpportunityStatus(previousStatus);
    const nowOpp = this.isOpportunityStatus(newStatus);

    if (newStatus === 'Order Won') {
      const leadRef = this.leadToEdit;
      this.closeEditModal();
      this.promptAwardConfirmation(leadRef, newStatus, previousStatus);
      return;
    }

    if (newStatus === 'Site Visit Planned' && previousStatus !== 'Site Visit Planned') {
      const leadRef = { ...this.leadToEdit, ...this.leadForm } as SalesLead;
      this.closeEditModal();
      this.promptSiteVisitPlan(leadRef, previousStatus);
      return;
    }

    // If qualifying a lead from Leads tab via modal, prompt confirmation before moving to Opportunity!
    if (!wasOpp && (newStatus === 'Qualify' || newStatus === 'Oppurtunity')) {
      const leadRef = { ...this.leadToEdit, ...this.leadForm } as SalesLead;
      const formData = { ...this.leadForm };
      this.closeEditModal();
      this.promptQualifyConfirmation(leadRef, newStatus, previousStatus, formData);
      return;
    }

    this.salesService.updateLead(this.leadToEdit.id, this.leadForm).subscribe({
      next: (res) => {
        if (res.success) {
          const updated = res.data;
          const index = this.allLeads.findIndex(l => l.id === updated.id);
          if (index !== -1) {
            this.allLeads[index] = updated;
          }
          this.closeEditModal();

          if (!wasOpp && nowOpp) {
            this.showToast(`Lead ${updated.leadId} marked as '${newStatus}' and moved to Oppurtunity tab!`, 'success');
            this.setTab('opportunity');
          } else if (wasOpp && !nowOpp) {
            this.showToast(`Lead ${updated.leadId} moved back to Leads with status '${newStatus}'.`, 'info');
            this.setTab('leads');
          } else {
            this.showToast(`Lead ${updated.leadId} updated successfully.`, 'success');
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to update lead.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // --- QUALIFY LEAD CONFIRMATION WORKFLOW (LEADS -> OPPORTUNITY) ---
  promptQualifyConfirmation(lead: SalesLead, targetStatus: string = 'Qualify', prevStatus: string = 'New', formData?: Partial<SalesLead>, selectEl?: HTMLSelectElement): void {
    this.pendingQualifyLead = lead;
    this.pendingQualifyFormData = formData || null;
    this.pendingSelectEl = selectEl;
    this.previousQualifyStatus = prevStatus || 'New';
    this.targetQualifyStatus = targetStatus;
    this.isQualifyConfirmModalOpen = true;
    this.cdr.markForCheck();
  }

  cancelQualifyConfirmation(): void {
    const prev = this.previousQualifyStatus || 'New';
    if (this.pendingQualifyLead) {
      this.pendingQualifyLead.leadStatus = prev;
    }
    if (this.pendingSelectEl) {
      this.pendingSelectEl.value = prev;
    }
    this.isQualifyConfirmModalOpen = false;
    this.pendingQualifyLead = null;
    this.pendingSelectEl = undefined;
    this.pendingQualifyFormData = null;
    this.cdr.detectChanges();
  }

  confirmQualifyYes(): void {
    if (!this.pendingQualifyLead?.id) return;
    const lead = this.pendingQualifyLead;
    const leadId = lead.id;
    if (!leadId) return;
    const targetStatus = this.targetQualifyStatus || 'Qualify';
    const oldStatus = this.previousQualifyStatus;

    const payload: Partial<SalesLead> = this.pendingQualifyFormData
      ? { ...this.pendingQualifyFormData, leadStatus: targetStatus }
      : { leadStatus: targetStatus };

    lead.leadStatus = targetStatus;
    if (this.pendingSelectEl) {
      this.pendingSelectEl.value = targetStatus;
    }
    this.salesService.updateLead(leadId, payload).subscribe({
      next: (res) => {
        if (res.success) {
          const index = this.allLeads.findIndex(l => l.id === lead.id);
          if (index !== -1) {
            this.allLeads[index] = res.data || { ...this.allLeads[index], ...payload };
          }
          this.showToast(`Lead ${lead.leadId} (${lead.leadName}) qualified and moved to Oppurtunity tab!`, 'success');
          this.setTab('opportunity');
        }
        this.isQualifyConfirmModalOpen = false;
        this.pendingQualifyLead = null;
        this.pendingSelectEl = undefined;
        this.pendingQualifyFormData = null;
        this.cdr.markForCheck();
      },
      error: () => {
        lead.leadStatus = oldStatus;
        if (this.pendingSelectEl) {
          this.pendingSelectEl.value = oldStatus;
        }
        this.showToast('Failed to qualify lead.', 'danger');
        this.isQualifyConfirmModalOpen = false;
        this.pendingQualifyLead = null;
        this.pendingSelectEl = undefined;
        this.pendingQualifyFormData = null;
        this.cdr.markForCheck();
      }
    });
  }

  // --- QUICK STATUS CHANGE IN TABLE ROW ---
  changeStatus(lead: SalesLead, newStatus: string, selectEl?: HTMLSelectElement): void {
    if (!lead.id || lead.leadStatus === newStatus) return;
    const isCurrentOpp = this.isOpportunityStatus(lead.leadStatus);
    if (isCurrentOpp) {
      if (!this.canChangeOpportunityStatus()) {
        if (selectEl) selectEl.value = lead.leadStatus;
        this.showToast('Only Admin can modify opportunity status. View only.', 'info');
        return;
      }
    } else {
      if (!this.canChangeLeadStatus()) {
        if (selectEl) selectEl.value = lead.leadStatus;
        this.showToast('Only Admin or Daya can modify lead status. View only.', 'info');
        return;
      }
    }

    const previousStatus = lead.leadStatus;

    // If changing to Site Visit Planned, prompt for date, engineer, description before proceeding
    if (newStatus === 'Site Visit Planned') {
      lead.leadStatus = newStatus;
      this.promptSiteVisitPlan(lead, previousStatus, selectEl);
      return;
    }

    // If changing to Order Won, prompt for confirmation before proceeding
    if (newStatus === 'Order Won') {
      this.promptAwardConfirmation(lead, newStatus, previousStatus);
      return;
    }

    const wasOpp = this.isOpportunityStatus(previousStatus);
    const nowOpp = this.isOpportunityStatus(newStatus);

    // If qualifying a lead from Leads tab, prompt confirmation before moving to Opportunity!
    if (!wasOpp && (newStatus === 'Qualify' || newStatus === 'Oppurtunity')) {
      lead.leadStatus = newStatus;
      this.promptQualifyConfirmation(lead, newStatus, previousStatus, undefined, selectEl);
      return;
    }

    lead.leadStatus = newStatus; // Optimistic update
    this.cdr.markForCheck();

    this.salesService.updateLead(lead.id, { leadStatus: newStatus }).subscribe({
      next: (res) => {
        if (res.success) {
          if (!wasOpp && nowOpp) {
            this.showToast(`Lead ${lead.leadId} (${lead.leadName}) qualified and moved to Oppurtunity tab as '${newStatus}'!`, 'success');
            this.setTab('opportunity');
          } else if (wasOpp && !nowOpp) {
            this.showToast(`Lead ${lead.leadId} (${lead.leadName}) changed to '${newStatus}' and moved back to Leads tab.`, 'info');
            this.setTab('leads');
          } else {
            this.showToast(`Opportunity ${lead.leadId} status updated to '${newStatus}'.`, 'info');
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        lead.leadStatus = previousStatus; // Revert
        this.showToast('Failed to update status.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // --- AWARDED WON CONFIRMATION & MASTER DATA TRANSFER ---
  promptAwardConfirmation(lead: SalesLead, newStatus: string, previousStatus?: string): void {
    this.pendingAwardLead = lead;
    this.previousLeadStatus = previousStatus || lead.leadStatus;
    this.targetAwardStatus = newStatus;
    this.isAwardConfirmModalOpen = true;
    this.cdr.markForCheck();
  }

  cancelAwardConfirmation(): void {
    if (this.pendingAwardLead && this.previousLeadStatus) {
      this.pendingAwardLead.leadStatus = this.previousLeadStatus;
    }
    this.isAwardConfirmModalOpen = false;
    this.pendingAwardLead = null;
    this.previousLeadStatus = '';
    this.cdr.markForCheck();
  }

  confirmAwardYes(): void {
    if (!this.pendingAwardLead) return;
    const lead = this.pendingAwardLead;
    const targetStatus = this.targetAwardStatus;
    this.isAwardConfirmModalOpen = false;
    this.openCreateAwardedSiteModal(lead, targetStatus);
  }

  openCreateAwardedSiteModal(lead: SalesLead, status: string): void {
    this.pendingAwardLead = lead;
    this.targetAwardStatus = status;
    this.awardProjectForm = this.getEmptyProject();

    // Map lead handler to Order By handler if possible
    let mappedOrderBy = 'K KARTHIKEYAN';
    if (lead.leadHandler) {
      const hLower = lead.leadHandler.toLowerCase();
      if (hLower.includes('sathish')) mappedOrderBy = 'K SATHISH';
      else if (hLower.includes('sharath')) mappedOrderBy = 'V SHARATH';
      else if (hLower.includes('soundar')) mappedOrderBy = 'SOUNDARARAJAN M';
      else if (hLower.includes('karthik')) mappedOrderBy = 'K KARTHIKEYAN';
      else if (this.orderByOptions.includes(lead.leadHandler)) mappedOrderBy = lead.leadHandler;
    }

    // Pre-populate with opportunity details as requested by user
    this.awardProjectForm.awardedDate = new Date().toISOString().substring(0, 10);
    this.awardProjectForm.clientName = lead.leadName || '';
    this.awardProjectForm.location = lead.leadLocation || '';
    this.awardProjectForm.contactNo = lead.leadContact || '';
    this.awardProjectForm.emailId = lead.leadEmail || '';
    this.awardProjectForm.address = lead.leadLocation || '';
    this.awardProjectForm.orderBy = mappedOrderBy;
    this.awardProjectForm.leadBy = lead.leadHandler || this.authService.currentUser()?.name || '';

    // Fetch existing projects to calculate the next SP ID (e.g., if ends in 418, next creates 419)
    this.projectService.getProjects().subscribe({
      next: (res) => {
        let maxNum = 400;
        if (res.success && res.data) {
          for (const p of res.data) {
            if (p.siteId && p.siteId !== 'WAREHOUSE') {
              const m = p.siteId.match(/(\d+)/);
              if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxNum) maxNum = n;
              }
            }
          }
        }
        this.awardProjectForm.siteId = `SP${maxNum + 1}`;
        this.isCreateProjectModalOpen = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.awardProjectForm.siteId = 'SP419';
        this.isCreateProjectModalOpen = true;
        this.cdr.markForCheck();
      }
    });
  }

  cancelCreateAwardedSiteModal(): void {
    if (this.pendingAwardLead && this.previousLeadStatus) {
      this.pendingAwardLead.leadStatus = this.previousLeadStatus;
    }
    this.isCreateProjectModalOpen = false;
    this.pendingAwardLead = null;
    this.previousLeadStatus = '';
    this.isSubmittingProject = false;
    this.showToast('Awarded Site creation cancelled. Opportunity status preserved.', 'info');
    this.cdr.markForCheck();
  }

  submitAwardedSiteProject(): void {
    if (!this.pendingAwardLead) return;
    if (!this.awardProjectForm.siteId?.trim()) {
      this.showToast('Please specify a Site ID.', 'danger');
      return;
    }
    if (!this.awardProjectForm.clientName?.trim()) {
      this.showToast('Please enter the Client Name.', 'danger');
      return;
    }

    const lead = this.pendingAwardLead;
    const finalStatus = this.targetAwardStatus || 'Order Won';
    this.isSubmittingProject = true;
    this.cdr.markForCheck();

    // 1. Create project in Awarded Sites
    this.projectService.createProject(this.awardProjectForm).subscribe({
      next: (projRes) => {
        const createdSiteId = this.awardProjectForm.siteId;
        const createdClient = this.awardProjectForm.clientName;

        // 2. Update Opportunity status in Database to Awarded Won / Order Won
        lead.leadStatus = finalStatus;
        if (lead.id) {
          this.salesService.updateLead(lead.id, { leadStatus: finalStatus }).subscribe({
            next: () => {
              this.isCreateProjectModalOpen = false;
              this.isSubmittingProject = false;
              this.pendingAwardLead = null;
              this.showToast(`Success! Site ${createdSiteId} added to Awarded Sites for ${createdClient}. Opportunity marked as ${finalStatus}.`, 'success');
              this.updateTableWidth();
              this.cdr.markForCheck();
            },
            error: () => {
              this.isCreateProjectModalOpen = false;
              this.isSubmittingProject = false;
              this.pendingAwardLead = null;
              this.showToast(`Site ${createdSiteId} created in Awarded Sites!`, 'success');
              this.updateTableWidth();
              this.cdr.markForCheck();
            }
          });
        } else {
          this.isCreateProjectModalOpen = false;
          this.isSubmittingProject = false;
          this.pendingAwardLead = null;
          this.showToast(`Success! Site ${createdSiteId} added to Awarded Sites.`, 'success');
          this.updateTableWidth();
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.isSubmittingProject = false;
        console.error('Failed to create project in master:', err);
        this.showToast(err.error?.message || 'Failed to create Awarded Site record. Please check the values.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // --- FINANCIAL FORM COMPUTATIONS ---
  get awardFormDue(): number {
    const val = parseFloat(this.awardProjectForm.siteValue as any) || 0;
    const recv = parseFloat(this.awardProjectForm.received as any) || 0;
    return Math.max(0, val - recv);
  }

  get awardFormMargin(): number {
    const val = parseFloat(this.awardProjectForm.siteValue as any) || 0;
    const exp = parseFloat(this.awardProjectForm.siteExpenses as any) || 0;
    return val - exp;
  }

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
          this.masterSystemTypes = findItems('System_Type', findItems('Sys_Type', this.masterSystemTypes));
          this.siteCategoryOptions = findItems('Site_Category', findItems('Site Category', this.siteCategoryOptions));
          const orderItems = findItems('Order_By', []);
          if (orderItems.length > 0) this.orderByOptions = orderItems;
          const leadHandlerItems = findItems('Leads Name', findItems('Lead Handlers', []));
          if (leadHandlerItems.length > 0) this.handlerOptions = leadHandlerItems;
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadEngineers(): void {
    const cached = this.officeService.getCachedEmployees();
    if (cached.length > 0) {
      this.extractEngineers(cached);
    } else {
      this.officeService.getEmployees().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.extractEngineers(res.data);
          }
        },
        error: (err) => console.error('Failed to load employees for site visit engineers:', err)
      });
    }
  }

  private extractEngineers(emps: Employee[]): void {
    const engs = emps
      .filter(e => (e.responsibility || '').toLowerCase() === 'engineers' || (e.designation || '').toLowerCase().includes('engineer'))
      .map(e => e.name);
    this.engineersList = Array.from(new Set(engs));
    if (this.engineersList.length > 0 && !this.siteVisitForm.engineerName) {
      this.siteVisitForm.engineerName = this.engineersList[0];
    }
    this.cdr.markForCheck();
  }

  // --- SITE VISIT PLANNED MODAL WORKFLOW ---
  promptSiteVisitPlan(lead: SalesLead, previousStatus?: string, selectEl?: HTMLSelectElement): void {
    this.pendingSiteVisitLead = lead;
    this.pendingSiteVisitPreviousStatus = previousStatus || lead.leadStatus;
    this.pendingSiteVisitSelectEl = selectEl;
    this.siteVisitForm = {
      date: new Date().toISOString().substring(0, 10),
      time: '10:00',
      engineerName: this.engineersList[0] || '',
      description: lead.leadRemarks || ''
    };
    this.isSiteVisitModalOpen = true;
    this.cdr.markForCheck();
  }

  cancelSiteVisitPlan(): void {
    const prev = this.pendingSiteVisitPreviousStatus || 'New';
    if (this.pendingSiteVisitLead) {
      this.pendingSiteVisitLead.leadStatus = prev;
    }
    if (this.pendingSiteVisitSelectEl) {
      this.pendingSiteVisitSelectEl.value = prev;
    }
    this.isSiteVisitModalOpen = false;
    this.pendingSiteVisitLead = null;
    this.pendingSiteVisitSelectEl = undefined;
    this.cdr.markForCheck();
  }

  confirmSiteVisitPlan(): void {
    if (!this.pendingSiteVisitLead?.id) return;
    const lead = this.pendingSiteVisitLead;
    const leadId = lead.id!;
    const prev = this.pendingSiteVisitPreviousStatus;

    if (!this.siteVisitForm.date) {
      this.showToast('Please select a visit date.', 'danger');
      return;
    }

    // 1. Update lead status in Sales to Site Visit Planned
    lead.leadStatus = 'Site Visit Planned';
    if (this.pendingSiteVisitSelectEl) {
      this.pendingSiteVisitSelectEl.value = 'Site Visit Planned';
    }

    this.salesService.updateLead(leadId, { leadStatus: 'Site Visit Planned' }).subscribe({
      next: (res) => {
        if (res.success) {
          const idx = this.allLeads.findIndex(l => l.id === leadId);
          if (idx !== -1) {
            this.allLeads[idx] = res.data;
          }

          // 2. Create entry in Site Plan table
          const currentUser = this.authService.currentUser();
          const assignedBy = currentUser?.name || 'Admin';

          this.sitePlanService.createSitePlan({
            date: this.siteVisitForm.date,
            time: this.siteVisitForm.time || '10:00',
            clientName: lead.leadName,
            engineerName: this.siteVisitForm.engineerName,
            description: this.siteVisitForm.description,
            assignedBy: assignedBy,
            opportunityId: lead.id
          }).subscribe({
            next: () => {
              this.showToast(`Site visit planned on ${this.siteVisitForm.date} with ${this.siteVisitForm.engineerName || 'Engineer'} and copied to Site Plan!`, 'success');
            },
            error: (err) => {
              console.error('Error creating site plan record:', err);
              this.showToast('Status updated to Site Visit Planned, but error saving to Site Plan.', 'info');
            }
          });
        }
        this.isSiteVisitModalOpen = false;
        this.pendingSiteVisitLead = null;
        this.pendingSiteVisitSelectEl = undefined;
        this.cdr.markForCheck();
      },
      error: () => {
        lead.leadStatus = prev;
        if (this.pendingSiteVisitSelectEl) {
          this.pendingSiteVisitSelectEl.value = prev;
        }
        this.showToast('Failed to update status.', 'danger');
        this.isSiteVisitModalOpen = false;
        this.pendingSiteVisitLead = null;
        this.pendingSiteVisitSelectEl = undefined;
        this.cdr.markForCheck();
      }
    });
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
      siteCapacity: '5 kW',
      siteValue: 0,
      received: 0,
      siteExpenses: 0,
      siteType: 'Residential',
      systemType: 'Ongrid',
      siteCategory: 'TATA SPG',
      clientType: 'Individual',
      saleType: 'B2C',
      orderBy: 'K KARTHIKEYAN',
      leadBy: '',
      materialsSupply: false,
      installation: false,
      ebProcess: false,
      documents: false,
      warranty: false,
      handedOver: false
    };
  }

  // --- DELETE LEAD ---
  confirmDelete(lead: SalesLead): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete sales records.', 'danger');
      return;
    }
    this.leadToDelete = lead;
    this.isDeleteModalOpen = true;
    this.cdr.markForCheck();
  }

  // --- PERMISSION CHECKS ---
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isDaya(): boolean {
    const user = this.authService.currentUser();
    const name = (user?.name || '').trim().toLowerCase();
    const username = (user?.username || '').trim().toLowerCase();
    return name.includes('daya') || username.includes('daya');
  }

  canAdd(): boolean {
    return this.isAdmin() || this.isDaya();
  }

  canEdit(): boolean {
    return this.isAdmin();
  }

  canEditLead(): boolean {
    return this.isAdmin();
  }

  canEditOpportunity(): boolean {
    return this.isAdmin();
  }

  canChangeLeadStatus(): boolean {
    return this.isAdmin() || this.isDaya();
  }

  canChangeOpportunityStatus(): boolean {
    return this.isAdmin();
  }

  canDelete(): boolean {
    return this.isAdmin();
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.leadToDelete = null;
    this.cdr.markForCheck();
  }

  executeDelete(): void {
    if (!this.leadToDelete?.id) return;
    const targetId = this.leadToDelete.id;
    const targetLeadId = this.leadToDelete.leadId;

    this.salesService.deleteLead(targetId).subscribe({
      next: (res) => {
        if (res.success) {
          this.allLeads = this.allLeads.filter(l => l.id !== targetId);
          this.closeDeleteModal();
          this.showToast(`Record ${targetLeadId} deleted successfully.`, 'success');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.showToast('Failed to delete record.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // --- UTILS ---
  getEmptyLead(): Partial<SalesLead> {
    return {
      leadId: '',
      leadDate: new Date().toISOString().substring(0, 10),
      leadName: '',
      leadContact: '',
      leadEmail: '',
      leadLocation: '',
      siteType: 'Residential',
      systemType: 'Ongrid',
      siteCategory: 'TATA SPG',
      saleType: 'B2C',
      clientType: 'Individual',
      leadStatus: 'New',
      leadHandler: 'Renuka',
      leadRemarks: ''
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

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  exportSalesPdf(): void {
    if (this.activeTab === 'leads') {
      this.exportLeadsPdf();
    } else {
      this.exportOpportunitiesPdf();
    }
  }

  exportLeadsPdf(): void {
    const list = this.leadsList;
    if (list.length === 0) {
      this.showToast('No leads available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - SALES LEADS REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Leads: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Lead ID', 'Lead Date', 'Client Name', 'Contact No', 'Email ID', 'Location', 'Status', 'Lead Handler', 'Remarks']
    ];

    const body = list.map((l, idx) => [
      idx + 1,
      l.leadId || '',
      this.formatDate(l.leadDate),
      l.leadName || '',
      l.leadContact || '',
      l.leadEmail || '',
      l.leadLocation || '',
      l.leadStatus || '',
      l.leadHandler || '',
      l.leadRemarks || ''
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Sales_Leads_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Sales Leads PDF exported successfully!', 'success');
  }

  exportOpportunitiesPdf(): void {
    const list = this.opportunitiesList;
    if (list.length === 0) {
      this.showToast('No opportunities available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(180, 83, 9);
    doc.text('SOLAR SATHLOKHAR - SALES OPPORTUNITIES REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Opportunities: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Opportunity ID', 'Date', 'Client Name', 'Contact No', 'Location', 'Site Type', 'System Type', 'Site Category', 'Sale Type', 'Client Type', 'Stage / Status', 'Lead Handler', 'Remarks']
    ];

    const body = list.map((l, idx) => [
      idx + 1,
      l.leadId || '',
      this.formatDate(l.leadDate),
      l.leadName || '',
      l.leadContact || '',
      l.leadLocation || '',
      l.siteType || 'Residential',
      l.systemType || 'Ongrid',
      l.siteCategory || 'TATA SPG',
      l.saleType || 'B2C',
      l.clientType || 'Individual',
      l.leadStatus || '',
      l.leadHandler || '',
      l.leadRemarks || ''
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [254, 252, 232] }
    });

    doc.save(`Sales_Opportunities_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Sales Opportunities PDF exported successfully!', 'success');
  }
}
