import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface MasterListItem {
  id?: number;
  listId?: number;
  itemValue: string;
  sortOrder?: number;
}

export interface MasterList {
  id?: number;
  title: string;
  category?: string;
  description?: string;
  items: string[];
  itemRecords?: MasterListItem[];
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MasterListService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/master-lists';

  private cachedLists: MasterList[] = [];

  getCachedLists(): MasterList[] {
    return [...this.cachedLists];
  }

  getCachedList(title: string): MasterList | undefined {
    return this.cachedLists.find(l => l.title.toLowerCase().trim() === title.toLowerCase().trim());
  }

  getItemsByTitle(title: string, fallback: string[] = []): string[] {
    const list = this.getCachedList(title);
    if (list && list.items && list.items.length > 0) {
      return [...list.items];
    }
    return [...fallback];
  }

  getAllLists(): Observable<{ success: boolean; data: MasterList[] }> {
    return this.http.get<{ success: boolean; data: MasterList[] }>(this.apiUrl).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedLists = [...res.data];
        }
      })
    );
  }

  getList(idOrTitle: string | number): Observable<{ success: boolean; data: MasterList }> {
    return this.http.get<{ success: boolean; data: MasterList }>(`${this.apiUrl}/${encodeURIComponent(idOrTitle)}`);
  }

  createList(payload: { title: string; category?: string; description?: string; items?: string[] }): Observable<{ success: boolean; data: MasterList }> {
    return this.http.post<{ success: boolean; data: MasterList }>(this.apiUrl, payload).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedLists.push(res.data);
        }
      })
    );
  }

  updateList(id: number, payload: { title?: string; category?: string; description?: string; items?: string[] }): Observable<{ success: boolean; data: MasterList }> {
    return this.http.put<{ success: boolean; data: MasterList }>(`${this.apiUrl}/${id}`, payload).pipe(
      tap(res => {
        if (res.success && res.data) {
          const idx = this.cachedLists.findIndex(l => l.id === id);
          if (idx !== -1) {
            this.cachedLists[idx] = res.data;
          }
        }
      })
    );
  }

  deleteList(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(res => {
        if (res.success) {
          this.cachedLists = this.cachedLists.filter(l => l.id !== id);
        }
      })
    );
  }

  // --- BOM MATERIAL MASTER ENDPOINTS ---
  getBomMaterials(): Observable<{ success: boolean; data: any[]; grouped: { [key: string]: any[] } }> {
    return this.http.get<{ success: boolean; data: any[]; grouped: { [key: string]: any[] } }>('http://localhost:2000/api/bom-materials');
  }

  saveBomMaterialGroupSpecs(groupName: string, items: any[], groupGstPercent?: number): Observable<{ success: boolean; message: string; data: any[] }> {
    return this.http.post<{ success: boolean; message: string; data: any[] }>('http://localhost:2000/api/bom-materials/bulk-save', { groupName, items, groupGstPercent });
  }
}
