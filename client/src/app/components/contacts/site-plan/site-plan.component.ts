import { Component, OnInit, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SitePlanService, SitePlanItem } from '../../../services/site-plan.service';
import { AuthService } from '../../../services/auth.service';
import { OfficeService, Employee } from '../../../services/office.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-site-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './site-plan.component.html',
  styleUrls: ['./site-plan.component.css']
})
export class SitePlanComponent implements OnInit {
  private sitePlanService = inject(SitePlanService);
  private officeService = inject(OfficeService);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  sitePlans: SitePlanItem[] = [];
  loading = false;
  searchTerm = '';

  // Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Edit Modal
  isEditModalOpen = false;
  planToEdit: SitePlanItem | null = null;
  editForm: Partial<SitePlanItem> = {};

  // Delete Modal
  isDeleteModalOpen = false;
  planToDelete: SitePlanItem | null = null;

  // Engineer options from office employees where responsibility === 'Engineers'
  engineersList: string[] = [];

  ngOnInit(): void {
    this.loadEngineers();
    this.loadSitePlans();
  }

  loadEngineers(): void {
    const cached = this.officeService.getCachedEmployees();
    if (cached.length > 0) {
      this.extractEngineers(cached);
    } else {
      this.officeService.getEmployees().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.extractEngineers(res.data);
          }
        },
        error: (err) => console.error('Failed to load employees for site plan engineers:', err)
      });
    }
  }

  private extractEngineers(emps: Employee[]): void {
    const engs = emps
      .filter(e => (e.responsibility || '').toLowerCase() === 'engineers' || (e.designation || '').toLowerCase().includes('engineer'))
      .map(e => e.name);
    this.engineersList = Array.from(new Set(engs));
  }

  loadSitePlans(): void {
    this.loading = true;
    const user = this.authService.currentUser();
    const userName = user?.name || '';
    const isAdmin = this.authService.isAdmin();

    this.sitePlanService.getSitePlans(userName, isAdmin).subscribe({
      next: (res) => {
        if (res.success) {
          this.sitePlans = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading site plans:', err);
        this.showToast('Failed to load site plans from server.', 'danger');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredSitePlans(): SitePlanItem[] {
    if (!this.searchTerm.trim()) {
      return this.sitePlans;
    }
    const term = this.searchTerm.trim().toLowerCase();
    return this.sitePlans.filter(p =>
      (p.clientName || '').toLowerCase().includes(term) ||
      (p.engineerName || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term) ||
      (p.date || '').toLowerCase().includes(term) ||
      (p.assignedBy || '').toLowerCase().includes(term)
    );
  }

  canEdit(): boolean {
    return this.authService.canEdit('activity');
  }

  canDelete(): boolean {
    return this.authService.canDelete('activity');
  }

  openEditModal(plan: SitePlanItem): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit site plans.', 'danger');
      return;
    }
    this.planToEdit = plan;
    this.editForm = {
      date: plan.date,
      time: plan.time || '10:00',
      clientName: plan.clientName,
      engineerName: plan.engineerName,
      description: plan.description
    };
    this.isEditModalOpen = true;
    this.cdr.markForCheck();
  }

  formatTime12Hour(timeStr?: string): string {
    if (!timeStr) return '';
    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
      return timeStr;
    }
    const parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].substring(0, 2);
      if (isNaN(hours)) return timeStr;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const hoursStr = hours < 10 ? '0' + hours : '' + hours;
      return `${hoursStr}:${minutes} ${ampm}`;
    }
    return timeStr;
  }

  formatTime(timeStr?: string): string {
    return this.formatTime12Hour(timeStr);
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.planToEdit = null;
    this.cdr.markForCheck();
  }

  saveEditPlan(): void {
    if (!this.planToEdit?.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit site plans.', 'danger');
      return;
    }
    if (!this.editForm.date) {
      this.showToast('Please select a date.', 'danger');
      return;
    }

    this.sitePlanService.updateSitePlan(this.planToEdit.id, this.editForm).subscribe({
      next: (res) => {
        if (res.success) {
          const idx = this.sitePlans.findIndex(p => p.id === this.planToEdit!.id);
          if (idx !== -1) {
            this.sitePlans[idx] = { ...this.sitePlans[idx], ...res.data };
          }
          this.showToast('Site Plan updated successfully!', 'success');
          this.closeEditModal();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to update site plan.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  openDeleteModal(plan: SitePlanItem): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete site plans.', 'danger');
      return;
    }
    this.planToDelete = plan;
    this.isDeleteModalOpen = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.planToDelete = null;
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    if (!this.planToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete site plans.', 'danger');
      return;
    }
    const id = this.planToDelete.id;

    this.sitePlanService.deleteSitePlan(id).subscribe({
      next: () => {
        this.sitePlans = this.sitePlans.filter(p => p.id !== id);
        this.showToast('Site Plan deleted successfully.', 'success');
        this.closeDeleteModal();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to delete site plan.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 3500);
  }

  formatDate(dateVal?: any): string {
    if (!dateVal) return '-';
    try {
      if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return '-';
        const d = String(dateVal.getDate()).padStart(2, '0');
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const y = dateVal.getFullYear();
        return `${d}-${m}-${y}`;
      }

      const str = String(dateVal).trim();
      if (!str || str === '-' || str === 'null' || str === 'undefined') return '-';

      const clean = str.split('T')[0].split(' ')[0].trim();

      const ymd = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
      if (ymd) {
        const y = ymd[1];
        const m = ymd[2].padStart(2, '0');
        const d = ymd[3].padStart(2, '0');
        return `${d}-${m}-${y}`;
      }

      const dmy = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (dmy) {
        const d = dmy[1].padStart(2, '0');
        const m = dmy[2].padStart(2, '0');
        const y = dmy[3];
        return `${d}-${m}-${y}`;
      }

      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        const d = String(parsed.getDate()).padStart(2, '0');
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const y = parsed.getFullYear();
        return `${d}-${m}-${y}`;
      }

      return clean || str;
    } catch {
      return String(dateVal);
    }
  }

  exportToPdf(): void {
    const list = this.filteredSitePlans;
    if (list.length === 0) {
      this.showToast('No site plan records available to export.', 'info');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74);
    doc.text('SOLAR SATHLOKHAR - SITE PLAN INSPECTION REPORT', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Site Plans: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [
      ['S.No', 'Date Assigned', 'Time', 'Client Name', 'Engineer Name', 'Description / Scope', 'Assigned By']
    ];

    const body = list.map((p, idx) => [
      idx + 1,
      this.formatDate(p.date),
      this.formatTime(p.time) || '10:00 AM',
      p.clientName || '—',
      p.engineerName || '—',
      p.description || '—',
      p.assignedBy || 'Admin'
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 244] }
    });

    doc.save(`Site_Plans_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Site Plan PDF exported successfully!', 'success');
  }

  exportToExcel(): void {
    const list = this.filteredSitePlans;
    if (list.length === 0) return;
    const headers = ['S.No', 'Date Assigned', 'Time', 'Client Name', 'Engineer Name', 'Description / Scope', 'Assigned By'];
    const rows = list.map((p, idx) => [
      idx + 1,
      `"${this.formatDate(p.date)}"`,
      `"${this.formatTime(p.time) || '10:00 AM'}"`,
      `"${p.clientName || ''}"`,
      `"${p.engineerName || ''}"`,
      `"${p.description || ''}"`,
      `"${p.assignedBy || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Site_Plans_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportBothPdfAndExcel(): void {
    this.exportToPdf();
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
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.showToast(`Excel file "${file.name}" uploaded successfully!`, 'success');
      input.value = '';
    }
  }
}
