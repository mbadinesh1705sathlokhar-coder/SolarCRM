import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SitePlanItem {
  id?: number;
  date: string;
  time?: string;
  clientName: string;
  engineerName: string;
  description: string;
  assignedBy?: string;
  opportunityId?: number;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SitePlanService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/site-plans';

  getSitePlans(userName?: string, isAdmin?: boolean): Observable<{ success: boolean; data: SitePlanItem[] }> {
    let params = new HttpParams();
    if (userName) params = params.set('userName', userName);
    if (isAdmin !== undefined) params = params.set('isAdmin', String(isAdmin));
    return this.http.get<{ success: boolean; data: SitePlanItem[] }>(this.apiUrl, { params });
  }

  createSitePlan(data: Partial<SitePlanItem>): Observable<{ success: boolean; data: SitePlanItem }> {
    return this.http.post<{ success: boolean; data: SitePlanItem }>(this.apiUrl, data);
  }

  updateSitePlan(id: number, data: Partial<SitePlanItem>): Observable<{ success: boolean; data: SitePlanItem }> {
    return this.http.put<{ success: boolean; data: SitePlanItem }>(this.apiUrl + '/' + id, data);
  }

  deleteSitePlan(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(this.apiUrl + '/' + id);
  }
}
