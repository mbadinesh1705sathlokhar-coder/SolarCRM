import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { Project, SiteExpense } from '../../models/project.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { OfficeService } from '../../services/office.service';
import { AuthService } from '../../services/auth.service';
import { MasterListService } from '../../services/master-list.service';

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
  private masterListService = inject(MasterListService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('topScrollWrapper') topScrollWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('dataTableEl') dataTableEl?: ElementRef<HTMLTableElement>;

  tableScrollWidth = 0;
  tableClientWidth = 0;
  private isSyncingTop = false;
  private isSyncingBottom = false;
  private resizeObserver?: ResizeObserver;

  formatCapacity(val: string | undefined | null): string {
    if (!val) return '3 kW';
    const str = String(val).trim();
    if (!str) return '3 kW';
    if (str.toLowerCase().includes('mw')) return str;
    const cleaned = str.replace(/\s*kw\s*/gi, '').trim();
    return cleaned ? `${cleaned} kW` : '3 kW';
  }

  formatClientName(val: string | undefined | null): string {
    if (!val) return '';
    const str = String(val).trim();
    if (str.includes(':')) {
      const parts = str.split(':');
      if (parts.length > 1) {
        const subParts = parts[1].split(',');
        if (subParts.length >= 2) return subParts[1].trim();
        return subParts[0].trim();
      }
    }
    return str;
  }

  projects: Project[] = [];
  expenses: SiteExpense[] = [];
  loading = false;
  searchQuery = '';
  marginFilter: 'All' | 'HasExpenses' | 'ZeroExpenses' = 'All';
  orderByFilter: string = 'All';
  orderByOptions: string[] = ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH'];
  siteIdSortDirection: 'asc' | 'desc' | 'none' = 'desc';

  updateOrderByOptions(): void {
    const list = new Set<string>(['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH']);
    this.projects.forEach(p => {
      if (p.orderBy && p.orderBy.trim()) {
        list.add(p.orderBy.trim());
      }
    });
    this.orderByOptions = Array.from(list).sort((a, b) => a.localeCompare(b));
  }

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
  isLegacyPurpose = false;

  formData = {
    dateInput: '', // dd-mm-yyyy
    siteId: '',
    clientName: '',
    clientSiteName: '',
    paymentThrough: 'P.O',
    referenceNo: '',
    purpose: 'Inverters - 3kW Ongrid',
    selectedBomGroup: 'Inverters',
    selectedBomSpec: '3kW Ongrid',
    customBomSpec: '',
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

  // --- EXCEL UPLOAD MODAL STATE ---
  isExcelModalOpen = false;
  excelRawRows: any[] = [];
  excelHeaders: string[] = [];
  excelMapping = {
    date: '',
    referenceNo: '',
    invoiceNo: '',
    siteId: '',
    clientName: '',
    purpose: '',
    amount: '',
    vendor: '',
    paidBy: '',
    generatedBy: '',
    paymentThrough: '',
    remarks: ''
  };

  alertMessage: { text: string; type: 'success' | 'danger' } | null = null;

  loadEngineers(): void {
    this.masterListService.getList('Engineer').subscribe({
      next: (res: any) => {
        if (res?.data?.items && res.data.items.length > 0) {
          const set = new Set<string>([...res.data.items, 'K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH']);
          this.orderByOptions = Array.from(set).sort((a, b) => a.localeCompare(b));
        }
      }
    });
  }

  onExcelFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          this.showAlert('Selected Excel file is empty', 'danger');
          return;
        }

        this.excelRawRows = jsonData;
        this.excelHeaders = Object.keys(jsonData[0]);

        const findHeader = (keywords: string[]) => {
          return this.excelHeaders.find(h => {
            const lower = h.toLowerCase().trim();
            return keywords.some(k => lower === k || lower.includes(k));
          }) || '';
        };

        this.excelMapping = {
          date: findHeader(['date', 'created', 'day', 'time', 'awarded']),
          referenceNo: findHeader(['po / wo no', 'po/wo no', 'po / wo', 'po/wo', 'po no', 'wo no', 'po #', 'wo #', 'ref', 'order no', 'po', 'wo']),
          invoiceNo: findHeader(['invoice no', 'invoice #', 'inv no', 'inv #', 'tax invoice', 'bill no', 'bill #']),
          siteId: findHeader(['site id', 'siteid', 'project id', 'id']),
          clientName: findHeader(['client / site name', 'client name', 'client', 'site name', 'customer']),
          purpose: findHeader(['bom material', 'material', 'purpose', 'category', 'item', 'description']),
          amount: findHeader(['expense amount', 'amount', 'cost', 'expense', 'price']),
          vendor: findHeader(['vendor name', 'vendor', 'supplier', 'seller', 'party', 'shop', 'company', 'paid to', 'payee']),
          paidBy: findHeader(['paid by', 'engineer', 'order by', 'handler']),
          generatedBy: findHeader(['generated by', 'created by', 'entered by', 'user']),
          paymentThrough: findHeader(['through', 'mode', 'channel', 'payment mode']),
          remarks: findHeader(['remarks / description', 'remarks', 'description', 'notes', 'comments'])
        };

        this.isExcelModalOpen = true;
        this.cdr.markForCheck();
      } catch (err: any) {
        this.showAlert('Failed to read Excel file: ' + err.message, 'danger');
      }
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  closeExcelModal(): void {
    this.isExcelModalOpen = false;
    this.excelRawRows = [];
    this.excelHeaders = [];
  }

  async confirmImportExcel(): Promise<void> {
    if (this.excelRawRows.length === 0) return;

    const expensesBatch: Partial<SiteExpense>[] = [];
    for (const row of this.excelRawRows) {
      const siteId = this.excelMapping.siteId ? String(row[this.excelMapping.siteId] || '').trim() : '';
      const clientName = this.excelMapping.clientName ? String(row[this.excelMapping.clientName] || '').trim() : '';
      const purpose = this.excelMapping.purpose ? String(row[this.excelMapping.purpose] || '').trim() : 'Material Purchase';
      const amount = this.excelMapping.amount ? parseFloat(row[this.excelMapping.amount]) || 0 : 0;
      let vendor = this.excelMapping.vendor ? String(row[this.excelMapping.vendor] || '').trim() : '';

      const generatedBy = this.excelMapping.generatedBy ? String(row[this.excelMapping.generatedBy] || '').trim() : '';
      const rawPaidBy = this.excelMapping.paidBy ? String(row[this.excelMapping.paidBy] || '').trim() : '';
      const rawSource = this.excelMapping.paymentThrough ? String(row[this.excelMapping.paymentThrough] || '').trim() : '';

      let refNo = this.excelMapping.referenceNo ? String(row[this.excelMapping.referenceNo] || '').trim() : '';
      if (['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Not Submitted', 'Submitted', '-'].includes(refNo)) {
        refNo = '';
      }

      // Determine Source (paymentThrough): MUST strictly be P.O, W.O, Petty Cash, Gatepass, or Accounts
      let paymentThrough = '';
      if (refNo) {
        if (refNo.toUpperCase().includes('WO-') || refNo.toUpperCase().includes('W.O')) {
          paymentThrough = 'W.O';
        } else {
          paymentThrough = 'P.O';
        }
      }

      if (!paymentThrough) {
        const checkStr = `${rawSource} ${rawPaidBy}`.toLowerCase();
        if (checkStr.includes('gatepass') || checkStr.includes('gate pass')) {
          paymentThrough = 'Gatepass';
        } else if (checkStr.includes('account') || checkStr.includes('bank')) {
          paymentThrough = 'Accounts';
        } else if (checkStr.includes('w.o') || checkStr.includes('work order')) {
          paymentThrough = 'W.O';
        } else if (checkStr.includes('p.o') || checkStr.includes('purchase order')) {
          paymentThrough = 'P.O';
        } else {
          paymentThrough = 'Petty Cash';
        }
      }

      // Determine Paid By (staff / engineer name)
      let paidBy = generatedBy;
      if (!paidBy && rawPaidBy && !['P.O', 'W.O', 'Petty Cash', 'Accounts', 'Gatepass'].includes(rawPaidBy)) {
        paidBy = rawPaidBy;
      }
      if (!paidBy) {
        paidBy = 'OFFICE';
      }

      let remarks = this.excelMapping.remarks ? String(row[this.excelMapping.remarks] || '').trim() : '';
      const rawDate = this.excelMapping.date ? row[this.excelMapping.date] : null;
      const expenseDate = rawDate ? this.normalizeToIsoDate(rawDate) : new Date().toISOString().split('T')[0];

      let invNo = this.excelMapping.invoiceNo ? String(row[this.excelMapping.invoiceNo] || '').trim() : '';
      if (['Not Submitted', 'Submitted', 'P.O', 'W.O', 'Petty Cash', 'WAREHOUSE', '-'].includes(invNo)) {
        invNo = '';
      }

      if (!vendor) {
        if (remarks) {
          vendor = remarks;
        } else if (paymentThrough === 'Petty Cash' || rawPaidBy === 'Petty Cash' || paidBy === 'Petty Cash') {
          vendor = 'Petty Cash / Local Vendor';
        }
      }

      const billVoucherCol = this.excelHeaders.find(h => h.toLowerCase().includes('bill voucher') || h.toLowerCase().includes('voucher'));
      const billVoucher = billVoucherCol ? String(row[billVoucherCol] || '').trim() : 'Submitted';

      if (amount > 0 || purpose) {
        expensesBatch.push({
          siteId: siteId || 'OFFICE',
          clientName: clientName || 'General Expense',
          purpose: purpose,
          amount: amount,
          vendorName: vendor,
          paidBy: paidBy,
          paymentThrough: paymentThrough,
          referenceNo: refNo,
          invoiceNo: invNo,
          expenseDate: expenseDate,
          remarks: remarks,
          billVoucher: billVoucher || 'Submitted'
        });
      }
    }

    if (expensesBatch.length === 0) {
      this.showAlert('No valid expense transaction rows found in Excel sheet.', 'danger');
      return;
    }

    this.showAlert(`Importing ${expensesBatch.length} expense records...`, 'success');
    let importedCount = 0;

    for (const exp of expensesBatch) {
      try {
        await lastValueFrom(this.projectService.createExpense(exp));
        importedCount++;
      } catch (err) {
        console.error('Error importing expense row:', err);
      }
    }

    this.closeExcelModal();
    this.loadProjects();
    this.loadExpenses();
    if (this.selectedProjectRef) {
      this.loadClientExpenses(this.selectedProjectRef.siteId);
    }
    this.showAlert(`Successfully imported ${importedCount} expense records from Excel!`, 'success');
  }

  // Select dropdown option arrays matching user's real project requirements
  paymentThroughOptions = ['P.O', 'W.O', 'Warehouse', 'Petty Cash', 'Gatepass', 'Accounts', '(Blanks)'];

  // Project BOM Items dynamically loaded when opening a specific client
  projectBomOptions: { value: string; label: string; group: string; spec: string }[] = [];

  // Warehouse Bulk Orders / Invoices available for mapping to client expenses
  warehouseStockInvoices: { invoiceNo: string; referenceNo: string; vendorName: string; purpose: string; displayText: string }[] = [];

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
      group: 'Transportation & Logistics',
      specifications: ['Freight & Site Logistics', 'Local Tempo / Mini Truck', 'Site Shifting & Handling', 'Crane / Unloading Services']
    },
    {
      group: 'Consumables & Miscellaneous',
      specifications: ['Consumables', 'DB Boxes', 'Cable Tray Materials', 'Civil Work Labour', 'Labour/Manpower', 'Rental Tools', 'Tools Asset', 'Walkway / Hand Rails', 'General Stock']
    }
  ];

  // Vendor options dynamically fetched from Account -> Office -> Vendor List
  vendorOptions: string[] = [];

  purposeOptions: string[] = [];

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

  getSource(e: SiteExpense): string {
    const pt = (e.paymentThrough || '').trim();
    if (pt === 'Warehouse' || pt === 'WAREHOUSE') return 'Warehouse';
    if (pt === 'Gatepass' || pt === 'GatePass') return 'Gatepass';
    if (pt === 'Accounts') return 'Accounts';
    if (pt === 'W.O') return 'W.O';
    if (pt === 'P.O') return 'P.O';
    const ref = (e.referenceNo || '').trim();
    const isPoWoRef = ref && !['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Warehouse', 'Not Submitted', 'Submitted', '-'].includes(ref) && !ref.toUpperCase().startsWith('PC-');
    if (isPoWoRef) {
      return ref.toUpperCase().includes('WO-') || ref.toUpperCase().includes('W.O') ? 'W.O' : 'P.O';
    }
    return 'Petty Cash';
  }

  extractProjectBomOptions(project: Project | null): void {
    this.projectBomOptions = [];
    if (!project || !project.bomItems) return;
    try {
      let items: any[] = [];
      if (Array.isArray(project.bomItems)) {
        items = project.bomItems;
      } else if (typeof project.bomItems === 'string') {
        items = JSON.parse(project.bomItems);
      }
      if (Array.isArray(items) && items.length > 0) {
        this.projectBomOptions = items.map(b => ({
          value: `${b.materialGroup || 'Material'} - ${b.specification || b.categoryType || 'Standard'}`,
          label: `📋 ${b.materialGroup || 'Material'}: ${b.specification || b.categoryType || 'Standard'} (${b.plannedQty || ''} ${b.uom || ''})`,
          group: b.materialGroup || 'Material',
          spec: b.specification || b.categoryType || 'Standard'
        }));
      }
    } catch {
      this.projectBomOptions = [];
    }
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

  selectProjectBomItem(pb: { value: string; group: string; spec: string }): void {
    this.formData.selectedBomGroup = pb.group;
    this.formData.selectedBomSpec = pb.spec;
    this.formData.customBomSpec = '';
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

  isPoWo(paymentThrough?: string): boolean {
    if (!paymentThrough) return false;
    const clean = paymentThrough.trim().toUpperCase().replace(/[\s.]/g, '');
    return clean === 'PO' || clean === 'WO' || clean.includes('GATEPASS') || clean.includes('WAREHOUSE');
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadExpenses();
    this.loadVendorsFromOffice();
    this.loadEmployeesFromOffice();
    this.loadBomMaterialsFromService();
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
      this.updateOrderByOptions();
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
          this.updateOrderByOptions();
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
      this.loadWarehouseStockInvoices();
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
          this.loadWarehouseStockInvoices();
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

  loadWarehouseStockInvoices(): void {
    if (!this.expenses || this.expenses.length === 0) {
      this.warehouseStockInvoices = [];
      return;
    }
    const whRecords = this.expenses.filter(e => (e.siteId || '').toUpperCase() === 'WAREHOUSE');
    const invoiceMap = new Map<string, { invoiceNo: string; referenceNo: string; vendorName: string; purpose: string; displayText: string }>();

    whRecords.forEach(e => {
      const inv = (e.invoiceNo || '').trim();
      const ref = (e.referenceNo || '').trim();
      const key = `${inv}_${ref}_${e.purpose || ''}`.toLowerCase();
      if ((inv || ref) && !['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Warehouse', 'Not Submitted', 'Submitted', '-'].includes(inv || ref)) {
        if (!invoiceMap.has(key)) {
          const invDisplay = inv ? `Inv: ${inv}` : '';
          const refDisplay = ref ? `PO/Ref: ${ref}` : '';
          const purpDisplay = e.purpose ? `[${e.purpose}]` : '';
          const vendorDisplay = e.vendorName ? `(${e.vendorName})` : '';
          const displayText = [invDisplay, refDisplay, purpDisplay, vendorDisplay].filter(Boolean).join(' - ');
          invoiceMap.set(key, {
            invoiceNo: inv,
            referenceNo: ref,
            vendorName: e.vendorName || '',
            purpose: e.purpose || '',
            displayText: displayText || inv || ref
          });
        }
      }
    });
    this.warehouseStockInvoices = Array.from(invoiceMap.values());
  }

  onWarehouseStockInvoiceSelect(selectedText: string): void {
    if (!selectedText) return;
    const item = this.warehouseStockInvoices.find(w => w.displayText === selectedText || w.invoiceNo === selectedText || w.referenceNo === selectedText);
    if (item) {
      if (item.invoiceNo) this.formData.invoiceNo = item.invoiceNo;
      if (item.referenceNo) this.formData.referenceNo = item.referenceNo;
      if (item.vendorName) {
        if (!this.vendorOptions.includes(item.vendorName)) {
          this.vendorOptions = [item.vendorName, ...this.vendorOptions];
        }
        this.formData.vendor = item.vendorName;
      }
      if (item.purpose) {
        const projMatch = this.projectBomOptions.find((p: any) => item.purpose.toLowerCase().includes(p.spec.toLowerCase()) || item.purpose.toLowerCase() === p.value.toLowerCase() || p.group.toLowerCase().includes(item.purpose.toLowerCase()));
        if (projMatch) {
          this.formData.selectedBomGroup = projMatch.group;
          this.formData.selectedBomSpec = projMatch.spec;
          this.onBomSpecChange();
        }
      }
    }
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

    if (this.orderByFilter !== 'All') {
      list = list.filter(p => (p.orderBy || '').trim().toLowerCase() === this.orderByFilter.trim().toLowerCase());
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
    this.siteIdSortDirection = this.siteIdSortDirection === 'desc' ? 'asc' : 'desc';
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

  onOrderByFilterChange(): void {
    this.currentPage = 1;
    this.updateTableWidth();
  }

  // Date helper methods for dd-mm-yyyy and HTML datepicker
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
              const recv = Number(this.selectedProjectRef.received) || 0;
              this.selectedProjectRef.margin = recv - res.totalAmount;
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

    this.extractProjectBomOptions(this.selectedProjectRef);

    const isWh = this.selectedProjectRef.siteId.toUpperCase() === 'WAREHOUSE';
    const defaultGroup = this.projectBomOptions.length > 0 ? this.projectBomOptions[0].group : 'Inverters';
    const defaultSpec = this.projectBomOptions.length > 0 ? this.projectBomOptions[0].spec : (this.getAvailableSpecs(defaultGroup)[0] || '3kW Ongrid');
    const defaultPurpose = `${defaultGroup} - ${defaultSpec}`;

    this.isLegacyPurpose = false;
    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: isWh
        ? 'Warehouse : Sathlokhar H.O'
        : `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.siteCapacity || '5'}KW, ${this.selectedProjectRef.clientName}, ${this.selectedProjectRef.location || 'Chennai'}`,
      paymentThrough: isWh ? 'P.O' : 'P.O',
      referenceNo: '',
      purpose: defaultPurpose,
      selectedBomGroup: defaultGroup,
      selectedBomSpec: defaultSpec,
      customBomSpec: '',
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

    this.extractProjectBomOptions(this.selectedProjectRef);

    const displayDate = e.formattedDate || this.toDisplayDate(e.expenseDate);

    if (e.vendorName && !this.vendorOptions.includes(e.vendorName)) {
      this.vendorOptions = [e.vendorName, ...this.vendorOptions];
    }
    if (e.paidBy && !this.paidByOptions.includes(e.paidBy)) {
      this.paidByOptions = [e.paidBy, ...this.paidByOptions];
    }

    const rawPurpose = e.purpose || 'Consumables';
    let matchedGroup = '';
    let matchedSpec = '';

    // First check projectBomOptions
    const projMatch = this.projectBomOptions.find(p => rawPurpose.toLowerCase().includes(p.spec.toLowerCase()) || rawPurpose.toLowerCase() === p.value.toLowerCase());
    if (projMatch) {
      matchedGroup = projMatch.group;
      matchedSpec = projMatch.spec;
    } else {
      for (const g of this.bomMaterialGroups) {
        if (rawPurpose.toLowerCase().includes(g.group.toLowerCase())) {
          matchedGroup = g.group;
          const foundSpec = g.specifications.find(s => rawPurpose.toLowerCase().includes(s.toLowerCase()));
          if (foundSpec) matchedSpec = foundSpec;
          break;
        }
      }
    }

    if (!matchedGroup) {
      // Legacy purpose - keep data intact without altering existing records
      this.isLegacyPurpose = true;
      matchedGroup = rawPurpose;
      matchedSpec = 'Custom';
    } else {
      this.isLegacyPurpose = false;
    }

    this.formData = {
      dateInput: displayDate,
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: e.clientSiteName || `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.clientName}`,
      paymentThrough: e.paymentThrough || 'P.O',
      referenceNo: e.referenceNo || '',
      purpose: rawPurpose,
      selectedBomGroup: matchedGroup || 'Inverters',
      selectedBomSpec: matchedSpec || (this.getAvailableSpecs(matchedGroup)[0] || 'General'),
      customBomSpec: this.isLegacyPurpose ? rawPurpose : '',
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
    this.isLegacyPurpose = false;
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
    const recv = Number(this.selectedProjectRef?.received) || 0;
    return recv - this.clientTotalExpenses;
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
    const recv = Number(this.selectedProjectRef?.received) || 0;
    return recv - this.liveNewExpenses;
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
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: this.formData.clientSiteName || `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.clientName}`,
      expenseDate: isoDate,
      mop,
      amount: Number(this.formData.amount),
      paymentThrough: this.formData.paymentThrough,
      referenceNo: (this.formData.referenceNo || '').trim(),
      purpose: finalPurpose,
      category: this.formData.selectedBomGroup || 'Materials Supply',
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

  exportToExcel(): void {
    if (!this.filteredClients || this.filteredClients.length === 0) {
      this.showAlert('No clients to export to Excel', 'danger');
      return;
    }
    const headers = ['S.No', 'Site ID', 'Client Name', 'Location', 'Capacity', 'Site Value (INR)', 'Site Expenses (INR)', 'Net Margin (INR)', 'Margin %', 'Status'];
    const rows = this.filteredClients.map((c, idx) => [
      idx + 1,
      `"${c.siteId || ''}"`,
      `"${(c.clientName || '').replace(/"/g, '""')}"`,
      `"${(c.location || '').replace(/"/g, '""')}"`,
      c.siteCapacity ? `${c.siteCapacity} kW` : '',
      c.siteValue || 0,
      c.siteExpenses || 0,
      c.margin || 0,
      `${c.marginPercentage || 0}%`,
      `"${(Number(c.siteExpenses) || 0) > 0 ? 'Expenses Recorded' : 'Zero Expenses'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_Summary_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showAlert('Excel/CSV downloaded successfully!', 'success');
  }

  exportBothPdfAndExcel(): void {
    this.exportAllClientsPdf();
    setTimeout(() => {
      this.exportToExcel();
    }, 450);
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
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  canAdd(): boolean {
    return this.authService.canAdd('expense-ledger') || this.authService.canAdd('finance');
  }

  canEdit(): boolean {
    return this.authService.canEdit('expense-ledger') || this.authService.canEdit('finance');
  }

  canDelete(): boolean {
    return this.authService.canDelete('expense-ledger') || this.authService.canDelete('finance');
  }

  clearAllClientExpenses(): void {
    if (confirm('Are you sure you want to clear ALL client expense records? This will delete all current client site expense records so you can upload a clean Excel file.')) {
      this.projectService.clearAllClientExpenses().subscribe({
        next: () => {
          this.projectService.clearCache();
          this.clientExpensesList = [];
          this.expenses = [];
          this.showAlert('All client expense records cleared successfully.', 'success');
          this.loadProjects();
          this.loadExpenses();
        },
        error: (err: any) => {
          this.showAlert('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
