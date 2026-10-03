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

/**
 * Automatically computes warehouse stock status based on material specifications:
 * - Cables (unit in Meter or name contains cable): Low Stock if <= 100
 * - Lighting Arrestor (contains 'arrestor' / 'lighting'): Low Stock if < 3
 * - Inverter (contains 'inverter'): Low Stock if < 2
 * - Chamber (contains 'chamber'): Low Stock if <= 6
 * - DB Boxes set (contains 'db box', 'db boxes', 'acdb', 'dcdb'): Low Stock if < 2
 * - Lugs (contains 'lug'): Low Stock if <= 10
 * - Other items: Low Stock if <= 5
 * - Zero or negative quantity: Out of Stock
 */
export function computeStockStatus(
  materialName?: string,
  unit?: string,
  inStock?: number | string | null
): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  const stock = typeof inStock === 'number' ? inStock : (parseFloat(String(inStock ?? 0)) || 0);
  if (stock <= 0) {
    return 'Out of Stock';
  }

  const name = (materialName || '').toLowerCase().trim();
  const u = (unit || '').toLowerCase().trim();

  // 1. Cables: if unit is meter or name has cable and unit is meter: <= 100 is Low Stock
  if (u.includes('meter') || u.includes('mtr') || u === 'm') {
    return stock <= 100 ? 'Low Stock' : 'In Stock';
  }
  if (name.includes('cable')) {
    if (u.includes('meter') || u.includes('mtr') || u === 'm' || !u) {
      return stock <= 100 ? 'Low Stock' : 'In Stock';
    }
    return stock <= 5 ? 'Low Stock' : 'In Stock';
  }

  // 2. Lighting Arrestor: below 3 (< 3) is Low Stock
  if (name.includes('arrestor') || name.includes('arrester')) {
    return stock < 3 ? 'Low Stock' : 'In Stock';
  }

  // 3. Inverter: less than 2 (< 2) is Low Stock
  if (name.includes('inverter')) {
    return stock < 2 ? 'Low Stock' : 'In Stock';
  }

  // 4. Chamber: 6 or less (<= 6) is Low Stock
  if (name.includes('chamber')) {
    return stock <= 6 ? 'Low Stock' : 'In Stock';
  }

  // 5. DB Boxes set: less than 2 (< 2) is Low Stock
  if (
    name.includes('db box') ||
    name.includes('db boxes') ||
    name.includes('acdb') ||
    name.includes('dcdb') ||
    name.includes('distribution box')
  ) {
    return stock < 2 ? 'Low Stock' : 'In Stock';
  }

  // 6. Lugs: 10 or less (<= 10) is Low Stock
  if (name.includes('lug')) {
    return stock <= 10 ? 'Low Stock' : 'In Stock';
  }

  // 7. Default for other materials: 5 or less is Low Stock
  return stock <= 5 ? 'Low Stock' : 'In Stock';
}

/**
 * Returns human-readable threshold rule description for the given material and unit
 */
export function getStockThresholdDescription(materialName?: string, unit?: string): string {
  const name = (materialName || '').toLowerCase().trim();
  const u = (unit || '').toLowerCase().trim();

  if (u.includes('meter') || u.includes('mtr') || u === 'm' || name.includes('cable')) {
    return 'Low Stock threshold: ≤ 100 Meters';
  }
  if (name.includes('arrestor') || name.includes('arrester')) {
    return 'Low Stock threshold: < 3 Nos';
  }
  if (name.includes('inverter')) {
    return 'Low Stock threshold: < 2 Nos';
  }
  if (name.includes('chamber')) {
    return 'Low Stock threshold: ≤ 6 Nos';
  }
  if (
    name.includes('db box') ||
    name.includes('db boxes') ||
    name.includes('acdb') ||
    name.includes('dcdb') ||
    name.includes('distribution box')
  ) {
    return 'Low Stock threshold: < 2 Sets/Nos';
  }
  if (name.includes('lug')) {
    return 'Low Stock threshold: ≤ 10 Nos';
  }
  return 'Default Low Stock threshold: ≤ 5';
}

export interface GatePassItem {
  id?: number;
  gatePassId?: number;
  dispatchDate?: string;
  materialName: string;
  unit: string;
  quantity: number;
  rate?: number;
  vendorName?: string;
  amount?: number;
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
  totalAmount?: number;
  transportCost?: number;
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
