import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  private router = inject(Router);
  public authService = inject(AuthService);

  isSalesOpen = true;
  isFinancesOpen = true;
  isExpensesLedgerOpen = true;
  isActivityOpen = true;
  isOfficeOpen = true;
  isInventoryOpen = true;

  toggleSales(): void {
    this.isSalesOpen = !this.isSalesOpen;
  }

  toggleFinances(): void {
    this.isFinancesOpen = !this.isFinancesOpen;
  }

  toggleExpensesLedger(): void {
    this.isExpensesLedgerOpen = !this.isExpensesLedgerOpen;
  }

  toggleActivity(): void {
    this.isActivityOpen = !this.isActivityOpen;
  }

  toggleOffice(): void {
    this.isOfficeOpen = !this.isOfficeOpen;
  }

  toggleInventory(): void {
    this.isInventoryOpen = !this.isInventoryOpen;
  }

  onActivityClick(item: string): void {
    if (item === 'Logout') {
      this.authService.logout();
    }
  }
}
