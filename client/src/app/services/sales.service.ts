import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { SalesLead } from '../models/sales.model';

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/sales';

  // In-memory cache for instant 0ms switching
  private cachedLeads: SalesLead[] | null = null;

  getCachedLeads(): SalesLead[] | null {
    return this.cachedLeads ? [...this.cachedLeads] : null;
  }

  setCachedLeads(leads: SalesLead[]): void {
    this.cachedLeads = [...leads];
  }

  clearCache(): void {
    this.cachedLeads = null;
  }


  getLeads(filters?: { status?: string; handler?: string; search?: string }): Observable<{ success: boolean; count: number; data: SalesLead[] }> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.handler) params = params.set('handler', filters.handler);
    if (filters?.search) params = params.set('search', filters.search);

    return this.http.get<{ success: boolean; count: number; data: SalesLead[] }>(`${this.apiUrl}/leads`, { params }).pipe(
      tap(res => {
        if (res.success && res.data && !filters?.status && !filters?.handler && !filters?.search) {
          this.cachedLeads = [...res.data];
        } else if (res.success && res.data && !this.cachedLeads) {
          this.cachedLeads = [...res.data];
        }
      })
    );
  }

  getOpportunities(filters?: { handler?: string; search?: string }): Observable<{ success: boolean; count: number; data: SalesLead[] }> {
    let params = new HttpParams();
    if (filters?.handler) params = params.set('handler', filters.handler);
    if (filters?.search) params = params.set('search', filters.search);

    return this.http.get<{ success: boolean; count: number; data: SalesLead[] }>(`${this.apiUrl}/opportunities`, { params });
  }

  getNextLeadId(): Observable<{ success: boolean; nextLeadId: string }> {
    return this.http.get<{ success: boolean; nextLeadId: string }>(`${this.apiUrl}/leads/next-id`);
  }

  createLead(lead: Partial<SalesLead>): Observable<{ success: boolean; message: string; data: SalesLead }> {
    return this.http.post<{ success: boolean; message: string; data: SalesLead }>(`${this.apiUrl}/leads`, lead).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedLeads) {
          this.cachedLeads = [res.data, ...this.cachedLeads];
        }
      })
    );
  }

  updateLead(id: number, lead: Partial<SalesLead>): Observable<{ success: boolean; message: string; data: SalesLead }> {
    return this.http.put<{ success: boolean; message: string; data: SalesLead }>(`${this.apiUrl}/leads/${id}`, lead).pipe(
      tap(res => {
        if (res.success && res.data && this.cachedLeads) {
          const idx = this.cachedLeads.findIndex(l => l.id === id);
          if (idx !== -1) {
            this.cachedLeads[idx] = res.data;
          }
        }
      })
    );
  }

  deleteLead(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/leads/${id}`).pipe(
      tap(res => {
        if (res.success && this.cachedLeads) {
          this.cachedLeads = this.cachedLeads.filter(l => l.id !== id);
        }
      })
    );
  }
}
