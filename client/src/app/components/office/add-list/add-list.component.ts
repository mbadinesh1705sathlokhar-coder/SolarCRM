import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MasterListService, MasterList } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';

export interface FormRow {
  value: string;
}

export interface ColumnMappingRow {
  sectionId: string;
  columnKey: string;
}

export interface ConfigurableColumnDef {
  key: string;              // Unique key
  columnName: string;       // Display name of the column in that module
  listTitle: string;        // Title of MasterList in DB
  category: string;         // 'Sales' | 'Activity' | 'Finances' | 'Inventory' | 'Office' | 'Projects' | 'Billing' | 'General'
  description: string;      // What this configuration governs
  defaultOptions: string[]; // Recommended defaults if creating new
}

export interface SidebarSectionDef {
  id: string;               // e.g. 'activity-calls'
  group: string;            // 'Sales' | 'Finances' | 'Activity' | 'Inventory' | 'Office' | 'Other'
  title: string;            // 'Calls', 'Campaigns', 'Leads', etc.
  icon: string;             // Bootstrap icon
  badgeColor: string;       // UI Color
  columns: ConfigurableColumnDef[];
}

@Component({
  selector: 'app-add-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './add-list.component.html',
  styleUrls: ['./add-list.component.css']
})
export class AddListComponent implements OnInit {
  private masterListService = inject(MasterListService);
  private cdr = inject(ChangeDetectorRef);
  public authService = inject(AuthService);

  canAdd(): boolean {
    return this.authService.isAdmin() || this.authService.canAdd('office-add-list') || this.authService.canAdd('office');
  }

  canEdit(): boolean {
    return this.authService.isAdmin() || this.authService.canEdit('office-add-list') || this.authService.canEdit('office');
  }

  canDelete(): boolean {
    return this.authService.isAdmin() || this.authService.canDelete('office-add-list') || this.authService.canDelete('office');
  }

  lists: MasterList[] = [];
  loading = false;
  searchTerm = '';
  selectedCategoryFilter: string = 'All';

  // Toast
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  editingId: number | null = null;

  // Hierarchical Selection State
  selectedSectionId = '';
  selectedColumnKey = '';
  mappingRows: ColumnMappingRow[] = [];
  isCustomColumn = false;

  // Form State
  formTitle = '';
  formCategory = 'Activity';
  formDescription = '';
  formRows: FormRow[] = [{ value: '' }];

  // Existing configuration notice banner
  configNoticeText = '';
  configNoticeType: 'existing' | 'new' | '' = '';

  // Pre-configured category options
  categoryOptions = ['Projects', 'Activity', 'Sales', 'Inventory', 'Finances', 'Billing', 'Office', 'General'];

