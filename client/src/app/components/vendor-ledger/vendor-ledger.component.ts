import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { VendorLedgerService, VendorPoWo, VendorPayment, VendorWithLedgerData } from '../../services/vendor-ledger.service';
import { OfficeVendor } from '../../services/office.service';
import { MasterListService } from '../../services/master-list.service';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-vendor-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './vendor-ledger.component.html',
  styleUrls: ['./vendor-ledger.component.css']
})
export class VendorLedgerComponent implements OnInit, OnDestroy {
  private vendorService = inject(VendorLedgerService);
  private masterListService = inject(MasterListService);
  private projectService = inject(ProjectService);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Charts
  @ViewChild('barChartCanvas') barChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChartCanvas') pieChartCanvas?: ElementRef<HTMLCanvasElement>;
  financialChart: Chart | null = null;
  materialPieChart: Chart | null = null;

  // Vendor list state
  vendors: (OfficeVendor & { description?: string })[] = [];
  loading = false;
  searchTerm = '';

  // Toast notification
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Selected Vendor View (drill-down profile + tabs)
  selectedVendor: (OfficeVendor & { description?: string }) | null = null;
  ledgerData: VendorWithLedgerData | null = null;
  loadingLedger = false;
  activeTab: 'powo' | 'ledger' = 'powo';

  // Master dropdown options from Add List
  availableMaterials: string[] = [];
  paymentThroughOptions: string[] = ['P.O', 'W.O', 'Petty Cash', 'Accounts'];
  billVoucherOptions: string[] = ['Submitted', 'Not Submitted'];
  generatedByOptions: string[] = [];
  projectsList: { siteId: string; clientName: string; displayName: string }[] = [];
  salesCoordinatorOptions: string[] = ['Renuka', 'Daya', 'Sharath', 'Sathish', 'K Karthikeyan'];

  // BOM Material Groups & Subcategories mapping (as per BOM specifications)
  bomMaterialGroups: { [groupKey: string]: { group: string; subcategories: string[] } } = {
    'cables': {
      group: 'Cables',
      subcategories: [
        'AC Cable - 4Sqmm',
        'AC Cable - 6Sqmm',
        'AC Cable - 10Sqmm',
        'AC Cable - 16Sqmm',
        'AC Cable - 25Sqmm',
        'DC Cable - XLPO 4Sqmm',
        'DC Cable - XLPO 6Sqmm',
        'DC Cable - 10Sqmm'
      ]
    },
    'solar panels': {
      group: 'Solar Panels',
      subcategories: [
        '540W Mono PERC',
        '550W Mono PERC',
        '580W TOPCon',
        '335W Polycrystalline',
        '340W Polycrystalline'
      ]
    },
    'panels': {
      group: 'Panels',
      subcategories: [
        '540W Mono PERC',
        '550W Mono PERC',
        '580W TOPCon',
        '335W Polycrystalline',
        '340W Polycrystalline'
      ]
    },
    'solar inverters': {
      group: 'Solar Inverters',
      subcategories: [
        '3kW Ongrid',
        '5kW Ongrid',
        '10kW Ongrid',
        '15kW Ongrid',
        '20kW Ongrid',
        '5kW Hybrid',
        '10kW Hybrid'
      ]
    },
    'inverters': {
      group: 'Inverters',
      subcategories: [
        '3kW Ongrid',
        '5kW Ongrid',
        '10kW Ongrid',
        '15kW Ongrid',
        '20kW Ongrid',
        '5kW Hybrid',
        '10kW Hybrid'
      ]
    },
    'earthing materials': {
      group: 'Earthing Materials',
      subcategories: [
        'Copper Bonded Chemical Earthing Rod 50mm',
        'ESE Lightning Arrester Kit',
        'GI Flat Strip 25x3mm',
        'Copper Strip 25x3mm'
      ]
    },
    'solar mms': {
      group: 'Solar MMS',
      subcategories: [
        'HDG Rooftop High Structure',
        'Aluminium Rail Profile',
        'Ground Mount Column Structure',
        'Car Port Canopy Structure'
      ]
    },
    'structure': {
      group: 'Structure',
      subcategories: [
        'HDG Rooftop High Structure',
        'Aluminium Rail Profile',
        'Ground Mount Column Structure',
        'Car Port Canopy Structure'
      ]
    },
    'lightning arrestors': {
      group: 'Lightning Arrestors',
      subcategories: [
        'ESE Lightning Arrester Kit',
        'Conventional Copper Spike LA',
        'Lightning Strike Counter'
      ]
    },
    'db boxes': {
      group: 'DB Boxes',
      subcategories: [
        '1-in 1-out ACDB',
        '2-in 2-out ACDB',
        '1-in 1-out DCDB',
        '2-in 2-out DCDB',
        'Integrated AC/DC DB'
      ]
    },
    'consumables': {
      group: 'Consumables',
      subcategories: [
        'SS304 Allen Bolt M8x25',
        'SS304 Hex Bolt M10x30',
        'Anchor Fastener M12x100',
        'Cable Ties UV 300mm',
        'MC4 Connector Single Pair'
      ]
    },
    'material transport': {
      group: 'Material Transport',
      subcategories: [
        'Freight & Site Logistics',
        'Local Tempo / Mini Truck',
        'Site Shifting & Handling',
        'Crane / Unloading Services'
      ]
    }
  };

  // Add / Edit Vendor Modal (for all vendors list view)
  isVendorModalOpen = false;
  isEditVendorModal = false;
  vendorForm = this.getEmptyVendor();
  vendorModalMaterials: { [mat: string]: boolean } = {};
  vendorModalSubcategories: { [sub: string]: boolean } = {};
  vendorModalMaterialRates: { [mat: string]: number | null } = {};

  // Delete Vendor Modal
  isDeleteVendorModalOpen = false;
  vendorToDelete: (OfficeVendor & { description?: string }) | null = null;

