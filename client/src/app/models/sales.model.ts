export type OpportunityStatus =
  | 'Site Visit Planned'
  | 'Site Visit Completed'
  | 'Offer Letter Submitted'
  | 'Negotiation'
  | 'Order Won'
  | 'Order Lost'
  | 'Order Postponed';

export const OPPORTUNITY_STATUS_OPTIONS: OpportunityStatus[] = [
  'Site Visit Planned',
  'Site Visit Completed',
  'Offer Letter Submitted',
  'Negotiation',
  'Order Won',
  'Order Lost',
  'Order Postponed'
];

export type LeadStatus =
  | 'New'
  | 'Qualify'
  | 'Unqualify'
  | 'On hold'
  | string;

export type LeadHandler =
  | 'Renuka'
  | 'Daya'
  | 'Sharath'
  | 'K Karthikeyen'
  | 'S Karthikeyen'
  | 'Soundarajan'
  | string;


export interface SalesLead {
  id?: number;
  leadId: string;
  leadDate: string;
  formattedDate?: string;
  leadName: string;
  leadContact: string;
  leadEmail: string;
  leadLocation: string;
  leadStatus: LeadStatus | string;
  leadHandler: LeadHandler | string;
  leadRemarks: string;
  siteType?: string;
  systemType?: string;
  siteCategory?: string;
  saleType?: string;
  clientType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesMetrics {
  totalLeads: number;
  totalOpportunities: number;
  newLeads: number;
  qualifiedLeads: number;
  unqualifiedLeads: number;
}
