import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  engineers: string[] = ['Soundarajan', 'Sathish', 'V Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Rahul', 'Vairamani'];
  clientOptions: string[] = [];
  stockMaterialOptions: string[] = [...INVENTORY_MATERIALS];
  unitOptions: string[] = ['Nos', 'Meter', 'Set', 'Kg', 'Roll', 'Box'];
  materialStatuses: string[] = ['Ready to issue', 'Requested Vendor', 'Pending'];

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

    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.grouped) {
          const bomSpecs: string[] = [];
          Object.keys(res.grouped).forEach(grp => {
            res.grouped[grp].forEach((item: any) => {
              if (item.specification) {
                bomSpecs.push(`${grp} - ${item.specification}`);
                bomSpecs.push(item.specification);
              }
            });
          });
          this.stockMaterialOptions = Array.from(new Set([...bomSpecs, ...this.stockMaterialOptions]));
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadAwardedClients(): void {
    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
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
            this.engineers = Array.from(new Set(filtered));
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
    this.requestedMaterials = [
      {
        materialName: 'ACDB DCDB 5KW',
        quantity: 1,
        unit: 'Nos',
        status: 'Ready to issue',
        poWo: true
      }
    ];

    this.isModalOpen = true;
  }

  openEditModal(indent: Indent): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit indents.', 'danger');
      return;
    }
    this.isEditMode = true;
    this.indentForm = { ...indent };
    this.requestedMaterials = (indent.materials || []).map(m => ({ ...m }));
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
    this.requestedMaterials.push({
      materialName: this.stockMaterialOptions[0] || 'ACDB DCDB 5KW',
      quantity: 1,
      unit: 'Nos',
      status: 'Ready to issue',
      poWo: false
    });
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

    const payload: Partial<Indent> = {
      ...this.indentForm,
      materials: this.requestedMaterials.filter(m => !!m.materialName?.trim())
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
}
