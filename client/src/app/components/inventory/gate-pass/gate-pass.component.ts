import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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

  canAdd(): boolean {
    return this.authService.canAdd('inventory');
  }

  canEdit(): boolean {
    return this.authService.canEdit('inventory');
  }

  canDelete(): boolean {
    return this.authService.canDelete('inventory');
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
  dispatchMaterials: GatePassItem[] = [];
  stockMaterialOptions: string[] = [...INVENTORY_MATERIALS];

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

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to create gate passes.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.passForm = this.getEmptyGatePass();
    this.dispatchMaterials = [
      {
        materialName: this.stockMaterialOptions[0] || 'Cable Tray Materials',
        unit: 'Nos',
        quantity: 1,
        rate: 0,
        vendorName: this.vendorOptions[0] || '',
        amount: 0
      }
    ];
    this.isModalOpen = true;
  }

  openEditModal(gp: GatePass): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit gate passes.', 'danger');
      return;
    }
    this.isEditMode = true;
    this.passForm = { ...gp };
    if (gp.items && gp.items.length > 0) {
      this.dispatchMaterials = gp.items.map(m => {
        const q = parseFloat(m.quantity as any) || 0;
        const r = parseFloat(m.rate as any) || 0;
        const a = m.amount !== undefined && m.amount !== null ? (parseFloat(m.amount as any) || 0) : Math.round(q * r * 100) / 100;
        return {
          ...m,
          unit: m.unit || 'Nos',
          quantity: q,
          rate: r,
          vendorName: m.vendorName || (this.vendorOptions[0] || ''),
          amount: a
        };
      });
    } else if (gp.descriptions) {
      this.dispatchMaterials = [{
        materialName: gp.descriptions,
        unit: gp.unit || 'Nos',
        quantity: gp.quantity || 1,
        rate: 0,
        vendorName: this.vendorOptions[0] || '',
        amount: 0
      }];
    } else {
      this.dispatchMaterials = [
        {
          materialName: this.stockMaterialOptions[0] || 'Cable Tray Materials',
          unit: 'Nos',
          quantity: 1,
          rate: 0,
          vendorName: this.vendorOptions[0] || '',
          amount: 0
        }
      ];
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
    this.dispatchMaterials.push({
      materialName: this.stockMaterialOptions[0] || 'Cable Tray Materials',
      unit: 'Nos',
      quantity: 1,
      rate: 0,
      vendorName: this.vendorOptions[0] || '',
      amount: 0
    });
  }

  removeMaterialRow(index: number): void {
    this.dispatchMaterials.splice(index, 1);
  }

  calculateRowAmount(m: GatePassItem): void {
    const q = parseFloat(m.quantity as any) || 0;
    const r = parseFloat(m.rate as any) || 0;
    m.amount = Math.round(q * r * 100) / 100;
  }

  getTotalAmount(): number {
    return this.dispatchMaterials.reduce((sum, m) => {
      const q = parseFloat(m.quantity as any) || 0;
      const r = parseFloat(m.rate as any) || 0;
      const a = m.amount !== undefined && m.amount !== null ? (parseFloat(m.amount as any) || 0) : (q * r);
      return sum + a;
    }, 0);
  }

  getGatePassTotal(gp: GatePass): number {
    if (gp.totalAmount !== undefined && gp.totalAmount !== null && Number(gp.totalAmount) > 0) {
      return Number(gp.totalAmount);
    }
    if (gp.items && gp.items.length > 0) {
      return gp.items.reduce((sum, it) => {
        const q = parseFloat(it.quantity as any) || 0;
        const r = parseFloat(it.rate as any) || 0;
        const a = it.amount !== undefined && it.amount !== null ? (parseFloat(it.amount as any) || 0) : (q * r);
        return sum + a;
      }, 0);
    }
    return 0;
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
      remarks: ''
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

    const headers = [
      ['S.No', 'Date', 'Client / Destination', 'Site Engineer', 'Dispatched Materials', 'Qty & Unit', 'Total Amount', 'Remarks']
    ];

    const body = list.map((gp, idx) => {
      let matDetails = gp.descriptions || '';
      if (gp.items && gp.items.length > 0) {
        matDetails = gp.items.map(it => {
          let line = `${it.materialName} (${it.quantity} ${it.unit})`;
          if (it.rate) line += ` @ Rs.${it.rate}`;
          if (it.vendorName) line += ` [Vendor: ${it.vendorName}]`;
          return line;
        }).join('\n');
      }
      const totalAmt = this.getGatePassTotal(gp);
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
}
