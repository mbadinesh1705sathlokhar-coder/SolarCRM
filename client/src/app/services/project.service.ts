import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Project, SummaryMetrics, ClientPayment, SiteExpense } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/projects';
  private ledgerUrl = 'http://localhost:2000/api/ledgers';

  // In-memory cache for instant 0ms tab switching
  private cachedProjects: Project[] | null = null;
  private cachedMetrics: SummaryMetrics | null = null;
  private cachedPayments: ClientPayment[] | null = null;
  private cachedExpenses: SiteExpense[] | null = null;

  getCachedProjects(): Project[] | null {
    return this.cachedProjects ? [...this.cachedProjects] : null;
  }

  getCachedMetrics(): SummaryMetrics | null {
    return this.cachedMetrics ? { ...this.cachedMetrics } : null;
  }

  getCachedPayments(): ClientPayment[] | null {
    return this.cachedPayments ? [...this.cachedPayments] : null;
  }

  getCachedExpenses(): SiteExpense[] | null {
    return this.cachedExpenses ? [...this.cachedExpenses] : null;
  }

  getProjects(filters?: { search?: string; siteType?: string; systemType?: string; clientType?: string; orderBy?: string }): Observable<{ success: boolean; count: number; data: Project[] }> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.siteType) params = params.set('siteType', filters.siteType);
    if (filters?.systemType) params = params.set('systemType', filters.systemType);
    if (filters?.clientType) params = params.set('clientType', filters.clientType);
    if (filters?.orderBy) params = params.set('orderBy', filters.orderBy);

    return this.http.get<{ success: boolean; count: number; data: Project[] }>(this.apiUrl, { params }).pipe(
      tap(res => {
        if (res.success && res.data) {
          const clientProjects = res.data.filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE' && !(p.clientName || '').toLowerCase().includes('warehouse'));
          res.data = clientProjects;
          res.count = clientProjects.length;
          if (!filters?.search && !filters?.siteType && !filters?.systemType && !filters?.clientType && !filters?.orderBy) {
            this.cachedProjects = [...clientProjects];
          } else if (!this.cachedProjects) {
            this.cachedProjects = [...clientProjects];
          }
        }
      })
    );
  }

  getProjectById(id: number): Observable<{ success: boolean; data: Project }> {
    return this.http.get<{ success: boolean; data: Project }>(`${this.apiUrl}/${id}`);
  }

  createProject(project: Partial<Project>): Observable<{ success: boolean; message: string; data: Project }> {
    return this.http.post<{ success: boolean; message: string; data: Project }>(this.apiUrl, project).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedProjects) {
          this.cachedProjects = [res.data, ...this.cachedProjects];
        }
      })
    );
  }

  updateProject(id: number, project: Partial<Project>): Observable<{ success: boolean; message: string; data: Project }> {
    return this.http.put<{ success: boolean; message: string; data: Project }>(`${this.apiUrl}/${id}`, project).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedProjects) {
          const idx = this.cachedProjects.findIndex(p => p.id === id);
          if (idx !== -1) {
            this.cachedProjects[idx] = res.data;
          }
        }
      })
    );
  }

  toggleMilestone(id: number, field: string, value: boolean): Observable<{ success: boolean; message: string; data: Project }> {
    return this.http.patch<{ success: boolean; message: string; data: Project }>(`${this.apiUrl}/${id}/milestone`, { field, value }).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedProjects) {
          const idx = this.cachedProjects.findIndex(p => p.id === id);
          if (idx !== -1) {
            this.cachedProjects[idx] = res.data;
          }
        }
      })
    );
  }

  deleteProject(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(res => {
        if (res.success && this.cachedProjects) {
          this.cachedProjects = this.cachedProjects.filter(p => p.id !== id);
        }
      })
    );
  }

  getSummaryMetrics(): Observable<{ success: boolean; data: SummaryMetrics }> {
    return this.http.get<{ success: boolean; data: SummaryMetrics }>(`${this.apiUrl}/summary/metrics`).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedMetrics = res.data;
        }
      })
    );
  }

  // --- CLIENT PAYMENT LEDGER ---
  getPayments(filters?: { search?: string; siteId?: string; paymentMode?: string; mop?: string }): Observable<{ success: boolean; count: number; totalAmount: number; data: ClientPayment[] }> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.siteId) params = params.set('siteId', filters.siteId);
    if (filters?.paymentMode) params = params.set('paymentMode', filters.paymentMode);
    if (filters?.mop) params = params.set('mop', filters.mop);

    return this.http.get<{ success: boolean; count: number; totalAmount: number; data: ClientPayment[] }>(`${this.ledgerUrl}/payments`, { params }).pipe(
      tap(res => {
        if (res.success && res.data) {
          if (!filters?.search && !filters?.siteId && !filters?.paymentMode && !filters?.mop) {
            this.cachedPayments = [...res.data];
          } else if (!this.cachedPayments) {
            this.cachedPayments = [...res.data];
          }
        }
      })
    );
  }

  createPayment(payment: Partial<ClientPayment>): Observable<{ success: boolean; message: string; data: ClientPayment; updatedProject?: any }> {
    return this.http.post<{ success: boolean; message: string; data: ClientPayment; updatedProject?: any }>(`${this.ledgerUrl}/payments`, payment).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedPayments) {
          this.cachedPayments = [res.data, ...this.cachedPayments];
        }
      })
    );
  }

  updatePayment(id: number, payment: Partial<ClientPayment>): Observable<{ success: boolean; message: string; data: ClientPayment; updatedProject?: any }> {
    return this.http.put<{ success: boolean; message: string; data: ClientPayment; updatedProject?: any }>(`${this.ledgerUrl}/payments/${id}`, payment).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedPayments) {
          const idx = this.cachedPayments.findIndex(p => p.id === id);
          if (idx !== -1) {
            this.cachedPayments[idx] = res.data;
          }
        }
      })
    );
  }

  deletePayment(id: number): Observable<{ success: boolean; message: string; updatedProject?: any }> {
    return this.http.delete<{ success: boolean; message: string; updatedProject?: any }>(`${this.ledgerUrl}/payments/${id}`).pipe(
      tap(res => {
        if (res.success && this.cachedPayments) {
          this.cachedPayments = this.cachedPayments.filter(p => p.id !== id);
        }
      })
    );
  }

  deletePaymentsBySite(siteId: string): Observable<{ success: boolean; message: string; updatedProject?: any }> {
    const cleanSiteId = encodeURIComponent(siteId.replace(/:/g, '').trim());
    return this.http.delete<{ success: boolean; message: string; updatedProject?: any }>(`${this.ledgerUrl}/payments/site/${cleanSiteId}`);
  }

  // --- SITE EXPENSE LEDGER ---
  getExpenses(filters?: {
    search?: string;
    siteId?: string;
    mop?: string;
    paymentThrough?: string;
    purpose?: string;
    paidBy?: string;
    billVoucher?: string;
    category?: string;
  }): Observable<{ success: boolean; count: number; totalAmount: number; data: SiteExpense[] }> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.siteId) params = params.set('siteId', filters.siteId);
    if (filters?.mop) params = params.set('mop', filters.mop);
    if (filters?.paymentThrough) params = params.set('paymentThrough', filters.paymentThrough);
    if (filters?.purpose) params = params.set('purpose', filters.purpose);
    if (filters?.paidBy) params = params.set('paidBy', filters.paidBy);
    if (filters?.billVoucher) params = params.set('billVoucher', filters.billVoucher);
    if (filters?.category) params = params.set('category', filters.category);

    return this.http.get<{ success: boolean; count: number; totalAmount: number; data: SiteExpense[] }>(`${this.ledgerUrl}/expenses`, { params }).pipe(
      tap(res => {
        if (res.success && res.data) {
          if (!filters?.search && !filters?.siteId && !filters?.mop && !filters?.paymentThrough && !filters?.purpose && !filters?.paidBy && !filters?.billVoucher && !filters?.category) {
            this.cachedExpenses = [...res.data];
          } else if (!this.cachedExpenses) {
            this.cachedExpenses = [...res.data];
          }
        }
      })
    );
  }

  createExpense(expense: Partial<SiteExpense>): Observable<{ success: boolean; message: string; data: SiteExpense; updatedProject?: any }> {
    return this.http.post<{ success: boolean; message: string; data: SiteExpense; updatedProject?: any }>(`${this.ledgerUrl}/expenses`, expense).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedExpenses) {
          this.cachedExpenses = [res.data, ...this.cachedExpenses];
        }
      })
    );
  }

  updateExpense(id: number, expense: Partial<SiteExpense>): Observable<{ success: boolean; message: string; data: SiteExpense; updatedProject?: any }> {
    return this.http.put<{ success: boolean; message: string; data: SiteExpense; updatedProject?: any }>(`${this.ledgerUrl}/expenses/${id}`, expense).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedExpenses) {
          const idx = this.cachedExpenses.findIndex(e => e.id === id);
          if (idx !== -1) {
            this.cachedExpenses[idx] = res.data;
          }
        }
      })
    );
  }

  deleteExpense(id: number): Observable<{ success: boolean; message: string; updatedProject?: any }> {
    return this.http.delete<{ success: boolean; message: string; updatedProject?: any }>(`${this.ledgerUrl}/expenses/${id}`).pipe(
      tap(res => {
        if (res.success && this.cachedExpenses) {
          this.cachedExpenses = this.cachedExpenses.filter(e => e.id !== id);
        }
      })
    );
  }

  deleteExpensesBySite(siteId: string): Observable<{ success: boolean; message: string; updatedProject?: any }> {
    const cleanSiteId = encodeURIComponent(siteId.replace(/:/g, '').trim());
    return this.http.delete<{ success: boolean; message: string; updatedProject?: any }>(`${this.ledgerUrl}/expenses/site/${cleanSiteId}`);
  }
}
