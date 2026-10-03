export interface BomItem {
  id?: string;
  materialGroup: string;       // e.g. Cables, Panels, MC4 Connector, Lugs, Bucket, Inverter, Structure
  categoryType?: string;       // e.g. AC Cable, DC Cable, Mono PERC, TOPCon, On Grid, Hybrid, Cu Lug, Al Lug
  specification: string;       // e.g. 4Sqmm, 6Sqmm, 540W, 580W, 3kW, 5kW
  uom: string;                 // e.g. Meter, Sets, Nos, Kg, Pcs
  plannedQty: number;
  unitRate: number;
  estimatedTotalCost: number; // Base cost: plannedQty * unitRate
  gstPercent?: number;        // e.g. 12 for Panels, 18 for others
  gstAmount?: number;         // (plannedQty * unitRate) * (gstPercent / 100)
  estAmount?: number;         // Base cost + gstAmount
  allocatedExpenseAmount: number;
  expenseSource?: 'PO' | 'WO' | 'Petty Cash' | 'Accounts' | 'Warehouse' | 'Other' | string;
  invoiceRef?: string;
  warehouseUnitsDrawn?: number;
  isDispatched?: boolean;     // Checkbox indicating if material is dispatched from warehouse/gate pass
  dispatchedQty?: number;     // Qty dispatched
  dispatchDate?: string;      // Date when dispatched
  remarks?: string;
}

export interface Project {
  id?: number;
  awardedDate: string;
  formattedAwardedDate?: string;
  siteId: string;
  clientName: string;
  location: string;
  contactNo: string;
  emailId: string;
  address: string;
  siteCapacity: string;
  siteValue: number;
  siteType: 'Residential' | 'Industrial' | 'Ground Mount' | 'Commercial' | string;
  systemType: 'Ongrid' | 'offgrid' | 'Hybrid' | 'On Grid' | 'Off Grid' | string;
  siteCategory: 'TATA SPG' | 'Waree' | 'Waaree' | 'Premier' | 'Other' | string;
  clientType: 'Individual' | 'Company' | 'Institutional' | string;
  saleType: string;
  orderBy: 'K KARTHIKEYAN' | 'K SATHISH' | 'S KARTHIKEYAN' | 'SOUNDARARAJAN M' | 'V SHARATH' | string;
  leadBy?: string;
  received: number;
  due?: number;
  siteExpenses: number;
  margin?: number;
  marginPercentage?: number;
  materialsSupply: boolean;
  installation: boolean;
  ebProcess: boolean;
  documents: boolean;
  warranty: boolean;
  handedOver: boolean;
  completedPercentage?: number;
  workInProgressPercentage?: number;
  checkedCount?: number;
  bomItems?: BomItem[] | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SummaryMetrics {
  totalProjects: number;
  totalSiteValue: number;
  totalReceived: number;
  totalDue: number;
  totalExpenses: number;
  totalMargin: number;
  avgCompletedPercentage: number;
  avgWipPercentage: number;
  completedCount: number;
  wipCount: number;
}

export interface ClientPayment {
  id?: number;
  sNo?: number;
  mop?: string;
  rawDate?: string;
  paymentDate: string;
  formattedDate?: string;
  clientSiteName?: string;
  siteId: string;
  clientName: string;
  amount: number;
  paymentMode: string;
  remarks?: string;
  referenceNo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteExpense {
  id?: number;
  sNo?: number;
  mop?: string;
  expenseDate: string;
  formattedDate?: string;
  siteId: string;
  clientSiteName?: string;
  clientName: string;
  amount: number;
  paymentThrough?: string;
  purpose?: string;
  paidBy?: string;
  remarks?: string;
  billVoucher?: string;
  invoiceNo?: string;
  claimStatus?: string;
  paymentNote?: string;
  category?: string;
  vendorName?: string;
  description?: string;
  referenceNo?: string;
  createdAt?: string;
  updatedAt?: string;
}
