import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Project, ClientPayment } from '../../models/project.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { RouterModule } from '@angular/router';
import { MasterListService } from '../../services/master-list.service';
import { AuthService } from '../../services/auth.service';

interface FilterCheckOption {
  label: string;
  selected: boolean;
}

@Component({
  selector: 'app-payment-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payment-ledger.component.html',
  styleUrls: ['./payment-ledger.component.css']
})
export class PaymentLedgerComponent implements OnInit, AfterViewInit, OnDestroy {
  private projectService = inject(ProjectService);
  private masterListService = inject(MasterListService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  closingValueTolerance = 100;

  isFullyPaid(p: Partial<Project>): boolean {
    const val = Number(p.siteValue) || 0;
    const rec = Number(p.received) || 0;
    return (val - rec) <= (this.closingValueTolerance || 100);
  }

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

  paymentModeOptions: string[] = [
    'Bank Transfer / NEFT',
    'Bank Transfer / IMPS',
    'Cheque / DD',
    'UPI',
    'Bank Deposit'
  ];

  @ViewChild('topScrollWrapper') topScrollWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('dataTableEl') dataTableEl?: ElementRef<HTMLTableElement>;

  tableScrollWidth = 0;
  tableClientWidth = 0;
  private isSyncingTop = false;
  private isSyncingBottom = false;
  private resizeObserver?: ResizeObserver;

  payments: ClientPayment[] = [];
  projects: Project[] = [];
  loading = false;
  searchQuery = '';
  dueFilter: 'All' | 'HasDue' | 'Paid' = 'All';
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

  // Pagination for Client List (max 115 clients, 0 duplicates)
  currentPage = 1;
  pageSize = 20;

  // --- CLIENT-SPECIFIC PAYMENT MODAL STATE ---
  isClientModalOpen = false;
  selectedProjectRef: Project | null = null;
  clientPaymentsList: ClientPayment[] = [];
  loadingClientPayments = false;

  // Form State for Adding / Editing Payment within Client Modal
  isAddingOrEditingPayment = false;
  isEditingPastRecord = false;
  editingPaymentId: number | null = null;
  editingOriginalAmount: number = 0;

  formData = {
    dateInput: '', // dd-mm-yyyy
    siteId: '',
    clientName: '',
    clientSiteName: '',
    paymentMode: 'Bank Transfer / NEFT',
    remarks: '',
    amount: null as number | null
  };

  // --- ADD NEW CLIENT MODAL STATE ---
  isAddClientModalOpen = false;
  savingClient = false;
  newClientForm: any = null;

  alertMessage: { text: string; type: 'success' | 'danger' } | null = null;

  // --- EXCEL UPLOAD MODAL STATE ---
  isExcelModalOpen = false;
  excelRawRows: any[] = [];
  excelHeaders: string[] = [];
  excelMapping = {
    clientName: '',
    siteId: '',
    siteValue: '',
    received: '',
    orderBy: '',
    paymentDate: '',
    paymentMode: '',
    amount: ''
  };

  ngOnInit(): void {
    this.loadProjects();
    this.loadPayments();
    this.loadClosingTolerance();
    this.loadEngineers();
  }

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

  onExcelFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawArrayRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawArrayRows || rawArrayRows.length === 0) {
          this.showAlert('Selected Excel file is empty', 'danger');
          return;
        }

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, rawArrayRows.length); i++) {
          const rowStr = rawArrayRows[i].join(' ').toLowerCase();
          if (rowStr.includes('date') || rowStr.includes('site') || rowStr.includes('client') || rowStr.includes('payment') || rowStr.includes('amount') || rowStr.includes('received')) {
            headerRowIndex = i;
            break;
          }
        }

        const startIdx = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
        const headerCells = headerRowIndex !== -1 ? rawArrayRows[headerRowIndex].map((c: any) => String(c || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')) : [];

        const findColIndex = (keywords: string[]) => {
          if (headerCells.length === 0) return -1;
          for (const kw of keywords) {
            const idx = headerCells.findIndex((h: string) => h.includes(kw));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colIdx = {
          date: findColIndex(['date', 'paymentdate']),
          clientSiteName: findColIndex(['clientsitename', 'sitename', 'client']),
          siteId: findColIndex(['siteid', 'projectid', 'site', 'id']),
          paymentMode: findColIndex(['paymentmode', 'mode', 'type', 'channel']),
          remarks: findColIndex(['remarks', 'installment', 'notes', 'comments']),
          amount: findColIndex(['paymentreceived', 'received', 'amount', 'paid'])
        };

        const parseNumStr = (valStr: any) => {
          if (!valStr) return 0;
          const str = String(valStr).trim();
          if (!str) return 0;
          return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
        };

        const paymentsBatch: Partial<ClientPayment>[] = [];

        for (let r = startIdx; r < rawArrayRows.length; r++) {
          const arrRow = rawArrayRows[r];
          if (!arrRow || arrRow.length === 0 || arrRow.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '')) {
            continue;
          }

          const getValByCol = (cIndex: number, fallbacks: number[]) => {
            if (cIndex !== -1 && arrRow[cIndex] !== undefined && arrRow[cIndex] !== null && String(arrRow[cIndex]).trim() !== '') {
              return String(arrRow[cIndex]).trim();
            }
            for (const fb of fallbacks) {
              if (arrRow[fb] !== undefined && arrRow[fb] !== null && String(arrRow[fb]).trim() !== '') {
                return String(arrRow[fb]).trim();
              }
            }
            return '';
          };

          let rawDate = getValByCol(colIdx.date, [0]);
          let clientSiteName = getValByCol(colIdx.clientSiteName, [1]);
          let siteId = getValByCol(colIdx.siteId, [2, 1]);
          let paymentMode = getValByCol(colIdx.paymentMode, [3]);
          let remarks = getValByCol(colIdx.remarks, [4]);
          let amountStr = getValByCol(colIdx.amount, [5]);

          for (let c = 0; c < arrRow.length; c++) {
            const cellStr = String(arrRow[c] || '').trim();
            if (!cellStr) continue;

            if (!siteId && /^SP\d+/i.test(cellStr)) {
              siteId = cellStr.toUpperCase();
            }
            if (!rawDate && (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(cellStr) || /^\d{5}$/.test(cellStr))) {
              rawDate = cellStr;
            }
          }

          if (siteId && /^SP\d+/i.test(siteId)) {
            const m = siteId.match(/^SP\d+/i);
            if (m) siteId = m[0].toUpperCase();
          }

          const amount = parseNumStr(amountStr);
          if (!siteId && !clientSiteName) continue;
          if (amount <= 0) continue;

          if (siteId.toLowerCase().includes('site') || clientSiteName.toLowerCase().includes('client') || remarks.toLowerCase().includes('remarks')) {
            continue;
          }

          if (!siteId) siteId = `SP${400 + r}`;

          const isoDate = this.normalizeToIsoDate(rawDate);
          const mop = this.deriveMoPFromDate(rawDate);
          const clientName = this.formatClientName(clientSiteName) || `Client ${siteId}`;

          paymentsBatch.push({
            paymentDate: isoDate,
            mop: mop || 'Current',
            siteId: siteId.toUpperCase(),
            clientName: clientName,
            clientSiteName: clientSiteName || `${siteId} : ${clientName}`,
            amount: amount,
            paymentMode: paymentMode || 'Bank Transfer / NEFT',
            remarks: remarks || 'Payment Inflow'
          });
        }

        if (paymentsBatch.length === 0) {
          this.showAlert('No valid payment transaction rows found in Excel sheet.', 'danger');
          return;
        }

        this.showAlert(`Importing ${paymentsBatch.length} client payment records from Excel...`, 'success');

        let successCount = 0;
        for (const pay of paymentsBatch) {
          try {
            await lastValueFrom(this.projectService.createPayment(pay));
            successCount++;
          } catch (err) {
            console.error(`Error uploading payment for ${pay.siteId}:`, err);
          }
        }

        this.loadProjects();
        this.loadPayments();
        this.showAlert(`Successfully uploaded all ${successCount} client payment transaction records from Excel!`, 'success');
        event.target.value = '';
      } catch (err: any) {
        console.error('Error parsing Excel payment file:', err);
        this.showAlert('Failed to read Excel file: ' + err.message, 'danger');
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  }

  closeExcelModal(): void {
    this.isExcelModalOpen = false;
    this.excelRawRows = [];
    this.excelHeaders = [];
  }

  confirmImportExcel(): void {
    this.closeExcelModal();
  }

  loadClosingTolerance(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
          const match = res.data.find(l => norm(l.title) === 'closingvalue');
          if (match && match.items && match.items.length > 0) {
            const val = parseFloat(match.items[0]);
            if (!isNaN(val) && val >= 0) this.closingValueTolerance = val;
          }
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

  private isWarehouse(p: Project): boolean {
    const siteId = (p.siteId || '').toUpperCase().trim();
    const name = (p.clientName || '').toLowerCase().trim();
    return siteId === 'WAREHOUSE' || name.includes('warehouse');
  }

  loadProjects(): void {
    const cached = this.projectService.getCachedProjects();
    if (cached && cached.length > 0) {
      this.projects = cached.filter(p => !this.isWarehouse(p));
      this.updateOrderByOptions();
      this.loading = false;
      this.updateTableWidth();
    } else {
      this.loading = true;
    }
    this.cdr.markForCheck();

    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success) {
          this.projects = (res.data || []).filter(p => !this.isWarehouse(p));
          this.updateOrderByOptions();
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

  loadPayments(): void {
    const cached = this.projectService.getCachedPayments();
    if (cached) {
      this.payments = cached;
      this.updateTableWidth();
      this.cdr.markForCheck();
    }

    this.projectService.getPayments().subscribe({
      next: (res) => {
        if (res.success) {
          this.payments = res.data;
          this.updateTableWidth();
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error loading payments:', err);
        this.cdr.markForCheck();
      }
    });
  }

  // Summary Metrics calculated from unique clients
  get totalCollections(): number {
    return this.projects.reduce((acc, p) => acc + (Number(p.received) || 0), 0);
  }

  get totalDueRecoverable(): number {
    return this.projects.reduce((acc, p) => acc + (Number(p.due) || 0), 0);
  }

  get totalContractValue(): number {
    return this.projects.reduce((acc, p) => acc + (Number(p.siteValue) || 0), 0);
  }

  get totalClientsCount(): number {
    return this.projects.length;
  }

  // Filtered unique clients (0 duplicates, maximum 115)
  get filteredClients(): Project[] {
    let list = this.projects;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.siteId?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.orderBy?.toLowerCase().includes(q)
      );
    }
    if (this.dueFilter === 'HasDue') {
      list = list.filter(p => !this.isFullyPaid(p));
    } else if (this.dueFilter === 'Paid') {
      list = list.filter(p => this.isFullyPaid(p));
    }

    if (this.orderByFilter !== 'All') {
      list = list.filter(p => (p.orderBy || '').trim().toLowerCase() === this.orderByFilter.trim().toLowerCase());
    }

    if (this.siteIdSortDirection !== 'none') {
      const dir = this.siteIdSortDirection;
      list = [...list].sort((a, b) => {
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

  onSearchChange(): void {
    this.currentPage = 1;
    this.updateTableWidth();
  }

  onDueFilterChange(): void {
    this.currentPage = 1;
    this.updateTableWidth();
  }

  onOrderByFilterChange(): void {
    this.currentPage = 1;
    this.updateTableWidth();
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

  // Format Helper: Converts yyyy-mm-dd to dd-mm-yyyy
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

  // Format Helper: Converts dd-mm-yyyy or date picker to yyyy-mm-dd
  toIsoDate(inputStr: string | undefined): string {
    if (!inputStr) return new Date().toISOString().slice(0, 10);
    return this.normalizeToIsoDate(inputStr);
  }

  // Format Helper: Get today formatted as dd-mm-yyyy
  getTodayDisplayDate(): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  // Derive Month of Payment e.g. "Jan-26"
  deriveMoPFromDate(dateStr: string): string {
    const iso = this.toIsoDate(dateStr);
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  }

  // Calculate ordinal installment title e.g. "1st Payment", "2nd Payment", "3rd Payment"
  getOrdinalLabel(count: number): string {
    const n = count + 1;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return `${n}${suffix} Payment`;
  }

  // --- ADD NEW CLIENT ACTIONS ---
  getEmptyClientForm(): any {
    return {
      awardedDate: this.toIsoDate(this.getTodayDisplayDate()),
      siteId: '',
      clientName: '',
      location: '',
      contactNo: '',
      emailId: '',
      address: '',
      siteCapacity: '5',
      siteValue: null as number | null,
      siteType: 'Residential',
      systemType: 'On Grid',
      siteCategory: 'Tata SPG Order',
      clientType: 'Individual',
      saleType: 'B2C',
      orderBy: 'K KARTHIKEYAN',
      received: 0,
      due: 0
    };
  }

  openAddClientModal(): void {
    this.newClientForm = this.getEmptyClientForm();
    this.suggestNextSiteId();
    this.isAddClientModalOpen = true;
  }

  closeAddClientModal(): void {
    this.isAddClientModalOpen = false;
    this.savingClient = false;
  }

  suggestNextSiteId(): void {
    let maxNum = 0;
    for (const p of this.projects) {
      const m = p.siteId?.match(/(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    this.newClientForm.siteId = maxNum > 0 ? `SP${maxNum + 1}` : 'SP101';
  }

  calculateNewClientDue(): void {
    const val = Number(this.newClientForm.siteValue) || 0;
    const rec = Number(this.newClientForm.received) || 0;
    this.newClientForm.due = Math.max(0, val - rec);
  }

  saveNewClient(): void {
    if (!this.newClientForm.clientName?.trim()) {
      this.showAlert('Please enter the Client Name', 'danger');
      return;
    }
    if (!this.newClientForm.siteId?.trim()) {
      this.showAlert('Please enter the Site ID', 'danger');
      return;
    }
    const siteValue = Number(this.newClientForm.siteValue) || 0;
    if (siteValue <= 0) {
      this.showAlert('Please enter a valid Site Agreement Value', 'danger');
      return;
    }

    const initReceived = Number(this.newClientForm.received) || 0;
    this.calculateNewClientDue();
    this.savingClient = true;

    const payload = {
      ...this.newClientForm,
      siteValue: siteValue,
      received: initReceived,
      due: Math.max(0, siteValue - initReceived),
      siteExpenses: 0,
      materialsSupply: false,
      installation: false,
      ebProcess: false,
      documents: false,
      warranty: false,
      handedOver: false
    };

    this.projectService.createProject(payload).subscribe({
      next: (res) => {
        if (res.success) {
          const createdClient = res.data;
          // If initial received payment entered, record it into ClientPaymentLedger
          if (initReceived > 0) {
            const todayDisplay = this.getTodayDisplayDate();
            const mop = this.deriveMoPFromDate(todayDisplay);
            const todayIso = this.toIsoDate(todayDisplay);
            this.projectService.createPayment({
              paymentDate: todayIso,
              mop: mop || 'Current',
              siteId: createdClient.siteId,
              clientName: createdClient.clientName,
              clientSiteName: `${createdClient.siteId} : ${createdClient.siteCapacity || '3'}KW, ${createdClient.clientName}, ${createdClient.location || 'Chennai'}`,
              amount: initReceived,
              paymentMode: 'Bank Transfer / NEFT',
              remarks: 'Initial Advance / 1st Payment recorded at client registration'
            }).subscribe({
              next: () => {
                this.finishClientCreation(createdClient);
              },
              error: () => {
                this.finishClientCreation(createdClient);
              }
            });
          } else {
            this.finishClientCreation(createdClient);
          }
        } else {
          this.savingClient = false;
          this.showAlert(res.message || 'Failed to create client.', 'danger');
        }
      },
      error: (err) => {
        this.savingClient = false;
        console.error('Error creating client:', err);
        this.showAlert(err.error?.message || 'Error creating client record.', 'danger');
      }
    });
  }

  private finishClientCreation(client: Project): void {
    this.savingClient = false;
    this.closeAddClientModal();
    this.showAlert(`Client "${client.clientName}" (${client.siteId}) successfully added!`, 'success');
    this.loadProjects();
    this.loadPayments();
  }

  // --- CLIENT-SPECIFIC PAYMENT MODAL METHODS ---

  /**
   * Open the client-specific payment modal.
   * Only displays the particular client, their past payments, and allows adding/editing payments.
   */
  openClientPaymentModal(clientOrSiteId: Project | string, startAdding: boolean = false): void {
    let siteId = '';
    if (typeof clientOrSiteId === 'string') {
      siteId = clientOrSiteId.trim();
      this.selectedProjectRef = this.projects.find(p => p.siteId.toLowerCase() === siteId.toLowerCase()) || null;
    } else {
      this.selectedProjectRef = clientOrSiteId;
      siteId = clientOrSiteId.siteId;
    }

    if (!siteId) return;

    // Instant pre-population from in-memory payments
    const cleanSiteId = siteId.replace(/:/g, '').trim().toLowerCase();
    const matched = this.payments.filter(p => (p.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId);
    this.clientPaymentsList = matched.length > 0 ? [...matched] : [];

    this.isClientModalOpen = true;
    this.isAddingOrEditingPayment = false;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;

    this.loadClientPayments(siteId, startAdding);
  }

  loadClientPayments(siteId: string, triggerAddAfterLoad: boolean = false): void {
    const cleanSiteId = siteId.replace(/:/g, '').trim();
    if (this.clientPaymentsList.length === 0) {
      this.loadingClientPayments = true;
    }
    this.cdr.markForCheck();

    this.projectService.getPayments({ siteId: cleanSiteId }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.clientPaymentsList = res.data;
          
          if (this.selectedProjectRef) {
            this.selectedProjectRef.received = res.totalAmount;
            this.selectedProjectRef.due = Math.max(0, (Number(this.selectedProjectRef.siteValue) || 0) - res.totalAmount);
          }
        }
        this.loadingClientPayments = false;
        this.cdr.markForCheck();
        if (triggerAddAfterLoad) {
          this.startAddNewPayment();
        }
      },
      error: (err) => {
        console.error('Error loading client payments:', err);
        this.loadingClientPayments = false;
        if (this.clientPaymentsList.length === 0) {
          this.clientPaymentsList = this.payments.filter(p => (p.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId.toLowerCase());
        }
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Reveal the "+ Add New Payment" form specifically for this client.
   * Site ID is automatically filled and locked. Remarks auto-suggests the next installment.
   */
  startAddNewPayment(): void {
    if (!this.selectedProjectRef) return;
    if (!this.canAdd()) {
      this.showAlert('You do not have permission to add payment entries.', 'danger');
      return;
    }

    this.isAddingOrEditingPayment = true;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;
    this.editingOriginalAmount = 0;

    const nextRemark = this.getOrdinalLabel(this.clientPaymentsList.length);

    this.formData = {
      dateInput: this.getTodayDisplayDate(),
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.siteCapacity || '5'}KW, ${this.selectedProjectRef.clientName}, ${this.selectedProjectRef.location || 'Chennai'}`,
      paymentMode: 'Bank Transfer / NEFT',
      remarks: nextRemark,
      amount: null
    };

    this.scrollToPaymentForm();
  }

  /**
   * Edit an existing past payment record for this client.
   */
  startEditPastRecord(p: ClientPayment): void {
    if (!this.selectedProjectRef) return;
    if (!this.canEdit()) {
      this.showAlert('You do not have permission to edit payment entries.', 'danger');
      return;
    }

    this.isAddingOrEditingPayment = true;
    this.isEditingPastRecord = true;
    this.editingPaymentId = p.id || null;
    this.editingOriginalAmount = Number(p.amount) || 0;

    const displayDate = p.formattedDate || this.toDisplayDate(p.paymentDate);

    this.formData = {
      dateInput: displayDate,
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: p.clientSiteName || `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.clientName}`,
      paymentMode: p.paymentMode || 'Bank Transfer / NEFT',
      remarks: p.remarks || '',
      amount: p.amount
    };

    this.scrollToPaymentForm();
  }

  private scrollToPaymentForm(): void {
    setTimeout(() => {
      const el = document.getElementById('payment-form-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  }

  cancelPaymentSubForm(): void {
    this.isAddingOrEditingPayment = false;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;
    this.editingOriginalAmount = 0;
  }

  closeClientModal(): void {
    this.isClientModalOpen = false;
    this.selectedProjectRef = null;
    this.clientPaymentsList = [];
    this.cancelPaymentSubForm();
  }

  // Sum of client payments
  get clientTotalReceived(): number {
    if (!this.clientPaymentsList.length) return Number(this.selectedProjectRef?.received) || 0;
    return this.clientPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  get clientCurrentDue(): number {
    const siteVal = Number(this.selectedProjectRef?.siteValue) || 0;
    return Math.max(0, siteVal - this.clientTotalReceived);
  }

  // Live preview calculations while typing in the amount field
  get liveNewReceived(): number {
    const base = this.clientTotalReceived;
    const inputAmt = Number(this.formData.amount) || 0;
    if (this.isEditingPastRecord) {
      return base - this.editingOriginalAmount + inputAmt;
    }
    return base + inputAmt;
  }

  get liveNewDue(): number {
    const siteVal = Number(this.selectedProjectRef?.siteValue) || 0;
    return Math.max(0, siteVal - this.liveNewReceived);
  }

  submitClientPayment(): void {
    if (!this.selectedProjectRef) return;

    if (this.isEditingPastRecord && !this.canEdit()) {
      this.showAlert('You do not have permission to edit payment entries.', 'danger');
      return;
    }
    if (!this.isEditingPastRecord && !this.canAdd()) {
      this.showAlert('You do not have permission to add payment entries.', 'danger');
      return;
    }

    if (!this.formData.amount || this.formData.amount <= 0) {
      this.showAlert('Please enter a valid positive payment amount.', 'danger');
      return;
    }

    const isoDate = this.toIsoDate(this.formData.dateInput);
    const mop = this.deriveMoPFromDate(this.formData.dateInput);

    const payload: Partial<ClientPayment> = {
      siteId: this.selectedProjectRef.siteId,
      clientName: this.selectedProjectRef.clientName,
      clientSiteName: this.formData.clientSiteName || `${this.selectedProjectRef.siteId} : ${this.selectedProjectRef.clientName}`,
      paymentDate: isoDate,
      mop,
      amount: Number(this.formData.amount),
      paymentMode: this.formData.paymentMode || 'Bank Transfer / NEFT',
      remarks: this.formData.remarks || ''
    };

    if (this.isEditingPastRecord && this.editingPaymentId) {
      this.projectService.updatePayment(this.editingPaymentId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showAlert(`Payment for ${res.data.clientName} (${res.data.siteId}) updated to ₹ ${Number(res.data.amount).toLocaleString('en-IN')}. Dashboard synchronized!`, 'success');
            this.isAddingOrEditingPayment = false;
            this.loadClientPayments(this.selectedProjectRef!.siteId);
            this.loadPayments();
            this.loadProjects();
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error updating payment', 'danger')
      });
    } else {
      this.projectService.createPayment(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showAlert(`Payment of ₹ ${Number(res.data.amount).toLocaleString('en-IN')} for ${res.data.clientName} added! Dashboard Received & Due synchronized.`, 'success');
            this.isAddingOrEditingPayment = false;
            this.loadClientPayments(this.selectedProjectRef!.siteId);
            this.loadPayments();
            this.loadProjects();
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error recording payment', 'danger')
      });
    }
  }

  deleteClientPaymentRow(p: ClientPayment): void {
    if (!p.id || !this.selectedProjectRef) return;
    if (!this.canDelete()) {
      this.showAlert('You do not have permission to delete payment entries.', 'danger');
      return;
    }
    if (confirm(`Are you sure you want to delete payment of ₹ ${Number(p.amount).toLocaleString('en-IN')} (${p.remarks || 'Installment'}) for ${this.selectedProjectRef.clientName}?\n\nDashboard Received will be immediately recalculated.`)) {
      this.projectService.deletePayment(p.id).subscribe({
        next: (res) => {
          if (res.success) {
            this.showAlert('Payment removed and Dashboard balance recalculated.', 'success');
            this.loadClientPayments(this.selectedProjectRef!.siteId);
            this.loadPayments();
            this.loadProjects();
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error deleting payment', 'danger')
      });
    }
  }

  showAlert(text: string, type: 'success' | 'danger'): void {
    this.alertMessage = { text, type };
    this.cdr.markForCheck();
    setTimeout(() => {
      this.alertMessage = null;
      this.cdr.markForCheck();
    }, 6000);
  }

  deleteClientAllPayments(client: Project, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canDelete()) {
      this.showAlert('You do not have permission to delete payment entries.', 'danger');
      return;
    }
    if (!client.siteId) return;

    const currentRecv = Number(client.received) || 0;
    if (currentRecv === 0) {
      this.showAlert(`No payments recorded for ${client.clientName} (${client.siteId}) to delete.`, 'danger');
      return;
    }

    const formattedRecv = currentRecv.toLocaleString('en-IN');
    const formattedVal = (Number(client.siteValue) || 0).toLocaleString('en-IN');
    if (confirm(`Are you sure you want to delete all recorded payments (₹ ${formattedRecv}) for ${client.clientName} (${client.siteId})?\n\nThis will reset Received to ₹0 and restore Due to ₹${formattedVal} on the Dashboard.`)) {
      this.projectService.deletePaymentsBySite(client.siteId).subscribe({
        next: (res) => {
          if (res.success) {
            this.showAlert(`All payments for ${client.clientName} removed and dashboard balance recalculated.`, 'success');
            this.loadProjects();
            this.loadPayments();
            if (this.isClientModalOpen && this.selectedProjectRef?.siteId === client.siteId) {
              this.loadClientPayments(client.siteId);
            }
          }
        },
        error: (err) => this.showAlert(err.error?.message || 'Error deleting client payments', 'danger')
      });
    }
  }

  exportAllClientsPdf(): void {
    if (!this.filteredClients.length) {
      this.showAlert('No client records available to export', 'danger');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = 297;
    const margin = 14;

    // Header
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 24, pageWidth, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR - CLIENT PAYMENT & DUE RECOVERY LEDGER', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 251, 241);
    doc.text(`Unique Clients: ${this.filteredClients.length}  |  Total Received: INR ${this.totalCollections.toLocaleString('en-IN')}  |  Total Due Recoverable: INR ${this.totalDueRecoverable.toLocaleString('en-IN')}`, margin, 18);

    const headers = [['S.No', 'Site ID', 'Client Name', 'Location', 'Site Value (INR)', 'Received (INR)', 'Due Amount (INR)', 'Status']];
    const body = this.filteredClients.map((c, i) => [
      i + 1,
      c.siteId || '',
      c.clientName || '',
      c.location || '',
      c.siteValue ? Number(c.siteValue).toLocaleString('en-IN') : '0',
      c.received ? Number(c.received).toLocaleString('en-IN') : '0',
      c.due ? Number(c.due).toLocaleString('en-IN') : '0',
      this.isFullyPaid(c) ? 'Fully Paid' : 'Due Recoverable'
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 28,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { fontStyle: 'bold', cellWidth: 22 },
        2: { cellWidth: 60 },
        3: { cellWidth: 40 },
        4: { halign: 'right', cellWidth: 35 },
        5: { halign: 'right', cellWidth: 35 },
        6: { halign: 'right', cellWidth: 35 },
        7: { halign: 'center', cellWidth: 28 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          if (data.cell.raw === 'Fully Paid') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    const blobUrl = URL.createObjectURL(doc.output('blob'));
    window.open(blobUrl, '_blank');
    doc.save(`Solar_Sathlokhar_Client_Payment_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
    this.showAlert('Client Payment Ledger PDF generated successfully!', 'success');
  }

  exportToExcel(): void {
    if (!this.filteredClients || this.filteredClients.length === 0) {
      this.showAlert('No client records available to export to Excel', 'danger');
      return;
    }
    const headers = ['S.No', 'Site ID', 'Client Name', 'Location', 'Site Value (INR)', 'Received (INR)', 'Due Amount (INR)', 'Status'];
    const rows = this.filteredClients.map((c, i) => [
      i + 1,
      `"${c.siteId || ''}"`,
      `"${(c.clientName || '').replace(/"/g, '""')}"`,
      `"${(c.location || '').replace(/"/g, '""')}"`,
      c.siteValue || 0,
      c.received || 0,
      c.due || 0,
      `"${this.isFullyPaid(c) ? 'Fully Paid' : 'Due Recoverable'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Client_Payment_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
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

  exportClientStatementPdf(): void {
    if (!this.selectedProjectRef) return;
    const c = this.selectedProjectRef;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;

    // Header
    doc.setFillColor(2, 132, 199); // Blue
    doc.rect(0, 0, pageWidth, 26, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 26, pageWidth, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR - CLIENT PAYMENT STATEMENT', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(224, 242, 254);
    doc.text(`Client: ${c.clientName}  |  Site ID: ${c.siteId}  |  Date: ${new Date().toLocaleDateString('en-GB')}`, margin, 18);

    // Summary Box
    let currentY = 32;
    autoTable(doc, {
      startY: currentY,
      head: [['Site Contract Value', 'Payment Received', 'Remaining Due Balance', 'Account Status']],
      body: [
        [
          `INR ${(Number(c.siteValue) || 0).toLocaleString('en-IN')}`,
          `INR ${this.clientTotalReceived.toLocaleString('en-IN')}`,
          `INR ${this.clientCurrentDue.toLocaleString('en-IN')}`,
          this.clientCurrentDue <= 0 ? 'Fully Paid' : 'Due Recoverable'
        ]
      ],
      styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'center' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' }
    });

    const finalYSummary = (doc as any).lastAutoTable.finalY || currentY + 20;
    currentY = finalYSummary + 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(2, 132, 199);
    doc.text(`Recorded Installments & Payment History (${this.clientPaymentsList.length} Transactions)`, margin, currentY);
    currentY += 3;

    const installmentHeaders = [['#', 'Date', 'Payment Mode', 'Remarks / Milestone', 'Amount Received (INR)']];
    const installmentBody = this.clientPaymentsList.map((p, idx) => [
      idx + 1,
      p.formattedDate || this.toDisplayDate(p.paymentDate),
      p.paymentMode || 'Bank Transfer',
      p.remarks || '-',
      `INR ${(Number(p.amount) || 0).toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: installmentHeaders,
      body: installmentBody,
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 30 },
        2: { cellWidth: 45 },
        3: { cellWidth: 55 },
        4: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: [16, 185, 129] }
      }
    });

    const blobUrl = URL.createObjectURL(doc.output('blob'));
    window.open(blobUrl, '_blank');
    doc.save(`Solar_Sathlokhar_Statement_${c.siteId}_${(c.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    this.showAlert(`Statement for ${c.clientName} generated in PDF!`, 'success');
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

  // --- PERMISSION CHECKS ---
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  canAdd(): boolean {
    return this.authService.canAdd('payment-ledger') || this.authService.canAdd('finance');
  }

  canEdit(): boolean {
    return this.authService.canEdit('payment-ledger') || this.authService.canEdit('finance');
  }

  canDelete(): boolean {
    return this.authService.canDelete('payment-ledger') || this.authService.canDelete('finance');
  }

  clearAllClientPayments(): void {
    if (confirm('Are you sure you want to clear ALL client payment records? This will delete all current payment records so you can upload a clean Excel file.')) {
      this.projectService.clearAllClientPayments().subscribe({
        next: () => {
          this.showAlert('All client payment records cleared successfully.', 'success');
          this.loadProjects();
          this.loadPayments();
        },
        error: (err: any) => {
          this.showAlert('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
