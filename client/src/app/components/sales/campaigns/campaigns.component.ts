import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CampaignService, Campaign, CampaignLead, CampaignExpense } from '../../../services/campaign.service';
import { SalesService } from '../../../services/sales.service';
import { MasterListService } from '../../../services/master-list.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './campaigns.component.html',
  styleUrls: ['./campaigns.component.css']
})
export class CampaignsComponent implements OnInit, AfterViewInit, OnDestroy {
  private campaignService = inject(CampaignService);
  private salesService = inject(SalesService);
  private masterListService = inject(MasterListService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Horizontal Scroll Synchronizers
  @ViewChild('topScrollWrapper') topScrollWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('dataTableEl') dataTableEl?: ElementRef<HTMLTableElement>;

  @ViewChild('topScrollLeadsWrapper') topScrollLeadsWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('leadsTableWrapper') leadsTableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('leadsTableEl') leadsTableEl?: ElementRef<HTMLTableElement>;

  tableScrollWidth = 0;
  tableClientWidth = 0;
  leadsScrollWidth = 0;
  leadsClientWidth = 0;
  private isSyncingTop = false;
  private isSyncingBottom = false;
  private isSyncingLeadsTop = false;
  private isSyncingLeadsBottom = false;
  private resizeObserver?: ResizeObserver;

  campaigns: Campaign[] = [];
  loading = false;
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Sub-view mode: 'campaigns' (main list), 'leads' (viewing leads of a campaign), 'expenses' (viewing expenses)
  activeSubView: 'campaigns' | 'leads' | 'expenses' = 'campaigns';
  selectedCampaign: Campaign | null = null;

  campaignLeads: CampaignLead[] = [];
  campaignExpenses: CampaignExpense[] = [];
  leadsLoading = false;
  expensesLoading = false;

  // Search & Filters
  searchTerm = '';
  leadSearchTerm = '';
  expenseSearchTerm = '';

  // Campaign Modals
  isCampaignModalOpen = false;
  isEditCampaignMode = false;
  campaignForm: Partial<Campaign> = this.getEmptyCampaign();
  campaignToDelete: Campaign | null = null;
  isDeleteCampaignModalOpen = false;

  // Lead Modals
  isLeadModalOpen = false;
  isEditLeadMode = false;
  leadForm: Partial<CampaignLead> = this.getEmptyLead();
  leadToEdit: CampaignLead | null = null;
  leadToDelete: CampaignLead | null = null;
  isDeleteLeadModalOpen = false;

  // Expense Modals
  isExpenseModalOpen = false;
  isEditExpenseMode = false;
  expenseForm: Partial<CampaignExpense> = this.getEmptyExpense();
  expenseToEdit: CampaignExpense | null = null;
  expenseToDelete: CampaignExpense | null = null;
  isDeleteExpenseModalOpen = false;

  // Options
  leadHandlers: string[] = ['Renuka', 'Daya', 'Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Soundarajan'];
  leadStatuses = ['Qualify', 'On hold', 'Unqualify'];

  // Qualify Campaign Lead Confirmation Modal State
  isQualifyCampaignLeadModalOpen = false;
  pendingQualifyCampaignLead: CampaignLead | null = null;
  pendingQualifyCampaignLeadForm: Partial<CampaignLead> | null = null;
  pendingCampaignSelectEl?: HTMLSelectElement;
  previousCampaignLeadStatus: string = 'On hold';

  // Option selection inside Campaign Modal ('none' | 'leads' | 'expenses')
  campaignModalSection: 'none' | 'leads' | 'expenses' = 'none';
  modalLeadToEdit: CampaignLead | null = null;
  isEditLeadInModal = false;
  modalExpenseToEdit: CampaignExpense | null = null;
  isEditExpenseInModal = false;

  ngOnInit(): void {
    const cached = this.campaignService.getCachedCampaigns();
    if (cached.length > 0) {
      this.campaigns = cached;
      this.loading = false;
      this.updateTableWidth();
    } else {
      this.loading = true;
    }
    this.loadCampaigns();
    this.loadLeadHandlers();
  }

  loadLeadHandlers(): void {
    this.masterListService.getList('Leads Name').subscribe({
      next: (res) => {
        if (res.success && res.data?.items?.length > 0) {
          this.leadHandlers = res.data.items;
          this.cdr.markForCheck();
        }
      }
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
      if (this.leadsTableWrapper?.nativeElement) {
        this.resizeObserver.observe(this.leadsTableWrapper.nativeElement);
      }
      if (this.leadsTableEl?.nativeElement) {
        this.resizeObserver.observe(this.leadsTableEl.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  updateTableWidth(): void {
    setTimeout(() => {
      if (this.activeSubView === 'campaigns') {
        if (this.dataTableEl?.nativeElement && this.tableWrapper?.nativeElement) {
          this.tableScrollWidth = this.dataTableEl.nativeElement.scrollWidth;
          this.tableClientWidth = this.tableWrapper.nativeElement.clientWidth;
          if (this.topScrollWrapper?.nativeElement) {
            this.topScrollWrapper.nativeElement.scrollLeft = this.tableWrapper.nativeElement.scrollLeft;
          }
          this.cdr.markForCheck();
        }
      } else if (this.activeSubView === 'leads') {
        if (this.leadsTableEl?.nativeElement && this.leadsTableWrapper?.nativeElement) {
          this.leadsScrollWidth = this.leadsTableEl.nativeElement.scrollWidth;
          this.leadsClientWidth = this.leadsTableWrapper.nativeElement.clientWidth;
          if (this.topScrollLeadsWrapper?.nativeElement) {
            this.topScrollLeadsWrapper.nativeElement.scrollLeft = this.leadsTableWrapper.nativeElement.scrollLeft;
          }
          this.cdr.markForCheck();
        }
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

  onTopScrollLeads(): void {
    if (this.isSyncingLeadsBottom) return;
    this.isSyncingLeadsTop = true;
    if (this.leadsTableWrapper?.nativeElement && this.topScrollLeadsWrapper?.nativeElement) {
      this.leadsTableWrapper.nativeElement.scrollLeft = this.topScrollLeadsWrapper.nativeElement.scrollLeft;
    }
    requestAnimationFrame(() => {
      this.isSyncingLeadsTop = false;
    });
  }

  onTableScrollLeads(): void {
    if (this.isSyncingLeadsTop) return;
    this.isSyncingLeadsBottom = true;
    if (this.topScrollLeadsWrapper?.nativeElement && this.leadsTableWrapper?.nativeElement) {
      this.topScrollLeadsWrapper.nativeElement.scrollLeft = this.leadsTableWrapper.nativeElement.scrollLeft;
    }
    requestAnimationFrame(() => {
      this.isSyncingLeadsBottom = false;
    });
  }

  loadCampaigns(): void {
    this.campaignService.getCampaigns().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.campaigns = res.data;
        }
        this.loading = false;
        this.updateTableWidth();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load campaigns.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get filteredCampaigns(): Campaign[] {
    if (!this.searchTerm.trim()) return this.campaigns;
    const term = this.searchTerm.trim().toLowerCase();
    return this.campaigns.filter(c =>
      (c.campaignName || '').toLowerCase().includes(term) ||
      (c.venue || '').toLowerCase().includes(term) ||
      (c.campaignDate || '').toLowerCase().includes(term)
    );
  }

  // --- SUB-VIEWS: LEADS & EXPENSES ---
  selectCampaignView(campaign: Campaign, view: 'leads' | 'expenses'): void {
    this.selectedCampaign = campaign;
    this.activeSubView = view;
    if (view === 'leads') {
      this.loadLeadsForCampaign(campaign.id!);
    } else if (view === 'expenses') {
      this.loadExpensesForCampaign(campaign.id!);
    }
    this.updateTableWidth();
    setTimeout(() => {
      if (this.resizeObserver) {
        if (this.leadsTableWrapper?.nativeElement) this.resizeObserver.observe(this.leadsTableWrapper.nativeElement);
        if (this.leadsTableEl?.nativeElement) this.resizeObserver.observe(this.leadsTableEl.nativeElement);
      }
    }, 100);
  }

  backToCampaigns(): void {
    this.activeSubView = 'campaigns';
    this.selectedCampaign = null;
    this.campaignLeads = [];
    this.campaignExpenses = [];
    this.loadCampaigns(); // Refresh counts
    this.updateTableWidth();
    setTimeout(() => {
      if (this.resizeObserver) {
        if (this.tableWrapper?.nativeElement) this.resizeObserver.observe(this.tableWrapper.nativeElement);
        if (this.dataTableEl?.nativeElement) this.resizeObserver.observe(this.dataTableEl.nativeElement);
      }
    }, 100);
  }

  loadLeadsForCampaign(campaignId: number): void {
    this.leadsLoading = true;
    this.campaignService.getCampaignLeads(campaignId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.campaignLeads = res.data;
        }
        this.leadsLoading = false;
        this.updateTableWidth();
        this.cdr.markForCheck();
      },
      error: () => {
        this.leadsLoading = false;
        this.showToast('Failed to load leads for this campaign.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  loadExpensesForCampaign(campaignId: number): void {
    this.expensesLoading = true;
    this.campaignService.getCampaignExpenses(campaignId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.campaignExpenses = res.data;
        }
        this.expensesLoading = false;
        this.updateTableWidth();
        this.cdr.markForCheck();
      },
      error: () => {
        this.expensesLoading = false;
        this.showToast('Failed to load expenses for this campaign.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get filteredLeads(): CampaignLead[] {
    if (!this.leadSearchTerm.trim()) return this.campaignLeads;
    const term = this.leadSearchTerm.trim().toLowerCase();
    return this.campaignLeads.filter(l =>
      (l.leadName || '').toLowerCase().includes(term) ||
      (l.leadContact || '').toLowerCase().includes(term) ||
      (l.leadEmail || '').toLowerCase().includes(term) ||
      (l.leadLocation || '').toLowerCase().includes(term) ||
      (l.leadStatus || '').toLowerCase().includes(term) ||
      (l.leadHandler || '').toLowerCase().includes(term) ||
      (l.leadRemarks || '').toLowerCase().includes(term)
    );
  }

  get filteredExpenses(): CampaignExpense[] {
    if (!this.expenseSearchTerm.trim()) return this.campaignExpenses;
    const term = this.expenseSearchTerm.trim().toLowerCase();
    return this.campaignExpenses.filter(e =>
      (e.purpose || '').toLowerCase().includes(term) ||
      (e.expenseDate || '').toLowerCase().includes(term) ||
      (e.amount?.toString() || '').includes(term)
    );
  }

  get totalExpenseSum(): number {
    return this.campaignExpenses.reduce((sum, e) => sum + (parseFloat(e.amount as any) || 0), 0);
  }

  // --- CAMPAIGN CRUD & MODAL HANDLERS ---
  openAddCampaignModal(): void {
    if (!this.canAdd()) {
      this.showToast('Permission denied: You cannot add campaigns.', 'info');
      return;
    }
    this.isEditCampaignMode = false;
    this.campaignForm = this.getEmptyCampaign();
    this.resetModalLeadForm();
    this.resetModalExpenseForm();
    this.isCampaignModalOpen = true;
  }

  openEditCampaignModal(campaign: Campaign): void {
    if (!this.canEdit()) {
      this.showToast('Permission denied: You cannot edit campaigns.', 'info');
      return;
    }
    this.isEditCampaignMode = true;
    this.campaignForm = { ...campaign };
    this.selectedCampaign = campaign;
    this.resetModalLeadForm();
    this.resetModalExpenseForm();

    if (campaign.id) {
      this.loadLeadsForCampaign(campaign.id);
      this.loadExpensesForCampaign(campaign.id);
    }

    this.isCampaignModalOpen = true;
  }

  closeCampaignModal(): void {
    this.isCampaignModalOpen = false;
    this.campaignForm = this.getEmptyCampaign();
    this.resetModalLeadForm();
    this.resetModalExpenseForm();
  }

  onCampaignModalSectionChange(): void {
    if (this.campaignModalSection === 'leads') {
      this.resetModalLeadForm();
    } else if (this.campaignModalSection === 'expenses') {
      this.resetModalExpenseForm();
    }
  }

  resetModalLeadForm(): void {
    this.modalLeadToEdit = null;
    this.isEditLeadInModal = false;
    this.leadForm = this.getEmptyLead();
    if (this.campaignForm.id) {
      this.leadForm.campaignId = this.campaignForm.id;
    }
  }

  editLeadInModal(lead: CampaignLead): void {
    if (!this.canEdit()) {
      this.showToast('Permission denied: You cannot edit leads.', 'info');
      return;
    }
    this.modalLeadToEdit = lead;
    this.isEditLeadInModal = true;
    this.leadForm = { ...lead };
  }

  saveLeadInModal(): void {
    if (this.isEditLeadInModal && !this.canEdit()) {
      this.showToast('Permission denied: You cannot edit leads.', 'danger');
      return;
    }
    if (!this.isEditLeadInModal && !this.canAdd()) {
      this.showToast('Permission denied: You cannot add leads.', 'danger');
      return;
    }
    if (!this.leadForm.leadName?.trim()) {
      this.showToast('Lead Name is required.', 'danger');
      return;
    }
    const campaignId = this.campaignForm.id;
    if (!campaignId) return;

    if (this.isEditLeadInModal && this.modalLeadToEdit?.id) {
      this.campaignService.updateCampaignLead(this.modalLeadToEdit.id, this.leadForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.campaignLeads.findIndex(l => l.id === this.modalLeadToEdit!.id);
            if (idx !== -1) {
              this.campaignLeads[idx] = res.data;
            }
            this.showToast('Lead updated successfully!', 'success');
            this.resetModalLeadForm();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update lead.', 'danger')
      });
    } else {
      this.campaignService.createCampaignLead(campaignId, this.leadForm).subscribe({
        next: (res) => {
          if (res.success) {
            this.campaignLeads.unshift(res.data);
            const cIdx = this.campaigns.findIndex(c => c.id === campaignId);
            if (cIdx !== -1) {
              this.campaigns[cIdx].leadCount = (this.campaigns[cIdx].leadCount || 0) + 1;
            }
            this.salesService.clearCache();
            this.showToast(`Lead '${res.data.leadName}' recorded in Campaign & automatically added to Leads!`, 'success');
            this.resetModalLeadForm();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add lead.', 'danger')
      });
    }
  }

  deleteLeadInModal(lead: CampaignLead): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete leads.', 'info');
      return;
    }
    if (!lead.id) return;
    if (!confirm(`Delete lead "${lead.leadName}"?`)) return;
    this.campaignService.deleteCampaignLead(lead.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.campaignLeads = this.campaignLeads.filter(l => l.id !== lead.id);
          const cIdx = this.campaigns.findIndex(c => c.id === this.campaignForm.id);
          if (cIdx !== -1 && this.campaigns[cIdx].leadCount) {
            this.campaigns[cIdx].leadCount!--;
          }
          if (this.modalLeadToEdit?.id === lead.id) {
            this.resetModalLeadForm();
          }
          this.showToast('Lead deleted.', 'success');
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete lead.', 'danger')
    });
  }

  resetModalExpenseForm(): void {
    this.modalExpenseToEdit = null;
    this.isEditExpenseInModal = false;
    this.expenseForm = this.getEmptyExpense();
    if (this.campaignForm.id) {
      this.expenseForm.campaignId = this.campaignForm.id;
    }
  }

  editExpenseInModal(expense: CampaignExpense): void {
    if (!this.canEdit()) {
      this.showToast('Permission denied: You cannot edit expenses.', 'info');
      return;
    }
    this.modalExpenseToEdit = expense;
    this.isEditExpenseInModal = true;
    this.expenseForm = { ...expense };
  }

  saveExpenseInModal(): void {
    if (this.isEditExpenseInModal && !this.canEdit()) {
      this.showToast('Permission denied: You cannot edit expenses.', 'danger');
      return;
    }
    if (!this.isEditExpenseInModal && !this.canAdd()) {
      this.showToast('Permission denied: You cannot add expenses.', 'danger');
      return;
    }
    if (!this.expenseForm.amount) {
      this.showToast('Expense Amount is required.', 'danger');
      return;
    }
    const campaignId = this.campaignForm.id;
    if (!campaignId) return;

    if (this.isEditExpenseInModal && this.modalExpenseToEdit?.id) {
      this.campaignService.updateCampaignExpense(this.modalExpenseToEdit.id, this.expenseForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.campaignExpenses.findIndex(e => e.id === this.modalExpenseToEdit!.id);
            if (idx !== -1) {
              this.campaignExpenses[idx] = res.data;
            }
            this.recalcCampaignExpenseStats(campaignId);
            this.showToast('Expense updated successfully!', 'success');
            this.resetModalExpenseForm();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update expense.', 'danger')
      });
    } else {
      this.campaignService.createCampaignExpense(campaignId, this.expenseForm).subscribe({
        next: (res) => {
          if (res.success) {
            this.campaignExpenses.unshift(res.data);
            this.recalcCampaignExpenseStats(campaignId);
            this.showToast('Expense added to campaign successfully!', 'success');
            this.resetModalExpenseForm();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add expense.', 'danger')
      });
    }
  }

  deleteExpenseInModal(expense: CampaignExpense): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete expenses.', 'info');
      return;
    }
    if (!expense.id) return;
    if (!confirm(`Delete expense ₹${expense.amount}?`)) return;
    this.campaignService.deleteCampaignExpense(expense.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.campaignExpenses = this.campaignExpenses.filter(e => e.id !== expense.id);
          this.recalcCampaignExpenseStats(this.campaignForm.id!);
          if (this.modalExpenseToEdit?.id === expense.id) {
            this.resetModalExpenseForm();
          }
          this.showToast('Expense deleted.', 'success');
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete expense.', 'danger')
    });
  }

  private recalcCampaignExpenseStats(campaignId: number): void {
    const total = this.campaignExpenses.reduce((s, e) => s + (parseFloat(e.amount as any) || 0), 0);
    const cIdx = this.campaigns.findIndex(c => c.id === campaignId);
    if (cIdx !== -1) {
      this.campaigns[cIdx].expenseCount = this.campaignExpenses.length;
      this.campaigns[cIdx].totalExpenses = total;
    }
  }

  saveCampaign(): void {
    if (this.isEditCampaignMode && !this.canEdit()) {
      this.showToast('Permission denied: You cannot edit campaigns.', 'danger');
      return;
    }
    if (!this.isEditCampaignMode && !this.canAdd()) {
      this.showToast('Permission denied: You cannot add campaigns.', 'danger');
      return;
    }
    if (!this.campaignForm.campaignName?.trim() || !this.campaignForm.venue?.trim()) {
      this.showToast('Campaign Name and Venue are required.', 'danger');
      return;
    }

    if (this.isEditCampaignMode && this.campaignForm.id) {
      const campaignId = this.campaignForm.id;
      this.campaignService.updateCampaign(campaignId, this.campaignForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.campaigns.findIndex(c => c.id === campaignId);
            if (idx !== -1) {
              this.campaigns[idx] = { ...this.campaigns[idx], ...res.data };
            }
            if (this.selectedCampaign?.id === campaignId) {
              this.selectedCampaign = { ...this.selectedCampaign, ...res.data };
            }
            this.showToast('Campaign updated successfully!', 'success');
            this.closeCampaignModal();
            this.cdr.markForCheck();
          }
        },
        error: () => this.showToast('Failed to update campaign.', 'danger')
      });
    } else {
      this.campaignService.createCampaign(this.campaignForm).subscribe({
        next: (res) => {
          if (res.success && res.data?.id) {
            const newCampaign: Campaign = { ...res.data, leadCount: 0, expenseCount: 0, totalExpenses: 0 };
            this.campaigns.unshift(newCampaign);
            this.showToast('Campaign created successfully!', 'success');
            this.closeCampaignModal();
            this.cdr.markForCheck();
          }
        },
        error: () => this.showToast('Failed to create campaign.', 'danger')
      });
    }
  }

  confirmDeleteCampaign(campaign: Campaign): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete campaigns.', 'info');
      return;
    }
    this.campaignToDelete = campaign;
    this.isDeleteCampaignModalOpen = true;
  }

  closeDeleteCampaignModal(): void {
    this.isDeleteCampaignModalOpen = false;
    this.campaignToDelete = null;
  }

  deleteCampaign(): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete campaigns.', 'info');
      return;
    }
    if (!this.campaignToDelete?.id) return;
    const id = this.campaignToDelete.id;
    this.campaignService.deleteCampaign(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.campaigns = this.campaigns.filter(c => c.id !== id);
          this.showToast('Campaign deleted successfully.', 'success');
          this.closeDeleteCampaignModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete campaign.', 'danger')
    });
  }

