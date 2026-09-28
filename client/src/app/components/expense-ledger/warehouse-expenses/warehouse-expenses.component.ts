import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { SiteExpense } from '../../../models/project.model';
import { OfficeService } from '../../../services/office.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-warehouse-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './warehouse-expenses.component.html',
  styleUrls: ['./warehouse-expenses.component.css']
})
export class WarehouseExpensesComponent implements OnInit {
  private projectService = inject(ProjectService);
  private officeService = inject(OfficeService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  expenses: SiteExpense[] = [];
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
    paymentThrough: 'P.O',
    purpose: 'Consumables',
    paidBy: 'OFFICE',
    vendor: '',
    remarks: '',
    billVoucher: 'Submitted',
    invoiceNo: '',
    amount: null as number | null
  };

  paymentThroughOptions = ['P.O', 'Petty Cash', 'Accounts', 'W.O', '(Blanks)'];
  purposeOptions = [
    'Consumables',
    'Solar MMS',
    'Solar Panels',
    'Solar Inverters',
    'Solar Cables',
    'DB Boxes',
    'Earthing Materials',
    'Lightning Arrestors',
    'Material Transport',
    'Rental Tools',
    'Tools Asset',
    'Walkway / Hand Rails',
    'Cable Tray Materials',
    'Cables',
    'Labour/Manpower',
    'General Stock'
  ];

  paidByOptions: string[] = ['OFFICE'];
  vendorOptions: string[] = [];

  // Delete modal
  isDeleteModalOpen = false;
  expenseToDelete: SiteExpense | null = null;

  // Alert toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  ngOnInit(): void {
    this.formData.dateInput = this.getTodayDisplayDate();
    this.loadExpenses();
    this.loadVendorsFromOffice();
    this.loadEmployeesFromOffice();
  }

  canAdd(): boolean {
    return this.authService.canAdd('expense-ledger') || this.authService.isAdmin();
  }

  canEdit(): boolean {
    return this.authService.canEdit('expense-ledger') || this.authService.isAdmin();
  }

  canDelete(): boolean {
    return this.authService.canDelete('expense-ledger') || this.authService.isAdmin();
  }

  loadVendorsFromOffice(): void {
    this.officeService.getVendors().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const names = res.data.map(v => v.vendorName).filter(Boolean);
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
          this.paidByOptions = Array.from(new Set(['OFFICE', ...names]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadExpenses(): void {
    this.loading = true;
    this.projectService.getExpenses({ siteId: 'WAREHOUSE' }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.expenses = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching warehouse expenses:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredExpenses(): SiteExpense[] {
    let list = this.expenses;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(e =>
        (e.purpose || '').toLowerCase().includes(q) ||
        (e.paidBy || '').toLowerCase().includes(q) ||
        (e.vendorName || '').toLowerCase().includes(q) ||
        (e.remarks || '').toLowerCase().includes(q) ||
        (e.paymentThrough || '').toLowerCase().includes(q) ||
        (e.expenseDate || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  get paginatedExpenses(): SiteExpense[] {
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

  // --- MODAL ACTIONS ---
  openAddModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      paymentThrough: 'P.O',
      purpose: 'Consumables',
      paidBy: 'OFFICE',
      vendor: '',
      remarks: 'Material stock received in Central Warehouse',
      billVoucher: 'Submitted',
      invoiceNo: '',
      amount: null
    };
    this.isModalOpen = true;
  }

  openEditModal(e: SiteExpense): void {
    this.isEditMode = true;
    this.editingId = e.id || null;
    this.formData = {
      dateInput: e.formattedDate || this.toDisplayDate(e.expenseDate),
      paymentThrough: e.paymentThrough || 'P.O',
      purpose: e.purpose || 'Consumables',
      paidBy: e.paidBy || 'OFFICE',
      vendor: e.vendorName || '',
      remarks: e.remarks || '',
      billVoucher: e.billVoucher || 'Submitted',
      invoiceNo: e.invoiceNo || '',
      amount: Number(e.amount) || null
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingId = null;
  }

  submitExpense(): void {
    if (!this.formData.amount || this.formData.amount <= 0) {
      this.showToast('Please enter a valid positive expense amount', 'danger');
      return;
    }

    const isoDate = this.toIsoDate(this.formData.dateInput);
    const mop = this.deriveMoPFromDate(this.formData.dateInput);

    const payload: Partial<SiteExpense> = {
      siteId: 'WAREHOUSE',
      clientName: 'Warehouse : Sathlokhar H.O',
      clientSiteName: 'Warehouse : Sathlokhar H.O',
      expenseDate: isoDate,
      mop,
      amount: Number(this.formData.amount),
      paymentThrough: this.formData.paymentThrough,
      purpose: this.formData.purpose,
      paidBy: this.formData.paidBy,
      vendorName: this.formData.vendor || '',
      remarks: this.formData.remarks || '',
      billVoucher: this.formData.billVoucher || 'Submitted',
      invoiceNo: this.formData.billVoucher === 'Submitted' ? (this.formData.invoiceNo || '') : ''
    };

    if (this.isEditMode && this.editingId) {
      this.projectService.updateExpense(this.editingId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast('Warehouse expense updated successfully!', 'success');
            this.closeModal();
            this.loadExpenses();
          }
        },
        error: () => this.showToast('Failed to update expense', 'danger')
      });
    } else {
      this.projectService.createExpense(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast('Warehouse expense recorded successfully!', 'success');
            this.closeModal();
            this.loadExpenses();
          }
        },
        error: () => this.showToast('Failed to record expense', 'danger')
      });
    }
  }

  // --- DELETE MODAL ---
  confirmDelete(e: SiteExpense): void {
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

    this.projectService.deleteExpense(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Expense record deleted successfully', 'success');
          this.closeDeleteModal();
          this.loadExpenses();
        }
      },
      error: () => this.showToast('Failed to delete expense', 'danger')
    });
  }

  // --- PDF EXPORT ---
  exportPdf(): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const primaryColor: [number, number, number] = [15, 23, 42];
    const accentColor: [number, number, number] = [37, 99, 235]; // Primary blue

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('SOLAR SATHLOKHAR - WAREHOUSE EXPENSES LEDGER', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Facility: Sathlokhar H.O Central Store | Total Incurred: Rs. ${this.totalExpenseAmount.toLocaleString('en-IN')}`, 14, 25);

    const tableRows = this.filteredExpenses.map((e, index) => [
      index + 1,
      this.toDisplayDate(e.expenseDate),
      e.purpose || 'Consumables',
      e.vendorName || '—',
      e.paymentThrough || 'P.O',
      e.paidBy || 'OFFICE',
      `Rs. ${(Number(e.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Date', 'Purpose / Material', 'Vendor', 'Payment', 'Paid By', 'Amount']],
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
        3: { cellWidth: 35 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`Warehouse_Expenses_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
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

  deriveMoPFromDate(dateStr: string): string {
    const iso = this.toIsoDate(dateStr);
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
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
