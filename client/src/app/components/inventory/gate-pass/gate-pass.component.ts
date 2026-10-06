import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService, GatePass, GatePassItem, INVENTORY_MATERIALS } from '../../../services/inventory.service';
import { OfficeService } from '../../../services/office.service';
import { ProjectService } from '../../../services/project.service';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-gate-pass',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gate-pass.component.html',
  styleUrls: ['./gate-pass.component.css']
})
export class GatePassComponent implements OnInit {
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

  canViewPricing(): boolean {
    return this.authService.canViewPricing();
  }

  gatePasses: GatePass[] = [];
  loading = false;
  searchTerm = '';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  passForm: Partial<GatePass> = this.getEmptyGatePass();
  passToDelete: GatePass | null = null;
  isDeleteModalOpen = false;

  // Multi-item materials selection per Gate Pass (Screenshot 1 & user specification)
  // Strictly: Material (from stock), Qty, Unit only
  projectsList: any[] = [];
  dispatchMaterials: GatePassItem[] = [];
  stockMaterialOptions: string[] = [...INVENTORY_MATERIALS];

  // BOM Material Master & Project BOM state
  bomMaterialsMasterList: any[] = [];
  bomGroupMap: { [key: string]: any[] } = {};
  bomGroupKeys: string[] = [];

  // Feedback Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box', 'Lot'];
  engineers: string[] = ['Soundarajan', 'Sathish', 'V Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Rahul', 'Vairamani'];
  clientOptions: string[] = [];
  vendorOptions: string[] = [];

  // View Descriptions Modal State (User clicks Unit to view all descriptions)
  isViewDescriptionsOpen = false;
  selectedGatePassForView: GatePass | null = null;

  // Searchable Client Dropdown State
  clientDropdownOpen = false;

  get filteredClientOptions(): string[] {
    const q = (this.passForm.clientName || '').toLowerCase().trim();
    if (!q) return this.clientOptions;
    return this.clientOptions.filter(c => c.toLowerCase().includes(q));
  }

  openClientDropdown(): void {
    this.clientDropdownOpen = true;
    this.cdr.markForCheck();
  }

  closeClientDropdown(): void {
    setTimeout(() => {
      this.clientDropdownOpen = false;
      this.cdr.markForCheck();
    }, 200);
  }

  toggleClientDropdown(event: MouseEvent): void {
    event.preventDefault();
    this.clientDropdownOpen = !this.clientDropdownOpen;
    this.cdr.markForCheck();
  }

  selectClient(clientName: string): void {
    this.passForm.clientName = clientName;
    this.clientDropdownOpen = false;
    this.cdr.markForCheck();
  }

