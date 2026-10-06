import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, of, map, catchError } from 'rxjs';
import { Employee, EmployeeAccessPermissions } from './office.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:2000/api/office';
  private readonly STORAGE_KEY = 'solar_auth_user';

  private currentUserSignal = signal<Employee | null>(this.getInitialUser());
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.currentUserSignal());
  readonly isAdmin = computed(() => {
    const u = this.currentUserSignal();
    if (!u) return false;
    const role = (u?.role || '').toLowerCase().trim();
    const user = (u?.username || u?.emailId || u?.name || '').toLowerCase().trim();
    return role === 'admin' || user.includes('mbadinesh1705') || user.includes('admin') || user.includes('dinesh');
  });

  readonly isPurchase = computed(() => {
    const u = this.currentUserSignal();
    if (!u) return false;
    const resp = (u?.responsibility || '').toLowerCase().trim();
    const desig = (u?.designation || '').toLowerCase().trim();
    const role = (u?.role || '').toLowerCase().trim();
    return resp.includes('purchase') || desig.includes('purchase') || role.includes('purchase');
  });

  readonly isPurchaseOrAdmin = computed(() => {
    return this.isAdmin() || this.isPurchase();
  });

  canViewPricing(): boolean {
    return this.isPurchaseOrAdmin();
  }

  readonly canManageAccess = computed(() => {
    const u = this.currentUserSignal();
    if (!u) return false;
    const role = (u?.role || '').toLowerCase().trim();
    const user = (u?.username || u?.emailId || u?.name || '').toLowerCase().trim();
    return role === 'admin' || user.includes('mbadinesh1705') || user.includes('admin') || user.includes('dinesh');
  });

  // Sidebar Toggle State (3 Stripes Hamburger Button)
  isSidebarVisible = signal<boolean>(true);

  toggleSidebar(): void {
    this.isSidebarVisible.update(v => !v);
  }

  // Profile Photo Preview & Upload Modal State
  isPhotoModalOpen = signal<boolean>(false);

  openPhotoModal(): void {
    this.isPhotoModalOpen.set(true);
  }

  closePhotoModal(): void {
    this.isPhotoModalOpen.set(false);
  }

  updateUserPhoto(photoDataUrl: string): Observable<any> {
    const user = this.currentUserSignal();
    if (!user || !user.id) return of(null);

    const updatedUser = { ...user, photo: photoDataUrl };
    return this.http.put<{ success: boolean; data: Employee }>(`${this.apiUrl}/employees/${user.id}`, { photo: photoDataUrl }).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.setCurrentUser(res.data);
        } else {
          this.setCurrentUser(updatedUser);
        }
      }),
      catchError(() => {
        this.setCurrentUser(updatedUser);
        return of(null);
      })
    );
  }

  constructor() {
    if (this.currentUserSignal()?.id) {
      this.refreshCurrentUser().subscribe();
    }
  }

  // --- GRANULAR NAV PAGE & MODULE PERMISSION CHECKERS ---
  canViewNav(pageKey: string): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;

    // Engineers can always view inventory pages
    const resp = (user.responsibility || '').toLowerCase();
    if (['indent', 'warehouse', 'gate-pass', 'cart'].includes(pageKey) && 
        resp.includes('engineer')) {
      return true;
    }

    // Purchase employees can view inventory and finance pages
    if (['indent', 'warehouse', 'gate-pass', 'cart', 'payment-ledger', 'expense-ledger', 'vendor-ledger', 'expo-expenses'].includes(pageKey) && 
        resp.includes('purchase')) {
      return true;
    }

    const perms = user.accessPermissions;
    if (!perms) return true;

    // 1. Check granular navPages mapping first
    if (perms.navPages && perms.navPages[pageKey] !== undefined) {
      return perms.navPages[pageKey].canView !== false;
    }

    // 2. Map nav page to parent module
    const moduleMap: { [k: string]: 'sales' | 'finance' | 'activity' | 'inventory' | 'office' } = {
      'campaigns': 'sales',
      'leads': 'sales',
      'oppurtunities': 'sales',
      'oppurtunity': 'sales',
      'opportunities': 'sales',
      'opportunity': 'sales',
      'awarded-sites': 'sales',
      'sales-dashboard': 'sales',
      'payment-ledger': 'finance',
      'expense-ledger': 'finance',
      'vendor-ledger': 'finance',
      'expo-expenses': 'finance',
      'meetings': 'activity',
      'calls': 'activity',
      'tasks': 'activity',
      'site-plan': 'activity',
      'indent': 'inventory',
      'warehouse': 'inventory',
      'gate-pass': 'inventory',
      'cart': 'inventory',
      'office-employees': 'office',
      'office-add-list': 'office',
      'employees': 'office',
      'add-list': 'office'
    };

    const mod = moduleMap[pageKey];
    if (mod) {
      return this.canViewModule(mod);
    }

    return perms.canView !== false;
  }

  canViewAnyNav(pageKeys: string[]): boolean {
    return pageKeys.some(k => this.canViewNav(k));
  }

  canViewModule(module: 'sales' | 'finance' | 'activity' | 'inventory' | 'office'): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;

    // Office module: check explicit office permissions or granular navPages
    if (module === 'office') {
      const perms = user.accessPermissions;
      if (!perms) return true;
      if (perms.office && perms.office.canView !== false) return true;
      if (perms.navPages) {
        return this.canViewNav('office-employees') || this.canViewNav('office-add-list');
      }
      return perms.canView !== false;
    }
    
    // Engineers can always view inventory (indents, warehouse available stock, etc.)
    const resp = (user.responsibility || '').toLowerCase();
    if (module === 'inventory' && resp.includes('engineer')) {
      return true;
    }

    // Purchase role can always view inventory and finance
    if ((module === 'inventory' || module === 'finance') && resp.includes('purchase')) {
      return true;
    }

    const perms = user.accessPermissions;
    if (!perms) return true;

    // Granular navPages check: if employee has configured navPages, allow module if at least one page is visible
    if (perms.navPages) {
      const moduleNavMap: Record<string, string[]> = {
        sales: ['campaigns', 'leads', 'oppurtunities', 'awarded-sites', 'sales-dashboard'],
        finance: ['payment-ledger', 'expense-ledger', 'vendor-ledger', 'expo-expenses'],
        activity: ['meetings', 'calls', 'tasks', 'site-plan'],
        inventory: ['indent', 'warehouse', 'gate-pass', 'cart'],
        office: ['office-employees', 'office-add-list']
      };
      const pages = moduleNavMap[module];
      if (pages && pages.length > 0) {
        return pages.some(p => this.canViewNav(p));
      }
    }

    if (perms[module]) {
      return perms[module]?.canView !== false;
    }
    return perms.canView !== false;
  }

  canAdd(target: string): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;

    if (['warehouse', 'warehouse-expenses', 'indent', 'gate-pass', 'cart', 'inventory'].includes(target)) {
      return true;
    }

    const perms = user.accessPermissions;
    if (!perms) return false;
    const key = target === 'opportunity' ? 'oppurtunities' : target;
    if (perms.navPages) {
      if (perms.navPages[key] !== undefined) return !!perms.navPages[key]?.canAdd;
      if (perms.navPages[target] !== undefined) return !!perms.navPages[target]?.canAdd;
    }
    if ((perms as any)[key] !== undefined) {
      return !!(perms as any)[key]?.canAdd;
    }
    if ((perms as any)[target] !== undefined) {
      return !!(perms as any)[target]?.canAdd;
    }
    const moduleMap: Record<string, string> = {
      'campaigns': 'sales',
      'leads': 'sales',
      'oppurtunities': 'sales',
      'opportunity': 'sales',
      'awarded-sites': 'sales',
      'payment-ledger': 'finance',
      'expense-ledger': 'finance',
      'warehouse-expenses': 'finance',
      'vendor-ledger': 'finance',
      'expo-expenses': 'finance',
      'meetings': 'activity',
      'calls': 'activity',
      'tasks': 'activity',
      'site-plan': 'activity',
      'indent': 'inventory',
      'warehouse': 'inventory',
      'gate-pass': 'inventory',
      'cart': 'inventory'
    };
    const parentMod = moduleMap[target] || moduleMap[key];
    if (parentMod && (perms as any)[parentMod] !== undefined) {
      return !!(perms as any)[parentMod]?.canAdd;
    }
    return !!perms.canAdd;
  }

  canEdit(target: string): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;

    if (['warehouse', 'warehouse-expenses', 'indent', 'gate-pass', 'cart', 'inventory'].includes(target)) {
      return true;
    }

    const perms = user.accessPermissions;
    if (!perms) return false;
    const key = target === 'opportunity' ? 'oppurtunities' : target;
    if (perms.navPages) {
      if (perms.navPages[key] !== undefined) return !!perms.navPages[key]?.canEdit;
      if (perms.navPages[target] !== undefined) return !!perms.navPages[target]?.canEdit;
    }
    if ((perms as any)[key] !== undefined) {
      return !!(perms as any)[key]?.canEdit;
    }
    if ((perms as any)[target] !== undefined) {
      return !!(perms as any)[target]?.canEdit;
    }
    const moduleMap: Record<string, string> = {
      'campaigns': 'sales',
      'leads': 'sales',
      'oppurtunities': 'sales',
      'opportunity': 'sales',
      'awarded-sites': 'sales',
      'payment-ledger': 'finance',
      'expense-ledger': 'finance',
      'warehouse-expenses': 'finance',
      'vendor-ledger': 'finance',
      'expo-expenses': 'finance',
      'meetings': 'activity',
      'calls': 'activity',
      'tasks': 'activity',
      'site-plan': 'activity',
      'indent': 'inventory',
      'warehouse': 'inventory',
      'gate-pass': 'inventory',
      'cart': 'inventory'
    };
    const parentMod = moduleMap[target] || moduleMap[key];
    if (parentMod && (perms as any)[parentMod] !== undefined) {
      return !!(perms as any)[parentMod]?.canEdit;
    }
    return !!perms.canEdit;
  }

  canDelete(target: string): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;

    if (['warehouse', 'warehouse-expenses', 'indent', 'gate-pass', 'cart', 'inventory'].includes(target)) {
      return true;
    }

    const perms = user.accessPermissions;
    if (!perms) return false;
    const key = target === 'opportunity' ? 'oppurtunities' : target;
    if (perms.navPages) {
      if (perms.navPages[key] !== undefined) return !!perms.navPages[key]?.canDelete;
      if (perms.navPages[target] !== undefined) return !!perms.navPages[target]?.canDelete;
    }
    if ((perms as any)[key] !== undefined) {
      return !!(perms as any)[key]?.canDelete;
    }
    if ((perms as any)[target] !== undefined) {
      return !!(perms as any)[target]?.canDelete;
    }
    const moduleMap: Record<string, string> = {
      'campaigns': 'sales',
      'leads': 'sales',
      'oppurtunities': 'sales',
      'opportunity': 'sales',
      'awarded-sites': 'sales',
      'payment-ledger': 'finance',
      'expense-ledger': 'finance',
      'warehouse-expenses': 'finance',
      'vendor-ledger': 'finance',
      'expo-expenses': 'finance',
      'meetings': 'activity',
      'calls': 'activity',
      'tasks': 'activity',
      'site-plan': 'activity',
      'indent': 'inventory',
      'warehouse': 'inventory',
      'gate-pass': 'inventory',
      'cart': 'inventory'
    };
    const parentMod = moduleMap[target] || moduleMap[key];
    if (parentMod && (perms as any)[parentMod] !== undefined) {
      return !!(perms as any)[parentMod]?.canDelete;
    }
    return !!perms.canDelete;
  }

  refreshCurrentUser(): Observable<Employee | null> {
    const user = this.currentUserSignal();
    if (!user || !user.id) return of(null);
    return this.http.get<{ success: boolean; data: Employee }>(`${this.apiUrl}/employees/${user.id}`).pipe(
      map(res => {
        if (res.success && res.data) {
          this.setCurrentUser(res.data);
          return res.data;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  private getInitialUser(): Employee | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  login(credentials: { username: string; password: string }): Observable<{ success: boolean; message: string; user?: Employee }> {
    return this.http.post<{ success: boolean; message: string; user?: Employee }>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        if (res.success && res.user) {
          this.setCurrentUser(res.user);
        }
      })
    );
  }

  setCurrentUser(user: Employee): void {
    this.currentUserSignal.set(user);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user session:', e);
    }
  }

  isLogoutModalOpenSignal = signal<boolean>(false);
  isLogoutModalOpen = this.isLogoutModalOpenSignal.asReadonly();

  confirmLogout(): void {
    this.isLogoutModalOpenSignal.set(true);
  }

  cancelLogout(): void {
    this.isLogoutModalOpenSignal.set(false);
  }

  proceedLogout(): void {
    this.isLogoutModalOpenSignal.set(false);
    this.currentUserSignal.set(null);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear user session:', e);
    }
    this.router.navigate(['/login']);
  }

  logout(): void {
    this.confirmLogout();
  }
}
