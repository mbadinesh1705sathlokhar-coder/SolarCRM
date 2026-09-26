import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export const INVENTORY_MATERIALS: string[] = [
  'Cable Tray Materials',
  'Cables',
  'Civil Work Labour',
  'Consumables',
  'DB Boxes',
  'Earthing Materials',
  'Expo / Event Expenses',
  'Labour/Manpower',
  'Lead Acid Batteries',
  'Lightning Arrestors',
  'Lithium Batteries',
  'Material Transport',
  'Panles Cleaning Liquid',
  'Petrol Cliam',
  'Rental Tools',
  'Solar CEIG Works',
  'Solar I&C Works',
  'Solar Inverters',
  'Solar Meters',
  'Solar MMS',
  'Solar Panels',
  'TATA SPG Package',
  'Walkway / Hand Rails',
  'Zero Export Device',
  'Tools Asset',
  'Safety Certificates'
];

export interface IndentMaterial {
  id?: number;
  indentId?: number;
  materialName: string;
  quantity: number;
  unit: string;
  status: 'Ready to issue' | 'Requested Vendor' | 'Pending' | string;
  poWo: boolean;
}

export interface Indent {
  id?: number;
  indentDate: string;
  indentNo: string;
  siteEngineer: string;
  clientName: string;
  materials?: IndentMaterial[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseMaterial {
  id?: number;
  materialName: string;
  description?: string;
  unit: string;
  inStock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GatePassItem {
  id?: number;
  gatePassId?: number;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface GatePass {
  id?: number;
  gatePassDate: string;
  descriptions?: string;
  unit?: string;
  quantity?: number;
  clientName: string;
  siteEngineer: string;
  remarks?: string;
  items?: GatePassItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id?: number;
  orderDate: string;
  material: string;
  clientLocation: string;
  quantity: number;
  unit: string;
  vendorName?: string;
  procurementStatus: 'Yet to Start' | 'Requested Vendor' | 'PO Processed' | 'Payment In Process' | 'Materials on Route' | string;
  totalAmount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartSummary {
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  activeSitesCount: number;
  assignedVendorsCount: number;
  statusCounts: Record<string, number>;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:2000/api/inventory';

  // 1. INDENTS
  getIndents(): Observable<{ success: boolean; data: Indent[] }> {
    return this.http.get<{ success: boolean; data: Indent[] }>(`${this.apiUrl}/indents`);
  }

  getIndent(id: number): Observable<{ success: boolean; data: Indent }> {
    return this.http.get<{ success: boolean; data: Indent }>(`${this.apiUrl}/indents/${id}`);
  }

  createIndent(indent: Partial<Indent>): Observable<{ success: boolean; data: Indent }> {
    return this.http.post<{ success: boolean; data: Indent }>(`${this.apiUrl}/indents`, indent);
  }

  updateIndent(id: number, indent: Partial<Indent>): Observable<{ success: boolean; data: Indent }> {
    return this.http.put<{ success: boolean; data: Indent }>(`${this.apiUrl}/indents/${id}`, indent);
  }

  deleteIndent(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/indents/${id}`);
  }

  // 2. WAREHOUSE
  getWarehouseMaterials(): Observable<{ success: boolean; data: WarehouseMaterial[] }> {
    return this.http.get<{ success: boolean; data: WarehouseMaterial[] }>(`${this.apiUrl}/warehouse`);
  }

  createWarehouseMaterial(mat: Partial<WarehouseMaterial>): Observable<{ success: boolean; data: WarehouseMaterial }> {
    return this.http.post<{ success: boolean; data: WarehouseMaterial }>(`${this.apiUrl}/warehouse`, mat);
  }

  updateWarehouseMaterial(id: number, mat: Partial<WarehouseMaterial>): Observable<{ success: boolean; data: WarehouseMaterial }> {
    return this.http.put<{ success: boolean; data: WarehouseMaterial }>(`${this.apiUrl}/warehouse/${id}`, mat);
  }

  deleteWarehouseMaterial(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/warehouse/${id}`);
  }

  // 3. GATE PASS
  getGatePasses(): Observable<{ success: boolean; data: GatePass[] }> {
    return this.http.get<{ success: boolean; data: GatePass[] }>(`${this.apiUrl}/gate-pass`);
  }

  createGatePass(gp: Partial<GatePass>): Observable<{ success: boolean; data: GatePass }> {
    return this.http.post<{ success: boolean; data: GatePass }>(`${this.apiUrl}/gate-pass`, gp);
  }

  updateGatePass(id: number, gp: Partial<GatePass>): Observable<{ success: boolean; data: GatePass }> {
    return this.http.put<{ success: boolean; data: GatePass }>(`${this.apiUrl}/gate-pass/${id}`, gp);
  }

  deleteGatePass(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/gate-pass/${id}`);
  }

  // 4. CART
  getCartItems(): Observable<{ success: boolean; data: CartItem[]; summary: CartSummary }> {
    return this.http.get<{ success: boolean; data: CartItem[]; summary: CartSummary }>(`${this.apiUrl}/cart`);
  }

  createCartItem(payload: Partial<CartItem> | { items: any[]; orderDate?: string; vendorName?: string; procurementStatus?: string }): Observable<{ success: boolean; data?: any; count?: number }> {
    return this.http.post<{ success: boolean; data?: any; count?: number }>(`${this.apiUrl}/cart`, payload);
  }

  updateCartItem(id: number, item: Partial<CartItem>): Observable<{ success: boolean; data: CartItem }> {
    return this.http.put<{ success: boolean; data: CartItem }>(`${this.apiUrl}/cart/${id}`, item);
  }

  deleteCartItem(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/cart/${id}`);
  }
}
