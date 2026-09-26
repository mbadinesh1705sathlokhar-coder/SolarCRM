import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Campaign {
  id?: number;
  campaignDate: string;
  campaignName: string;
  venue: string;
  leadCount?: number;
  expenseCount?: number;
  totalExpenses?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CampaignLead {
  id?: number;
  campaignId: number;
  leadDate: string;
  leadName: string;
  leadContact?: string;
  leadEmail?: string;
  leadLocation?: string;
  leadStatus?: string;
  leadHandler?: string;
  leadRemarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CampaignExpense {
  id?: number;
  campaignId: number;
  campaignName?: string;
  venue?: string;
  expenseDate: string;
  amount: number;
  purpose: string;
  paidBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CampaignService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/campaigns';

  private cachedCampaigns: Campaign[] = [];

  getCachedCampaigns(): Campaign[] {
    return [...this.cachedCampaigns];
  }

  getCampaigns(): Observable<{ success: boolean; data: Campaign[] }> {
    return this.http.get<{ success: boolean; data: Campaign[] }>(this.apiUrl).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedCampaigns = [...res.data];
        }
      })
    );
  }

  createCampaign(campaign: Partial<Campaign>): Observable<{ success: boolean; data: Campaign }> {
    return this.http.post<{ success: boolean; data: Campaign }>(this.apiUrl, campaign).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedCampaigns.unshift({ ...res.data, leadCount: 0, expenseCount: 0, totalExpenses: 0 });
        }
      })
    );
  }

  updateCampaign(id: number, campaign: Partial<Campaign>): Observable<{ success: boolean; data: Campaign }> {
    return this.http.put<{ success: boolean; data: Campaign }>(`${this.apiUrl}/${id}`, campaign).pipe(
      tap(res => {
        if (res.success && res.data) {
          const idx = this.cachedCampaigns.findIndex(c => c.id === id);
          if (idx !== -1) {
            this.cachedCampaigns[idx] = { ...this.cachedCampaigns[idx], ...res.data };
          }
        }
      })
    );
  }

  deleteCampaign(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(res => {
        if (res.success) {
          this.cachedCampaigns = this.cachedCampaigns.filter(c => c.id !== id);
        }
      })
    );
  }

  // --- LEADS ---
  getCampaignLeads(campaignId: number): Observable<{ success: boolean; data: CampaignLead[] }> {
    return this.http.get<{ success: boolean; data: CampaignLead[] }>(`${this.apiUrl}/${campaignId}/leads`);
  }

  createCampaignLead(campaignId: number, lead: Partial<CampaignLead>): Observable<{ success: boolean; data: CampaignLead; transferredToSales?: boolean; salesLead?: any; wasExisting?: boolean }> {
    return this.http.post<{ success: boolean; data: CampaignLead; transferredToSales?: boolean; salesLead?: any; wasExisting?: boolean }>(`${this.apiUrl}/${campaignId}/leads`, lead);
  }

  updateCampaignLead(id: number, lead: Partial<CampaignLead>): Observable<{ success: boolean; data: CampaignLead; transferredToSales?: boolean; salesLead?: any; wasExisting?: boolean }> {
    return this.http.put<{ success: boolean; data: CampaignLead; transferredToSales?: boolean; salesLead?: any; wasExisting?: boolean }>(`${this.apiUrl}/leads/${id}`, lead);
  }

  deleteCampaignLead(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/leads/${id}`);
  }

  // --- EXPENSES ---
  getAllExpenses(): Observable<{ success: boolean; data: CampaignExpense[] }> {
    return this.http.get<{ success: boolean; data: CampaignExpense[] }>(`${this.apiUrl}/all-expenses`);
  }

  createExpoExpense(expense: Partial<CampaignExpense>): Observable<{ success: boolean; data: CampaignExpense }> {
    return this.http.post<{ success: boolean; data: CampaignExpense }>(`${this.apiUrl}/all-expenses`, expense);
  }

  getCampaignExpenses(campaignId: number): Observable<{ success: boolean; data: CampaignExpense[] }> {
    return this.http.get<{ success: boolean; data: CampaignExpense[] }>(`${this.apiUrl}/${campaignId}/expenses`);
  }

  createCampaignExpense(campaignId: number, expense: Partial<CampaignExpense>): Observable<{ success: boolean; data: CampaignExpense }> {
    return this.http.post<{ success: boolean; data: CampaignExpense }>(`${this.apiUrl}/${campaignId}/expenses`, expense);
  }

  updateCampaignExpense(id: number, expense: Partial<CampaignExpense>): Observable<{ success: boolean; data: CampaignExpense }> {
    return this.http.put<{ success: boolean; data: CampaignExpense }>(`${this.apiUrl}/expenses/${id}`, expense);
  }

  deleteCampaignExpense(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/expenses/${id}`);
  }
}
