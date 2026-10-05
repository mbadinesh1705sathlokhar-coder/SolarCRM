import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService, CartItem, CartSummary, INVENTORY_MATERIALS } from '../../../services/inventory.service';
import { OfficeService } from '../../../services/office.service';
import { ProjectService } from '../../../services/project.service';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface CartRowItem {
  material: string;
  quantity: number;
  unit: string;
  clientLocation?: string;
  totalAmount?: number;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private officeService = inject(OfficeService);
  private projectService = inject(ProjectService);
  private masterListService = inject(MasterListService);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  canAdd(): boolean {
    return this.authService.canAdd('inventory');
  }

  canEdit(): boolean {
    return this.authService.canEdit('inventory');
  }

  canDelete(): boolean {
    return this.authService.canDelete('inventory');
  }

  cartItems: CartItem[] = [];
  summary: CartSummary = {
    totalItems: 0,
    totalQuantity: 0,
    totalAmount: 0,
    activeSitesCount: 0,
    assignedVendorsCount: 0,
    statusCounts: {}
  };
  loading = false;
  searchTerm = '';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  cartForm: Partial<CartItem> = this.getEmptyCartItem();
  itemToDelete: CartItem | null = null;
  isDeleteModalOpen = false;

  // Batch Add State (Multiple Clients / Multiple Materials)
  cartHeader = {
    orderDate: new Date().toISOString().substring(0, 10),
    vendorName: '',
    procurementStatus: 'Yet to Start'
  };
  cartRows: CartRowItem[] = [];

  // Feedback Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Dropdown options
  projectsList: any[] = [];
  materialOptions: string[] = [...INVENTORY_MATERIALS];
  clientLocationOptions: string[] = [];
  vendorOptions: string[] = [];
  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box', 'Litre', 'Pkt'];
  statusOptions: string[] = [
    'Yet to Start',
    'Requested Vendor',
    'PO Processed',
    'Payment In Process',
    'Materials on Route',
    'Delivered to Site'
  ];

  ngOnInit(): void {
    this.loadCart();
    this.loadMasterMaterials();
    this.loadVendorsFromOffice();
    this.loadAwardedSites();
  }

  loadMasterMaterials(): void {
    this.masterListService.getList('Materials').subscribe({
      next: (res) => {
        if (res.success && res.data?.items?.length > 0) {
          this.materialOptions = Array.from(new Set([...res.data.items, ...this.materialOptions]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  get availableMaterialOptions(): string[] {
    if (this.cartForm.clientLocation || this.cartRows.some(r => r.clientLocation)) {
      const targetClient = this.cartForm.clientLocation || (this.cartRows.find(r => r.clientLocation)?.clientLocation || '');
      const selectedProj = this.projectsList.find(p => 
        targetClient.toLowerCase().includes((p.clientName || '').toLowerCase().trim()) ||
        targetClient.toLowerCase().includes((p.siteId || '').toLowerCase().trim())
      );
      if (selectedProj && selectedProj.bomItems) {
        let itemsArr: any[] = [];
        if (typeof selectedProj.bomItems === 'string') {
          try { itemsArr = JSON.parse(selectedProj.bomItems); } catch(e) {}
        } else if (Array.isArray(selectedProj.bomItems)) {
          itemsArr = selectedProj.bomItems;
        }

        if (itemsArr.length > 0) {
          const bomOpts = itemsArr.map(b => {
            const grp = b.materialGroup || '';
            const sub = b.categoryType || '';
            const spec = b.specification || '';
            const parts = [grp, sub, spec].filter(Boolean);
            return parts.join(' - ') || grp || spec;
          });
          return Array.from(new Set(bomOpts));
        }
      }
    }
    return this.materialOptions;
  }

  loadAwardedSites(): void {
    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          this.projectsList = res.data;
          this.clientLocationOptions = res.data.map(p => 
            `${p.siteId} : ${p.clientName}${p.location ? ' (' + p.location + ')' : ''}`
          );
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadCart(): void {
    this.loading = true;
    this.inventoryService.getCartItems().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.cartItems = res.data;
          this.summary = res.summary;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load cart items.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  loadVendorsFromOffice(): void {
    const cached = this.officeService.getCachedVendors();
    if (cached && cached.length > 0) {
      const names = cached.map(v => v.vendorName).filter(Boolean);
      this.vendorOptions = Array.from(new Set(names));
      this.cdr.markForCheck();
    }

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

  get filteredCartItems(): CartItem[] {
    if (!this.searchTerm.trim()) return this.cartItems;
    const term = this.searchTerm.trim().toLowerCase();
    return this.cartItems.filter(item =>
      (item.material || '').toLowerCase().includes(term) ||
      (item.clientLocation || '').toLowerCase().includes(term) ||
      (item.vendorName || '').toLowerCase().includes(term) ||
      (item.procurementStatus || '').toLowerCase().includes(term) ||
      (item.orderDate || '').includes(term)
    );
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add items to cart.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.cartHeader = {
      orderDate: new Date().toISOString().substring(0, 10),
      vendorName: '',
      procurementStatus: 'Yet to Start'
    };
    this.cartRows = [
      { material: '', quantity: 1, unit: 'Nos', totalAmount: null as any }
    ];
    this.loadVendorsFromOffice();
    this.isModalOpen = true;
  }

  addCartRow(): void {
    this.cartRows.push({
      material: '',
      quantity: 1,
      unit: 'Nos',
      totalAmount: null as any
    });
  }

  removeCartRow(index: number): void {
    if (this.cartRows.length > 1) {
      this.cartRows.splice(index, 1);
    } else {
      this.cartRows[0] = {
        material: '',
        quantity: 1,
        unit: 'Nos',
        totalAmount: null as any
      };
    }
  }

  get grandTotalQuantity(): number {
    return this.cartRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }

  get grandTotalAmount(): number {
    return this.cartRows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  }

  openEditModal(item: CartItem): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit cart items.', 'danger');
      return;
    }
    this.isEditMode = true;
    this.cartForm = { ...item };
    this.loadVendorsFromOffice();
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.cartForm = this.getEmptyCartItem();
    this.cartRows = [];
  }

  saveCartItem(): void {
    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'danger');
      return;
    }

    if (this.isEditMode) {
      if (!this.cartForm.material?.trim()) {
        this.showToast('Material name is required.', 'danger');
        return;
      }

      if (this.cartForm.id) {
        this.inventoryService.updateCartItem(this.cartForm.id, this.cartForm).subscribe({
          next: (res) => {
            if (res.success) {
              this.showToast('Cart item updated successfully!', 'success');
              this.closeModal();
              this.loadCart();
            }
            this.cdr.markForCheck();
          },
          error: () => this.showToast('Failed to update cart item.', 'danger')
        });
      }
      return;
    }

    // Add Mode (Multiple Materials)
    if (!this.cartHeader.orderDate) {
      this.showToast('Order Date is required.', 'danger');
      return;
    }

    const validRows = this.cartRows.filter(r => r.material && r.material.trim());
    if (validRows.length === 0) {
      this.showToast('Please select at least one material.', 'danger');
      return;
    }

    const payload = {
      orderDate: this.cartHeader.orderDate,
      vendorName: this.cartHeader.vendorName,
      procurementStatus: this.cartHeader.procurementStatus,
      items: validRows
    };

    this.inventoryService.createCartItem(payload).subscribe({
      next: (res) => {
        if (res.success) {
          const count = res.count || validRows.length;
          this.showToast(`${count} material(s) added to cart!`, 'success');
          this.closeModal();
          this.loadCart();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to add materials to cart.', 'danger')
    });
  }

  confirmDelete(item: CartItem): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete cart items.', 'danger');
      return;
    }
    this.itemToDelete = item;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.itemToDelete = null;
    this.isDeleteModalOpen = false;
  }

  deleteCartItem(): void {
    if (!this.itemToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete cart items.', 'danger');
      return;
    }
    const id = this.itemToDelete.id;
    this.inventoryService.deleteCartItem(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Item removed from cart.', 'success');
          this.closeDeleteModal();
          this.loadCart();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete cart item.', 'danger')
    });
  }

  getEmptyCartItem(): Partial<CartItem> {
    return {
      orderDate: new Date().toISOString().substring(0, 10),
      material: '',
      clientLocation: '',
      quantity: 1,
      unit: 'Nos',
      vendorName: '',
      procurementStatus: 'Yet to Start',
      totalAmount: 0
    };
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

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 4000);
  }

  exportCartPdf(): void {
    const list = this.filteredCartItems;
    if (list.length === 0) {
      this.showToast('No cart items available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - PROCUREMENT CART REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Items: ${list.length} | Total Value: ₹ ${(this.summary.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Order Date', 'Material Name', 'Client / Site Location', 'Qty & Unit', 'Assigned Vendor', 'Procurement Status', 'Total (₹)']
    ];

    const body = list.map((item, idx) => [
      idx + 1,
      this.formatDate(item.orderDate),
      item.material || '',
      item.clientLocation || '—',
      `${item.quantity} ${item.unit}`,
      item.vendorName || 'Unassigned',
      item.procurementStatus || 'Yet to Start',
      Number(item.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 7: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Procurement_Cart_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Procurement Cart PDF exported successfully!', 'success');
  }

  exportToExcel(): void {
    const list = this.filteredCartItems;
    if (list.length === 0) return;
    const headers = ['S.No', 'Order Date', 'Material Name', 'Client / Site Location', 'Qty & Unit', 'Assigned Vendor', 'Procurement Status', 'Total (₹)'];
    const rows = list.map((item, idx) => [
      idx + 1,
      `"${this.formatDate(item.orderDate)}"`,
      `"${item.material || ''}"`,
      `"${item.clientLocation || ''}"`,
      `"${item.quantity} ${item.unit}"`,
      `"${item.vendorName || ''}"`,
      `"${item.procurementStatus || ''}"`,
      item.totalAmount || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Procurement_Cart_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportCartPdf();
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
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawRows || rawRows.length === 0) {
          this.showToast('The uploaded Excel file contains no data rows.', 'danger');
          return;
        }

        const today = new Date().toISOString().substring(0, 10);

        const cartBatch: Partial<CartItem>[] = rawRows.map((row, idx) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const parseNum = (keys: string[]) => {
            const valStr = getVal(keys);
            if (!valStr) return 0;
            return parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
          };

          const clientName = getVal(['client name', 'client', 'name']) || 'Client';
          const siteEngineer = getVal(['site engineer', 'engineer', 'order by']) || 'Site Engineer';
          const materialName = getVal(['material name', 'material', 'item']) || 'Solar Cables';
          const quantity = parseNum(['quantity', 'qty']) || 10;
          const unit = getVal(['unit', 'uom']) || 'Meter';

          return {
            orderDate: today,
            clientName,
            siteEngineer,
            materials: [
              {
                materialName,
                quantity,
                unit,
                status: 'Pending',
                poWo: false
              }
            ]
          };
        });

        let completed = 0;
        this.showToast(`Importing ${cartBatch.length} cart items from Excel...`, 'info');

        cartBatch.forEach(item => {
          this.inventoryService.createCartItem(item as any).subscribe({
            next: () => {
              completed++;
              if (completed === cartBatch.length) {
                this.loadCart();
                this.showToast(`Successfully imported ${completed} cart items from Excel!`, 'success');
              }
            },
            error: () => {
              completed++;
              if (completed === cartBatch.length) {
                this.loadCart();
                this.showToast(`Imported ${completed} cart items from Excel.`, 'success');
              }
            }
          });
        });

        input.value = '';
      } catch (err: any) {
        console.error('Excel upload error:', err);
        this.showToast('Failed to parse Excel file: ' + err.message, 'danger');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  clearAllCart(): void {
    if (confirm('Are you sure you want to clear ALL cart items? This will delete all current cart items so you can upload a clean Excel file.')) {
      this.inventoryService.clearAllCart().subscribe({
        next: () => {
          this.showToast('All cart items cleared successfully.', 'success');
          this.loadCart();
        },
        error: (err) => {
          this.showToast('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
