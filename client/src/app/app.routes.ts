import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ProjectMasterComponent } from './components/project-master/project-master.component';
import { PaymentLedgerComponent } from './components/payment-ledger/payment-ledger.component';
import { ExpenseLedgerComponent } from './components/expense-ledger/expense-ledger.component';
import { SalesComponent } from './components/sales/sales.component';
import { CampaignsComponent } from './components/sales/campaigns/campaigns.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { SitePlanComponent } from './components/contacts/site-plan/site-plan.component';
import { EmployeesComponent } from './components/office/employees/employees.component';
import { VendorsComponent } from './components/office/vendors/vendors.component';
import { VendorLedgerComponent } from './components/vendor-ledger/vendor-ledger.component';
import { ExpoExpensesComponent } from './components/expense-ledger/expo-expenses/expo-expenses.component';
import { WarehouseExpensesComponent } from './components/expense-ledger/warehouse-expenses/warehouse-expenses.component';
import { AddListComponent } from './components/office/add-list/add-list.component';
import { IndentComponent } from './components/inventory/indent/indent.component';
import { WarehouseComponent } from './components/inventory/warehouse/warehouse.component';
import { GatePassComponent } from './components/inventory/gate-pass/gate-pass.component';
import { CartComponent } from './components/inventory/cart/cart.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth.guard';
import { moduleGuard } from './guards/module.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'dashboard', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'analytics', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'projects', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'master-data', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'awarded-sites', component: ProjectMasterComponent, canActivate: [authGuard] },
  { path: 'awarded sites', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'awarded_sites', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'sales/awarded-sites', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'sales/awarded sites', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'sales/awarded_sites', redirectTo: 'awarded-sites', pathMatch: 'full' },
  { path: 'finances', redirectTo: 'payment-ledger', pathMatch: 'full' },
  // Activity routes (new canonical paths)
  { path: 'activity', redirectTo: 'activity/meetings', pathMatch: 'full' },
  { path: 'activity/meetings', component: ContactsComponent, canActivate: [authGuard, moduleGuard('activity')] },
  { path: 'activity/calls', component: ContactsComponent, canActivate: [authGuard, moduleGuard('activity')] },
  { path: 'activity/tasks', component: ContactsComponent, canActivate: [authGuard, moduleGuard('activity')] },
  { path: 'activity/site-plan', component: SitePlanComponent, canActivate: [authGuard, moduleGuard('activity')] },
  // Legacy contacts routes — redirect to activity for backward compat
  { path: 'contacts', redirectTo: 'activity/meetings', pathMatch: 'full' },
  { path: 'contacts/meetings', redirectTo: 'activity/meetings', pathMatch: 'full' },
  { path: 'contacts/calls', redirectTo: 'activity/calls', pathMatch: 'full' },
  { path: 'contacts/tasks', redirectTo: 'activity/tasks', pathMatch: 'full' },
  { path: 'contacts/:tab', redirectTo: 'activity/meetings', pathMatch: 'full' },
  { path: 'payment-ledger', component: PaymentLedgerComponent, canActivate: [authGuard, moduleGuard('finance')] },
  { path: 'expense-ledger', component: ExpenseLedgerComponent, canActivate: [authGuard, moduleGuard('finance')] },
  { path: 'warehouse-expenses', component: WarehouseExpensesComponent, canActivate: [authGuard, moduleGuard('finance')] },
  { path: 'vendor-ledger', component: VendorLedgerComponent, canActivate: [authGuard, moduleGuard('finance')] },
  { path: 'expo-expenses', component: ExpoExpensesComponent, canActivate: [authGuard, moduleGuard('finance')] },
  { path: 'sales', component: SalesComponent, canActivate: [authGuard, moduleGuard('sales')] },
  { path: 'sales/campaigns', component: CampaignsComponent, canActivate: [authGuard, moduleGuard('sales')] },
  { path: 'sales/leads', component: SalesComponent, canActivate: [authGuard, moduleGuard('sales')] },
  { path: 'sales/oppurtunity', component: SalesComponent, canActivate: [authGuard, moduleGuard('sales')] },
  { path: 'sales/opportunity', component: SalesComponent, canActivate: [authGuard, moduleGuard('sales')] },
  { path: 'sales/oppurtunities', redirectTo: 'sales/oppurtunity', pathMatch: 'full' },
  { path: 'sales/opportunities', redirectTo: 'sales/oppurtunity', pathMatch: 'full' },
  { path: 'sales/dashboard', component: SalesComponent, canActivate: [authGuard, moduleGuard('sales')] },
  { path: 'office', redirectTo: 'office/employees', pathMatch: 'full' },
  { path: 'office/employees', component: EmployeesComponent, canActivate: [authGuard, moduleGuard('office')] },
  { path: 'office/vendors', redirectTo: 'vendor-ledger', pathMatch: 'full' },
  { path: 'office/add-list', component: AddListComponent, canActivate: [authGuard, moduleGuard('office')] },
  { path: 'inventory', redirectTo: 'inventory/indent', pathMatch: 'full' },
  { path: 'inventory/indent', component: IndentComponent, canActivate: [authGuard, moduleGuard('inventory')] },
  { path: 'inventory/warehouse', component: WarehouseComponent, canActivate: [authGuard, moduleGuard('inventory')] },
  { path: 'inventory/gate-pass', component: GatePassComponent, canActivate: [authGuard, moduleGuard('inventory')] },
  { path: 'inventory/cart', component: CartComponent, canActivate: [authGuard, moduleGuard('inventory')] },
  { path: '**', redirectTo: 'home' }
];