  // --- LEADS CRUD ---
  openAddLeadModal(): void {
    if (!this.canAdd()) {
      this.showToast('Permission denied: You cannot add leads.', 'info');
      return;
    }
    if (!this.selectedCampaign) return;
    this.isEditLeadMode = false;
    this.leadForm = this.getEmptyLead();
    this.leadForm.campaignId = this.selectedCampaign.id;
    this.isLeadModalOpen = true;
  }

  openEditLeadModal(lead: CampaignLead): void {
    if (!this.canEdit()) {
      this.showToast('Permission denied: You cannot edit leads.', 'info');
      return;
    }
    this.isEditLeadMode = true;
    this.leadToEdit = lead;
    this.leadForm = { ...lead };
    this.isLeadModalOpen = true;
  }

  closeLeadModal(): void {
    this.isLeadModalOpen = false;
    this.leadToEdit = null;
    this.leadForm = this.getEmptyLead();
  }

  // --- QUALIFY CONFIRMATION WORKFLOW (CAMPAIGN LEADS -> SALES LEADS) ---
  promptQualifyCampaignLead(lead: CampaignLead, oldStatus?: string, formData?: Partial<CampaignLead>, selectEl?: HTMLSelectElement): void {
    this.pendingQualifyCampaignLead = lead;
    this.pendingQualifyCampaignLeadForm = formData || null;
    this.pendingCampaignSelectEl = selectEl;
    this.previousCampaignLeadStatus = oldStatus || 'On hold';
    this.isQualifyCampaignLeadModalOpen = true;
    this.cdr.markForCheck();
  }

