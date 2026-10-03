import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MasterListService, MasterList } from '../../../services/master-list.service';
import { AuthService } from '../../../services/auth.service';

export interface FormRow {
  value: string;
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
          columnName: 'Order By',
          listTitle: 'Order_By',
          category: 'Projects',
          description: 'Originating reference or booking authority',
          defaultOptions: ['Dinesh Kumar', 'Office', 'Self']
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
          columnName: 'Bill of Materials (BOM)',
          listTitle: 'BOM',
          category: 'Inventory',
          description: 'Material categories and groups for Bill of Materials (BOM) Cost Sheet allocation',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'MC4 Connector', 'Lugs', 'Bucket', 'Structure', 'Earthing & Lightning', 'Fasteners & Hardware']
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
      id: 'inventory-all',
      group: 'Inventory',
      title: 'Inventory & BOM (Materials Group, Warehouse, Indent)',
      icon: 'bi-box-seam',
      badgeColor: '#0f766e',
      columns: [
        {
          key: 'inv-materials-group',
          columnName: 'Bill of Materials (BOM)',
          listTitle: 'BOM',
          category: 'Inventory',
          description: 'Material Groups (Cables, Panels, Inverters, MC4 Connector, Lugs, Bucket, Structure, Earthing & Lightning, Fasteners & Hardware) for BOM Cost Sheet allocation',
          defaultOptions: ['Cables', 'Panels', 'Inverters', 'MC4 Connector', 'Lugs', 'Bucket', 'Structure', 'Earthing & Lightning', 'Fasteners & Hardware']
        },
        {
          key: 'inv-materials',
          columnName: 'Material / Stock Categories',
          listTitle: 'Materials',
          category: 'Inventory',
          description: 'Complete materials, consumables and tools catalog for Indent, Warehouse, Gate Pass and Cart',
          defaultOptions: ['Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables', 'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower', 'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport', 'Panles Cleaning Liquid', 'Petrol Cliam', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works', 'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package', 'Walkway / Hand Rails', 'Zero Export Device', 'Tools Asset', 'Safety Certificates']
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

  // Reverse mapping helper for table display
  getMappedInfo(list: MasterList): { sectionTitle: string; columnName: string; icon: string; badgeColor: string } {
    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const listNorm = norm(list.title);

    for (const sec of this.sidebarSections) {
      for (const col of sec.columns) {
        if (norm(col.listTitle) === listNorm) {
          return {
            sectionTitle: `${sec.title}`,
            columnName: col.columnName,
            icon: sec.icon,
            badgeColor: sec.badgeColor
          };
        }
      }
    }

    return {
      sectionTitle: list.category || 'General',
      columnName: list.title,
      icon: 'bi-tag',
      badgeColor: '#64748b'
    };
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

  onSectionChange(): void {
    if (this.selectedSectionId === 'custom') {
      this.isCustomColumn = true;
      this.selectedColumnKey = '__CUSTOM__';
      this.formTitle = '';
      this.formCategory = 'General';
      this.formDescription = '';
      this.formRows = [{ value: '' }];
      this.configNoticeText = 'Define a custom column title and add your desired options.';
      this.configNoticeType = 'new';
      return;
    }

    this.isCustomColumn = false;
    this.selectedColumnKey = '';
    const section = this.selectedSection;
    if (section && section.columns.length > 0) {
      this.selectedColumnKey = section.columns[0].key;
      this.onColumnChange();
    } else {
      this.configNoticeText = '';
      this.configNoticeType = '';
    }
  }

  onColumnChange(): void {
    if (this.selectedColumnKey === '__CUSTOM__') {
      this.isCustomColumn = true;
      this.formTitle = '';
      this.formCategory = this.selectedSection?.group || 'General';
      this.formDescription = '';
      this.formRows = [{ value: '' }];
      this.configNoticeText = 'Create a custom column for this section and specify options.';
      this.configNoticeType = 'new';
      this.isEditMode = false;
      this.editingId = null;
      return;
    }

    this.isCustomColumn = false;
    const col = this.availableColumns.find(c => c.key === this.selectedColumnKey);
    if (!col) return;

    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const targetNorm = norm(col.listTitle);
    const existingList = this.lists.find(l => norm(l.title) === targetNorm);

    if (existingList) {
      this.isEditMode = true;
      this.editingId = existingList.id || null;
      this.formTitle = existingList.title;
      this.formCategory = existingList.category || col.category;
      this.formDescription = existingList.description || col.description;
      if (existingList.items && existingList.items.length > 0) {
        this.formRows = existingList.items.map(it => ({ value: it }));
      } else {
        this.formRows = [{ value: '' }];
      }
      this.configNoticeText = `✓ Existing configuration loaded with ${this.formRows.length} options. You can edit, add, or delete options below.`;
      this.configNoticeType = 'existing';
    } else {
      this.isEditMode = false;
      this.editingId = null;
      this.formTitle = col.listTitle;
      this.formCategory = col.category;
      this.formDescription = col.description;
      this.formRows = col.defaultOptions.map(it => ({ value: it }));
      this.configNoticeText = `✨ New configuration for this column. Pre-populated with ${this.formRows.length} standard options. You can customize them before saving.`;
      this.configNoticeType = 'new';
    }
    this.checkIfBomMaterialsMode();
  }

  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add configuration lists.', 'danger');
      return;
    }
    this.isEditMode = false;
    this.editingId = null;
    this.selectedSectionId = 'activity-calls'; // Default to Calls as requested by the user
    this.isCustomColumn = false;
    this.onSectionChange();
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

    // Reverse lookup section and column
    const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
    const listNorm = norm(list.title);
    let matched = false;

    for (const sec of this.sidebarSections) {
      for (const col of sec.columns) {
        if (norm(col.listTitle) === listNorm) {
          this.selectedSectionId = sec.id;
          this.selectedColumnKey = col.key;
          this.isCustomColumn = false;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      this.selectedSectionId = 'custom';
      this.selectedColumnKey = '__CUSTOM__';
      this.isCustomColumn = true;
    }

    if (list.items && list.items.length > 0) {
      this.formRows = list.items.map(it => ({ value: it }));
    } else {
      this.formRows = [{ value: '' }];
    }

    this.configNoticeText = `Editing list "${list.title}" with ${this.formRows.length} configured options.`;
    this.configNoticeType = 'existing';
    this.checkIfBomMaterialsMode();
    this.isModalOpen = true;
  }

  // --- HIERARCHICAL BOM MATERIAL MASTER STATE & METHODS ---
  isBomMaterialsMode = false;
  bomMaterialGroups: string[] = ['Cables', 'Panels', 'Inverters', 'MC4 Connector', 'Lugs', 'Bucket', 'Structure', 'Earthing & Lightning', 'Fasteners & Hardware'];
  selectedBomGroup: string = 'Cables';
  allBomGroupItems: { [key: string]: { id?: number; categoryType: string; specification: string; defaultUom: string; unitRate: number }[] } = {};
  bomGroupSpecRows: { id?: number; categoryType: string; specification: string; defaultUom: string; unitRate: number }[] = [];
  loadingBomSpecs = false;

  loadBomMaterialsData(): void {
    this.loadingBomSpecs = true;
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.grouped) {
          this.allBomGroupItems = res.grouped;
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

  onBomGroupChange(): void {
    const raw = this.allBomGroupItems[this.selectedBomGroup] || [];
    if (raw.length > 0) {
      this.bomGroupSpecRows = raw.map(it => ({
        id: it.id,
        categoryType: it.categoryType || (this.selectedBomGroup === 'Cables' ? 'AC Cable' : 'Standard'),
        specification: it.specification,
        defaultUom: it.defaultUom || (this.selectedBomGroup === 'Cables' ? 'Meter' : 'Nos'),
        unitRate: Number(it.unitRate) || 0
      }));
    } else {
      this.bomGroupSpecRows = [
        {
          categoryType: this.selectedBomGroup === 'Cables' ? 'AC Cable' : 'Standard',
          specification: '',
          defaultUom: this.selectedBomGroup === 'Cables' ? 'Meter' : 'Nos',
          unitRate: 0
        }
      ];
    }
  }

  addBomSpecRow(): void {
    this.bomGroupSpecRows.push({
      categoryType: this.selectedBomGroup === 'Cables' ? 'AC Cable' : 'Standard',
      specification: '',
      defaultUom: this.selectedBomGroup === 'Cables' ? 'Meter' : 'Nos',
      unitRate: 0
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
    const keyNorm = (this.selectedColumnKey || '').toLowerCase().trim();
    this.isBomMaterialsMode = (titleNorm === 'bom' || titleNorm === 'materials_' || keyNorm === 'inv-materials-group' || keyNorm === 'proj-materials-group');
    if (this.isBomMaterialsMode) {
      this.loadBomMaterialsData();
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingId = null;
    this.formRows = [{ value: '' }];
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

    if (this.isBomMaterialsMode) {
      const cleanSpecs = this.bomGroupSpecRows.filter(r => r.specification && r.specification.trim().length > 0);
      if (cleanSpecs.length === 0) {
        this.showToast(`Please enter at least one specification for "${this.selectedBomGroup}".`, 'danger');
        return;
      }
      this.masterListService.saveBomMaterialGroupSpecs(this.selectedBomGroup, cleanSpecs).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast(`BOM Specifications for "${this.selectedBomGroup}" saved to Database (${cleanSpecs.length} items)!`, 'success');
            this.closeModal();
            this.loadLists();
          }
        },
        error: (err) => {
          this.showToast(err.error?.message || 'Failed to save BOM material specs.', 'danger');
        }
      });
      return;
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