  // Master definition of sidebar sections & their configurable columns
  sidebarSections: SidebarSectionDef[] = [
    // 1. Activity Group
    {
      id: 'activity-calls',
      group: 'Activity',
      title: 'Calls',
      icon: 'bi-telephone-fill',
      badgeColor: '#ec4899',
      columns: [
        {
          key: 'call-status',
          columnName: 'Call Status',
          listTitle: 'Call Status',
          category: 'Activity',
          description: 'Lifecycle and progress statuses for logging and tracking client/vendor calls',
          defaultOptions: ['New Lead', 'Offer-Submission', 'Queries', 'Negotiation', 'Others']
        }
      ]
    },
    {
      id: 'activity-meetings',
      group: 'Activity',
      title: 'Meetings',
      icon: 'bi-calendar-check',
      badgeColor: '#0284c7',
      columns: [
        {
          key: 'meeting-purpose',
          columnName: 'Meeting Purpose',
          listTitle: 'Meeting Purpose',
          category: 'Activity',
          description: 'Purpose categorization for client and team meetings',
          defaultOptions: ['Client', 'All', 'Site Plan', 'Site Visit']
        },
        {
          key: 'meeting-status',
          columnName: 'Meeting Status',
          listTitle: 'Meeting Status',
          category: 'Activity',
          description: 'Schedule and execution statuses for meetings',
          defaultOptions: ['Scheduled', 'Completed', 'Cancelled']
        }
      ]
    },
    {
      id: 'activity-tasks',
      group: 'Activity',
      title: 'Tasks',
      icon: 'bi-card-checklist',
      badgeColor: '#f59e0b',
      columns: [
        {
          key: 'task-status',
          columnName: 'Task Status',
          listTitle: 'Task Status',
          category: 'Activity',
          description: 'Progress and completion states for delegated team tasks',
          defaultOptions: ['Pending', 'In Progress', 'Completed']
        },
        {
          key: 'task-priority',
          columnName: 'Task Priority',
          listTitle: 'Task Priority',
          category: 'Activity',
          description: 'Urgency and priority levels for tasks',
          defaultOptions: ['High', 'Medium', 'Low']
        }
      ]
    },
    {
      id: 'activity-siteplan',
      group: 'Activity',
      title: 'Site Plan',
      icon: 'bi-geo-alt-fill',
      badgeColor: '#16a34a',
      columns: [
        {
          key: 'site-plan-status',
          columnName: 'Site Plan Status',
          listTitle: 'Site Plan Status',
          category: 'Activity',
          description: 'Feasibility survey and site plan milestone status',
          defaultOptions: ['Scheduled', 'Completed', 'Rescheduled', 'Cancelled']
        }
      ]
    },

    // 2. Sales Group
    {
      id: 'sales-campaigns',
      group: 'Sales',
      title: 'Campaigns',
      icon: 'bi-megaphone',
      badgeColor: '#84cc16',
      columns: [
        {
          key: 'campaign-lead-handlers',
          columnName: 'Lead Handlers / Assigned Executive',
          listTitle: 'Leads Name',
          category: 'Projects',
          description: 'Sales and marketing executives assigned to handle incoming campaign leads',
          defaultOptions: ['Renuka', 'Daya', 'Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Soundarajan']
        }
      ]
    },
    {
      id: 'sales-leads',
      group: 'Sales',
      title: 'Leads',
      icon: 'bi-person-lines-fill',
      badgeColor: '#84cc16',
      columns: [
        {
          key: 'leads-site-type',
          columnName: 'Site Type',
          listTitle: 'Site_Type',
          category: 'Projects',
          description: 'Structural and environmental classification of customer sites',
          defaultOptions: ['Residential', 'Commercial', 'Industrial', 'Ground Mount', 'Car Port', 'Floating', 'Residential Common']
        },
        {
          key: 'leads-sys-type',
          columnName: 'System Type',
          listTitle: 'Sys_Type',
          category: 'Projects',
          description: 'Electrical configuration and grid topology of solar PV plant',
          defaultOptions: ['On Grid', 'Off Grid', 'Hybrid', 'Solar Pump']
        },
        {
          key: 'leads-sale-type',
          columnName: 'Sale Type',
          listTitle: 'Sale_Type',
          category: 'Projects',
          description: 'Contract and commercial sale channel classification',
          defaultOptions: ['B2C', 'Direct B2B', 'Retailer B2B']
        },
        {
          key: 'leads-client-type',
          columnName: 'Client Type',
          listTitle: 'Client_Type',
          category: 'Projects',
          description: 'Client legal and organizational categorization',
          defaultOptions: ['Assosiation', 'Company', 'Govt. Org', 'Individual', 'Institutional']
        },
        {
          key: 'leads-site-category',
          columnName: 'Site Category',
          listTitle: 'Site_Category',
          category: 'Projects',
          description: 'Structural and solar order category classification',
          defaultOptions: ['TATA SPG', 'Waree', 'Premier', 'Other']
        },
        {
          key: 'leads-handler',
          columnName: 'Lead Handler',
          listTitle: 'Leads Name',
          category: 'Projects',
          description: 'Assigned sales executives managing customer inquiries',
          defaultOptions: ['Renuka', 'Daya', 'Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Soundarajan']
        },
        {
          key: 'leads-order-by',
          columnName: 'Engineer',
          listTitle: 'Engineer',
          category: 'Projects',
          description: 'Assigned site engineer or originating reference authority',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        }
      ]
    },
    {
      id: 'sales-oppurtunity',
      group: 'Sales',
      title: 'Oppurtunities',
      icon: 'bi-lightning-charge',
      badgeColor: '#84cc16',
      columns: [
        {
          key: 'opp-site-type',
          columnName: 'Site Type',
          listTitle: 'Site_Type',
          category: 'Projects',
          description: 'Structural classification of qualified opportunity site',
          defaultOptions: ['Residential', 'Commercial', 'Industrial', 'Ground Mount', 'Car Port', 'Floating', 'Residential Common']
        },
        {
          key: 'opp-sys-type',
          columnName: 'System Type',
          listTitle: 'Sys_Type',
          category: 'Projects',
          description: 'Grid topology and solar system architecture',
          defaultOptions: ['On Grid', 'Off Grid', 'Hybrid', 'Solar Pump']
        },
        {
          key: 'opp-site-category',
          columnName: 'Site Category',
          listTitle: 'Site_Category',
          category: 'Projects',
          description: 'Opportunity site project category (e.g. TATA SPG, Waree, Premier, Other)',
          defaultOptions: ['TATA SPG', 'Waree', 'Premier', 'Other']
        },
        {
          key: 'opp-sale-type',
          columnName: 'Sale Type',
          listTitle: 'Sale_Type',
          category: 'Projects',
          description: 'Commercial contract sale model',
          defaultOptions: ['B2C', 'Direct B2B', 'Retailer B2B']
        },
        {
          key: 'opp-client-type',
          columnName: 'Client Type',
          listTitle: 'Client_Type',
          category: 'Projects',
          description: 'Client organization type',
          defaultOptions: ['Assosiation', 'Company', 'Govt. Org', 'Individual', 'Institutional']
        },
        {
          key: 'opp-handler',
          columnName: 'Lead Handler',
          listTitle: 'Leads Name',
          category: 'Projects',
          description: 'Executive closing the opportunity',
          defaultOptions: ['Renuka', 'Daya', 'Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Soundarajan']
        }
      ]
    },
    {
      id: 'sales-awarded',
      group: 'Sales',
      title: 'Awarded sites (Project Master)',
      icon: 'bi-building-check',
      badgeColor: '#84cc16',
      columns: [
        {
          key: 'proj-stage',
          columnName: 'Site Stage',
          listTitle: 'Site Stage',
          category: 'Projects',
          description: 'Key engineering and commissioning execution milestones',
          defaultOptions: ['EB Work in Process', 'Handed Over', 'I&C Completed', 'Installation Inprocess', 'Material Procurement', 'Project Awarded', 'Site Commissioned']
        },
        {
          key: 'proj-status',
          columnName: 'Site Status',
          listTitle: 'Site Status',
          category: 'Projects',
          description: 'Overall active progress state of awarded project',
          defaultOptions: ['Not Started', 'Materials Supplied', 'I&C Completed', 'EB Work in Process', 'Site Commissioned', 'Handed Over']
        },
        {
          key: 'proj-site-type',
          columnName: 'Site Type',
          listTitle: 'Site_Type',
          category: 'Projects',
          description: 'Site structural design and configuration',
          defaultOptions: ['Residential', 'Commercial', 'Industrial', 'Ground Mount', 'Car Port', 'Floating', 'Residential Common']
        },
        {
          key: 'proj-sys-type',
          columnName: 'System Type',
          listTitle: 'Sys_Type',
          category: 'Projects',
          description: 'Solar grid topology',
          defaultOptions: ['On Grid', 'Off Grid', 'Hybrid', 'Solar Pump']
        },
        {
          key: 'proj-sale-type',
          columnName: 'Sale Type',
          listTitle: 'Sale_Type',
          category: 'Projects',
          description: 'Commercial contract classification',
          defaultOptions: ['B2C', 'Direct B2B', 'Retailer B2B']
        },
        {
          key: 'proj-client-type',
          columnName: 'Client Type',
          listTitle: 'Client_Type',
          category: 'Projects',
          description: 'Client legal categorization',
          defaultOptions: ['Assosiation', 'Company', 'Govt. Org', 'Individual', 'Institutional']
        },
        {
          key: 'proj-materials-group',
          columnName: 'Material Group',
          listTitle: 'Material Group',
          category: 'Inventory',
          description: 'Material Groups (Cables, Panels, Inverters, etc.) and their default UOM',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree']
        },
        {
          key: 'proj-bom-specs',
          columnName: 'Bill of Materials (BOM)',
          listTitle: 'BOM',
          category: 'Inventory',
          description: 'Bill of Materials (BOM) specifications, types, sizes and ratings for each material group',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree']
        },
        {
          key: 'proj-invoice-type',
          columnName: 'Invoice Type',
          listTitle: 'Invoice Type',
          category: 'Billing',
          description: 'Billing classification for client progress claims',
          defaultOptions: ['Material Supply', 'I&C Works', 'CEIG Documentation', 'Supply and I&C work']
        },
        {
          key: 'proj-invoice-status',
          columnName: 'Invoice Status',
          listTitle: 'Invoice Status',
          category: 'Billing',
          description: 'Tax invoice billing and disbursement state',
          defaultOptions: ['Billed', 'Partly Billed', 'Not Billed']
        },
        {
          key: 'proj-payment-mode',
          columnName: 'Payment Mode',
          listTitle: 'Payment Mode',
          category: 'Finances',
          description: 'Payment settlement and banking methods',
          defaultOptions: ['Bank Transfer / NEFT', 'Bank Transfer / IMPS', 'Cheque / DD', 'UPI', 'Bank Deposit']
        },
        {
          key: 'proj-engineer',
          columnName: 'Engineer',
          listTitle: 'Engineer',
          category: 'Projects',
          description: 'Site Engineer / Project Manager assigned to the awarded project',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        }
      ]
    },

    // 3. Finances Group
    {
      id: 'finance-payment',
      group: 'Finances',
      title: 'Client Payment Ledger',
      icon: 'bi-wallet2',
      badgeColor: '#16a34a',
      columns: [
        {
          key: 'ledger-invoice-type',
          columnName: 'Invoice Type',
          listTitle: 'Invoice Type',
          category: 'Billing',
          description: 'Invoice categories for client payment reconciliation',
          defaultOptions: ['Material Supply', 'I&C Works', 'CEIG Documentation', 'Supply and I&C work']
        },
        {
          key: 'ledger-payment-mode',
          columnName: 'Payment Mode',
          listTitle: 'Payment Mode',
          category: 'Finances',
          description: 'Settlement modes for client receipts',
          defaultOptions: ['Bank Transfer / NEFT', 'Bank Transfer / IMPS', 'Cheque / DD', 'UPI', 'Bank Deposit']
        },
        {
          key: 'ledger-closing-value',
          columnName: 'Payment Closing Tolerance / Closing Value (₹)',
          listTitle: 'Closing Value',
          category: 'Finances',
          description: 'Payment closing tolerance threshold (in ₹) to consider client accounts Fully Paid (e.g. 100, 10, 50, 500)',
          defaultOptions: ['100', '10', '50', '500']
        },
        {
          key: 'ledger-engineer',
          columnName: 'Engineer',
          listTitle: 'Engineer',
          category: 'Finances',
          description: 'Engineer responsible for client account payments',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        }
      ]
    },
    {
      id: 'finance-expense',
      group: 'Finances',
      title: 'Expenses Ledger',
      icon: 'bi-receipt',
      badgeColor: '#dc2626',
      columns: [
        {
          key: 'expense-engineer',
          columnName: 'Engineer',
          listTitle: 'Engineer',
          category: 'Finances',
          description: 'Site engineer claiming or managing site expenses',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        },
        {
          key: 'expense-payment-through',
          columnName: 'Payment Through',
          listTitle: 'Payment Through',
          category: 'Finances',
          description: 'Disbursement channel or instrument for site expenditure',
          defaultOptions: ['P.O', 'W.O', 'Petty Cash', 'Accounts']
        },
        {
          key: 'expense-payment-purpose',
          columnName: 'Payment Purpose / Paid By',
          listTitle: 'Payment Purpose',
          category: 'Finances',
          description: 'Designated executive or account for expense disbursements',
          defaultOptions: ['K SATHISH', 'K KARTHIKEYAN', 'V SHARATH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'RENUKA S', 'MANIMARAN N', 'VAIRAMANI', 'SAKTHI VEL', 'OFFICE', 'RAHUL']
        },
        {
          key: 'expense-voucher-status',
          columnName: 'Bill / Voucher Status',
          listTitle: 'Bill / Voucher Status',
          category: 'Finances',
          description: 'Verification state of vendor bills and expense vouchers',
          defaultOptions: ['Submitted', 'Not Submitted']
        },
        {
          key: 'expense-materials-category',
          columnName: 'Material / Expense Category',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Standard material items and consumable expense classifications',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        }
      ]
    },
    {
      id: 'finances-vendor-ledger',
      group: 'Finances',
      title: 'Vendor Ledger',
      icon: 'bi-truck',
      badgeColor: '#0ea5e9',
      columns: [
        {
          key: 'vendor-materials',
          columnName: 'Materials & Equipment Supplied',
          listTitle: 'Materials',
          category: 'Finances',
          description: 'Approved materials and equipment catalog for vendor registration & PO/WO',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        },
        {
          key: 'vendor-credit-days',
          columnName: 'Credit Terms (Days)',
          listTitle: 'Credit Days',
          category: 'Finances',
          description: 'Standard payment credit duration term in days',
          defaultOptions: ['15', '20', '30', '45', '60', '90']
        },
        {
          key: 'vendor-order-type',
          columnName: 'Order Type (PO / WO)',
          listTitle: 'Vendor Order Type',
          category: 'Finances',
          description: 'Procurement order classification: Purchase Order or Work Order',
          defaultOptions: ['PO', 'WO']
        },
        {
          key: 'vendor-category',
          columnName: 'Vendor Category / Trade',
          listTitle: 'Vendor Category',
          category: 'Finances',
          description: 'Supplying industry and product category for vendor accounts',
          defaultOptions: ['Solar Panels', 'Inverters', 'MMS & Structures', 'Cables & Trays', 'Electrical & Switchgear', 'Civil & Foundation', 'Hardware & Fasteners']
        }
      ]
    },

    // 4. Inventory Group
    {
      id: 'inventory-indent',
      group: 'Inventory',
      title: 'Indent',
      icon: 'bi-file-earmark-text',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'indent-engineer',
          columnName: 'Site Engineer',
          listTitle: 'Engineer',
          category: 'Inventory',
          description: 'Site engineer handling material requisitions and Indents',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        },
        {
          key: 'indent-materials',
          columnName: 'Material / Stock Categories',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Materials catalog for indent requisitions',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        },
        {
          key: 'indent-uom',
          columnName: 'UOM Measurements',
          listTitle: 'UOM measurements',
          category: 'Inventory',
          description: 'Units of measurement for indent items',
          defaultOptions: ['Nos', 'Meter', 'Sets', 'Kg', 'Watts', 'Pcs', 'Pair', 'Box', 'Packet', 'Coil', 'Trip', 'Lot', 'Sqft', 'Sqmm', 'Rmtr']
        }
      ]
    },
    {
      id: 'inventory-warehouse',
      group: 'Inventory',
      title: 'Warehouse',
      icon: 'bi-box-seam',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'wh-engineer',
          columnName: 'Site Engineer',
          listTitle: 'Engineer',
          category: 'Inventory',
          description: 'Warehouse storekeeper / Site Engineer handling inventory dispatch',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        },
        {
          key: 'wh-materials',
          columnName: 'Material / Stock Categories',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Warehouse stock items catalog',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        },
        {
          key: 'wh-uom',
          columnName: 'UOM Measurements',
          listTitle: 'UOM measurements',
          category: 'Inventory',
          description: 'Units of measurement for warehouse stock',
          defaultOptions: ['Nos', 'Meter', 'Sets', 'Kg', 'Watts', 'Pcs', 'Pair', 'Box', 'Packet', 'Coil', 'Trip', 'Lot', 'Sqft', 'Sqmm', 'Rmtr']
        }
      ]
    },
    {
      id: 'inventory-gatepass',
      group: 'Inventory',
      title: 'Gate Pass',
      icon: 'bi-pass',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'gp-engineer',
          columnName: 'Site Engineer',
          listTitle: 'Engineer',
          category: 'Inventory',
          description: 'Site engineer issuing gate pass dispatch',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        },
        {
          key: 'gp-materials',
          columnName: 'Material / Stock Categories',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Materials for gate pass transit',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        }
      ]
    },
    {
      id: 'inventory-cart',
      group: 'Inventory',
      title: 'Add to cart',
      icon: 'bi-cart3',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'cart-engineer',
          columnName: 'Site Engineer',
          listTitle: 'Engineer',
          category: 'Inventory',
          description: 'Site engineer requisitioning materials in cart',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        },
        {
          key: 'cart-materials',
          columnName: 'Material / Stock Categories',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Cart material items',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        }
      ]
    },
    {
      id: 'inventory-bom',
      group: 'Inventory',
      title: 'Bill of Materials (BOM)',
      icon: 'bi-diagram-3-fill',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'bom-materials-group',
          columnName: 'Bill of Materials (BOM)',
          listTitle: 'BOM',
          category: 'Inventory',
          description: 'Material Groups (Cables, Panels, Inverters, Civil & Miscellaneous, Consumables, Earthing Protection, Module Mounting Structures, Tata SPG Package, Waree) for BOM Cost Sheet allocation',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree']
        },
        {
          key: 'bom-uom',
          columnName: 'UOM Measurements',
          listTitle: 'UOM measurements',
          category: 'Inventory',
          description: 'Units of measurement for BOM items',
          defaultOptions: ['Nos', 'Meter', 'Sets', 'Kg', 'Watts', 'Pcs', 'Pair', 'Box', 'Packet', 'Coil', 'Trip', 'Lot', 'Sqft', 'Sqmm', 'Rmtr']
        }
      ]
    },
    {
      id: 'inventory-all',
      group: 'Inventory',
      title: 'Inventory & BOM (All Modules)',
      icon: 'bi-box-seam',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'inv-materials-group',
          columnName: 'Material Group',
          listTitle: 'Material Group',
          category: 'Inventory',
          description: 'Material Groups (Cables, Panels, Inverters, etc.) and their default UOM',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree']
        },
        {
          key: 'inv-bom-specs',
          columnName: 'Bill of Materials (BOM)',
          listTitle: 'BOM',
          category: 'Inventory',
          description: 'Bill of Materials (BOM) specifications, types, sizes and ratings for each material group',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous', 'Consumables', 'Earthing Protection', 'Module Mounting Structures', 'Tata SPG Package', 'Waree']
        },
        {
          key: 'inv-materials',
          columnName: 'Material / Stock Categories',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Complete materials catalog',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
        },
        {
          key: 'inv-uom-measurements',
          columnName: 'UOM Measurements',
          listTitle: 'UOM measurements',
          category: 'Inventory',
          description: 'Units of measurement',
          defaultOptions: ['Nos', 'Meter', 'Sets', 'Kg', 'Watts', 'Pcs', 'Pair', 'Box', 'Packet', 'Coil', 'Trip', 'Lot', 'Sqft', 'Sqmm', 'Rmtr']
        },
        {
          key: 'inv-engineer',
          columnName: 'Site Engineer',
          listTitle: 'Engineer',
          category: 'Inventory',
          description: 'Site engineer handling Inventory',
          defaultOptions: ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']
        }
      ]
    },

    // 5. Office Group
    {
      id: 'office-employees',
      group: 'Office',
      title: 'Employees',
      icon: 'bi-person-badge',
      badgeColor: '#0284c7',
      columns: [
        {
          key: 'emp-role-designation',
          columnName: 'Role / Designation',
          listTitle: 'Role / Designation',
          category: 'Office',
          description: 'Designation and professional roles for company employees',
          defaultOptions: [
            'Business Development Executive',
            'Junior Business Development Executive',
            'Junior Engineer',
            'Senior Engineer',
            'Asst. Manager',
            'General Manager',
            'Project Manager',
            'Solar Design Engineer'
          ]
        },
        {
          key: 'emp-responsibility',
          columnName: 'Employee Responsibility',
          listTitle: 'Employee Responsibility',
          category: 'Office',
          description: 'Functional department or operational group',
          defaultOptions: ['Engineers', 'Sales', 'Admin', 'Accounts & HR', 'Inventory & Stores']
        }
      ]
    },

    // 6. Custom Column Group
    {
      id: 'custom',
      group: 'Other',
      title: 'Custom / Other Column Configuration',
      icon: 'bi-gear-wide-connected',
      badgeColor: '#64748b',
      columns: []
    }
  ];

  ngOnInit(): void {
    this.loadLists();
  }

  loadLists(): void {
    this.loading = true;
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.lists = res.data;
          this.syncUomOptions();
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading master lists:', err);
        this.loading = false;
        this.showToast('Failed to load configuration lists.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  get availableColumns(): ConfigurableColumnDef[] {
    const section = this.sidebarSections.find(s => s.id === this.selectedSectionId);
    return section ? section.columns : [];
  }

  get selectedSection(): SidebarSectionDef | undefined {
    return this.sidebarSections.find(s => s.id === this.selectedSectionId);
  }

  // Reverse multi-mapping helper for table display
  getAllMappedInfo(list: MasterList): { sectionTitle: string; columnName: string; icon: string; badgeColor: string }[] {
    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const listNorm = norm(list.title);
    const results: { sectionTitle: string; columnName: string; icon: string; badgeColor: string }[] = [];
    const seenSecs = new Set<string>();

    for (const sec of this.sidebarSections) {
      for (const col of sec.columns) {
        if (norm(col.listTitle) === listNorm || norm(col.columnName) === listNorm) {
          if (!seenSecs.has(sec.title)) {
            seenSecs.add(sec.title);
            results.push({
              sectionTitle: `${sec.title}`,
              columnName: col.columnName,
              icon: sec.icon,
              badgeColor: sec.badgeColor
            });
          }
        }
      }
    }

    if (results.length === 0) {
      results.push({
        sectionTitle: list.category || 'General',
        columnName: list.title,
        icon: 'bi-tag',
        badgeColor: '#64748b'
      });
    }

    return results;
  }

  getMappedInfo(list: MasterList): { sectionTitle: string; columnName: string; icon: string; badgeColor: string } {
    const all = this.getAllMappedInfo(list);
    return all[0];
  }

  get categoryFilterCounts(): { [key: string]: number } {
    const counts: { [key: string]: number } = { All: this.lists.length };
    for (const l of this.lists) {
      const cat = l.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }

  get filteredLists(): MasterList[] {
    let result = this.lists;
    if (this.selectedCategoryFilter !== 'All') {
      const cat = this.selectedCategoryFilter.toLowerCase();
      result = result.filter(l => (l.category || '').toLowerCase() === cat);
    }
    if (!this.searchTerm.trim()) return result;
    const term = this.searchTerm.toLowerCase().trim();
    return result.filter(l =>
      (l.title || '').toLowerCase().includes(term) ||
      (l.category || '').toLowerCase().includes(term) ||
      (l.description || '').toLowerCase().includes(term) ||
      (l.items && l.items.some(it => it.toLowerCase().includes(term)))
    );
  }

  get totalItemsCount(): number {
    return this.lists.reduce((sum, l) => sum + (l.items?.length || 0), 0);
  }

  // Sub-modal state for Custom Section & Column Mapping
  isCustomMappingModalOpen = false;
  customSectionSelect = '';
  customSectionInput = '';
  customColumnSelect = '';
  customColumnInput = '';
  customCategoryInput = 'General';
  customDescriptionInput = '';

  get subModalAvailableColumns(): ConfigurableColumnDef[] {
    if (!this.customSectionSelect || this.customSectionSelect === '__NEW_SECTION__') {
      const allCols: ConfigurableColumnDef[] = [];
      const seenKeys = new Set<string>();
      for (const sec of this.sidebarSections) {
        for (const c of sec.columns) {
          if (!seenKeys.has(c.columnName)) {
            seenKeys.add(c.columnName);
            allCols.push(c);
          }
        }
      }
      return allCols;
    }
    const sec = this.sidebarSections.find(s => s.id === this.customSectionSelect);
    return sec ? sec.columns : [];
  }

  openCustomMappingModal(): void {
    this.customSectionSelect = (this.selectedSectionId && this.selectedSectionId !== 'custom') ? this.selectedSectionId : '';
    const initialSec = this.sidebarSections.find(s => s.id === this.customSectionSelect);
    this.customSectionInput = initialSec ? initialSec.title : '';
    
    this.customColumnSelect = (this.selectedColumnKey && this.selectedColumnKey !== '__CUSTOM__') ? this.selectedColumnKey : '';
    const initialCol = this.availableColumns.find(c => c.key === this.customColumnSelect);
    this.customColumnInput = initialCol ? initialCol.columnName : '';

    this.customCategoryInput = initialSec?.group || this.selectedSection?.group || 'General';
    this.customDescriptionInput = '';
    this.isCustomMappingModalOpen = true;
  }

  onSubModalSectionSelectChange(): void {
    if (this.customSectionSelect === '__NEW_SECTION__') {
      this.customSectionInput = '';
    } else {
      const sec = this.sidebarSections.find(s => s.id === this.customSectionSelect);
      if (sec) {
        this.customSectionInput = sec.title;
        if (sec.group) this.customCategoryInput = sec.group;
      }
    }
    this.customColumnSelect = '';
    this.customColumnInput = '';
  }

  onSubModalColumnSelectChange(): void {
    if (this.customColumnSelect === '__NEW_COLUMN__') {
      this.customColumnInput = '';
    } else {
      const col = this.subModalAvailableColumns.find(c => c.key === this.customColumnSelect || c.columnName === this.customColumnSelect);
      if (col) {
        this.customColumnInput = col.columnName;
      } else {
        this.customColumnInput = this.customColumnSelect;
      }
    }
  }

  getAvailableColumnsForSection(sectionId: string): ConfigurableColumnDef[] {
    const section = this.sidebarSections.find(s => s.id === sectionId);
    return section ? section.columns : [];
  }

  addMappingRow(): void {
    const defaultSecId = this.sidebarSections.length > 0 ? this.sidebarSections[0].id : 'custom';
    const cols = this.getAvailableColumnsForSection(defaultSecId);
    const defaultColKey = cols.length > 0 ? cols[0].key : '__CUSTOM__';
    this.mappingRows.push({ sectionId: defaultSecId, columnKey: defaultColKey });
    this.checkIfBomMaterialsMode();
  }

  removeMappingRow(index: number): void {
    if (this.mappingRows.length > 1) {
      this.mappingRows.splice(index, 1);
      this.checkIfBomMaterialsMode();
    }
  }

  onMappingRowSectionChange(idx: number): void {
    const row = this.mappingRows[idx];
    if (!row) return;
    if (row.sectionId === 'custom') {
      row.columnKey = '__CUSTOM__';
      this.isCustomColumn = true;
    } else {
      const cols = this.getAvailableColumnsForSection(row.sectionId);
      if (cols.length > 0) {
        row.columnKey = cols[0].key;
      } else {
        row.columnKey = '__CUSTOM__';
      }
    }
    this.checkIfBomMaterialsMode();
  }

  onMappingRowColumnChange(idx: number): void {
    const row = this.mappingRows[idx];
    if (row && row.columnKey === '__CUSTOM__') {
      this.isCustomColumn = true;
    }
    this.checkIfBomMaterialsMode();
  }

  detectMappingsForList(list: MasterList): ColumnMappingRow[] {
    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const listNorm = norm(list.title);
    const rows: ColumnMappingRow[] = [];
    const seen = new Set<string>();

    for (const sec of this.sidebarSections) {
      for (const col of sec.columns) {
        if (norm(col.listTitle) === listNorm || norm(col.columnName) === listNorm || (listNorm === 'bom' && (col.key.includes('materials') || col.key.includes('bom')))) {
          const comboKey = `${sec.id}:${col.key}`;
          if (!seen.has(comboKey)) {
            seen.add(comboKey);
            rows.push({ sectionId: sec.id, columnKey: col.key });
          }
        }
      }
    }

    if (rows.length === 0) {
      rows.push({ sectionId: 'sales-awarded', columnKey: 'proj-materials-group' });
    }

    return rows;
  }

  closeCustomMappingModal(): void {
    this.isCustomMappingModalOpen = false;
  }

  saveCustomMapping(): void {
    let secTitle = (this.customSectionInput || '').trim();
    if (!secTitle && this.customSectionSelect && this.customSectionSelect !== '__NEW_SECTION__') {
      const sec = this.sidebarSections.find(s => s.id === this.customSectionSelect);
      if (sec) secTitle = sec.title;
    }

    let colTitle = (this.customColumnInput || '').trim();
    if (!colTitle && this.customColumnSelect && this.customColumnSelect !== '__NEW_COLUMN__') {
      const col = this.subModalAvailableColumns.find(c => c.key === this.customColumnSelect || c.columnName === this.customColumnSelect);
      if (col) colTitle = col.columnName;
      else colTitle = this.customColumnSelect;
    }

    const cat = this.customCategoryInput || 'General';

    if (!secTitle) {
      this.showToast('Please select or type a Section Name (Side Menu Bar).', 'danger');
      return;
    }

    if (!colTitle) {
      this.showToast('Please select or type a Column Name.', 'danger');
      return;
    }

    // 1. Find or create Section in sidebarSections
    let section = this.sidebarSections.find(s => s.title.toLowerCase() === secTitle.toLowerCase() || s.id === this.customSectionSelect);
    if (!section) {
      const sectionId = 'custom-sec-' + Date.now();
      section = {
        id: sectionId,
        group: cat,
        title: secTitle,
        icon: 'bi-gear-wide-connected',
        badgeColor: '#0284c7',
        columns: []
      };
      // Insert section before the final fallback "custom" section
      const customIdx = this.sidebarSections.findIndex(s => s.id === 'custom');
      if (customIdx >= 0) {
        this.sidebarSections.splice(customIdx, 0, section);
      } else {
        this.sidebarSections.push(section);
      }
    }

    // 2. Find or create Column in section
    let col = section.columns.find(c => c.columnName.toLowerCase() === colTitle.toLowerCase() || c.listTitle.toLowerCase() === colTitle.toLowerCase() || c.key === this.customColumnSelect);
    if (!col) {
      const colKey = 'custom-col-' + Date.now();
      col = {
        key: colKey,
        columnName: colTitle,
        listTitle: this.formTitle || colTitle,
        category: cat,
        description: (this.customDescriptionInput || '').trim() || `${colTitle} under ${secTitle} section`,
        defaultOptions: ['Option 1']
      };
      section.columns.push(col);
    }

    // 3. Add to mappingRows instead of replacing single row!
    const existingIdx = this.mappingRows.findIndex(r => r.sectionId === section!.id && r.columnKey === col!.key);
    if (existingIdx < 0) {
      this.mappingRows.push({ sectionId: section.id, columnKey: col.key });
    }

    this.closeCustomMappingModal();
    this.showToast(`Added custom mapping "${section.title} → ${col.columnName}"`, 'success');
    this.checkIfBomMaterialsMode();
  }

  onSectionChange(): void {
    if (this.mappingRows.length > 0) {
      this.onMappingRowSectionChange(0);
    }
  }

  onColumnChange(): void {
    if (this.mappingRows.length > 0) {
      this.onMappingRowColumnChange(0);
    }
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add configuration lists.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.editingId = null;
    this.formTitle = '';
    this.formCategory = 'Activity';
    this.formDescription = '';
    this.mappingRows = [{ sectionId: 'sales-awarded', columnKey: 'proj-materials-group' }];
    this.isCustomColumn = false;
    this.formRows = [{ value: '' }];
    this.configNoticeText = '';
    this.isModalOpen = true;
  }

  openEditModal(list: MasterList): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit configuration lists.', 'danger');
      return;
    }
    this.isEditMode = true;
    this.editingId = list.id || null;
    this.formTitle = list.title;
    this.formCategory = list.category || 'General';
    this.formDescription = list.description || '';

    this.mappingRows = this.detectMappingsForList(list);

    if (list.items && list.items.length > 0) {
      this.formRows = list.items.map(it => ({ value: it }));
    } else {
      this.formRows = [{ value: '' }];
    }

    this.configNoticeText = `Editing list "${list.title}" with ${this.formRows.length} configured options across ${this.mappingRows.length} mapped sections.`;
    this.configNoticeType = 'existing';
    this.checkIfBomMaterialsMode();
    this.isModalOpen = true;
  }

  // --- HIERARCHICAL BOM MATERIAL MASTER STATE & METHODS ---
  isBomMaterialsMode = false;
  isMaterialGroupMode = false;
  materialGroupRows: { groupName: string; defaultUom: string }[] = [];
  bomMaterialGroups: string[] = [
    'Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous',
    'Consumables', 'Earthing Protection', 'Module Mounting Structures',
    'Tata SPG Package', 'Waree'
  ];
  selectedBomGroup: string = 'Cables';
  groupGstPercent: number = 18;
  allBomGroupItems: { [key: string]: { id?: number; categoryType: string; specification: string; defaultUom: string; unitRate: number; gstPercent?: number }[] } = {};
  bomGroupSpecRows: { id?: number; categoryType: string; specification: string; defaultUom: string; unitRate: number; gstPercent?: number }[] = [];
  loadingBomSpecs = false;
  uomOptions: string[] = ['Nos', 'Meter', 'Sets', 'Kg', 'Watts', 'Pcs', 'Pair', 'Box', 'Packet', 'Coil', 'Trip', 'Lot', 'Sqft', 'Sqmm', 'Rmtr'];

  syncUomOptions(): void {
    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const uomList = this.lists.find(l => norm(l.title) === 'uommeasurements' || norm(l.title) === 'uom');
    if (uomList && uomList.items && uomList.items.length > 0) {
      this.uomOptions = uomList.items;
    }
  }

  getEffectiveUomOptions(): string[] {
    const set = new Set(this.uomOptions);
    this.bomGroupSpecRows.forEach(r => {
      if (r.defaultUom && r.defaultUom.trim()) set.add(r.defaultUom.trim());
    });
    this.materialGroupRows.forEach(r => {
      if (r.defaultUom && r.defaultUom.trim()) set.add(r.defaultUom.trim());
    });
    return Array.from(set);
  }

  initMaterialGroupRows(): void {
    if (Object.keys(this.allBomGroupItems || {}).length === 0) {
      this.masterListService.getBomMaterials().subscribe({
        next: (res) => {
          if (res.success && res.grouped) {
            this.allBomGroupItems = res.grouped;
          }
          this.populateMaterialGroupRows();
          this.cdr.markForCheck();
        },
        error: () => {
          this.populateMaterialGroupRows();
          this.cdr.markForCheck();
        }
      });
    } else {
      this.populateMaterialGroupRows();
    }
  }

  getDefaultUomForGroupName(grp: string): string {
    const norm = (grp || '').toLowerCase().trim();
    const items = this.allBomGroupItems[grp] || [];
    if (items.length > 0 && items[0].defaultUom) {
      return items[0].defaultUom;
    }
    for (const key of Object.keys(this.allBomGroupItems || {})) {
      if (key.toLowerCase().trim() === norm && this.allBomGroupItems[key].length > 0 && this.allBomGroupItems[key][0].defaultUom) {
        return this.allBomGroupItems[key][0].defaultUom;
      }
    }
    if (norm === 'cables') return 'Meter';
    if (norm.includes('structure')) return 'Kg';
    if (norm.includes('civil') || norm.includes('earthing')) return 'Sets';
    return 'Nos';
  }

  populateMaterialGroupRows(): void {
    const currentGroups = this.formRows
      .map(r => (r.value || '').trim())
      .filter(Boolean);

    const baseList = currentGroups.length > 0 
      ? currentGroups 
      : [
          'Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous',
          'Consumables', 'Earthing Protection', 'Module Mounting Structures',
          'Tata SPG Package', 'Waree'
        ];

    this.materialGroupRows = baseList.map(grp => ({
      groupName: grp,
      defaultUom: this.getDefaultUomForGroupName(grp)
    }));
  }

  addMaterialGroupRow(): void {
    this.materialGroupRows.push({
      groupName: '',
      defaultUom: 'Nos'
    });
  }

  removeMaterialGroupRow(index: number): void {
    if (this.materialGroupRows.length === 1) {
      this.materialGroupRows[0].groupName = '';
      return;
    }
    this.materialGroupRows.splice(index, 1);
  }

  loadBomMaterialsData(): void {
    this.loadingBomSpecs = true;
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.grouped) {
          this.allBomGroupItems = res.grouped;
          this.syncBomMaterialGroups();
          this.onBomGroupChange();
        }
        this.loadingBomSpecs = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingBomSpecs = false;
        this.cdr.markForCheck();
      }
    });
  }

  syncBomMaterialGroups(): void {
    const excludedGroups = new Set([
      'mc4', 'mc4 connector', 'lugs', 'bucket', 'structure',
      'earthing & lightning', 'fasteners & hardware', 'transportation & logistics'
    ]);

    const listGroups = this.formRows
      .map(r => (r.value || '').trim())
      .filter(g => g && !excludedGroups.has(g.toLowerCase()));

    const bomList = this.lists.find(l => {
      const t = (l.title || '').toLowerCase().trim();
      return t === 'bom' || t === 'material group' || t === 'materials_';
    });
    const loadedListItems = (bomList?.items || [])
      .map(g => (g || '').trim())
      .filter(g => g && !excludedGroups.has(g.toLowerCase()));

    const dbGroups = Object.keys(this.allBomGroupItems || {})
      .map(g => (g || '').trim())
      .filter(g => g && !excludedGroups.has(g.toLowerCase()));

    const defaultGroups = [
      'Cables', 'Panels', 'Inverters', 'Civil & Miscellaneous',
      'Consumables', 'Earthing Protection', 'Module Mounting Structures',
      'Tata SPG Package', 'Waree'
    ];

    const combined: string[] = [];
    const seen = new Set<string>();

    const addGroup = (g: string) => {
      const clean = (g || '').trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (!excludedGroups.has(lower) && !seen.has(lower)) {
        seen.add(lower);
        combined.push(clean);
      }
    };

    defaultGroups.forEach(addGroup);
    listGroups.forEach(addGroup);
    loadedListItems.forEach(addGroup);
    dbGroups.forEach(addGroup);

    this.bomMaterialGroups = combined;
    if (!this.selectedBomGroup || !seen.has(this.selectedBomGroup.toLowerCase())) {
      this.selectedBomGroup = this.bomMaterialGroups[0] || 'Cables';
    }
  }

  onBomGroupChange(): void {
    const raw = this.allBomGroupItems[this.selectedBomGroup] || [];
    // Determine group GST%: default Panels to 5%, others to 18% unless configured in raw items
    if (raw.length > 0 && raw[0].gstPercent !== undefined && raw[0].gstPercent !== null) {
      this.groupGstPercent = Number(raw[0].gstPercent);
    } else {
      this.groupGstPercent = this.selectedBomGroup === 'Panels' ? 5 : 18;
    }

    if (raw.length > 0) {
      this.bomGroupSpecRows = raw.map(it => ({
        id: it.id,
        categoryType: it.categoryType || (this.selectedBomGroup === 'Cables' ? 'AC Cable' : (this.selectedBomGroup === 'Transportation & Logistics' ? 'Logistics' : 'Standard')),
        specification: it.specification,
        defaultUom: it.defaultUom || (this.selectedBomGroup === 'Cables' ? 'Meter' : (this.selectedBomGroup === 'Transportation & Logistics' ? 'Trip' : 'Nos')),
        unitRate: Number(it.unitRate) || 0,
        gstPercent: it.gstPercent !== undefined && it.gstPercent !== null ? Number(it.gstPercent) : this.groupGstPercent
      }));
    } else {
      this.bomGroupSpecRows = [
        {
          categoryType: this.selectedBomGroup === 'Cables' ? 'AC Cable' : (this.selectedBomGroup === 'Transportation & Logistics' ? 'Logistics' : 'Standard'),
          specification: '',
          defaultUom: this.selectedBomGroup === 'Cables' ? 'Meter' : (this.selectedBomGroup === 'Transportation & Logistics' ? 'Trip' : 'Nos'),
          unitRate: 0,
          gstPercent: this.groupGstPercent
        }
      ];
    }
  }

  onGroupGstChange(): void {
    const gst = Number(this.groupGstPercent) || 0;
    this.bomGroupSpecRows.forEach(r => {
      r.gstPercent = gst;
    });
    if (this.allBomGroupItems[this.selectedBomGroup]) {
      this.allBomGroupItems[this.selectedBomGroup].forEach(it => {
        it.gstPercent = gst;
      });
    }
  }

  addBomSpecRow(): void {
    this.bomGroupSpecRows.push({
      categoryType: this.selectedBomGroup === 'Cables' ? 'AC Cable' : (this.selectedBomGroup === 'Transportation & Logistics' ? 'Logistics' : 'Standard'),
      specification: '',
      defaultUom: this.selectedBomGroup === 'Cables' ? 'Meter' : (this.selectedBomGroup === 'Transportation & Logistics' ? 'Trip' : 'Nos'),
      unitRate: 0,
      gstPercent: this.groupGstPercent
    });
  }

  removeBomSpecRow(index: number): void {
    if (this.bomGroupSpecRows.length === 1) {
      this.bomGroupSpecRows[0].specification = '';
      return;
    }
    this.bomGroupSpecRows.splice(index, 1);
  }

  checkIfBomMaterialsMode(): void {
    const titleNorm = (this.formTitle || '').toLowerCase().trim();
    const hasMatGroupRow = this.mappingRows.some(r => {
      const keyNorm = (r.columnKey || '').toLowerCase().trim();
      return keyNorm === 'inv-materials-group' || keyNorm === 'proj-materials-group';
    });

    if (titleNorm === 'material group' || titleNorm === 'materials group' || titleNorm === 'material_group' || (hasMatGroupRow && titleNorm !== 'bom')) {
      this.isMaterialGroupMode = true;
      this.isBomMaterialsMode = false;
      this.initMaterialGroupRows();
      return;
    }

    this.isMaterialGroupMode = false;
    const hasBomRow = this.mappingRows.some(r => {
      const keyNorm = (r.columnKey || '').toLowerCase().trim();
      return keyNorm === 'inv-bom-specs' || keyNorm === 'proj-bom-specs' || keyNorm === 'bom-materials-group' || keyNorm === 'indent-materials';
    });
    this.isBomMaterialsMode = (titleNorm === 'bom' || titleNorm === 'materials_' || titleNorm.includes('bom') || hasBomRow);
    if (this.isBomMaterialsMode) {
      this.loadBomMaterialsData();
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingId = null;
    this.formRows = [{ value: '' }];
    this.mappingRows = [];
    this.materialGroupRows = [];
    this.isMaterialGroupMode = false;
    this.selectedSectionId = '';
    this.selectedColumnKey = '';
    this.configNoticeText = '';
  }

  // Dynamic Repeating Row Builder: + Add New
  addDescriptionRow(): void {
    this.formRows.push({ value: '' });
  }

  // Row Delete: ✕
  removeDescriptionRow(index: number): void {
    if (this.formRows.length === 1) {
      this.formRows[0].value = '';
      return;
    }
    this.formRows.splice(index, 1);
  }

  saveList(): void {
    if (!this.formTitle.trim()) {
      this.showToast('List / Column Title is required.', 'danger');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'danger');
      return;
    }

    if (this.isMaterialGroupMode) {
      const cleanGroups = this.materialGroupRows.filter(r => r.groupName && r.groupName.trim().length > 0);
      if (cleanGroups.length === 0) {
        this.showToast('Please add at least one Material Group.', 'danger');
        return;
      }

      const groupNames = cleanGroups.map(r => r.groupName.trim());

      // 1. Sync Material Groups & Default UOM with backend
      this.masterListService.syncMaterialGroupsWithUom(cleanGroups).subscribe({
        next: (res) => {
          if (res.success && res.grouped) {
            this.allBomGroupItems = res.grouped;
            this.syncBomMaterialGroups();
          }
        },
        error: (err) => console.error('Error syncing material groups with UOM:', err)
      });

      // 2. Save to MasterList table
      const payload = {
        title: this.formTitle.trim(),
        category: this.formCategory,
        description: this.formDescription.trim(),
        items: groupNames
      };

      const op = (this.isEditMode && this.editingId)
        ? this.masterListService.updateList(this.editingId, payload)
        : this.masterListService.createList(payload);

      op.subscribe({
        next: () => {
          this.showToast(`Saved Material Groups (${cleanGroups.length} groups with Default UOM) successfully!`, 'success');
          this.closeModal();
          this.loadLists();
        },
        error: (err) => {
          this.showToast(err.error?.message || 'Failed to save configuration list.', 'danger');
        }
      });
      return;
    }

    if (this.isBomMaterialsMode) {
      const cleanSpecs = this.bomGroupSpecRows.filter(r => r.specification && r.specification.trim().length > 0);
      const cleanItems = this.formRows
        .map(r => r.value.trim())
        .filter(Boolean);

      // 1. Save specs for currently selected group if any exist
      if (cleanSpecs.length > 0) {
        this.masterListService.saveBomMaterialGroupSpecs(this.selectedBomGroup, cleanSpecs, this.groupGstPercent).subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this.allBomGroupItems[this.selectedBomGroup] = res.data;
            }
          },
          error: (err) => console.error('Error saving BOM specs:', err)
        });
      }

      // 2. Also save/update MasterList options (so the user's groups in Screenshot 4 are saved to Database!)
      if (cleanItems.length > 0) {
        const payload = {
          title: this.formTitle.trim(),
          category: this.formCategory,
          description: this.formDescription.trim(),
          items: cleanItems
        };
        const op = (this.isEditMode && this.editingId)
          ? this.masterListService.updateList(this.editingId, payload)
          : this.masterListService.createList(payload);

        op.subscribe({
          next: () => {
            this.showToast(`Saved "${this.formTitle}" with ${cleanItems.length} groups and updated "${this.selectedBomGroup}" specifications!`, 'success');
            this.closeModal();
            this.loadLists();
          },
          error: (err) => {
            this.showToast(err.error?.message || 'Failed to save configuration list.', 'danger');
          }
        });
        return;
      } else {
        this.showToast(`BOM Specifications for "${this.selectedBomGroup}" updated!`, 'success');
        this.closeModal();
        this.loadLists();
        return;
      }
    }

    const cleanItems = this.formRows
      .map(r => r.value.trim())
      .filter(Boolean);

    if (cleanItems.length === 0) {
      this.showToast('Please provide at least one description/option item.', 'danger');
      return;
    }

    const payload = {
      title: this.formTitle.trim(),
      category: this.formCategory,
      description: this.formDescription.trim(),
      items: cleanItems
    };

    if (this.isEditMode && this.editingId) {
      this.masterListService.updateList(this.editingId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast(`Configuration for "${res.data.title}" updated successfully (${cleanItems.length} options)!`, 'success');
            this.closeModal();
            this.loadLists();
          }
        },
        error: (err) => {
          console.error('Error updating list:', err);
          this.showToast(err.error?.message || 'Failed to update configuration list.', 'danger');
        }
      });
    } else {
      this.masterListService.createList(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast(`New configuration for "${res.data.title}" created successfully (${cleanItems.length} options)!`, 'success');
            this.closeModal();
            this.loadLists();
          }
        },
        error: (err) => {
          console.error('Error creating list:', err);
          this.showToast(err.error?.message || 'Failed to create configuration list.', 'danger');
        }
      });
    }
  }

  confirmDelete(list: MasterList): void {
    if (!list.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete configuration lists.', 'danger');
      return;
    }
    if (confirm(`Are you sure you want to delete the configuration list "${list.title}" with all its ${list.items?.length || 0} items?`)) {
      this.masterListService.deleteList(list.id).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast(`Configuration list "${list.title}" deleted.`, 'info');
            this.loadLists();
          }
        },
        error: (err) => {
          console.error('Error deleting list:', err);
          this.showToast('Failed to delete list.', 'danger');
        }
      });
    }
  }

  showToast(message: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.toastMessage === message) {
        this.toastMessage = '';
        this.cdr.markForCheck();
      }
    }, 4500);
  }
}
