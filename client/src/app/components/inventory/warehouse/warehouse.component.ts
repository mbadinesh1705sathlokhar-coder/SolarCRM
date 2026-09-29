import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService, WarehouseMaterial, INVENTORY_MATERIALS, computeStockStatus, getStockThresholdDescription } from '../../../services/inventory.service';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  canAdd(): boolean {
    return this.authService.canAdd('inventory');
  }

  canEdit(): boolean {
    return this.authService.canEdit('inventory');
  }

  canDelete(): boolean {
    return this.authService.canDelete('inventory');
  }

  materials: WarehouseMaterial[] = [];
  loading = false;
  searchTerm = '';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  materialForm: Partial<WarehouseMaterial> = this.getEmptyMaterial();
  materialToDelete: WarehouseMaterial | null = null;
  isDeleteModalOpen = false;

  // Feedback Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  materialOptions: string[] = [...INVENTORY_MATERIALS];
  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box', 'Litre'];

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
    this.masterListService.getList('Materials').subscribe({
      next: (res) => {
        if (res.success && res.data?.items?.length > 0) {
          this.materialOptions = Array.from(new Set([...res.data.items, ...this.materialOptions]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadMaterials(): void {
    this.loading = true;
    this.inventoryService.getWarehouseMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.materials = res.data.map(m => ({
            ...m,
            status: computeStockStatus(m.materialName, m.unit, m.inStock)
          }));
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
    this.materialForm = this.getEmptyMaterial();
    this.isModalOpen = true;
  }

  openEditModal(item: WarehouseMaterial): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit warehouse materials.', 'danger');
      return;
    }
    this.isEditMode = true;
    this.materialForm = { ...item };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.materialForm = this.getEmptyMaterial();
  }

  saveMaterial(): void {
    if (!this.materialForm.materialName?.trim()) {
      this.showToast('Material Name is required.', 'danger');
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
}
