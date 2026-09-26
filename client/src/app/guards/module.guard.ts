import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const moduleGuard = (module: 'sales' | 'finance' | 'activity' | 'inventory' | 'office'): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }

    if (module === 'office') {
      if (authService.isAdmin()) return true;
      return router.createUrlTree(['/home']);
    }

    if (authService.canViewModule(module)) {
      return true;
    }

    return router.createUrlTree(['/home']);
  };
};