  // Selected Vendor Details Form (in drill-down)
  vendorDetailsForm: {
    vendorName: string;
    salesCoordinator: string;
    phoneNo: string;
    location: string;
    gstNo: string;
    creditDays: string;
    description: string;
    materials: { [mat: string]: boolean };
    subcategories: { [sub: string]: boolean };
    materialRates: { [mat: string]: number | null };
  } = {
    vendorName: '',
    salesCoordinator: 'Renuka',
    phoneNo: '',
    location: '',
    gstNo: '',
    creditDays: '30 Days',
    description: '',
    materials: {},
    subcategories: {},
    materialRates: {}
  };
  savingVendorDetails = false;

  // PO / WO Modal State
  isPoWoModalOpen = false;
  isEditPoWo = false;
  editingPoWoId: number | null = null;
  poWoForm = this.getEmptyPoWoForm();
  savingPoWo = false;

  // Delete PO / WO Modal State
  isDeletePoWoModalOpen = false;
  poWoToDelete: VendorPoWo | null = null;

  // DR Payment Modal State
  isPaymentModalOpen = false;
  isEditPayment = false;
  editingPaymentId: number | null = null;
  paymentForm = this.getEmptyPaymentForm();
  savingPayment = false;

  // Delete Payment Modal State
  isDeletePaymentModalOpen = false;
  paymentToDelete: VendorPayment | null = null;

  ngOnInit(): void {
    this.loadVendors();
    this.loadMasterOptions();
    this.loadProjects();

    // Check query params if vendor specified e.g. ?id=8
    this.route.queryParams.subscribe(params => {
      const id = params['id'];
      if (id) {
        const numId = parseInt(id, 10);
        if (numId) {
          this.selectVendorById(numId);
        }
      }
    });
  }

