// Mock ERP Integration Service
// This simulates ERP API calls until real ERP is ready

import { config } from '../config/env';

export interface ERPJobRequest {
  clientName: string;
  siteName: string;
  siteAddress: string;
  scheduledDate: string;
  assets: Array<{
    categoryName: string;
    quantity: number;
  }>;
}

export interface ERPJobResponse {
  jobNumber: string;
  status: string;
  createdAt: string;
}

export interface ERPGradingResult {
  assets: Array<{
    categoryName: string;
    quantity: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'Recycled';
    resaleValue: number;
  }>;
  totalValue: number;
}

export interface ERPSanitisationResult {
  assets: Array<{
    categoryName: string;
    quantity: number;
    sanitised: boolean;
    wipeMethod: string;
    certificateUrl?: string;
  }>;
}

class MockERPService {
  /**
   * Create a job in ERP and get job number
   */
  async createJob(request: ERPJobRequest): Promise<ERPJobResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate mock job number
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000);
    const jobNumber = `ERP-${year}-${String(random).padStart(5, '0')}`;

    return {
      jobNumber,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Sync inventory to ERP
   */
  async syncInventory(jobNumber: string, assets: Array<{
    categoryName: string;
    quantity: number;
    serialNumbers?: string[];
  }>): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // In real implementation, this would POST to ERP API
    console.log(`[Mock ERP] Syncing inventory for job ${jobNumber}:`, assets);
  }

  /**
   * Get grading results from ERP
   */
  async getGradingResults(jobNumber: string): Promise<ERPGradingResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));

    // Mock grading results
    // In real implementation, this would GET from ERP API
    return {
      assets: [
        {
          categoryName: 'Laptop',
          quantity: 10,
          grade: 'A',
          resaleValue: 150,
        },
        {
          categoryName: 'Desktop',
          quantity: 5,
          grade: 'B',
          resaleValue: 80,
        },
      ],
      totalValue: 1900, // 10 * 150 + 5 * 80
    };
  }

  /**
   * Get sanitisation results from ERP
   */
  async getSanitisationResults(jobNumber: string): Promise<ERPSanitisationResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));

    // Mock sanitisation results
    return {
      assets: [
        {
          categoryName: 'Laptop',
          quantity: 10,
          sanitised: true,
          wipeMethod: 'Blancco',
          certificateUrl: 'https://blancco.example.com/cert/12345',
        },
        {
          categoryName: 'Desktop',
          quantity: 5,
          sanitised: true,
          wipeMethod: 'Physical Destruction',
        },
      ],
    };
  }

  /**
   * Get final buyback value from ERP
   */
  async getFinalBuybackValue(jobNumber: string): Promise<number> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mock final value (would come from ERP)
    return 1850; // Slightly different from grading estimate
  }

  /**
   * Get invoice reference from ERP
   */
  async getInvoiceReference(jobNumber: string): Promise<{
    invoiceNumber: string;
    invoiceUrl: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000);
    const invoiceNumber = `INV-${year}-${String(random).padStart(5, '0')}`;

    return {
      invoiceNumber,
      invoiceUrl: `https://erp.example.com/invoices/${invoiceNumber}`,
    };
  }
}

export const mockERPService = new MockERPService();
