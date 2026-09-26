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
    return u?.role === 'admin' || (u?.username || '').toLowerCase() === 'mbadinesh1705@gmail.com';
  });
  readonly canManageAccess = computed(() => {
    const u = this.currentUserSignal();
    if (!u) return false;
    return u.role === 'admin' || 
           (u.username || '').toLowerCase() === 'mbadinesh1705@gmail.com';
  });

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
    const moduleMap: { [k: string]: 'sales' | 'finance' | 'activity' | 'inventory' } = {
      'campaigns': 'sales',
      'leads': 'sales',
      'oppurtunities': 'sales',
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
      'cart': 'inventory'
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
    if (module === 'office') return false; // Office is strictly Admin only
    const user = this.currentUser();
    if (!user) return false;
    
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
        inventory: ['indent', 'warehouse', 'gate-pass', 'cart']
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
    const perms = user.accessPermissions;
    if (!perms) return false;
    if (perms.navPages && perms.navPages[target] !== undefined) {
      return !!perms.navPages[target]?.canAdd;
    }
    if ((perms as any)[target]) {
      return !!(perms as any)[target]?.canAdd;
    }
    return !!perms.canAdd;
  }

  canEdit(target: string): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;
    const perms = user.accessPermissions;
    if (!perms) return false;
    if (perms.navPages && perms.navPages[target] !== undefined) {
      return !!perms.navPages[target]?.canEdit;
    }
    if ((perms as any)[target]) {
      return !!(perms as any)[target]?.canEdit;
    }
    return !!perms.canEdit;
  }

  canDelete(target: string): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    if (!user) return false;
    const perms = user.accessPermissions;
    if (!perms) return false;
    if (perms.navPages && perms.navPages[target] !== undefined) {
      return !!perms.navPages[target]?.canDelete;
    }
    if ((perms as any)[target]) {
      return !!(perms as any)[target]?.canDelete;
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

  logout(): void {
    this.currentUserSignal.set(null);
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear user session:', e);
    }
    this.router.navigate(['/login']);
  }
}
