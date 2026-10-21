import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/project.model';
import { MasterListService } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface TaxInvoiceLineItem {
  slNo: number;
  bomSelection?: string;
  productName: string;
  hsnSac: string;
  uom: string;
  qty: number;
  rate: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  total: number;
}

export interface TaxInvoiceDocument {
  reverseCharge: string;
  invoiceNo: string;
  invoiceDate: string;
  eWayBillNo: string;
  transportMode: string;
  vehicleNumber: string;
  dateOfSupply: string;
  generatedDate: string;
  generatedDateIso?: string;

  regOfficeName: string;
  regOfficeAddress: string;
  regOfficeGstin: string;
  regOfficeState: string;
  regOfficeStateCode: string;

  despatchName: string;
  despatchAddress: string;
  despatchGstin: string;
  despatchState: string;
  despatchStateCode: string;

  receiverName: string;
  receiverAddress: string;
  receiverGstin: string;
  receiverState: string;
  receiverStateCode: string;

  consigneeName: string;
  consigneeAddress: string;
  consigneeGstin: string;
  consigneeState: string;
  consigneeStateCode: string;

  items: TaxInvoiceLineItem[];

  amountInWords: string;
  bankAccName: string;
  bankCcAccNo: string;
  bankName: string;
  bankIfsc: string;
  bankBranch: string;
  companyPan: string;
  declaration: string;
  gstPayableReverseCharge: string;

  totalBeforeTax: number;
  totalCgst: number;
  totalSgst: number;
  totalTaxGst: number;
  roundOff: number;
  totalAfterTax: number;
}

export interface InvoiceBillingRecord {
  id?: number;
  invoiceDate: string;
  siteId?: string;
  invoiceNo: string;
  invoiceValue: number;
  clientName: string;
  invoiceType: 'Material Supply' | 'I&C Work';
  billTo: string;
  approvalStatus?: string;
  invoiceDoc?: TaxInvoiceDocument | null;
}

