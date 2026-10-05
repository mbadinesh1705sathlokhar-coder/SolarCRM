import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OfficeVendor } from './office.service';

export interface VendorPoWo {
  id?: number;
  vendorId: number;
  vendorName?: string;
  date: string;
  poWoNumber: string;
  orderValue: number;
  materialDescription?: string;
  clientName?: string;
  orderType?: string;
  generatedBy?: string;
  billVoucherStatus?: string;
  invoiceNo?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorPayment {
  id?: number;
  vendorId: number;
  vendorName?: string;
  date: string;
  amount: number;
  urnNumber?: string;
  paymentMode?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorWithLedgerData {
  vendor: OfficeVendor & { description?: string };
  poWos: VendorPoWo[];
  payments: VendorPayment[];
  syncedExpenses: any[];
  totalCr: number;
  totalDr: number;
  dueToPay: number;
}

@Injectable({
  providedIn: 'root'
})
export class VendorLedgerService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/vendors';

  // Vendor CRUD
  getVendors(): Observable<{ success: boolean; data: (OfficeVendor & { description?: string })[] }> {
    return this.http.get<{ success: boolean; data: (OfficeVendor & { description?: string })[] }>(this.apiUrl);
  }

  getVendorWithLedger(id: number): Observable<{ success: boolean; data: VendorWithLedgerData }> {
    return this.http.get<{ success: boolean; data: VendorWithLedgerData }>(`${this.apiUrl}/${id}`);
  }

  createVendor(vendor: Partial<OfficeVendor & { description?: string }>): Observable<{ success: boolean; data: OfficeVendor }> {
    return this.http.post<{ success: boolean; data: OfficeVendor }>(this.apiUrl, vendor);
  }

  updateVendor(id: number, vendor: Partial<OfficeVendor & { description?: string }>): Observable<{ success: boolean; data: OfficeVendor }> {
    return this.http.put<{ success: boolean; data: OfficeVendor }>(`${this.apiUrl}/${id}`, vendor);
  }

  deleteVendor(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  // PO / WO CRUD
  getPoWos(vendorId: number): Observable<{ success: boolean; data: VendorPoWo[] }> {
    return this.http.get<{ success: boolean; data: VendorPoWo[] }>(`${this.apiUrl}/${vendorId}/po-wo`);
  }

  createPoWo(vendorId: number, data: Partial<VendorPoWo>): Observable<{ success: boolean; data: VendorPoWo }> {
    return this.http.post<{ success: boolean; data: VendorPoWo }>(`${this.apiUrl}/${vendorId}/po-wo`, data);
  }

  updatePoWo(vendorId: number, poWoId: number, data: Partial<VendorPoWo>): Observable<{ success: boolean; data: VendorPoWo }> {
    return this.http.put<{ success: boolean; data: VendorPoWo }>(`${this.apiUrl}/${vendorId}/po-wo/${poWoId}`, data);
  }

  deletePoWo(vendorId: number, poWoId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${vendorId}/po-wo/${poWoId}`);
  }

  // Payments Made (DR) CRUD
  getPayments(vendorId: number): Observable<{ success: boolean; data: VendorPayment[] }> {
    return this.http.get<{ success: boolean; data: VendorPayment[] }>(`${this.apiUrl}/${vendorId}/payments`);
  }

  createPayment(vendorId: number, data: Partial<VendorPayment>): Observable<{ success: boolean; data: VendorPayment }> {
    return this.http.post<{ success: boolean; data: VendorPayment }>(`${this.apiUrl}/${vendorId}/payments`, data);
  }

  updatePayment(vendorId: number, paymentId: number, data: Partial<VendorPayment>): Observable<{ success: boolean; data: VendorPayment }> {
    return this.http.put<{ success: boolean; data: VendorPayment }>(`${this.apiUrl}/${vendorId}/payments/${paymentId}`, data);
  }

  deletePayment(vendorId: number, paymentId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${vendorId}/payments/${paymentId}`);
  }

  clearAllVendors(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/all`);
  }
}
