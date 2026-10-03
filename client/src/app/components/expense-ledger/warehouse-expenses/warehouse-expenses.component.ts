import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { SiteExpense } from '../../../models/project.model';
import { OfficeService } from '../../../services/office.service';
import { AuthService } from '../../../services/auth.service';
import { MasterListService } from '../../../services/master-list.service';
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
  private masterListService = inject(MasterListService);
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
  isLegacyPurpose = false;

  formData = {
    dateInput: '', // dd-mm-yyyy
    paymentThrough: 'P.O',
    purpose: 'Inverters - 3kW Ongrid',
    selectedBomGroup: 'Inverters',
    selectedBomSpec: '3kW Ongrid',
    customBomSpec: '',
    paidBy: 'OFFICE',
    vendor: '',
    remarks: '',
    billVoucher: 'Submitted',
    referenceNo: '',
    invoiceNo: '',
    amount: null as number | null
  };

  paymentThroughOptions = ['P.O', 'W.O', 'Petty Cash', 'Gatepass', 'Accounts', '(Blanks)'];

  // BOM Material Master Groups & Specifications
  bomMaterialGroups: { group: string; specifications: string[] }[] = [
    {
      group: 'Panels',
      specifications: ['540W Mono PERC', '550W Mono PERC', '580W TOPCon', '335W Polycrystalline', '340W Polycrystalline']
    },
    {
      group: 'Inverters',
      specifications: ['3kW Ongrid', '5kW Ongrid', '10kW Ongrid', '15kW Ongrid', '20kW Ongrid', '5kW Hybrid', '10kW Hybrid']
    },
    {
      group: 'Cables',
      specifications: ['AC Cable - 4Sqmm', 'AC Cable - 6Sqmm', 'AC Cable - 10Sqmm', 'AC Cable - 16Sqmm', 'AC Cable - 25Sqmm', 'DC Cable - XLPO 4Sqmm', 'DC Cable - XLPO 6Sqmm', 'DC Cable - 10Sqmm']
    },
    {
      group: 'Structure',
      specifications: ['HDG Rooftop High Structure', 'Aluminium Rail Profile', 'Ground Mount Column Structure', 'Car Port Canopy Structure']
    },
    {
      group: 'Earthing & Lightning',
      specifications: ['Copper Bonded Chemical Earthing Rod 50mm', 'ESE Lightning Arrester Kit', 'GI Flat Strip 25x3mm', 'Copper Strip 25x3mm']
    },
    {
      group: 'MC4 Connector',
      specifications: ['Single Pair (1-in 1-out)', '2-in 1-out Branch Pair', '3-in 1-out Branch Pair', '4-in 1-out Branch Pair']
    },
    {
      group: 'Lugs',
      specifications: ['Cu Lug - 4Sqmm', 'Cu Lug - 6Sqmm', 'Cu Lug - 10Sqmm', 'Al Lug - 16Sqmm', 'Al Lug - 25Sqmm', 'Al Lug - 35Sqmm', 'Pin Lug - 4Sqmm', 'Ring Lug - 6Sqmm']
    },
    {
      group: 'Bucket',
      specifications: ['PVC Conduit Accessories Bucket', 'Hardware Fasteners Bucket', 'Earthing Kit Bucket', 'Electrical Consumables Bucket']
    },
    {
      group: 'Fasteners & Hardware',
      specifications: ['SS304 Allen Bolt M8x25', 'SS304 Hex Bolt M10x30', 'Anchor Fastener M12x100', 'Cable Ties UV 300mm']
    },
    {
      group: 'Transportation & Logistics',
      specifications: ['Freight & Site Logistics', 'Local Tempo / Mini Truck', 'Site Shifting & Handling', 'Crane / Unloading Services']
    },
    {
      group: 'Consumables & Miscellaneous',
      specifications: ['General Consumables', 'DB Boxes', 'Cable Tray Materials', 'Rental Tools', 'Tools Asset', 'Walkway / Hand Rails', 'General Stock']
    }
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
    this.loadBomMaterialsFromService();
  }

  loadBomMaterialsFromService(): void {
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.grouped) {
          Object.keys(res.grouped).forEach(grpName => {
            const items = res.grouped[grpName];
            const specs = items.map((it: any) => it.specification || it.categoryType).filter(Boolean);
            const existing = this.bomMaterialGroups.find(g => g.group.toLowerCase().trim() === grpName.toLowerCase().trim());
            if (existing) {
              existing.specifications = Array.from(new Set([...existing.specifications, ...specs]));
            } else {
              this.bomMaterialGroups.push({ group: grpName, specifications: specs.length > 0 ? specs : ['General'] });
            }
          });
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  getAvailableSpecs(groupName: string): string[] {
    const grp = this.bomMaterialGroups.find(g => g.group.toLowerCase().trim() === (groupName || '').toLowerCase().trim());
    return grp ? grp.specifications : ['General'];
  }

  onBomGroupChange(): void {
    this.isLegacyPurpose = false;
    const specs = this.getAvailableSpecs(this.formData.selectedBomGroup);
    this.formData.selectedBomSpec = specs[0] || 'General';
    this.formData.customBomSpec = '';
    this.updatePurposeFromBom();
  }

  onBomSpecChange(): void {
    this.isLegacyPurpose = false;
    this.updatePurposeFromBom();
  }

  updatePurposeFromBom(): void {
    if (this.formData.selectedBomSpec === 'Custom') {
      this.formData.purpose = this.formData.customBomSpec?.trim()
        ? `${this.formData.selectedBomGroup} - ${this.formData.customBomSpec.trim()}`
        : this.formData.selectedBomGroup;
    } else if (this.formData.selectedBomSpec) {
      this.formData.purpose = `${this.formData.selectedBomGroup} - ${this.formData.selectedBomSpec}`;
    } else {
      this.formData.purpose = this.formData.selectedBomGroup;
    }
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
        (e.expenseDate || '').toLowerCase().includes(q) ||
        (e.referenceNo || '').toLowerCase().includes(q) ||
        (e.invoiceNo || '').toLowerCase().includes(q)
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
    this.isLegacyPurpose = false;
    this.editingId = null;
    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      paymentThrough: 'P.O',
      purpose: 'Inverters - 3kW Ongrid',
      selectedBomGroup: 'Inverters',
      selectedBomSpec: '3kW Ongrid',
      customBomSpec: '',
      paidBy: 'OFFICE',
      vendor: '',
      remarks: 'Material stock received in Central Warehouse',
      billVoucher: 'Submitted',
      referenceNo: '',
      invoiceNo: '',
      amount: null
    };
    this.isModalOpen = true;
  }

  openEditModal(e: SiteExpense): void {
    this.isEditMode = true;
    this.editingId = e.id || null;

    const rawPurpose = e.purpose || 'Consumables';
    let matchedGroup = '';
    let matchedSpec = '';

    for (const g of this.bomMaterialGroups) {
      if (rawPurpose.toLowerCase().includes(g.group.toLowerCase())) {
        matchedGroup = g.group;
        const foundSpec = g.specifications.find(s => rawPurpose.toLowerCase().includes(s.toLowerCase()));
        if (foundSpec) matchedSpec = foundSpec;
        break;
      }
    }

    if (!matchedGroup) {
      // Legacy purpose that doesn't match new BOM schema - PRESERVE INTACT
      this.isLegacyPurpose = true;
      matchedGroup = rawPurpose;
      matchedSpec = 'Custom';
    } else {
      this.isLegacyPurpose = false;
    }

    // Clean invoiceNo: if it contains PO/WO strings, leave invoiceNo empty for manual entry
    const cleanInvNo = (e.invoiceNo && !e.invoiceNo.startsWith('SOLAR/') && !e.invoiceNo.includes('/PO-') && !e.invoiceNo.includes('/WO-')) 
      ? e.invoiceNo 
      : '';

    this.formData = {
      dateInput: e.formattedDate || this.toDisplayDate(e.expenseDate),
      paymentThrough: e.paymentThrough || 'P.O',
      purpose: rawPurpose, // 100% preserves existing database data
      selectedBomGroup: matchedGroup || 'Inverters',
      selectedBomSpec: matchedSpec || (this.getAvailableSpecs(matchedGroup)[0] || 'General'),
      customBomSpec: this.isLegacyPurpose ? rawPurpose : '',
      paidBy: e.paidBy || 'OFFICE',
      vendor: e.vendorName || '',
      remarks: e.remarks || '',
      billVoucher: e.billVoucher || 'Submitted',
      referenceNo: e.referenceNo || '',
      invoiceNo: cleanInvNo,
      amount: Number(e.amount) || null
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingId = null;
    this.isLegacyPurpose = false;
  }

  submitExpense(): void {
    if (!this.formData.amount || this.formData.amount <= 0) {
      this.showToast('Please enter a valid positive expense amount', 'danger');
      return;
    }

    const isoDate = this.toIsoDate(this.formData.dateInput);
    const mop = this.deriveMoPFromDate(this.formData.dateInput);

    let finalPurpose = this.formData.purpose;
    if (!this.isLegacyPurpose && this.formData.selectedBomGroup) {
      if (this.formData.selectedBomSpec === 'Custom' && this.formData.customBomSpec?.trim()) {
        finalPurpose = `${this.formData.selectedBomGroup} - ${this.formData.customBomSpec.trim()}`;
      } else if (this.formData.selectedBomSpec && this.formData.selectedBomSpec !== 'Custom') {
        finalPurpose = `${this.formData.selectedBomGroup} - ${this.formData.selectedBomSpec}`;
      } else {
        finalPurpose = this.formData.selectedBomGroup;
      }
    }

    const payload: Partial<SiteExpense> = {
      siteId: 'WAREHOUSE',
      clientName: 'Warehouse : Sathlokhar H.O',
      clientSiteName: 'Warehouse : Sathlokhar H.O',
      expenseDate: isoDate,
      mop,
      amount: Number(this.formData.amount),
      paymentThrough: this.formData.paymentThrough,
      purpose: finalPurpose,
      category: this.formData.selectedBomGroup || 'Warehouse',
      paidBy: this.formData.paidBy,
      vendorName: this.formData.vendor || '',
      remarks: this.formData.remarks || '',
      billVoucher: this.formData.billVoucher || 'Submitted',
      referenceNo: this.formData.referenceNo ? this.formData.referenceNo.trim() : '',
      invoiceNo: this.formData.invoiceNo ? this.formData.invoiceNo.trim() : ''
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
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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
      e.referenceNo || '—',
      e.invoiceNo || '—',
      e.purpose || 'Consumables',
      e.vendorName || '—',
      e.paymentThrough || 'P.O',
      e.paidBy || 'OFFICE',
      `Rs. ${(Number(e.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Date', 'PO/WO No.', 'Invoice No', 'BOM Material / Purpose', 'Vendor', 'Payment', 'Paid By', 'Amount']],
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
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 32 },
        3: { cellWidth: 25 },
        4: { cellWidth: 42 },
        5: { cellWidth: 32 },
        6: { cellWidth: 20 },
        7: { cellWidth: 22 },
        8: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`Warehouse_Expenses_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
    this.showToast('PDF downloaded successfully!', 'info');
  }

  // --- DATE HELPERS ---
  toDisplayDate(isoStr: string | undefined): string {
    if (!isoStr) return '';
    const cleanStr = String(isoStr).trim().substring(0, 10).replace(/[/.]/g, '-');
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        return `${dd}-${mm}-${yyyy}`;
      }
      if (parts.length === 3 && parts[2].length === 4) {
        const dd = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        return `${dd}-${mm}-${yyyy}`;
      }
    }
    return String(isoStr).trim();
  }

  toIsoDate(inputStr: string | undefined): string {
    if (!inputStr) return new Date().toISOString().slice(0, 10);
    const cleanStr = String(inputStr).trim().substring(0, 10).replace(/[/.]/g, '-');
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
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
    return cleanStr;
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
}
