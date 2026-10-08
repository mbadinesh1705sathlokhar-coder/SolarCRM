import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService, Inward, InwardItem, INVENTORY_MATERIALS } from '../../../services/inventory.service';
import { OfficeService } from '../../../services/office.service';
import { ProjectService } from '../../../services/project.service';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-inward',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './inward.component.html',
  styleUrls: ['./inward.component.css']
})
export class InwardComponent implements OnInit {
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
    return this.authService.canAdd('inward');
  }

  canEdit(): boolean {
    return this.authService.canEdit('inward');
  }

  canDelete(): boolean {
    return this.authService.canDelete('inward');
  }

  canViewPricing(): boolean {
    return this.authService.canViewPricing();
  }

  inwards: Inward[] = [];
  loading = false;
  searchTerm = '';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  inwardForm: Partial<Inward> = this.getEmptyInward();
  inwardToDelete: Inward | null = null;
  isDeleteModalOpen = false;

  // Multi-item materials selection per Inward
  inwardMaterials: InwardItem[] = [];
  stockMaterialOptions: string[] = [...INVENTORY_MATERIALS];

  // BOM Material Master & Group state
  bomMaterialsMasterList: any[] = [];
  bomGroupMap: { [key: string]: any[] } = {};
  bomGroupKeys: string[] = [];
  projectsList: any[] = [];

  // Feedback Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box', 'Lot'];
  engineers: string[] = ['Soundarajan', 'Sathish', 'V Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Rahul', 'Vairamani'];
  vendorOptions: string[] = [];

  // View Descriptions Modal State
  isViewDescriptionsOpen = false;
  selectedInwardForView: Inward | null = null;

  // Searchable Supplier / Vendor Dropdown State
  supplierDropdownOpen = false;

  get filteredSupplierOptions(): string[] {
    const q = (this.inwardForm.supplierName || '').toLowerCase().trim();
    if (!q) return this.vendorOptions;
    return this.vendorOptions.filter(v => v.toLowerCase().includes(q));
  }

  openSupplierDropdown(): void {
    this.supplierDropdownOpen = true;
    this.cdr.markForCheck();
  }

  closeSupplierDropdown(): void {
    setTimeout(() => {
      this.supplierDropdownOpen = false;
      this.cdr.markForCheck();
    }, 200);
  }

  toggleSupplierDropdown(event: MouseEvent): void {
    event.preventDefault();
    this.supplierDropdownOpen = !this.supplierDropdownOpen;
    this.cdr.markForCheck();
  }

  selectSupplier(vendor: string): void {
    this.inwardForm.supplierName = vendor;
    this.supplierDropdownOpen = false;
    this.cdr.markForCheck();
  }

  clearSupplierSelection(): void {
    this.inwardForm.supplierName = '';
    this.supplierDropdownOpen = true;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.loadInwards();
    this.loadWarehouseStockOptions();
    this.loadMasterMaterials();
    this.loadBomMaterialsMaster();
    this.loadVendorsFromAddList();
    this.loadEngineersFromOffice();
  }

  loadVendorsFromAddList(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const vList = res.data.find(l => {
            const t = l.title.toLowerCase().trim();
            return t === 'vendors' || t === 'vendor name' || t === 'vendor';
          });
          if (vList?.items && vList.items.length > 0) {
            this.vendorOptions = vList.items;
            this.cdr.markForCheck();
            return;
          }
        }
        // Fallback to office vendors
        this.officeService.getVendors().subscribe({
          next: (vRes) => {
            if (vRes.success && vRes.data?.length > 0) {
              this.vendorOptions = vRes.data.map(v => v.vendorName).filter(Boolean);
              this.cdr.markForCheck();
            }
          }
        });
      }
    });
  }

  loadInwards(): void {
    this.loading = true;
    this.inventoryService.getInwards().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.inwards = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load inward entries', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  loadWarehouseStockOptions(): void {
    this.inventoryService.getWarehouseMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const existingNames = res.data.map(m => m.materialName).filter(Boolean);
          this.stockMaterialOptions = Array.from(new Set([...this.stockMaterialOptions, ...existingNames]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadMasterMaterials(): void {
    this.masterListService.getList('Materials').subscribe({
      next: (res: any) => {
        if (res?.data?.items && res.data.items.length > 0) {
          this.stockMaterialOptions = Array.from(new Set([...this.stockMaterialOptions, ...res.data.items]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadBomMaterialsMaster(): void {
    this.masterListService.getBomMaterials().subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.bomMaterialsMasterList = res.data;
          this.bomGroupMap = res.grouped || {};
          this.bomGroupKeys = Object.keys(this.bomGroupMap).length > 0 ? Object.keys(this.bomGroupMap) : Object.keys(this.buildBomGroupMap());
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  buildBomGroupMap(): { [key: string]: any[] } {
    const map: { [key: string]: any[] } = {};
    for (const item of this.bomMaterialsMasterList) {
      const g = item.groupName || 'Other';
      if (!map[g]) map[g] = [];
      map[g].push(item);
    }
    this.bomGroupMap = map;
    this.bomGroupKeys = Object.keys(map).sort();
    return map;
  }

  loadEngineersFromOffice(): void {
    this.masterListService.getList('Engineer').subscribe({
      next: (res: any) => {
        if (res?.data?.items && res.data.items.length > 0) {
          this.engineers = Array.from(new Set([...res.data.items, ...this.engineers]));
          this.cdr.markForCheck();
        }
      }
    });

    this.officeService.getEmployees().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const isSiteEngineer = (designation?: string) => {
            if (!designation) return false;
            const d = designation.toLowerCase().trim();
            if (d.includes('development') || d.includes('admin') || d.includes('sales') || d.includes('executive')) {
              return false;
            }
            return d.includes('engineer') || d.includes('manager');
          };
          const filtered = res.data
            .filter(e => isSiteEngineer(e.designation))
            .map(e => e.name);
          if (filtered.length > 0) {
            this.engineers = Array.from(new Set([...filtered, ...this.engineers]));
          }
          this.cdr.markForCheck();
        }
      }
    });
  }

  formatBomMaterialName(grp?: string, cat?: string, spec?: string): string {
    const c = (cat || '').trim();
    const s = (spec || '').trim();
    const g = (grp || '').trim();
    if (!s && !c) return g || 'Material';
    if (!c || c.toLowerCase() === 'standard') return s || g;
    if (!s) return c;
    if (s.toLowerCase().startsWith(c.toLowerCase())) return s;
    return `${c} ${s}`;
  }

  cleanMaterialName(name?: string): string {
    if (!name) return '';
    let cleaned = name;
    const masterGroups = this.getAvailableMaterialGroups();
    for (const g of masterGroups) {
      const regex = new RegExp(`^${g}\\s*-\\s*`, 'i');
      cleaned = cleaned.replace(regex, '').trim();
    }
    return cleaned;
  }

  cleanDescription(desc?: string): string {
    if (!desc) return '';
    let cleaned = desc.replace(/\s*\([\d.]+\s*[A-Za-z]+\)/g, '');
    const masterGroups = this.getAvailableMaterialGroups();
    for (const g of masterGroups) {
      const regex = new RegExp(`(^|,\\s*)${g}\\s*-\\s*`, 'gi');
      cleaned = cleaned.replace(regex, '$1');
    }
    return cleaned;
  }

  get filteredInwards(): Inward[] {
    if (!this.searchTerm.trim()) return this.inwards;
    const term = this.searchTerm.trim().toLowerCase();
    return this.inwards.filter(inw =>
      (inw.inwardNo || '').toLowerCase().includes(term) ||
      (inw.descriptions || '').toLowerCase().includes(term) ||
      (inw.supplierName || inw.clientName || '').toLowerCase().includes(term) ||
      (inw.receivedBy || inw.siteEngineer || '').toLowerCase().includes(term) ||
      (inw.inwardDate || '').includes(term) ||
      (inw.remarks || '').toLowerCase().includes(term) ||
      (inw.items && inw.items.some(it => (it.materialName || '').toLowerCase().includes(term)))
    );
  }

  getAvailableMaterialGroups(): string[] {
    const masterGroups = this.bomGroupKeys.length > 0
      ? this.bomGroupKeys
      : ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree'];
    return masterGroups;
  }

  getAvailableCategoryTypes(groupName?: string): string[] {
    const normGrp = (groupName || '').toLowerCase().trim();
    if (!normGrp) return ['Standard'];

    const matches = this.bomMaterialsMasterList.filter(b => (b.groupName || '').toLowerCase().trim() === normGrp);
    if (matches.length > 0) {
      const types = Array.from(new Set(matches.map(m => m.categoryType || 'Standard')));
      return types.length > 0 ? types : ['Standard'];
    }
    if (normGrp === 'cables') return ['AC Cable', 'DC Cable'];
    if (normGrp === 'panels') return ['Mono PERC', 'TOPCon', 'Polycrystalline'];
    if (normGrp === 'inverters') return ['On Grid', 'Hybrid'];
    return ['Standard'];
  }

  getAvailableSpecs(groupName?: string, categoryType?: string): string[] {
    const normGrp = (groupName || '').toLowerCase().trim();
    const normType = (categoryType || '').toLowerCase().trim();
    if (!normGrp) return [];

    let matches = this.bomMaterialsMasterList.filter(b => (b.groupName || '').toLowerCase().trim() === normGrp);
    if (normType && normType !== 'standard') {
      const filtered = matches.filter(b => (b.categoryType || '').toLowerCase().trim() === normType);
      if (filtered.length > 0) matches = filtered;
    }
    if (matches.length > 0) {
      return Array.from(new Set(matches.map(m => m.specification).filter(Boolean)));
    }
    return [];
  }

  onMaterialGroupChange(m: InwardItem): void {
    const grp = m.materialGroup || '';
    const types = this.getAvailableCategoryTypes(grp);
    m.categoryType = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, m.categoryType);
    m.specification = specs[0] || '';
    this.updateMaterialRowFromSpec(m);
  }

  onSpecificationChange(m: InwardItem): void {
    this.updateMaterialRowFromSpec(m);
  }

  updateMaterialRowFromSpec(m: InwardItem): void {
    const grp = m.materialGroup || '';
    const cat = m.categoryType || 'Standard';
    const spec = m.specification || '';
    m.materialName = this.formatBomMaterialName(grp, cat, spec);

    if (grp.toLowerCase() === 'cables') {
      m.unit = 'Meter';
    } else if (!m.unit) {
      m.unit = 'Nos';
    }

    const match = this.bomMaterialsMasterList.find(b =>
      (b.specification || '').toLowerCase().trim() === spec.toLowerCase().trim()
    );
    if (match) {
      if (match.uom && !m.unit) m.unit = match.uom;
      if (match.rate && (!m.rate || m.rate === 0)) {
        m.rate = Number(match.rate);
      }
    }
    this.calculateRowAmount(m);
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to create inward entries.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.inwardForm = this.getEmptyInward();
    const today = new Date().toISOString().substring(0, 10);
    const groups = this.getAvailableMaterialGroups();
    const grp = groups[0] || 'Cables';
    const types = this.getAvailableCategoryTypes(grp);
    const cat = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, cat);
    const spec = specs[0] || '';
    const autoName = this.formatBomMaterialName(grp, cat, spec);

    const row: InwardItem = {
      inwardDate: today,
      materialName: autoName,
      materialGroup: grp,
      categoryType: cat,
      specification: spec,
      unit: grp.toLowerCase() === 'cables' ? 'Meter' : 'Nos',
      quantity: 1,
      rate: 0,
      vendorName: this.vendorOptions[0] || '',
      amount: 0
    };
    this.updateMaterialRowFromSpec(row);
    this.inwardMaterials = [row];
    this.isModalOpen = true;
  }

  openEditModal(inw: Inward): void {
    this.isEditMode = true;
    this.inwardForm = { ...inw };
    if (!this.inwardForm.supplierName && inw.clientName) {
      this.inwardForm.supplierName = inw.clientName;
    }
    if (!this.inwardForm.receivedBy && inw.siteEngineer) {
      this.inwardForm.receivedBy = inw.siteEngineer;
    }
    const defaultDate = inw.inwardDate || new Date().toISOString().substring(0, 10);
    if (inw.items && inw.items.length > 0) {
      this.inwardMaterials = inw.items.map(m => {
        const q = parseFloat(m.quantity as any) || 0;
        const r = parseFloat(m.rate as any) || 0;
        const a = m.amount !== undefined && m.amount !== null ? (parseFloat(m.amount as any) || 0) : Math.round(q * r * 100) / 100;

        let grp = m.materialGroup || '';
        let cat = m.categoryType || '';
        let spec = m.specification || '';

        if (!grp && m.materialName) {
          const parts = m.materialName.split(' - ').map(s => s.trim());
          if (parts.length >= 3) {
            grp = parts[0];
            cat = parts[1];
            spec = parts.slice(2).join(' - ');
          } else if (parts.length === 2) {
            grp = parts[0];
            cat = 'Standard';
            spec = parts[1];
          } else {
            grp = m.materialName;
            cat = 'Standard';
            spec = m.materialName;
          }
        }

        return {
          ...m,
          materialGroup: grp,
          categoryType: cat || 'Standard',
          specification: spec || m.materialName,
          inwardDate: m.inwardDate || defaultDate,
          unit: m.unit || 'Nos',
          quantity: q,
          rate: r,
          vendorName: m.vendorName || (this.vendorOptions[0] || ''),
          amount: a
        };
      });
    } else {
      const groups = this.getAvailableMaterialGroups();
      const grp = groups[0] || 'Cables';
      const types = this.getAvailableCategoryTypes(grp);
      const cat = types[0] || 'Standard';
      const specs = this.getAvailableSpecs(grp, cat);
      const spec = specs[0] || '';
      const autoName = this.formatBomMaterialName(grp, cat, spec);

      const row: InwardItem = {
        inwardDate: defaultDate,
        materialName: inw.descriptions || autoName,
        materialGroup: grp,
        categoryType: cat,
        specification: spec,
        unit: inw.unit || 'Nos',
        quantity: inw.quantity || 1,
        rate: 0,
        vendorName: this.vendorOptions[0] || '',
        amount: 0
      };
      this.inwardMaterials = [row];
    }
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.supplierDropdownOpen = false;
    this.inwardForm = this.getEmptyInward();
    this.inwardMaterials = [];
  }

  openDescriptionsModal(inw: Inward): void {
    this.selectedInwardForView = inw;
    this.isViewDescriptionsOpen = true;
    this.cdr.markForCheck();
  }

  closeDescriptionsModal(): void {
    this.isViewDescriptionsOpen = false;
    this.selectedInwardForView = null;
    this.cdr.markForCheck();
  }

  editFromViewModal(inw: Inward): void {
    this.closeDescriptionsModal();
    this.openEditModal(inw);
  }

  addMaterialRow(): void {
    const defaultDate = this.inwardForm.inwardDate || new Date().toISOString().substring(0, 10);
    const groups = this.getAvailableMaterialGroups();
    const grp = groups[0] || 'Cables';
    const types = this.getAvailableCategoryTypes(grp);
    const cat = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, cat);
    const spec = specs[0] || '';
    const autoName = this.formatBomMaterialName(grp, cat, spec);

    const newRow: InwardItem = {
      inwardDate: defaultDate,
      materialName: autoName,
      materialGroup: grp,
      categoryType: cat,
      specification: spec,
      unit: grp.toLowerCase() === 'cables' ? 'Meter' : 'Nos',
      quantity: 1,
      rate: 0,
      vendorName: this.vendorOptions[0] || '',
      amount: 0
    };
    this.updateMaterialRowFromSpec(newRow);
    this.inwardMaterials.push(newRow);
  }

  removeMaterialRow(index: number): void {
    this.inwardMaterials.splice(index, 1);
  }

  calculateRowAmount(m: InwardItem): void {
    const q = parseFloat(m.quantity as any) || 0;
    const r = parseFloat(m.rate as any) || 0;
    m.amount = Math.round(q * r * 100) / 100;
  }

  getMaterialsTotal(): number {
    return this.inwardMaterials.reduce((sum, m) => {
      const q = parseFloat(m.quantity as any) || 0;
      const r = parseFloat(m.rate as any) || 0;
      const a = m.amount !== undefined && m.amount !== null ? (parseFloat(m.amount as any) || 0) : (q * r);
      return sum + a;
    }, 0);
  }

  getTotalAmount(): number {
    return this.getMaterialsTotal();
  }

  getInwardTotal(inw: Inward): number {
    if (inw.totalAmount !== undefined && inw.totalAmount !== null && Number(inw.totalAmount) > 0) {
      return Number(inw.totalAmount);
    }
    let sum = 0;
    if (inw.items && inw.items.length > 0) {
      sum = inw.items.reduce((s, it) => {
        const q = parseFloat(it.quantity as any) || 0;
        const r = parseFloat(it.rate as any) || 0;
        const a = it.amount !== undefined && it.amount !== null ? (parseFloat(it.amount as any) || 0) : (q * r);
        return s + a;
      }, 0);
    }
    return Math.round(sum * 100) / 100;
  }

  saveInward(): void {
    if (!this.inwardForm.supplierName?.trim()) {
      this.showToast('Supplier / Vendor Name is required.', 'danger');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'danger');
      return;
    }

    const validMaterials = this.inwardMaterials.filter(m => !!m.materialName?.trim());
    if (validMaterials.length === 0) {
      this.showToast('Please add at least one received material.', 'danger');
      return;
    }

    validMaterials.forEach(m => this.calculateRowAmount(m));

    const descriptions = validMaterials.map(m => `${m.materialName} (${m.quantity} ${m.unit})`).join(', ');
    const quantity = validMaterials.length === 1 ? (parseFloat(validMaterials[0].quantity as any) || 1) : 0;
    const unit = validMaterials.length === 1 ? validMaterials[0].unit : `${validMaterials.length} Items`;
    const totalAmount = this.getTotalAmount();

    const payload: Partial<Inward> = {
      ...this.inwardForm,
      descriptions,
      quantity,
      unit,
      totalAmount,
      items: validMaterials
    };

    if (this.isEditMode && this.inwardForm.id) {
      this.inventoryService.updateInward(this.inwardForm.id, payload).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.inwards.findIndex(g => g.id === this.inwardForm.id);
            if (idx !== -1) {
              this.inwards[idx] = res.data;
            }
            this.showToast('Inward entry updated and Warehouse stock recalculated!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update inward entry.', 'danger')
      });
    } else {
      this.inventoryService.createInward(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.inwards.unshift(res.data);
            this.showToast('Inward entry recorded & automatically added to Warehouse stock!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to create inward entry.', 'danger')
      });
    }
  }

  confirmDelete(inw: Inward): void {
    this.inwardToDelete = inw;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.inwardToDelete = null;
    this.isDeleteModalOpen = false;
  }

  deleteInward(): void {
    if (!this.inwardToDelete || !this.inwardToDelete.id) return;
    const id = this.inwardToDelete.id;
    this.inventoryService.deleteInward(id).subscribe({
      next: () => {
        this.inwards = this.inwards.filter(g => g.id !== id);
        this.showToast('Inward entry deleted and stock automatically reverted from Warehouse.', 'success');
        this.closeDeleteModal();
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete inward entry.', 'danger')
    });
  }

  clearAllInwards(): void {
    if (!confirm('Are you sure you want to clear all inward entries?')) return;
    this.inventoryService.clearAllInwards().subscribe({
      next: (res) => {
        if (res.success) {
          this.inwards = [];
          this.showToast('All inward entries cleared successfully.', 'info');
          this.cdr.markForCheck();
        }
      },
      error: () => this.showToast('Failed to clear inward entries.', 'danger')
    });
  }

  getEmptyInward(): Partial<Inward> {
    return {
      inwardNo: '',
      inwardDate: new Date().toISOString().substring(0, 10),
      descriptions: '',
      unit: 'Nos',
      quantity: 1,
      supplierName: '',
      receivedBy: 'Soundarajan',
      remarks: '',
      transportCost: 0
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

  exportInwardPdf(): void {
    const list = this.filteredInwards;
    if (list.length === 0) {
      this.showToast('No inward entries available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - GOODS INWARD STOCK RECEIPT REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Inwards: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const showPrice = this.canViewPricing();
    const headers = showPrice
      ? [['S.No', 'Inward No', 'Date', 'Supplier / Vendor', 'Received By', 'Received Materials', 'Qty & Unit', 'Total Amount', 'Remarks']]
      : [['S.No', 'Inward No', 'Date', 'Supplier / Vendor', 'Received By', 'Received Materials', 'Qty & Unit', 'Remarks']];

    const body = list.map((inw, idx) => {
      let matDetails = inw.descriptions || '';
      if (inw.items && inw.items.length > 0) {
        matDetails = inw.items.map(it => {
          let line = `${this.cleanMaterialName(it.materialName)} (${it.quantity} ${it.unit})`;
          if (it.inwardDate) line += ` [${this.formatDate(it.inwardDate)}]`;
          if (showPrice) {
            if (it.rate) line += ` @ Rs.${it.rate}`;
            if (it.vendorName) line += ` [Vendor: ${it.vendorName}]`;
          }
          return line;
        }).join('\n');
      }
      const totalAmt = this.getInwardTotal(inw);
      const inwNoStr = inw.inwardNo || (inw.id ? `INW-${inw.id}` : '—');
      if (showPrice) {
        return [
          idx + 1,
          inwNoStr,
          this.formatDate(inw.inwardDate),
          inw.supplierName || inw.clientName || '',
          inw.receivedBy || inw.siteEngineer || '',
          matDetails,
          `${inw.quantity || 1} ${inw.unit || 'Nos'}`,
          totalAmt > 0 ? `Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
          inw.remarks || '—'
        ];
      } else {
        return [
          idx + 1,
          inwNoStr,
          this.formatDate(inw.inwardDate),
          inw.supplierName || inw.clientName || '',
          inw.receivedBy || inw.siteEngineer || '',
          matDetails,
          `${inw.quantity || 1} ${inw.unit || 'Nos'}`,
          inw.remarks || '—'
        ];
      }
    });

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Inventory_Inwards_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Inward PDF exported successfully!', 'success');
  }

  exportCurrentInwardPdf(): void {
    if (this.inwardForm?.supplierName) {
      const inw: Inward = {
        ...this.inwardForm,
        items: [...(this.inwardMaterials || [])]
      } as Inward;
      this.downloadSingleInwardPdf(inw);
    } else {
      this.exportInwardPdf();
    }
  }

  downloadSingleInwardPdf(inw: Inward | null): void {
    if (!inw) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;

    // Header Banner
    doc.setFillColor(15, 118, 110); // Teal brand tone
    doc.rect(0, 0, pageWidth, 26, 'F');
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 26, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 251, 241);
    doc.text('GOODS INWARD RECEIPT & WAREHOUSE STOCK ADDITION NOTE', margin, 17);

    doc.setFontSize(8);
    doc.setTextColor(240, 253, 250);
    doc.text(`Receipt Date: ${this.formatDate(inw.inwardDate)} | Voucher: ${inw.inwardNo || ('INW-' + inw.id)}`, pageWidth - margin, 11, { align: 'right' });

    let currentY = 35;

    // Info Box
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    doc.text('SUPPLIER / VENDOR:', margin + 4, currentY + 7);
    doc.text('RECEIVED BY:', margin + 4, currentY + 15);
    doc.text('INWARD NO:', pageWidth / 2 + 10, currentY + 7);
    doc.text('DATE:', pageWidth / 2 + 10, currentY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(inw.supplierName || inw.clientName || 'Vendor', margin + 40, currentY + 7);
    doc.text(inw.receivedBy || inw.siteEngineer || 'Soundarajan', margin + 40, currentY + 15);
    doc.text(inw.inwardNo || (inw.id ? `INW-${inw.id}` : 'Pending'), pageWidth / 2 + 35, currentY + 7);
    doc.text(this.formatDate(inw.inwardDate), pageWidth / 2 + 35, currentY + 15);

    if (inw.remarks) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Remarks: ${inw.remarks}`, margin + 4, currentY + 22);
    }

    currentY += 33;

    // Materials Table
    const items = inw.items && inw.items.length > 0 ? inw.items : [];
    const tableBody = items.map((it, idx) => [
      idx + 1,
      this.formatDate(it.inwardDate || inw.inwardDate),
      it.materialName || 'Material',
      it.quantity || 1,
      it.unit || 'Nos'
    ]);

    autoTable(doc, {
      head: [['#', 'Date', 'Received Material / Specification', 'Qty', 'Unit']],
      body: tableBody,
      startY: currentY,
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 32 },
        2: { fontStyle: 'bold', cellWidth: 90 },
        3: { halign: 'center', cellWidth: 24 },
        4: { halign: 'center', cellWidth: 22 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 18;
    if (currentY + 25 > 280) {
      doc.addPage();
      currentY = 25;
    }

    // Signatures
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, currentY, margin + 45, currentY);
    doc.line(margin + 65, currentY, margin + 115, currentY);
    doc.line(margin + 135, currentY, margin + 180, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Delivered / Supplier Sign', margin, currentY + 4);
    doc.text('Vehicle / Security Check', margin + 65, currentY + 4);
    doc.text('Warehouse Inward Manager', margin + 135, currentY + 4);

    const safeSupplier = (inw.supplierName || 'Inward').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    doc.save(`Inward_Receipt_${safeSupplier}_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast(`Inward Receipt PDF for ${inw.supplierName || 'Inward'} generated successfully!`, 'success');
  }

  exportToExcel(): void {
    const list = this.filteredInwards;
    if (list.length === 0) return;
    const headers = ['S.No', 'Inward No', 'Date', 'Supplier / Vendor', 'Received By', 'Status'];
    const rows = list.map((inw, idx) => [
      idx + 1,
      `"${inw.inwardNo || (inw.id ? 'INW-' + inw.id : '')}"`,
      `"${this.formatDate(inw.inwardDate)}"`,
      `"${inw.supplierName || inw.clientName || ''}"`,
      `"${inw.receivedBy || inw.siteEngineer || ''}"`,
      '"Received & Stock Added"'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventory_Inwards_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportInwardPdf();
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

        const inwardsBatch: Partial<Inward>[] = rawRows.map((row) => {
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

          const inwardNo = getVal(['inward no', 'inwardno', 'invoice no', 'bill no']) || '';
          const inwardDate = getVal(['inward date', 'date', 'received date']) || today;
          const supplierName = getVal(['supplier name', 'supplier', 'vendor name', 'vendor']) || 'Supplier';
          const receivedBy = getVal(['received by', 'receiver', 'site engineer', 'engineer']) || 'Soundarajan';
          const remarks = getVal(['remarks', 'description', 'notes']) || 'Imported from Excel';
          const materialName = getVal(['material name', 'material', 'item']) || 'Solar Material';
          const quantity = parseNum(['quantity', 'qty']) || 10;
          const unit = getVal(['unit', 'uom']) || 'Nos';

          return {
            inwardNo: inwardNo || undefined,
            inwardDate,
            supplierName,
            receivedBy,
            remarks,
            items: [
              {
                materialName,
                quantity,
                unit
              }
            ]
          };
        });

        let completed = 0;
        this.showToast(`Importing ${inwardsBatch.length} inward records from Excel...`, 'info');

        inwardsBatch.forEach(inw => {
          this.inventoryService.createInward(inw).subscribe({
            next: (res) => {
              completed++;
              if (res.success && res.data) {
                this.inwards.unshift(res.data);
              }
              if (completed === inwardsBatch.length) {
                this.showToast(`Imported ${completed} inward records successfully! Warehouse stock updated.`, 'success');
                this.cdr.markForCheck();
              }
            },
            error: () => {
              completed++;
              if (completed === inwardsBatch.length) {
                this.showToast(`Import finished with some records processed.`, 'info');
                this.cdr.markForCheck();
              }
            }
          });
        });
      } catch (err: any) {
        this.showToast('Failed to parse Excel file: ' + (err.message || 'Check file format'), 'danger');
      } finally {
        input.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  }
}