  cancelQualifyCampaignLead(): void {
    const prev = this.previousCampaignLeadStatus || 'On hold';
    if (this.pendingQualifyCampaignLead) {
      this.pendingQualifyCampaignLead.leadStatus = prev;
    }
    if (this.pendingCampaignSelectEl) {
      this.pendingCampaignSelectEl.value = prev;
    }
    this.isQualifyCampaignLeadModalOpen = false;
    this.pendingQualifyCampaignLead = null;
    this.pendingCampaignSelectEl = undefined;
    this.pendingQualifyCampaignLeadForm = null;
    this.cdr.detectChanges();
  }

  confirmQualifyCampaignLeadYes(): void {
    if (!this.pendingQualifyCampaignLead?.id) return;
    const lead = this.pendingQualifyCampaignLead;
    const leadId = lead.id;
    if (!leadId) return;
    const oldStatus = this.previousCampaignLeadStatus;

    const payload: Partial<CampaignLead> = this.pendingQualifyCampaignLeadForm
      ? { ...this.pendingQualifyCampaignLeadForm, leadStatus: 'Qualify' }
      : { leadStatus: 'Qualify' };

    lead.leadStatus = 'Qualify';
    if (this.pendingCampaignSelectEl) {
      this.pendingCampaignSelectEl.value = 'Qualify';
    }
    this.campaignService.updateCampaignLead(leadId, payload).subscribe({
      next: (res) => {
        if (res.success) {
          const idx = this.campaignLeads.findIndex(l => l.id === lead.id);
          if (idx !== -1) {
            this.campaignLeads[idx] = res.data;
          }
          this.salesService.clearCache();
          if (res.transferredToSales) {
            this.showToast(`Lead '${lead.leadName}' qualified! Transferred to Leads as 'New' (Handler: ${res.data?.leadHandler || lead.leadHandler || 'Renuka'}).`, 'success');
          } else {
            this.showToast(`Lead '${lead.leadName}' marked as Qualify.`, 'success');
          }
        }
        this.isQualifyCampaignLeadModalOpen = false;
        this.pendingQualifyCampaignLead = null;
        this.pendingCampaignSelectEl = undefined;
        this.pendingQualifyCampaignLeadForm = null;
        this.cdr.markForCheck();
      },
      error: () => {
        lead.leadStatus = oldStatus;
        if (this.pendingCampaignSelectEl) {
          this.pendingCampaignSelectEl.value = oldStatus;
        }
        this.showToast('Failed to qualify lead.', 'danger');
        this.isQualifyCampaignLeadModalOpen = false;
        this.pendingQualifyCampaignLead = null;
        this.pendingCampaignSelectEl = undefined;
        this.pendingQualifyCampaignLeadForm = null;
        this.cdr.markForCheck();
      }
    });
  }

