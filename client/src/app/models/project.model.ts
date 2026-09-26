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
