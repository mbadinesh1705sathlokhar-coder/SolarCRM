import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../services/project.service';
import { OfficeService, OfficeVendor } from '../../../services/office.service';
import { Project, SiteExpense } from '../../../models/project.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PoWoLineItem {
  sNo: number;
  materialGroup?: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  gstPct: number;
  amount: number;
}

export interface PoWoTermRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-po-wo-letterhead-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal fade show d-block po-wo-backdrop" *ngIf="isOpen" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered modal-xl po-wo-dialog" role="document">
        <div class="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">

          <!-- TOP MODAL HEADER -->
          <div class="modal-header py-2.5 px-4 border-0 text-white d-flex justify-content-between align-items-center"
               [style.background]="orderType === 'W.O' ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #0f172a 100%)'">
            <div class="d-flex align-items-center gap-3">
              <div class="bg-warning text-dark rounded-3 d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 38px; height: 38px; font-size: 1.1rem;">
                <i class="bi" [ngClass]="orderType === 'W.O' ? 'bi-briefcase-fill' : 'bi-file-earmark-richtext-fill'"></i>
              </div>
              <div>
                <div class="d-flex align-items-center gap-2">
                  <h5 class="modal-title fw-bold mb-0 text-white">
                    {{ orderType === 'W.O' ? 'Work Order (W.O) Letterhead Generator' : 'Purchase Order (P.O) Letterhead Generator' }}
                  </h5>
                  <span class="badge bg-warning text-dark font-mono fw-bold px-2 py-1">{{ docData.poWoNo }}</span>
                </div>
                <div class="text-white-50 small d-flex align-items-center gap-2 mt-0.5">
                  <span><i class="bi bi-building me-1"></i>{{ isWarehouse ? 'Central Warehouse (SWH)' : (project?.siteId + ' - ' + project?.clientName) }}</span>
                </div>
              </div>
            </div>

            <div class="d-flex align-items-center gap-2">
              <!-- Switch PO / WO -->
              <div class="btn-group btn-group-sm me-2" role="group">
                <button type="button" class="btn fw-bold"
                        [ngClass]="orderType === 'P.O' ? 'btn-warning text-dark' : 'btn-outline-light'"
                        (click)="switchOrderType('P.O')">
                  P.O
                </button>
                <button type="button" class="btn fw-bold"
                        [ngClass]="orderType === 'W.O' ? 'btn-warning text-dark' : 'btn-outline-light'"
                        (click)="switchOrderType('W.O')">
                  W.O
                </button>
              </div>

              <button type="button" class="btn-close btn-close-white ms-2" (click)="close.emit()" title="Close"></button>
            </div>
          </div>

          <!-- QUICK SELECTION BAR: BOM MATERIAL & VENDOR & PAGE TABS -->
          <div class="bg-white border-bottom px-4 py-2.5 d-flex flex-wrap align-items-end justify-content-between gap-3">
            <div class="d-flex flex-wrap align-items-end gap-2.5 flex-grow-1">
              <!-- Select Vendor -->
              <div style="min-width: 230px;">
                <label class="form-label small fw-bold text-primary mb-1" style="font-size: 0.72rem;">
                  <i class="bi bi-shop me-1"></i>1. Select Vendor (Auto-fills Contact & GST) <span class="text-danger">*</span>
                </label>
                <select class="form-select form-select-sm fw-semibold border-primary"
                        [(ngModel)]="selectedVendorName"
                        (ngModelChange)="onVendorSelect($event)">
                  <option value="">-- Choose Vendor / Supplier --</option>
                  <option *ngFor="let v of vendorsList" [value]="v.vendorName">{{ v.vendorName }}</option>
                </select>
              </div>

              <!-- Select BOM Material -->
              <div style="min-width: 200px;">
                <label class="form-label small fw-bold text-dark mb-1" style="font-size: 0.72rem;">
                  <i class="bi bi-Cpu me-1"></i>2. Select BOM Material <span class="text-danger">*</span>
                </label>
                <select class="form-select form-select-sm fw-semibold"
                        [(ngModel)]="selectedBomGroup"
                        (ngModelChange)="onBomMaterialSelect()">
                  <optgroup *ngIf="projectBomOptions.length > 0" label="★ Project Planned BOM">
                    <option *ngFor="let pbo of projectBomOptions" [value]="pbo.group">{{ pbo.group }} ({{ pbo.spec }})</option>
                  </optgroup>
                  <optgroup label="BOM Material Categories">
                    <option *ngFor="let g of bomMaterialGroups" [value]="g.group">{{ g.group }}</option>
                  </optgroup>
                </select>
              </div>

              <!-- Subcategory / Spec -->
              <div style="min-width: 170px;">
                <label class="form-label small fw-bold text-dark mb-1" style="font-size: 0.72rem;">
                  Subcategory / Spec
                </label>
                <select class="form-select form-select-sm"
                        [(ngModel)]="selectedBomSpec"
                        (ngModelChange)="onBomSpecSelect()">
                  <option *ngFor="let s of getSpecsForGroup(selectedBomGroup)" [value]="s">{{ s }}</option>
                  <option value="Custom">Custom Spec...</option>
                </select>
              </div>

              <!-- Paid By / Generated By -->
              <div style="min-width: 130px;">
                <label class="form-label small fw-bold text-dark mb-1" style="font-size: 0.72rem;">
                  Generated / Paid By
                </label>
                <select class="form-select form-select-sm" [(ngModel)]="paidBy">
                  <option *ngFor="let pb of paidByOptions" [value]="pb">{{ pb }}</option>
                </select>
              </div>
            </div>

            <!-- Page View Switcher: Page 1 (PO/WO Order Sheet) vs Page 2..N (Terms & Conditions) -->
            <div class="d-flex align-items-center gap-1 bg-light p-1 rounded-3 border">
              <button type="button" class="btn btn-sm fw-bold px-3"
                      [ngClass]="activePageTab === 'page1' ? 'btn-dark text-white shadow-xs' : 'btn-light text-secondary'"
                      (click)="activePageTab = 'page1'">
                <i class="bi bi-file-earmark-spreadsheet me-1"></i>Page 1: {{ orderType }} Sheet
              </button>
              <button type="button" class="btn btn-sm fw-bold px-3"
                      [ngClass]="activePageTab === 'terms' ? 'btn-dark text-white shadow-xs' : 'btn-light text-secondary'"
                      (click)="activePageTab = 'terms'">
                <i class="bi bi-journal-Check me-1"></i>Pages 2-{{ (docData.termsPages.length || 1) + 1 }}: Terms & Conditions ({{ docData.termsPages.length }} Pages)
              </button>
            </div>
          </div>

          <!-- STATUS ALERT BANNER -->
          <div *ngIf="statusBanner" class="px-4 py-1.5 small fw-semibold d-flex justify-content-between align-items-center"
               [ngClass]="statusBanner.type === 'success' ? 'bg-success-subtle text-success border-bottom border-success-subtle' : 'bg-danger-subtle text-danger border-bottom border-danger-subtle'">
            <span><i class="bi me-1" [ngClass]="statusBanner.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'"></i>{{ statusBanner.text }}</span>
            <button type="button" class="btn-close btn-sm" style="font-size: 0.65rem;" (click)="statusBanner = null"></button>
          </div>

          <!-- MODAL BODY: EDITABLE PO/WO DOCUMENT -->
          <div class="modal-body p-3 p-md-4 bg-secondary-subtle overflow-auto" style="max-height: 70vh;">

            <!-- ========================================================= -->
            <!-- TAB 1: PAGE 1 — PURCHASE ORDER / WORK ORDER SHEET         -->
            <!-- ========================================================= -->
            <div *ngIf="activePageTab === 'page1'" class="po-sheet-container bg-white mx-auto shadow-lg">

              <!-- Optional Uploaded Letterhead Header Image Banner -->
              <div *ngIf="currentTypeConfig?.headerImageBase64" class="letterhead-banner-box text-center border-bottom p-2 position-relative">
                <img [src]="currentTypeConfig.headerImageBase64" alt="Company Letterhead" style="max-height: 95px; max-width: 100%; object-fit: contain;">
              </div>

              <!-- MAIN BORDERED PO/WO TABLE (Exact Match to Screenshot 2) -->
              <div class="po-grid-border">

                <!-- TITLE ROW -->
                <div class="po-title-bar text-center fw-bold py-1.5 border-bottom">
                  <input type="text" class="po-inline-input text-center fw-bold w-100" style="font-size: 1.02rem; letter-spacing: 0.5px;"
                         [(ngModel)]="docData.documentTitle">
                </div>

                <!-- VENDOR DETAILS & ORDER DETAILS HEADER ROW -->
                <div class="row g-0 border-bottom bg-light-subtle">
                  <div class="col-6 border-end px-2.5 py-1 fw-bold" style="font-size: 0.82rem;">
                    VENDOR DETAILS
                  </div>
                  <div class="col-6 px-2.5 py-1 fw-bold" style="font-size: 0.82rem;">
                    ORDER DETAILS
                  </div>
                </div>

                <!-- CONTACT & PO NO / DATE ROW -->
                <div class="row g-0 border-bottom">
                  <!-- Left: Contact Name & Contact Number -->
                  <div class="col-6 border-end px-2.5 py-1.5">
                    <div class="d-flex align-items-center mb-1">
                      <span class="fw-bold text-nowrap me-2" style="font-size: 0.8rem; width: 120px;">Contact Name :</span>
                      <input type="text" class="po-inline-input flex-grow-1" [(ngModel)]="docData.vendorContactName" placeholder="e.g. Mr. Jai Ganesh">
                    </div>
                    <div class="d-flex align-items-center">
                      <span class="fw-bold text-nowrap me-2" style="font-size: 0.8rem; width: 120px;">Contact Number :-</span>
                      <input type="text" class="po-inline-input flex-grow-1" [(ngModel)]="docData.vendorContactPhone" placeholder="e.g. +91 7010660212">
                    </div>
                  </div>

                  <!-- Right: PO/WO NO & DATE -->
                  <div class="col-6 px-2.5 py-1.5">
                    <div class="d-flex align-items-center mb-1">
                      <span class="fw-bold text-nowrap me-2" style="font-size: 0.8rem; width: 90px;">{{ orderType === 'W.O' ? 'WO NO :' : 'PO NO :' }}</span>
                      <input type="text" class="po-inline-input fw-bold font-mono flex-grow-1 text-primary" [(ngModel)]="docData.poWoNo">
                    </div>
                    <div class="d-flex align-items-center">
                      <span class="fw-bold text-nowrap me-2" style="font-size: 0.8rem; width: 90px;">DATE :</span>
                      <input type="text" class="po-inline-input flex-grow-1 font-mono" [(ngModel)]="docData.orderDate" placeholder="dd.mm.yyyy">
                    </div>
                  </div>
                </div>

                <!-- VENDOR NAME & ADDRESS vs GSTIN / BILLING / DELIVERY ADDRESS -->
                <div class="row g-0 border-bottom">
                  <!-- Left: Vendor Name & Address -->
                  <div class="col-6 border-end px-2.5 py-2 d-flex flex-column">
                    <div class="fw-bold mb-1.5" style="font-size: 0.8rem;">Vendor Name & Address :</div>
                    <input type="text" class="po-inline-input fw-bold mb-1 w-100" style="font-size: 0.86rem;"
                           [(ngModel)]="docData.vendorTitleLine" placeholder="M/s. VENDOR NAME,">
                    <textarea class="po-inline-textarea flex-grow-1 w-100" rows="5"
                              [(ngModel)]="docData.vendorAddress"
                              placeholder="Enter Vendor Street Address, City, Pincode, State"></textarea>
                  </div>

                  <!-- Right: Company GSTIN, Billing Address, Delivery Address -->
                  <div class="col-6 d-flex flex-column">
                    <!-- Company GSTIN Row -->
                    <div class="border-bottom px-2.5 py-1 d-flex align-items-center">
                      <span class="fw-bold me-2" style="font-size: 0.8rem;">GSTIN :-</span>
                      <input type="text" class="po-inline-input font-mono flex-grow-1" [(ngModel)]="docData.companyGstin">
                    </div>

                    <!-- Billing Address Box -->
                    <div class="border-bottom px-2.5 py-1.5">
                      <div class="fw-bold mb-0.5" style="font-size: 0.78rem;">Billing address</div>
                      <input type="text" class="po-inline-input fw-bold mb-0.5 w-100" style="font-size: 0.8rem;"
                             [(ngModel)]="docData.billingCompany">
                      <textarea class="po-inline-textarea w-100" rows="3" style="font-size: 0.78rem;"
                                [(ngModel)]="docData.billingAddress"></textarea>
                    </div>

                    <!-- Delivery Address Box -->
                    <div class="px-2.5 py-1.5 flex-grow-1">
                      <div class="fw-bold mb-0.5" style="font-size: 0.78rem;">Delivery address :</div>
                      <input type="text" class="po-inline-input fw-bold mb-0.5 w-100" style="font-size: 0.8rem;"
                             [(ngModel)]="docData.deliveryTitleLine">
                      <textarea class="po-inline-textarea w-100" rows="2" style="font-size: 0.78rem;"
                                [(ngModel)]="docData.deliveryAddress"></textarea>
                    </div>
                  </div>
                </div>

                <!-- VENDOR GSTIN & PAN / DELIVERY CONTACT ROW -->
                <div class="row g-0 border-bottom">
                  <div class="col-6 border-end">
                    <div class="d-flex align-items-center border-bottom px-2.5 py-1">
                      <span class="fw-bold" style="font-size: 0.8rem; width: 75px;">GSTIN :</span>
                      <input type="text" class="po-inline-input fw-bold font-mono flex-grow-1"
                             [(ngModel)]="docData.vendorGstin"
                             (ngModelChange)="onVendorGstinChange($event)"
                             placeholder="e.g. 33AYNPJ7911J1Z6">
                    </div>
                    <div class="d-flex align-items-center px-2.5 py-1">
                      <span class="fw-bold" style="font-size: 0.8rem; width: 75px;">PAN :</span>
                      <input type="text" class="po-inline-input fw-bold font-mono flex-grow-1"
                             [(ngModel)]="docData.vendorPan"
                             placeholder="e.g. AYNPJ7911J">
                    </div>
                  </div>

                  <div class="col-6 d-flex flex-column justify-content-end">
                    <div class="border-bottom py-2 px-2.5"></div>
                    <div class="row g-0 align-items-center px-2.5 py-1">
                      <div class="col-6 d-flex align-items-center border-end pe-2">
                        <span class="fw-bold text-nowrap me-1" style="font-size: 0.78rem;">Contact :</span>
                        <input type="text" class="po-inline-input flex-grow-1" [(ngModel)]="docData.siteContactName">
                      </div>
                      <div class="col-6 d-flex align-items-center ps-2">
                        <span class="fw-bold text-nowrap me-1" style="font-size: 0.78rem;">Ph. No :</span>
                        <input type="text" class="po-inline-input flex-grow-1" [(ngModel)]="docData.siteContactPhone">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- LINE ITEMS TABLE -->
                <div class="table-responsive">
                  <table class="table table-bordered mb-0 po-items-table align-middle">
                    <thead>
                      <tr class="text-center fw-bold bg-light-subtle" style="font-size: 0.8rem;">
                        <th style="width: 72px;">
                          <div class="d-flex flex-column align-items-center justify-content-center gap-0.5">
                            <span>S.No</span>
                            <button type="button"
                                    class="btn btn-xs btn-outline-primary py-0 px-1.5 fw-bold"
                                    style="font-size: 0.64rem; line-height: 1.25;"
                                    (click)="addLineItem()"
                                    title="Add Row (Default 1)">
                              + Add
                            </button>
                          </div>
                        </th>
                        <th>Descriptions</th>
                        <th style="width: 70px;">Unit</th>
                        <th style="width: 65px;">Qty</th>
                        <th style="width: 105px;">Rate</th>
                        <th style="width: 75px;">GST %</th>
                        <th style="width: 125px;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of docData.items; let idx = index">
                        <!-- S.No Cell: Delete button on Left side near S.No + Serial Number + Add Row button on S.No -->
                        <td class="text-center fw-semibold px-1">
                          <div class="d-flex align-items-center justify-content-center gap-1">
                            <button *ngIf="docData.items.length > 1"
                                    type="button"
                                    class="btn btn-sm text-danger p-0 border-0 lh-1"
                                    style="font-size: 0.8rem;"
                                    (click)="removeLineItem(idx)"
                                    title="Delete Row {{ idx + 1 }}">
                              <i class="bi bi-trash3-fill"></i>
                            </button>
                            <span>{{ idx + 1 }}</span>
                            <button *ngIf="idx === docData.items.length - 1"
                                    type="button"
                                    class="btn btn-sm text-primary p-0 border-0 lh-1"
                                    style="font-size: 0.82rem;"
                                    (click)="addLineItem()"
                                    title="Add Row below S.No {{ idx + 1 }}">
                              <i class="bi bi-plus-circle-fill"></i>
                            </button>
                          </div>
                        </td>
                        <td>
                          <!-- Quick BOM Material selector per row when multiple rows are added (e.g. Inverter/Panels + DB Boxes/Cables) -->
                          <div *ngIf="idx > 0 || docData.items.length > 1" class="d-flex align-items-center gap-1.5 mb-1">
                            <span class="text-muted fw-bold" style="font-size: 0.68rem;">Material:</span>
                            <select class="form-select form-select-sm py-0 px-2 fw-semibold"
                                    style="font-size: 0.72rem; height: 22px; max-width: 240px;"
                                    [(ngModel)]="item.materialGroup"
                                    (ngModelChange)="onRowMaterialSelect(item, idx)">
                              <option value="">-- Choose BOM Material --</option>
                              <option value="Panels">Panels (5% GST)</option>
                              <option value="Inverters">Inverters (5% GST)</option>
                              <option value="DB Boxes">DB Boxes (18% GST)</option>
                              <option value="Cables">Cables (18% GST)</option>
                              <option value="Structure">Structure / MMS (18% GST)</option>
                              <option value="Earthing Materials">Earthing &amp; LA (18% GST)</option>
                              <option value="Consumables">Consumables &amp; Misc (18% GST)</option>
                              <option value="Transportation">Transportation to Site (18% GST)</option>
                              <ng-container *ngFor="let g of bomMaterialGroups">
                                <option *ngIf="!['Panels','Inverters','DB Boxes','Cables','Structure','Earthing Materials','Consumables','Transportation & Logistics','Consumables & Miscellaneous'].includes(g.group)"
                                        [value]="g.group">
                                  {{ g.group }} ({{ isFivePercentMaterial(g.group) ? '5%' : '18%' }} GST)
                                </option>
                              </ng-container>
                            </select>
                          </div>
                          <textarea class="po-inline-textarea w-100"
                                    [rows]="idx === 0 ? 6 : 3"
                                    [(ngModel)]="item.description"
                                    (ngModelChange)="onItemDescriptionEdit(item, idx)"
                                    placeholder="Enter material specification / work description..."></textarea>
                        </td>
                        <td class="text-center">
                          <input type="text" class="po-inline-input text-center w-100" [(ngModel)]="item.unit">
                        </td>
                        <td class="text-center">
                          <input type="number" class="po-inline-input text-center w-100" [(ngModel)]="item.qty" (ngModelChange)="recalculateItem(item)">
                        </td>
                        <td class="text-end">
                          <input type="number" class="po-inline-input text-end font-mono w-100" [(ngModel)]="item.rate" (ngModelChange)="recalculateItem(item)" step="any">
                        </td>
                        <td class="text-center">
                          <div class="d-flex align-items-center justify-content-center">
                            <input type="number" class="po-inline-input text-center fw-bold" style="width: 44px;" [(ngModel)]="item.gstPct" (ngModelChange)="recalculateTotals()">
                            <span class="small">%</span>
                          </div>
                        </td>
                        <td class="text-end fw-semibold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                          {{ item.amount | number:'1.2-2' }}
                        </td>
                      </tr>

                      <!-- SUB TOTAL / CGST / SGST / GRAND TOTAL ROWS (Non-editable, auto-calculated) -->
                      <tr>
                        <td colspan="2" [attr.rowspan]="isMixedGst ? 6 : 4" class="align-bottom px-2.5 py-1.5 border-end">
                          <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold" style="font-size: 0.8rem;">Total Amount in words :</span>
                            <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" style="font-size: 0.7rem;"
                                    (click)="autoFillAmountInWords()" title="Reset to auto-calculated words from Grand Total">
                              <i class="bi bi-arrow-clockwise"></i> Auto-Words
                            </button>
                          </div>
                        </td>
                        <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">Sub Total :</td>
                        <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                          {{ docData.subTotal | number:'1.2-2' }}
                        </td>
                      </tr>

                      <!-- MIXED GST CASE: Inverter/Panels (5%) WITH DB Boxes/Cables/Other Materials (18%) -->
                      <ng-container *ngIf="isMixedGst">
                        <tr>
                          <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">CGST 2.5% :</td>
                          <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                            {{ docData.cgst2_5 | number:'1.2-2' }}
                          </td>
                        </tr>
                        <tr>
                          <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">SGST 2.5% :</td>
                          <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                            {{ docData.sgst2_5 | number:'1.2-2' }}
                          </td>
                        </tr>
                        <tr>
                          <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">CGST 9% :</td>
                          <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                            {{ docData.cgst9 | number:'1.2-2' }}
                          </td>
                        </tr>
                        <tr>
                          <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">SGST 9% :</td>
                          <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                            {{ docData.sgst9 | number:'1.2-2' }}
                          </td>
                        </tr>
                      </ng-container>

                      <!-- SINGLE GST CASE: Standard CGST & SGST -->
                      <ng-container *ngIf="!isMixedGst">
                        <tr>
                          <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">CGST :</td>
                          <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                            {{ docData.cgst | number:'1.2-2' }}
                          </td>
                        </tr>
                        <tr>
                          <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.82rem;">SGST :</td>
                          <td class="text-end fw-bold font-mono pe-2 py-1" style="font-size: 0.84rem; user-select: none;">
                            {{ docData.sgst | number:'1.2-2' }}
                          </td>
                        </tr>
                      </ng-container>

                      <tr>
                        <td colspan="4" class="text-end fw-bold pe-3 py-1" style="font-size: 0.84rem;">Grand Total :</td>
                        <td class="text-end fw-bold font-mono text-dark pe-2 py-1" style="font-size: 0.9rem; user-select: none;">
                          {{ docData.grandTotal | number:'1.2-2' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- AMOUNT IN WORDS ROW (Starts with 'Rupees' and ends with 'Only', 100% Editable!) -->
                <div class="border-bottom px-3 py-1.5 text-center bg-warning-subtle">
                  <input type="text"
                         class="po-inline-input text-center fw-bold fst-italic w-100"
                         style="font-size: 0.88rem;"
                         [(ngModel)]="docData.amountInWords"
                         (input)="isAmountInWordsManuallyEdited = true"
                         placeholder="Rupees ... Only">
                </div>

                <!-- TERMS & CONDITIONS SUMMARY TABLE ON PAGE 1 -->
                <div class="border-bottom px-2.5 py-1 d-flex justify-content-between align-items-center">
                  <span class="fw-bold text-decoration-underline" style="font-size: 0.8rem;">TERMS & CONDITIONS</span>
                  <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-2" style="font-size: 0.68rem;"
                          (click)="addTermRow()">
                    + Add Term Row
                  </button>
                </div>

                <div *ngFor="let term of docData.termsTable; let tIdx = index" class="row g-0 border-bottom align-items-center">
                  <div class="col-6 border-end px-2.5 py-1">
                    <input type="text" class="po-inline-input" [(ngModel)]="term.label">
                  </div>
                  <div class="col-6 px-2.5 py-1 d-flex align-items-center">
                    <input type="text" class="po-inline-input flex-grow-1" [(ngModel)]="term.value">
                    <button *ngIf="docData.termsTable.length > 1" type="button" class="btn btn-sm text-muted p-0 ms-1 border-0"
                            (click)="removeTermRow(tIdx)">
                      <i class="bi bi-x"></i>
                    </button>
                  </div>
                </div>

                <!-- SIGNATURE BLOCK -->
                <div class="row g-0" style="min-height: 110px;">
                  <div class="col-6 border-end px-2.5 py-2 d-flex flex-column justify-content-between">
                    <input type="text" class="po-inline-input fw-bold" style="font-size: 0.82rem;"
                           [(ngModel)]="docData.forCompanySignText">
                    <div class="text-muted small" style="font-size: 0.72rem;">Authorized Signatory</div>
                  </div>
                  <div class="col-6 px-2.5 py-2 d-flex flex-column justify-content-between">
                    <div class="fw-bold" style="font-size: 0.82rem;">Suppliers Signature with Seal</div>
                    <input type="text" class="po-inline-input fw-bold" style="font-size: 0.84rem;"
                           [(ngModel)]="docData.supplierSignName">
                  </div>
                </div>

              </div>
            </div>

            <!-- ========================================================= -->
            <!-- TAB 2: PAGES 2..N — MULTI-PAGE TERMS & CONDITIONS (.docx) -->
            <!-- ========================================================= -->
            <div *ngIf="activePageTab === 'terms'" class="mx-auto" style="max-width: 860px;">
              <div class="d-flex justify-content-between align-items-center mb-3 bg-white p-3 rounded-3 shadow-xs border">
                <div>
                  <h6 class="fw-bold mb-0.5 text-dark">
                    <i class="bi bi-file-earmark-word text-primary me-1"></i>
                    {{ orderType }} Detailed Terms & Conditions (Pages 2 to {{ docData.termsPages.length + 1 }})
                  </h6>
                  <div class="text-muted small">
                    Add or edit pages below. Click <strong>"Save Terms Permanently"</strong> to make changes permanent for all future {{ orderType }}s.
                  </div>
                </div>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-sm btn-outline-primary fw-semibold" (click)="addTermsPage()">
                    <i class="bi bi-file-earmark-plus me-1"></i>+ Add Page
                  </button>
                  <button type="button" class="btn btn-sm btn-success fw-bold" (click)="saveTermsPermanently()">
                    <i class="bi bi-cloud-check-fill me-1"></i>Save Terms Permanently
                  </button>
                </div>
              </div>

              <div *ngFor="let pageText of docData.termsPages; let pIdx = index; trackBy: trackByIndex"
                   class="po-sheet-container bg-white mx-auto shadow-sm mb-4 p-4 position-relative">
                <!-- Optional Letterhead Header on each Terms Page -->
                <div *ngIf="currentTypeConfig?.headerImageBase64" class="text-center border-bottom pb-2 mb-3">
                  <img [src]="currentTypeConfig.headerImageBase64" alt="Header" style="max-height: 75px; max-width: 100%; object-fit: contain;">
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                  <span class="badge bg-dark font-mono">Page {{ pIdx + 2 }} of {{ docData.termsPages.length + 1 }} ({{ orderType }} Terms & Conditions)</span>
                  <button *ngIf="docData.termsPages.length > 1" type="button" class="btn btn-xs btn-outline-danger py-0 px-2"
                          (click)="removeTermsPage(pIdx)">
                    Remove Page
                  </button>
                </div>
                <textarea class="form-control font-mono" rows="16" style="font-size: 0.82rem; line-height: 1.55;"
                          [(ngModel)]="docData.termsPages[pIdx]"
                          placeholder="Paste or type Terms & Conditions for this page..."></textarea>
              </div>
            </div>

          </div>

          <!-- MODAL FOOTER -->
          <div class="modal-footer bg-white border-top py-2.5 px-4 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-3">
              <div class="small text-muted">
                <strong>Grand Total:</strong>
                <span class="fs-6 fw-bold text-danger font-mono ms-1">₹ {{ docData.grandTotal | number:'1.2-2' }}</span>
              </div>
              <div class="small text-muted d-none d-md-block">
                &bull; Bill Voucher defaults to <span class="badge bg-warning-subtle text-dark border">Not Submitted</span>
              </div>
            </div>

            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm px-3" (click)="close.emit()">Cancel</button>
              <button type="button" class="btn btn-outline-dark btn-sm px-3 fw-semibold" (click)="downloadPoWoPdf()">
                <i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i>Preview / Download PDF ({{ docData.termsPages.length + 1 }} Pages)
              </button>
              <button type="button" class="btn btn-primary btn-sm px-3 fw-bold shadow-sm"
                      [disabled]="saving"
                      (click)="saveAndGenerate(false)">
                <i class="bi bi-check2-circle me-1"></i>
                {{ saving ? 'Saving...' : ('Save ' + orderType + ' to Ledger') }}
              </button>
              <button type="button" class="btn btn-danger btn-sm px-3 fw-bold shadow-sm"
                      [disabled]="saving"
                      (click)="saveAndGenerate(true)">
                <i class="bi bi-printer-fill me-1"></i>
                {{ saving ? 'Generating...' : ('Generate ' + orderType + ' PDF & Save to Ledger') }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .po-wo-backdrop {
      background: rgba(15, 23, 42, 0.72);
      backdrop-filter: blur(3px);
      z-index: 1065;
    }
    .po-wo-dialog {
      max-width: 1040px;
    }
    .po-sheet-container {
      max-width: 880px;
      border: 1px solid #cbd5e1;
      color: #000;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    }
    .po-grid-border {
      border: 2px solid #000;
      margin: 10px;
    }
    .po-grid-border .border-bottom {
      border-bottom: 1px solid #000 !important;
    }
    .po-grid-border .border-end {
      border-right: 1px solid #000 !important;
    }
    .po-items-table th, .po-items-table td {
      border-color: #000 !important;
      padding: 4px 6px;
      font-size: 0.8rem;
    }
    .po-inline-input {
      border: 1px solid transparent;
      background: transparent;
      padding: 1px 4px;
      font-size: 0.8rem;
      color: #000;
      border-radius: 3px;
      transition: all 0.15s;
    }
    .po-inline-input:hover, .po-inline-input:focus {
      border-color: #3b82f6;
      background: #f8fafc;
      outline: none;
    }
    .po-inline-textarea {
      border: 1px solid transparent;
      background: transparent;
      padding: 2px 4px;
      font-size: 0.79rem;
      color: #000;
      border-radius: 3px;
      resize: vertical;
      line-height: 1.4;
      width: 100%;
    }
    .po-inline-textarea:hover, .po-inline-textarea:focus {
      border-color: #3b82f6;
      background: #f8fafc;
      outline: none;
    }
  `]
})
export class PoWoLetterheadModalComponent implements OnInit, OnChanges {
  private projectService = inject(ProjectService);
  private officeService = inject(OfficeService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() orderType: 'P.O' | 'W.O' = 'P.O';
  @Input() isWarehouse = false;
  @Input() project: Project | null = null;
  @Input() editingExpense: SiteExpense | null = null;
  @Input() projectBomOptions: { value: string; label: string; group: string; spec: string }[] = [];
  @Input() bomMaterialGroups: { group: string; specifications: string[] }[] = [];
  @Input() paidByOptions: string[] = ['OFFICE'];

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SiteExpense>();

  vendorsList: OfficeVendor[] = [];
  selectedVendorName = '';
  selectedBomGroup = 'Structure';
  selectedBomSpec = 'Standard';
  paidBy = 'OFFICE';
  activePageTab: 'page1' | 'terms' = 'page1';
  saving = false;
  isAmountInWordsManuallyEdited = false;

  statusBanner: { text: string; type: 'success' | 'danger' } | null = null;

  poWoConfig: any = {
    po: { fileName: '', headerImageBase64: '', footerImageBase64: '', headerTextLines: [], defaultTermsTable: [], termsPages: [] },
    wo: { fileName: '', headerImageBase64: '', footerImageBase64: '', headerTextLines: [], defaultTermsTable: [], termsPages: [] },
    bomMaterialDescriptions: {},
    savedPoWoDocs: {}
  };

  docData = {
    documentTitle: 'PURCHASE ORDER',
    poWoNo: 'SOLAR/SP412/PO-001',
    orderDate: '',
    vendorContactName: '',
    vendorContactPhone: '',
    vendorTitleLine: '',
    vendorAddress: '',
    vendorGstin: '',
    vendorPan: '',
    companyGstin: '33AACCL5566B1ZT',
    billingCompany: 'M/s SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED,',
    billingAddress: 'Plot No.5171, F2, Sathlokhar, 9th Street, Ram Nagar North Extension, Madipakkam, Chennai, Tamil Nadu, 600091.\nGSTIN :- 33AACCL5566B1ZT',
    deliveryTitleLine: '',
    deliveryAddress: '',
    siteContactName: 'Dinesh Kumar',
    siteContactPhone: '+91 7401415749',
    items: [] as PoWoLineItem[],
    subTotal: 0,
    cgst: 0,
    sgst: 0,
    cgst2_5: 0,
    sgst2_5: 0,
    cgst9: 0,
    sgst9: 0,
    grandTotal: 0,
    amountInWords: 'Rupees Zero Only',
    termsTable: [] as PoWoTermRow[],
    forCompanySignText: 'For SATHLOKHAR SYNERGYS E&C GLOBAL LTD,',
    supplierSignName: '',
    termsPages: [] as string[]
  };

  get currentTypeConfig(): any {
    return this.orderType === 'W.O' ? this.poWoConfig?.wo : this.poWoConfig?.po;
  }

  /**
   * Returns true ONLY when the PO/WO combines Inverter/Panels (5% GST)
   * WITH other materials like DB Boxes / Cables / Structure / etc. (18% GST).
   */
  get isMixedGst(): boolean {
    if (!this.docData.items || this.docData.items.length < 2) return false;
    const hasFivePct = this.docData.items.some(it => Number(it.gstPct) === 5);
    const hasEighteenPct = this.docData.items.some(it => Number(it.gstPct) !== 5 && Number(it.gstPct) > 0);
    return hasFivePct && hasEighteenPct;
  }

  /**
   * Panels and Inverters are 5% GST; all other materials (DB Boxes, Cables, Structure, etc.) are 18% GST.
   */
  isFivePercentMaterial(groupOrText: string): boolean {
    const lower = (groupOrText || '').toLowerCase().trim();
    if (!lower) return false;
    if (
      lower.includes('db box') ||
      lower.includes('acdb') ||
      lower.includes('dcdb') ||
      lower.includes('cable') ||
      lower.includes('structure') ||
      lower.includes('earthing') ||
      lower.includes('consumable') ||
      lower.includes('transport') ||
      lower.includes('walkway')
    ) {
      return false;
    }
    return (
      lower.includes('panel') ||
      lower.includes('inverter') ||
      lower.includes('photovoltaic') ||
      lower.includes('mono perc') ||
      lower.includes('topcon') ||
      lower.includes('ongrid') ||
      lower.includes('hybrid')
    );
  }

  ngOnInit(): void {
    this.loadVendors();
    this.loadPoWoConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.activePageTab = 'page1';
      this.statusBanner = null;
      this.loadVendors();
      this.loadPoWoConfig(() => {
        this.initializeDocumentState();
      });
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  loadVendors(): void {
    this.officeService.getVendors().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.vendorsList = res.data;
          this.cdr.markForCheck();
        }
      }
    });
  }

  loadPoWoConfig(callback?: () => void): void {
    this.projectService.getPoWoConfig().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.poWoConfig = res.data;
        }
        if (callback) callback();
        this.cdr.markForCheck();
      },
      error: () => {
        if (callback) callback();
      }
    });
  }

  switchOrderType(newType: 'P.O' | 'W.O'): void {
    if (this.orderType === newType) return;
    this.orderType = newType;
    this.docData.documentTitle = newType === 'W.O' ? 'WORK ORDER' : 'PURCHASE ORDER';
    const cfg = this.currentTypeConfig;
    if (cfg?.defaultTermsTable?.length) {
      this.docData.termsTable = cfg.defaultTermsTable.map((r: any) => ({ ...r }));
    }
    if (cfg?.termsPages?.length) {
      this.docData.termsPages = [...cfg.termsPages];
    }
    this.fetchNextNumber();
  }

  initializeDocumentState(): void {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayFormatted = `${dd}.${mm}.${yyyy}`;

    // Check if editing an existing PO/WO that has saved document state
    const existingRef = (this.editingExpense?.referenceNo || '').trim();
    if (this.editingExpense && existingRef && this.poWoConfig?.savedPoWoDocs?.[existingRef]) {
      const saved = this.poWoConfig.savedPoWoDocs[existingRef];
      this.docData = {
        ...this.docData,
        ...JSON.parse(JSON.stringify(saved))
      };
      this.selectedVendorName = this.editingExpense.vendorName || '';
      this.paidBy = this.editingExpense.paidBy || 'OFFICE';
      this.recalculateTotals();
      this.cdr.markForCheck();
      return;
    }

    this.isAmountInWordsManuallyEdited = false;
    this.docData.documentTitle = this.orderType === 'W.O' ? 'WORK ORDER' : 'PURCHASE ORDER';
    this.docData.orderDate = this.editingExpense?.formattedDate
      ? this.editingExpense.formattedDate.replace(/-/g, '.')
      : todayFormatted;

    // Delivery address based on Client or Central Warehouse
    if (this.isWarehouse || !this.project || this.project.siteId.toUpperCase() === 'WAREHOUSE') {
      this.docData.deliveryTitleLine = 'SWH : Central Warehouse, Sathlokhar H.O, Chennai';
      this.docData.deliveryAddress = 'Plot No.5171, F2, Sathlokhar, 9th Street, Ram Nagar North Extension, Madipakkam, Chennai - 600091.';
    } else {
      const cap = String(this.project.siteCapacity || '5').replace(/kw/gi, '').trim();
      const loc = this.project.location ? `, ${this.project.location}` : ', Chennai';
      this.docData.deliveryTitleLine = `${this.project.siteId} : ${cap}KW, ${this.project.clientName}${loc}`;
      this.docData.deliveryAddress = `${this.project.location || 'Chennai'}, Tamil Nadu.`;
    }

    const cfg = this.currentTypeConfig;
    this.docData.termsTable = cfg?.defaultTermsTable?.length
      ? cfg.defaultTermsTable.map((r: any) => ({ ...r }))
      : [
          { label: 'Specifications', value: 'As per ISI Standard,' },
          { label: 'Delivery schedule', value: 'Immediate' },
          { label: 'GST', value: 'Included' },
          { label: 'Loading', value: 'Included' },
          { label: 'Transportation charges', value: 'Included' },
          { label: 'Payment terms', value: '7 Days on Credit' }
        ];

    this.docData.termsPages = cfg?.termsPages?.length ? [...cfg.termsPages] : [];

    // Default BOM Group & Spec
    if (this.projectBomOptions.length > 0) {
      this.selectedBomGroup = this.projectBomOptions[0].group;
      this.selectedBomSpec = this.projectBomOptions[0].spec;
    } else if (this.bomMaterialGroups.length > 0) {
      this.selectedBomGroup = this.bomMaterialGroups[0].group;
      this.selectedBomSpec = this.bomMaterialGroups[0].specifications[0] || 'Standard';
    }

    // Build default 1 line item (S.No = 1) from selected BOM Material
    const capNum = parseFloat(String(this.project?.siteCapacity || '5').replace(/[^0-9.]/g, '')) || 5;
    const matTemplate = this.getMaterialTemplate(this.selectedBomGroup, this.selectedBomSpec);
    this.docData.items = [
      {
        sNo: 1,
        materialGroup: this.selectedBomGroup,
        description: matTemplate.description,
        unit: matTemplate.unit,
        qty: matTemplate.unit === 'KW' ? capNum : 1,
        rate: matTemplate.rate,
        gstPct: matTemplate.gstPct,
        amount: (matTemplate.unit === 'KW' ? capNum : 1) * matTemplate.rate
      }
    ];

    if (this.editingExpense) {
      this.docData.poWoNo = existingRef || '';
      this.selectedVendorName = this.editingExpense.vendorName || '';
      if (this.selectedVendorName) {
        this.onVendorSelect(this.selectedVendorName);
      }
      this.paidBy = this.editingExpense.paidBy || 'OFFICE';
    } else {
      this.selectedVendorName = '';
      this.docData.vendorContactName = '';
      this.docData.vendorContactPhone = '';
      this.docData.vendorTitleLine = 'M/s. ';
      this.docData.vendorAddress = '';
      this.docData.vendorGstin = '';
      this.docData.vendorPan = '';
      this.docData.supplierSignName = 'M/s. ';
      this.fetchNextNumber();
    }

    this.recalculateTotals();
  }

  fetchNextNumber(): void {
    const siteIdParam = this.isWarehouse ? 'SWH' : (this.project?.siteId || 'SWH');
    const typeParam = this.orderType === 'W.O' ? 'WO' : 'PO';
    this.projectService.getNextPoWoNumber(siteIdParam, typeParam).subscribe({
      next: (res) => {
        if (res.success && res.nextNumber) {
          this.docData.poWoNo = res.nextNumber;
          this.cdr.markForCheck();
        }
      }
    });
  }

  getSpecsForGroup(groupName: string): string[] {
    const found = this.bomMaterialGroups.find(g => g.group.toLowerCase() === (groupName || '').toLowerCase());
    return found && found.specifications.length > 0 ? found.specifications : ['Standard'];
  }

  getMaterialTemplate(groupName: string, specName: string): { description: string; unit: string; gstPct: number; rate: number } {
    const defaultGst = (this.isFivePercentMaterial(groupName) || this.isFivePercentMaterial(specName)) ? 5 : 18;
    const map = this.poWoConfig?.bomMaterialDescriptions || {};
    const exactKey = `${groupName} - ${specName}`;

    if ((groupName || '').toLowerCase().includes('transport')) {
      return {
        description: 'Transportation to Site',
        unit: 'LS',
        gstPct: 18,
        rate: 900
      };
    }

    let matchedTpl: any = null;
    if (map[exactKey]) matchedTpl = map[exactKey];
    else if (map[groupName]) matchedTpl = map[groupName];
    else {
      const lowerGrp = (groupName || '').toLowerCase();
      for (const k of Object.keys(map)) {
        if (k.toLowerCase() === lowerGrp || lowerGrp.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerGrp)) {
          matchedTpl = map[k];
          break;
        }
      }
    }

    if (matchedTpl) {
      return {
        description: matchedTpl.description,
        unit: matchedTpl.unit || 'Nos',
        gstPct: defaultGst,
        rate: matchedTpl.rate || 1000
      };
    }

    return {
      description: `Supply of ${groupName}${specName && specName !== 'Standard' ? ' (' + specName + ')' : ''},\nAs per approved MNRE / ISI technical specifications and site BOM requirements`,
      unit: 'Nos',
      gstPct: defaultGst,
      rate: 1000
    };
  }

  onBomMaterialSelect(): void {
    const specs = this.getSpecsForGroup(this.selectedBomGroup);
    const projOpt = this.projectBomOptions.find(p => p.group.toLowerCase() === this.selectedBomGroup.toLowerCase());
    this.selectedBomSpec = projOpt ? projOpt.spec : (specs[0] || 'Standard');
    this.applyBomTemplateToFirstRow();
  }

  onBomSpecSelect(): void {
    this.applyBomTemplateToFirstRow();
  }

  applyBomTemplateToFirstRow(): void {
    if (!this.docData.items || this.docData.items.length === 0) return;
    const tpl = this.getMaterialTemplate(this.selectedBomGroup, this.selectedBomSpec);
    const first = this.docData.items[0];
    first.materialGroup = this.selectedBomGroup;
    first.description = tpl.description;
    first.unit = tpl.unit || 'Nos';
    first.gstPct = tpl.gstPct;

    // Check if selected vendor has a specific rate for this material, otherwise use template rate
    let vendorRate = 0;
    const vObj = this.vendorsList.find(v => v.vendorName.toLowerCase() === (this.selectedVendorName || '').toLowerCase());
    if (vObj && vObj.materialRates && typeof vObj.materialRates === 'object') {
      vendorRate = Number(vObj.materialRates[this.selectedBomGroup] || vObj.materialRates[this.selectedBomSpec] || 0);
    }
    if (vendorRate > 0) {
      first.rate = vendorRate;
    } else if (tpl.rate > 0) {
      first.rate = tpl.rate;
    }

    this.recalculateItem(first);
  }

  onRowMaterialSelect(item: PoWoLineItem, idx: number): void {
    const grp = item.materialGroup || '';
    if (!grp) return;
    const specs = this.getSpecsForGroup(grp);
    const spec = specs[0] || 'Standard';
    const tpl = this.getMaterialTemplate(grp, spec);

    item.description = tpl.description;
    item.unit = tpl.unit || 'Nos';
    item.gstPct = this.isFivePercentMaterial(grp) ? 5 : 18;

    let vendorRate = 0;
    const vObj = this.vendorsList.find(v => v.vendorName.toLowerCase() === (this.selectedVendorName || '').toLowerCase());
    if (vObj && vObj.materialRates && typeof vObj.materialRates === 'object') {
      vendorRate = Number(vObj.materialRates[grp] || vObj.materialRates[spec] || 0);
    }
    item.rate = vendorRate > 0 ? vendorRate : tpl.rate;

    if (idx === 0) {
      this.selectedBomGroup = grp;
      this.selectedBomSpec = spec;
    }

    this.recalculateItem(item);
  }

  onItemDescriptionEdit(item: PoWoLineItem, idx: number): void {
    if (idx === 0 && this.selectedBomGroup) {
      this.poWoConfig.bomMaterialDescriptions = this.poWoConfig.bomMaterialDescriptions || {};
      this.poWoConfig.bomMaterialDescriptions[this.selectedBomGroup] = {
        description: this.docData.items[0].description,
        unit: this.docData.items[0].unit,
        gstPct: this.docData.items[0].gstPct,
        rate: this.docData.items[0].rate
      };
    } else if (idx > 0 && !item.materialGroup && item.description) {
      // Auto-detect 5% (Inverter/Panels) vs 18% (DB Boxes/Cables/Other) when typing description
      const detectedGst = this.isFivePercentMaterial(item.description) ? 5 : 18;
      if (item.gstPct !== detectedGst) {
        item.gstPct = detectedGst;
        this.recalculateTotals();
      }
    }
  }

  onVendorSelect(vendorName: string): void {
    if (!vendorName) return;
    const vendor = this.vendorsList.find(v => v.vendorName.trim().toLowerCase() === vendorName.trim().toLowerCase());
    const cleanTitle = vendorName.trim().toUpperCase().startsWith('M/S')
      ? `${vendorName.trim()},`
      : `M/s. ${vendorName.trim().toUpperCase()},`;

    this.docData.vendorTitleLine = cleanTitle;
    this.docData.supplierSignName = cleanTitle;

    if (vendor) {
      // Auto-fill Contact Name & Contact Number
      const rawCoord = (vendor.salesCoordinator || '').trim();
      this.docData.vendorContactName = rawCoord || 'Sales Coordinator';

      let rawPhone = (vendor.phoneNo || '').trim();
      if (rawPhone && !rawPhone.startsWith('+91') && /^\d{10}$/.test(rawPhone.replace(/\s+/g, ''))) {
        rawPhone = `+91 ${rawPhone}`;
      }
      this.docData.vendorContactPhone = rawPhone;

      // Auto-fill Address
      this.docData.vendorAddress = (vendor.location || 'Chennai,\nTamil Nadu').replace(/,\s*/g, ',\n');

      // Auto-fill GSTIN & extract 10-character PAN from GSTIN (chars 3..12)
      const gst = (vendor.gstNo || '').trim().toUpperCase();
      this.docData.vendorGstin = gst;
      this.docData.vendorPan = gst.length >= 12 ? gst.substring(2, 12) : '';

      // Auto-fill Payment Terms from creditDays
      if (vendor.creditDays) {
        const payRow = this.docData.termsTable.find(t => t.label.toLowerCase().includes('payment'));
        if (payRow) {
          payRow.value = vendor.creditDays.toLowerCase().includes('credit') ? vendor.creditDays : `${vendor.creditDays} on Credit`;
        }
      }

      // Apply BOM material description (applicable across all vendors!) and vendor rate if any
      this.applyBomTemplateToFirstRow();
    }
    this.cdr.markForCheck();
  }

  onVendorGstinChange(gst: string): void {
    const clean = (gst || '').trim().toUpperCase();
    if (clean.length >= 12) {
      this.docData.vendorPan = clean.substring(2, 12);
    }
  }

  addLineItem(): void {
    this.docData.items.push({
      sNo: this.docData.items.length + 1,
      materialGroup: '',
      description: '',
      unit: 'Nos',
      qty: 1,
      rate: 0,
      gstPct: 18,
      amount: 0
    });
    this.recalculateTotals();
  }

  removeLineItem(idx: number): void {
    if (this.docData.items.length <= 1) return;
    this.docData.items.splice(idx, 1);
    this.docData.items.forEach((it, i) => (it.sNo = i + 1));
    this.recalculateTotals();
  }

  recalculateItem(item: PoWoLineItem): void {
    const q = Number(item.qty) || 0;
    const r = Number(item.rate) || 0;
    item.amount = parseFloat((q * r).toFixed(2));
    this.recalculateTotals();
  }

  recalculateTotals(): void {
    let sub = 0;
    let fivePctBase = 0;
    let eighteenPctBase = 0;
    let totalTax = 0;

    for (const it of this.docData.items) {
      const amt = Number(it.amount) || 0;
      const gst = Number(it.gstPct) || 0;
      sub += amt;
      if (gst === 5) {
        fivePctBase += amt;
      } else {
        eighteenPctBase += amt;
      }
      totalTax += amt * (gst / 100);
    }

    this.docData.subTotal = parseFloat(sub.toFixed(2));
    this.docData.cgst2_5 = parseFloat((fivePctBase * 0.025).toFixed(2));
    this.docData.sgst2_5 = parseFloat((fivePctBase * 0.025).toFixed(2));
    this.docData.cgst9 = parseFloat((eighteenPctBase * 0.09).toFixed(2));
    this.docData.sgst9 = parseFloat((eighteenPctBase * 0.09).toFixed(2));

    if (this.isMixedGst) {
      this.docData.cgst = parseFloat((this.docData.cgst2_5 + this.docData.cgst9).toFixed(2));
      this.docData.sgst = parseFloat((this.docData.sgst2_5 + this.docData.sgst9).toFixed(2));
      this.docData.grandTotal = parseFloat(
        (this.docData.subTotal + this.docData.cgst2_5 + this.docData.sgst2_5 + this.docData.cgst9 + this.docData.sgst9).toFixed(2)
      );
    } else {
      this.docData.cgst = parseFloat((totalTax / 2).toFixed(2));
      this.docData.sgst = parseFloat((totalTax / 2).toFixed(2));
      this.docData.grandTotal = parseFloat((this.docData.subTotal + this.docData.cgst + this.docData.sgst).toFixed(2));
    }

    if (!this.isAmountInWordsManuallyEdited) {
      this.autoFillAmountInWords();
    }
  }

  recalculateTotalsFromManualAmount(): void {
    this.recalculateTotals();
  }

  onManualTaxChange(): void {
    const sub = Number(this.docData.subTotal) || 0;
    const cgst = Number(this.docData.cgst) || 0;
    const sgst = Number(this.docData.sgst) || 0;
    this.docData.grandTotal = parseFloat((sub + cgst + sgst).toFixed(2));
    if (!this.isAmountInWordsManuallyEdited) {
      this.autoFillAmountInWords();
    }
  }

  onManualMixedTaxChange(): void {
    const sub = Number(this.docData.subTotal) || 0;
    const c25 = Number(this.docData.cgst2_5) || 0;
    const s25 = Number(this.docData.sgst2_5) || 0;
    const c9 = Number(this.docData.cgst9) || 0;
    const s9 = Number(this.docData.sgst9) || 0;
    this.docData.cgst = parseFloat((c25 + c9).toFixed(2));
    this.docData.sgst = parseFloat((s25 + s9).toFixed(2));
    this.docData.grandTotal = parseFloat((sub + c25 + s25 + c9 + s9).toFixed(2));
    if (!this.isAmountInWordsManuallyEdited) {
      this.autoFillAmountInWords();
    }
  }

  onManualGrandTotalChange(): void {
    if (!this.isAmountInWordsManuallyEdited) {
      this.autoFillAmountInWords();
    }
  }

  autoFillAmountInWords(): void {
    this.isAmountInWordsManuallyEdited = false;
    this.docData.amountInWords = this.numberToIndianRupeesWords(this.docData.grandTotal);
  }

  // Converts number into 'Rupees ... Only' (Indian Numbering System: Crores, Lakhs, Thousands, Hundreds)
  numberToIndianRupeesWords(amount: number): string {
    const num = Math.round(Number(amount) || 0);
    if (num <= 0) return 'Rupees Zero Only';

    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const twoDigitWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      const t = Math.floor(n / 10);
      const o = n % 10;
      return `${tens[t]}${o > 0 ? ' ' + ones[o] : ''}`;
    };

    const parts: string[] = [];
    let rem = num;

    const crore = Math.floor(rem / 10000000);
    rem %= 10000000;
    if (crore > 0) {
      parts.push(`${twoDigitWords(crore)} Crore`);
    }

    const lakh = Math.floor(rem / 100000);
    rem %= 100000;
    if (lakh > 0) {
      parts.push(`${twoDigitWords(lakh)} Lakh`);
    }

    const thousand = Math.floor(rem / 1000);
    rem %= 1000;
    if (thousand > 0) {
      parts.push(`${twoDigitWords(thousand)} Thousand`);
    }

    const hundred = Math.floor(rem / 100);
    rem %= 100;
    if (hundred > 0) {
      parts.push(`${ones[hundred]} Hundred`);
    }

    if (rem > 0) {
      parts.push(twoDigitWords(rem));
    }

    return `Rupees ${parts.join(' ').trim()} Only`;
  }

  addTermRow(): void {
    this.docData.termsTable.push({ label: 'Additional Term', value: 'Included' });
  }

  removeTermRow(idx: number): void {
    if (this.docData.termsTable.length <= 1) return;
    this.docData.termsTable.splice(idx, 1);
  }

  addTermsPage(): void {
    this.docData.termsPages.push(`TERMS & CONDITIONS - PAGE ${this.docData.termsPages.length + 2}\n\n`);
  }

  removeTermsPage(idx: number): void {
    if (this.docData.termsPages.length <= 1) return;
    this.docData.termsPages.splice(idx, 1);
  }

  // Upload Word (.docx) or Image Letterhead -> Saved Permanently on Server
  onLetterheadFileSelected(event: any): void {
    const file: File = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const typeCode = this.orderType === 'W.O' ? 'WO' : 'PO';

      this.projectService.uploadPoWoLetterhead({
        type: typeCode,
        fileName: file.name,
        fileBase64: base64
      }).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.poWoConfig = res.data;
            const cfg = this.currentTypeConfig;
            if (cfg?.termsPages?.length) {
              this.docData.termsPages = [...cfg.termsPages];
            }
            this.statusBanner = {
              text: `${typeCode} Letterhead "${file.name}" uploaded & saved permanently (${this.docData.termsPages.length} Terms & Conditions pages extracted)!`,
              type: 'success'
            };
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.statusBanner = {
            text: err.error?.message || 'Failed to upload letterhead file.',
            type: 'danger'
          };
          this.cdr.markForCheck();
        }
      });
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  saveTermsPermanently(): void {
    const typeCode = this.orderType === 'W.O' ? 'WO' : 'PO';
    this.projectService.uploadPoWoLetterhead({
      type: typeCode,
      termsPages: this.docData.termsPages,
      defaultTermsTable: this.docData.termsTable
    }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.poWoConfig = res.data;
          this.statusBanner = {
            text: `All ${this.docData.termsPages.length} pages of ${typeCode} Terms & Conditions saved permanently!`,
            type: 'success'
          };
          this.cdr.markForCheck();
        }
      }
    });
  }

  // Save to Expense Ledger (Client or Warehouse) & Sync to Vendor Ledger
  saveAndGenerate(alsoDownloadPdf: boolean): void {
    if (!this.selectedVendorName && !this.docData.vendorTitleLine) {
      this.statusBanner = { text: 'Please select or enter a Vendor Name.', type: 'danger' };
      return;
    }
    if (!this.docData.grandTotal || this.docData.grandTotal <= 0) {
      this.statusBanner = { text: 'Grand Total must be greater than ₹0.', type: 'danger' };
      return;
    }

    // Ensure amountInWords starts with Rupees and ends with Only
    let words = (this.docData.amountInWords || '').trim();
    if (!words) {
      words = this.numberToIndianRupeesWords(this.docData.grandTotal);
    } else {
      if (!/^rupees\b/i.test(words)) words = 'Rupees ' + words;
      if (!/\bonly$/i.test(words)) words = words + ' Only';
    }
    this.docData.amountInWords = words;

    this.saving = true;

    const cleanVendor = (this.selectedVendorName || this.docData.vendorTitleLine.replace(/^M\/s\.?\s*/i, '').replace(/,+$/, '')).trim();
    const purposeStr = this.selectedBomSpec && this.selectedBomSpec !== 'Standard'
      ? `${this.selectedBomGroup} - ${this.selectedBomSpec}`
      : this.selectedBomGroup;

    const firstItemDesc = (this.docData.items[0]?.description || '').split('\n')[0] || purposeStr;
    const siteIdVal = this.isWarehouse ? 'WAREHOUSE' : (this.project?.siteId || 'WAREHOUSE');
    const clientNameVal = this.isWarehouse ? 'Warehouse : Sathlokhar H.O' : (this.project?.clientName || 'General');
    const clientSiteNameVal = this.isWarehouse
      ? 'Warehouse : Sathlokhar H.O'
      : `${siteIdVal} : ${this.project?.siteCapacity || '5'}KW, ${clientNameVal}, ${this.project?.location || 'Chennai'}`;

    const firstItem = this.docData.items[0];
    const bomTemplateUpdate = firstItem && this.selectedBomGroup ? {
      key: this.selectedBomGroup,
      description: firstItem.description,
      unit: firstItem.unit,
      gstPct: firstItem.gstPct,
      rate: firstItem.rate
    } : undefined;

    const payload: Partial<SiteExpense> & { poWoDoc?: any; bomTemplateUpdate?: any } = {
      siteId: siteIdVal,
      clientName: clientNameVal,
      clientSiteName: clientSiteNameVal,
      expenseDate: this.docData.orderDate.replace(/\./g, '-'),
      amount: Number(this.docData.grandTotal),
      paymentThrough: this.orderType,
      referenceNo: (this.docData.poWoNo || '').trim(),
      purpose: purposeStr,
      category: this.selectedBomGroup || 'Materials Supply',
      paidBy: this.paidBy || 'OFFICE',
      vendorName: cleanVendor,
      remarks: `${this.docData.poWoNo} | ${firstItemDesc}`,
      billVoucher: this.editingExpense?.billVoucher || 'Not Submitted',
      invoiceNo: this.editingExpense?.invoiceNo || '',
      poWoDoc: this.docData,
      bomTemplateUpdate
    };

    const req$ = (this.editingExpense && this.editingExpense.id)
      ? this.projectService.updateExpense(this.editingExpense.id, payload)
      : this.projectService.createExpense(payload);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        if (res.success && res.data) {
          if (alsoDownloadPdf) {
            this.downloadPoWoPdf();
          }
          this.saved.emit(res.data);
          this.close.emit();
        }
      },
      error: (err) => {
        this.saving = false;
        this.statusBanner = {
          text: err.error?.message || 'Error saving PO/WO to Expense Ledger.',
          type: 'danger'
        };
        this.cdr.markForCheck();
      }
    });
  }

  // Generate multi-page A4 PDF matching Screenshot 2 on Page 1 + Uploaded Word Terms on Pages 2..N
  downloadPoWoPdf(): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const halfWidth = contentWidth / 2;

    const addLetterheadHeaderAndFooter = (pageNum: number) => {
      let startY = 12;
      const cfg = this.currentTypeConfig;
      if (cfg?.headerImageBase64) {
        try {
          const fmt = cfg.headerImageBase64.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(cfg.headerImageBase64, fmt, margin, 6, contentWidth, 24);
          startY = 33;
        } catch (e) {
          startY = 12;
        }
      }
      if (cfg?.footerImageBase64) {
        try {
          const fmt = cfg.footerImageBase64.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(cfg.footerImageBase64, fmt, margin, pageHeight - 20, contentWidth, 14);
        } catch (e) {}
      }
      return startY;
    };

    let y = addLetterheadHeaderAndFooter(1);
    const topStartY = y;

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.35);

    // 1. TITLE BAR ("PURCHASE ORDER" / "WORK ORDER")
    doc.rect(margin, y, contentWidth, 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(this.docData.documentTitle || 'PURCHASE ORDER', pageWidth / 2, y + 4.8, { align: 'center' });
    y += 7;

    // 2. VENDOR DETAILS | ORDER DETAILS HEADER
    doc.rect(margin, y, halfWidth, 6);
    doc.rect(margin + halfWidth, y, halfWidth, 6);
    doc.setFontSize(8.5);
    doc.text('VENDOR DETAILS', margin + 2, y + 4.2);
    doc.text('ORDER DETAILS', margin + halfWidth + 2, y + 4.2);
    y += 6;

    // 3. CONTACT NAME/NUMBER | PO NO / DATE
    doc.rect(margin, y, halfWidth, 11);
    doc.rect(margin + halfWidth, y, halfWidth, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Contact Name :', margin + 2, y + 4.2);
    doc.text('Contact Number :-', margin + 2, y + 8.8);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.vendorContactName || '', margin + 26, y + 4.2);
    doc.text(this.docData.vendorContactPhone || '', margin + 28, y + 8.8);

    doc.setFont('helvetica', 'bold');
    doc.text(this.orderType === 'W.O' ? 'WO NO :' : 'PO NO :', margin + halfWidth + 2, y + 4.2);
    doc.text('DATE :', margin + halfWidth + 2, y + 8.8);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.poWoNo || '', margin + halfWidth + 18, y + 4.2);
    doc.text(this.docData.orderDate || '', margin + halfWidth + 18, y + 8.8);
    y += 11;

    // 4. VENDOR NAME & ADDRESS (Left) | GSTIN + BILLING ADDRESS + DELIVERY ADDRESS (Right)
    const addrBlockH = 44;
    doc.rect(margin, y, halfWidth, addrBlockH);
    doc.rect(margin + halfWidth, y, halfWidth, 6);
    doc.rect(margin + halfWidth, y + 6, halfWidth, 21);
    doc.rect(margin + halfWidth, y + 27, halfWidth, 17);

    // Left: Vendor Name & Address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Vendor Name & Address :', margin + 2, y + 4.5);
    doc.text(this.docData.vendorTitleLine || '', margin + 2, y + 11);
    doc.setFont('helvetica', 'normal');
    const vAddrLines = doc.splitTextToSize(this.docData.vendorAddress || '', halfWidth - 4);
    doc.text(vAddrLines.slice(0, 6), margin + 2, y + 15.5);

    // Right 1: Company GSTIN
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN :-  ${this.docData.companyGstin || '33AACCL5566B1ZT'}`, margin + halfWidth + 2, y + 4.2);

    // Right 2: Billing address
    doc.setFont('helvetica', 'bold');
    doc.text('Billing address', margin + halfWidth + 2, y + 10);
    doc.setFontSize(7.5);
    doc.text(this.docData.billingCompany || '', margin + halfWidth + 2, y + 14);
    doc.setFont('helvetica', 'normal');
    const billLines = doc.splitTextToSize(this.docData.billingAddress || '', halfWidth - 4);
    doc.text(billLines.slice(0, 4), margin + halfWidth + 2, y + 18);

    // Right 3: Delivery address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Delivery address :', margin + halfWidth + 2, y + 31);
    doc.setFontSize(7.5);
    doc.text(this.docData.deliveryTitleLine || '', margin + halfWidth + 2, y + 35);
    doc.setFont('helvetica', 'normal');
    const delivLines = doc.splitTextToSize(this.docData.deliveryAddress || '', halfWidth - 4);
    doc.text(delivLines.slice(0, 2), margin + halfWidth + 2, y + 39);
    y += addrBlockH;

    // 5. VENDOR GSTIN & PAN | CONTACT & PH. NO ROW
    doc.rect(margin, y, 16, 5.5);
    doc.rect(margin + 16, y, halfWidth - 16, 5.5);
    doc.rect(margin + halfWidth, y, halfWidth, 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('GSTIN :', margin + 2, y + 3.8);
    doc.text(this.docData.vendorGstin || '', margin + 18, y + 3.8);
    y += 5.5;

    doc.rect(margin, y, 16, 5.5);
    doc.rect(margin + 16, y, halfWidth - 16, 5.5);
    doc.rect(margin + halfWidth, y, 16, 5.5);
    doc.rect(margin + halfWidth + 16, y, 32, 5.5);
    doc.rect(margin + halfWidth + 48, y, 15, 5.5);
    doc.rect(margin + halfWidth + 63, y, halfWidth - 63, 5.5);

    doc.text('PAN :', margin + 2, y + 3.8);
    doc.text(this.docData.vendorPan || '', margin + 18, y + 3.8);
    doc.text('Contact :', margin + halfWidth + 1.5, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.siteContactName || '', margin + halfWidth + 17.5, y + 3.8);
    doc.setFont('helvetica', 'bold');
    doc.text('Ph. No :', margin + halfWidth + 49.5, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.siteContactPhone || '', margin + halfWidth + 64.5, y + 3.8);
    y += 5.5;

    // 6. ITEMS TABLE USING AUTOTABLE
    const itemRows: any[] = this.docData.items.map((it, idx) => [
      idx + 1,
      it.description || '',
      it.unit || '',
      it.qty || 0,
      Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      `${it.gstPct || 0}%`,
      Number(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['S.No', 'Descriptions', 'Unit', 'Qty', 'Rate', 'GST %', 'Amount']],
      body: itemRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 83, halign: 'left' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 23, halign: 'right' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 28, halign: 'right' }
      }
    });

    y = (doc as any).lastAutoTable.finalY;

    // 7. SUB TOTAL / CGST / SGST / GRAND TOTAL BLOCK
    const leftBoxW = 95;
    const rightLabelW = 67;
    const rightValW = 28;
    const rowH = 5.5;

    const summaryRows = this.isMixedGst
      ? [
          { label: 'Sub Total :', val: this.docData.subTotal },
          { label: 'CGST 2.5% :', val: this.docData.cgst2_5 },
          { label: 'SGST 2.5% :', val: this.docData.sgst2_5 },
          { label: 'CGST 9% :', val: this.docData.cgst9 },
          { label: 'SGST 9% :', val: this.docData.sgst9 },
          { label: 'Grand Total :', val: this.docData.grandTotal }
        ]
      : [
          { label: 'Sub Total :', val: this.docData.subTotal },
          { label: 'CGST :', val: this.docData.cgst },
          { label: 'SGST :', val: this.docData.sgst },
          { label: 'Grand Total :', val: this.docData.grandTotal }
        ];

    doc.rect(margin, y, leftBoxW, rowH * summaryRows.length);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Total Amount in words :', margin + 2, y + rowH * summaryRows.length - 1.5);

    summaryRows.forEach((sr, i) => {
      const ry = y + i * rowH;
      doc.rect(margin + leftBoxW, ry, rightLabelW, rowH);
      doc.rect(margin + leftBoxW + rightLabelW, ry, rightValW, rowH);
      doc.setFont('helvetica', 'bold');
      doc.text(sr.label, margin + leftBoxW + rightLabelW - 2, ry + 3.8, { align: 'right' });
      const formattedVal = Number(sr.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      doc.text(formattedVal, margin + contentWidth - 2, ry + 3.8, { align: 'right' });
    });
    y += rowH * summaryRows.length;

    // 8. AMOUNT IN WORDS BANNER
    doc.rect(margin, y, contentWidth, 6.5);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(8.5);
    doc.text(this.docData.amountInWords || 'Rupees Zero Only', pageWidth / 2, y + 4.5, { align: 'center' });
    y += 6.5;

    // 9. TERMS & CONDITIONS TABLE ON PAGE 1
    doc.rect(margin, y, contentWidth, 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TERMS & CONDITIONS', margin + 2, y + 4.2);
    const tcWidth = doc.getTextWidth('TERMS & CONDITIONS');
    doc.line(margin + 2, y + 4.6, margin + 2 + tcWidth, y + 4.6);
    y += 6;

    for (const term of this.docData.termsTable) {
      doc.rect(margin, y, leftBoxW, 5.2);
      doc.rect(margin + leftBoxW, y, contentWidth - leftBoxW, 5.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(term.label || '', margin + 2, y + 3.7);
      doc.text(term.value || '', margin + leftBoxW + 2, y + 3.7);
      y += 5.2;
    }

    // 10. SIGNATURE BLOCK
    const sigH = 24;
    doc.rect(margin, y, leftBoxW, sigH);
    doc.rect(margin + leftBoxW, y, contentWidth - leftBoxW, sigH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(this.docData.forCompanySignText || 'For SATHLOKHAR SYNERGYS E&C GLOBAL LTD,', margin + 2, y + 4.5);
    doc.text('Suppliers Signature with Seal', margin + leftBoxW + 2, y + 4.5);
    doc.text(this.docData.supplierSignName || '', margin + leftBoxW + 2, y + sigH - 2.5);
    y += sigH;

    // Outer thick border around Page 1 table
    doc.setLineWidth(0.6);
    doc.rect(margin, topStartY, contentWidth, y - topStartY);

    // 11. PAGES 2..N: DETAILED TERMS & CONDITIONS FROM WORD (.docx)
    if (this.docData.termsPages && this.docData.termsPages.length > 0) {
      this.docData.termsPages.forEach((pageContent, idx) => {
        if (!pageContent || !pageContent.trim()) return;
        doc.addPage();
        let ty = addLetterheadHeaderAndFooter(idx + 2);

        doc.setLineWidth(0.4);
        doc.rect(margin, ty, contentWidth, pageHeight - ty - 18);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(`${this.docData.documentTitle} - TERMS & CONDITIONS (${this.docData.poWoNo})`, margin + 4, ty + 7);
        doc.line(margin, ty + 10, margin + contentWidth, ty + 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const wrappedLines = doc.splitTextToSize(pageContent.trim(), contentWidth - 8);
        doc.text(wrappedLines, margin + 4, ty + 16);
      });
    }

    const safeFileName = (this.docData.poWoNo || 'PO_WO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    window.open(blobUrl, '_blank');
    doc.save(`${safeFileName}.pdf`);
  }
}
