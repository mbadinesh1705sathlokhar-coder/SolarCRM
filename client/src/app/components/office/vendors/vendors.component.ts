import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OfficeService, OfficeVendor } from '../../../services/office.service';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './vendors.component.html',
  styleUrls: ['./vendors.component.css']
})
export class VendorsComponent implements OnInit {
  private officeService = inject(OfficeService);
  private cdr = inject(ChangeDetectorRef);

  vendors: OfficeVendor[] = [];
  loading = false;
  searchTerm = '';

  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Add / Edit Modal
  isModalOpen = false;
  isEditMode = false;
  vendorForm: Partial<OfficeVendor> = this.getEmptyVendor();
  vendorToEdit: OfficeVendor | null = null;

  // Delete Modal
  isDeleteModalOpen = false;
  vendorToDelete: OfficeVendor | null = null;

  coordinatorOptions = ['Renuka', 'Daya', 'Sharath', 'Sathish', 'K Karthikeyan'];

  ngOnInit(): void {
    const cached = this.officeService.getCachedVendors();
    if (cached.length > 0) {
      this.vendors = cached;
      this.loading = false;
    } else {
      this.loading = true;
    }
    this.loadVendors();
  }

  loadVendors(): void {
    this.officeService.getVendors().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.vendors = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load vendors.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get filteredVendors(): OfficeVendor[] {
    if (!this.searchTerm.trim()) return this.vendors;
    const term = this.searchTerm.trim().toLowerCase();
    return this.vendors.filter(v =>
      (v.vendorName || '').toLowerCase().includes(term) ||
      (v.salesCoordinator || '').toLowerCase().includes(term) ||
      (v.phoneNo || '').toLowerCase().includes(term) ||
      (v.location || '').toLowerCase().includes(term) ||
      (v.materialsSpec || '').toLowerCase().includes(term) ||
      (v.creditDays || '').toLowerCase().includes(term)
    );
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.vendorForm = this.getEmptyVendor();
    this.vendorToEdit = null;
    this.isModalOpen = true;
  }

  openEditModal(vendor: OfficeVendor): void {
    this.isEditMode = true;
    this.vendorToEdit = vendor;
    this.vendorForm = { ...vendor };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.vendorToEdit = null;
    this.vendorForm = this.getEmptyVendor();
  }

  saveVendor(): void {
    if (!this.vendorForm.vendorName?.trim()) {
      this.showToast('Vendor Name is required.', 'danger');
      return;
    }

    if (this.isEditMode && this.vendorToEdit?.id) {
      this.officeService.updateVendor(this.vendorToEdit.id, this.vendorForm).subscribe({
        next: (res) => {
          if (res.success) {
            const idx = this.vendors.findIndex(v => v.id === this.vendorToEdit!.id);
            if (idx !== -1) {
              this.vendors[idx] = res.data;
            }
            this.showToast('Vendor details updated successfully!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to update vendor.', 'danger')
      });
    } else {
      this.officeService.createVendor(this.vendorForm).subscribe({
        next: (res) => {
          if (res.success) {
            this.vendors.unshift(res.data);
            this.showToast('New vendor added successfully!', 'success');
            this.closeModal();
          }
          this.cdr.markForCheck();
        },
        error: () => this.showToast('Failed to add vendor.', 'danger')
      });
    }
  }

  confirmDelete(vendor: OfficeVendor): void {
    this.vendorToDelete = vendor;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.vendorToDelete = null;
  }

  deleteVendor(): void {
    if (!this.vendorToDelete?.id) return;
    const id = this.vendorToDelete.id;
    this.officeService.deleteVendor(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.vendors = this.vendors.filter(v => v.id !== id);
          this.showToast('Vendor removed successfully.', 'success');
          this.closeDeleteModal();
        }
        this.cdr.markForCheck();
      },
      error: () => this.showToast('Failed to delete vendor.', 'danger')
    });
  }

  getEmptyVendor(): Partial<OfficeVendor> {
    return {
      vendorName: '',
      salesCoordinator: 'Renuka',
      phoneNo: '',
      location: '',
      materialsSpec: '',
      creditDays: '30 Days'
    };
  }

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 4500);
  }
}
