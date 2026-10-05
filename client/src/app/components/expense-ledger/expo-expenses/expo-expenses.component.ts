import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
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

  // View Mode: 'summary' (Overview of Date, Expo Name, Amount) or 'detail' (Specific Expo Expenses Sheet)
  viewMode: 'summary' | 'detail' = 'summary';
  selectedCampaign: Campaign | null = null;

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

  isAdmin(): boolean {
    return this.authService.isAdmin();
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

  // --- EXPO SUMMARY LIST (Date, Expo Name, Amount) ---
  get expoSummaryList(): { campaign: Campaign; id: number; date: string; expoName: string; venue: string; amount: number; voucherCount: number }[] {
    const q = (this.searchQuery || '').toLowerCase().trim();
    return this.campaigns.map(c => {
      const cExpenses = this.expenses.filter(e =>
        e.campaignId === c.id ||
        (e.campaignName || '').toLowerCase().trim() === (c.campaignName || '').toLowerCase().trim()
      );
      const totalAmount = cExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const displayDate = cExpenses.length > 0 && cExpenses[0].expenseDate ? cExpenses[0].expenseDate : (c.campaignDate || '');
      return {
        campaign: c,
        id: c.id || 0,
        date: displayDate,
        expoName: c.campaignName,
        venue: c.venue || '',
        amount: totalAmount,
        voucherCount: cExpenses.length
      };
    }).filter(item => {
      if (!q) return true;
      return (item.expoName || '').toLowerCase().includes(q) || (item.venue || '').toLowerCase().includes(q);
    });
  }

  get selectedCampaignTotal(): number {
    return this.filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  // --- FILTERS & METRICS ---
  get activeExpenses(): CampaignExpense[] {
    if (this.selectedCampaign) {
      return this.expenses.filter(e =>
        e.campaignId === this.selectedCampaign?.id ||
        (e.campaignName || '').toLowerCase().trim() === (this.selectedCampaign?.campaignName || '').toLowerCase().trim()
      );
    }
    return this.filteredExpenses;
  }

  get filteredExpenses(): CampaignExpense[] {
    let list = this.expenses;
    if (this.selectedCampaign) {
      list = list.filter(e =>
        e.campaignId === this.selectedCampaign?.id ||
        (e.campaignName || '').toLowerCase().trim() === (this.selectedCampaign?.campaignName || '').toLowerCase().trim()
      );
    }
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
    return this.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  get distinctExpoCount(): number {
    return this.campaigns.length;
  }

  selectExpo(campaign: Campaign): void {
    this.selectedCampaign = campaign;
    this.viewMode = 'detail';
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  showSummaryView(): void {
    this.selectedCampaign = null;
    this.viewMode = 'summary';
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  // --- MODAL ACTIONS ---
  openAddModal(presetCampaign?: Campaign): void {
    this.isEditMode = false;
    this.editingId = null;
    const targetCamp = presetCampaign || this.selectedCampaign || (this.campaigns.length > 0 ? this.campaigns[0] : null);
    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      campaignId: targetCamp ? (targetCamp.id || null) : null,
      campaignName: targetCamp ? targetCamp.campaignName : '',
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

  exportToExcel(): void {
    const list = this.filteredExpenses;
    if (list.length === 0) return;
    const headers = ['#', 'Date', 'Expo Name', 'Descriptions', 'Paid By', 'Amount (₹)'];
    const rows = list.map((e, idx) => [
      idx + 1,
      `"${this.toDisplayDate(e.expenseDate)}"`,
      `"${e.campaignName || ''}"`,
      `"${e.purpose || ''}"`,
      `"${e.paidBy || 'OFFICE'}"`,
      e.amount || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expo_Expenses_Ledger_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportPdf();
    setTimeout(() => {
      this.exportToExcel();
    }, 450);
  }

  @ViewChild('excelFileInput') excelFileInput!: ElementRef<HTMLInputElement>;

  triggerExcelImport(): void {
    if (this.excelFileInput) {
      this.excelFileInput.nativeElement.click();
    }
  }

  onExcelUploadSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.showToast(`Excel file "${file.name}" uploaded successfully!`, 'success');
      input.value = '';
    }
  }

  normalizeToIsoDate(val: any): string {
    if (!val) return new Date().toISOString().substring(0, 10);
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return new Date().toISOString().substring(0, 10);
      const yyyy = val.getFullYear();
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof val === 'number' || (typeof val === 'string' && /^\d{5}(\.\d+)?$/.test(val.trim()))) {
      const num = typeof val === 'number' ? val : parseFloat(val.trim());
      if (num > 10000 && num < 100000) {
        const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(jsDate.getTime())) {
          const yyyy = jsDate.getUTCFullYear();
          const mm = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(jsDate.getUTCDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    const str = String(val).trim().replace(/[T\s].*$/, '');
    if (!str) return new Date().toISOString().substring(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    if (str.includes('-') || str.includes('/') || str.includes('.')) {
      const isSlash = str.includes('/');
      const parts = str.split(/[-/.]/).map(p => p.trim());

      if (parts.length === 3) {
        let p0 = parseInt(parts[0], 10);
        let p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);

        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let year = p2;
          let month = 0;
          let day = 0;

          if (p0 > 1000) {
            year = p0;
            if (p1 > 12) { month = p2; day = p1; }
            else { month = p1; day = p2; }
          } else {
            if (year < 100) year += 2000;

            if (isSlash) {
              // Slash format default: MM/DD/YYYY (US format e.g. 7/31/2026, 4/13/2026)
              if (p0 > 12 && p1 <= 12) {
                day = p0;
                month = p1;
              } else {
                month = p0;
                day = p1;
              }
            } else {
              // Dash / Dot format default: DD-MM-YYYY (Indian format e.g. 04-10-2026, 04-09-2026)
              if (p1 > 12 && p0 <= 12) {
                month = p0;
                day = p1;
              } else {
                day = p0;
                month = p1;
              }
            }
          }

          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const yStr = String(year);
            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            return `${yStr}-${mStr}-${dStr}`;
          }
        }
      }
    }

    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return new Date().toISOString().substring(0, 10);
  }

  // --- DATE HELPERS ---
  toDisplayDate(isoStr: string | undefined | null): string {
    if (!isoStr) return '';
    const iso = this.normalizeToIsoDate(isoStr);
    if (!iso || iso.length < 10) return String(isoStr).trim();
    const parts = iso.substring(0, 10).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const yyyy = parts[0];
      const mm = parts[1].padStart(2, '0');
      const dd = parts[2].padStart(2, '0');
      return `${dd}-${mm}-${yyyy}`;
    }
    return String(isoStr).trim();
  }

  toIsoDate(inputStr: string | undefined): string {
    if (!inputStr) return new Date().toISOString().slice(0, 10);
    return this.normalizeToIsoDate(inputStr);
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
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }
  }

  openDatePicker(picker: HTMLInputElement): void {
    if (!picker) return;
    try {
      if (typeof picker.showPicker === 'function') {
        picker.showPicker();
      } else {
        picker.focus();
        picker.click();
      }
    } catch {
      try {
        picker.focus();
        picker.click();
      } catch (err) {
        console.error('Failed to open date picker:', err);
      }
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

  clearAllExpoExpenses(): void {
    if (confirm('Are you sure you want to clear ALL expo expense records? This will delete all current expo expenses so you can upload a clean Excel file.')) {
      this.campaignService.clearAllExpoExpenses().subscribe({
        next: () => {
          this.showToast('All expo expense records cleared successfully.', 'success');
          this.loadExpenses();
        },
        error: (err) => {
          this.showToast('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
