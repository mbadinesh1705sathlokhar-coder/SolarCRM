import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CampaignService, Campaign, CampaignExpense } from '../../../services/campaign.service';
import { OfficeService } from '../../../services/office.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-expo-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './expo-expenses.component.html',
  styleUrls: ['./expo-expenses.component.css']
})
export class ExpoExpensesComponent implements OnInit {
  private campaignService = inject(CampaignService);
  private officeService = inject(OfficeService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  expenses: CampaignExpense[] = [];
  campaigns: Campaign[] = [];
  loading = false;
  searchQuery = '';

  // Pagination
  currentPage = 1;
  pageSize = 15;

  // Add / Edit Modal
  isModalOpen = false;
  isEditMode = false;
  editingId: number | null = null;

  formData = {
    dateInput: '', // dd-mm-yyyy
    campaignId: null as number | null,
    campaignName: '',
    purpose: '',
    paidBy: 'OFFICE',
    amount: null as number | null
  };

  // Paid By options
  paidByOptions: string[] = ['OFFICE'];

  // Delete modal
  isDeleteModalOpen = false;
  expenseToDelete: CampaignExpense | null = null;

  // Alert toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  ngOnInit(): void {
    this.formData.dateInput = this.getTodayDisplayDate();
    this.loadCampaigns();
    this.loadExpenses();
    this.loadEmployees();
  }

  canAdd(): boolean {
    return this.authService.canAdd('expo-expenses') || this.authService.isAdmin();
  }

  canEdit(): boolean {
    return this.authService.canEdit('expo-expenses') || this.authService.isAdmin();
  }

  canDelete(): boolean {
    return this.authService.canDelete('expo-expenses') || this.authService.isAdmin();
  }

  loadCampaigns(): void {
    this.campaignService.getCampaigns().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.campaigns = res.data;
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadExpenses(): void {
    this.loading = true;
    this.campaignService.getAllExpenses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.expenses = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching expo expenses:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadEmployees(): void {
    this.officeService.getEmployees().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const names = res.data.map(e => e.name).filter(Boolean);
          this.paidByOptions = Array.from(new Set(['OFFICE', ...names]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  // --- FILTERS & METRICS ---
  get filteredExpenses(): CampaignExpense[] {
    let list = this.expenses;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(e =>
        (e.campaignName || '').toLowerCase().includes(q) ||
        (e.purpose || '').toLowerCase().includes(q) ||
        (e.paidBy || '').toLowerCase().includes(q) ||
        (e.expenseDate || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  get paginatedExpenses(): CampaignExpense[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredExpenses.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredExpenses.length / this.pageSize) || 1;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get totalExpenseAmount(): number {
    return this.filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  get distinctExpoCount(): number {
    const names = new Set(this.filteredExpenses.map(e => (e.campaignName || '').trim()).filter(Boolean));
    return names.size;
  }

  // --- MODAL ACTIONS ---
  openAddModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      campaignId: this.campaigns.length > 0 ? (this.campaigns[0].id || null) : null,
      campaignName: this.campaigns.length > 0 ? this.campaigns[0].campaignName : '',
      purpose: '',
      paidBy: 'OFFICE',
      amount: null
    };
    this.isModalOpen = true;
  }

  openEditModal(e: CampaignExpense): void {
    this.isEditMode = true;
    this.editingId = e.id || null;
    this.formData = {
      dateInput: this.toDisplayDate(e.expenseDate),
      campaignId: e.campaignId,
      campaignName: e.campaignName || '',
      purpose: e.purpose,
      paidBy: e.paidBy || 'OFFICE',
      amount: Number(e.amount) || null
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingId = null;
  }

  onCampaignSelectChange(campaignIdVal: any): void {
    const cid = Number(campaignIdVal);
    const selected = this.campaigns.find(c => c.id === cid);
    if (selected) {
      this.formData.campaignName = selected.campaignName;
    }
  }

  submitExpense(): void {
    if (!this.formData.purpose.trim()) {
      this.showToast('Please enter an expense description/purpose', 'danger');
      return;
    }
    if (!this.formData.amount || this.formData.amount <= 0) {
      this.showToast('Please enter a valid expense amount', 'danger');
      return;
    }

    const isoDate = this.toIsoDate(this.formData.dateInput);

    if (this.isEditMode && this.editingId) {
      const payload: Partial<CampaignExpense> = {
        campaignId: this.formData.campaignId || undefined,
        expenseDate: isoDate,
        amount: Number(this.formData.amount),
        purpose: this.formData.purpose.trim(),
        paidBy: this.formData.paidBy
      };

      this.campaignService.updateCampaignExpense(this.editingId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast('Expo expense updated successfully!', 'success');
            this.closeModal();
            this.loadExpenses();
          }
        },
        error: (err) => {
          this.showToast('Failed to update expense', 'danger');
        }
      });
    } else {
      const payload = {
        campaignId: this.formData.campaignId || undefined,
        campaignName: this.formData.campaignName.trim(),
        expenseDate: isoDate,
        amount: Number(this.formData.amount),
        purpose: this.formData.purpose.trim(),
        paidBy: this.formData.paidBy
      };

      this.campaignService.createExpoExpense(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast('Expo expense recorded successfully!', 'success');
            this.closeModal();
            this.loadExpenses();
          }
        },
        error: (err) => {
          this.showToast('Failed to record expo expense', 'danger');
        }
      });
    }
  }

  // --- DELETE MODAL ---
  confirmDelete(e: CampaignExpense): void {
    this.expenseToDelete = e;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.expenseToDelete = null;
  }

  executeDelete(): void {
    if (!this.expenseToDelete?.id) return;
    const id = this.expenseToDelete.id;

    this.campaignService.deleteCampaignExpense(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Expo expense deleted successfully', 'success');
          this.closeDeleteModal();
          this.loadExpenses();
        }
      },
      error: () => {
        this.showToast('Failed to delete expense', 'danger');
      }
    });
  }

  // --- PDF EXPORT ---
  exportPdf(): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
    const accentColor: [number, number, number] = [185, 28, 28]; // Danger red

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('SOLAR SATHLOKHAR - EXPO EXPENSES LEDGER', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Total Incurred: Rs. ${this.totalExpenseAmount.toLocaleString('en-IN')}`, 14, 25);

    const tableRows = this.filteredExpenses.map((e, index) => [
      index + 1,
      this.toDisplayDate(e.expenseDate),
      e.campaignName || 'Expo Event',
      e.purpose || '—',
      e.paidBy || 'OFFICE',
      `Rs. ${(Number(e.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Date', 'Expo Name', 'Descriptions', 'Paid By', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 45 },
        3: { cellWidth: 60 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`Expo_Expenses_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
    this.showToast('PDF downloaded successfully!', 'info');
  }

  // --- DATE HELPERS ---
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

  showToast(msg: string, type: 'success' | 'danger' | 'info'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 3500);
  }
}
