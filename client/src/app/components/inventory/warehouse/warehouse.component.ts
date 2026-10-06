import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService, WarehouseMaterial, INVENTORY_MATERIALS, computeStockStatus, getStockThresholdDescription } from '../../../services/inventory.service';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './warehouse.component.html',
  styleUrls: ['./warehouse.component.css']
})
export class WarehouseComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private masterListService = inject(MasterListService);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isAdmin(): boolean {
    return this.authService.isAdmin() || this.authService.isPurchase();
  }

  canAdd(): boolean {
    return this.authService.canAdd('warehouse') || 
           this.authService.canAdd('inventory') || 
           this.authService.isAdmin() || 
           this.authService.isPurchase();
  }

  canEdit(): boolean {
    return this.authService.canEdit('warehouse') || 
           this.authService.canEdit('inventory') || 
           this.authService.isAdmin() || 
           this.authService.isPurchase();
  }

  canDelete(): boolean {
    return this.authService.canDelete('warehouse') || 
           this.authService.canDelete('inventory') || 
           this.authService.isAdmin() || 
           this.authService.isPurchase();
  }

  materials: WarehouseMaterial[] = [];
  loading = false;
  searchTerm = '';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  isDescriptionCustomized = false;
  materialForm: Partial<WarehouseMaterial> = this.getEmptyMaterial();
  materialToDelete: WarehouseMaterial | null = null;
  isDeleteModalOpen = false;

  // Feedback Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  materialOptions: string[] = [...INVENTORY_MATERIALS];
  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box', 'Litre'];

  // BOM Material Master Integration
  bomGroupMap: { [key: string]: { id?: number; categoryType: string; specification: string; defaultUom: string; unitRate: number }[] } = {};
  bomGroupKeys: string[] = ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree'];
  selectedBomGroup: string = '';
  availableBomCategories: string[] = [];
  selectedBomCategory: string = '';
  availableBomSpecs: { id?: number; categoryType: string; specification: string; defaultUom: string; unitRate: number }[] = [];
  selectedBomSpec: string = '';

  // Real-time computed status getter for the active modal form
  get currentComputedStatus(): 'In Stock' | 'Low Stock' | 'Out of Stock' {
    return computeStockStatus(
      this.materialForm.materialName,
      this.materialForm.unit,
      this.materialForm.inStock
    );
  }

  // Helper method accessible from template
  computeStockStatus(name?: string, unit?: string, inStock?: number | string | null): 'In Stock' | 'Low Stock' | 'Out of Stock' {
    return computeStockStatus(name, unit, inStock);
  }

  getStatusRuleDescription(name?: string, unit?: string): string {
    return getStockThresholdDescription(name, unit);
  }

  ngOnInit(): void {
    this.loadMaterials();
    this.loadMasterMaterials();
  }

  loadMasterMaterials(): void {
    // 1. Load legacy / standard materials list
    this.masterListService.getList('Materials').subscribe({
      next: (res) => {
        if (res.success && res.data?.items?.length > 0) {
          this.materialOptions = Array.from(new Set([...res.data.items, ...this.materialOptions]));
          this.cdr.markForCheck();
        }
      }
    });

    // 2. Load hierarchical BOM Material Groups & Specifications from Database
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.grouped) {
          this.bomGroupMap = res.grouped;
          this.bomGroupKeys = Object.keys(res.grouped);

          const bomSpecs: string[] = [];
          Object.keys(res.grouped).forEach(grp => {
            res.grouped[grp].forEach((item: any) => {
              if (item.specification) {
                bomSpecs.push(item.specification);
                bomSpecs.push(`${grp} - ${item.specification}`);
              }
            });
          });
          this.materialOptions = Array.from(new Set([...bomSpecs, ...this.materialOptions]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  onBomGroupSelect(groupName: string): void {
    this.selectedBomGroup = groupName;
    this.selectedBomSpec = '';
    this.materialForm.materialGroup = groupName;

    if (!groupName) {
      this.availableBomCategories = [];
      this.availableBomSpecs = [];
      this.selectedBomCategory = '';
      this.cdr.markForCheck();
      return;
    }

    const allGroupItems = this.bomGroupMap[groupName] || [];
    const cats = Array.from(new Set(allGroupItems.map(i => i.categoryType || 'Standard').filter(Boolean)));
    this.availableBomCategories = cats.length > 0 ? cats : ['Standard'];
    this.selectedBomCategory = this.availableBomCategories[0] || 'Standard';
    this.materialForm.categoryType = this.selectedBomCategory;

    this.onBomCategorySelect(this.selectedBomCategory);

    if (groupName === 'Cables') {
      this.materialForm.unit = 'Meter';
    } else if (groupName === 'MC4 Connector') {
      this.materialForm.unit = 'Nos';
    } else if (['Panels', 'Inverters', 'Lugs', 'Bucket', 'Structure', 'Earthing & Lightning', 'Fasteners & Hardware'].includes(groupName)) {
      this.materialForm.unit = 'Nos';
    }
    this.cdr.markForCheck();
  }

  onBomCategorySelect(catName: string): void {
    this.selectedBomCategory = catName;
    this.materialForm.categoryType = catName;
    this.selectedBomSpec = '';

    const allGroupItems = this.bomGroupMap[this.selectedBomGroup] || [];
    if (catName && catName !== 'Standard') {
      const filtered = allGroupItems.filter(i => (i.categoryType || '').toLowerCase().trim() === catName.toLowerCase().trim());
      this.availableBomSpecs = filtered.length > 0 ? filtered : allGroupItems;
    } else {
      this.availableBomSpecs = allGroupItems;
    }

    if (this.selectedBomGroup) {
      const parts = [this.selectedBomGroup, catName && catName !== 'Standard' ? catName : ''].filter(Boolean);
      this.materialForm.materialName = parts.join(' - ') || this.selectedBomGroup;
      if (!this.isDescriptionCustomized) {
        this.materialForm.description = this.materialForm.materialName;
      }
    }
    this.cdr.markForCheck();
  }

  onBomSpecSelect(specName: string): void {
    this.selectedBomSpec = specName;
    this.materialForm.specification = specName;
    const specObj = this.availableBomSpecs.find(s => s.specification === specName) ||
                    (this.bomGroupMap[this.selectedBomGroup] || []).find(s => s.specification === specName);
    const grp = this.selectedBomGroup || this.materialForm.materialGroup || '';
    const cat = this.selectedBomCategory || (specObj ? specObj.categoryType : this.materialForm.categoryType) || 'Standard';

    this.materialForm.materialGroup = grp;
    this.materialForm.categoryType = cat;

    if (specName) {
      const parts = [grp, cat && cat !== 'Standard' ? cat : '', specName].filter(Boolean);
      this.materialForm.materialName = parts.join(' - ') || specName;
    }

    if (specObj) {
      this.materialForm.unit = specObj.defaultUom || (grp === 'Cables' ? 'Meter' : 'Nos');
      if (!this.isDescriptionCustomized) {
        this.materialForm.description = cat && cat !== 'Standard'
          ? `${grp} (${cat} - ${specObj.specification})`
          : `${grp} - ${specObj.specification}`;
      }
    }
    this.cdr.markForCheck();
  }

  availableBomSpecsHas(specName: string): boolean {
    if (!specName) return false;
    return this.availableBomSpecs.some(s => s.specification === specName);
  }

  onDescriptionInput(): void {
    this.isDescriptionCustomized = true;
  }

  loadMaterials(): void {
    this.loading = true;
    this.inventoryService.getWarehouseMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.materials = res.data.map(m => {
            let grp = m.materialGroup || '';
            let cat = m.categoryType || '';
            let spec = m.specification || '';
            if (!grp && m.materialName) {
              const parts = m.materialName.split(' - ').map((s: string) => s.trim());
              if (parts.length >= 3 && this.bomGroupKeys.some(k => k.toLowerCase() === parts[0].toLowerCase())) {
                grp = parts[0];
                cat = parts[1];
                spec = parts.slice(2).join(' - ');
              } else if (parts.length === 2 && this.bomGroupKeys.some(k => k.toLowerCase() === parts[0].toLowerCase())) {
                grp = parts[0];
                cat = 'Standard';
                spec = parts[1];
              }
            }
            return {
              ...m,
              materialGroup: grp || m.materialGroup,
              categoryType: cat || m.categoryType,
              specification: spec || m.specification,
              status: computeStockStatus(m.materialName, m.unit, m.inStock)
            };
          });
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load warehouse materials.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get filteredMaterials(): WarehouseMaterial[] {
    if (!this.searchTerm.trim()) return this.materials;
    const term = this.searchTerm.trim().toLowerCase();
    return this.materials.filter(m =>
      (m.materialName || '').toLowerCase().includes(term) ||
      (m.description || '').toLowerCase().includes(term) ||
      (m.unit || '').toLowerCase().includes(term) ||
      (m.status || '').toLowerCase().includes(term)
    );
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add warehouse materials.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.isDescriptionCustomized = false;
    this.selectedBomGroup = '';
    this.selectedBomCategory = '';
    this.selectedBomSpec = '';
    this.availableBomCategories = [];
    this.availableBomSpecs = [];
    this.materialForm = this.getEmptyMaterial();
    this.isModalOpen = true;
  }

  openEditModal(item: WarehouseMaterial): void {
    this.isEditMode = true;
    this.isDescriptionCustomized = !!(item.description && item.description.trim());
    this.selectedBomGroup = '';
    this.selectedBomCategory = '';
    this.selectedBomSpec = '';
    this.availableBomCategories = [];
    this.availableBomSpecs = [];

    let grp = item.materialGroup || '';
    let cat = item.categoryType || '';
    let spec = item.specification || '';

    // If BOM fields were not directly populated, try splitting from materialName
    if (!grp && item.materialName) {
      const parts = item.materialName.split(' - ').map(s => s.trim());
      if (parts.length >= 3 && this.bomGroupKeys.some(k => k.toLowerCase() === parts[0].toLowerCase())) {
        grp = parts[0];
        cat = parts[1];
        spec = parts.slice(2).join(' - ');
      } else if (parts.length === 2 && this.bomGroupKeys.some(k => k.toLowerCase() === parts[0].toLowerCase())) {
        grp = parts[0];
        cat = 'Standard';
        spec = parts[1];
      }
    }

    if (grp) {
      this.selectedBomGroup = grp;
      const allGroupItems = this.bomGroupMap[grp] || [];
      const cats = Array.from(new Set(allGroupItems.map(i => i.categoryType || 'Standard').filter(Boolean)));
      this.availableBomCategories = cats.length > 0 ? cats : ['Standard'];
      this.selectedBomCategory = cat || this.availableBomCategories[0] || 'Standard';

      if (this.selectedBomCategory && this.selectedBomCategory !== 'Standard') {
        const filtered = allGroupItems.filter(i => (i.categoryType || '').toLowerCase().trim() === this.selectedBomCategory.toLowerCase().trim());
        this.availableBomSpecs = filtered.length > 0 ? filtered : allGroupItems;
      } else {
        this.availableBomSpecs = allGroupItems;
      }
      this.selectedBomSpec = spec;
    }

    this.materialForm = {
      ...item,
      materialGroup: grp || item.materialGroup,
      categoryType: cat || item.categoryType,
      specification: spec || item.specification
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isDescriptionCustomized = false;
    this.selectedBomGroup = '';
    this.selectedBomCategory = '';
    this.selectedBomSpec = '';
    this.availableBomCategories = [];
    this.availableBomSpecs = [];
    this.materialForm = this.getEmptyMaterial();
  }

  saveMaterial(): void {
    if (!this.materialForm.materialName?.trim()) {
      const parts = [
        this.materialForm.materialGroup,
        this.materialForm.categoryType && this.materialForm.categoryType !== 'Standard' ? this.materialForm.categoryType : '',
        this.materialForm.specification
      ].filter(Boolean);
      this.materialForm.materialName = parts.join(' - ') || 
                                       this.materialForm.specification || 
                                       this.materialForm.description?.trim() || 
                                       this.materialForm.materialGroup || 
                                       '';
    }

    if (!this.materialForm.materialName?.trim()) {
      this.showToast('Please enter a Material Name or choose from BOM Master.', 'danger');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'danger');
      return;
    }

    // Auto-compute status strictly based on specification
    const stock = parseFloat(this.materialForm.inStock as any) || 0;
    this.materialForm.inStock = stock;
    this.materialForm.status = computeStockStatus(
      this.materialForm.materialName,
      this.materialForm.unit,
      stock
    );

    if (this.isEditMode && this.materialForm.id) {
      this.inventoryService.updateWarehouseMaterial(this.materialForm.id, this.materialForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.materials.findIndex(m => m.id === this.materialForm.id);
            const savedItem = {
              ...res.data,
              status: computeStockStatus(res.data.materialName, res.data.unit, res.data.inStock)
            };
            if (idx !== -1) {
              this.materials[idx] = savedItem;
            }
            this.showToast('Warehouse material updated!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update material.', 'danger')
      });
    } else {
      this.inventoryService.createWarehouseMaterial(this.materialForm).subscribe({
        next: (res) => {
          if (res.success) {
            const newItem = {
              ...res.data,
              status: computeStockStatus(res.data.materialName, res.data.unit, res.data.inStock)
            };
            this.materials.unshift(newItem);
            this.showToast('Material added to warehouse!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add material.', 'danger')
      });
    }
  }

  confirmDelete(item: WarehouseMaterial): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete warehouse materials.', 'danger');
      return;
    }
    this.materialToDelete = item;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.materialToDelete = null;
    this.isDeleteModalOpen = false;
  }

  deleteMaterial(): void {
    if (!this.materialToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete warehouse materials.', 'danger');
      return;
    }
    const id = this.materialToDelete.id;
    this.inventoryService.deleteWarehouseMaterial(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.materials = this.materials.filter(m => m.id !== id);
          this.showToast('Material deleted from warehouse.', 'success');
          this.closeDeleteModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete material.', 'danger')
    });
  }

  getEmptyMaterial(): Partial<WarehouseMaterial> {
    return {
      materialName: '',
      materialGroup: '',
      categoryType: '',
      specification: '',
      description: '',
      unit: 'Nos',
      inStock: 0,
      status: 'In Stock'
    };
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

  exportWarehousePdf(): void {
    const list = this.filteredMaterials;
    if (list.length === 0) {
      this.showToast('No warehouse materials available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - WAREHOUSE STOCK INVENTORY', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Materials: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Material Name', 'Description', 'Unit', 'In Stock', 'Status']
    ];

    const body = list.map((m, idx) => [
      idx + 1,
      m.materialName || '',
      m.description || '—',
      m.unit || 'Nos',
      Number(m.inStock || 0).toLocaleString('en-IN'),
      this.computeStockStatus(m.materialName, m.unit, m.inStock)
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Warehouse_Stock_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Warehouse Stock PDF exported successfully!', 'success');
  }

  exportToExcel(): void {
    const list = this.filteredMaterials;
    if (list.length === 0) return;
    const headers = ['S.No', 'Material Name', 'Description', 'Unit', 'In Stock', 'Status'];
    const rows = list.map((m, idx) => [
      idx + 1,
      `"${m.materialName || ''}"`,
      `"${m.description || ''}"`,
      `"${m.unit || ''}"`,
      m.inStock || 0,
      `"${this.computeStockStatus(m.materialName, m.unit, m.inStock)}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Warehouse_Stock_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportWarehousePdf();
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

        const materialsBatch: Partial<WarehouseMaterial>[] = rawRows.map((row, idx) => {
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

          const materialName = getVal(['material name', 'material', 'name', 'item']) || `Material ${idx + 1}`;
          const description = getVal(['description', 'specifications', 'spec', 'details']) || '';
          const unit = getVal(['unit', 'uom']) || 'Nos';
          const inStock = parseNum(['in stock', 'instock', 'stock', 'quantity', 'qty']) || 0;
          const computedStatus = computeStockStatus(materialName, unit, inStock);

          return {
            materialName,
            description,
            unit,
            inStock,
            status: computedStatus
          };
        });

        let completed = 0;
        this.showToast(`Importing ${materialsBatch.length} warehouse stock items from Excel...`, 'info');

        materialsBatch.forEach(mat => {
          this.inventoryService.createWarehouseMaterial(mat as any).subscribe({
            next: () => {
              completed++;
              if (completed === materialsBatch.length) {
                this.loadMaterials();
                this.showToast(`Successfully imported ${completed} materials into warehouse inventory!`, 'success');
              }
            },
            error: () => {
              completed++;
              if (completed === materialsBatch.length) {
                this.loadMaterials();
                this.showToast(`Imported ${completed} material items into warehouse.`, 'success');
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

  clearAllWarehouse(): void {
    if (confirm('Are you sure you want to clear ALL warehouse material records? This will delete all current stock items so you can upload a clean Excel file.')) {
      this.inventoryService.clearAllWarehouse().subscribe({
        next: () => {
          this.showToast('All warehouse stock records cleared successfully.', 'success');
          this.loadMaterials();
        },
        error: (err) => {
          this.showToast('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