@Component({
  selector: 'app-invoice-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid py-3 px-3 px-md-4">
      <!-- Toast Notification -->
      <div *ngIf="toastMessage"
           class="alert alert-dismissible fade show position-fixed top-0 end-0 m-3 shadow-lg border-0"
           [class.alert-success]="toastType === 'success'"
           [class.alert-danger]="toastType === 'danger'"
           [class.alert-info]="toastType === 'info'"
           style="min-width: 320px; z-index: 2050;">
        <i class="bi me-2"
           [class.bi-check-circle-fill]="toastType === 'success'"
           [class.bi-exclamation-triangle-fill]="toastType === 'danger'"
           [class.bi-info-circle-fill]="toastType === 'info'"></i>
        {{ toastMessage }}
        <button type="button" class="btn-close" (click)="toastMessage = ''"></button>
      </div>

      <!-- Hidden File Input for Excel Upload -->
      <input type="file"
             id="invoiceExcelUploadInput"
             class="d-none"
             accept=".xlsx,.xls,.csv"
             (change)="onExcelFileChange($event)">

      <!-- Page Header -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 pb-2 border-bottom">
        <div class="d-flex align-items-center gap-3">
          <div class="p-2.5 rounded-3 bg-primary-subtle text-primary shadow-xs d-flex align-items-center justify-content-center" style="width: 44px; height: 44px;">
            <i class="bi bi-receipt-cutoff fs-4"></i>
          </div>
          <div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-dark text-white font-mono px-2 py-0.5" style="font-size: 0.7rem;">BILLING</span>
              <h4 class="fw-bold mb-0 text-dark">Invoice Billing</h4>
            </div>
            <small class="text-muted">Manage Client Invoices (Material Supply &amp; I&amp;C Work) and generate Tax Invoice PDFs</small>
          </div>
        </div>

        <!-- Upload, Export & Add Invoice Buttons -->
        <div class="d-flex flex-wrap align-items-center gap-2">
          <button type="button"
                  class="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2 shadow-xs d-flex align-items-center gap-1.5 bg-white"
                  (click)="triggerExcelUpload()">
            <i class="bi bi-upload text-primary"></i> Upload
          </button>

          <button type="button"
                  class="btn btn-outline-secondary btn-sm fw-semibold px-3 py-2 shadow-xs d-flex align-items-center gap-1.5 bg-white"
                  (click)="exportToExcel()">
            <i class="bi bi-download text-success"></i> Export
          </button>

          <button type="button"
                  class="btn btn-primary btn-sm fw-bold px-3.5 py-2 shadow-sm d-flex align-items-center gap-1.5"
                  style="background-color: #0f766e; border-color: #0f766e;"
                  (click)="openAddInvoiceModal()">
            <i class="bi bi-plus-circle-fill"></i> + Add Invoice
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="row g-3 mb-3">
        <div class="col-md-4 col-6">
          <div class="card border-0 shadow-xs rounded-3 p-3 bg-white h-100 border-start border-4 border-primary">
            <div class="text-muted small fw-semibold text-uppercase" style="font-size: 0.7rem;">Total Invoices</div>
            <div class="fs-4 fw-bold text-dark mt-1 font-mono">{{ filteredRecords.length }}</div>
          </div>
        </div>
        <div class="col-md-4 col-6">
          <div class="card border-0 shadow-xs rounded-3 p-3 bg-white h-100 border-start border-4 border-success">
            <div class="text-muted small fw-semibold text-uppercase" style="font-size: 0.7rem;">Total Invoice Value</div>
            <div class="fs-5 fw-bold text-success mt-1 font-mono">₹ {{ totalInvoiceValue | number:'1.2-2' }}</div>
          </div>
        </div>
        <div class="col-md-4 col-12">
          <div class="card border-0 shadow-xs rounded-3 p-3 bg-white h-100 border-start border-4 border-info">
            <div class="text-muted small fw-semibold text-uppercase" style="font-size: 0.7rem;">Material Supply / I&amp;C Work</div>
            <div class="small fw-bold text-dark mt-2">
              <span class="badge bg-info-subtle text-info-emphasis border me-1">{{ materialSupplyCount }} Material Supply</span>
              <span class="badge bg-warning-subtle text-warning-emphasis border">{{ icWorkCount }} I&amp;C Work</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter & Search Bar -->
      <div class="card border-0 shadow-sm rounded-3 p-2.5 px-3 bg-white mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <div class="input-group input-group-sm" style="max-width: 360px;">
              <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
              <input type="text"
                     class="form-control border-start-0 bg-light"
                     placeholder="Search SP ID, Invoice No, Client Name, Bill to..."
                     [(ngModel)]="searchTerm">
            </div>

            <select class="form-select form-select-sm bg-light" style="width: 190px;" [(ngModel)]="typeFilter">
              <option value="ALL">All Invoice Types</option>
              <option value="Material Supply">Material Supply</option>
              <option value="I&C Work">I&amp;C Work</option>
            </select>
          </div>

          <span class="small text-muted">
            Showing <strong>{{ filteredRecords.length }}</strong> of {{ records.length }} invoices
          </span>
        </div>
      </div>

      <!-- Invoice Billing Table -->
      <div class="card border-0 shadow-sm rounded-3 bg-white overflow-hidden">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size: 0.78rem;">
            <thead class="table-light">
              <tr class="text-uppercase text-muted" style="font-size: 0.71rem; letter-spacing: 0.3px;">
                <th style="width: 105px;">Date</th>
                <th style="width: 100px;">SP ID</th>
                <th style="width: 150px;">Invoice No</th>
                <th style="width: 140px;" class="text-end">Invoice Value</th>
                <th style="width: 200px;">Client Name</th>
                <th style="width: 135px;" class="text-center">Invoice Type</th>
                <th>Bill to</th>
                <th style="width: 65px;" class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="loading">
                <td colspan="8" class="text-center py-5 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                  Loading Invoice Billing records...
                </td>
              </tr>
              <tr *ngIf="!loading && filteredRecords.length === 0">
                <td colspan="8" class="text-center py-5 text-muted">
                  <i class="bi bi-receipt fs-1 d-block mb-2 text-secondary opacity-50"></i>
                  No Invoice Billing records found. Click <strong>+ Add Invoice</strong> or <strong>Upload</strong> to add records.
                </td>
              </tr>
              <tr *ngFor="let rec of filteredRecords">
                <!-- 1. Date (DD-MM-YYYY) -->
                <td class="font-mono text-dark text-nowrap" style="font-size: 0.76rem;">
                  {{ formatDateDisplay(rec.invoiceDate) }}
                </td>

                <!-- 2. SP ID (Clickable to Edit) -->
                <td>
                  <a href="javascript:void(0)"
                     class="badge bg-primary-subtle text-primary border border-primary-subtle font-mono fw-bold text-decoration-none px-2 py-0.5"
                     style="font-size: 0.72rem;"
                     (click)="openEditInvoiceRecordModal(rec)"
                     title="Click SP ID to edit invoice details">
                    {{ getResolvedSpId(rec) }}
                  </a>
                </td>

                <!-- 3. Invoice No (varchar(20)) -->
                <td class="font-mono fw-semibold text-dark" style="font-size: 0.77rem;">
                  {{ rec.invoiceNo }}
                </td>

                <!-- 4. Invoice Value (double) -->
                <td class="text-end font-mono fw-bold text-dark text-nowrap" style="font-size: 0.79rem;">
                  ₹ {{ (rec.invoiceValue || 0) | number:'1.2-2' }}
                </td>

                <!-- 5. Client Name (Clickable to Edit) -->
                <td>
                  <a href="javascript:void(0)"
                     class="fw-bold text-dark text-decoration-none name-edit-link"
                     style="font-size: 0.78rem;"
                     (click)="openEditInvoiceRecordModal(rec)"
                     title="Click Client Name to edit invoice details">
                    {{ rec.clientName }}
                  </a>
                </td>

                <!-- 6. Invoice Type [Material Supply, I&C Work] -->
                <td class="text-center">
                  <span class="badge rounded-pill px-2 py-0.5 fw-semibold"
                        style="font-size: 0.7rem;"
                        [ngClass]="rec.invoiceType === 'I&C Work' ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' : 'bg-info-subtle text-info-emphasis border border-info-subtle'">
                    {{ rec.invoiceType }}
                  </span>
                </td>

                <!-- 7. Bill to (varchar(200)) -->
                <td class="text-secondary" style="font-size: 0.76rem; max-width: 260px;">
                  <div class="text-truncate" [title]="rec.billTo">{{ rec.billTo || '—' }}</div>
                </td>

                <!-- 8. Actions: Delete button -->
                <td class="text-center">
                  <button type="button"
                          class="btn btn-sm btn-link text-danger p-0 border-0"
                          (click)="deleteRecord(rec)"
                          title="Delete Invoice">
                    <i class="bi bi-trash3"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 1: 2-STEP ADD / EDIT INVOICE RECORD                                 -->
      <!-- Step 1: Basic Invoice Info (Date, Invoice No, Client Name w/ SP ID, Bill to) -->
      <!-- Step 2: Tax Invoice Form (Vehicle No, e-Way Bill, Generated Date & Time,  -->
      <!--         Billed/Shipped to, BOM Product/Service, HSN/SAC, Rate, CGST/SGST, -->
      <!--         Round Off, and Editable Company Bank Details)                     -->
      <!-- ========================================================================= -->
      <div class="modal fade show d-block" *ngIf="isRecordModalOpen" tabindex="-1" style="background: rgba(15, 23, 42, 0.65); z-index: 1085; overflow-y: auto;">
        <div class="modal-dialog modal-dialog-centered my-3" [style.max-width]="modalStep === 1 ? '600px' : '980px'">
          <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <!-- Header -->
            <div class="modal-header bg-dark text-white py-2.5 px-4 d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-receipt text-warning"></i>
                <h6 class="modal-title fw-bold mb-0">
                  {{ editingId ? 'Edit Invoice' : 'Add New Invoice' }}
                </h6>
                <span class="badge rounded-pill ms-2"
                      [ngClass]="modalStep === 1 ? 'bg-primary' : 'bg-warning text-dark'"
                      style="font-size: 0.7rem;">
                  Step {{ modalStep }} of 2: {{ modalStep === 1 ? 'Invoice Summary' : 'Tax Invoice Details & BOM Items' }}
                </span>
              </div>
              <button type="button" class="btn-close btn-close-white" (click)="closeRecordModal()"></button>
            </div>

            <!-- ================= STEP 1: BASIC INVOICE DETAILS ================= -->
            <div *ngIf="modalStep === 1">
              <div class="modal-body p-3.5 px-4 bg-light" style="font-size: 0.84rem;" (click)="closeClientDropdownOnOutsideClick($event)">
                <div class="row g-2.5">
                  <!-- Date -->
                  <div class="col-md-6">
                    <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.8rem;">
                      Date <span class="text-danger">*</span>
                    </label>
                    <input type="date"
                           class="form-control form-control-sm font-mono shadow-sm"
                           style="font-size: 0.84rem;"
                           [(ngModel)]="form.invoiceDate"
                           name="invoiceDate"
                           required>
                  </div>

                  <!-- Invoice No -->
                  <div class="col-md-6">
                    <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.8rem;">
                      Invoice No <span class="text-danger">*</span>
                    </label>
                    <input type="text"
                           class="form-control form-control-sm font-mono fw-semibold shadow-sm"
                           style="font-size: 0.84rem;"
                           maxlength="20"
                           placeholder="e.g. 113/SOLAR/26-27"
                           [(ngModel)]="form.invoiceNo"
                           name="invoiceNo"
                           required>
                  </div>

                  <!-- Searchable Client Name (With SP ID from Awarded Sites) -->
                  <div class="col-md-7 position-relative client-search-wrapper">
                    <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.8rem;">
                      Client Name <span class="text-danger">*</span>
                    </label>
                    <div class="input-group input-group-sm shadow-sm">
                      <span class="input-group-text bg-white border-end-0 text-muted">
                        <i class="bi bi-search" style="font-size: 0.78rem;"></i>
                      </span>
                      <input type="text"
                             class="form-control form-control-sm border-start-0 fw-semibold"
                             style="font-size: 0.84rem;"
                             placeholder="Type SP ID or Client Name to search..."
                             [(ngModel)]="clientSearchText"
                             name="clientSearchText"
                             autocomplete="off"
                             (focus)="isClientDropdownOpen = true"
                             (input)="onClientSearchInput()">
                      <button *ngIf="clientSearchText"
                              type="button"
                              class="btn btn-outline-secondary border-start-0 bg-white text-muted px-2"
                              (click)="clearClientSelection($event)"
                              title="Clear selection">
                        <i class="bi bi-x-lg" style="font-size: 0.72rem;"></i>
                      </button>
                      <button type="button"
                              class="btn btn-outline-secondary bg-white text-dark px-2"
                              (click)="toggleClientDropdown($event)"
                              title="Toggle list">
                        <i class="bi" [ngClass]="isClientDropdownOpen ? 'bi-chevron-up' : 'bi-chevron-down'" style="font-size: 0.75rem;"></i>
                      </button>
                    </div>

                    <!-- Searchable Dropdown Menu -->
                    <div *ngIf="isClientDropdownOpen"
                         class="position-absolute start-0 end-0 mt-1 bg-white border rounded-3 shadow-lg mx-2"
                         style="max-height: 220px; overflow-y: auto; z-index: 2000;">
                      <div *ngIf="filteredClientProjects.length === 0" class="p-2.5 text-center text-muted small">
                        No matching SP ID or Client Name found.
                      </div>
                      <button *ngFor="let p of filteredClientProjects"
                              type="button"
                              class="dropdown-item py-1.5 px-3 d-flex align-items-center justify-content-between border-bottom border-light-subtle text-wrap"
                              [class.bg-primary-subtle]="p.siteId === selectedSiteKey"
                              style="font-size: 0.82rem;"
                              (click)="selectClientFromDropdown(p)">
                        <div>
                          <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-mono me-2">{{ p.siteId }}</span>
                          <span class="fw-semibold text-dark">{{ p.clientName }}</span>
                        </div>
                        <small class="text-muted ms-2 text-truncate" style="max-width: 140px;">{{ p.location || p.address || '' }}</small>
                      </button>
                    </div>
                  </div>

                  <!-- SP ID (Read-only, auto-filled from Client Name) -->
                  <div class="col-md-5">
                    <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.8rem;">
                      SP ID
                    </label>
                    <input type="text"
                           class="form-control form-control-sm font-mono fw-semibold bg-secondary-subtle text-dark shadow-sm"
                           style="font-size: 0.84rem;"
                           [(ngModel)]="form.siteId"
                           name="siteId"
                           placeholder="Auto-filled from Client"
                           readonly>
                  </div>

                  <!-- Invoice Type [Material Supply, I&C Work] -->
                  <div class="col-md-12">
                    <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.8rem;">
                      Invoice Type <span class="text-danger">*</span>
                    </label>
                    <select class="form-select form-select-sm fw-semibold shadow-sm"
                            style="font-size: 0.84rem;"
                            [(ngModel)]="form.invoiceType"
                            name="invoiceType"
                            required>
                      <option value="Material Supply">Material Supply</option>
                      <option value="I&C Work">I&amp;C Work</option>
                    </select>
                  </div>

                  <!-- Bill to (Auto-populated from Awarded Sites address) -->
                  <div class="col-12">
                    <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.8rem;">
                      Bill to
                    </label>
                    <textarea rows="2"
                              maxlength="200"
                              class="form-control form-control-sm shadow-sm"
                              style="font-size: 0.84rem;"
                              placeholder="Address auto-filled from Awarded Sites..."
                              [(ngModel)]="form.billTo"
                              (ngModelChange)="onStep1BillToChange($event)"
                              name="billTo"></textarea>
                  </div>
                </div>
              </div>

              <div class="modal-footer bg-white border-top py-2.5 px-4 d-flex justify-content-between">
                <button type="button" class="btn btn-sm btn-outline-secondary px-3" (click)="closeRecordModal()">Cancel</button>
                <div class="d-flex gap-2">
                  <button type="button"
                          class="btn btn-sm btn-primary fw-bold px-4 shadow-sm d-flex align-items-center gap-1.5"
                          style="background-color: #0f766e; border-color: #0f766e;"
                          (click)="goToStep2()">
                    Next <i class="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- ================= STEP 2: TAX INVOICE FORM DETAILS ================= -->
            <div *ngIf="modalStep === 2">
              <div class="modal-body p-3.5 px-4 bg-light" style="font-size: 0.82rem; max-height: 76vh; overflow-y: auto;">

                <!-- 1. Transport, Vehicle, e-Way Bill & Generated Date/Time -->
                <div class="card border-0 shadow-xs rounded-3 p-3 bg-white mb-3">
                  <div class="fw-bold text-primary mb-2 d-flex align-items-center gap-1.5" style="font-size: 0.8rem;">
                    <i class="bi bi-truck"></i> Transport, e-Way Bill &amp; Generated Date Details
                  </div>
                  <div class="row g-2.5">
                    <div class="col-md-3">
                      <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.76rem;">Vehicle Number</label>
                      <input type="text"
                             class="form-control form-control-sm font-mono"
                             style="font-size: 0.82rem;"
                             placeholder="e.g. TN 15 ML 1455"
                             [(ngModel)]="doc.vehicleNumber">
                    </div>
                    <div class="col-md-3">
                      <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.76rem;">e-Way Bill No.</label>
                      <input type="text"
                             class="form-control form-control-sm font-mono"
                             style="font-size: 0.82rem;"
                             placeholder="e.g. 5320 8775 1598"
                             [(ngModel)]="doc.eWayBillNo">
                    </div>
                    <div class="col-md-3">
                      <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.76rem;">Generated Date (Date &amp; Time)</label>
                      <input type="datetime-local"
                             class="form-control form-control-sm font-mono"
                             style="font-size: 0.82rem;"
                             [(ngModel)]="doc.generatedDateIso"
                             (ngModelChange)="onGeneratedDateTimeChange($event)">
                    </div>
                    <div class="col-md-3">
                      <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.76rem;">Reverse Charge / Mode</label>
                      <div class="input-group input-group-sm">
                        <select class="form-select form-select-sm font-mono" style="max-width: 75px; font-size: 0.82rem;" [(ngModel)]="doc.reverseCharge">
                          <option value="N">N</option>
                          <option value="Y">Y</option>
                          <option value="Y/N">Y/N</option>
                        </select>
                        <input type="text" class="form-control form-control-sm" style="font-size: 0.82rem;" [(ngModel)]="doc.transportMode" placeholder="Road">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 2. Billed To & Shipped To (Same by default from Awarded Sites) -->
                <div class="card border-0 shadow-xs rounded-3 p-3 bg-white mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold text-primary d-flex align-items-center gap-1.5" style="font-size: 0.8rem;">
                      <i class="bi bi-geo-alt-fill"></i> Details of Receiver (Billed to) &amp; Consignee (Shipped to)
                    </span>
                    <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 0.7rem;">
                      Auto-synced from Awarded Sites
                    </span>
                  </div>
                  <div class="row g-2.5">
                    <!-- Billed to -->
                    <div class="col-md-6 border-end pe-md-3">
                      <div class="fw-bold text-dark mb-1" style="font-size: 0.76rem;">Details of Receiver | Billed to:</div>
                      <div class="mb-1.5">
                        <input type="text"
                               class="form-control form-control-sm fw-semibold mb-1"
                               style="font-size: 0.82rem;"
                               placeholder="Receiver Name"
                               [(ngModel)]="doc.receiverName"
                               (ngModelChange)="onReceiverDetailsChange()">
                        <textarea rows="2"
                                  class="form-control form-control-sm mb-1"
                                  style="font-size: 0.82rem;"
                                  placeholder="Receiver Address"
                                  [(ngModel)]="doc.receiverAddress"
                                  (ngModelChange)="onReceiverDetailsChange()"></textarea>
                        <div class="row g-1.5">
                          <div class="col-5">
                            <input type="text" class="form-control form-control-sm font-mono" style="font-size: 0.78rem;" placeholder="GSTIN (Optional)" [(ngModel)]="doc.receiverGstin">
                          </div>
                          <div class="col-4">
                            <input type="text" class="form-control form-control-sm" style="font-size: 0.78rem;" placeholder="State" [(ngModel)]="doc.receiverState">
                          </div>
                          <div class="col-3">
                            <input type="text" class="form-control form-control-sm font-mono text-center" style="font-size: 0.78rem;" placeholder="Code" [(ngModel)]="doc.receiverStateCode">
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Shipped to -->
                    <div class="col-md-6 ps-md-3">
                      <div class="fw-bold text-dark mb-1" style="font-size: 0.76rem;">Details of Consignee | Shipped to:</div>
                      <div class="mb-1.5">
                        <input type="text"
                               class="form-control form-control-sm fw-semibold mb-1"
                               style="font-size: 0.82rem;"
                               placeholder="Consignee Name"
                               [(ngModel)]="doc.consigneeName">
                        <textarea rows="2"
                                  class="form-control form-control-sm mb-1"
                                  style="font-size: 0.82rem;"
                                  placeholder="Consignee Address"
                                  [(ngModel)]="doc.consigneeAddress"></textarea>
                        <div class="row g-1.5">
                          <div class="col-5">
                            <input type="text" class="form-control form-control-sm font-mono" style="font-size: 0.78rem;" placeholder="GSTIN (Optional)" [(ngModel)]="doc.consigneeGstin">
                          </div>
                          <div class="col-4">
                            <input type="text" class="form-control form-control-sm" style="font-size: 0.78rem;" placeholder="State" [(ngModel)]="doc.consigneeState">
                          </div>
                          <div class="col-3">
                            <input type="text" class="form-control form-control-sm font-mono text-center" style="font-size: 0.78rem;" placeholder="Code" [(ngModel)]="doc.consigneeStateCode">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 3. Product / Service Line Items (Split into 2 Clean Blocks) -->
                <div class="card border-0 shadow-xs rounded-3 p-3 bg-white mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold text-primary d-flex align-items-center gap-1.5" style="font-size: 0.8rem;">
                      <i class="bi bi-box-seam-fill"></i> Product / Service Items (Select from BOM in Add List)
                    </span>
                    <button type="button" class="btn btn-xs btn-outline-success fw-bold py-0.5 px-2.5" style="font-size: 0.75rem;" (click)="addItemRow()">
                      + Add Row
                    </button>
                  </div>

                  <!-- BLOCK 1: Name of Product / Service, HSN/SAC, UOM, Qty, Rate -->
                  <div class="mb-3">
                    <div class="small fw-bold text-dark bg-primary-subtle text-primary-emphasis px-2.5 py-1 rounded-top border border-bottom-0 d-flex align-items-center gap-1.5" style="font-size: 0.75rem;">
                      <i class="bi bi-1-circle-fill"></i> Product / Service, HSN, UOM, Qty &amp; Rate
                    </div>
                    <div class="table-responsive">
                      <table class="table table-bordered table-sm align-middle mb-0" style="font-size: 0.8rem;">
                        <thead class="table-light text-center">
                          <tr>
                            <th style="width: 52px;">Sl.</th>
                            <th style="min-width: 280px;">Name of Product / Service (BOM)</th>
                            <th style="width: 135px;">HSN /SAC</th>
                            <th style="width: 95px;">UOM</th>
                            <th style="width: 100px;">Qty</th>
                            <th style="width: 165px;">Rate (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let item of doc.items; let idx = index">
                            <td class="text-center font-mono">
                              <div class="d-flex align-items-center justify-content-center gap-1">
                                <button *ngIf="doc.items.length > 1"
                                        type="button"
                                        class="btn btn-xs text-danger p-0 border-0"
                                        (click)="removeItemRow(idx)">
                                  <i class="bi bi-trash3"></i>
                                </button>
                                <span class="fw-bold">{{ idx + 1 }}</span>
                              </div>
                            </td>
                            <td>
                              <!-- BOM Dropdown from Add List -->
                              <select class="form-select form-select-sm fw-semibold"
                                      style="font-size: 0.8rem;"
                                      [(ngModel)]="item.productName"
                                      (change)="onBomMaterialSelect(item)">
                                <option value="">-- Select Product / Service (BOM) --</option>
                                <option *ngIf="item.productName && !isProductInOptions(item.productName)" [value]="item.productName">
                                  {{ item.productName }}
                                </option>
                                <option *ngFor="let opt of bomProductOptions" [value]="opt.label">
                                  {{ opt.label }}
                                </option>
                              </select>
                            </td>
                            <td>
                              <input type="text"
                                     class="form-control form-control-sm text-center font-mono fw-semibold"
                                     style="font-size: 0.82rem;"
                                     [(ngModel)]="item.hsnSac">
                            </td>
                            <td>
                              <input type="text"
                                     class="form-control form-control-sm text-center fw-semibold"
                                     style="font-size: 0.82rem;"
                                     [(ngModel)]="item.uom">
                            </td>
                            <td>
                              <input type="number"
                                     step="any"
                                     min="0"
                                     class="form-control form-control-sm text-center font-mono fw-semibold"
                                     style="font-size: 0.82rem;"
                                     [(ngModel)]="item.qty"
                                     (ngModelChange)="recalculateTotals()">
                            </td>
                            <td>
                              <input type="number"
                                     step="0.01"
                                     min="0"
                                     class="form-control form-control-sm text-end font-mono fw-bold"
                                     style="font-size: 0.84rem;"
                                     [(ngModel)]="item.rate"
                                     (ngModelChange)="recalculateTotals()">
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- BLOCK 2: Taxable Value, CGST %, CGST Amt, SGST %, SGST Amt, Total (Auto-Calculated) -->
                  <div class="mb-2">
                    <div class="small fw-bold text-dark bg-success-subtle text-success-emphasis px-2.5 py-1 rounded-top border border-bottom-0 d-flex align-items-center justify-content-between" style="font-size: 0.75rem;">
                      <span><i class="bi bi-2-circle-fill me-1"></i> Tax &amp; Amount Calculation (Enter % — Amounts calculate automatically)</span>
                      <span class="badge bg-white text-dark border font-mono" style="font-size: 0.7rem;">Auto-Calculated</span>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-bordered table-sm align-middle mb-0" style="font-size: 0.8rem;">
                        <thead class="table-light text-center">
                          <tr>
                            <th style="width: 52px;">Sl.</th>
                            <th style="width: 170px;">Taxable Value (₹)</th>
                            <th style="width: 120px;">CGST %</th>
                            <th style="width: 150px;">CGST Amt (₹)</th>
                            <th style="width: 120px;">SGST %</th>
                            <th style="width: 150px;">SGST Amt (₹)</th>
                            <th style="width: 175px;">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let item of doc.items; let idx = index">
                            <td class="text-center font-mono fw-bold bg-light">{{ idx + 1 }}</td>
                            <td class="text-end font-mono bg-light fw-semibold pe-2.5" style="font-size: 0.82rem;">
                              ₹ {{ item.taxableValue | number:'1.2-2' }}
                            </td>
                            <td>
                              <div class="input-group input-group-sm">
                                <input type="number"
                                       step="0.1"
                                       min="0"
                                       class="form-control form-control-sm text-center font-mono fw-bold"
                                       style="font-size: 0.82rem;"
                                       [(ngModel)]="item.cgstRate"
                                       (ngModelChange)="recalculateTotals()">
                                <span class="input-group-text bg-light px-1.5">%</span>
                              </div>
                            </td>
                            <td class="text-end font-mono bg-light pe-2.5" style="font-size: 0.82rem;">
                              ₹ {{ item.cgstAmount | number:'1.2-2' }}
                            </td>
                            <td>
                              <div class="input-group input-group-sm">
                                <input type="number"
                                       step="0.1"
                                       min="0"
                                       class="form-control form-control-sm text-center font-mono fw-bold"
                                       style="font-size: 0.82rem;"
                                       [(ngModel)]="item.sgstRate"
                                       (ngModelChange)="recalculateTotals()">
                                <span class="input-group-text bg-light px-1.5">%</span>
                              </div>
                            </td>
                            <td class="text-end font-mono bg-light pe-2.5" style="font-size: 0.82rem;">
                              ₹ {{ item.sgstAmount | number:'1.2-2' }}
                            </td>
                            <td class="text-end font-mono fw-bold bg-light text-dark pe-2.5" style="font-size: 0.84rem;">
                              ₹ {{ item.total | number:'1.2-2' }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- Totals & Round Off Bar -->
                  <div class="row g-2 mt-1 pt-2 border-top align-items-center">
                    <div class="col-md-7">
                      <label class="form-label fw-bold text-dark mb-1" style="font-size: 0.75rem;">Total Invoice Amount in Words :</label>
                      <input type="text"
                             class="form-control form-control-sm fw-semibold"
                             style="font-size: 0.78rem;"
                             [(ngModel)]="doc.amountInWords"
                             (input)="amountInWordsManuallyEdited = true">
                    </div>
                    <div class="col-md-5">
                      <div class="p-2 rounded bg-light border font-mono" style="font-size: 0.76rem;">
                        <div class="d-flex justify-content-between">
                          <span>Total Before Tax:</span>
                          <strong>₹ {{ doc.totalBeforeTax | number:'1.2-2' }}</strong>
                        </div>
                        <div class="d-flex justify-content-between">
                          <span>Add CGST + SGST:</span>
                          <span>₹ {{ doc.totalCgst | number:'1.2-2' }} + ₹ {{ doc.totalSgst | number:'1.2-2' }}</span>
                        </div>
                        <div class="d-flex justify-content-between text-secondary">
                          <span>Round Off (Paise):</span>
                          <span>{{ doc.roundOff >= 0 ? '+' + (doc.roundOff | number:'1.2-2') : (doc.roundOff | number:'1.2-2') }}</span>
                        </div>
                        <div class="d-flex justify-content-between border-top pt-1 mt-1 fw-bold text-success" style="font-size: 0.84rem;">
                          <span>Total After Tax (Invoice Value):</span>
                          <span>₹ {{ doc.totalAfterTax | number:'1.2-2' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 4. Our Company Bank Accounts Details (Editable with Default Values) -->
                <div class="card border-0 shadow-xs rounded-3 p-3 bg-white">
                  <div class="fw-bold text-primary mb-2 d-flex align-items-center gap-1.5" style="font-size: 0.8rem;">
                    <i class="bi bi-bank2"></i> Our Bank Account Details (Company Details - Editable)
                  </div>
                  <div class="row g-2">
                    <div class="col-md-4">
                      <label class="form-label fw-bold text-dark mb-0.5" style="font-size: 0.74rem;">ACC. Name</label>
                      <input type="text" class="form-control form-control-sm fw-semibold" style="font-size: 0.78rem;" [(ngModel)]="doc.bankAccName">
                    </div>
                    <div class="col-md-2">
                      <label class="form-label fw-bold text-dark mb-0.5" style="font-size: 0.74rem;">CC ACC.No</label>
                      <input type="text" class="form-control form-control-sm font-mono fw-semibold" style="font-size: 0.78rem;" [(ngModel)]="doc.bankCcAccNo">
                    </div>
                    <div class="col-md-2">
                      <label class="form-label fw-bold text-dark mb-0.5" style="font-size: 0.74rem;">BANK</label>
                      <input type="text" class="form-control form-control-sm fw-semibold" style="font-size: 0.78rem;" [(ngModel)]="doc.bankName">
                    </div>
                    <div class="col-md-2">
                      <label class="form-label fw-bold text-dark mb-0.5" style="font-size: 0.74rem;">IFSC Code</label>
                      <input type="text" class="form-control form-control-sm font-mono fw-semibold" style="font-size: 0.78rem;" [(ngModel)]="doc.bankIfsc">
                    </div>
                    <div class="col-md-2">
                      <label class="form-label fw-bold text-dark mb-0.5" style="font-size: 0.74rem;">Branch</label>
                      <input type="text" class="form-control form-control-sm fw-semibold" style="font-size: 0.78rem;" [(ngModel)]="doc.bankBranch">
                    </div>
                  </div>
                </div>

              </div>

              <!-- Step 2 Footer -->
              <div class="modal-footer bg-white border-top py-2.5 px-4 d-flex justify-content-between">
                <button type="button" class="btn btn-sm btn-outline-secondary px-3" (click)="modalStep = 1">
                  <i class="bi bi-arrow-left me-1"></i> Back
                </button>
                <div class="d-flex gap-2">
                  <button type="button"
                          class="btn btn-sm btn-danger fw-bold px-3 shadow-sm"
                          (click)="saveInvoiceRecord(true)"
                          [disabled]="saving">
                    <i class="bi bi-file-earmark-pdf-fill me-1"></i> Save &amp; Download PDF
                  </button>
                  <button type="button"
                          class="btn btn-sm btn-success fw-bold px-4 shadow-sm"
                          (click)="saveInvoiceRecord(false)"
                          [disabled]="saving">
                    <i class="bi bi-check2-circle me-1"></i>
                    {{ saving ? 'Saving...' : (editingId ? 'Update Invoice' : 'Save Invoice') }}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 2: EDITABLE TAX INVOICE LETTERHEAD & PDF GENERATOR                  -->
      <!-- (Opened when clicking the PDF button in the Actions column)               -->
      <!-- ========================================================================= -->
      <div class="modal fade show d-block" *ngIf="isLetterheadModalOpen" tabindex="-1" style="background: rgba(15, 23, 42, 0.75); z-index: 1090; overflow-y: auto;">
        <div class="modal-dialog modal-xl modal-dialog-centered my-3" style="max-width: 1180px;">
          <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">

            <!-- Modal Top Controls Bar -->
            <div class="modal-header bg-dark text-white py-2.5 px-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-warning text-dark fw-bold">TAX INVOICE LETTERHEAD</span>
                <h6 class="modal-title fw-bold mb-0">
                  {{ form.invoiceNo }} — {{ form.clientName }} ({{ form.siteId || 'SP' }})
                </h6>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-sm btn-danger fw-bold px-3 shadow-sm" (click)="saveLetterheadAndDownloadPdf(true)" [disabled]="saving">
                  <i class="bi bi-file-earmark-pdf-fill me-1"></i> Download Tax Invoice PDF
                </button>
                <button type="button" class="btn btn-sm btn-success fw-bold px-3 shadow-sm" (click)="saveLetterheadAndDownloadPdf(false)" [disabled]="saving">
                  <i class="bi bi-check2-circle me-1"></i> {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
                <button type="button" class="btn-close btn-close-white ms-2" (click)="closeLetterheadModal()"></button>
              </div>
            </div>

            <!-- Editable A4 Tax Invoice Sheet -->
            <div class="modal-body p-3 p-md-4 bg-secondary-subtle" style="max-height: 80vh; overflow-y: auto;">
              <div class="tax-invoice-sheet bg-white mx-auto shadow p-3 p-md-4" style="max-width: 1080px; border: 2px solid #1e293b; font-family: Arial, Helvetica, sans-serif; color: #000;">

                <!-- TAX INVOICE TITLE HEADER -->
                <div class="text-center py-1.5" style="border: 1.5px solid #000; border-bottom: none; background: #f8fafc;">
                  <div class="fw-bold" style="font-size: 1.05rem; letter-spacing: 1px;">TAX INVOICE</div>
                  <div class="fw-bold" style="font-size: 0.72rem;">
                    (Issued Under Section 31 of Central Goods &amp; Service Tax Act 2017 and Tamil Nadu State Goods &amp; Service Tax Act 2017)
                  </div>
                </div>

                <!-- TOP METADATA GRID (Reverse Charge / Invoice No / Date / Transport / Vehicle) -->
                <div class="row g-0" style="border: 1.5px solid #000; border-bottom: none; font-size: 0.78rem;">
                  <!-- Left Half -->
                  <div class="col-md-6" style="border-right: 1.5px solid #000;">
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2 fw-semibold" style="width: 42%; border-right: 1px solid #000;">Reverse Charge</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input text-center fw-bold" [(ngModel)]="doc.reverseCharge">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2 fw-semibold" style="width: 42%; border-right: 1px solid #000;">Invoice No.</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text"
                               class="inv-inline-input text-center fw-bold font-mono"
                               maxlength="20"
                               [(ngModel)]="form.invoiceNo"
                               (ngModelChange)="doc.invoiceNo = $event">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2 fw-semibold" style="width: 42%; border-right: 1px solid #000;">Invoice Date</div>
                      <div class="p-1 px-2 flex-grow-1 d-flex align-items-center gap-1">
                        <input type="date"
                               class="inv-inline-input text-center fw-bold font-mono"
                               [(ngModel)]="form.invoiceDate"
                               (ngModelChange)="onInvoiceDateChange($event)">
                      </div>
                    </div>
                    <div class="d-flex">
                      <div class="p-1 px-2 fw-bold" style="width: 42%; border-right: 1px solid #000;">e-Way Bill No :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input font-mono" [(ngModel)]="doc.eWayBillNo" placeholder="Optional">
                      </div>
                    </div>
                  </div>

                  <!-- Right Half -->
                  <div class="col-md-6">
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2 fw-semibold" style="width: 42%; border-right: 1px solid #000;">Transport Mode</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input text-center" [(ngModel)]="doc.transportMode">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2 fw-semibold" style="width: 42%; border-right: 1px solid #000;">Vehicle Number</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.vehicleNumber">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2 fw-semibold" style="width: 42%; border-right: 1px solid #000;">Date of Supply</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.dateOfSupply">
                      </div>
                    </div>
                    <div class="d-flex">
                      <div class="p-1 px-2 fw-bold" style="width: 42%; border-right: 1px solid #000;">Generated Date :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.generatedDate">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- REGISTERED OFFICE & DESPATCH FROM GRID -->
                <div class="row g-0" style="border: 1.5px solid #000; border-bottom: none; font-size: 0.78rem;">
                  <!-- Registered Office -->
                  <div class="col-md-6" style="border-right: 1.5px solid #000;">
                    <div class="p-1 px-2 fw-bold border-bottom border-dark bg-light">Registered Office:</div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Name :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input fw-bold" [(ngModel)]="doc.regOfficeName">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Address :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <textarea rows="2" class="inv-inline-input" [(ngModel)]="doc.regOfficeAddress"></textarea>
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">GSTIN :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input fw-bold font-mono" [(ngModel)]="doc.regOfficeGstin">
                      </div>
                    </div>
                    <div class="d-flex">
                      <div class="p-1 px-2" style="width: 22%; border-right: 1px solid #000;">State :</div>
                      <div class="p-1 px-2" style="width: 38%; border-right: 1px solid #000;">
                        <input type="text" class="inv-inline-input" [(ngModel)]="doc.regOfficeState">
                      </div>
                      <div class="p-1 px-2" style="width: 24%; border-right: 1px solid #000;">State Code</div>
                      <div class="p-1 px-2" style="width: 16%;">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.regOfficeStateCode">
                      </div>
                    </div>
                  </div>

                  <!-- Despatch From -->
                  <div class="col-md-6">
                    <div class="p-1 px-2 fw-bold border-bottom border-dark bg-light">Despatch From :</div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Name :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input fw-bold" [(ngModel)]="doc.despatchName">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Address:</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <textarea rows="2" class="inv-inline-input" [(ngModel)]="doc.despatchAddress"></textarea>
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">GSTIN :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input fw-bold font-mono" [(ngModel)]="doc.despatchGstin">
                      </div>
                    </div>
                    <div class="d-flex">
                      <div class="p-1 px-2" style="width: 22%; border-right: 1px solid #000;">State</div>
                      <div class="p-1 px-2" style="width: 38%; border-right: 1px solid #000;">
                        <input type="text" class="inv-inline-input" [(ngModel)]="doc.despatchState">
                      </div>
                      <div class="p-1 px-2" style="width: 24%; border-right: 1px solid #000;">State Code</div>
                      <div class="p-1 px-2" style="width: 16%;">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.despatchStateCode">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- DETAILS OF RECEIVER (BILLED TO) & DETAILS OF CONSIGNEE (SHIPPED TO) -->
                <div class="row g-0" style="border: 1.5px solid #000; border-bottom: none; font-size: 0.78rem;">
                  <!-- Receiver | Billed to -->
                  <div class="col-md-6" style="border-right: 1.5px solid #000;">
                    <div class="p-1 px-2 fw-bold border-bottom border-dark bg-light">Details of Receiver | Billed to:</div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Name :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text"
                               class="inv-inline-input fw-bold"
                               maxlength="50"
                               [(ngModel)]="doc.receiverName"
                               (ngModelChange)="form.clientName = $event">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Address :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <textarea rows="2"
                                  class="inv-inline-input"
                                  maxlength="200"
                                  [(ngModel)]="doc.receiverAddress"
                                  (ngModelChange)="form.billTo = $event"></textarea>
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">GSTIN :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input font-mono" [(ngModel)]="doc.receiverGstin">
                      </div>
                    </div>
                    <div class="d-flex">
                      <div class="p-1 px-2" style="width: 22%; border-right: 1px solid #000;">State :</div>
                      <div class="p-1 px-2" style="width: 38%; border-right: 1px solid #000;">
                        <input type="text" class="inv-inline-input" [(ngModel)]="doc.receiverState">
                      </div>
                      <div class="p-1 px-2" style="width: 24%; border-right: 1px solid #000;">State Code</div>
                      <div class="p-1 px-2" style="width: 16%;">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.receiverStateCode">
                      </div>
                    </div>
                  </div>

                  <!-- Consignee | Shipped to -->
                  <div class="col-md-6">
                    <div class="p-1 px-2 fw-bold border-bottom border-dark bg-light">Details of Consignee | Shipped to:</div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Name :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input fw-bold" [(ngModel)]="doc.consigneeName">
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">Address:</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <textarea rows="2" class="inv-inline-input" [(ngModel)]="doc.consigneeAddress"></textarea>
                      </div>
                    </div>
                    <div class="d-flex border-bottom border-dark">
                      <div class="p-1 px-2" style="width: 22%;">GSTIN :</div>
                      <div class="p-1 px-2 flex-grow-1">
                        <input type="text" class="inv-inline-input font-mono" [(ngModel)]="doc.consigneeGstin">
                      </div>
                    </div>
                    <div class="d-flex">
                      <div class="p-1 px-2" style="width: 22%; border-right: 1px solid #000;">State</div>
                      <div class="p-1 px-2" style="width: 38%; border-right: 1px solid #000;">
                        <input type="text" class="inv-inline-input" [(ngModel)]="doc.consigneeState">
                      </div>
                      <div class="p-1 px-2" style="width: 24%; border-right: 1px solid #000;">State Code</div>
                      <div class="p-1 px-2" style="width: 16%;">
                        <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="doc.consigneeStateCode">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- LINE ITEMS TABLE -->
                <div class="table-responsive" style="border: 1.5px solid #000; border-bottom: none;">
                  <table class="table table-bordered mb-0 align-middle" style="border-color: #000; font-size: 0.76rem;">
                    <thead class="text-center align-middle" style="background: #f8fafc;">
                      <tr>
                        <th rowspan="2" style="width: 68px; border-color: #000;">
                          <div>Sl. No.</div>
                          <button type="button"
                                  class="btn btn-xs btn-outline-success py-0 px-1 mt-1"
                                  style="font-size: 0.65rem;"
                                  (click)="addItemRow()"
                                  title="Add Row">
                            + Add
                          </button>
                        </th>
                        <th rowspan="2" style="min-width: 230px; border-color: #000;">Name of Product / Service</th>
                        <th rowspan="2" style="width: 85px; border-color: #000;">HSN /SAC</th>
                        <th rowspan="2" style="width: 58px; border-color: #000;">UOM</th>
                        <th rowspan="2" style="width: 55px; border-color: #000;">Qty</th>
                        <th rowspan="2" style="width: 105px; border-color: #000;">Rate</th>
                        <th rowspan="2" style="width: 110px; border-color: #000;">Taxable Value</th>
                        <th colspan="2" style="border-color: #000;">CGST</th>
                        <th colspan="2" style="border-color: #000;">SGST</th>
                        <th rowspan="2" style="width: 115px; border-color: #000;">Total</th>
                      </tr>
                      <tr>
                        <th style="width: 62px; border-color: #000;">Rate</th>
                        <th style="width: 92px; border-color: #000;">Amount</th>
                        <th style="width: 62px; border-color: #000;">Rate</th>
                        <th style="width: 92px; border-color: #000;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of doc.items; let idx = index">
                        <td class="text-center font-mono" style="border-color: #000;">
                          <div class="d-flex align-items-center justify-content-center gap-1">
                            <button *ngIf="doc.items.length > 1"
                                    type="button"
                                    class="btn btn-xs text-danger p-0 border-0"
                                    (click)="removeItemRow(idx)"
                                    title="Delete Row">
                              <i class="bi bi-trash3"></i>
                            </button>
                            <span class="fw-bold">{{ idx + 1 }}</span>
                          </div>
                        </td>
                        <td style="border-color: #000;">
                          <select class="form-select form-select-sm py-1 fw-semibold"
                                  style="font-size: 0.74rem;"
                                  [(ngModel)]="item.productName"
                                  (change)="onBomMaterialSelect(item)">
                            <option value="">-- Select BOM Material / Service --</option>
                            <option *ngIf="item.productName && !isProductInOptions(item.productName)" [value]="item.productName">
                              {{ item.productName }}
                            </option>
                            <option *ngFor="let opt of bomProductOptions" [value]="opt.label">
                              {{ opt.label }}
                            </option>
                          </select>
                        </td>
                        <td style="border-color: #000;">
                          <input type="text" class="inv-inline-input text-center font-mono" [(ngModel)]="item.hsnSac">
                        </td>
                        <td style="border-color: #000;">
                          <input type="text" class="inv-inline-input text-center" [(ngModel)]="item.uom">
                        </td>
                        <td style="border-color: #000;">
                          <input type="number"
                                 class="inv-inline-input text-center font-mono"
                                 step="any"
                                 [(ngModel)]="item.qty"
                                 (ngModelChange)="recalculateTotals()">
                        </td>
                        <td style="border-color: #000;">
                          <input type="number"
                                 class="inv-inline-input text-end font-mono"
                                 step="0.01"
                                 [(ngModel)]="item.rate"
                                 (ngModelChange)="recalculateTotals()">
                        </td>
                        <td class="text-end font-mono bg-light" style="border-color: #000;">
                          {{ item.taxableValue | number:'1.2-2' }}
                        </td>
                        <td style="border-color: #000;">
                          <div class="d-flex align-items-center justify-content-center">
                            <input type="number"
                                   class="inv-inline-input text-end font-mono"
                                   style="width: 42px;"
                                   step="0.1"
                                   [(ngModel)]="item.cgstRate"
                                   (ngModelChange)="recalculateTotals()">
                            <span>%</span>
                          </div>
                        </td>
                        <td class="text-end font-mono bg-light" style="border-color: #000;">
                          {{ item.cgstAmount | number:'1.2-2' }}
                        </td>
                        <td style="border-color: #000;">
                          <div class="d-flex align-items-center justify-content-center">
                            <input type="number"
                                   class="inv-inline-input text-end font-mono"
                                   style="width: 42px;"
                                   step="0.1"
                                   [(ngModel)]="item.sgstRate"
                                   (ngModelChange)="recalculateTotals()">
                            <span>%</span>
                          </div>
                        </td>
                        <td class="text-end font-mono bg-light" style="border-color: #000;">
                          {{ item.sgstAmount | number:'1.2-2' }}
                        </td>
                        <td class="text-end font-mono fw-bold bg-light" style="border-color: #000;">
                          {{ item.total | number:'1.2-2' }}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr class="fw-bold bg-light" style="border-color: #000;">
                        <td colspan="4" class="text-end pe-3" style="border-color: #000;">Total :</td>
                        <td class="text-center font-mono" style="border-color: #000;">{{ totalQty | number:'1.2-2' }}</td>
                        <td style="border-color: #000;"></td>
                        <td class="text-end font-mono" style="border-color: #000;">{{ doc.totalBeforeTax | number:'1.2-2' }}</td>
                        <td style="border-color: #000;"></td>
                        <td class="text-end font-mono" style="border-color: #000;">{{ doc.totalCgst | number:'1.2-2' }}</td>
                        <td style="border-color: #000;"></td>
                        <td class="text-end font-mono" style="border-color: #000;">{{ doc.totalSgst | number:'1.2-2' }}</td>
                        <td class="text-end font-mono" style="border-color: #000;">{{ rawTotalWithTax | number:'1.2-2' }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <!-- BOTTOM SPLIT: WORDS + BANK + DECLARATION (LEFT) & TAX SUMMARY + SIGNATORY (RIGHT) -->
                <div class="row g-0" style="border: 1.5px solid #000; font-size: 0.78rem;">
                  <!-- Left Column (7 cols) -->
                  <div class="col-md-7 d-flex flex-column justify-content-between" style="border-right: 1.5px solid #000;">
                    <div>
                      <!-- Amount in Words -->
                      <div class="p-2 border-bottom border-dark">
                        <div class="fw-bold mb-1">Total Invoice Amount in Words :</div>
                        <input type="text"
                               class="inv-inline-input fw-semibold"
                               [(ngModel)]="doc.amountInWords"
                               (input)="amountInWordsManuallyEdited = true">
                      </div>

                      <!-- Our Bank accounts details -->
                      <div class="px-2 py-1 fw-bold border-bottom border-dark text-center bg-light">
                        Our Bank accounts details
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 28%; border-right: 1px solid #000;">ACC. Name</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input fw-bold" [(ngModel)]="doc.bankAccName">
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 28%; border-right: 1px solid #000;">CC ACC.No</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input fw-bold font-mono" [(ngModel)]="doc.bankCcAccNo">
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 28%; border-right: 1px solid #000;">BANK</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input fw-bold" [(ngModel)]="doc.bankName">
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 28%; border-right: 1px solid #000;">IFSC Code</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input fw-bold font-mono" [(ngModel)]="doc.bankIfsc">
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 28%; border-right: 1px solid #000;">Branch</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input fw-bold" [(ngModel)]="doc.bankBranch">
                        </div>
                      </div>

                      <!-- Company's PAN -->
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 28%; border-right: 1px solid #000;">Company's PAN :</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input fw-bold font-mono" [(ngModel)]="doc.companyPan">
                        </div>
                      </div>
                    </div>

                    <!-- Declaration -->
                    <div class="p-2">
                      <span class="fw-bold">Declaration:</span>
                      <textarea rows="2" class="inv-inline-input mt-1" [(ngModel)]="doc.declaration"></textarea>
                    </div>
                  </div>

                  <!-- Right Column (5 cols) -->
                  <div class="col-md-5 d-flex flex-column justify-content-between">
                    <div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">Total Amount Before Tax</div>
                        <div class="p-1 px-2 text-end font-mono fw-semibold flex-grow-1 bg-light">
                          {{ doc.totalBeforeTax | number:'1.2-2' }}
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">Add : CGST</div>
                        <div class="p-1 px-2 text-end font-mono flex-grow-1 bg-light">
                          {{ doc.totalCgst | number:'1.2-2' }}
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">Add : SGST</div>
                        <div class="p-1 px-2 text-end font-mono flex-grow-1 bg-light">
                          {{ doc.totalSgst | number:'1.2-2' }}
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">Tax Amount : GST</div>
                        <div class="p-1 px-2 text-end font-mono flex-grow-1 bg-light">
                          {{ doc.totalTaxGst | number:'1.2-2' }}
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">Round Off</div>
                        <div class="p-1 px-2 text-end font-mono flex-grow-1 bg-light">
                          {{ doc.roundOff >= 0 ? (doc.roundOff | number:'1.2-2') : '(' + (Math.abs(doc.roundOff) | number:'1.2-2') + ')' }}
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark bg-warning-subtle">
                        <div class="p-1.5 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">Total Amount After Tax</div>
                        <div class="p-1.5 px-2 text-end font-mono fw-bold flex-grow-1" style="font-size: 0.88rem;">
                          {{ doc.totalAfterTax | number:'1.2-2' }}
                        </div>
                      </div>
                      <div class="d-flex border-bottom border-dark">
                        <div class="p-1 px-2 fw-bold" style="width: 62%; border-right: 1px solid #000;">GST Payable No Reverse Charge</div>
                        <div class="p-1 px-2 flex-grow-1">
                          <input type="text" class="inv-inline-input text-end" [(ngModel)]="doc.gstPayableReverseCharge">
                        </div>
                      </div>
                    </div>

                    <!-- Signatory Box -->
                    <div class="p-2 text-center d-flex flex-column justify-content-between" style="min-height: 115px;">
                      <div style="font-size: 0.68rem;">Certified that the particulars given above are true and correct</div>
                      <div class="fw-bold" style="font-size: 0.74rem;">For SATHLOKHAR SYNERGYS E&amp;C GLOBAL LIMITED</div>
                      <div class="mt-4 pt-2 fw-semibold" style="font-size: 0.75rem;">Authorized Signatory</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <!-- Modal Footer -->
            <div class="modal-footer bg-white border-top py-2.5 px-4 d-flex justify-content-between align-items-center">
              <div class="small text-muted">
                <i class="bi bi-info-circle text-primary me-1"></i>
                Edit any field on the Tax Invoice letterhead above, then click <strong>Download Tax Invoice PDF</strong>.
              </div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary px-3" (click)="closeLetterheadModal()">Close</button>
                <button type="button" class="btn btn-sm btn-danger fw-bold px-3 shadow-sm" (click)="saveLetterheadAndDownloadPdf(true)" [disabled]="saving">
                  <i class="bi bi-file-earmark-pdf-fill me-1"></i> Download Tax Invoice PDF
                </button>
                <button type="button" class="btn btn-sm btn-success fw-bold px-4 shadow-sm" (click)="saveLetterheadAndDownloadPdf(false)" [disabled]="saving">
                  <i class="bi bi-check2-circle me-1"></i> {{ saving ? 'Saving...' : 'Save Letterhead' }}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .inv-inline-input {
      width: 100%;
      border: 1px dashed transparent;
      background: transparent;
      padding: 1px 4px;
      font-size: inherit;
      color: #000;
      outline: none;
      resize: vertical;
    }
    .inv-inline-input:hover, .inv-inline-input:focus {
      border-color: #0284c7;
      background: #f0f9ff;
      border-radius: 3px;
    }
    .name-edit-link:hover {
      color: #0f766e !important;
      text-decoration: underline !important;
    }
  `]
})
export class InvoiceBillingComponent implements OnInit {
  private http = inject(HttpClient);
  private projectService = inject(ProjectService);
  private masterListService = inject(MasterListService);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  private apiUrl = 'http://localhost:2000/api/invoice-billings';
  Math = Math;

  records: InvoiceBillingRecord[] = [];
  projects: Project[] = [];
  bomProductOptions: { label: string; gstPercent: number; hsnSac: string; uom: string }[] = [];

  loading = false;
  saving = false;

  searchTerm = '';
  typeFilter = 'ALL';

  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Modal 1: 2-Step Add / Edit Invoice Record
  isRecordModalOpen = false;
  modalStep: 1 | 2 = 1;
  selectedSiteKey = '';
  clientSearchText = '';
  isClientDropdownOpen = false;

  // Modal 2: Tax Invoice Letterhead & PDF Generator
  isLetterheadModalOpen = false;

  editingId: number | null = null;
  selectedProjectCapacity = '3';
  amountInWordsManuallyEdited = false;

  form: InvoiceBillingRecord = this.getEmptyForm();
  doc: TaxInvoiceDocument = this.getEmptyDocument();

  ngOnInit(): void {
    this.loadProjects();
    this.loadBomMaterialsFromAddList();
    this.loadRecords();
  }

  get filteredClientProjects(): Project[] {
    const q = (this.clientSearchText || '').toLowerCase().trim();
    if (!q) return this.projects;

    // If the search input matches the currently selected "SPID - ClientName", show filtered or full list
    const selectedProj = this.projects.find(p => p.siteId === this.selectedSiteKey);
    if (selectedProj) {
      const exactLabel = `${selectedProj.siteId} - ${selectedProj.clientName}`.toLowerCase().trim();
      if (q === exactLabel) {
        return this.projects;
      }
    }

    return this.projects.filter(p => {
      const sid = (p.siteId || '').toLowerCase();
      const cname = (p.clientName || '').toLowerCase();
      const combined = `${sid} - ${cname}`;
      return sid.includes(q) || cname.includes(q) || combined.includes(q);
    });
  }

  onClientSearchInput(): void {
    this.isClientDropdownOpen = true;
    const trimmed = (this.clientSearchText || '').trim();
    if (!trimmed) {
      this.selectedSiteKey = '';
      this.form.siteId = '';
      this.form.clientName = '';
      return;
    }
    // Check if user typed an exact SP ID or Client Name match
    const exactMatch = this.projects.find(
      p =>
        `${p.siteId} - ${p.clientName}`.toLowerCase() === trimmed.toLowerCase() ||
        (p.siteId || '').toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      this.selectedSiteKey = exactMatch.siteId;
      this.onClientDropdownSelect();
    } else {
      // Allow custom/partial client name while typing
      this.form.clientName = trimmed.substring(0, 50);
    }
  }

  selectClientFromDropdown(p: Project): void {
    this.selectedSiteKey = p.siteId;
    this.clientSearchText = `${p.siteId} - ${p.clientName}`;
    this.isClientDropdownOpen = false;
    this.onClientDropdownSelect();
  }

  clearClientSelection(event: MouseEvent): void {
    event.stopPropagation();
    this.clientSearchText = '';
    this.selectedSiteKey = '';
    this.form.siteId = '';
    this.form.clientName = '';
    this.form.billTo = '';
    this.isClientDropdownOpen = true;
  }

  toggleClientDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isClientDropdownOpen = !this.isClientDropdownOpen;
  }

  closeClientDropdownOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.client-search-wrapper')) {
      this.isClientDropdownOpen = false;
    }
  }

  loadRecords(): void {
    this.loading = true;
    this.http.get<{ success: boolean; data: InvoiceBillingRecord[] }>(this.apiUrl).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.records = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load Invoice Billing records.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.projects = res.data;
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadBomMaterialsFromAddList(): void {
    const defaultOptions: { label: string; gstPercent: number; hsnSac: string; uom: string }[] = [
      { label: 'Material supply of 3KW OnGrid Solar Rooftop System', gstPercent: 5, hsnSac: '85414300', uom: 'Set' },
      { label: 'Material supply of 5KW OnGrid Solar Rooftop System', gstPercent: 5, hsnSac: '85414300', uom: 'Set' },
      { label: 'Material supply of 10KW OnGrid Solar Rooftop System', gstPercent: 5, hsnSac: '85414300', uom: 'Set' },
      { label: 'Installation & Commissioning (I&C) Work of OnGrid Solar Rooftop System', gstPercent: 18, hsnSac: '9954', uom: 'Set' }
    ];

    this.bomProductOptions = [...defaultOptions];

    // Load BOM materials configured in Office -> Add List
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          const seen = new Set(this.bomProductOptions.map(o => o.label.toLowerCase()));
          for (const item of res.data) {
            const grp = (item.groupName || '').trim();
            const spec = (item.specification || '').trim();
            const label = spec ? `${grp} - ${spec}` : grp;
            if (!label || seen.has(label.toLowerCase())) continue;
            seen.add(label.toLowerCase());

            const grpLower = grp.toLowerCase();
            const isFivePct = grpLower.includes('panel') || grpLower.includes('inverter') || Number(item.gstPercent) === 5;
            this.bomProductOptions.push({
              label,
              gstPercent: isFivePct ? 5 : (Number(item.gstPercent) || 18),
              hsnSac: isFivePct ? '85414300' : '85371000',
              uom: 'Nos'
            });
          }
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // Also include Materials list from Office -> Add List
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const matList = res.data.find(l => l.title.toLowerCase().trim() === 'materials');
          if (matList?.items) {
            const seen = new Set(this.bomProductOptions.map(o => o.label.toLowerCase()));
            for (const m of matList.items) {
              const label = m.trim();
              if (!label || seen.has(label.toLowerCase())) continue;
              seen.add(label.toLowerCase());
              const lower = label.toLowerCase();
              const isFivePct = lower.includes('panel') || lower.includes('inverter') || lower.includes('spg');
              const isService = lower.includes('work') || lower.includes('labour') || lower.includes('i&c') || lower.includes('ceig');
              this.bomProductOptions.push({
                label,
                gstPercent: isFivePct ? 5 : 18,
                hsnSac: isService ? '9954' : (isFivePct ? '85414300' : '85371000'),
                uom: 'Set'
              });
            }
            this.cdr.markForCheck();
          }
        }
      },
      error: () => {}
    });
  }

  onBomMaterialSelect(item: TaxInvoiceLineItem): void {
    const val = item.productName || item.bomSelection;
    if (!val) return;
    item.productName = val;
    item.bomSelection = val;
    const matched = this.bomProductOptions.find(o => o.label.toLowerCase() === val.toLowerCase());
    if (matched) {
      item.hsnSac = matched.hsnSac;
      item.uom = matched.uom;
      const half = parseFloat((matched.gstPercent / 2).toFixed(2));
      item.cgstRate = half;
      item.sgstRate = half;
      this.recalculateTotals();
    }
  }

  isProductInOptions(name?: string): boolean {
    if (!name) return false;
    const clean = name.toLowerCase().trim();
    return this.bomProductOptions.some(o => o.label.toLowerCase().trim() === clean);
  }

  getResolvedSpId(rec: InvoiceBillingRecord): string {
    if (rec.siteId && rec.siteId.trim()) return rec.siteId.trim();
    const matched = this.projects.find(
      p => (p.clientName || '').toLowerCase().trim() === (rec.clientName || '').toLowerCase().trim()
    );
    return matched?.siteId || '—';
  }

  get filteredRecords(): InvoiceBillingRecord[] {
    return this.records.filter(r => {
      if (this.typeFilter !== 'ALL' && r.invoiceType !== this.typeFilter) return false;
      if (this.searchTerm.trim()) {
        const q = this.searchTerm.trim().toLowerCase();
        const spId = this.getResolvedSpId(r).toLowerCase();
        const match =
          spId.includes(q) ||
          (r.invoiceNo || '').toLowerCase().includes(q) ||
          (r.clientName || '').toLowerCase().includes(q) ||
          (r.billTo || '').toLowerCase().includes(q) ||
          (r.invoiceType || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }

  get totalInvoiceValue(): number {
    return this.filteredRecords.reduce((s, r) => s + (Number(r.invoiceValue) || 0), 0);
  }

  get materialSupplyCount(): number {
    return this.filteredRecords.filter(r => r.invoiceType === 'Material Supply').length;
  }

  get icWorkCount(): number {
    return this.filteredRecords.filter(r => r.invoiceType === 'I&C Work').length;
  }

  get totalQty(): number {
    return (this.doc?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
  }

  get rawTotalWithTax(): number {
    return (this.doc?.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);
  }

  // =========================================================================
  // MODAL 1: 2-STEP ADD / EDIT INVOICE RECORD
  // =========================================================================
  openAddInvoiceModal(): void {
    this.editingId = null;
    this.modalStep = 1;
    this.selectedSiteKey = '';
    this.clientSearchText = '';
    this.isClientDropdownOpen = false;
    this.amountInWordsManuallyEdited = false;
    this.form = this.getEmptyForm();
    this.doc = this.getEmptyDocument();
    this.isRecordModalOpen = true;

    this.http.get<{ success: boolean; nextInvoiceNo: string }>(`${this.apiUrl}/next-number`).subscribe({
      next: (res) => {
        if (res.success && res.nextInvoiceNo && !this.editingId) {
          this.form.invoiceNo = res.nextInvoiceNo;
          this.doc.invoiceNo = res.nextInvoiceNo;
          this.cdr.markForCheck();
        }
      }
    });
  }

  openEditInvoiceRecordModal(rec: InvoiceBillingRecord): void {
    this.editingId = rec.id || null;
    this.modalStep = 1;
    this.isClientDropdownOpen = false;
    this.amountInWordsManuallyEdited = false;
    const matchedProj =
      this.projects.find(p => p.siteId === rec.siteId) ||
      this.findProjectByClient(rec.clientName);
    const resolvedSpId = rec.siteId || matchedProj?.siteId || '';
    this.selectedSiteKey = resolvedSpId;
    this.clientSearchText = resolvedSpId
      ? `${resolvedSpId} - ${rec.clientName || matchedProj?.clientName || ''}`
      : (rec.clientName || '');

    this.form = {
      id: rec.id,
      invoiceDate: rec.invoiceDate || new Date().toISOString().split('T')[0],
      siteId: resolvedSpId,
      invoiceNo: rec.invoiceNo || '',
      invoiceValue: Number(rec.invoiceValue) || 0,
      clientName: rec.clientName || '',
      invoiceType: rec.invoiceType || 'Material Supply',
      billTo: rec.billTo || '',
      invoiceDoc: rec.invoiceDoc || null
    };

    this.doc = this.buildSyncedTaxDocument(this.form, rec.invoiceDoc || undefined);
    this.recalculateTotals();
    this.isRecordModalOpen = true;
  }

  closeRecordModal(): void {
    this.isRecordModalOpen = false;
    this.isClientDropdownOpen = false;
    this.modalStep = 1;
  }

  onClientDropdownSelect(): void {
    const proj = this.projects.find(p => p.siteId === this.selectedSiteKey);
    if (!proj) {
      this.form.siteId = '';
      this.form.clientName = '';
      return;
    }

    this.form.siteId = proj.siteId;
    this.form.clientName = (proj.clientName || '').substring(0, 50);

    const addr = this.extractProjectAddress(proj);
    this.form.billTo = addr;

    // Immediately sync Receiver (Billed to) & Consignee (Shipped to) from Awarded Sites
    this.doc.receiverName = this.form.clientName;
    this.doc.consigneeName = this.form.clientName;
    this.doc.receiverAddress = addr;
    this.doc.consigneeAddress = addr;

    const cap = String(proj.siteCapacity || '3').replace(/[^0-9.]/g, '') || '3';
    this.selectedProjectCapacity = cap;
  }

  extractProjectAddress(proj?: Project): string {
    if (!proj) return '';
    const cleanStr = (s?: any) => {
      const v = String(s ?? '').trim();
      return (v === '' || v === '0' || v === '-' || v === '—' || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') ? '' : v;
    };
    const addr = cleanStr(proj.address);
    const loc = cleanStr(proj.location);
    if (addr && loc && !addr.toLowerCase().includes(loc.toLowerCase())) {
      return `${addr}, ${loc}`.substring(0, 200);
    }
    return (addr || loc).substring(0, 200);
  }

  onStep1BillToChange(newBillTo: string): void {
    this.doc.receiverAddress = newBillTo;
    this.doc.consigneeAddress = newBillTo;
  }

  onReceiverDetailsChange(): void {
    this.form.clientName = (this.doc.receiverName || '').substring(0, 50);
    this.form.billTo = (this.doc.receiverAddress || '').substring(0, 200);
    // Keep Shipped To synced with Billed To
    this.doc.consigneeName = this.doc.receiverName;
    this.doc.consigneeAddress = this.doc.receiverAddress;
  }

  goToStep2(): void {
    if (!this.form.invoiceNo?.trim()) {
      this.showToast('Please enter Invoice No.', 'danger');
      return;
    }
    if (!this.form.clientName?.trim()) {
      this.showToast('Please select a Client Name.', 'danger');
      return;
    }

    this.isClientDropdownOpen = false;
    // Sync Step 1 values into Step 2 Tax Invoice document
    this.doc = this.buildSyncedTaxDocument(this.form, this.editingId ? (this.form.invoiceDoc || this.doc) : undefined);
    // Ensure Billed to and Shipped to both match the Step 1 Client Name & Bill to address
    this.doc.receiverName = this.form.clientName;
    this.doc.consigneeName = this.form.clientName;
    this.doc.receiverAddress = this.form.billTo;
    this.doc.consigneeAddress = this.form.billTo;

    this.recalculateTotals();
    this.modalStep = 2;
  }

  onGeneratedDateTimeChange(isoVal: string): void {
    if (!isoVal) {
      this.doc.generatedDate = '';
      return;
    }
    const dt = new Date(isoVal);
    if (!isNaN(dt.getTime())) {
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      let hrs = dt.getHours();
      const mins = String(dt.getMinutes()).padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12 || 12;
      this.doc.generatedDate = `${d}-${m}-${y} ${String(hrs).padStart(2, '0')}:${mins} ${ampm}`;
    } else {
      this.doc.generatedDate = isoVal;
    }
  }

  findProjectByClient(clientName?: string): Project | undefined {
    if (!clientName) return undefined;
    const clean = clientName.toLowerCase().trim();
    return this.projects.find(
      p => (p.clientName || '').toLowerCase().trim() === clean ||
           (p.clientName || '').substring(0, 50).toLowerCase().trim() === clean
    );
  }

  saveInvoiceRecord(andDownloadPdf: boolean = false): void {
    if (!this.form.invoiceNo?.trim()) {
      this.showToast('Invoice No is required.', 'danger');
      return;
    }
    if (!this.form.clientName?.trim()) {
      this.showToast('Client Name is required.', 'danger');
      return;
    }

    this.recalculateTotals();
    this.saving = true;

    const payload: InvoiceBillingRecord = {
      invoiceDate: this.form.invoiceDate || new Date().toISOString().split('T')[0],
      siteId: this.form.siteId || '',
      invoiceNo: this.form.invoiceNo.trim().substring(0, 20),
      invoiceValue: Number(this.form.invoiceValue) || 0,
      clientName: this.form.clientName.trim().substring(0, 50),
      invoiceType: this.form.invoiceType,
      billTo: (this.form.billTo || '').trim().substring(0, 200),
      invoiceDoc: this.doc
    };

    const req$ = this.editingId
      ? this.http.put<{ success: boolean; data: InvoiceBillingRecord }>(`${this.apiUrl}/${this.editingId}`, payload)
      : this.http.post<{ success: boolean; data: InvoiceBillingRecord }>(this.apiUrl, payload);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        if (res.success && res.data) {
          this.showToast(this.editingId ? 'Invoice updated successfully!' : 'Invoice added successfully!', 'success');
          if (andDownloadPdf) {
            this.exportInvoicePdf(res.data);
          }
          this.closeRecordModal();
          this.loadRecords();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.showToast('Failed to save invoice.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // =========================================================================
  // MODAL 2: TAX INVOICE LETTERHEAD & PDF GENERATOR (Triggered by PDF button)
  // =========================================================================
  openTaxInvoiceLetterheadModal(rec: InvoiceBillingRecord): void {
    this.editingId = rec.id || null;
    this.amountInWordsManuallyEdited = false;
    const resolvedSpId = rec.siteId || this.findProjectByClient(rec.clientName)?.siteId || '';

    this.form = {
      id: rec.id,
      invoiceDate: rec.invoiceDate || new Date().toISOString().split('T')[0],
      siteId: resolvedSpId,
      invoiceNo: rec.invoiceNo || '',
      invoiceValue: Number(rec.invoiceValue) || 0,
      clientName: rec.clientName || '',
      invoiceType: rec.invoiceType || 'Material Supply',
      billTo: rec.billTo || '',
      invoiceDoc: rec.invoiceDoc || null
    };

    this.doc = this.buildSyncedTaxDocument(this.form, rec.invoiceDoc || undefined);
    this.recalculateTotals();
    this.isLetterheadModalOpen = true;
  }

  closeLetterheadModal(): void {
    this.isLetterheadModalOpen = false;
  }

  buildSyncedTaxDocument(rec: InvoiceBillingRecord, existingDoc?: TaxInvoiceDocument): TaxInvoiceDocument {
    const proj = this.projects.find(p => p.siteId === rec.siteId) || this.findProjectByClient(rec.clientName);
    const cap = String(proj?.siteCapacity || '3').replace(/[^0-9.]/g, '') || '3';
    this.selectedProjectCapacity = cap;

    const isIc = rec.invoiceType === 'I&C Work';
    const gstTotalRate = isIc ? 18 : 5;
    const halfGst = isIc ? 9 : 2.5;
    const defaultHsn = isIc ? '9954' : '85414300';
    const defaultDesc = isIc
      ? `Installation & Commissioning (I&C) Work of ${cap}KW OnGrid Solar Rooftop System`
      : `Material supply of ${cap}KW OnGrid Solar Rooftop System`;

    const invVal = Number(rec.invoiceValue) || 0;
    const computedRate = invVal > 0 ? parseFloat((invVal / (1 + gstTotalRate / 100)).toFixed(2)) : 0;

    const base = existingDoc ? JSON.parse(JSON.stringify(existingDoc)) : this.getEmptyDocument();
    const dispDate = this.formatDateDisplay(rec.invoiceDate);

    base.invoiceNo = rec.invoiceNo;
    base.invoiceDate = dispDate;
    if (!existingDoc) {
      base.dateOfSupply = dispDate;
    }
    const addr = rec.billTo || this.extractProjectAddress(proj);
    base.receiverName = rec.clientName;
    base.consigneeName = rec.clientName;
    base.receiverAddress = addr;
    base.consigneeAddress = addr;

    if (!existingDoc || !base.items || base.items.length === 0) {
      base.items = [
        {
          slNo: 1,
          bomSelection: '',
          productName: defaultDesc,
          hsnSac: defaultHsn,
          uom: 'Set',
          qty: 1,
          rate: computedRate,
          taxableValue: computedRate,
          cgstRate: halfGst,
          cgstAmount: parseFloat(((computedRate * halfGst) / 100).toFixed(2)),
          sgstRate: halfGst,
          sgstAmount: parseFloat(((computedRate * halfGst) / 100).toFixed(2)),
          total: invVal
        }
      ];
    }

    return base;
  }

  onInvoiceDateChange(dateStr: string): void {
    const disp = this.formatDateDisplay(dateStr);
    this.doc.invoiceDate = disp;
    this.doc.dateOfSupply = disp;
  }

  addItemRow(): void {
    const isIc = this.form.invoiceType === 'I&C Work';
    this.doc.items.push({
      slNo: this.doc.items.length + 1,
      bomSelection: '',
      productName: '',
      hsnSac: isIc ? '9954' : '85414300',
      uom: 'Set',
      qty: 1,
      rate: 0,
      taxableValue: 0,
      cgstRate: isIc ? 9 : 2.5,
      cgstAmount: 0,
      sgstRate: isIc ? 9 : 2.5,
      sgstAmount: 0,
      total: 0
    });
    this.recalculateTotals();
  }

  removeItemRow(index: number): void {
    if (this.doc.items.length <= 1) return;
    this.doc.items.splice(index, 1);
    this.doc.items.forEach((it, i) => (it.slNo = i + 1));
    this.recalculateTotals();
  }

  recalculateTotals(): void {
    let totalBefore = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    for (let i = 0; i < this.doc.items.length; i++) {
      const it = this.doc.items[i];
      it.slNo = i + 1;
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      const cgstRate = Number(it.cgstRate) || 0;
      const sgstRate = Number(it.sgstRate) || 0;

      it.taxableValue = parseFloat((qty * rate).toFixed(2));
      it.cgstAmount = parseFloat(((it.taxableValue * cgstRate) / 100).toFixed(2));
      it.sgstAmount = parseFloat(((it.taxableValue * sgstRate) / 100).toFixed(2));
      it.total = parseFloat((it.taxableValue + it.cgstAmount + it.sgstAmount).toFixed(2));

      totalBefore += it.taxableValue;
      totalCgst += it.cgstAmount;
      totalSgst += it.sgstAmount;
    }

    this.doc.totalBeforeTax = parseFloat(totalBefore.toFixed(2));
    this.doc.totalCgst = parseFloat(totalCgst.toFixed(2));
    this.doc.totalSgst = parseFloat(totalSgst.toFixed(2));
    this.doc.totalTaxGst = parseFloat((totalCgst + totalSgst).toFixed(2));

    const exactTotal = this.doc.totalBeforeTax + this.doc.totalTaxGst;
    const roundedTotal = Math.round(exactTotal);
    this.doc.roundOff = parseFloat((roundedTotal - exactTotal).toFixed(2));
    this.doc.totalAfterTax = parseFloat(roundedTotal.toFixed(2));

    this.form.invoiceValue = this.doc.totalAfterTax;

    if (!this.amountInWordsManuallyEdited) {
      this.doc.amountInWords = this.numberToIndianWords(this.doc.totalAfterTax);
    }
  }

  saveLetterheadAndDownloadPdf(downloadPdf: boolean): void {
    this.recalculateTotals();
    this.saving = true;

    const payload: InvoiceBillingRecord = {
      invoiceDate: this.form.invoiceDate || new Date().toISOString().split('T')[0],
      siteId: this.form.siteId || '',
      invoiceNo: this.form.invoiceNo.trim().substring(0, 20),
      invoiceValue: Number(this.form.invoiceValue) || 0,
      clientName: this.form.clientName.trim().substring(0, 50),
      invoiceType: this.form.invoiceType,
      billTo: (this.form.billTo || '').trim().substring(0, 200),
      invoiceDoc: this.doc
    };

    const req$ = this.editingId
      ? this.http.put<{ success: boolean; data: InvoiceBillingRecord }>(`${this.apiUrl}/${this.editingId}`, payload)
      : this.http.post<{ success: boolean; data: InvoiceBillingRecord }>(this.apiUrl, payload);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        if (res.success && res.data) {
          if (downloadPdf) {
            this.exportInvoicePdf(res.data);
          } else {
            this.showToast('Tax Invoice letterhead saved!', 'success');
          }
          this.closeLetterheadModal();
          this.loadRecords();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.showToast('Failed to save Tax Invoice letterhead.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // =========================================================================
  // EXCEL UPLOAD & EXPORT
  // =========================================================================
  triggerExcelUpload(): void {
    const el = document.getElementById('invoiceExcelUploadInput') as HTMLInputElement;
    if (el) {
      el.value = '';
      el.click();
    }
  }

  onExcelFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (!rows || rows.length === 0) {
          this.showToast('Uploaded Excel file is empty.', 'danger');
          return;
        }

        const parsedRecords: Partial<InvoiceBillingRecord>[] = [];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const getVal = (keys: string[]) => {
            for (const k of Object.keys(r)) {
              const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (keys.includes(norm)) return r[k];
            }
            return '';
          };

          const rawDate = getVal(['date', 'invoicedate', 'billdate']);
          const rawSpId = String(getVal(['spid', 'siteid', 'projectid', 'spno']) || '').trim();
          const rawInvNo = String(getVal(['invoiceno', 'invoicenumber', 'invno', 'billno']) || '').trim();
          const rawVal = getVal(['invoicevalue', 'value', 'amount', 'total', 'totalamount']);
          const rawClient = String(getVal(['clientname', 'client', 'customername', 'customer', 'name']) || '').trim();
          const rawType = String(getVal(['invoicetype', 'type', 'category']) || 'Material Supply').trim();
          const rawBillTo = String(getVal(['billto', 'address', 'billingaddress', 'location']) || '').trim();

          if (!rawInvNo && !rawClient && !rawSpId) continue;

          const matchedProj =
            this.projects.find(p => p.siteId.toLowerCase() === rawSpId.toLowerCase()) ||
            this.findProjectByClient(rawClient);

          const finalSpId = rawSpId || matchedProj?.siteId || '';
          const finalClient = (rawClient || matchedProj?.clientName || 'Client').substring(0, 50);
          const finalBillTo = (rawBillTo || this.extractProjectAddress(matchedProj)).substring(0, 200);
          const cleanValue = parseFloat(String(rawVal).replace(/[^0-9.-]/g, '')) || 0;
          const isIc = rawType.toLowerCase().includes('i&c') || rawType.toLowerCase().includes('ic') || rawType.toLowerCase().includes('install');

          parsedRecords.push({
            invoiceDate: this.parseExcelDateToIso(rawDate),
            siteId: finalSpId,
            invoiceNo: (rawInvNo || `INV-${i + 1}`).substring(0, 20),
            invoiceValue: cleanValue,
            clientName: finalClient,
            invoiceType: isIc ? 'I&C Work' : 'Material Supply',
            billTo: finalBillTo
          });
        }

        if (parsedRecords.length === 0) {
          this.showToast('No valid invoice rows found in the uploaded file.', 'danger');
          return;
        }

        this.http.post<{ success: boolean; count: number }>(`${this.apiUrl}/bulk`, { records: parsedRecords }).subscribe({
          next: (res) => {
            if (res.success) {
              this.showToast(`Successfully uploaded ${res.count} invoice records!`, 'success');
              this.loadRecords();
            }
          },
          error: () => {
            this.showToast('Failed to upload Excel records.', 'danger');
          }
        });
      } catch (err) {
        console.error('Excel parse error:', err);
        this.showToast('Invalid Excel file format.', 'danger');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  parseExcelDateToIso(val: any): string {
    if (!val) return new Date().toISOString().split('T')[0];
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
  }

  exportToExcel(): void {
    if (this.filteredRecords.length === 0) {
      this.showToast('No records to export.', 'info');
      return;
    }

    const exportData = this.filteredRecords.map((r, idx) => ({
      'S.No': idx + 1,
      'Date': this.formatDateDisplay(r.invoiceDate),
      'SP ID': this.getResolvedSpId(r),
      'Invoice No': r.invoiceNo,
      'Invoice Value': Number(r.invoiceValue) || 0,
      'Client Name': r.clientName,
      'Invoice Type': r.invoiceType,
      'Bill to': r.billTo || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice Billing');
    XLSX.writeFile(wb, `Invoice_Billing_${this.formatDateDisplay(new Date().toISOString())}.xlsx`);
    this.showToast('Exported Invoice Billing to Excel!', 'success');
  }

  deleteRecord(rec: InvoiceBillingRecord): void {
    if (!rec.id) return;
    if (!confirm(`Are you sure you want to delete Invoice ${rec.invoiceNo} (${rec.clientName})?`)) return;

    this.http.delete<{ success: boolean }>(`${this.apiUrl}/${rec.id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.records = this.records.filter(r => r.id !== rec.id);
          this.showToast('Invoice record deleted.', 'success');
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.showToast('Failed to delete invoice record.', 'danger');
      }
    });
  }

  exportInvoicePdf(rec: InvoiceBillingRecord): void {
    const d: TaxInvoiceDocument = rec.invoiceDoc || this.buildSyncedTaxDocument(rec);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const contentW = 190;
    const margin = (pageW - contentW) / 2; // Horizontally centered (10mm left & right)

    // Vertically center the entire Tax Invoice block on the A4 letterhead page
    const itemCount = Math.max(1, (d.items || []).length);
    const estimatedBoxHeight = 156 + itemCount * 8;
    const startY = Math.max(36, Math.min(62, Math.round((pageH - estimatedBoxHeight) / 2)));
    let y = startY;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.35);

    // TAX INVOICE Title Box (No company text banner above — printed on physical letterhead paper)
    pdf.rect(margin, y, contentW, 11);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text('TAX INVOICE', pageW / 2, y + 5, { align: 'center' });
    pdf.setFontSize(6.8);
    pdf.text('(Issued Under Section 31 of Central Goods & Service Tax Act 2017 and Tamil Nadu State Goods & Service Tax Act 2017)', pageW / 2, y + 9.2, { align: 'center' });
    y += 11;

    // Top Metadata Table (Exact 190mm: 38 + 57 + 38 + 57 = 190)
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
      body: [
        ['Reverse Charge', d.reverseCharge || 'Y/N', 'Transport Mode', d.transportMode || 'Road'],
        ['Invoice No.', rec.invoiceNo || d.invoiceNo, 'Vehicle Number', d.vehicleNumber || ''],
        ['Invoice Date', this.formatDateDisplay(rec.invoiceDate), 'Date of Supply', d.dateOfSupply || this.formatDateDisplay(rec.invoiceDate)],
        ['e-Way Bill No :', d.eWayBillNo || '', 'Generated Date :', d.generatedDate || '']
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38 },
        1: { cellWidth: 57, halign: 'center', fontStyle: 'bold' },
        2: { fontStyle: 'bold', cellWidth: 38 },
        3: { cellWidth: 57, halign: 'center' }
      }
    });
    y = (pdf as any).lastAutoTable.finalY;

    // Registered Office & Despatch From + Receiver & Consignee (Exact 190mm: 95 + 95 = 190)
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
      body: [
        [
          { content: 'Registered Office:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
          { content: 'Despatch From :', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } }
        ],
        [
          `Name : ${d.regOfficeName}\nAddress : ${d.regOfficeAddress}\nGSTIN : ${d.regOfficeGstin}\nState : ${d.regOfficeState}    |    State Code : ${d.regOfficeStateCode}`,
          `Name : ${d.despatchName}\nAddress : ${d.despatchAddress}\nGSTIN : ${d.despatchGstin}\nState : ${d.despatchState}    |    State Code : ${d.despatchStateCode}`
        ],
        [
          { content: 'Details of Receiver | Billed to:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
          { content: 'Details of Consignee | Shipped to:', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } }
        ],
        [
          `Name : ${d.receiverName || rec.clientName}\nAddress : ${d.receiverAddress || rec.billTo}\nGSTIN : ${d.receiverGstin || ''}\nState : ${d.receiverState}    |    State Code : ${d.receiverStateCode}`,
          `Name : ${d.consigneeName || rec.clientName}\nAddress : ${d.consigneeAddress || rec.billTo}\nGSTIN : ${d.consigneeGstin || ''}\nState : ${d.consigneeState}    |    State Code : ${d.consigneeStateCode}`
        ]
      ],
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 95 }
      }
    });
    y = (pdf as any).lastAutoTable.finalY;

    // Line Items Table (Exact 190mm: 8 + 50 + 15 + 9 + 9 + 15 + 18 + 8 + 14 + 8 + 14 + 22 = 190)
    const itemRows = (d.items || []).map((it, idx) => [
      idx + 1,
      it.productName || '',
      it.hsnSac || '',
      it.uom || 'Set',
      (Number(it.qty) || 1).toFixed(2),
      (Number(it.rate) || 0).toFixed(2),
      (Number(it.taxableValue) || 0).toFixed(2),
      `${it.cgstRate}%`,
      (Number(it.cgstAmount) || 0).toFixed(2),
      `${it.sgstRate}%`,
      (Number(it.sgstAmount) || 0).toFixed(2),
      (Number(it.total) || 0).toFixed(2)
    ]);

    const sumQty = (d.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const sumWithTax = (d.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0);

    itemRows.push([
      '',
      'Total :',
      '',
      '',
      sumQty.toFixed(2),
      '',
      (Number(d.totalBeforeTax) || 0).toFixed(2),
      '',
      (Number(d.totalCgst) || 0).toFixed(2),
      '',
      (Number(d.totalSgst) || 0).toFixed(2),
      sumWithTax.toFixed(2)
    ]);

    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      theme: 'grid',
      styles: { fontSize: 7.0, cellPadding: 1.3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25, valign: 'middle' },
      headStyles: { fillColor: [245, 247, 250], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 6.8 },
      head: [
        [
          { content: 'Sl.\nNo.', rowSpan: 2 },
          { content: 'Name of Product / Service', rowSpan: 2 },
          { content: 'HSN /SAC', rowSpan: 2 },
          { content: 'UOM', rowSpan: 2 },
          { content: 'Qty', rowSpan: 2 },
          { content: 'Rate', rowSpan: 2, styles: { fontSize: 6.2 } },
          { content: 'Taxable\nValue', rowSpan: 2 },
          { content: 'CGST', colSpan: 2 },
          { content: 'SGST', colSpan: 2 },
          { content: 'Total', rowSpan: 2 }
        ],
        [
          { content: 'Rate', styles: { fontSize: 6.0 } },
          { content: 'Amount', styles: { fontSize: 6.4 } },
          { content: 'Rate', styles: { fontSize: 6.0 } },
          { content: 'Amount', styles: { fontSize: 6.4 } }
        ]
      ],
      body: itemRows,
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 15, halign: 'center', fontSize: 6.6 },
        3: { cellWidth: 9, halign: 'center' },
        4: { cellWidth: 9, halign: 'center' },
        5: { cellWidth: 15, halign: 'right', fontSize: 6.2 },
        6: { cellWidth: 18, halign: 'right', fontSize: 6.6 },
        7: { cellWidth: 8, halign: 'center', fontSize: 6.0 },
        8: { cellWidth: 14, halign: 'right', fontSize: 6.6 },
        9: { cellWidth: 8, halign: 'center', fontSize: 6.0 },
        10: { cellWidth: 14, halign: 'right', fontSize: 6.6 },
        11: { cellWidth: 22, halign: 'right', fontStyle: 'bold', fontSize: 6.8 }
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.row.index === itemRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [248, 250, 252];
        }
      }
    });
    y = (pdf as any).lastAutoTable.finalY;

    // Bottom Summary + Bank Details Table (Exact 190mm: 32 + 78 + 48 + 32 = 190)
    const roundOffStr = d.roundOff >= 0 ? d.roundOff.toFixed(2) : `(${Math.abs(d.roundOff).toFixed(2)})`;
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      theme: 'grid',
      styles: { fontSize: 7.3, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
      body: [
        [
          { content: `Total Invoice Amount in Words :\n${d.amountInWords}`, colSpan: 2, styles: { fontStyle: 'bold' } },
          { content: 'Total Amount Before Tax', styles: { fontStyle: 'bold' } },
          { content: (Number(d.totalBeforeTax) || 0).toFixed(2), styles: { halign: 'right', fontStyle: 'bold' } }
        ],
        [
          { content: 'Our Bank accounts details', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 247, 250] } },
          { content: 'Add : CGST', styles: { fontStyle: 'bold' } },
          { content: (Number(d.totalCgst) || 0).toFixed(2), styles: { halign: 'right' } }
        ],
        [
          { content: 'ACC. Name', styles: { fontStyle: 'bold' } },
          { content: d.bankAccName, styles: { fontStyle: 'bold' } },
          { content: 'Add : SGST', styles: { fontStyle: 'bold' } },
          { content: (Number(d.totalSgst) || 0).toFixed(2), styles: { halign: 'right' } }
        ],
        [
          { content: 'CC ACC.No', styles: { fontStyle: 'bold' } },
          { content: d.bankCcAccNo, styles: { fontStyle: 'bold' } },
          { content: 'Tax Amount : GST', styles: { fontStyle: 'bold' } },
          { content: (Number(d.totalTaxGst) || 0).toFixed(2), styles: { halign: 'right' } }
        ],
        [
          { content: 'BANK', styles: { fontStyle: 'bold' } },
          { content: d.bankName, styles: { fontStyle: 'bold' } },
          { content: 'Round Off', styles: { fontStyle: 'bold' } },
          { content: roundOffStr, styles: { halign: 'right' } }
        ],
        [
          { content: 'IFSC Code', styles: { fontStyle: 'bold' } },
          { content: d.bankIfsc, styles: { fontStyle: 'bold' } },
          { content: 'Total Amount After Tax', styles: { fontStyle: 'bold', fillColor: [254, 249, 195] } },
          { content: (Number(d.totalAfterTax) || 0).toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 249, 195] } }
        ],
        [
          { content: 'Branch', styles: { fontStyle: 'bold' } },
          { content: d.bankBranch, styles: { fontStyle: 'bold' } },
          { content: 'GST Payable No Reverse Charge', styles: { fontStyle: 'bold' } },
          { content: d.gstPayableReverseCharge || 'N.A', styles: { halign: 'right' } }
        ],
        [
          { content: "Company's PAN :", styles: { fontStyle: 'bold' } },
          { content: d.companyPan, styles: { fontStyle: 'bold' } },
          {
            content: 'Certified that the particulars given above are true and correct\nFor SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED\n\n\nAuthorized Signatory',
            colSpan: 2,
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' }
          }
        ],
        [
          { content: `Declaration: ${d.declaration}`, colSpan: 2 }
        ]
      ],
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 78 },
        2: { cellWidth: 48 },
        3: { cellWidth: 32 }
      }
    });
    const finalY = (pdf as any).lastAutoTable.finalY;

    // Draw clean outer border around the entire centered Tax Invoice box
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.4);
    pdf.rect(margin, startY, contentW, finalY - startY);

    const safeInvNo = (rec.invoiceNo || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    pdf.save(`Tax_Invoice_${safeInvNo}.pdf`);
    this.showToast(`Downloaded Tax Invoice PDF (${rec.invoiceNo})!`, 'success');
  }

  getEmptyForm(): InvoiceBillingRecord {
    const today = new Date().toISOString().split('T')[0];
    return {
      invoiceDate: today,
      siteId: '',
      invoiceNo: '113/SOLAR/26-27',
      invoiceValue: 0,
      clientName: '',
      invoiceType: 'Material Supply',
      billTo: ''
    };
  }

  getEmptyDocument(): TaxInvoiceDocument {
    const todayIso = new Date().toISOString().split('T')[0];
    const todayDisp = this.formatDateDisplay(todayIso);
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return {
      reverseCharge: 'Y/N',
      invoiceNo: '113/SOLAR/26-27',
      invoiceDate: todayDisp,
      eWayBillNo: '',
      transportMode: 'Road',
      vehicleNumber: 'TN 15 ML 1455',
      dateOfSupply: todayDisp,
      generatedDate: '',
      generatedDateIso: localIso,

      regOfficeName: 'M/S.SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED',
      regOfficeAddress: 'No: 5171, 9 th street , Ram nagar North, Madipakkam , Chennai - 600091 .',
      regOfficeGstin: '33AACCL5566B1ZT',
      regOfficeState: 'Tamil nadu',
      regOfficeStateCode: '33',

      despatchName: 'M/S.SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED',
      despatchAddress: 'No: 5171, 9 th street , Ram nagar North, Madipakkam , Chennai - 600091 .',
      despatchGstin: '33AACCL5566B1ZT',
      despatchState: 'Tamilnadu',
      despatchStateCode: '33',

      receiverName: '',
      receiverAddress: '',
      receiverGstin: '',
      receiverState: 'Tamil nadu',
      receiverStateCode: '33',

      consigneeName: '',
      consigneeAddress: '',
      consigneeGstin: '',
      consigneeState: 'Tamilnadu',
      consigneeStateCode: '33',

      items: [
        {
          slNo: 1,
          bomSelection: '',
          productName: 'Material supply of 3KW OnGrid Solar Rooftop System',
          hsnSac: '85414300',
          uom: 'Set',
          qty: 1,
          rate: 202781,
          taxableValue: 202781,
          cgstRate: 2.5,
          cgstAmount: 5069.53,
          sgstRate: 2.5,
          sgstAmount: 5069.53,
          total: 212920.06
        }
      ],

      amountInWords: 'Two Lakh Twelve Thousand Nine Hundred And Twenty Only',
      bankAccName: 'SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED',
      bankCcAccNo: '103951000012',
      bankName: 'ICICI BANK',
      bankIfsc: 'ICIC0001039',
      bankBranch: 'Madipakkam, Chennai-600002',
      companyPan: 'AACCL5566B',
      declaration: 'We Declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
      gstPayableReverseCharge: 'N.A',

      totalBeforeTax: 202781.00,
      totalCgst: 5069.53,
      totalSgst: 5069.53,
      totalTaxGst: 10139.06,
      roundOff: -0.06,
      totalAfterTax: 212920.00
    };
  }

  formatDateDisplay(dateVal?: string): string {
    if (!dateVal) return '';
    const clean = String(dateVal).split('T')[0].trim();
    const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
    return clean;
  }

  numberToIndianWords(amount: number): string {
    const num = Math.round(Number(amount) || 0);
    if (num === 0) return 'Zero Only';

    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
      'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
      'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

    const inWords = (n: number): string => {
      if (n < 20) return a[n];
      return b[Math.floor(n / 10)] + a[n % 10];
    };

    const strPad = ('000000000' + num).slice(-9);
    const crore = parseInt(strPad.slice(0, 2), 10);
    const lakh = parseInt(strPad.slice(2, 4), 10);
    const thousand = parseInt(strPad.slice(4, 6), 10);
    const hundred = parseInt(strPad.slice(6, 7), 10);
    const rest = parseInt(strPad.slice(7, 9), 10);

    let str = '';
    if (crore > 0) str += inWords(crore) + 'Crore ';
    if (lakh > 0) str += inWords(lakh) + 'Lakh ';
    if (thousand > 0) str += inWords(thousand) + 'Thousand ';
    if (hundred > 0) str += inWords(hundred) + 'Hundred ';
    if (rest > 0) {
      if (str !== '') str += 'And ';
      str += inWords(rest);
    }

    return (str.trim() + ' Only').replace(/\s+/g, ' ');
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
