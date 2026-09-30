import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface ModuleAccess {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface EmployeeAccessPermissions {
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  sales?: ModuleAccess;
  finance?: ModuleAccess;
  activity?: ModuleAccess;
  inventory?: ModuleAccess;
  office?: ModuleAccess;
  navPages?: { [pageKey: string]: ModuleAccess };
}

export interface Employee {
  id?: number;
  name: string;
  designation: string;
  phoneNo: string;
  emailId: string;
  address: string;
  experience: string;
  username?: string;
  password?: string;
  role?: string;
  photo?: string;
  responsibility?: string;
  accessPermissions?: EmployeeAccessPermissions;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficeVendor {
  id?: number;
  vendorName: string;
  salesCoordinator: string;
  phoneNo: string;
  location: string;
  materialsSpec: string;
  creditDays: string;
  description?: string;
  materialRates?: { [material: string]: number } | string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfficeService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/office';

  private cachedEmployees: Employee[] = [];
  private cachedVendors: OfficeVendor[] = [];

  // --- EMPLOYEES ---
  getCachedEmployees(): Employee[] {
    return [...this.cachedEmployees];
  }

  getEmployees(): Observable<{ success: boolean; data: Employee[] }> {
    return this.http.get<{ success: boolean; data: Employee[] }>(`${this.apiUrl}/employees`).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedEmployees = [...res.data];
        }
      })
    );
  }

  getEmployee(id: number): Observable<{ success: boolean; data: Employee }> {
    return this.http.get<{ success: boolean; data: Employee }>(`${this.apiUrl}/employees/${id}`);
  }

  createEmployee(employee: Partial<Employee>): Observable<{ success: boolean; data: Employee }> {
    return this.http.post<{ success: boolean; data: Employee }>(`${this.apiUrl}/employees`, employee).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedEmployees.unshift(res.data);
        }
      })
    );
  }

  updateEmployee(id: number, employee: Partial<Employee>): Observable<{ success: boolean; data: Employee }> {
    return this.http.put<{ success: boolean; data: Employee }>(`${this.apiUrl}/employees/${id}`, employee).pipe(
      tap(res => {
        if (res.success && res.data) {
          const idx = this.cachedEmployees.findIndex(e => e.id === id);
          if (idx !== -1) {
            this.cachedEmployees[idx] = { ...this.cachedEmployees[idx], ...res.data };
          }
        }
      })
    );
  }

  deleteEmployee(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/employees/${id}`).pipe(
      tap(res => {
        if (res.success) {
          this.cachedEmployees = this.cachedEmployees.filter(e => e.id !== id);
        }
      })
    );
  }

  // --- VENDORS ---
  getCachedVendors(): OfficeVendor[] {
    return [...this.cachedVendors];
  }

  getVendors(): Observable<{ success: boolean; data: OfficeVendor[] }> {
    return this.http.get<{ success: boolean; data: OfficeVendor[] }>(`${this.apiUrl}/vendors`).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedVendors = [...res.data];
        }
      })
    );
  }

  createVendor(vendor: Partial<OfficeVendor>): Observable<{ success: boolean; data: OfficeVendor }> {
    return this.http.post<{ success: boolean; data: OfficeVendor }>(`${this.apiUrl}/vendors`, vendor).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.cachedVendors.unshift(res.data);
        }
      })
    );
  }

  updateVendor(id: number, vendor: Partial<OfficeVendor>): Observable<{ success: boolean; data: OfficeVendor }> {
    return this.http.put<{ success: boolean; data: OfficeVendor }>(`${this.apiUrl}/vendors/${id}`, vendor).pipe(
      tap(res => {
        if (res.success && res.data) {
          const idx = this.cachedVendors.findIndex(v => v.id === id);
          if (idx !== -1) {
            this.cachedVendors[idx] = { ...this.cachedVendors[idx], ...res.data };
          }
        }
      })
    );
  }

  deleteVendor(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/vendors/${id}`).pipe(
      tap(res => {
        if (res.success) {
          this.cachedVendors = this.cachedVendors.filter(v => v.id !== id);
        }
      })
    );
  }
}