  onCampaignLeadStatusChange(lead: CampaignLead, newStatus: string, selectEl?: HTMLSelectElement): void {
    if (!this.canEdit()) {
      if (selectEl) selectEl.value = lead.leadStatus || '';
      this.showToast('Permission denied: You cannot edit leads.', 'info');
      return;
    }
    if (!lead.id || lead.leadStatus === newStatus) return;
    const oldStatus = lead.leadStatus;

    // Prompt confirmation before qualifying and transferring to Sales Leads
    if (newStatus === 'Qualify') {
      lead.leadStatus = newStatus;
      this.pendingCampaignSelectEl = selectEl;
      this.promptQualifyCampaignLead(lead, oldStatus, undefined, selectEl);
      return;
    }

    lead.leadStatus = newStatus;

    this.campaignService.updateCampaignLead(lead.id, { leadStatus: newStatus }).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast(`Lead '${lead.leadName}' status updated to '${newStatus}'.`, 'info');
        }
        this.cdr.markForCheck();
      },
      error: () => {
        lead.leadStatus = oldStatus;
        this.showToast('Failed to update lead status.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  saveLead(): void {
    if (this.isEditLeadMode && !this.canEdit()) {
      this.showToast('Permission denied: You cannot edit leads.', 'danger');
      return;
    }
    if (!this.isEditLeadMode && !this.canAdd()) {
      this.showToast('Permission denied: You cannot add leads.', 'danger');
      return;
    }
    if (!this.leadForm.leadName?.trim()) {
      this.showToast('Lead Name is required.', 'danger');
      return;
    }

    if (this.isEditLeadMode && this.leadToEdit?.id) {
      const oldStatus = this.leadToEdit.leadStatus || 'On hold';
      const newStatus = this.leadForm.leadStatus || 'On hold';

      // If user selected Qualify in edit modal, prompt confirmation
      if (oldStatus !== 'Qualify' && newStatus === 'Qualify') {
        const leadRef = { ...this.leadToEdit, ...this.leadForm } as CampaignLead;
        this.closeLeadModal();
        this.promptQualifyCampaignLead(leadRef, oldStatus, this.leadForm);
        return;
      }

      this.campaignService.updateCampaignLead(this.leadToEdit.id, this.leadForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.campaignLeads.findIndex(l => l.id === this.leadToEdit!.id);
            if (idx !== -1) {
              this.campaignLeads[idx] = res.data;
            }
            this.salesService.clearCache();
            this.showToast(`Lead '${res.data.leadName}' updated in Campaign & synced to Leads!`, 'success');
            this.closeLeadModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update lead.', 'danger')
      });
    } else {
      if (!this.selectedCampaign?.id) return;
      this.campaignService.createCampaignLead(this.selectedCampaign.id, this.leadForm).subscribe({
        next: (res) => {
          if (res.success) {
            this.campaignLeads.unshift(res.data);
            if (this.selectedCampaign) {
              this.selectedCampaign.leadCount = (this.selectedCampaign.leadCount || 0) + 1;
            }
            this.salesService.clearCache();
            this.showToast(`Lead '${res.data.leadName}' recorded in Campaign & automatically added to Leads!`, 'success');
            this.closeLeadModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add lead.', 'danger')
      });
    }
  }

  confirmDeleteLead(lead: CampaignLead): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete leads.', 'info');
      return;
    }
    this.leadToDelete = lead;
    this.isDeleteLeadModalOpen = true;
  }

  closeDeleteLeadModal(): void {
    this.isDeleteLeadModalOpen = false;
    this.leadToDelete = null;
  }

  deleteLead(): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete leads.', 'info');
      return;
    }
    if (!this.leadToDelete?.id) return;
    const id = this.leadToDelete.id;
    this.campaignService.deleteCampaignLead(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.campaignLeads = this.campaignLeads.filter(l => l.id !== id);
          if (this.selectedCampaign && this.selectedCampaign.leadCount) {
            this.selectedCampaign.leadCount--;
          }
          this.showToast('Lead deleted.', 'success');
          this.closeDeleteLeadModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete lead.', 'danger')
    });
  }

  // --- EXPENSES CRUD ---
  openAddExpenseModal(): void {
    if (!this.canAdd()) {
      this.showToast('Permission denied: You cannot add expenses.', 'info');
      return;
    }
    if (!this.selectedCampaign) return;
    this.isEditExpenseMode = false;
    this.expenseForm = this.getEmptyExpense();
    this.expenseForm.campaignId = this.selectedCampaign.id;
    this.isExpenseModalOpen = true;
  }

  openEditExpenseModal(expense: CampaignExpense): void {
    if (!this.canEdit()) {
      this.showToast('Permission denied: You cannot edit expenses.', 'info');
      return;
    }
    this.isEditExpenseMode = true;
    this.expenseToEdit = expense;
    this.expenseForm = { ...expense };
    this.isExpenseModalOpen = true;
  }

  closeExpenseModal(): void {
    this.isExpenseModalOpen = false;
    this.expenseToEdit = null;
    this.expenseForm = this.getEmptyExpense();
  }

  saveExpense(): void {
    if (this.isEditExpenseMode && !this.canEdit()) {
      this.showToast('Permission denied: You cannot edit expenses.', 'danger');
      return;
    }
    if (!this.isEditExpenseMode && !this.canAdd()) {
      this.showToast('Permission denied: You cannot add expenses.', 'danger');
      return;
    }
    if (!this.expenseForm.purpose?.trim()) {
      this.showToast('Expense Purpose is required.', 'danger');
      return;
    }
    if (!this.expenseForm.amount || this.expenseForm.amount <= 0) {
      this.showToast('Please enter a valid amount.', 'danger');
      return;
    }

    if (this.isEditExpenseMode && this.expenseToEdit?.id) {
      this.campaignService.updateCampaignExpense(this.expenseToEdit.id, this.expenseForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.campaignExpenses.findIndex(e => e.id === this.expenseToEdit!.id);
            if (idx !== -1) {
              this.campaignExpenses[idx] = res.data;
            }
            this.showToast('Expense updated successfully!', 'success');
            this.closeExpenseModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update expense.', 'danger')
      });
    } else {
      if (!this.selectedCampaign?.id) return;
      this.campaignService.createCampaignExpense(this.selectedCampaign.id, this.expenseForm).subscribe({
        next: (res) => {
          if (res.success) {
            this.campaignExpenses.unshift(res.data);
            if (this.selectedCampaign) {
              this.selectedCampaign.expenseCount = (this.selectedCampaign.expenseCount || 0) + 1;
              this.selectedCampaign.totalExpenses = (this.selectedCampaign.totalExpenses || 0) + parseFloat(res.data.amount as any);
            }
            this.showToast('Expense added successfully!', 'success');
            this.closeExpenseModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add expense.', 'danger')
      });
    }
  }

  confirmDeleteExpense(expense: CampaignExpense): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete expenses.', 'info');
      return;
    }
    this.expenseToDelete = expense;
    this.isDeleteExpenseModalOpen = true;
  }

  closeDeleteExpenseModal(): void {
    this.isDeleteExpenseModalOpen = false;
    this.expenseToDelete = null;
  }

  deleteExpense(): void {
    if (!this.canDelete()) {
      this.showToast('Permission denied: You cannot delete expenses.', 'info');
      return;
    }
    if (!this.expenseToDelete?.id) return;
    const id = this.expenseToDelete.id;
    this.campaignService.deleteCampaignExpense(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.campaignExpenses = this.campaignExpenses.filter(e => e.id !== id);
          if (this.selectedCampaign && this.selectedCampaign.expenseCount) {
            this.selectedCampaign.expenseCount--;
          }
          this.showToast('Expense deleted.', 'success');
          this.closeDeleteExpenseModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete expense.', 'danger')
    });
  }

  // --- HELPERS ---
  getEmptyCampaign(): Partial<Campaign> {
    return {
      campaignDate: new Date().toISOString().substring(0, 10),
      campaignName: '',
      venue: ''
    };
  }

  getEmptyLead(): Partial<CampaignLead> {
    return {
      leadDate: new Date().toISOString().substring(0, 10),
      leadName: '',
      leadContact: '',
      leadEmail: '',
      leadLocation: '',
      leadStatus: 'On hold',
      leadHandler: 'Renuka',
      leadRemarks: ''
    };
  }

  getEmptyExpense(): Partial<CampaignExpense> {
    return {
      expenseDate: new Date().toISOString().substring(0, 10),
      amount: null as any,
      purpose: ''
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
    const clean = dateStr.substring(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return clean;
  }

  canAdd(): boolean {
    return this.authService.canAdd('sales');
  }

  canEdit(): boolean {
    return this.authService.canEdit('sales');
  }

  canDelete(): boolean {
    return this.authService.canDelete('sales');
  }

  exportLeadsPdf(): void {
    if (!this.selectedCampaign) return;
    const leads = this.filteredLeads;
    if (leads.length === 0) {
      this.showToast('No leads available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - CAMPAIGN LEADS REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Campaign: ${this.selectedCampaign.campaignName} | Venue: ${this.selectedCampaign.venue || '—'} | Date: ${this.formatDate(this.selectedCampaign.campaignDate)} | Total Leads: ${leads.length} | Exported: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Lead Date', 'Lead Name', 'Contact No', 'Email ID', 'Location', 'Status', 'Lead Handler', 'Remarks']
    ];

    const body = leads.map((l, idx) => [
      idx + 1,
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
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    const safeName = (this.selectedCampaign.campaignName || 'Campaign').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeName}_Leads_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Campaign Leads PDF exported successfully!', 'success');
  }

  exportExpensesPdf(): void {
    if (!this.selectedCampaign) return;
    const expenses = this.filteredExpenses;
    if (expenses.length === 0) {
      this.showToast('No expenses available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(225, 29, 72);
    doc.text('SOLAR SATHLOKHAR - CAMPAIGN EXPENSES REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Campaign: ${this.selectedCampaign.campaignName} | Venue: ${this.selectedCampaign.venue || '—'} | Total Expense: ₹ ${this.totalExpenseSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Exported: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Date', 'Amount (₹)', 'Purpose / Expense Details']
    ];

    const body = expenses.map((e, idx) => [
      idx + 1,
      this.formatDate(e.expenseDate),
      parseFloat(e.amount as any || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      e.purpose || ''
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' } },
      alternateRowStyles: { fillColor: [255, 241, 242] }
    });

    const safeName = (this.selectedCampaign.campaignName || 'Campaign').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeName}_Expenses_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Campaign Expenses PDF exported successfully!', 'success');
  }

  exportCampaignsPdf(): void {
    const list = this.filteredCampaigns;
    if (list.length === 0) {
      this.showToast('No campaigns available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - MARKETING CAMPAIGNS SUMMARY', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Campaigns: ${list.length} | Exported: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Date', 'Campaign Name', 'Place / Venue', 'Leads Count', 'Expenses Count', 'Total Expenses (₹)']
    ];

    const body = list.map((c, idx) => [
      idx + 1,
      this.formatDate(c.campaignDate),
      c.campaignName || '',
      c.venue || '',
      c.leadCount || 0,
      c.expenseCount || 0,
      parseFloat(c.totalExpenses as any || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Campaigns_Summary_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Campaigns Summary PDF exported successfully!', 'success');
  }
}
