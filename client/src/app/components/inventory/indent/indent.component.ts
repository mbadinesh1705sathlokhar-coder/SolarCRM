import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService, Indent, IndentMaterial, WarehouseMaterial, INVENTORY_MATERIALS } from '../../../services/inventory.service';
import { OfficeService } from '../../../services/office.service';
import { ProjectService } from '../../../services/project.service';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-indent',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './indent.component.html',
  styleUrls: ['./indent.component.css']
})
export class IndentComponent implements OnInit {
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

  indents: Indent[] = [];
  loading = false;
  searchTerm = '';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  indentForm: Partial<Indent> = this.getEmptyIndent();
  requestedMaterials: IndentMaterial[] = [];
  indentToDelete: Indent | null = null;
  isDeleteModalOpen = false;

  // Feedback Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Dropdown options
  projectsList: any[] = [];
  engineers: string[] = ['Soundarajan', 'Sathish', 'V Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Rahul', 'Vairamani'];
  clientOptions: string[] = [];
  stockMaterialOptions: string[] = [...INVENTORY_MATERIALS];
  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box', 'Packet'];
  materialStatuses: string[] = ['Ready to issue', 'Requested Vendor', 'Pending'];

  // BOM Material Master & Project BOM state
  bomMaterialsMasterList: any[] = [];
  bomGroupMap: { [key: string]: any[] } = {};
  bomGroupKeys: string[] = [];

  // Searchable Client Dropdown State
  clientDropdownOpen = false;

  get filteredClientOptions(): string[] {
    const q = (this.indentForm.clientName || '').toLowerCase().trim();
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
    this.indentForm.clientName = clientName;
    this.clientDropdownOpen = false;
    this.cdr.markForCheck();
  }