  clearClientSelection(): void {
    this.passForm.clientName = '';
    this.clientDropdownOpen = true;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.loadGatePasses();
    this.loadWarehouseStockOptions();
    this.loadMasterMaterials();
    this.loadBomMaterialsMaster();
    this.loadVendorsFromAddList();
    this.loadEngineersFromOffice();
    this.loadAwardedClients();
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
      },
      error: () => {
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

  loadMasterMaterials(): void {
    this.masterListService.getList('Materials').subscribe({
      next: (res) => {
        if (res.success && res.data?.items?.length > 0) {
          this.stockMaterialOptions = Array.from(new Set([...res.data.items, ...this.stockMaterialOptions]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadWarehouseStockOptions(): void {
    this.inventoryService.getWarehouseMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const names = res.data.map(m => m.materialName);
          this.stockMaterialOptions = Array.from(new Set([...INVENTORY_MATERIALS, ...names]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadBomMaterialsMaster(): void {
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.bomMaterialsMasterList = res.data;
          this.bomGroupMap = res.grouped || {};
          this.bomGroupKeys = Object.keys(this.bomGroupMap);
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  getSelectedProject(): any | null {
    if (!this.passForm.clientName) return null;
    const norm = (this.passForm.clientName || '').toLowerCase().trim();
    return this.projectsList.find(p => 
      (p.clientName || '').toLowerCase().trim() === norm ||
      (p.siteId || '').toLowerCase().trim() === norm ||
      norm.includes((p.siteId || '').toLowerCase().trim()) ||
      norm.includes((p.clientName || '').toLowerCase().trim())
    ) || null;
  }

  parseBomItems(bomItems: any): any[] {
    if (!bomItems) return [];
    if (Array.isArray(bomItems)) return bomItems;
    if (typeof bomItems === 'string') {
      try { return JSON.parse(bomItems); } catch(e) { return []; }
    }
    return [];
  }

  hasProjectBomItems(): boolean {
    const proj = this.getSelectedProject();
    if (!proj || !proj.bomItems) return false;
    const items = this.parseBomItems(proj.bomItems);
    return items.length > 0;
  }

  populateFromProjectBom(): void {
    const proj = this.getSelectedProject();
    if (!proj || !proj.bomItems) return;
    const items = this.parseBomItems(proj.bomItems);
    if (items.length === 0) return;

    const defaultDate = this.passForm.gatePassDate || new Date().toISOString().substring(0, 10);
    this.dispatchMaterials = items.map(b => {
      const grp = b.materialGroup || '';
      const cat = b.categoryType || 'Standard';
      const spec = b.specification || '';
      const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;
      const plannedQty = parseFloat(b.plannedQty) || 1;
      const dispQty = parseFloat(b.dispatchedQty) || 0;
      const remainingQty = Math.max(1, plannedQty - dispQty);
      const r = Number(b.rate) || 0;
      return {
        dispatchDate: defaultDate,
        materialName: autoName,
        materialGroup: grp,
        categoryType: cat,
        specification: spec,
        unit: b.uom || (grp.toLowerCase() === 'cables' ? 'Meter' : 'Nos'),
        quantity: remainingQty,
        rate: r,
        vendorName: this.vendorOptions[0] || '',
        amount: Math.round(remainingQty * r * 100) / 100
      };
    });
    this.showToast(`Loaded ${items.length} materials from Project BOM.`, 'info');
    this.cdr.markForCheck();
  }

  getAvailableMaterialGroups(): string[] {
    const proj = this.getSelectedProject();
    const projGroups: string[] = [];
    if (proj && proj.bomItems) {
      const items = this.parseBomItems(proj.bomItems);
      items.forEach(i => {
        if (i.materialGroup && !projGroups.includes(i.materialGroup)) {
          projGroups.push(i.materialGroup);
        }
      });
    }
    const masterGroups = this.bomGroupKeys.length > 0
      ? this.bomGroupKeys
      : ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree'];
    return Array.from(new Set([...projGroups, ...masterGroups]));
  }

  getAvailableCategoryTypes(groupName?: string): string[] {
    const normGrp = (groupName || '').toLowerCase().trim();
    if (!normGrp) return ['Standard'];

    const proj = this.getSelectedProject();
    if (proj && proj.bomItems) {
      const items = this.parseBomItems(proj.bomItems).filter(b => (b.materialGroup || '').toLowerCase().trim() === normGrp);
      const projTypes = items.map(b => b.categoryType).filter(Boolean);
      if (projTypes.length > 0) {
        return Array.from(new Set(projTypes));
      }
    }

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

    const proj = this.getSelectedProject();
    if (proj && proj.bomItems) {
      let items = this.parseBomItems(proj.bomItems).filter(b => (b.materialGroup || '').toLowerCase().trim() === normGrp);
      if (normType && normType !== 'standard') {
        const filtered = items.filter(b => (b.categoryType || '').toLowerCase().trim() === normType);
        if (filtered.length > 0) items = filtered;
      }
      const specs = items.map(b => b.specification).filter(Boolean);
      if (specs.length > 0) {
        return Array.from(new Set(specs));
      }
    }

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

  onMaterialGroupChange(m: GatePassItem): void {
    const grp = m.materialGroup || '';
    const types = this.getAvailableCategoryTypes(grp);
    m.categoryType = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, m.categoryType);
    m.specification = specs[0] || '';
    this.updateMaterialRowFromSpec(m);
  }

  onCategoryTypeChange(m: GatePassItem): void {
    const specs = this.getAvailableSpecs(m.materialGroup, m.categoryType);
    m.specification = specs[0] || '';
    this.updateMaterialRowFromSpec(m);
  }

  onSpecificationChange(m: GatePassItem): void {
    this.updateMaterialRowFromSpec(m);
  }

  updateMaterialRowFromSpec(m: GatePassItem): void {
    const grp = (m.materialGroup || '').trim();
    const cat = (m.categoryType || '').trim();
    const spec = (m.specification || '').trim();

    const proj = this.getSelectedProject();
    if (proj && proj.bomItems) {
      const items = this.parseBomItems(proj.bomItems);
      const match = items.find(b => 
        (b.materialGroup || '').toLowerCase().trim() === grp.toLowerCase() &&
        (b.specification || '').toLowerCase().trim() === spec.toLowerCase()
      );
      if (match) {
        if (match.uom) m.unit = match.uom;
        if (match.rate && (!m.rate || m.rate === 0)) m.rate = Number(match.rate);
      }
    }

    if (!m.unit || m.unit === 'Nos') {
      const masterMatch = this.bomMaterialsMasterList.find(b => 
        (b.groupName || '').toLowerCase().trim() === grp.toLowerCase() &&
        (b.specification || '').toLowerCase().trim() === spec.toLowerCase()
      );
      if (masterMatch && masterMatch.defaultUom) {
        m.unit = masterMatch.defaultUom;
      } else if (grp.toLowerCase() === 'cables') {
        m.unit = 'Meter';
      }
    }

    m.materialName = [grp, cat && cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp || 'Material';
    this.calculateRowAmount(m);
    this.cdr.markForCheck();
  }

  get availableMaterialOptions(): string[] {
    if (this.passForm.clientName) {
      const selectedProj = this.getSelectedProject();
      if (selectedProj && selectedProj.bomItems) {
        const itemsArr = this.parseBomItems(selectedProj.bomItems);
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
    return this.stockMaterialOptions;
  }

  loadAwardedClients(): void {
    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          this.projectsList = res.data;
          const names = res.data.map(p => p.clientName).filter(Boolean);
          this.clientOptions = Array.from(new Set(names));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadGatePasses(): void {
    this.loading = true;
    this.inventoryService.getGatePasses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.gatePasses = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load gate passes.', 'danger');
        this.cdr.markForCheck();
      }
    });
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

  cleanDescription(desc?: string): string {
    if (!desc) return '';
    return desc.replace(/\s*\([\d.]+\s*[A-Za-z]+\)/g, '');
  }

  get filteredGatePasses(): GatePass[] {
    if (!this.searchTerm.trim()) return this.gatePasses;
    const term = this.searchTerm.trim().toLowerCase();
    return this.gatePasses.filter(gp =>
      (gp.descriptions || '').toLowerCase().includes(term) ||
      (gp.clientName || '').toLowerCase().includes(term) ||
      (gp.siteEngineer || '').toLowerCase().includes(term) ||
      (gp.gatePassDate || '').includes(term) ||
      (gp.remarks || '').toLowerCase().includes(term) ||
      (gp.items && gp.items.some(it => (it.materialName || '').toLowerCase().includes(term)))
    );
  }

  get existingGatePassForClient(): GatePass | undefined {
    const client = (this.passForm.clientName || '').trim().toLowerCase();
    if (!client) return undefined;
    const currentId = this.passForm.id;
    const spMatch = client.match(/sp[-\s]?(\d+)/i);

    return this.gatePasses.find(gp => {
      if (currentId && gp.id === currentId) return false;
      const gpClient = (gp.clientName || '').trim().toLowerCase();
      if (gpClient === client) return true;
      if (spMatch) {
        const gpSpMatch = gpClient.match(/sp[-\s]?(\d+)/i);
        if (gpSpMatch && gpSpMatch[1] === spMatch[1]) return true;
      }
      return false;
    });
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to create gate passes.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.passForm = this.getEmptyGatePass();
    const today = new Date().toISOString().substring(0, 10);
    const groups = this.getAvailableMaterialGroups();
    const grp = groups[0] || 'Cables';
    const types = this.getAvailableCategoryTypes(grp);
    const cat = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, cat);
    const spec = specs[0] || '';
    const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;

    const row: GatePassItem = {
      dispatchDate: today,
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
    this.dispatchMaterials = [row];
    this.isModalOpen = true;
  }

  openEditModal(gp: GatePass): void {
    this.isEditMode = true;
    this.passForm = { ...gp };
    const defaultDate = gp.gatePassDate || new Date().toISOString().substring(0, 10);
    if (gp.items && gp.items.length > 0) {
      this.dispatchMaterials = gp.items.map(m => {
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
            const masterMatch = this.bomMaterialsMasterList.find(b => 
              (b.specification || '').toLowerCase().trim() === m.materialName.toLowerCase().trim()
            );
            if (masterMatch) {
              grp = masterMatch.groupName;
              cat = masterMatch.categoryType || 'Standard';
              spec = masterMatch.specification;
            } else {
              grp = m.materialName;
              cat = 'Standard';
              spec = m.materialName;
            }
          }
        }

        return {
          ...m,
          materialGroup: grp,
          categoryType: cat || 'Standard',
          specification: spec || m.materialName,
          dispatchDate: m.dispatchDate || defaultDate,
          unit: m.unit || 'Nos',
          quantity: q,
          rate: r,
          vendorName: m.vendorName || (this.vendorOptions[0] || ''),
          amount: a
        };
      });
    } else if (gp.descriptions) {
      const parts = gp.descriptions.split(' - ').map(s => s.trim());
      const grp = parts.length >= 2 ? parts[0] : gp.descriptions;
      const cat = parts.length >= 3 ? parts[1] : 'Standard';
      const spec = parts.length >= 3 ? parts.slice(2).join(' - ') : (parts.length === 2 ? parts[1] : gp.descriptions);

      this.dispatchMaterials = [{
        dispatchDate: defaultDate,
        materialName: gp.descriptions,
        materialGroup: grp,
        categoryType: cat,
        specification: spec,
        unit: gp.unit || 'Nos',
        quantity: gp.quantity || 1,
        rate: 0,
        vendorName: this.vendorOptions[0] || '',
        amount: 0
      }];
    } else {
      const groups = this.getAvailableMaterialGroups();
      const grp = groups[0] || 'Cables';
      const types = this.getAvailableCategoryTypes(grp);
      const cat = types[0] || 'Standard';
      const specs = this.getAvailableSpecs(grp, cat);
      const spec = specs[0] || '';
      const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;

      const row: GatePassItem = {
        dispatchDate: defaultDate,
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
      this.dispatchMaterials = [row];
    }
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.clientDropdownOpen = false;
    this.passForm = this.getEmptyGatePass();
    this.dispatchMaterials = [];
  }

  openDescriptionsModal(gp: GatePass): void {
    this.selectedGatePassForView = gp;
    this.isViewDescriptionsOpen = true;
    this.cdr.markForCheck();
  }

  closeDescriptionsModal(): void {
    this.isViewDescriptionsOpen = false;
    this.selectedGatePassForView = null;
    this.cdr.markForCheck();
  }

  editFromViewModal(gp: GatePass): void {
    this.closeDescriptionsModal();
    this.openEditModal(gp);
  }

  addMaterialRow(): void {
    const defaultDate = this.passForm.gatePassDate || new Date().toISOString().substring(0, 10);
    const groups = this.getAvailableMaterialGroups();
    const grp = groups[0] || 'Cables';
    const types = this.getAvailableCategoryTypes(grp);
    const cat = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, cat);
    const spec = specs[0] || '';
    const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;

    const newRow: GatePassItem = {
      dispatchDate: defaultDate,
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
    this.dispatchMaterials.push(newRow);
  }

  removeMaterialRow(index: number): void {
    this.dispatchMaterials.splice(index, 1);
  }

  calculateRowAmount(m: GatePassItem): void {
    const q = parseFloat(m.quantity as any) || 0;
    const r = parseFloat(m.rate as any) || 0;
    m.amount = Math.round(q * r * 100) / 100;
  }

  getMaterialsTotal(): number {
    return this.dispatchMaterials.reduce((sum, m) => {
      const q = parseFloat(m.quantity as any) || 0;
      const r = parseFloat(m.rate as any) || 0;
      const a = m.amount !== undefined && m.amount !== null ? (parseFloat(m.amount as any) || 0) : (q * r);
      return sum + a;
    }, 0);
  }

  getTotalAmount(): number {
    return this.getMaterialsTotal();
  }

  getGatePassTotal(gp: GatePass): number {
    if (gp.totalAmount !== undefined && gp.totalAmount !== null && Number(gp.totalAmount) > 0) {
      return Number(gp.totalAmount);
    }
    let sum = 0;
    if (gp.items && gp.items.length > 0) {
      sum = gp.items.reduce((s, it) => {
        const q = parseFloat(it.quantity as any) || 0;
        const r = parseFloat(it.rate as any) || 0;
        const a = it.amount !== undefined && it.amount !== null ? (parseFloat(it.amount as any) || 0) : (q * r);
        return s + a;
      }, 0);
    }
    return Math.round(sum * 100) / 100;
  }

  saveGatePass(): void {
    if (!this.passForm.clientName?.trim()) {
      this.showToast('Client Name is required.', 'danger');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'danger');
      return;
    }

    if (!this.isEditMode && this.existingGatePassForClient) {
      const proceed = confirm(
        `A Gate Pass already exists for ${this.passForm.clientName} (Pass #${this.existingGatePassForClient.id}).\n\nClick Cancel to switch and edit the existing pass instead, or OK to create a separate new pass.`
      );
      if (!proceed) {
        this.openEditModal(this.existingGatePassForClient);
        return;
      }
    }

    const validMaterials = this.dispatchMaterials.filter(m => !!m.materialName?.trim());
    if (validMaterials.length === 0) {
      this.showToast('Please add at least one material to dispatch.', 'danger');
      return;
    }

    // Ensure amount is calculated for all rows
    validMaterials.forEach(m => this.calculateRowAmount(m));

    // Auto calculate summary fields (Do not sum quantities across different units)
    const descriptions = validMaterials.map(m => `${m.materialName} (${m.quantity} ${m.unit})`).join(', ');
    const quantity = validMaterials.length === 1 ? (parseFloat(validMaterials[0].quantity as any) || 1) : 0;
    const unit = validMaterials.length === 1 ? validMaterials[0].unit : `${validMaterials.length} Items`;
    const totalAmount = this.getTotalAmount();

    const payload: Partial<GatePass> = {
      ...this.passForm,
      descriptions,
      quantity,
      unit,
      totalAmount,
      transportCost: 0,
      items: validMaterials
    };

    if (this.isEditMode && this.passForm.id) {
      this.inventoryService.updateGatePass(this.passForm.id, payload).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.gatePasses.findIndex(g => g.id === this.passForm.id);
            if (idx !== -1) {
              this.gatePasses[idx] = res.data;
            }
            this.showToast('Gate pass updated successfully!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update gate pass.', 'danger')
      });
    } else {
      this.inventoryService.createGatePass(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.gatePasses.unshift(res.data);
            this.showToast('Gate pass created successfully!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to create gate pass.', 'danger')
      });
    }
  }

  confirmDelete(gp: GatePass): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete gate passes.', 'danger');
      return;
    }
    this.passToDelete = gp;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.passToDelete = null;
    this.isDeleteModalOpen = false;
  }

  deleteGatePass(): void {
    if (!this.passToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete gate passes.', 'danger');
      return;
    }
    const id = this.passToDelete.id;
    this.inventoryService.deleteGatePass(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.gatePasses = this.gatePasses.filter(g => g.id !== id);
          this.showToast('Gate pass deleted.', 'success');
          this.closeDeleteModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete gate pass.', 'danger')
    });
  }

  getEmptyGatePass(): Partial<GatePass> {
    return {
      gatePassDate: new Date().toISOString().substring(0, 10),
      descriptions: '',
      unit: 'Nos',
      quantity: 1,
      clientName: '',
      siteEngineer: 'Dinesh Kumar',
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

  exportGatePassPdf(): void {
    const list = this.filteredGatePasses;
    if (list.length === 0) {
      this.showToast('No gate passes available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - MATERIAL GATE PASS DISPATCH REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Passes: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const showPrice = this.canViewPricing();
    const headers = showPrice
      ? [['S.No', 'Date', 'Client / Destination', 'Site Engineer', 'Dispatched Materials', 'Qty & Unit', 'Total Amount', 'Remarks']]
      : [['S.No', 'Date', 'Client / Destination', 'Site Engineer', 'Dispatched Materials', 'Qty & Unit', 'Remarks']];

    const body = list.map((gp, idx) => {
      let matDetails = gp.descriptions || '';
      if (gp.items && gp.items.length > 0) {
        matDetails = gp.items.map(it => {
          let line = `${it.materialName} (${it.quantity} ${it.unit})`;
          if (it.dispatchDate) line += ` [${this.formatDate(it.dispatchDate)}]`;
          if (showPrice) {
            if (it.rate) line += ` @ Rs.${it.rate}`;
            if (it.vendorName) line += ` [Vendor: ${it.vendorName}]`;
          }
          return line;
        }).join('\n');
      }
      const totalAmt = this.getGatePassTotal(gp);
      if (showPrice) {
        return [
          idx + 1,
          this.formatDate(gp.gatePassDate),
          gp.clientName || '',
          gp.siteEngineer || '',
          matDetails,
          `${gp.quantity || 1} ${gp.unit || 'Nos'}`,
          totalAmt > 0 ? `Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
          gp.remarks || '—'
        ];
      } else {
        return [
          idx + 1,
          this.formatDate(gp.gatePassDate),
          gp.clientName || '',
          gp.siteEngineer || '',
          matDetails,
          `${gp.quantity || 1} ${gp.unit || 'Nos'}`,
          gp.remarks || '—'
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

    doc.save(`Gate_Passes_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Gate Pass PDF exported successfully!', 'success');
  }

  downloadSingleGatePassPdf(gp: GatePass | null): void {
    if (!gp) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;

    // 1. Header Banner
    doc.setFillColor(217, 119, 6); // Amber brand tone matching Gate Pass UI
    doc.rect(0, 0, pageWidth, 26, 'F');
    doc.setFillColor(15, 118, 110); // Teal Accent line
    doc.rect(0, 26, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(254, 243, 199);
    doc.text('MATERIAL GATE PASS & DISPATCH VOUCHER', margin, 17);

    doc.setFontSize(7.5);
    const passRef = gp.id ? `GP-${gp.id}` : 'GP-DISPATCH';
    doc.text(`Ref: ${passRef}   |   Date: ${this.formatDate(gp.gatePassDate)}   |   Generated: ${new Date().toLocaleString('en-IN')}`, margin, 22);

    let currentY = 34;

    // 2. Overview Meta Card
    const overviewData = [
      ['Client / Site Name:', gp.clientName || '—', 'Dispatch Date:', this.formatDate(gp.gatePassDate)],
      ['Site Engineer:', gp.siteEngineer || '—', 'Total Materials:', `${gp.items?.length || (gp.descriptions ? 1 : 0)} Item(s)`],
      ['Remarks / Dispatch:', gp.remarks || 'Site Material Dispatch', '', '']
    ];

    autoTable(doc, {
      body: overviewData,
      startY: currentY,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
        1: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 70 },
        2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 32 },
        3: { textColor: [30, 41, 59], cellWidth: 42 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // 3. Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(217, 119, 6);
    doc.text('DISPATCHED DESCRIPTIONS & MATERIALS', margin, currentY);

    currentY += 3;

    const showPrice = this.canViewPricing();
    const tableHeaders = showPrice
      ? [['#', 'Date', 'Material / Description', 'Unit', 'Qty', 'Rate (Rs.)', 'Vendor Name', 'Amount (Rs.)']]
      : [['#', 'Date', 'Material / Description', 'Unit', 'Qty']];

    const tableBody: any[] = [];
    if (gp.items && gp.items.length > 0) {
      gp.items.forEach((it, idx) => {
        if (showPrice) {
          tableBody.push([
            idx + 1,
            this.formatDate(it.dispatchDate || gp.gatePassDate),
            it.materialName || '—',
            it.unit || 'Nos',
            it.quantity || 0,
            it.rate ? `Rs. ${Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
            it.vendorName || '—',
            (it.amount !== undefined && it.amount !== null && it.amount > 0)
              ? `Rs. ${Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              : '—'
          ]);
        } else {
          tableBody.push([
            idx + 1,
            this.formatDate(it.dispatchDate || gp.gatePassDate),
            it.materialName || '—',
            it.unit || 'Nos',
            it.quantity || 0
          ]);
        }
      });
    } else {
      if (showPrice) {
        tableBody.push([
          1,
          this.formatDate(gp.gatePassDate),
          this.cleanDescription(gp.descriptions) || '—',
          gp.unit || 'Nos',
          gp.quantity || 1,
          '—',
          '—',
          this.getGatePassTotal(gp) > 0 ? `Rs. ${this.getGatePassTotal(gp).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'
        ]);
      } else {
        tableBody.push([
          1,
          this.formatDate(gp.gatePassDate),
          this.cleanDescription(gp.descriptions) || '—',
          gp.unit || 'Nos',
          gp.quantity || 1
        ]);
      }
    }

    const tableFooters: any[] = [];
    if (showPrice) {
      const totalAmount = this.getGatePassTotal(gp);
      tableFooters.push([
        { content: 'Total Dispatch Value:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 } },
        { content: `Rs. ${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fontSize: 9, textColor: [22, 101, 52] } }
      ]);
    }

    autoTable(doc, {
      head: tableHeaders,
      body: tableBody,
      foot: tableFooters.length > 0 ? tableFooters : undefined,
      startY: currentY,
      styles: { fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [254, 252, 232] },
      columnStyles: showPrice ? {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 22 },
        2: { fontStyle: 'bold', cellWidth: 48 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'right', cellWidth: 24 },
        6: { cellWidth: 28 },
        7: { halign: 'right', cellWidth: 22 }
      } : {
        0: { halign: 'center', cellWidth: 14 },
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

    // 4. Authorization Signatures
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, currentY, margin + 45, currentY);
    doc.line(margin + 65, currentY, margin + 115, currentY);
    doc.line(margin + 135, currentY, margin + 180, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared / Dispatched By', margin, currentY + 4);
    doc.text('Vehicle / Transport Handover', margin + 65, currentY + 4);
    doc.text('Received By (Site Engineer)', margin + 135, currentY + 4);

    const safeClient = (gp.clientName || 'GatePass').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    doc.save(`Gate_Pass_${safeClient}_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast(`Gate Pass PDF for ${gp.clientName} generated successfully!`, 'success');
  }

  exportToExcel(): void {
    const list = this.filteredGatePasses;
    if (list.length === 0) return;
    const headers = ['S.No', 'Gate Pass No', 'Date', 'Site Engineer', 'Client Name', 'Status'];
    const rows = list.map((gp, idx) => [
      idx + 1,
      `"${(gp as any).passNo || (gp as any).gatePassNo || (gp.id ? 'GP-' + gp.id : '')}"`,
      `"${this.formatDate(gp.gatePassDate)}"`,
      `"${gp.siteEngineer || ''}"`,
      `"${gp.clientName || ''}"`,
      `"${(gp as any).status || 'Approved'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gate_Passes_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportGatePassPdf();
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

        const gatePassesBatch: Partial<GatePass>[] = rawRows.map((row, idx) => {
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

          const gatePassDate = getVal(['gate pass date', 'date']) || today;
          const clientName = getVal(['client name', 'client', 'name']) || 'Client';
          const siteEngineer = getVal(['site engineer', 'engineer', 'order by']) || 'Site Engineer';
          const remarks = getVal(['remarks', 'description', 'notes']) || 'Imported from Excel';
          const materialName = getVal(['material name', 'material', 'item']) || 'Solar Cables';
          const quantity = parseNum(['quantity', 'qty']) || 10;
          const unit = getVal(['unit', 'uom']) || 'Meter';

          return {
            gatePassDate,
            clientName,
            siteEngineer,
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
        this.showToast(`Importing ${gatePassesBatch.length} gate passes from Excel...`, 'info');

        gatePassesBatch.forEach(gp => {
          this.inventoryService.createGatePass(gp).subscribe({
            next: () => {
              completed++;
              if (completed === gatePassesBatch.length) {
                this.loadGatePasses();
                this.showToast(`Successfully imported ${completed} gate passes from Excel!`, 'success');
              }
            },
            error: () => {
              completed++;
              if (completed === gatePassesBatch.length) {
                this.loadGatePasses();
                this.showToast(`Imported ${completed} gate pass records from Excel.`, 'success');
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

  clearAllGatePasses(): void {
    if (confirm('Are you sure you want to clear ALL gate pass records? This will delete all current gate passes so you can upload a clean Excel file.')) {
      this.inventoryService.clearAllGatePasses().subscribe({
        next: () => {
          this.showToast('All gate pass records cleared successfully.', 'success');
          this.loadGatePasses();
        },
        error: (err) => {
          this.showToast('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
