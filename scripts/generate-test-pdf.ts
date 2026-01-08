// Test script to generate a sample Chain of Custody PDF
import { generateChainOfCustodyPDF } from '../src/utils/document-generator';
import path from 'path';

async function generateTestPDF() {
  const testData = {
    collectionDate: new Date(),
    driverName: 'John Smith',
    siteName: 'ABC Corporation Headquarters',
    sitePostcode: 'SW1A 1AA',
    siteContactName: 'Jane Doe',
    vehicleReg: 'AB12 CDE',
    dial2Collection: '1 Person (Or 2 or more persons)',
    securityRequirements: 'Security badge required at reception',
    idRequired: 'Yes - Photo ID required',
    loadingBayLocation: 'Loading bay 3, rear entrance',
    vehicleHeightRestrictions: 'Maximum height 3.5m',
    doorLiftSize: 'Standard loading bay doors, lift available',
    roadWorksPublicEvents: 'None reported',
    manualHandlingRequirements: 'Heavy items require two-person lift',
    items: [
      {
        categoryName: 'Laptop',
        quantity: 25,
        serialNumbers: [
          'LAP-2024-001', 'LAP-2024-002', 'LAP-2024-003', 'LAP-2024-004', 'LAP-2024-005',
          'LAP-2024-006', 'LAP-2024-007', 'LAP-2024-008', 'LAP-2024-009', 'LAP-2024-010',
          'LAP-2024-011', 'LAP-2024-012', 'LAP-2024-013', 'LAP-2024-014', 'LAP-2024-015',
          'LAP-2024-016', 'LAP-2024-017', 'LAP-2024-018', 'LAP-2024-019', 'LAP-2024-020',
          'LAP-2024-021', 'LAP-2024-022', 'LAP-2024-023', 'LAP-2024-024', 'LAP-2024-025'
        ]
      },
      {
        categoryName: 'Desktop Computer',
        quantity: 18,
        serialNumbers: [
          'DT-2023-001', 'DT-2023-002', 'DT-2023-003', 'DT-2023-004', 'DT-2023-005',
          'DT-2023-006', 'DT-2023-007', 'DT-2023-008', 'DT-2023-009', 'DT-2023-010',
          'DT-2023-011', 'DT-2023-012', 'DT-2023-013', 'DT-2023-014', 'DT-2023-015',
          'DT-2023-016', 'DT-2023-017', 'DT-2023-018'
        ]
      },
      {
        categoryName: 'Monitor',
        quantity: 35,
        serialNumbers: [
          'MON-2024-001', 'MON-2024-002', 'MON-2024-003', 'MON-2024-004', 'MON-2024-005',
          'MON-2024-006', 'MON-2024-007', 'MON-2024-008', 'MON-2024-009', 'MON-2024-010',
          'MON-2024-011', 'MON-2024-012', 'MON-2024-013', 'MON-2024-014', 'MON-2024-015',
          'MON-2024-016', 'MON-2024-017', 'MON-2024-018', 'MON-2024-019', 'MON-2024-020',
          'MON-2024-021', 'MON-2024-022', 'MON-2024-023', 'MON-2024-024', 'MON-2024-025',
          'MON-2024-026', 'MON-2024-027', 'MON-2024-028', 'MON-2024-029', 'MON-2024-030',
          'MON-2024-031', 'MON-2024-032', 'MON-2024-033', 'MON-2024-034', 'MON-2024-035'
        ]
      },
      {
        categoryName: 'Keyboard',
        quantity: 12,
        serialNumbers: [
          'KB-2024-001', 'KB-2024-002', 'KB-2024-003', 'KB-2024-004', 'KB-2024-005',
          'KB-2024-006', 'KB-2024-007', 'KB-2024-008', 'KB-2024-009', 'KB-2024-010',
          'KB-2024-011', 'KB-2024-012'
        ]
      },
      {
        categoryName: 'Mouse',
        quantity: 15,
        serialNumbers: [
          'MS-2024-001', 'MS-2024-002', 'MS-2024-003', 'MS-2024-004', 'MS-2024-005',
          'MS-2024-006', 'MS-2024-007', 'MS-2024-008', 'MS-2024-009', 'MS-2024-010',
          'MS-2024-011', 'MS-2024-012', 'MS-2024-013', 'MS-2024-014', 'MS-2024-015'
        ]
      },
      {
        categoryName: 'Tablet',
        quantity: 8,
        serialNumbers: [
          'TAB-2024-001', 'TAB-2024-002', 'TAB-2024-003', 'TAB-2024-004',
          'TAB-2024-005', 'TAB-2024-006', 'TAB-2024-007', 'TAB-2024-008'
        ]
      },
      {
        categoryName: 'Server',
        quantity: 5,
        serialNumbers: [
          'SRV-2023-001', 'SRV-2023-002', 'SRV-2023-003', 'SRV-2023-004', 'SRV-2023-005'
        ]
      },
      {
        categoryName: 'Network Switch',
        quantity: 10,
        serialNumbers: [
          'NS-2024-001', 'NS-2024-002', 'NS-2024-003', 'NS-2024-004', 'NS-2024-005',
          'NS-2024-006', 'NS-2024-007', 'NS-2024-008', 'NS-2024-009', 'NS-2024-010'
        ]
      },
      {
        categoryName: 'Printer',
        quantity: 7,
        serialNumbers: [
          'PRT-2023-001', 'PRT-2023-002', 'PRT-2023-003', 'PRT-2023-004',
          'PRT-2023-005', 'PRT-2023-006', 'PRT-2023-007'
        ]
      },
      {
        categoryName: 'Hard Drive (External)',
        quantity: 20,
        serialNumbers: [
          'HD-EXT-001', 'HD-EXT-002', 'HD-EXT-003', 'HD-EXT-004', 'HD-EXT-005',
          'HD-EXT-006', 'HD-EXT-007', 'HD-EXT-008', 'HD-EXT-009', 'HD-EXT-010',
          'HD-EXT-011', 'HD-EXT-012', 'HD-EXT-013', 'HD-EXT-014', 'HD-EXT-015',
          'HD-EXT-016', 'HD-EXT-017', 'HD-EXT-018', 'HD-EXT-019', 'HD-EXT-020'
        ]
      }
    ],
    erpJobNumber: 'JOB-0108-0003',
    bookingNumber: 'BK-2026-001',
    clientName: 'ABC Corporation',
    organisationName: 'ABC Corporation Ltd'
  };

  const outputPath = path.join(process.cwd(), 'uploads', 'documents', `test-chain-of-custody-${Date.now()}.pdf`);
  
  try {
    console.log('Generating test PDF...');
    const result = await generateChainOfCustodyPDF(testData, outputPath);
    console.log(`✅ PDF generated successfully at: ${result}`);
    console.log(`📄 File location: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    process.exit(1);
  }
}

generateTestPDF();