  clearClientSelection(): void {
    this.indentForm.clientName = '';
    this.clientDropdownOpen = true;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.loadIndents();
    this.loadWarehouseStockOptions();
    this.loadMasterMaterials();
    this.loadEngineersFromOffice();
    this.loadAwardedClients();
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

    this.loadBomMaterialsMaster();
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
    if (!this.indentForm.clientName) return null;
    const norm = (this.indentForm.clientName || '').toLowerCase().trim();
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

    this.requestedMaterials = items.map(b => {
      const grp = b.materialGroup || '';
      const cat = b.categoryType || 'Standard';
      const spec = b.specification || '';
      const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;
      const plannedQty = parseFloat(b.plannedQty) || 1;
      const dispQty = parseFloat(b.dispatchedQty) || 0;
      const remainingQty = Math.max(1, plannedQty - dispQty);
      return {
        materialName: autoName,
        materialGroup: grp,
        categoryType: cat,
        specification: spec,
        quantity: remainingQty,
        unit: b.uom || (grp.toLowerCase() === 'cables' ? 'Meter' : 'Nos'),
        status: 'Ready to issue',
        poWo: true
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

  onMaterialGroupChange(m: IndentMaterial): void {
    const grp = m.materialGroup || '';
    const types = this.getAvailableCategoryTypes(grp);
    m.categoryType = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, m.categoryType);
    m.specification = specs[0] || '';
    this.updateMaterialRowFromSpec(m);
  }

  onCategoryTypeChange(m: IndentMaterial): void {
    const specs = this.getAvailableSpecs(m.materialGroup, m.categoryType);
    m.specification = specs[0] || '';
    this.updateMaterialRowFromSpec(m);
  }

  onSpecificationChange(m: IndentMaterial): void {
    this.updateMaterialRowFromSpec(m);
  }

  updateMaterialRowFromSpec(m: IndentMaterial): void {
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
      if (match && match.uom) {
        m.unit = match.uom;
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

    m.materialName = [grp, cat && cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp || 'Solar Component';
    this.cdr.markForCheck();
  }

  get availableMaterialOptions(): string[] {
    if (this.indentForm.clientName) {
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

  loadIndents(): void {
    this.loading = true;
    this.inventoryService.getIndents().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.indents = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load indents.', 'danger');
        this.cdr.markForCheck();
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

  get filteredIndents(): Indent[] {
    if (!this.searchTerm.trim()) return this.indents;
    const term = this.searchTerm.trim().toLowerCase();
    return this.indents.filter(ind =>
      (ind.indentNo || '').toLowerCase().includes(term) ||
      (ind.clientName || '').toLowerCase().includes(term) ||
      (ind.siteEngineer || '').toLowerCase().includes(term) ||
      (ind.indentDate || '').includes(term)
    );
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add indents.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.indentForm = this.getEmptyIndent();
    // Pre-generate next indent number
    let nextNum = 101;
    if (this.indents.length > 0) {
      const numbers = this.indents.map(i => {
        const m = (i.indentNo || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 100;
      });
      nextNum = Math.max(...numbers, 100) + 1;
    }
    this.indentForm.indentNo = `IND-${nextNum}`;

    // Initialize with 1 default material row matching Screenshot 1
    const groups = this.getAvailableMaterialGroups();
    const grp = groups[0] || 'Cables';
    const types = this.getAvailableCategoryTypes(grp);
    const cat = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, cat);
    const spec = specs[0] || '';
    const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;

    const row: IndentMaterial = {
      materialName: autoName,
      materialGroup: grp,
      categoryType: cat,
      specification: spec,
      quantity: 1,
      unit: grp.toLowerCase() === 'cables' ? 'Meter' : 'Nos',
      status: 'Ready to issue',
      poWo: true
    };
    this.updateMaterialRowFromSpec(row);
    this.requestedMaterials = [row];

    this.isModalOpen = true;
  }

  openEditModal(indent: Indent): void {
    this.isEditMode = true;
    this.indentForm = { ...indent };
    this.requestedMaterials = (indent.materials || []).map(m => {
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
        specification: spec || m.materialName
      };
    });
    if (this.requestedMaterials.length === 0) {
      this.addMaterialRow();
    }
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.clientDropdownOpen = false;
    this.indentForm = this.getEmptyIndent();
    this.requestedMaterials = [];
  }

  addMaterialRow(): void {
    const groups = this.getAvailableMaterialGroups();
    const grp = groups[0] || 'Cables';
    const types = this.getAvailableCategoryTypes(grp);
    const cat = types[0] || 'Standard';
    const specs = this.getAvailableSpecs(grp, cat);
    const spec = specs[0] || '';
    const autoName = [grp, cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;

    const row: IndentMaterial = {
      materialName: autoName,
      materialGroup: grp,
      categoryType: cat,
      specification: spec,
      quantity: 1,
      unit: grp.toLowerCase() === 'cables' ? 'Meter' : 'Nos',
      status: 'Ready to issue',
      poWo: false
    };
    this.updateMaterialRowFromSpec(row);
    this.requestedMaterials.push(row);
  }

  removeMaterialRow(index: number): void {
    this.requestedMaterials.splice(index, 1);
  }

  saveIndent(): void {
    if (!this.indentForm.clientName?.trim()) {
      this.showToast('Client Name is required.', 'danger');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'danger');
      return;
    }

    this.requestedMaterials.forEach(m => this.updateMaterialRowFromSpec(m));

    const payload: Partial<Indent> = {
      ...this.indentForm,
      materials: this.requestedMaterials.filter(m => !!(m.materialName?.trim() || m.specification?.trim()))
    };

    if (this.isEditMode && this.indentForm.id) {
      this.inventoryService.updateIndent(this.indentForm.id, payload).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.indents.findIndex(i => i.id === this.indentForm.id);
            if (idx !== -1) {
              this.indents[idx] = res.data;
            }
            this.showToast('Indent updated successfully!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update indent.', 'danger')
      });
    } else {
      this.inventoryService.createIndent(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.indents.unshift(res.data);
            this.showToast('Indent created successfully!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to create indent.', 'danger')
      });
    }
  }

  confirmDelete(indent: Indent): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete indents.', 'danger');
      return;
    }
    this.indentToDelete = indent;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.indentToDelete = null;
    this.isDeleteModalOpen = false;
  }

  deleteIndent(): void {
    if (!this.indentToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete indents.', 'danger');
      return;
    }
    const id = this.indentToDelete.id;
    this.inventoryService.deleteIndent(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.indents = this.indents.filter(i => i.id !== id);
          this.showToast('Indent deleted.', 'success');
          this.closeDeleteModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete indent.', 'danger')
    });
  }

  getEmptyIndent(): Partial<Indent> {
    return {
      indentDate: new Date().toISOString().substring(0, 10),
      indentNo: '',
      siteEngineer: 'Dinesh Kumar',
      clientName: ''
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

  exportIndentPdf(): void {
    const list = this.filteredIndents;
    if (list.length === 0) {
      this.showToast('No indents available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - MATERIAL INDENTS REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Indents: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Indent No', 'Date', 'Site Engineer', 'Client Name', 'Requested Materials & Quantities']
    ];

    const body = list.map((ind, idx) => {
      const matSummary = (ind.materials || [])
        .map(m => `${m.materialName} (${m.quantity} ${m.unit}) [${m.status || 'Ready'}]`)
        .join('\n');
      return [
        idx + 1,
        ind.indentNo || '',
        this.formatDate(ind.indentDate),
        ind.siteEngineer || '',
        ind.clientName || '',
        matSummary || 'None specified'
      ];
    });

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Material_Indents_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Material Indents PDF exported successfully!', 'success');
  }

  exportToExcel(): void {
    const list = this.filteredIndents;
    if (list.length === 0) return;
    const headers = ['S.No', 'Indent No', 'Date', 'Site Engineer', 'Client Name', 'Requested Materials'];
    const rows = list.map((ind, idx) => [
      idx + 1,
      `"${ind.indentNo || ''}"`,
      `"${this.formatDate(ind.indentDate)}"`,
      `"${ind.siteEngineer || ''}"`,
      `"${ind.clientName || ''}"`,
      `"${(ind.materials || []).map(m => m.materialName + ' (' + m.quantity + ' ' + m.unit + ')').join('; ')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Material_Indents_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportIndentPdf();
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

        const indentsBatch: Partial<Indent>[] = rawRows.map((row, idx) => {
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

          const indentNo = getVal(['indent no', 'indentno', 'indent id', 'id']) || `IND-${100 + idx}`;
          const indentDate = getVal(['indent date', 'date']) || today;
          const siteEngineer = getVal(['site engineer', 'engineer', 'order by']) || 'Site Engineer';
          const clientName = getVal(['client name', 'client', 'name']) || 'Client';
          const materialName = getVal(['material name', 'material', 'item']) || 'Solar Cables';
          const quantity = parseNum(['quantity', 'qty']) || 10;
          const unit = getVal(['unit', 'uom']) || 'Meter';

          return {
            indentNo,
            indentDate,
            siteEngineer,
            clientName,
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
        this.showToast(`Importing ${indentsBatch.length} indents from Excel...`, 'info');

        indentsBatch.forEach(ind => {
          this.inventoryService.createIndent(ind).subscribe({
            next: () => {
              completed++;
              if (completed === indentsBatch.length) {
                this.loadIndents();
                this.showToast(`Successfully imported ${completed} indents from Excel!`, 'success');
              }
            },
            error: () => {
              completed++;
              if (completed === indentsBatch.length) {
                this.loadIndents();
                this.showToast(`Imported ${completed} indent records from Excel.`, 'success');
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

  clearAllIndents(): void {
    if (confirm('Are you sure you want to clear ALL indent records? This will delete all current indents so you can upload a clean Excel file.')) {
      this.inventoryService.clearAllIndents().subscribe({
        next: () => {
          this.showToast('All indent records cleared successfully.', 'success');
          this.loadIndents();
        },
        error: (err) => {
          this.showToast('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
