import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ProjectService } from '../../services/project.service';
import { Project, SummaryMetrics, ClientPayment, BomItem } from '../../models/project.model';

import { RouterModule, Router } from '@angular/router';
import { MasterListService } from '../../services/master-list.service';
import { AuthService } from '../../services/auth.service';
import { OfficeService } from '../../services/office.service';

interface FilterOption {
  label: string;
  selected: boolean;
}

@Component({
  selector: 'app-project-master',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-master.component.html',
  styleUrls: ['./project-master.component.css']
})
export class ProjectMasterComponent implements OnInit, OnDestroy, AfterViewInit {
  private projectService = inject(ProjectService);
  private masterListService = inject(MasterListService);
  public authService = inject(AuthService);
  private officeService = inject(OfficeService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  isAwardedSitesView = false;

  canAdd(): boolean {
    return this.authService.canAdd('awarded-sites') || this.authService.canAdd('sales');
  }

  canEdit(): boolean {
    return this.authService.canEdit('awarded-sites') || this.authService.canEdit('sales');
  }

  canDelete(): boolean {
    return this.authService.canDelete('awarded-sites') || this.authService.canDelete('sales');
  }

  projects: Project[] = [];
  filteredProjects: Project[] = [];
  metrics: SummaryMetrics | null = null;
  loading = false;
  errorMsg = '';
  successMsg = '';

  // Top Horizontal Scrollbar Elements & State
  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('topScrollContainer') topScrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('dataTable') dataTable!: ElementRef<HTMLTableElement>;

  tableScrollWidth = 4600;
  private isSyncingScroll = false;
  private resizeObserver: ResizeObserver | null = null;

  // Chart Instances & Modes
  financialChart: Chart | null = null;
  financialChartMode: 'bar' | 'pie' = 'bar'; // Default to bar graph for Financial distribution as requested
  progressChart: Chart | null = null;

  // Global search
  searchTerm = '';

  // Dropdown filter configurations matching user screenshots
  // Dropdown filter configurations matching user requirements:
  // Site Type: Residential, Industrial, Ground Mount
  siteTypeOptions: FilterOption[] = [
    { label: 'Residential', selected: true },
    { label: 'Industrial', selected: true },
    { label: 'Ground Mount', selected: true },
    { label: 'Commercial', selected: true }
  ];
  siteTypeSearch = '';
  siteTypeFilterOpen = false;

  // System Type: Ongrid, offgrid, Hybrid
  systemTypeOptions: FilterOption[] = [
    { label: 'Ongrid', selected: true },
    { label: 'offgrid', selected: true },
    { label: 'Hybrid', selected: true }
  ];
  systemTypeSearch = '';
  systemTypeFilterOpen = false;

  // Site Category: TATA SPG, Waree, Premier, Other
  siteCategoryOptions: FilterOption[] = [
    { label: 'TATA SPG', selected: true },
    { label: 'Waree', selected: true },
    { label: 'Premier', selected: true },
    { label: 'Other', selected: true }
  ];
  siteCategorySearch = '';
  siteCategoryFilterOpen = false;

  // Pagination for Project Master Table (defaults to minimum 20 records per page)
  currentPage = 1;
  pageSize: number | 'All' = 20;
  pageSizeOptions: (number | 'All')[] = [20, 50, 100, 'All'];

  // Client Details Modal & Chart State
  isDetailsModalOpen = false;
  selectedProject: Project | null = null;

  // Client Type: Individual, Company, Institutional
  clientTypeOptions: FilterOption[] = [
    { label: 'Individual', selected: true },
    { label: 'Company', selected: true },
    { label: 'Institutional', selected: true }
  ];
  clientTypeSearch = '';
  clientTypeFilterOpen = false;

  // Site ID Sort State: 'desc' (big to small - default) | 'asc' (small to big)
  siteIdSortDirection: 'asc' | 'desc' | 'none' = 'desc';

  // Order By
  orderByOptions: FilterOption[] = [
    { label: 'K KARTHIKEYAN', selected: true },
    { label: 'K SATHISH', selected: true },
    { label: 'S KARTHIKEYAN', selected: true },
    { label: 'SOUNDARARAJAN M', selected: true },
    { label: 'V SHARATH', selected: true }
  ];
  orderBySearch = '';
  orderByFilterOpen = false;

  // Dynamic Master List Option Arrays (Managed via Office -> Add List)
  masterSiteTypes: string[] = ['Car Port', 'Commercial', 'Floating', 'Ground Mount', 'Industrial', 'Residential', 'Residential Common'];
  saleTypeOptions: string[] = ['B2C', 'Direct B2B', 'Retailer B2B'];
  masterClientTypes: string[] = ['Assosiation', 'Company', 'Govt. Org', 'Individual', 'Institutional'];
  masterSystemTypes: string[] = ['On Grid', 'Off Grid', 'Hybrid', 'Solar Pump'];
  masterSiteCategories: string[] = ['TATA SPG', 'Waaree', 'Premier', 'Other'];
  siteStageOptions: string[] = ['EB Work in Process', 'Handed Over', 'I&C Completed', 'Installation Inprocess', 'Material Procurement', 'Project Awarded', 'Site Commissioned'];
  siteStatusOptions: string[] = ['Not Started', 'Materials Supplied', 'I&C Completed', 'EB Work in Process', 'Site Commissioned', 'Handed Over'];
  invoiceTypeOptions: string[] = ['Material Supply', 'I&C Works', 'CEIG Documentation', 'Supply and I&C work'];
  invoiceStatusOptions: string[] = ['Billed', 'Partly Billed', 'Not Billed'];
  paymentModeOptions: string[] = ['Bank Transfer / NEFT', 'Bank Transfer / IMPS', 'Cheque / DD', 'UPI', 'Bank Deposit'];

  normalizeSystemType(val?: string): string {
    if (!val || !val.trim()) return 'On Grid';
    const clean = val.trim();
    const lower = clean.toLowerCase().replace(/[\s_-]+/g, '');
    if (lower === 'ongrid' || lower === 'ongird' || lower === 'grid') return 'On Grid';
    if (lower === 'offgrid' || lower === 'offgird') return 'Off Grid';
    if (lower === 'hybrid') return 'Hybrid';
    if (lower === 'solarpump' || lower === 'pump') return 'Solar Pump';
    return clean;
  }

  normalizeSiteCategory(val?: string): string {
    if (!val || !val.trim()) return 'TATA SPG';
    const clean = val.trim();
    const lower = clean.toLowerCase();
    if (lower.includes('tata') || lower.includes('spg')) return 'TATA SPG';
    if (lower.includes('waree') || lower.includes('waaree')) return 'Waaree';
    if (lower.includes('premier')) return 'Premier';
    return clean;
  }

  closingValueTolerance: number = 100;

  getPaymentStatusInfo(project: Partial<Project>): { label: string; isPaid: boolean; remainingDue: number } {
    const val = Number(project.siteValue) || 0;
    const rec = Number(project.received) || 0;
    const rawDue = val - rec;
    const tolerance = this.closingValueTolerance || 100;

    if (rawDue <= tolerance) {
      return { label: 'Fully Paid', isPaid: true, remainingDue: 0 };
    } else {
      return { label: 'Due Recoverable', isPaid: false, remainingDue: rawDue };
    }
  }

  loadMasterListOptions(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
            const normalize = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
            const findItems = (title: string, def: string[]) => {
              const target = normalize(title);
              const match = res.data.find(l => normalize(l.title) === target);
              return match && match.items && match.items.length > 0 ? match.items : def;
            };
          this.masterSiteTypes = findItems('Site_Type', this.masterSiteTypes);
          this.saleTypeOptions = findItems('Sale_Type', this.saleTypeOptions);
          this.masterClientTypes = findItems('Client_Type', this.masterClientTypes);
          this.masterSystemTypes = findItems('Sys_Type', this.masterSystemTypes);
          this.siteStageOptions = findItems('Site Stage', this.siteStageOptions);
          this.siteStatusOptions = findItems('Site Status', this.siteStatusOptions);
          this.invoiceTypeOptions = findItems('Invoice Type', this.invoiceTypeOptions);
          
          const closingItems = findItems('Closing Value', ['100']);
          if (closingItems && closingItems.length > 0) {
            const num = parseFloat(closingItems[0]);
            if (!isNaN(num) && num >= 0) this.closingValueTolerance = num;
          }
          this.invoiceStatusOptions = findItems('Invoice Status', this.invoiceStatusOptions);
          this.paymentModeOptions = findItems('Payment Mode', this.paymentModeOptions);

          const uomMatch = res.data.find(l => {
            const t = normalize(l.title);
            return t === 'uommeasurements' || t === 'uom';
          });
          if (uomMatch && uomMatch.items && uomMatch.items.length > 0) {
            this.uomOptions = [...uomMatch.items];
          }

          const engineerItems = findItems('Engineer', findItems('Order_By', ['K KARTHIKEYAN', 'K SATHISH', 'S KARTHIKEYAN', 'SOUNDARARAJAN M', 'V SHARATH', 'Ramesh']));
          if (engineerItems && engineerItems.length > 0) {
            const currentLabels = this.orderByOptions.map(o => o.label);
            const combined = Array.from(new Set([...engineerItems, ...currentLabels]));
            this.orderByOptions = combined.map(lbl => ({ label: lbl, selected: true }));
          }

          const leadHandlerItems = findItems('Leads Name', findItems('Lead Handlers', findItems('Sales Team', [])));
          if (leadHandlerItems && leadHandlerItems.length > 0) {
            this.salesTeamOptions = Array.from(new Set([...leadHandlerItems, ...this.salesTeamOptions]));
          }

          const dbMatGroups = findItems('BOM', findItems('Material Group', findItems('Materials_', [])));
          if (dbMatGroups && dbMatGroups.length > 0) {
            dbMatGroups.forEach(gName => {
              const cleanG = (gName || '').trim();
              if (cleanG) {
                const exists = this.materialGroupsList.some(m => m.group.toLowerCase().trim() === cleanG.toLowerCase());
                if (!exists) {
                  this.materialGroupsList.push({
                    group: cleanG,
                    defaultUom: 'Nos',
                    specifications: [`${cleanG} Standard Spec`]
                  });
                }
              }
            });
          }

          // Dynamic Specifications Mapping from Add List Master Lists
          const cableSpecs = findItems('Material_Specs_Cables', []);
          if (cableSpecs.length > 0) {
            const cablesGrp = this.materialGroupsList.find(m => m.group.toLowerCase() === 'cables');
            if (cablesGrp) cablesGrp.specifications = Array.from(new Set([...cableSpecs, ...cablesGrp.specifications]));
          }

          const panelSpecs = findItems('Material_Specs_Panels', []);
          if (panelSpecs.length > 0) {
            const panelsGrp = this.materialGroupsList.find(m => m.group.toLowerCase() === 'panels');
            if (panelsGrp) panelsGrp.specifications = Array.from(new Set([...panelSpecs, ...panelsGrp.specifications]));
          }

          const invSpecs = findItems('Material_Specs_Inverters', []);
          if (invSpecs.length > 0) {
            const invGrp = this.materialGroupsList.find(m => m.group.toLowerCase() === 'inverters');
            if (invGrp) invGrp.specifications = Array.from(new Set([...invSpecs, ...invGrp.specifications]));
          }

          const lugSpecs = findItems('Material_Specs_Lugs', []);
          if (lugSpecs.length > 0) {
            const lugGrp = this.materialGroupsList.find(m => m.group.toLowerCase() === 'lugs');
            if (lugGrp) lugGrp.specifications = Array.from(new Set([...lugSpecs, ...lugGrp.specifications]));
          }

          const mc4Specs = findItems('Material_Specs_MC4', []);
          if (mc4Specs.length > 0) {
            const mc4Grp = this.materialGroupsList.find(m => m.group.toLowerCase().includes('mc4'));
            if (mc4Grp) mc4Grp.specifications = Array.from(new Set([...mc4Specs, ...mc4Grp.specifications]));
          }

          this.cdr.markForCheck();
        }
      }
    });
  }

  salesTeamOptions: string[] = ['Renuka', 'Daya'];

  loadSalesTeamOptions(): void {
    const cached = this.officeService.getCachedEmployees();
    if (cached && cached.length > 0) {
      this.extractSalesTeam(cached);
    } else {
      this.officeService.getEmployees().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.extractSalesTeam(res.data);
          }
        },
        error: () => {}
      });
    }
  }

  private extractSalesTeam(emps: any[]): void {
    const sales = emps
      .filter(e => (e.responsibility || '').toLowerCase().includes('sales') || (e.designation || '').toLowerCase().includes('sales'))
      .map(e => e.name);
    if (sales.length > 0) {
      this.salesTeamOptions = Array.from(new Set(sales));
    }
  }

  // Modal State
  isModalOpen = false;
  isEditMode = false;
  currentProjectId: number | null = null;
  modalTab: 'basic' | 'config' | 'finance' | 'milestones' | 'bom' = 'basic';

  // Form Model
  projectForm: Partial<Project> = this.getEmptyProject();

  // --- BOM & COST SHEET STATE & HELPER METHODS ---
  formBomItems: BomItem[] = [];

  materialGroupsList: { group: string; defaultUom: string; specifications: string[] }[] = [
    {
      group: 'Cables',
      defaultUom: 'Meter',
      specifications: ['AC - 4Sqmm', 'AC - 6Sqmm', 'AC - 10Sqmm', 'AC - 16Sqmm', 'AC - 25Sqmm', 'DC - XLPO 4Sqmm', 'DC - XLPO 6Sqmm', 'DC - 10Sqmm']
    },
    {
      group: 'Panels',
      defaultUom: 'Nos',
      specifications: ['540W Mono PERC', '550W Mono PERC', '580W TOPCon', '335W Polycrystalline', '340W Polycrystalline']
    },
    {
      group: 'Inverters',
      defaultUom: 'Nos',
      specifications: ['3kW Ongrid', '5kW Ongrid', '10kW Ongrid', '15kW Ongrid', '20kW Ongrid', '5kW Hybrid', '10kW Hybrid']
    },
    {
      group: 'Civil & Miscellaneous',
      defaultUom: 'Nos',
      specifications: ['General Civil Work', 'Masonry & Foundation', 'Waterproofing & Sealing', 'Minor Site Modifications']
    },
    {
      group: 'Consumables',
      defaultUom: 'Nos',
      specifications: ['PVC Conduit Accessories', 'Chemical Earthing Compound', 'Cable Ties UV Rated', 'Insulation Tapes & Glands']
    },
    {
      group: 'Earthing Protection',
      defaultUom: 'Sets',
      specifications: ['Copper Bonded Chemical Rod 50mm', 'ESE Lightning Arrester Kit', 'GI Flat Strip 25x3mm', 'Earthing Pit & Chamber']
    },
    {
      group: 'Module Mounting Structures',
      defaultUom: 'Kg',
      specifications: ['HDG Rooftop High Structure', 'Aluminium Rail Profile', 'Elevated Super Structure', 'Car Port Canopy Frame']
    },
    {
      group: 'Tata SPG Package',
      defaultUom: 'Nos',
      specifications: ['Complete TATA SPG 3kW Kit', 'Complete TATA SPG 5kW Kit', 'Complete TATA SPG 10kW Kit', 'TATA SPG Balance of System']
    },
    {
      group: 'Waree',
      defaultUom: 'Nos',
      specifications: ['Waaree Solar Panels Kit', 'Waaree Inverter Package', 'Waaree Complete Plant System']
    }
  ];

  uomOptions: string[] = ['Meter', 'Sets', 'Nos', 'Kg', 'Pcs', 'Pair', 'Box', 'Packet', 'Coil', 'Watts'];
  expenseSourceOptions: string[] = ['PO', 'WO', 'Petty Cash', 'Accounts', 'Warehouse', 'Other'];

  bomMaterialsMasterList: any[] = [];

  loadBomMaterialsMaster(): void {
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.bomMaterialsMasterList = res.data;
          this.syncMaterialGroupsFromBomMaster();
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  syncMaterialGroupsFromBomMaster(): void {
    if (!this.bomMaterialsMasterList || this.bomMaterialsMasterList.length === 0) return;

    const grouped: { [key: string]: { defaultUom?: string; specs: string[] } } = {};
    for (const item of this.bomMaterialsMasterList) {
      const grp = (item.groupName || '').trim();
      if (!grp) continue;
      if (!grouped[grp]) {
        grouped[grp] = { defaultUom: item.defaultUom || 'Nos', specs: [] };
      }
      if (item.defaultUom) grouped[grp].defaultUom = item.defaultUom;
      if (item.specification && !grouped[grp].specs.includes(item.specification)) {
        grouped[grp].specs.push(item.specification);
      }
    }

    Object.keys(grouped).forEach(grpName => {
      const existing = this.materialGroupsList.find(m => m.group.toLowerCase().trim() === grpName.toLowerCase().trim());
      if (existing) {
        if (grouped[grpName].defaultUom) existing.defaultUom = grouped[grpName].defaultUom!;
        if (grouped[grpName].specs.length > 0) {
          existing.specifications = Array.from(new Set([...existing.specifications, ...grouped[grpName].specs]));
        }
      } else {
        this.materialGroupsList.push({
          group: grpName,
          defaultUom: grouped[grpName].defaultUom || 'Nos',
          specifications: grouped[grpName].specs.length > 0 ? grouped[grpName].specs : [`${grpName} Standard Spec`]
        });
      }
    });
  }

  getAvailableCategoryTypes(groupName: string): string[] {
    const normGrp = (groupName || '').toLowerCase().trim();
    const matches = this.bomMaterialsMasterList.filter(b => b.groupName.toLowerCase().trim() === normGrp);
    if (matches.length > 0) {
      const types = Array.from(new Set(matches.map(m => m.categoryType || 'Standard')));
      return types;
    }
    if (normGrp === 'cables') return ['AC Cable', 'DC Cable'];
    if (normGrp === 'panels') return ['Mono PERC', 'TOPCon', 'Polycrystalline'];
    if (normGrp === 'inverters') return ['On Grid', 'Hybrid'];
    if (normGrp === 'lugs') return ['Cu Lug', 'Al Lug', 'Pin Lug', 'Ring Lug'];
    return ['Standard'];
  }

  getAvailableSpecsForType(groupName: string, categoryType: string): string[] {
    const normGrp = (groupName || '').toLowerCase().trim();
    const normType = (categoryType || '').toLowerCase().trim();
    
    let matches = this.bomMaterialsMasterList.filter(b => b.groupName.toLowerCase().trim() === normGrp);
    if (normType && normType !== 'standard') {
      const filtered = matches.filter(b => (b.categoryType || '').toLowerCase().trim() === normType);
      if (filtered.length > 0) matches = filtered;
    }
    
    if (matches.length > 0) {
      return Array.from(new Set(matches.map(m => m.specification)));
    }
    
    return this.getAvailableSpecs(groupName);
  }

  getAvailableSpecs(groupName: string): string[] {
    const match = this.materialGroupsList.find(m => m.group.toLowerCase().trim() === (groupName || '').toLowerCase().trim());
    return match ? match.specifications : ['Standard Spec'];
  }

  getDefaultGstForGroup(groupName: string): number {
    const norm = (groupName || '').toLowerCase().trim();
    const match = this.bomMaterialsMasterList.find(b => (b.groupName || '').toLowerCase().trim() === norm);
    if (match && match.gstPercent !== undefined && match.gstPercent !== null) {
      return Number(match.gstPercent);
    }
    if (norm === 'panels') return 5;
    return 18;
  }

  onMaterialGroupChange(item: BomItem): void {
    const grp = item.materialGroup;
    if (!grp) {
      item.categoryType = '';
      item.specification = '';
      item.uom = 'Nos';
      this.recalculateBomItem(item);
      return;
    }
    const types = this.getAvailableCategoryTypes(grp);
    item.categoryType = types[0] || 'Standard';
    
    const specs = this.getAvailableSpecsForType(grp, item.categoryType);
    item.specification = specs[0] || '';

    const match = this.materialGroupsList.find(m => m.group.toLowerCase().trim() === (grp || '').toLowerCase().trim());
    if (match) {
      item.uom = match.defaultUom;
    }
    item.gstPercent = this.getDefaultGstForGroup(grp);
    this.recalculateBomItem(item);
  }

  onCategoryTypeChange(item: BomItem): void {
    const specs = this.getAvailableSpecsForType(item.materialGroup, item.categoryType || '');
    if (specs.length > 0) {
      item.specification = specs[0];
    }
    this.onSpecificationChange(item);
  }

  onSpecificationChange(item: BomItem): void {
    if (item.materialGroup && item.specification) {
      const match = this.bomMaterialsMasterList.find(b =>
        (b.groupName || '').toLowerCase().trim() === (item.materialGroup || '').toLowerCase().trim() &&
        (b.specification || '').toLowerCase().trim() === (item.specification || '').toLowerCase().trim() &&
        (!item.categoryType || (b.categoryType || '').toLowerCase().trim() === (item.categoryType || '').toLowerCase().trim() || (b.categoryType || '').toLowerCase().trim() === 'standard')
      );
      if (match) {
        if (match.defaultUom) item.uom = match.defaultUom;
        if (match.unitRate && (!item.unitRate || item.unitRate === 0)) item.unitRate = match.unitRate;
        if (match.gstPercent !== undefined && match.gstPercent !== null) item.gstPercent = Number(match.gstPercent);
      }
    }
    this.recalculateBomItem(item);
  }

  recalculateBomItem(item: BomItem): void {
    const qty = Number(item.plannedQty) || 0;
    const rate = Number(item.unitRate) || 0;
    item.estimatedTotalCost = Number((qty * rate).toFixed(2));

    if (item.gstPercent === undefined || item.gstPercent === null) {
      item.gstPercent = this.getDefaultGstForGroup(item.materialGroup);
    }
    const gstRate = Number(item.gstPercent) || 0;
    item.gstAmount = Number(((item.estimatedTotalCost * gstRate) / 100).toFixed(2));
    item.estAmount = Number((item.estimatedTotalCost + item.gstAmount).toFixed(2));
  }

  getBomDispatchStatus(item: BomItem): 'full' | 'part' | 'none' {
    const planned = Number(item.plannedQty) || 0;
    const dispatched = Number(item.dispatchedQty !== undefined ? item.dispatchedQty : item.warehouseUnitsDrawn) || 0;
    if (planned > 0 && dispatched >= planned) return 'full';
    if (dispatched > 0 && dispatched < planned) return 'part';
    return 'none';
  }

  getBomDispatchedQty(item: BomItem): number {
    return Number(item.dispatchedQty !== undefined ? item.dispatchedQty : item.warehouseUnitsDrawn) || 0;
  }

  expandedBomRowIndex: number | null = null;

  toggleBomRowExpand(index: number): void {
    this.expandedBomRowIndex = this.expandedBomRowIndex === index ? null : index;
    this.cdr.markForCheck();
  }

  isBomBudgetExceeded(item: BomItem): boolean {
    const est = Number(item.estAmount || item.estimatedTotalCost) || 0;
    const act = Number(item.allocatedExpenseAmount) || 0;
    return est > 0 && act > est;
  }

  getBomExpenseWarningMessage(item: BomItem): string {
    const est = Number(item.estAmount || item.estimatedTotalCost) || 0;
    const act = Number(item.allocatedExpenseAmount) || 0;
    if (est > 0 && act > est) {
      const diff = act - est;
      return `⚠️ Checkpoint Warning: Expenses (₹ ${act.toLocaleString('en-IN')}) exceed estimated BOM budget (₹ ${est.toLocaleString('en-IN')}) by ₹ ${diff.toLocaleString('en-IN')}!`;
    }
    return '';
  }

  trackBillRef(item: BomItem): void {
    if (!item.invoiceRef || !item.invoiceRef.trim()) {
      this.showToast('Please enter a Bill / Invoice Reference No. to track.', 'error');
      return;
    }
    const bill = item.invoiceRef.trim();
    const src = item.expenseSource || 'Warehouse';
    this.showToast(`Tracking Bill ${bill} (${src}): Linked to client expense & PO/WO disbursements. Total allocated: ₹ ${(item.allocatedExpenseAmount || 0).toLocaleString('en-IN')}`, 'success');
  }

  addBomItem(): void {
    const newItem: BomItem = {
      id: 'bom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      materialGroup: '',
      categoryType: '',
      specification: '',
      uom: 'Nos',
      plannedQty: 0,
      unitRate: 0,
      estimatedTotalCost: 0,
      gstPercent: 18,
      gstAmount: 0,
      estAmount: 0,
      allocatedExpenseAmount: 0,
      expenseSource: 'PO',
      invoiceRef: '',
      warehouseUnitsDrawn: 0,
      isDispatched: false,
      dispatchedQty: 0,
      dispatchDate: '',
      remarks: ''
    };
    this.formBomItems.push(newItem);
    this.expandedBomRowIndex = this.formBomItems.length - 1;
  }

  clearAllBomItems(): void {
    if (confirm('Are you sure you want to clear all materials from the Bill of Materials?')) {
      this.formBomItems = [];
      this.expandedBomRowIndex = null;
      this.cdr.markForCheck();
    }
  }

  onTableHorizontalScroll(tableEl: HTMLElement, scrollEl: HTMLElement): void {
    if (scrollEl && Math.abs(scrollEl.scrollLeft - tableEl.scrollLeft) > 2) {
      scrollEl.scrollLeft = tableEl.scrollLeft;
    }
  }

  onStickyHorizontalScroll(scrollEl: HTMLElement, tableEl: HTMLElement): void {
    if (tableEl && Math.abs(tableEl.scrollLeft - scrollEl.scrollLeft) > 2) {
      tableEl.scrollLeft = scrollEl.scrollLeft;
    }
  }

  removeBomItem(index: number): void {
    if (this.expandedBomRowIndex === index) {
      this.expandedBomRowIndex = null;
    }
    this.formBomItems.splice(index, 1);
  }

  get totalBomBaseCost(): number {
    return this.formBomItems.reduce((acc, item) => acc + (Number(item.estimatedTotalCost) || 0), 0);
  }

  get totalBomGstAmount(): number {
    return this.formBomItems.reduce((acc, item) => acc + (Number(item.gstAmount) || 0), 0);
  }

  get totalBomEstimatedCost(): number {
    return this.formBomItems.reduce((acc, item) => acc + (Number(item.estAmount !== undefined ? item.estAmount : (Number(item.estimatedTotalCost) + Number(item.gstAmount || 0))) || 0), 0);
  }

  get totalBomDispatchedCount(): number {
    return this.formBomItems.filter(item => Boolean(item.isDispatched)).length;
  }

  goToAddList(): void {
    this.router.navigate(['/office/add-list']);
  }

  get totalBomAllocatedExpenses(): number {
    return this.formBomItems.reduce((acc, item) => acc + (Number(item.allocatedExpenseAmount) || 0), 0);
  }

  get bomExpenseBreakdown() {
    const summary = {
      PO: 0,
      WO: 0,
      PettyCash: 0,
      Accounts: 0,
      Warehouse: 0,
      Other: 0
    };
    this.formBomItems.forEach(item => {
      const amt = Number(item.allocatedExpenseAmount) || 0;
      const src = item.expenseSource || 'PO';
      if (src === 'PO') summary.PO += amt;
      else if (src === 'WO') summary.WO += amt;
      else if (src === 'Petty Cash') summary.PettyCash += amt;
      else if (src === 'Accounts') summary.Accounts += amt;
      else if (src === 'Warehouse') summary.Warehouse += amt;
      else summary.Other += amt;
    });
    return summary;
  }

  // Delete modal
  deleteModalOpen = false;
  projectToDelete: Project | null = null;

  // Dedicated Client Payment Ledger Modal State
  isPaymentModalOpen = false;
  activePaymentProject: Project | null = null;
  clientPaymentsList: ClientPayment[] = [];
  loadingClientPayments = false;
  isAddingOrEditingPayment = false;
  isEditingPastRecord = false;
  editingPaymentId: number | null = null;
  editingOriginalAmount = 0;

  paymentFormData = {
    dateInput: '',
    siteId: '',
    clientName: '',
    clientSiteName: '',
    paymentMode: 'Bank Transfer / NEFT',
    remarks: '',
    amount: null as number | null
  };

  ngOnInit(): void {
    this.checkRouteContext();
    this.router.events.subscribe(() => {
      this.checkRouteContext();
    });
    this.loadData();
    this.loadMasterListOptions();
    this.loadBomMaterialsMaster();
    this.loadSalesTeamOptions();
  }

  private checkRouteContext(): void {
    const url = (this.router.url || '').toLowerCase();
    this.isAwardedSitesView = url.includes('awarded-sites');
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    this.renderCharts();
    this.setupResizeObserver();
    setTimeout(() => this.measureTableWidth(), 100);
    setTimeout(() => this.measureTableWidth(), 500);
    setTimeout(() => this.measureTableWidth(), 1200);
  }

  setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.measureTableWidth();
      });
      if (this.tableContainer?.nativeElement) {
        this.resizeObserver.observe(this.tableContainer.nativeElement);
      }
      if (this.dataTable?.nativeElement) {
        this.resizeObserver.observe(this.dataTable.nativeElement);
      }
    }
  }

  // --- TOP HORIZONTAL SCROLLBAR SYNCHRONIZATION ---

  onTopScroll(): void {
    if (this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    if (this.tableContainer?.nativeElement && this.topScrollContainer?.nativeElement) {
      const topEl = this.topScrollContainer.nativeElement;
      const tableEl = this.tableContainer.nativeElement;
      const maxTop = topEl.scrollWidth - topEl.clientWidth;
      const maxTable = tableEl.scrollWidth - tableEl.clientWidth;

      if (maxTop > 0 && maxTable > 0) {
        tableEl.scrollLeft = (topEl.scrollLeft / maxTop) * maxTable;
      } else {
        tableEl.scrollLeft = topEl.scrollLeft;
      }
    }
    requestAnimationFrame(() => { this.isSyncingScroll = false; });
  }

  onTableScroll(): void {
    if (this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    if (this.topScrollContainer?.nativeElement && this.tableContainer?.nativeElement) {
      const topEl = this.topScrollContainer.nativeElement;
      const tableEl = this.tableContainer.nativeElement;
      const maxTop = topEl.scrollWidth - topEl.clientWidth;
      const maxTable = tableEl.scrollWidth - tableEl.clientWidth;

      if (maxTop > 0 && maxTable > 0) {
        topEl.scrollLeft = (tableEl.scrollLeft / maxTable) * maxTop;
      } else {
        topEl.scrollLeft = tableEl.scrollLeft;
      }
    }
    requestAnimationFrame(() => { this.isSyncingScroll = false; });
  }

  scrollToStart(): void {
    if (this.topScrollContainer?.nativeElement) {
      this.topScrollContainer.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  scrollToEnd(): void {
    if (this.topScrollContainer?.nativeElement) {
      this.topScrollContainer.nativeElement.scrollTo({
        left: this.topScrollContainer.nativeElement.scrollWidth,
        behavior: 'smooth'
      });
    }
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollTo({
        left: this.tableContainer.nativeElement.scrollWidth,
        behavior: 'smooth'
      });
    }
  }

  scrollByAmount(amount: number): void {
    if (this.topScrollContainer?.nativeElement) {
      this.topScrollContainer.nativeElement.scrollBy({ left: amount, behavior: 'smooth' });
    }
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.measureTableWidth();
  }

  measureTableWidth(): void {
    if (!this.tableContainer?.nativeElement) return;
    const tableEl = this.tableContainer.nativeElement;
    const dataTableEl = this.dataTable?.nativeElement;

    const actualWidth = Math.max(
      tableEl.scrollWidth || 0,
      dataTableEl?.scrollWidth || 0,
      dataTableEl?.offsetWidth || 0,
      4600
    );

    if (actualWidth > 0 && Math.abs(actualWidth - this.tableScrollWidth) > 5) {
      this.tableScrollWidth = actualWidth;
    }
  }

  setFinancialChartMode(mode: 'bar' | 'pie'): void {
    this.financialChartMode = mode;
    setTimeout(() => {
      this.renderCharts();
    }, 60);
  }

  getEmptyProject(): Partial<Project> {
    return {
      awardedDate: new Date().toISOString().substring(0, 10),
      siteId: '',
      clientName: '',
      location: '',
      contactNo: '',
      emailId: '',
      address: '',
      siteCapacity: '',
      siteValue: 0,
      siteType: 'Residential',
      systemType: 'On Grid',
      siteCategory: 'TATA SPG',
      clientType: 'Individual',
      saleType: 'B2C',
      orderBy: 'K KARTHIKEYAN',
      leadBy: '',
      received: 0,
      siteExpenses: 0,
      materialsSupply: false,
      installation: false,
      ebProcess: false,
      documents: false,
      warranty: false,
      handedOver: false
    };
  }

  loadData(): void {
    // 0ms instant display from cache if available
    const cached = this.projectService.getCachedProjects();
    if (cached && cached.length > 0) {
      this.projects = cached
        .filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE' && !(p.clientName || '').toLowerCase().includes('warehouse'))
        .map(p => ({
          ...p,
          systemType: this.normalizeSystemType(p.systemType),
          siteCategory: this.normalizeSiteCategory(p.siteCategory)
        }));
      this.initFilterOptions(this.projects);
      this.applyFilters();
      this.loading = false;
    } else {
      this.loading = true;
    }
    this.cdr.markForCheck();

    this.projectService.getProjects().subscribe({
      next: (res) => {
        this.projects = (res.data || [])
          .filter(p => (p.siteId || '').toUpperCase() !== 'WAREHOUSE' && !(p.clientName || '').toLowerCase().includes('warehouse'))
          .map(p => ({
            ...p,
            systemType: this.normalizeSystemType(p.systemType),
            siteCategory: this.normalizeSiteCategory(p.siteCategory)
          }));
        this.initFilterOptions(this.projects);
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
        setTimeout(() => this.measureTableWidth(), 100);
        setTimeout(() => this.measureTableWidth(), 600);
      },
      error: (err) => {
        this.errorMsg = 'Failed to load projects from server.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });

    this.loadMetrics();
  }

  initFilterOptions(projects: Project[]): void {
    if (!projects || projects.length === 0) return;

    const populateOptions = (currentOptions: FilterOption[], field: keyof Project): FilterOption[] => {
      const labels = new Set<string>(currentOptions.map(o => o.label));
      projects.forEach(p => {
        const val = p[field];
        if (typeof val === 'string' && val.trim()) {
          const exists = Array.from(labels).some(l => l.toLowerCase().trim() === val.toLowerCase().trim());
          if (!exists) {
            labels.add(val.trim());
          }
        }
      });
      return Array.from(labels).map(lbl => {
        const found = currentOptions.find(o => o.label.toLowerCase() === lbl.toLowerCase());
        return { label: lbl, selected: found ? found.selected : true };
      });
    };

    this.siteTypeOptions = populateOptions(this.siteTypeOptions, 'siteType');
    this.systemTypeOptions = populateOptions(this.systemTypeOptions, 'systemType');
    this.siteCategoryOptions = populateOptions(this.siteCategoryOptions, 'siteCategory');
    this.clientTypeOptions = populateOptions(this.clientTypeOptions, 'clientType');
    this.orderByOptions = populateOptions(this.orderByOptions, 'orderBy');
  }

  loadMetrics(): void {
    const cached = this.projectService.getCachedMetrics();
    if (cached) {
      this.metrics = cached;
      this.cdr.markForCheck();
      setTimeout(() => this.renderCharts(), 50);
    }

    this.projectService.getSummaryMetrics().subscribe({
      next: (res) => {
        this.metrics = res.data;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.renderCharts();
        }, 100);
      },
      error: (err) => {
        console.error('Failed to load metrics:', err);
      }
    });
  }

  get totalMarginPercentage(): number {
    if (!this.metrics || !this.metrics.totalSiteValue || this.metrics.totalSiteValue === 0) return 0;
    return (this.metrics.totalMargin / this.metrics.totalSiteValue) * 100;
  }

  // --- TABLE PAGINATION GETTERS & METHODS ---
  get totalPages(): number {
    if (this.pageSize === 'All') return 1;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return Math.max(1, Math.ceil(this.filteredProjects.length / size));
  }

  get paginatedProjects(): Project[] {
    if (this.pageSize === 'All') {
      return this.filteredProjects;
    }
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    const start = (this.currentPage - 1) * size;
    return this.filteredProjects.slice(start, start + size);
  }

  get displayStartRecord(): number {
    if (this.filteredProjects.length === 0) return 0;
    if (this.pageSize === 'All') return 1;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return (this.currentPage - 1) * size + 1;
  }

  get displayEndRecord(): number {
    if (this.filteredProjects.length === 0) return 0;
    if (this.pageSize === 'All') return this.filteredProjects.length;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return Math.min(this.currentPage * size, this.filteredProjects.length);
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const current = this.currentPage;
    const pages: number[] = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1);
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push(-1);
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1);
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    if (this.tableContainer?.nativeElement) {
      this.tableContainer.nativeElement.scrollTop = 0;
    }
    this.cdr.markForCheck();
  }

  onPageSizeChange(newSize: number | 'All'): void {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  getRecordIndex(indexOnPage: number): number {
    if (this.pageSize === 'All') return indexOnPage + 1;
    const size = typeof this.pageSize === 'number' ? this.pageSize : 20;
    return (this.currentPage - 1) * size + indexOnPage + 1;
  }

  // Filter Methods
  toggleFilter(filterName: 'siteType' | 'systemType' | 'siteCategory' | 'clientType' | 'orderBy', event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const wasOpen = this.isFilterOpen(filterName);
    this.closeAllFilters();
    if (!wasOpen) {
      if (filterName === 'siteType') this.siteTypeFilterOpen = true;
      if (filterName === 'systemType') this.systemTypeFilterOpen = true;
      if (filterName === 'siteCategory') this.siteCategoryFilterOpen = true;
      if (filterName === 'clientType') this.clientTypeFilterOpen = true;
      if (filterName === 'orderBy') this.orderByFilterOpen = true;
    }
  }

  isFilterOpen(filterName: string): boolean {
    if (filterName === 'siteType') return this.siteTypeFilterOpen;
    if (filterName === 'systemType') return this.systemTypeFilterOpen;
    if (filterName === 'siteCategory') return this.siteCategoryFilterOpen;
    if (filterName === 'clientType') return this.clientTypeFilterOpen;
    if (filterName === 'orderBy') return this.orderByFilterOpen;
    return false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-container')) {
      this.closeAllFilters();
    }
  }

  closeAllFilters(): void {
    this.siteTypeFilterOpen = false;
    this.systemTypeFilterOpen = false;
    this.siteCategoryFilterOpen = false;
    this.clientTypeFilterOpen = false;
    this.orderByFilterOpen = false;
  }

  isAllSelected(options: FilterOption[]): boolean {
    return options.length > 0 && options.every(o => o.selected);
  }

  toggleSelectAll(options: FilterOption[]): void {
    const allSelected = this.isAllSelected(options);
    options.forEach(o => o.selected = !allSelected);
    this.currentPage = 1;
    this.applyFilters();
  }

  onFilterCheckboxChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  filteredOptions(options: FilterOption[], search: string): FilterOption[] {
    if (!search.trim()) return options;
    return options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  }

  applyFilters(): void {
    const allSiteTypes = this.isAllSelected(this.siteTypeOptions);
    const allSystemTypes = this.isAllSelected(this.systemTypeOptions);
    const allSiteCategories = this.isAllSelected(this.siteCategoryOptions);
    const allClientTypes = this.isAllSelected(this.clientTypeOptions);
    const allOrderBys = this.isAllSelected(this.orderByOptions);

    const selectedSiteTypes = this.siteTypeOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());
    const selectedSystemTypes = this.systemTypeOptions.filter(o => o.selected).map(o => o.label.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const selectedSiteCategories = this.siteCategoryOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());
    const selectedClientTypes = this.clientTypeOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());
    const selectedOrderBys = this.orderByOptions.filter(o => o.selected).map(o => o.label.toLowerCase().trim());

    const term = this.searchTerm.trim().toLowerCase();

    this.filteredProjects = this.projects.filter(p => {
      // Global search
      if (term) {
        const matchesSearch = (
          (p.siteId || '').toLowerCase().includes(term) ||
          (p.clientName || '').toLowerCase().includes(term) ||
          (p.location || '').toLowerCase().includes(term) ||
          (p.contactNo || '').toLowerCase().includes(term) ||
          (p.emailId || '').toLowerCase().includes(term) ||
          (p.orderBy || '').toLowerCase().includes(term) ||
          (p.siteType || '').toLowerCase().includes(term) ||
          (p.systemType || '').toLowerCase().includes(term) ||
          (p.siteCategory || '').toLowerCase().includes(term) ||
          (p.clientType || '').toLowerCase().includes(term)
        );
        if (!matchesSearch) return false;
      }

      // Site Type filter (Residential, Industrial, Ground Mount, Commercial)
      if (!allSiteTypes) {
        if (selectedSiteTypes.length === 0) return false;
        const st = (p.siteType || '').toLowerCase().trim();
        if (!selectedSiteTypes.includes(st)) return false;
      }

      // System Type filter (Ongrid / On Grid, offgrid / Off Grid, Hybrid)
      if (!allSystemTypes) {
        if (selectedSystemTypes.length === 0) return false;
        const sysNorm = (p.systemType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchSys = selectedSystemTypes.some(s => s === sysNorm || (s === 'ongrid' && sysNorm === 'ongrid') || (s === 'offgrid' && sysNorm === 'offgrid'));
        if (!matchSys) return false;
      }

      // Site Category filter (TATA SPG, Waree / Waaree, Premier, Other)
      if (!allSiteCategories) {
        if (selectedSiteCategories.length === 0) return false;
        const cat = (p.siteCategory || '').toLowerCase().trim();
        const matchCat = selectedSiteCategories.some(sel => {
          if (sel.includes('tata') && cat.includes('tata')) return true;
          if ((sel.includes('ware') || sel.includes('waare')) && (cat.includes('ware') || cat.includes('waare'))) return true;
          if (sel.includes('premier') && cat.includes('premier')) return true;
          if (sel.includes('other') && cat.includes('other')) return true;
          return cat.includes(sel) || sel.includes(cat);
        });
        if (!matchCat) return false;
      }

      // Client Type filter (Individual, Company, Institutional)
      if (!allClientTypes) {
        if (selectedClientTypes.length === 0) return false;
        const ct = (p.clientType || '').toLowerCase().trim();
        if (!selectedClientTypes.includes(ct)) return false;
      }

      // Order By filter
      if (!allOrderBys) {
        if (selectedOrderBys.length === 0) return false;
        const ob = (p.orderBy || '').toLowerCase().trim();
        if (!selectedOrderBys.includes(ob)) return false;
      }

      return true;
    });

    // Site ID Numerical Sort (Small to Big / Big to Small)
    if (this.siteIdSortDirection !== 'none') {
      const dir = this.siteIdSortDirection;
      this.filteredProjects.sort((a, b) => {
        const idA = a.siteId || '';
        const idB = b.siteId || '';
        const matchA = idA.match(/\d+/);
        const matchB = idB.match(/\d+/);
        const numA = matchA ? parseInt(matchA[0], 10) : NaN;
        const numB = matchB ? parseInt(matchB[0], 10) : NaN;

        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) {
            return dir === 'asc' ? numA - numB : numB - numA;
          }
        }
        return dir === 'asc'
          ? idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
          : idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    this.cdr.markForCheck();
  }

  toggleSiteIdSort(): void {
    this.siteIdSortDirection = this.siteIdSortDirection === 'desc' ? 'asc' : 'desc';
    this.currentPage = 1;
    this.applyFilters();
  }

  setSiteIdSort(dir: 'asc' | 'desc'): void {
    this.siteIdSortDirection = dir;
    this.currentPage = 1;
    this.applyFilters();
  }

  resetAllFilters(): void {
    this.searchTerm = '';
    this.siteIdSortDirection = 'desc';
    this.siteTypeOptions.forEach(o => o.selected = true);
    this.systemTypeOptions.forEach(o => o.selected = true);
    this.siteCategoryOptions.forEach(o => o.selected = true);
    this.clientTypeOptions.forEach(o => o.selected = true);
    this.orderByOptions.forEach(o => o.selected = true);
    this.currentPage = 1;
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() ||
      this.siteIdSortDirection !== 'desc' ||
      !this.isAllSelected(this.siteTypeOptions) ||
      !this.isAllSelected(this.systemTypeOptions) ||
      !this.isAllSelected(this.siteCategoryOptions) ||
      !this.isAllSelected(this.clientTypeOptions) ||
      !this.isAllSelected(this.orderByOptions);
  }

  // Get single-column stage for project
  getMilestoneStage(p: Project): string {
    if (p.documents) return 'Documents';
    if (p.ebProcess) return 'EB Process';
    if (p.installation) return 'Installation';
    if (p.materialsSupply) return 'Material Supply';
    return 'Pending';
  }

  // Handle stage dropdown change in single column
  onStageChange(p: Project, stage: string): void {
    if (!p.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }

    let payload: any = {};
    if (stage === 'Pending') {
      payload = {
        materialsSupply: false,
        installation: false,
        ebProcess: false,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'Material Supply') {
      payload = {
        materialsSupply: true,
        installation: false,
        ebProcess: false,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'Installation') {
      payload = {
        materialsSupply: true,
        installation: true,
        ebProcess: false,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'EB Process') {
      payload = {
        materialsSupply: true,
        installation: true,
        ebProcess: true,
        documents: false,
        warranty: false,
        handedOver: false
      };
    } else if (stage === 'Documents') {
      payload = {
        materialsSupply: true,
        installation: true,
        ebProcess: true,
        documents: true
      };
    }

    Object.assign(p, payload);
    this.recalculateLocalProject(p);

    this.projectService.updateProject(p.id, payload).subscribe({
      next: (res) => {
        if (res?.data) {
          Object.assign(p, res.data);
          this.recalculateLocalProject(p);
        }
        this.loadMetrics();
      },
      error: (err) => {
        console.error('Failed to update stage:', err);
        this.showToast('Failed to update project stage', 'error');
      }
    });
  }

  onWarrantyToggle(p: Project, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.setMilestone(p, 'warranty', isChecked);
  }

  onHandedOverToggle(p: Project, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.setMilestone(p, 'handedOver', isChecked);
  }

  // Milestone change from table dropdown
  onMilestoneSelectChange(project: Project, field: string, value: any): void {
    const boolVal = value === true || value === 'true';
    this.setMilestone(project, field, boolVal);
  }

  setMilestone(project: Project, field: string, newVal: boolean): void {
    if (!project.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    const currentVal = Boolean((project as any)[field]);
    if (currentVal === newVal) return;

    (project as any)[field] = newVal;
    this.recalculateLocalProject(project);

    this.projectService.toggleMilestone(project.id, field, newVal).subscribe({
      next: (res) => {
        Object.assign(project, res.data);
        this.loadMetrics();
      },
      error: (err) => {
        (project as any)[field] = currentVal;
        this.recalculateLocalProject(project);
        this.showToast('Failed to update milestone status', 'error');
      }
    });
  }

  // Quick Toggle Milestone from table row
  toggleMilestone(project: Project, field: string): void {
    if (!project.id) return;
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    const currentVal = Boolean((project as any)[field]);
    const newVal = !currentVal;

    // Optimistic UI update
    (project as any)[field] = newVal;
    this.recalculateLocalProject(project);

    this.projectService.toggleMilestone(project.id, field, newVal).subscribe({
      next: (res) => {
        Object.assign(project, res.data);
        this.loadMetrics();
      },
      error: (err) => {
        // Revert on error
        (project as any)[field] = currentVal;
        this.recalculateLocalProject(project);
        this.showToast('Failed to update milestone status', 'error');
      }
    });
  }

  recalculateLocalProject(p: Project): void {
    const ticks = [
      Boolean(p.materialsSupply),
      Boolean(p.installation),
      Boolean(p.ebProcess),
      Boolean(p.documents),
      Boolean(p.warranty),
      Boolean(p.handedOver)
    ];
    const checkedCount = ticks.filter(Boolean).length;
    p.completedPercentage = checkedCount === 6 ? 100.00 : parseFloat((checkedCount * 16.67).toFixed(2));
    if (p.completedPercentage > 100) p.completedPercentage = 100.00;
    p.workInProgressPercentage = checkedCount === 6 ? 0.00 : parseFloat((100 - p.completedPercentage).toFixed(2));

    const siteVal = parseFloat(p.siteValue as any) || 0;
    const recv = parseFloat(p.received as any) || 0;
    const exp = parseFloat(p.siteExpenses as any) || 0;
    p.due = siteVal - recv;
    p.margin = recv - exp;
    p.marginPercentage = siteVal > 0 ? parseFloat(((p.margin / siteVal) * 100).toFixed(2)) : 0;
  }

  // Modal Open / Close
  openAddModal(): void {
    if (!this.canAdd()) {
      this.showToast('You do not have permission to add new projects.', 'error');
      return;
    }
    this.loadBomMaterialsMaster();
    this.loadMasterListOptions();
    this.loadSalesTeamOptions();
    this.isEditMode = false;
    this.currentProjectId = null;
    this.projectForm = this.getEmptyProject();
    let maxNum = 400;
    this.projects.forEach(p => {
      if (p.siteId) {
        const match = p.siteId.match(/SP(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    this.projectForm.siteId = `SP${maxNum + 1}`;
    this.formBomItems = [];
    this.modalTab = 'basic';
    this.isModalOpen = true;
    this.cdr.markForCheck();
  }

  formatDate(dateStr?: string): string {
    if (!dateStr || dateStr === '-') return '-';
    return this.toDisplayDate(dateStr) || '-';
  }

  openEditModal(project: Project): void {
    if (!this.canEdit()) {
      this.showToast('You do not have permission to edit projects.', 'error');
      return;
    }
    this.loadBomMaterialsMaster();
    this.loadMasterListOptions();
    this.loadSalesTeamOptions();
    this.isEditMode = true;
    this.currentProjectId = project.id || null;
    this.projectForm = {
      ...project,
      systemType: this.normalizeSystemType(project.systemType),
      siteCategory: this.normalizeSiteCategory(project.siteCategory)
    };
    if (this.projectForm.systemType && !this.masterSystemTypes.includes(this.projectForm.systemType)) {
      this.masterSystemTypes.push(this.projectForm.systemType);
    }
    if (this.projectForm.siteCategory && !this.masterSiteCategories.includes(this.projectForm.siteCategory)) {
      this.masterSiteCategories.push(this.projectForm.siteCategory);
    }
    let parsedBom: BomItem[] = [];
    if (project.bomItems) {
      if (Array.isArray(project.bomItems)) {
        parsedBom = [...project.bomItems];
      } else if (typeof project.bomItems === 'string') {
        try { parsedBom = JSON.parse(project.bomItems); } catch(e) { parsedBom = []; }
      }
    }
    parsedBom.forEach(item => {
      this.recalculateBomItem(item);
    });
    this.formBomItems = parsedBom;
    this.modalTab = 'basic';
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  confirmDeleteFromModal(): void {
    if (this.currentProjectId) {
      const project = this.projects.find(p => p.id === this.currentProjectId);
      if (project) {
        this.closeModal();
        this.confirmDelete(project);
      }
    }
  }

  // Calculated properties in form
  get formDue(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const recv = parseFloat(this.projectForm.received as any) || 0;
    return Math.max(0, val - recv);
  }

  get formMargin(): number {
    const recv = parseFloat(this.projectForm.received as any) || 0;
    const exp = parseFloat(this.projectForm.siteExpenses as any) || 0;
    return recv - exp;
  }

  get formReceivedPct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const recv = parseFloat(this.projectForm.received as any) || 0;
    if (val <= 0) return 0;
    return Math.min(100, parseFloat(((recv / val) * 100).toFixed(1)));
  }

  get formDuePct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const due = this.formDue;
    if (val <= 0) return 0;
    return Math.min(100, parseFloat(((due / val) * 100).toFixed(1)));
  }

  get formExpensePct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const exp = parseFloat(this.projectForm.siteExpenses as any) || 0;
    if (val <= 0) return 0;
    return Math.min(100, parseFloat(((exp / val) * 100).toFixed(1)));
  }

  get formMarginPct(): number {
    const val = parseFloat(this.projectForm.siteValue as any) || 0;
    const margin = this.formMargin;
    if (val <= 0) return 0;
    return parseFloat(((margin / val) * 100).toFixed(1));
  }

  get formNetCashflow(): number {
    const recv = parseFloat(this.projectForm.received as any) || 0;
    const exp = parseFloat(this.projectForm.siteExpenses as any) || 0;
    return recv - exp;
  }

  get formCompleted(): number {
    const ticks = [
      this.projectForm.materialsSupply,
      this.projectForm.installation,
      this.projectForm.ebProcess,
      this.projectForm.documents,
      this.projectForm.warranty,
      this.projectForm.handedOver
    ];
    const count = ticks.filter(Boolean).length;
    return count === 6 ? 100 : parseFloat((count * 16.67).toFixed(2));
  }

  get formWip(): number {
    return this.formCompleted === 100 ? 0 : parseFloat((100 - this.formCompleted).toFixed(2));
  }

  get formMilestoneStage(): string {
    if (this.projectForm.documents) return 'Documents';
    if (this.projectForm.ebProcess) return 'EB Process';
    if (this.projectForm.installation) return 'Installation';
    if (this.projectForm.materialsSupply) return 'Material Supply';
    return 'Pending';
  }

  onFormStageChange(stage: string): void {
    if (stage === 'Pending') {
      this.projectForm.materialsSupply = false;
      this.projectForm.installation = false;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'Material Supply') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = false;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'Installation') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = true;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'EB Process') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = true;
      this.projectForm.ebProcess = true;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;
    } else if (stage === 'Documents') {
      this.projectForm.materialsSupply = true;
      this.projectForm.installation = true;
      this.projectForm.ebProcess = true;
      this.projectForm.documents = true;
    }
  }

  saveProject(): void {
    if (!this.projectForm.siteId?.trim() || !this.projectForm.clientName?.trim()) {
      this.showToast('Site ID and Client Name are required.', 'error');
      return;
    }

    if (this.isEditMode ? !this.canEdit() : !this.canAdd()) {
      this.showToast('You do not have permission to perform this action.', 'error');
      return;
    }

    if (this.isEditMode && this.currentProjectId) {
      const existing = this.projects.find(p => p.id === this.currentProjectId);
      if (existing) {
        // Preserve ledger-computed financial totals while allowing user edits to milestones, siteValue, and BOM items
        this.projectForm.received = existing.received;
        this.projectForm.siteExpenses = existing.siteExpenses;
      }
      this.projectForm.bomItems = this.formBomItems;
      this.projectService.updateProject(this.currentProjectId, this.projectForm).subscribe({
        next: (res) => {
          this.showToast('Project updated successfully!', 'success');
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.showToast(err.error?.message || 'Failed to update project.', 'error');
        }
      });
    } else {
      this.projectForm.received = 0;
      this.projectForm.siteExpenses = 0;
      this.projectForm.bomItems = this.formBomItems;
      this.projectForm.materialsSupply = false;
      this.projectForm.installation = false;
      this.projectForm.ebProcess = false;
      this.projectForm.documents = false;
      this.projectForm.warranty = false;
      this.projectForm.handedOver = false;

      this.projectService.createProject(this.projectForm).subscribe({
        next: (res) => {
          this.showToast('Project created successfully!', 'success');
          this.closeModal();
          this.loadData();
        },
        error: (err) => {
          this.showToast(err.error?.message || 'Failed to create project.', 'error');
        }
      });
    }
  }

  // Delete Action
  confirmDelete(project: Project): void {
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete projects.', 'error');
      return;
    }
    this.projectToDelete = project;
    this.deleteModalOpen = true;
  }

  executeDelete(): void {
    if (!this.projectToDelete?.id) return;
    if (!this.canDelete()) {
      this.showToast('You do not have permission to delete projects.', 'error');
      return;
    }
    this.projectService.deleteProject(this.projectToDelete.id).subscribe({
      next: () => {
        this.showToast('Project deleted successfully.', 'success');
        this.deleteModalOpen = false;
        this.projectToDelete = null;
        this.loadData();
      },
      error: (err) => {
        this.showToast('Failed to delete project.', 'error');
      }
    });
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    if (type === 'success') {
      this.successMsg = msg;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.successMsg = '';
        this.cdr.markForCheck();
      }, 4000);
    } else {
      this.errorMsg = msg;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.errorMsg = '';
        this.cdr.markForCheck();
      }, 4000);
    }
  }

  exportBothPdfAndExcel(): void {
    this.exportToPdf();
    setTimeout(() => {
      this.exportToCsv();
    }, 450);
  }

  @ViewChild('excelFileInput') excelFileInput!: ElementRef<HTMLInputElement>;

  triggerExcelImport(): void {
    if (this.excelFileInput) {
      this.excelFileInput.nativeElement.click();
    }
  }

  formatCapacity(val: string | undefined | null): string {
    if (!val) return '3 kW';
    const str = String(val).trim();
    if (!str) return '3 kW';
    if (str.toLowerCase().includes('mw')) return str;
    const cleaned = str.replace(/\s*kw\s*/gi, '').trim();
    return cleaned ? `${cleaned} kW` : '3 kW';
  }

  normalizeToIsoDate(val: any): string {
    if (!val) return new Date().toISOString().substring(0, 10);
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return new Date().toISOString().substring(0, 10);
      const yyyy = val.getFullYear();
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof val === 'number' || (typeof val === 'string' && /^\d{5}(\.\d+)?$/.test(val.trim()))) {
      const num = typeof val === 'number' ? val : parseFloat(val.trim());
      if (num > 10000 && num < 100000) {
        const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(jsDate.getTime())) {
          const yyyy = jsDate.getUTCFullYear();
          const mm = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(jsDate.getUTCDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    const str = String(val).trim().replace(/[T\s].*$/, '');
    if (!str) return new Date().toISOString().substring(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    if (str.includes('-') || str.includes('/') || str.includes('.')) {
      const isSlash = str.includes('/');
      const parts = str.split(/[-/.]/).map(p => p.trim());

      if (parts.length === 3) {
        let p0 = parseInt(parts[0], 10);
        let p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);

        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let year = p2;
          let month = 0;
          let day = 0;

          if (p0 > 1000) {
            year = p0;
            if (p1 > 12) { month = p2; day = p1; }
            else { month = p1; day = p2; }
          } else {
            if (year < 100) year += 2000;

            if (isSlash) {
              // Slash format default: MM/DD/YYYY (US format e.g. 7/31/2026, 4/13/2026)
              if (p0 > 12 && p1 <= 12) {
                day = p0;
                month = p1;
              } else {
                month = p0;
                day = p1;
              }
            } else {
              // Dash / Dot format default: DD-MM-YYYY (Indian format e.g. 04-10-2026, 04-09-2026)
              if (p1 > 12 && p0 <= 12) {
                month = p0;
                day = p1;
              } else {
                day = p0;
                month = p1;
              }
            }
          }

          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const yStr = String(year);
            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            return `${yStr}-${mStr}-${dStr}`;
          }
        }
      }
    }

    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return new Date().toISOString().substring(0, 10);
  }

  onExcelUploadSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawArrayRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawArrayRows || rawArrayRows.length === 0) {
          this.showToast('The uploaded Excel file contains no data rows.', 'error');
          return;
        }

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, rawArrayRows.length); i++) {
          const rowStr = rawArrayRows[i].join(' ').toLowerCase();
          if (rowStr.includes('site') || rowStr.includes('client') || rowStr.includes('awarded') || rowStr.includes('capacity') || rowStr.includes('location')) {
            headerRowIndex = i;
            break;
          }
        }

        const startIdx = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
        const headerCells = headerRowIndex !== -1 ? rawArrayRows[headerRowIndex].map((c: any) => String(c || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')) : [];

        const findColIndex = (keywords: string[]) => {
          if (headerCells.length === 0) return -1;
          for (const kw of keywords) {
            const idx = headerCells.findIndex((h: string) => h.includes(kw));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colIdx = {
          awardedDate: findColIndex(['awardeddate', 'awarded', 'date']),
          siteId: findColIndex(['siteid', 'projectid', 'site', 'id']),
          clientName: findColIndex(['clientname', 'client', 'customer', 'name']),
          location: findColIndex(['location', 'city']),
          contactNo: findColIndex(['contactno', 'contact', 'phone', 'mobile']),
          siteCapacity: findColIndex(['sitecapacity', 'capacity', 'kw']),
          siteValue: findColIndex(['sitevalue', 'contractvalue', 'value', 'amount', 'price']),
          siteType: findColIndex(['sitetype', 'type']),
          systemType: findColIndex(['systemtype']),
          siteCategory: findColIndex(['sitecategory', 'category']),
          clientType: findColIndex(['clienttype']),
          saleType: findColIndex(['saletype']),
          orderBy: findColIndex(['orderby', 'engineer', 'siteengineer', 'manager']),
          received: findColIndex(['received', 'paid']),
          siteExpenses: findColIndex(['siteexpenses', 'expenses', 'expense']),
          address: findColIndex(['address'])
        };

        const parseNumStr = (valStr: any) => {
          if (!valStr) return 0;
          const str = String(valStr).trim();
          if (!str) return 0;
          return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
        };

        const parseBoolVal = (strVal: any) => {
          const s = String(strVal || '').toLowerCase().trim();
          return s === 'true' || s === 'yes' || s === '1' || s === 'checked';
        };

        const projectsBatch: Partial<Project>[] = [];

        for (let r = startIdx; r < rawArrayRows.length; r++) {
          const arrRow = rawArrayRows[r];
          if (!arrRow || arrRow.length === 0 || arrRow.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '')) {
            continue;
          }

          const getValByCol = (cIndex: number, fallbacks: number[]) => {
            if (cIndex !== -1 && arrRow[cIndex] !== undefined && arrRow[cIndex] !== null && String(arrRow[cIndex]).trim() !== '') {
              return String(arrRow[cIndex]).trim();
            }
            for (const fb of fallbacks) {
              if (arrRow[fb] !== undefined && arrRow[fb] !== null && String(arrRow[fb]).trim() !== '') {
                return String(arrRow[fb]).trim();
              }
            }
            return '';
          };

          let rawDate = getValByCol(colIdx.awardedDate, [0]);
          let siteId = getValByCol(colIdx.siteId, [1]);
          let clientName = getValByCol(colIdx.clientName, [2]);
          let location = getValByCol(colIdx.location, [3]);
          let contactNo = getValByCol(colIdx.contactNo, [4]);
          let siteCapacity = getValByCol(colIdx.siteCapacity, [5]);
          let siteValueStr = getValByCol(colIdx.siteValue, [6]);
          let siteType = getValByCol(colIdx.siteType, [7]);
          let systemType = getValByCol(colIdx.systemType, [8]);
          let siteCategory = getValByCol(colIdx.siteCategory, [9]);
          let clientType = getValByCol(colIdx.clientType, [10]);
          let saleType = getValByCol(colIdx.saleType, [11]);
          let orderBy = getValByCol(colIdx.orderBy, [12]);
          let receivedStr = getValByCol(colIdx.received, [13]);
          let siteExpensesStr = getValByCol(colIdx.siteExpenses, [14]);
          let address = getValByCol(colIdx.address, [26]);

          for (let c = 0; c < arrRow.length; c++) {
            const cellStr = String(arrRow[c] || '').trim();
            if (!cellStr) continue;

            if (!siteId && /^SP\d+/i.test(cellStr)) {
              siteId = cellStr.toUpperCase();
            }
            if (!rawDate && (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(cellStr) || /^\d{5}$/.test(cellStr))) {
              rawDate = cellStr;
            }
            if (!contactNo && /^\d{10}$/.test(cellStr.replace(/\s+/g, ''))) {
              contactNo = cellStr;
            }
          }

          if (!siteId && !clientName) continue;

          if (siteId.toLowerCase().includes('site') || clientName.toLowerCase().includes('client') || clientName.toLowerCase().includes('name')) {
            continue;
          }

          if (!siteId) siteId = `SP${400 + r}`;
          if (!clientName) clientName = `Client ${siteId}`;

          const awardedDateIso = this.normalizeToIsoDate(rawDate);
          const formattedCapacity = this.formatCapacity(siteCapacity);

          projectsBatch.push({
            awardedDate: awardedDateIso,
            siteId: siteId.toUpperCase(),
            clientName,
            location: location || 'Chennai',
            contactNo: contactNo || '',
            emailId: '',
            address: address || location,
            siteCapacity: formattedCapacity,
            siteValue: parseNumStr(siteValueStr),
            siteType: siteType || 'Residential',
            systemType: systemType || 'Ongrid',
            siteCategory: siteCategory || 'TATA SPG',
            clientType: clientType || 'Individual',
            saleType: saleType || 'B2C',
            orderBy: orderBy || 'K SATHISH',
            received: parseNumStr(receivedStr),
            siteExpenses: parseNumStr(siteExpensesStr),
            materialsSupply: parseBoolVal(arrRow[17]),
            installation: parseBoolVal(arrRow[18]),
            ebProcess: parseBoolVal(arrRow[19]),
            documents: parseBoolVal(arrRow[20]),
            warranty: parseBoolVal(arrRow[21]),
            handedOver: parseBoolVal(arrRow[22])
          });
        }

        if (projectsBatch.length === 0) {
          this.showToast('No valid project rows found in Excel sheet.', 'error');
          return;
        }

        this.showToast(`Importing ${projectsBatch.length} site records from Excel...`, 'success');

        let successCount = 0;
        for (const proj of projectsBatch) {
          try {
            await lastValueFrom(this.projectService.createProject(proj));
            successCount++;
          } catch (err) {
            console.error(`Error uploading site ${proj.siteId}:`, err);
          }
        }

        this.loadData();
        this.showToast(`Successfully uploaded ${successCount} of ${projectsBatch.length} site records from Excel!`, 'success');
        input.value = '';
      } catch (err: any) {
        console.error('Excel upload error:', err);
        this.showToast('Failed to parse Excel file: ' + err.message, 'error');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // Export to CSV
  exportToCsv(): void {
    if (this.filteredProjects.length === 0) {
      this.showToast('No projects to export.', 'error');
      return;
    }

    const headers = [
      'Awarded Date', 'Site ID', 'Client Name', 'Location', 'Contact No', 'Email ID', 'Address',
      'Site Capacity', 'Site Value', 'Site Type', 'System Type', 'Site Category', 'Client Type',
      'Sale Type', 'Order By', 'Received', 'Due', 'Site Expenses', 'Margin %',
      'Materials Supply', 'Installation', 'EB Process', 'Documents', 'Warranty', 'Handed Over',
      'Work in Process %', 'Completed %'
    ];

    const rows = this.filteredProjects.map(p => [
      p.awardedDate || '',
      `"${p.siteId || ''}"`,
      `"${p.clientName || ''}"`,
      `"${p.location || ''}"`,
      `"${p.contactNo || ''}"`,
      `"${p.emailId || ''}"`,
      `"${(p.address || '').replace(/"/g, '""')}"`,
      `"${p.siteCapacity || ''}"`,
      p.siteValue || 0,
      `"${p.siteType || ''}"`,
      `"${p.systemType || ''}"`,
      `"${p.siteCategory || ''}"`,
      `"${p.clientType || ''}"`,
      `"${p.saleType || ''}"`,
      `"${p.orderBy || ''}"`,
      p.received || 0,
      p.due || 0,
      p.siteExpenses || 0,
      `"${p.marginPercentage || 0}%"`,
      p.materialsSupply ? 'Yes' : 'No',
      p.installation ? 'Yes' : 'No',
      p.ebProcess ? 'Yes' : 'No',
      p.documents ? 'Yes' : 'No',
      p.warranty ? 'Yes' : 'No',
      p.handedOver ? 'Yes' : 'No',
      `${p.workInProgressPercentage}%`,
      `${p.completedPercentage}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Project_Master_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToPdf(): void {
    if (!this.filteredProjects.length) {
      this.errorMsg = 'No projects to export to PDF';
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header Title & Brand
    doc.setFontSize(15);
    doc.setTextColor(15, 118, 110); // Teal brand
    doc.text('SOLAR SATHLOKHAR - PROJECT MASTER & FINANCIAL PORTFOLIO', 14, 14);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Filtered Count: ${this.filteredProjects.length} Projects | Portfolio Value: ₹${(this.metrics?.totalSiteValue || 0).toLocaleString('en-IN')}`, 14, 19);

    const headers = [
      ['Site ID', 'Client Name', 'Location', 'Cap', 'Site Value (₹)', 'Received (₹)', 'Due (₹)', 'Expenses (₹)', 'Margin %', 'WIP', 'Done']
    ];

    const body = this.filteredProjects.map(p => [
      p.siteId || '',
      p.clientName || '',
      p.location || '',
      p.siteCapacity ? `${p.siteCapacity} kW` : '',
      p.siteValue ? Number(p.siteValue).toLocaleString('en-IN') : '0',
      p.received ? Number(p.received).toLocaleString('en-IN') : '0',
      p.due ? Number(p.due).toLocaleString('en-IN') : '0',
      p.siteExpenses ? Number(p.siteExpenses).toLocaleString('en-IN') : '0',
      `${p.marginPercentage || 0}%`,
      `${p.workInProgressPercentage}%`,
      `${p.completedPercentage}%`
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 18 },
        1: { cellWidth: 40 },
        2: { cellWidth: 26 },
        3: { cellWidth: 16 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 26 },
        6: { halign: 'right', cellWidth: 26 },
        7: { halign: 'right', cellWidth: 26 },
        8: { halign: 'right', cellWidth: 26 },
        9: { halign: 'center', cellWidth: 16 },
        10: { halign: 'center', cellWidth: 16 }
      }
    });

    doc.save(`Solar_Sathlokhar_Projects_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.successMsg = 'Project Master PDF exported successfully!';
  }

  // Export Individual Client PDF Dossier (Includes Financial & Execution Charts)
  exportSingleClientPdf(p: Project): void {
    if (!p) return;
    this.selectedProject = p;
    this.isDetailsModalOpen = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.renderCharts();
      setTimeout(() => {
        this.exportProjectDetailsPdf();
      }, 250);
    }, 100);
  }

  // Client Details Modal & Chart Visualizers
  openClientDetails(project: Project): void {
    this.selectedProject = project;
    this.isDetailsModalOpen = true;
    setTimeout(() => {
      this.renderCharts();
    }, 150);
  }

  exportProjectDetailsPdf(): void {
    if (!this.selectedProject) return;
    const p = this.selectedProject;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    // 1. Top Brand Header Banner
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line (Amber)
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('SOLAR SATHLOKHAR', margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 251, 241);
    doc.text('PROJECT TECHNICAL & FINANCIAL SUMMARY REPORT', margin, 17);

    doc.setFontSize(8);
    doc.text(`Site ID: ${p.siteId}  |  Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, margin, 23);

    // 2. Client Overview Section
    let currentY = 35;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 118, 110);
    doc.text(`${p.clientName} (${p.siteId})`, margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${p.siteCapacity || '5'} kW  |  ${p.siteType || 'Residential'}  |  ${p.location || 'Chennai'}  |  Awarded: ${p.awardedDate || '-'}  |  Manager: ${p.orderBy || '-'}`, margin, currentY + 5);

    currentY += 9;

    // Table: Project Specifications
    autoTable(doc, {
      startY: currentY,
      head: [['Specification Attribute', 'Project Detail', 'Commercial Parameter', 'Value']],
      body: [
        ['Client Name', p.clientName || '-', 'Site ID', p.siteId || '-'],
        ['Site Capacity', `${p.siteCapacity || '-'} kW`, 'Site Value', `INR ${(Number(p.siteValue) || 0).toLocaleString('en-IN')}`],
        ['Site Type', p.siteType || '-', 'Received Payment', `INR ${(Number(p.received) || 0).toLocaleString('en-IN')}`],
        ['System Type', p.systemType || '-', 'Due Recoverable', `INR ${(Number(p.due) || 0).toLocaleString('en-IN')}`],
        ['Site Category', p.siteCategory || '-', 'Site Expenses', `INR ${(Number(p.siteExpenses) || 0).toLocaleString('en-IN')}`],
        ['Sale Type', p.saleType || '-', 'Net Profit Margin', `INR ${(Number(p.margin) || 0).toLocaleString('en-IN')} (${p.marginPercentage || 0}%)`],
        ['Location', p.location || '-', 'Execution Status', `${p.completedPercentage}% Done (WIP: ${p.workInProgressPercentage}%)`],
        ['Order Managed By', p.orderBy || '-', 'Contact / Phone', p.contactNo || 'Not Provided'],
        ['Client Email', p.emailId || 'Not Provided', 'Installation Address', p.address || 'Not Provided']
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 1.6,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38, textColor: [51, 65, 85] },
        1: { cellWidth: 53 },
        2: { fontStyle: 'bold', cellWidth: 42, textColor: [51, 65, 85] },
        3: { cellWidth: 49 }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    const finalYInfo = (doc as any).lastAutoTable.finalY || currentY + 50;
    currentY = finalYInfo + 5;

    // 3. Milestone Execution Progress Table
    autoTable(doc, {
      startY: currentY,
      head: [['Materials Supply', 'Installation', 'EB Process', 'Documents', 'Warranty', 'Handed Over', 'Overall Status']],
      body: [
        [
          p.materialsSupply ? 'COMPLETED' : 'PENDING',
          p.installation ? 'COMPLETED' : 'PENDING',
          p.ebProcess ? 'COMPLETED' : 'PENDING',
          p.documents ? 'COMPLETED' : 'PENDING',
          p.warranty ? 'COMPLETED' : 'PENDING',
          p.handedOver ? 'COMPLETED' : 'PENDING',
          `${p.completedPercentage}% Completed`
        ]
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        halign: 'center'
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold'
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.cell.raw === 'COMPLETED') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'PENDING') {
            data.cell.styles.textColor = [148, 163, 184];
          } else if (String(data.cell.raw).includes('Completed')) {
            data.cell.styles.textColor = [15, 118, 110];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    const finalYMilestones = (doc as any).lastAutoTable.finalY || currentY + 20;
    currentY = finalYMilestones + 8;

    // 4. Embed Visual Charts if available with automatic page overflow management
    const barCanvas = document.getElementById('financialBarChart') as HTMLCanvasElement;
    const pieCanvas = document.getElementById('financialPieChart') as HTMLCanvasElement;
    const financialCanvas = (this.financialChartMode === 'bar' ? barCanvas : pieCanvas) || barCanvas || pieCanvas;
    const donutCanvas = document.getElementById('progressDonutChart') as HTMLCanvasElement;

    const chartWidth = 85;
    const chartHeight = 52;

    // Check if adding charts would exceed page height (A4 printable height ~ 275mm)
    if (currentY + chartHeight + 15 > 275) {
      doc.addPage();
      currentY = 20; // Start at top margin of new page
    }

    if ((financialCanvas && financialCanvas.width > 0) || (donutCanvas && donutCanvas.width > 0)) {
      try {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 118, 110);
        doc.text('Visual Financial & Execution Progress Charts', margin, currentY);
        currentY += 4;

        if (financialCanvas && financialCanvas.width > 0 && financialCanvas.height > 0) {
          const finDataUrl = financialCanvas.toDataURL('image/png');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(`Financial Distribution (${this.financialChartMode === 'bar' ? 'Bar Graph' : 'Pie Chart'})`, margin, currentY + 2);
          doc.addImage(finDataUrl, 'PNG', margin, currentY + 4, chartWidth, chartHeight);
        }

        if (donutCanvas && donutCanvas.width > 0 && donutCanvas.height > 0) {
          const donutDataUrl = donutCanvas.toDataURL('image/png');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text('Execution Progress Breakdown (Donut)', margin + contentWidth / 2 + 5, currentY + 2);
          doc.addImage(donutDataUrl, 'PNG', margin + contentWidth / 2 + 5, currentY + 4, chartWidth, chartHeight);
        }

        currentY += chartHeight + 10;
      } catch (err) {
        console.warn('Could not export chart canvas to PDF:', err);
      }
    }

    // 5. Footer & Sign-off
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 280, pageWidth - margin, 280);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Record ID: #${p.id || 1}  |  Solar Sathlokhar Management System  |  Confidential Client Report`, margin, 285);
    doc.text('Authorized Signature: _______________________', pageWidth - margin - 65, 285);

    // 6. Action: Show in PDF (open in new tab) AND Save to File
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');

    const cleanSiteId = (p.siteId || 'Site').trim();
    const cleanClientName = (p.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Solar_Sathlokhar_${cleanSiteId}_${cleanClientName}_Report.pdf`);

    this.successMsg = `Project report for ${p.clientName} generated in PDF!`;
  }

  closeClientDetails(): void {
    this.isDetailsModalOpen = false;
    this.destroyCharts();
    this.selectedProject = null;
  }

  editFromDetailsModal(): void {
    if (!this.selectedProject) return;
    const proj = this.selectedProject;
    this.closeClientDetails();
    this.openEditModal(proj);
  }

  destroyCharts(): void {
    if (this.financialChart) {
      this.financialChart.destroy();
      this.financialChart = null;
    }
    if (this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }
  }

  renderCharts(): void {
    if (!this.selectedProject) return;
    this.destroyCharts();

    const p = this.selectedProject;
    const siteVal = Number(p.siteValue) || 0;
    const received = Math.max(0, Number(p.received) || 0);
    const due = Math.max(0, Number(p.due) || 0);
    const expenses = Math.max(0, Number(p.siteExpenses) || 0);
    const margin = Math.max(0, Number(p.margin) || 0);

    // 1. Financial Distribution: Bar Graph (Default) or Pie Chart
    const barCanvas = document.getElementById('financialBarChart') as HTMLCanvasElement;
    const pieCanvas = document.getElementById('financialPieChart') as HTMLCanvasElement;

    if (this.financialChartMode === 'bar' && barCanvas) {
      this.financialChart = new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: ['Received Payment', 'Pending Due', 'Site Expenses', 'Net Margin'],
          datasets: [{
            label: 'Amount (₹)',
            data: [received, due, expenses, margin],
            backgroundColor: [
              '#10b981', // green for received
              '#ef4444', // red for due
              '#f59e0b', // amber for expenses
              '#0f766e'  // teal for margin
            ],
            borderColor: [
              '#059669',
              '#dc2626',
              '#d97706',
              '#115e59'
            ],
            borderWidth: 1.5,
            borderRadius: 6,
            barPercentage: 0.55
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
                font: { size: 9.5, weight: 'bold' }
              },
              grid: {
                color: '#f1f5f9'
              }
            },
            x: {
              ticks: {
                font: { size: 10, weight: 'bold' },
                color: '#334155'
              },
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = Number(context.parsed.y) || 0;
                  const pct = siteVal > 0 ? ((val / siteVal) * 100).toFixed(1) : '0';
                  return ` Amount: ₹${val.toLocaleString('en-IN')} (${pct}% of Site Value)`;
                }
              }
            }
          }
        }
      });
    } else if (this.financialChartMode === 'pie' && pieCanvas) {
      this.financialChart = new Chart(pieCanvas, {
        type: 'pie',
        data: {
          labels: ['Received Payment', 'Pending Due', 'Site Expenses', 'Net Margin'],
          datasets: [{
            data: [received, due, expenses, margin],
            backgroundColor: [
              '#10b981',
              '#ef4444',
              '#f59e0b',
              '#0f766e'
            ],
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 12,
                font: { size: 11, weight: 'bold' }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = Number(context.parsed) || 0;
                  const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                  return ` ${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 2. Project Progress: Clean, Full-size Donut Chart
    const donutCanvas = document.getElementById('progressDonutChart') as HTMLCanvasElement;
    if (donutCanvas) {
      const completed = p.completedPercentage || 0;
      const wip = p.workInProgressPercentage || (100 - completed);

      this.progressChart = new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Milestones Completed', 'Work In Process (Pending)'],
          datasets: [{
            data: [completed, wip],
            backgroundColor: [
              '#0f766e', // teal
              '#fde047'  // warm yellow
            ],
            borderColor: ['#0f766e', '#facc15'],
            borderWidth: 1.5,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 12,
                font: { size: 11, weight: 'bold' }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.label}: ${context.parsed}%`
              }
            }
          }
        }
      });
    }
  }

  // --- DEDICATED CLIENT PAYMENT LEDGER METHODS ---

  // Format Helper: Converts yyyy-mm-dd to dd-mm-yyyy
  toDisplayDate(isoStr: string | undefined | null): string {
    if (!isoStr) return '';
    const iso = this.normalizeToIsoDate(isoStr);
    if (!iso || iso.length < 10) return String(isoStr).trim();
    const parts = iso.substring(0, 10).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const yyyy = parts[0];
      const mm = parts[1].padStart(2, '0');
      const dd = parts[2].padStart(2, '0');
      return `${dd}-${mm}-${yyyy}`;
    }
    return String(isoStr).trim();
  }

  toIsoDate(inputStr: string | undefined): string {
    if (!inputStr) return new Date().toISOString().slice(0, 10);
    return this.normalizeToIsoDate(inputStr);
  }

  getTodayDisplayDate(): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  deriveMoPFromDate(dateStr: string): string {
    const iso = this.toIsoDate(dateStr);
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  }

  getOrdinalLabel(count: number): string {
    const n = count + 1;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return `${n}${suffix} Payment`;
  }

  openClientPaymentLedger(p: Project): void {
    this.activePaymentProject = p;
    this.isPaymentModalOpen = true;
    this.isAddingOrEditingPayment = false;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;

    // Fast instant pre-population from cached payments
    const cleanSiteId = (p.siteId || '').replace(/:/g, '').trim().toLowerCase();
    const cached = this.projectService.getCachedPayments();
    if (cached && cached.length > 0) {
      const matched = cached.filter(pay => (pay.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId);
      this.clientPaymentsList = matched.length > 0 ? [...matched] : [];
    } else {
      this.clientPaymentsList = [];
    }

    this.loadClientPayments(p.siteId);
  }

  loadClientPayments(siteId: string, triggerAdd: boolean = false): void {
    const cleanSiteId = (siteId || '').replace(/:/g, '').trim();
    if (this.clientPaymentsList.length === 0) {
      this.loadingClientPayments = true;
    }
    this.cdr.markForCheck();

    this.projectService.getPayments({ siteId: cleanSiteId }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.clientPaymentsList = res.data;
          if (this.activePaymentProject) {
            this.activePaymentProject.received = res.totalAmount;
            this.activePaymentProject.due = Math.max(0, (Number(this.activePaymentProject.siteValue) || 0) - res.totalAmount);
          }
        }
        this.loadingClientPayments = false;
        this.cdr.markForCheck();
        if (triggerAdd) this.startAddNewPayment();
      },
      error: (err) => {
        console.error('Error loading client payments:', err);
        this.loadingClientPayments = false;
        const cached = this.projectService.getCachedPayments();
        if (cached && this.clientPaymentsList.length === 0) {
          this.clientPaymentsList = cached.filter(pay => (pay.siteId || '').replace(/:/g, '').trim().toLowerCase() === cleanSiteId.toLowerCase());
        }
        this.cdr.markForCheck();
      }
    });
  }

  startAddNewPayment(): void {
    if (!this.activePaymentProject) return;
    this.isAddingOrEditingPayment = true;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;
    this.editingOriginalAmount = 0;

    const nextRemark = this.getOrdinalLabel(this.clientPaymentsList.length);
    this.paymentFormData = {
      dateInput: this.getTodayDisplayDate(),
      siteId: this.activePaymentProject.siteId,
      clientName: this.activePaymentProject.clientName,
      clientSiteName: `${this.activePaymentProject.siteId} : ${this.activePaymentProject.siteCapacity || '5'}KW, ${this.activePaymentProject.clientName}, ${this.activePaymentProject.location || 'Chennai'}`,
      paymentMode: 'Bank Transfer / NEFT',
      remarks: nextRemark,
      amount: null
    };
  }

  startEditPastRecord(p: ClientPayment): void {
    if (!this.activePaymentProject) return;
    this.isAddingOrEditingPayment = true;
    this.isEditingPastRecord = true;
    this.editingPaymentId = p.id || null;
    this.editingOriginalAmount = Number(p.amount) || 0;

    const displayDate = p.formattedDate || this.toDisplayDate(p.paymentDate);
    this.paymentFormData = {
      dateInput: displayDate,
      siteId: this.activePaymentProject.siteId,
      clientName: this.activePaymentProject.clientName,
      clientSiteName: p.clientSiteName || `${this.activePaymentProject.siteId} : ${this.activePaymentProject.clientName}`,
      paymentMode: p.paymentMode || 'Bank Transfer / NEFT',
      remarks: p.remarks || '',
      amount: p.amount
    };
  }

  cancelPaymentSubForm(): void {
    this.isAddingOrEditingPayment = false;
    this.isEditingPastRecord = false;
    this.editingPaymentId = null;
    this.editingOriginalAmount = 0;
  }

  closePaymentModal(): void {
    this.isPaymentModalOpen = false;
    this.activePaymentProject = null;
    this.clientPaymentsList = [];
    this.cancelPaymentSubForm();
  }

  get clientTotalReceived(): number {
    if (!this.clientPaymentsList.length) return Number(this.activePaymentProject?.received) || 0;
    return this.clientPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  get clientCurrentDue(): number {
    const siteVal = Number(this.activePaymentProject?.siteValue) || 0;
    return Math.max(0, siteVal - this.clientTotalReceived);
  }

  get liveNewReceived(): number {
    const base = this.clientTotalReceived;
    const inputAmt = Number(this.paymentFormData.amount) || 0;
    if (this.isEditingPastRecord) {
      return base - this.editingOriginalAmount + inputAmt;
    }
    return base + inputAmt;
  }

  get liveNewDue(): number {
    const siteVal = Number(this.activePaymentProject?.siteValue) || 0;
    return Math.max(0, siteVal - this.liveNewReceived);
  }

  submitClientPayment(): void {
    if (!this.activePaymentProject) return;
    if (!this.paymentFormData.amount || this.paymentFormData.amount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    const isoDate = this.toIsoDate(this.paymentFormData.dateInput);
    const mop = this.deriveMoPFromDate(this.paymentFormData.dateInput);

    const payload: Partial<ClientPayment> = {
      siteId: this.activePaymentProject.siteId,
      clientName: this.activePaymentProject.clientName,
      clientSiteName: this.paymentFormData.clientSiteName || `${this.activePaymentProject.siteId} : ${this.activePaymentProject.clientName}`,
      paymentDate: isoDate,
      mop,
      amount: Number(this.paymentFormData.amount),
      paymentMode: this.paymentFormData.paymentMode || 'Bank Transfer / NEFT',
      remarks: this.paymentFormData.remarks || ''
    };

    if (this.isEditingPastRecord && this.editingPaymentId) {
      this.projectService.updatePayment(this.editingPaymentId, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMsg = `Payment for ${res.data.clientName} updated to ₹ ${Number(res.data.amount).toLocaleString('en-IN')}. Dashboard synchronized!`;
            this.isAddingOrEditingPayment = false;
            this.loadClientPayments(this.activePaymentProject!.siteId);
            this.loadData();
          }
        },
        error: (err) => alert(err.error?.message || 'Error updating payment')
      });
    } else {
      this.projectService.createPayment(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMsg = `Payment of ₹ ${Number(res.data.amount).toLocaleString('en-IN')} added for ${res.data.clientName}. Dashboard synchronized!`;
            this.isAddingOrEditingPayment = false;
            this.loadClientPayments(this.activePaymentProject!.siteId);
            this.loadData();
          }
        },
        error: (err) => alert(err.error?.message || 'Error recording payment')
      });
    }
  }

  deleteClientPaymentRow(p: ClientPayment): void {
    if (!p.id || !this.activePaymentProject) return;
    if (confirm(`Delete payment of ₹ ${Number(p.amount).toLocaleString('en-IN')} (${p.remarks || 'Installment'}) for ${this.activePaymentProject.clientName}?\n\nDashboard Received will be immediately recalculated.`)) {
      this.projectService.deletePayment(p.id).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMsg = 'Payment removed and Dashboard balance recalculated.';
            this.loadClientPayments(this.activePaymentProject!.siteId);
            this.loadData();
          }
        },
        error: (err) => alert(err.error?.message || 'Error deleting payment')
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