  loadVendors(): void {
    this.loading = true;
    this.vendorService.getVendors().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.vendors = res.data;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load vendors list.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  loadMasterOptions(): void {
    this.masterListService.getAllLists().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const matList = res.data.find(l => l.title.toLowerCase().trim() === 'materials');
          if (matList?.items && matList.items.length > 0) {
            this.availableMaterials = matList.items;
          } else {
            this.availableMaterials = [
              'Cable Tray Materials', 'Cables', 'Civil Work Labour', 'Consumables',
              'DB Boxes', 'Earthing Materials', 'Expo / Event Expenses', 'Labour/Manpower',
              'Lead Acid Batteries', 'Lightning Arrestors', 'Lithium Batteries', 'Material Transport',
              'Panles Cleaning Liquid', 'Rental Tools', 'Solar CEIG Works', 'Solar I&C Works',
              'Solar Inverters', 'Solar Meters', 'Solar MMS', 'Solar Panels', 'TATA SPG Package'
            ];
          }

          const ptList = res.data.find(l => l.title.toLowerCase().trim() === 'payment through');
          if (ptList?.items && ptList.items.length > 0) {
            this.paymentThroughOptions = ptList.items;
          }

          const bvList = res.data.find(l => l.title.toLowerCase().trim() === 'bill / voucher status');
          if (bvList?.items && bvList.items.length > 0) {
            this.billVoucherOptions = bvList.items;
          }

          const ppList = res.data.find(l => l.title.toLowerCase().trim() === 'payment purpose');
          if (ppList?.items && ppList.items.length > 0) {
            this.generatedByOptions = ppList.items;
          } else {
            this.generatedByOptions = ['K SATHISH', 'K KARTHIKEYAN', 'V SHARATH', 'RENUKA S', 'OFFICE'];
          }
          this.cdr.markForCheck();
        }
      }
    });

    // Also sync dynamic BOM Materials from database
    this.masterListService.getBomMaterials().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          for (const item of res.data) {
            const rawGrp = (item.groupName || '').toLowerCase().trim();
            if (!rawGrp) continue;
            const key = this.findGroupKey(rawGrp) || rawGrp;
            if (!this.bomMaterialGroups[key]) {
              this.bomMaterialGroups[key] = { group: item.groupName, subcategories: [] };
            }
            const specLabel = item.specification ? item.specification.trim() : '';
            if (specLabel && !this.bomMaterialGroups[key].subcategories.includes(specLabel)) {
              this.bomMaterialGroups[key].subcategories.push(specLabel);
            }
          }
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.projectsList = res.data.map(p => ({
            siteId: p.siteId,
            clientName: p.clientName,
            displayName: `${p.siteId} : ${p.clientName}`
          }));
          this.cdr.markForCheck();
        }
      }
    });
  }

  get filteredVendors(): (OfficeVendor & { description?: string })[] {
    if (!this.searchTerm.trim()) return this.vendors;
    const term = this.searchTerm.trim().toLowerCase();
    return this.vendors.filter(v =>
      (v.vendorName || '').toLowerCase().includes(term) ||
      (v.salesCoordinator || '').toLowerCase().includes(term) ||
      (v.phoneNo || '').toLowerCase().includes(term) ||
      (v.location || '').toLowerCase().includes(term) ||
      (v.gstNo || '').toLowerCase().includes(term) ||
      (v.materialsSpec || '').toLowerCase().includes(term) ||
      (v.creditDays || '').toLowerCase().includes(term) ||
      (v.description || '').toLowerCase().includes(term)
    );
  }

  // --- VENDOR SELECTION & PROFILE VIEW ---
  selectVendor(vendor: OfficeVendor & { description?: string }): void {
    this.selectedVendor = vendor;
    this.activeTab = 'powo';
    this.initVendorDetailsForm(vendor);
    this.loadVendorLedger(vendor.id!);
  }

  selectVendorById(id: number): void {
    this.vendorService.getVendorWithLedger(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selectedVendor = res.data.vendor;
          this.ledgerData = res.data;
          this.initVendorDetailsForm(res.data.vendor);
          this.cdr.markForCheck();
        }
      }
    });
  }

  findGroupKey(mat: string): string {
    const raw = (mat || '').toLowerCase().trim();
    if (this.bomMaterialGroups[raw]) return raw;
    if (raw.includes('cable tray')) return '';
    if (raw.includes('cable')) return 'cables';
    if (raw.includes('panel')) return 'solar panels';
    if (raw.includes('inverter')) return 'solar inverters';
    if (raw.includes('earthing')) return 'earthing materials';
    if (raw.includes('mms') || raw.includes('structure')) return 'solar mms';
    if (raw.includes('arrestor')) return 'lightning arrestors';
    if (raw.includes('db box')) return 'db boxes';
    if (raw.includes('consumable')) return 'consumables';
    if (raw.includes('transport')) return 'material transport';
    return '';
  }

  hasSubcategories(mat: string): boolean {
    const key = this.findGroupKey(mat);
    return !!(key && this.bomMaterialGroups[key]?.subcategories?.length > 0);
  }

  getSubcategories(mat: string): string[] {
    const key = this.findGroupKey(mat);
    return (key && this.bomMaterialGroups[key]?.subcategories) || [];
  }

  getActiveGroupsWithSubcategories(isModal: boolean = false): string[] {
    const matSource = isModal ? this.vendorModalMaterials : this.vendorDetailsForm.materials;
    return this.availableMaterials.filter(mat => Boolean(matSource[mat]) && this.hasSubcategories(mat));
  }

  onMaterialCheckboxChange(mat: string, isModal: boolean = false): void {
    const isChecked = isModal ? this.vendorModalMaterials[mat] : this.vendorDetailsForm.materials[mat];
    const subs = this.getSubcategories(mat);
    const subTarget = isModal ? this.vendorModalSubcategories : this.vendorDetailsForm.subcategories;

    if (!isChecked) {
      for (const s of subs) {
        subTarget[s] = false;
      }
    }
    this.cdr.markForCheck();
  }

  toggleAllSubcategories(mat: string, selectAll: boolean, isModal: boolean = false): void {
    const subs = this.getSubcategories(mat);
    const subTarget = isModal ? this.vendorModalSubcategories : this.vendorDetailsForm.subcategories;
    for (const s of subs) {
      subTarget[s] = selectAll;
    }
    this.cdr.markForCheck();
  }

  getSelectedSubcategoriesForGroup(mat: string, isModal: boolean = false): string[] {
    const subs = this.getSubcategories(mat);
    const subTarget = isModal ? this.vendorModalSubcategories : this.vendorDetailsForm.subcategories;
    return subs.filter(s => Boolean(subTarget[s]));
  }

  initVendorDetailsForm(vendor: OfficeVendor & { description?: string; materialRates?: any }): void {
    const matMap: { [mat: string]: boolean } = {};
    const subMap: { [sub: string]: boolean } = {};
    const existing = (vendor.materialsSpec || '')
      .split(',')
      .map(m => m.trim().toLowerCase())
      .filter(Boolean);

    let ratesMap: { [mat: string]: number | null } = {};
    if (vendor.materialRates) {
      if (typeof vendor.materialRates === 'string') {
        try {
          ratesMap = JSON.parse(vendor.materialRates);
        } catch (e) {
          ratesMap = {};
        }
      } else if (typeof vendor.materialRates === 'object') {
        ratesMap = { ...vendor.materialRates };
      }
    }

    for (const mat of this.availableMaterials) {
      const matLower = mat.toLowerCase().trim();
      let isMatChecked = existing.includes(matLower) || existing.some(e => e.startsWith(matLower + ':') || e.startsWith(matLower + ' -'));

      const subs = this.getSubcategories(mat);
      for (const sub of subs) {
        const subLower = sub.toLowerCase().trim();
        const fullComboLower = `${matLower}: ${subLower}`;
        const isSubChecked = existing.some(e => e === subLower || e === fullComboLower || e.includes(subLower)) ||
                             ratesMap[sub] !== undefined || ratesMap[`${mat}: ${sub}`] !== undefined;
        if (isSubChecked) {
          subMap[sub] = true;
          isMatChecked = true;
        } else {
          subMap[sub] = false;
        }

        if (ratesMap[sub] !== undefined && ratesMap[`${mat}: ${sub}`] === undefined) {
          ratesMap[`${mat}: ${sub}`] = ratesMap[sub];
        }
      }
      matMap[mat] = isMatChecked;
    }

    this.vendorDetailsForm = {
      vendorName: vendor.vendorName || '',
      salesCoordinator: vendor.salesCoordinator || 'Renuka',
      phoneNo: vendor.phoneNo || '',
      location: vendor.location || '',
      gstNo: vendor.gstNo || '',
      creditDays: vendor.creditDays || '30 Days',
      description: vendor.description || '',
      materials: matMap,
      subcategories: subMap,
      materialRates: ratesMap
    };
  }

  getSelectedMaterialsList(): string[] {
    if (!this.vendorDetailsForm || !this.vendorDetailsForm.materials) return [];
    const list: string[] = [];
    const activeMats = Object.keys(this.vendorDetailsForm.materials).filter(m => Boolean(this.vendorDetailsForm.materials[m]));

    for (const mat of activeMats) {
      if (this.hasSubcategories(mat)) {
        const subs = this.getSelectedSubcategoriesForGroup(mat, false);
        if (subs.length > 0) {
          for (const s of subs) {
            list.push(`${mat}: ${s}`);
          }
        } else {
          list.push(mat);
        }
      } else {
        list.push(mat);
      }
    }
    return list;
  }

  getModalSelectedMaterialsList(): string[] {
    if (!this.vendorModalMaterials) return [];
    const list: string[] = [];
    const activeMats = Object.keys(this.vendorModalMaterials).filter(m => Boolean(this.vendorModalMaterials[m]));

    for (const mat of activeMats) {
      if (this.hasSubcategories(mat)) {
        const subs = this.getSelectedSubcategoriesForGroup(mat, true);
        if (subs.length > 0) {
          for (const s of subs) {
            list.push(`${mat}: ${s}`);
          }
        } else {
          list.push(mat);
        }
      } else {
        list.push(mat);
      }
    }
    return list;
  }

  loadVendorLedger(id: number): void {
    this.loadingLedger = true;
    this.vendorService.getVendorWithLedger(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.ledgerData = res.data;
          if (res.data.vendor) {
            this.selectedVendor = res.data.vendor;
            this.initVendorDetailsForm(res.data.vendor);
          }
          this.renderCharts();
        }
        this.loadingLedger = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingLedger = false;
        this.showToast('Failed to load vendor ledger records.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  backToVendorList(): void {
    this.destroyCharts();
    this.selectedVendor = null;
    this.ledgerData = null;
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    this.loadVendors();
  }

  // Helper to extract just the number from credit days (e.g. "30 Days" -> "30")
  getCreditDaysNumber(val?: string): string {
    if (!val) return '30';
    const m = val.toString().match(/\d+/);
    return m ? m[0] : val.toString();
  }

  // --- CHART RENDERING (Bar Chart & Pie Chart) ---
  renderCharts(): void {
    if (!this.ledgerData) return;
    this.destroyCharts();

    setTimeout(() => {
      this.initBarChart();
      this.initPieChart();
    }, 100);
  }

  destroyCharts(): void {
    if (this.financialChart) {
      this.financialChart.destroy();
      this.financialChart = null;
    }
    if (this.materialPieChart) {
      this.materialPieChart.destroy();
      this.materialPieChart = null;
    }
  }

  initBarChart(): void {
    if (!this.barChartCanvas?.nativeElement || !this.ledgerData) return;
    const ctx = this.barChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const cr = this.ledgerData.totalCr || 0;
    const dr = this.ledgerData.totalDr || 0;
    const due = this.ledgerData.dueToPay || 0;

    this.financialChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Expenses Incurred (CR)', 'Payments Settled (DR)', 'Outstanding Due'],
        datasets: [{
          label: 'Amount (₹)',
          data: [cr, dr, due],
          backgroundColor: [
            'rgba(239, 68, 68, 0.85)',   // Red for CR Incurred
            'rgba(16, 185, 129, 0.85)',  // Green for DR Settled
            'rgba(245, 158, 11, 0.85)'   // Amber for Due to Pay
          ],
          borderColor: [
            '#ef4444',
            '#10b981',
            '#f59e0b'
          ],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ` ₹ ${Number(item.raw).toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => '₹' + Number(val).toLocaleString('en-IN')
            }
          }
        }
      }
    });
  }

  initPieChart(): void {
    if (!this.pieChartCanvas?.nativeElement || !this.ledgerData) return;
    const ctx = this.pieChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Aggregate by materials from poWos
    const poList = this.ledgerData.poWos || [];
    const matTotals: { [k: string]: number } = {};
    for (const po of poList) {
      const mat = po.materialDescription?.trim() || 'General';
      matTotals[mat] = (matTotals[mat] || 0) + (Number(po.orderValue) || 0);
    }

    let labels = Object.keys(matTotals);
    let data = Object.values(matTotals);

    // If no material breakdown available, show Settled vs Due
    if (labels.length === 0 || data.every(v => v === 0)) {
      labels = ['Settled (DR)', 'Outstanding Due'];
      data = [this.ledgerData.totalDr || 0, this.ledgerData.dueToPay || 0];
      if (data.every(v => v === 0)) {
        labels = ['Settled'];
        data = [1];
      }
    }

    const palette = [
      '#0f766e', '#0284c7', '#84cc16', '#f59e0b', '#ec4899', 
      '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#64748b'
    ];

    this.materialPieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 11,
              font: { size: 10 }
            }
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ₹ ${Number(item.raw).toLocaleString('en-IN')}`
            }
          }
        },
        cutout: '55%'
      }
    });
  }

  saveVendorProfileDetails(): void {
    if (!this.selectedVendor?.id) return;
    if (!this.vendorDetailsForm.vendorName?.trim()) {
      this.showToast('Vendor Name is required.', 'danger');
      return;
    }

    const selectedMats = this.getSelectedMaterialsList();

    // Clean and validate rates as double numbers for all selected materials
    const cleanRates: { [mat: string]: number } = {};
    for (const item of selectedMats) {
      const val = this.vendorDetailsForm.materialRates[item] !== undefined
        ? this.vendorDetailsForm.materialRates[item]
        : this.vendorDetailsForm.materialRates[item.split(': ')[1] || item];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        const num = parseFloat(Number(val).toFixed(2));
        cleanRates[item] = num;
        if (item.includes(': ')) {
          const sub = item.split(': ')[1].trim();
          cleanRates[sub] = num;
        }
      } else {
        cleanRates[item] = 0.0;
      }
    }

    this.savingVendorDetails = true;
    const payload = {
      vendorName: this.vendorDetailsForm.vendorName.trim(),
      salesCoordinator: this.vendorDetailsForm.salesCoordinator,
      phoneNo: this.vendorDetailsForm.phoneNo,
      location: this.vendorDetailsForm.location,
      gstNo: this.vendorDetailsForm.gstNo?.trim() || '',
      creditDays: this.vendorDetailsForm.creditDays,
      description: this.vendorDetailsForm.description,
      materialsSpec: selectedMats.join(', '),
      materialRates: cleanRates
    };

    this.vendorService.updateVendor(this.selectedVendor.id, payload).subscribe({
      next: (res) => {
        this.savingVendorDetails = false;
        if (res.success && res.data) {
          this.selectedVendor = { ...this.selectedVendor, ...res.data };
          this.showToast('Vendor details updated successfully!', 'success');
          // Update in local list
          const idx = this.vendors.findIndex(v => v.id === this.selectedVendor!.id);
          if (idx !== -1) {
            this.vendors[idx] = { ...this.vendors[idx], ...res.data };
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingVendorDetails = false;
        this.showToast('Failed to update vendor details.', 'danger');
        this.cdr.markForCheck();
      }
    });
  }

  // --- ADD / EDIT VENDOR MODAL (Master List) ---
  openAddVendorModal(): void {
    this.isEditVendorModal = false;
    this.vendorForm = this.getEmptyVendor();
    this.vendorModalMaterials = {};
    this.vendorModalSubcategories = {};
    this.vendorModalMaterialRates = {};
    for (const m of this.availableMaterials) {
      this.vendorModalMaterials[m] = false;
      const subs = this.getSubcategories(m);
      for (const s of subs) {
        this.vendorModalSubcategories[s] = false;
      }
    }
    this.isVendorModalOpen = true;
  }

  openEditVendorModal(v: OfficeVendor & { description?: string }): void {
    this.isEditVendorModal = true;
    this.vendorForm = { ...v, gstNo: v.gstNo || '' };
    this.vendorModalMaterials = {};
    this.vendorModalSubcategories = {};
    this.vendorModalMaterialRates = {};

    let ratesMap: { [mat: string]: number | null } = {};
    if (v.materialRates) {
      if (typeof v.materialRates === 'string') {
        try {
          ratesMap = JSON.parse(v.materialRates);
        } catch (e) {
          ratesMap = {};
        }
      } else if (typeof v.materialRates === 'object') {
        ratesMap = { ...v.materialRates };
      }
    }

    const existing = (v.materialsSpec || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    for (const m of this.availableMaterials) {
      const matLower = m.toLowerCase().trim();
      let isMatChecked = existing.includes(matLower) || existing.some(e => e.startsWith(matLower + ':') || e.startsWith(matLower + ' -'));

      const subs = this.getSubcategories(m);
      for (const sub of subs) {
        const subLower = sub.toLowerCase().trim();
        const fullComboLower = `${matLower}: ${subLower}`;
        const isSubChecked = existing.some(e => e === subLower || e === fullComboLower || e.includes(subLower)) ||
                             ratesMap[sub] !== undefined || ratesMap[`${m}: ${sub}`] !== undefined;
        if (isSubChecked) {
          this.vendorModalSubcategories[sub] = true;
          isMatChecked = true;
        } else {
          this.vendorModalSubcategories[sub] = false;
        }

        if (ratesMap[sub] !== undefined && ratesMap[`${m}: ${sub}`] === undefined) {
          ratesMap[`${m}: ${sub}`] = ratesMap[sub];
        }
      }
      this.vendorModalMaterials[m] = isMatChecked;
    }

    this.vendorModalMaterialRates = ratesMap;
    this.isVendorModalOpen = true;
  }

  closeVendorModal(): void {
    this.isVendorModalOpen = false;
  }

  saveVendorFromModal(): void {
    if (!this.vendorForm.vendorName?.trim()) {
      this.showToast('Vendor Name is required.', 'danger');
      return;
    }

    const mats = this.getModalSelectedMaterialsList();
    const cleanRates: { [mat: string]: number } = {};
    for (const mat of mats) {
      const val = this.vendorModalMaterialRates[mat] !== undefined
        ? this.vendorModalMaterialRates[mat]
        : this.vendorModalMaterialRates[mat.split(': ')[1] || mat];
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        const num = parseFloat(Number(val).toFixed(2));
        cleanRates[mat] = num;
        if (mat.includes(': ')) {
          const sub = mat.split(': ')[1].trim();
          cleanRates[sub] = num;
        }
      } else {
        cleanRates[mat] = 0.0;
      }
    }

    const payload = {
      ...this.vendorForm,
      gstNo: this.vendorForm.gstNo ? this.vendorForm.gstNo.trim() : '',
      materialsSpec: mats.join(', '),
      materialRates: cleanRates
    };

    if (this.isEditVendorModal && this.vendorForm.id) {
      this.vendorService.updateVendor(this.vendorForm.id, payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast('Vendor updated successfully!', 'success');
            this.closeVendorModal();
            this.loadVendors();
          }
        },
        error: () => this.showToast('Failed to update vendor.', 'danger')
      });
    } else {
      this.vendorService.createVendor(payload).subscribe({
        next: (res) => {
          if (res.success) {
            this.showToast('Vendor registered successfully!', 'success');
            this.closeVendorModal();
            this.loadVendors();
          }
        },
        error: () => this.showToast('Failed to register vendor.', 'danger')
      });
    }
  }

  confirmDeleteVendor(v: OfficeVendor & { description?: string }): void {
    this.vendorToDelete = v;
    this.isDeleteVendorModalOpen = true;
  }

  closeDeleteVendorModal(): void {
    this.isDeleteVendorModalOpen = false;
    this.vendorToDelete = null;
  }

  deleteVendor(): void {
    if (!this.vendorToDelete?.id) return;
    this.vendorService.deleteVendor(this.vendorToDelete.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.vendors = this.vendors.filter(v => v.id !== this.vendorToDelete!.id);
          this.showToast('Vendor deleted successfully.', 'success');
          this.closeDeleteVendorModal();
          if (this.selectedVendor?.id === this.vendorToDelete?.id) {
            this.backToVendorList();
          }
        }
      },
      error: () => this.showToast('Failed to delete vendor.', 'danger')
    });
  }

  // --- PO / WO METHODS ---
  openCreatePoWoModal(): void {
    this.isEditPoWo = false;
    this.editingPoWoId = null;
    this.poWoForm = this.getEmptyPoWoForm();
    this.isPoWoModalOpen = true;
  }

  openEditPoWoModal(po: VendorPoWo): void {
    this.isEditPoWo = true;
    this.editingPoWoId = po.id || null;
    this.poWoForm = {
      date: po.date,
      poWoNumber: po.poWoNumber,
      orderValue: po.orderValue,
      materialDescription: po.materialDescription || '',
      clientName: po.clientName || '',
      orderType: po.orderType || 'P.O',
      generatedBy: po.generatedBy || '',
      billVoucherStatus: po.billVoucherStatus || 'Not Submitted',
      invoiceNo: po.invoiceNo || '',
      remarks: po.remarks || ''
    };
    this.isPoWoModalOpen = true;
  }

  closePoWoModal(): void {
    this.isPoWoModalOpen = false;
    this.poWoForm = this.getEmptyPoWoForm();
  }

  savePoWo(): void {
    if (!this.selectedVendor?.id) return;
    if (!this.poWoForm.poWoNumber?.trim()) {
      this.showToast('PO/WO Number is required.', 'danger');
      return;
    }
    const val = Number(this.poWoForm.orderValue) || 0;
    if (val <= 0) {
      this.showToast('Please enter a valid Order Value.', 'danger');
      return;
    }

    this.savingPoWo = true;
    const payload: Partial<VendorPoWo> = {
      date: this.poWoForm.date || new Date().toISOString().split('T')[0],
      poWoNumber: this.poWoForm.poWoNumber.trim().substring(0, 20),
      orderValue: val,
      materialDescription: this.poWoForm.materialDescription,
      clientName: this.poWoForm.clientName,
      orderType: this.poWoForm.orderType,
      generatedBy: this.poWoForm.generatedBy,
      billVoucherStatus: this.poWoForm.billVoucherStatus,
      invoiceNo: this.poWoForm.invoiceNo ? this.poWoForm.invoiceNo.trim() : '',
      remarks: this.poWoForm.remarks
    };

    if (this.isEditPoWo && this.editingPoWoId) {
      this.vendorService.updatePoWo(this.selectedVendor.id, this.editingPoWoId, payload).subscribe({
        next: (res) => {
          this.savingPoWo = false;
          if (res.success) {
            this.showToast('PO/WO record updated successfully!', 'success');
            this.closePoWoModal();
            this.loadVendorLedger(this.selectedVendor!.id!);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.savingPoWo = false;
          this.showToast('Failed to update PO/WO record.', 'danger');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.vendorService.createPoWo(this.selectedVendor.id, payload).subscribe({
        next: (res) => {
          this.savingPoWo = false;
          if (res.success) {
            this.showToast('PO/WO record created successfully!', 'success');
            this.closePoWoModal();
            this.loadVendorLedger(this.selectedVendor!.id!);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.savingPoWo = false;
          this.showToast('Failed to create PO/WO record.', 'danger');
          this.cdr.markForCheck();
        }
      });
    }
  }

  confirmDeletePoWo(po: VendorPoWo): void {
    this.poWoToDelete = po;
    this.isDeletePoWoModalOpen = true;
  }

  closeDeletePoWoModal(): void {
    this.isDeletePoWoModalOpen = false;
    this.poWoToDelete = null;
  }

  deletePoWo(): void {
    if (!this.selectedVendor?.id || !this.poWoToDelete?.id) return;
    this.vendorService.deletePoWo(this.selectedVendor.id, this.poWoToDelete.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('PO/WO deleted successfully.', 'success');
          this.closeDeletePoWoModal();
          this.loadVendorLedger(this.selectedVendor!.id!);
        }
      },
      error: () => this.showToast('Failed to delete PO/WO.', 'danger')
    });
  }

  // --- DR PAYMENT METHODS ---
  openRecordPaymentModal(): void {
    this.isEditPayment = false;
    this.editingPaymentId = null;
    this.paymentForm = this.getEmptyPaymentForm();
    this.isPaymentModalOpen = true;
  }

  openEditPaymentModal(pay: VendorPayment): void {
    this.isEditPayment = true;
    this.editingPaymentId = pay.id || null;
    this.paymentForm = {
      date: pay.date,
      amount: pay.amount,
      urnNumber: pay.urnNumber || '',
      paymentMode: pay.paymentMode || 'Bank Transfer / NEFT',
      remarks: pay.remarks || ''
    };
    this.isPaymentModalOpen = true;
  }

  closePaymentModal(): void {
    this.isPaymentModalOpen = false;
    this.paymentForm = this.getEmptyPaymentForm();
  }

  savePayment(): void {
    if (!this.selectedVendor?.id) return;
    const val = Number(this.paymentForm.amount) || 0;
    if (val <= 0) {
      this.showToast('Please enter a valid payment amount.', 'danger');
      return;
    }

    this.savingPayment = true;
    const payload: Partial<VendorPayment> = {
      date: this.paymentForm.date || new Date().toISOString().split('T')[0],
      amount: val,
      urnNumber: this.paymentForm.urnNumber?.trim() || '',
      paymentMode: this.paymentForm.paymentMode,
      remarks: this.paymentForm.remarks
    };

    if (this.isEditPayment && this.editingPaymentId) {
      this.vendorService.updatePayment(this.selectedVendor.id, this.editingPaymentId, payload).subscribe({
        next: (res) => {
          this.savingPayment = false;
          if (res.success) {
            this.showToast('Payment record updated successfully!', 'success');
            this.closePaymentModal();
            this.loadVendorLedger(this.selectedVendor!.id!);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.savingPayment = false;
          this.showToast('Failed to update payment record.', 'danger');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.vendorService.createPayment(this.selectedVendor.id, payload).subscribe({
        next: (res) => {
          this.savingPayment = false;
          if (res.success) {
            this.showToast('Payment recorded successfully!', 'success');
            this.closePaymentModal();
            this.loadVendorLedger(this.selectedVendor!.id!);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.savingPayment = false;
          this.showToast('Failed to record payment.', 'danger');
          this.cdr.markForCheck();
        }
      });
    }
  }

  confirmDeletePayment(pay: VendorPayment): void {
    this.paymentToDelete = pay;
    this.isDeletePaymentModalOpen = true;
  }

  closeDeletePaymentModal(): void {
    this.isDeletePaymentModalOpen = false;
    this.paymentToDelete = null;
  }

  deletePayment(): void {
    if (!this.selectedVendor?.id || !this.paymentToDelete?.id) return;
    this.vendorService.deletePayment(this.selectedVendor.id, this.paymentToDelete.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('Payment record removed.', 'success');
          this.closeDeletePaymentModal();
          this.loadVendorLedger(this.selectedVendor!.id!);
        }
      },
      error: () => this.showToast('Failed to delete payment.', 'danger')
    });
  }

  // --- COUNTDOWN CALCULATION ---
  getCountdown(po: VendorPoWo): { daysLeft: number; status: 'safe' | 'warning' | 'overdue' | 'pending'; label: string } {
    if (!po.invoiceNo || !po.invoiceNo.trim()) {
      return { daysLeft: 0, status: 'pending', label: 'Invoice Pending' };
    }
    const creditDaysStr = this.selectedVendor?.creditDays || '30 Days';
    const match = creditDaysStr.match(/\d+/);
    const creditDays = match ? parseInt(match[0], 10) : 30;

    const poDate = new Date(po.date);
    const today = new Date();
    const poMidnight = new Date(poDate.getFullYear(), poDate.getMonth(), poDate.getDate()).getTime();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const daysElapsed = Math.floor((todayMidnight - poMidnight) / (1000 * 60 * 60 * 24));
    const daysLeft = creditDays - daysElapsed;

    if (daysLeft > 3) {
      return { daysLeft, status: 'safe', label: `${daysLeft} days left` };
    } else if (daysLeft > 0) {
      return { daysLeft, status: 'warning', label: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left` };
    } else if (daysLeft === 0) {
      return { daysLeft, status: 'warning', label: 'Due Today' };
    } else {
      return { daysLeft, status: 'overdue', label: `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) > 1 ? 's' : ''}` };
    }
  }

  // Quick attach invoice from synced Expenses Ledger
  attachInvoiceToPo(po: VendorPoWo, invNo: string): void {
    if (!this.selectedVendor?.id || !po.id) return;
    this.vendorService.updatePoWo(this.selectedVendor.id, po.id, { invoiceNo: invNo, billVoucherStatus: 'Submitted' }).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast(`Invoice #${invNo} attached to PO #${po.poWoNumber}!`, 'success');
          this.loadVendorLedger(this.selectedVendor!.id!);
        }
      }
    });
  }

  // Form helpers
  getEmptyVendor(): Partial<OfficeVendor & { description?: string }> {
    return {
      vendorName: '',
      salesCoordinator: 'Renuka',
      phoneNo: '',
      location: '',
      gstNo: '',
      materialsSpec: '',
      creditDays: '30 Days',
      description: ''
    };
  }

  getEmptyPoWoForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      poWoNumber: '',
      orderValue: null as number | null,
      materialDescription: '',
      clientName: '',
      orderType: 'P.O',
      generatedBy: 'K SATHISH',
      billVoucherStatus: 'Not Submitted',
      invoiceNo: '',
      remarks: ''
    };
  }

  getEmptyPaymentForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      amount: null as number | null,
      urnNumber: '',
      paymentMode: 'Bank Transfer / NEFT',
      remarks: ''
    };
  }

  formatDate(dateVal?: any): string {
    if (!dateVal) return '—';
    try {
      if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return '—';
        const d = String(dateVal.getDate()).padStart(2, '0');
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const y = dateVal.getFullYear();
        return `${d}-${m}-${y}`;
      }

      const str = String(dateVal).trim();
      if (!str || str === '-' || str === '—' || str === 'null' || str === 'undefined') return '—';

      const clean = str.split('T')[0].split(' ')[0].trim();

      const ymd = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
      if (ymd) {
        const y = ymd[1];
        const m = ymd[2].padStart(2, '0');
        const d = ymd[3].padStart(2, '0');
        return `${d}-${m}-${y}`;
      }

      const dmy = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (dmy) {
        const d = dmy[1].padStart(2, '0');
        const m = dmy[2].padStart(2, '0');
        const y = dmy[3];
        return `${d}-${m}-${y}`;
      }

      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        const d = String(parsed.getDate()).padStart(2, '0');
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const y = parsed.getFullYear();
        return `${d}-${m}-${y}`;
      }

      return clean || str;
    } catch {
      return String(dateVal);
    }
  }

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.markForCheck();
    }, 4500);
  }

  // Export Vendor PDF Statement
  exportVendorPdf(vendor: OfficeVendor): void {
    if (!vendor || !vendor.id) return;

    this.vendorService.getVendorWithLedger(vendor.id).subscribe({
      next: (res) => {
        const data: VendorWithLedgerData = res.data;
        const vInfo = data.vendor || vendor;
        const powos = data.poWos || [];
        const payments = data.payments || [];

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = 210;
        const margin = 14;

        // 1. Header Banner
        doc.setFillColor(15, 118, 110); // Teal brand
        doc.rect(0, 0, pageWidth, 26, 'F');

        // Accent Line
        doc.setFillColor(245, 158, 11);
        doc.rect(0, 26, pageWidth, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text('SOLAR SATHLOKHAR', margin, 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(224, 242, 254);
        doc.text('OFFICIAL VENDOR PROCUREMENT & ACCOUNTS LEDGER STATEMENT', margin, 17);

        doc.setFontSize(7.5);
        doc.text(`Vendor ID: #${vInfo.id}  |  Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, 22);

        let currentY = 34;

        // 2. Vendor Information Box
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 118, 110);
        doc.text(`${vInfo.vendorName || 'Vendor Profile'}`, margin, currentY);

        currentY += 5;

        const vendorProfileOverview = [
          ['Vendor Name', vInfo.vendorName || '-', 'Coordinator', vInfo.salesCoordinator || '-'],
          ['Phone No', vInfo.phoneNo || '-', 'Location', vInfo.location || '-'],
          ['GST No.', vInfo.gstNo || '-', 'Credit Days', vInfo.creditDays || '30 Days'],
          ['Materials', vInfo.materialsSpec || '-', 'Report Date', new Date().toLocaleDateString('en-GB')],
          ['Notes / Description', vInfo.description || '-', '', '']
        ];

        autoTable(doc, {
          body: vendorProfileOverview,
          startY: currentY,
          theme: 'plain',
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 },
            1: { textColor: [30, 41, 59], cellWidth: 60 },
            2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 },
            3: { textColor: [30, 41, 59], cellWidth: 50 }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        // 3. Financial Summary Card
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text('Vendor Accounts Summary (CR / DR Balance)', margin, currentY);

        currentY += 4;

        const summaryData = [
          [
            `₹ ${(data.totalCr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            `₹ ${(data.totalDr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            `₹ ${(data.dueToPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]
        ];

        autoTable(doc, {
          head: [['Total Incurred (CR)', 'Total Paid (DR)', 'Outstanding Due to Pay']],
          body: summaryData,
          startY: currentY,
          styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', halign: 'center' },
          bodyStyles: { fontStyle: 'bold', textColor: [30, 41, 59] }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        // 4. PO / WO Orders Table
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(`Purchase Orders & Work Orders (${powos.length} Vouchers)`, margin, currentY);

        currentY += 4;

        if (powos.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(148, 163, 184);
          doc.text('No PO / WO vouchers recorded for this vendor.', margin, currentY + 4);
          currentY += 10;
        } else {
          const powoRows = powos.map((p: any) => [
            p.voucharNo || '-',
            p.date ? new Date(p.date).toLocaleDateString('en-GB') : '-',
            p.projectRef || '-',
            p.description || '-',
            p.status || 'Active',
            `₹ ${(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]);

          autoTable(doc, {
            head: [['Voucher No', 'Date', 'Project Ref', 'Description / Details', 'Status', 'Incurred Amount (CR)']],
            body: powoRows,
            startY: currentY,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontStyle: 'bold' },
            columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } }
          });

          currentY = (doc as any).lastAutoTable.finalY + 8;
        }

        // 5. Payment Ledger Table
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(`Payment Disbursements (${payments.length} Payments)`, margin, currentY);

        currentY += 4;

        if (payments.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(148, 163, 184);
          doc.text('No payment transactions recorded for this vendor.', margin, currentY + 4);
        } else {
          const paymentRows = payments.map((pay: any) => [
            pay.urnNumber || pay.voucharNo || '-',
            pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString('en-GB') : (pay.date ? new Date(pay.date).toLocaleDateString('en-GB') : '-'),
            pay.paymentMode || 'Bank Transfer',
            pay.notes || pay.remarks || '-',
            `₹ ${(pay.amountPaid || pay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ]);

          autoTable(doc, {
            head: [['UTR / Ref No.', 'Date', 'Mode', 'Notes', 'Amount Paid (DR)']],
            body: paymentRows,
            startY: currentY,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 118, 110], fontStyle: 'bold' },
            columnStyles: { 4: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] } }
          });
        }

        const safeVendorName = (vInfo.vendorName || 'Vendor').replace(/[^a-zA-Z0-9_-]/g, '_');
        doc.save(`Vendor_Ledger_${safeVendorName}.pdf`);
        this.showToast(`Vendor PDF exported for ${vInfo.vendorName}!`, 'success');
      },
      error: () => {
        this.showToast('Failed to load vendor data for PDF.', 'danger');
      }
    });
  }

  exportAllVendorsToPdf(): void {
    const list = this.filteredVendors;
    if (list.length === 0) {
      this.showToast('No vendor records to export', 'danger');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110);
    doc.text('SOLAR SATHLOKHAR - VENDORS MASTER DIRECTORY', 14, 14);
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Vendors: ${list.length} | Generated on: ${new Date().toLocaleString()}`, 14, 19);

    const headers = [['#', 'Vendor Name', 'Coordinator', 'Phone No', 'Location', 'Credit Days']];
    const body = list.map((v, i) => [
      i + 1,
      v.vendorName || '',
      v.salesCoordinator || (v as any).vendorCoordinator || '',
      v.phoneNo || (v as any).vendorPhone || '',
      v.location || (v as any).vendorLocation || '',
      v.creditDays || 0
    ]);

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 23,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' }
    });

    doc.save(`Vendors_Master_${new Date().toISOString().substring(0, 10)}.pdf`);
    this.showToast('Vendors Master PDF downloaded successfully!', 'success');
  }

  exportAllVendorsToExcel(): void {
    const list = this.filteredVendors;
    if (list.length === 0) {
      this.showToast('No vendor records to export to Excel', 'danger');
      return;
    }
    const headers = ['#', 'Vendor Name', 'Coordinator', 'Phone No', 'Location', 'Credit Days'];
    const rows = list.map((v, i) => [
      i + 1,
      `"${(v.vendorName || '').replace(/"/g, '""')}"`,
      `"${(v.salesCoordinator || (v as any).vendorCoordinator || '').replace(/"/g, '""')}"`,
      `"${v.phoneNo || (v as any).vendorPhone || ''}"`,
      `"${(v.location || (v as any).vendorLocation || '').replace(/"/g, '""')}"`,
      v.creditDays || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vendors_Master_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Vendors Master Excel downloaded successfully!', 'success');
  }

  exportBothPdfAndExcel(): void {
    this.exportAllVendorsToPdf();
    setTimeout(() => {
      this.exportAllVendorsToExcel();
    }, 450);
  }

  triggerExcelImport(): void {
    const input = document.getElementById('vendorExcelInput') as HTMLInputElement;
    if (input) input.click();
  }

  onExcelUploadSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawRows || rawRows.length === 0) {
          this.showToast('The uploaded Excel file contains no data rows.', 'danger');
          return;
        }

        const vendorsBatch: Partial<OfficeVendor>[] = rawRows.map((row, idx) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const vendorName = getVal(['vendor name', 'vendor', 'name', 'supplier']) || `Vendor ${idx + 1}`;
          const salesCoordinator = getVal(['sales coordinator', 'coordinator', 'contact person']) || '';
          const phoneNo = getVal(['phone no', 'phone', 'mobile', 'contact']) || '';
          const location = getVal(['location', 'city', 'address']) || '';
          const gstNo = getVal(['gst no', 'gst', 'gstin']) || '';
          const materialsSpec = getVal(['materials spec', 'materials', 'specifications']) || 'Solar Modules & Cables';
          const creditDays = getVal(['credit days', 'credit', 'days']) || '30 Days';

          return {
            vendorName,
            salesCoordinator,
            phoneNo,
            location,
            gstNo,
            materialsSpec,
            creditDays
          };
        });

        let completed = 0;
        this.showToast(`Importing ${vendorsBatch.length} vendors from Excel...`, 'info');

        vendorsBatch.forEach(v => {
          this.vendorService.createVendor(v as any).subscribe({
            next: () => {
              completed++;
              if (completed === vendorsBatch.length) {
                this.loadVendors();
                this.showToast(`Successfully imported ${completed} vendors from Excel!`, 'success');
              }
            },
            error: () => {
              completed++;
              if (completed === vendorsBatch.length) {
                this.loadVendors();
                this.showToast(`Imported ${completed} vendor records from Excel.`, 'success');
              }
            }
          });
        });

        input.value = '';
      } catch (err: any) {
        console.error('Excel upload error:', err);
        this.showToast('Failed to parse Excel file: ' + err.message, 'danger');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  clearAllVendors(): void {
    if (confirm('Are you sure you want to clear ALL vendor records? This will delete all vendors and their PO/WO and payment histories so you can upload a clean Excel file.')) {
      this.vendorService.clearAllVendors().subscribe({
        next: () => {
          this.showToast('All vendor records cleared successfully.', 'success');
          this.loadVendors();
        },
        error: (err: any) => {
          this.showToast('Failed to clear records: ' + (err?.message || 'Error'), 'danger');
        }
      });
    }
  }
}
