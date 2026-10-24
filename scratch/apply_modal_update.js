const fs = require('fs');
const filePath = 'client/src/app/components/shared/po-wo-letterhead-modal/po-wo-letterhead-modal.component.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!code.includes('sathlokhar-letterhead-defaults')) {
  code = code.replace(
    "import autoTable from 'jspdf-autotable';",
    "import autoTable from 'jspdf-autotable';\nimport { SATHLOKHAR_HEADER_BASE64, SATHLOKHAR_FOOTER_BASE64 } from './sathlokhar-letterhead-defaults';"
  );
}

// 2. Update Tab 1 template
const tab1Old = `<div *ngIf="activePageTab === 'page1'" class="po-sheet-container bg-white mx-auto shadow-lg">

              <!-- Optional Uploaded Letterhead Header Image Banner -->
              <div *ngIf="currentTypeConfig?.headerImageBase64" class="letterhead-banner-box text-center border-bottom p-2 position-relative">
                <img [src]="currentTypeConfig.headerImageBase64" alt="Company Letterhead" style="max-height: 95px; max-width: 100%; object-fit: contain;">
              </div>

              <!-- MAIN BORDERED PO/WO TABLE (Exact Match to Screenshot 2) -->
              <div class="po-grid-border">`;

const tab1New = `<div *ngIf="activePageTab === 'page1'" class="po-sheet-container bg-white mx-auto shadow-lg">

              <!-- Sathlokhar Letterhead Header Banner -->
              <div class="letterhead-header-banner w-100">
                <img [src]="getHeaderImage()" alt="Sathlokhar Letterhead Header" class="w-100 d-block letterhead-header-img">
              </div>

              <!-- MAIN BORDERED PO/WO TABLE (Centered in Page Body) -->
              <div class="po-sheet-content-wrapper flex-grow-1 d-flex flex-column justify-content-center">
                <div class="po-grid-border w-100">`;

code = code.replace(tab1Old, tab1New);

// 2b. Close the wrapper and add Footer Banner at bottom of Tab 1
const tab1EndOld = `<div class="fw-bold" style="font-size: 0.82rem;">Suppliers Signature with Seal</div>
                    <input type="text" class="po-inline-input fw-bold" style="font-size: 0.84rem;"
                           [(ngModel)]="docData.supplierSignName">
                  </div>
                </div>

              </div>
            </div>`;

const tab1EndNew = `<div class="fw-bold" style="font-size: 0.82rem;">Suppliers Signature with Seal</div>
                    <input type="text" class="po-inline-input fw-bold" style="font-size: 0.84rem;"
                           [(ngModel)]="docData.supplierSignName">
                  </div>
                </div>

                </div>
              </div>

              <!-- Sathlokhar Letterhead Footer Banner -->
              <div class="letterhead-footer-banner w-100 mt-auto">
                <img [src]="getFooterImage()" alt="Sathlokhar Letterhead Footer" class="w-100 d-block letterhead-footer-img">
              </div>

            </div>`;

code = code.replace(tab1EndOld, tab1EndNew);

// 3. Update Tab 2 (Terms pages)
const termsOld = `<div *ngFor="let pageText of docData.termsPages; let pIdx = index; trackBy: trackByIndex"
                   class="po-sheet-container bg-white mx-auto shadow-sm mb-4 p-4 position-relative">
                <!-- Optional Letterhead Header on each Terms Page -->
                <div *ngIf="currentTypeConfig?.headerImageBase64" class="text-center border-bottom pb-2 mb-3">
                  <img [src]="currentTypeConfig.headerImageBase64" alt="Header" style="max-height: 75px; max-width: 100%; object-fit: contain;">
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                  <span class="badge bg-dark font-mono">Page {{ pIdx + 2 }} of {{ docData.termsPages.length + 1 }} ({{ orderType }} Terms & Conditions)</span>
                  <button *ngIf="docData.termsPages.length > 1" type="button" class="btn btn-xs btn-outline-danger py-0 px-2"
                          (click)="removeTermsPage(pIdx)">
                    Remove Page
                  </button>
                </div>
                <textarea class="form-control font-mono" rows="16" style="font-size: 0.82rem; line-height: 1.55;"
                          [(ngModel)]="docData.termsPages[pIdx]"
                          placeholder="Paste or type Terms & Conditions for this page..."></textarea>
              </div>`;

const termsNew = `<div *ngFor="let pageText of docData.termsPages; let pIdx = index; trackBy: trackByIndex"
                   class="po-sheet-container bg-white mx-auto shadow-sm mb-4 position-relative">
                <!-- Sathlokhar Letterhead Header Banner -->
                <div class="letterhead-header-banner w-100">
                  <img [src]="getHeaderImage()" alt="Sathlokhar Letterhead Header" class="w-100 d-block letterhead-header-img">
                </div>

                <!-- Centered Terms Content Area -->
                <div class="po-sheet-content-wrapper flex-grow-1 d-flex flex-column justify-content-center p-3 p-md-4">
                  <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                    <span class="badge bg-dark font-mono">Page {{ pIdx + 2 }} of {{ docData.termsPages.length + 1 }} ({{ orderType }} Terms & Conditions)</span>
                    <button *ngIf="docData.termsPages.length > 1" type="button" class="btn btn-xs btn-outline-danger py-0 px-2"
                            (click)="removeTermsPage(pIdx)">
                      Remove Page
                    </button>
                  </div>
                  <textarea class="form-control font-mono" rows="18" style="font-size: 0.82rem; line-height: 1.55;"
                            [(ngModel)]="docData.termsPages[pIdx]"
                            placeholder="Paste or type Terms & Conditions for this page..."></textarea>
                </div>

                <!-- Sathlokhar Letterhead Footer Banner -->
                <div class="letterhead-footer-banner w-100 mt-auto">
                  <img [src]="getFooterImage()" alt="Sathlokhar Letterhead Footer" class="w-100 d-block letterhead-footer-img">
                </div>
              </div>`;

code = code.replace(termsOld, termsNew);

// 4. Update CSS styles
const stylesOld = `    .po-sheet-container {
      max-width: 880px;
      border: 1px solid #cbd5e1;
      color: #000;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    }
    .po-grid-border {
      border: 2px solid #000;
      margin: 10px;
    }`;

const stylesNew = `    .po-sheet-container {
      width: 100%;
      max-width: 860px;
      min-height: 1140px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #000;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    .letterhead-header-banner {
      width: 100%;
      background: #ffffff;
    }
    .letterhead-header-banner img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: contain;
    }
    .po-sheet-content-wrapper {
      padding: 18px 24px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .letterhead-footer-banner {
      width: 100%;
      background: #ffffff;
    }
    .letterhead-footer-banner img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: contain;
    }
    .po-grid-border {
      border: 2px solid #000;
      margin: 0;
      width: 100%;
    }`;

code = code.replace(stylesOld, stylesNew);

// 5. Update poWoConfig initial defaults and add helper methods
const cfgOld = `  poWoConfig: any = {
    po: { fileName: '', headerImageBase64: '', footerImageBase64: '', headerTextLines: [], defaultTermsTable: [], termsPages: [] },
    wo: { fileName: '', headerImageBase64: '', footerImageBase64: '', headerTextLines: [], defaultTermsTable: [], termsPages: [] },
    bomMaterialDescriptions: {},
    savedPoWoDocs: {}
  };`;

const cfgNew = `  poWoConfig: any = {
    po: { fileName: 'Sathlokhar_PO_Letterhead.png', headerImageBase64: SATHLOKHAR_HEADER_BASE64, footerImageBase64: SATHLOKHAR_FOOTER_BASE64, headerTextLines: [], defaultTermsTable: [], termsPages: [] },
    wo: { fileName: 'Sathlokhar_WO_Letterhead.png', headerImageBase64: SATHLOKHAR_HEADER_BASE64, footerImageBase64: SATHLOKHAR_FOOTER_BASE64, headerTextLines: [], defaultTermsTable: [], termsPages: [] },
    bomMaterialDescriptions: {},
    savedPoWoDocs: {}
  };

  getHeaderImage(): string {
    return this.currentTypeConfig?.headerImageBase64 || SATHLOKHAR_HEADER_BASE64;
  }

  getFooterImage(): string {
    return this.currentTypeConfig?.footerImageBase64 || SATHLOKHAR_FOOTER_BASE64;
  }`;

code = code.replace(cfgOld, cfgNew);

// 6. Update downloadPoWoPdf() method for centered PDF
const pdfMethodRegex = /\/\/ Generate multi-page A4 PDF[\s\S]*?doc\.save\(`\$\{safeFileName\}\.pdf`\);\r?\n\s*\}/;

const pdfMethodNew = `// Generate multi-page A4 PDF matching Screenshot with Header & Footer + Centered Content
  downloadPoWoPdf(): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const halfWidth = contentWidth / 2;

    const headerH = 41.6;
    const footerH = 33.8;
    const headerBottomY = headerH;
    const footerTopY = pageHeight - footerH;
    const availableMiddleHeight = footerTopY - headerBottomY;

    const headerImg = this.getHeaderImage();
    const footerImg = this.getFooterImage();

    const addLetterheadHeaderAndFooter = (pageNum: number) => {
      if (headerImg) {
        try {
          const fmt = headerImg.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(headerImg, fmt, 0, 0, pageWidth, headerH);
        } catch (e) {
          console.warn('Error adding header to PDF:', e);
        }
      }
      if (footerImg) {
        try {
          const fmt = footerImg.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(footerImg, fmt, 0, footerTopY, pageWidth, footerH);
        } catch (e) {
          console.warn('Error adding footer to PDF:', e);
        }
      }
    };

    addLetterheadHeaderAndFooter(1);

    // Calculate dynamic vertical centering
    const numItems = this.docData.items?.length || 1;
    const numSummaryRows = this.isMixedGst ? 6 : 4;
    const numTerms = this.docData.termsTable?.length || 6;

    const titleBarH = 6.5;
    const vendorOrderHeaderH = 5.5;
    const contactRowH = 10;
    const addressBlockH = 38;
    const gstinPanRowH = 10;
    const itemsTableEstH = 6 + numItems * 6.5;
    const summaryRowsH = numSummaryRows * 5.0;
    const wordsBannerH = 6.0;
    const termsHeaderH = 5.5;
    const termsRowsH = numTerms * 4.8;
    const signatureBlockH = 20;

    const totalTableH = titleBarH + vendorOrderHeaderH + contactRowH + addressBlockH + gstinPanRowH +
                        itemsTableEstH + summaryRowsH + wordsBannerH + termsHeaderH + termsRowsH + signatureBlockH;

    const remainingGap = availableMiddleHeight - totalTableH;
    const topOffset = remainingGap > 0 ? (remainingGap / 2) : 3;
    let y = headerBottomY + topOffset;
    const topStartY = y;

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.35);

    // 1. TITLE BAR ("PURCHASE ORDER" / "WORK ORDER")
    doc.rect(margin, y, contentWidth, titleBarH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(this.docData.documentTitle || (this.orderType === 'W.O' ? 'WORK ORDER' : 'PURCHASE ORDER'), pageWidth / 2, y + 4.6, { align: 'center' });
    y += titleBarH;

    // 2. VENDOR DETAILS | ORDER DETAILS HEADER
    doc.rect(margin, y, halfWidth, vendorOrderHeaderH);
    doc.rect(margin + halfWidth, y, halfWidth, vendorOrderHeaderH);
    doc.setFontSize(8.5);
    doc.text('VENDOR DETAILS', margin + 2, y + 3.8);
    doc.text('ORDER DETAILS', margin + halfWidth + 2, y + 3.8);
    y += vendorOrderHeaderH;

    // 3. CONTACT NAME/NUMBER | PO NO / DATE
    doc.rect(margin, y, halfWidth, contactRowH);
    doc.rect(margin + halfWidth, y, halfWidth, contactRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Contact Name :', margin + 2, y + 3.8);
    doc.text('Contact Number :-', margin + 2, y + 8.0);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.vendorContactName || '', margin + 26, y + 3.8);
    doc.text(this.docData.vendorContactPhone || '', margin + 28, y + 8.0);

    doc.setFont('helvetica', 'bold');
    doc.text(this.orderType === 'W.O' ? 'WO NO :' : 'PO NO :', margin + halfWidth + 2, y + 3.8);
    doc.text('DATE :', margin + halfWidth + 2, y + 8.0);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.poWoNo || '', margin + halfWidth + 18, y + 3.8);
    doc.text(this.docData.orderDate || '', margin + halfWidth + 18, y + 8.0);
    y += contactRowH;

    // 4. VENDOR NAME & ADDRESS (Left) | GSTIN + BILLING ADDRESS + DELIVERY ADDRESS (Right)
    doc.rect(margin, y, halfWidth, addressBlockH);
    doc.rect(margin + halfWidth, y, halfWidth, 5.5);
    doc.rect(margin + halfWidth, y + 5.5, halfWidth, 18);
    doc.rect(margin + halfWidth, y + 23.5, halfWidth, 14.5);

    // Left: Vendor Name & Address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Vendor Name & Address :', margin + 2, y + 4.2);
    doc.text(this.docData.vendorTitleLine || '', margin + 2, y + 9.5);
    doc.setFont('helvetica', 'normal');
    const vAddrLines = doc.splitTextToSize(this.docData.vendorAddress || '', halfWidth - 4);
    doc.text(vAddrLines.slice(0, 5), margin + 2, y + 14);

    // Right 1: Company GSTIN
    doc.setFont('helvetica', 'bold');
    doc.text(\`GSTIN :-  \${this.docData.companyGstin || '33AACCL5566B1ZT'}\`, margin + halfWidth + 2, y + 3.8);

    // Right 2: Billing address
    doc.setFont('helvetica', 'bold');
    doc.text('Billing address', margin + halfWidth + 2, y + 9.5);
    doc.setFontSize(7.5);
    doc.text(this.docData.billingCompany || '', margin + halfWidth + 2, y + 13.5);
    doc.setFont('helvetica', 'normal');
    const billLines = doc.splitTextToSize(this.docData.billingAddress || '', halfWidth - 4);
    doc.text(billLines.slice(0, 3), margin + halfWidth + 2, y + 17.5);

    // Right 3: Delivery address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Delivery address :', margin + halfWidth + 2, y + 27.5);
    doc.setFontSize(7.5);
    doc.text(this.docData.deliveryTitleLine || '', margin + halfWidth + 2, y + 31.5);
    doc.setFont('helvetica', 'normal');
    const delivLines = doc.splitTextToSize(this.docData.deliveryAddress || '', halfWidth - 4);
    doc.text(delivLines.slice(0, 2), margin + halfWidth + 2, y + 35.5);
    y += addressBlockH;

    // 5. VENDOR GSTIN & PAN | CONTACT & PH. NO ROW
    doc.rect(margin, y, 16, 5);
    doc.rect(margin + 16, y, halfWidth - 16, 5);
    doc.rect(margin + halfWidth, y, halfWidth, 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('GSTIN :', margin + 2, y + 3.6);
    doc.text(this.docData.vendorGstin || '', margin + 18, y + 3.6);
    y += 5;

    doc.rect(margin, y, 16, 5);
    doc.rect(margin + 16, y, halfWidth - 16, 5);
    doc.rect(margin + halfWidth, y, 16, 5);
    doc.rect(margin + halfWidth + 16, y, 32, 5);
    doc.rect(margin + halfWidth + 48, y, 15, 5);
    doc.rect(margin + halfWidth + 63, y, halfWidth - 63, 5);

    doc.text('PAN :', margin + 2, y + 3.6);
    doc.text(this.docData.vendorPan || '', margin + 18, y + 3.6);
    doc.text('Contact :', margin + halfWidth + 1.5, y + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.siteContactName || '', margin + halfWidth + 17.5, y + 3.6);
    doc.setFont('helvetica', 'bold');
    doc.text('Ph. No :', margin + halfWidth + 49.5, y + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.text(this.docData.siteContactPhone || '', margin + halfWidth + 64.5, y + 3.6);
    y += 5;

    // 6. ITEMS TABLE USING AUTOTABLE
    const itemRows: any[] = this.docData.items.map((it, idx) => [
      idx + 1,
      it.description || '',
      it.unit || '',
      it.qty || 0,
      Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      \`\${it.gstPct || 0}%\`,
      Number(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['S.No', 'Descriptions', 'Unit', 'Qty', 'Rate', 'GST %', 'Amount']],
      body: itemRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        cellPadding: 1.8
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 83, halign: 'left' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 23, halign: 'right' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 28, halign: 'right' }
      }
    });

    y = (doc as any).lastAutoTable.finalY;

    // 7. SUB TOTAL / CGST / SGST / GRAND TOTAL BLOCK
    const leftBoxW = 95;
    const rightLabelW = 67;
    const rightValW = 28;
    const rowH = 5.0;

    const summaryRows = this.isMixedGst
      ? [
          { label: 'Sub Total :', val: this.docData.subTotal },
          { label: 'CGST 2.5% :', val: this.docData.cgst2_5 },
          { label: 'SGST 2.5% :', val: this.docData.sgst2_5 },
          { label: 'CGST 9% :', val: this.docData.cgst9 },
          { label: 'SGST 9% :', val: this.docData.sgst9 },
          { label: 'Grand Total :', val: this.docData.grandTotal }
        ]
      : [
          { label: 'Sub Total :', val: this.docData.subTotal },
          { label: 'CGST :', val: this.docData.cgst },
          { label: 'SGST :', val: this.docData.sgst },
          { label: 'Grand Total :', val: this.docData.grandTotal }
        ];

    doc.rect(margin, y, leftBoxW, rowH * summaryRows.length);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Total Amount in words :', margin + 2, y + rowH * summaryRows.length - 1.5);

    summaryRows.forEach((sr, i) => {
      const ry = y + i * rowH;
      doc.rect(margin + leftBoxW, ry, rightLabelW, rowH);
      doc.rect(margin + leftBoxW + rightLabelW, ry, rightValW, rowH);
      doc.setFont('helvetica', 'bold');
      doc.text(sr.label, margin + leftBoxW + rightLabelW - 2, ry + 3.6, { align: 'right' });
      const formattedVal = Number(sr.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      doc.text(formattedVal, margin + contentWidth - 2, ry + 3.6, { align: 'right' });
    });
    y += rowH * summaryRows.length;

    // 8. AMOUNT IN WORDS BANNER
    doc.rect(margin, y, contentWidth, wordsBannerH);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(8.5);
    doc.text(this.docData.amountInWords || 'Rupees Zero Only', pageWidth / 2, y + 4.2, { align: 'center' });
    y += wordsBannerH;

    // 9. TERMS & CONDITIONS TABLE ON PAGE 1
    doc.rect(margin, y, contentWidth, termsHeaderH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TERMS & CONDITIONS', margin + 2, y + 3.8);
    const tcWidth = doc.getTextWidth('TERMS & CONDITIONS');
    doc.line(margin + 2, y + 4.2, margin + 2 + tcWidth, y + 4.2);
    y += termsHeaderH;

    for (const term of this.docData.termsTable) {
      doc.rect(margin, y, leftBoxW, 4.8);
      doc.rect(margin + leftBoxW, y, contentWidth - leftBoxW, 4.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(term.label || '', margin + 2, y + 3.5);
      doc.text(term.value || '', margin + leftBoxW + 2, y + 3.5);
      y += 4.8;
    }

    // 10. SIGNATURE BLOCK
    doc.rect(margin, y, leftBoxW, signatureBlockH);
    doc.rect(margin + leftBoxW, y, contentWidth - leftBoxW, signatureBlockH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(this.docData.forCompanySignText || 'For SATHLOKHAR SYNERGYS E&C GLOBAL LTD,', margin + 2, y + 4.5);
    doc.text('Suppliers Signature with Seal', margin + leftBoxW + 2, y + 4.5);
    doc.text(this.docData.supplierSignName || '', margin + leftBoxW + 2, y + signatureBlockH - 2.5);
    y += signatureBlockH;

    // Outer thick border around Page 1 table
    doc.setLineWidth(0.6);
    doc.rect(margin, topStartY, contentWidth, y - topStartY);

    // 11. PAGES 2..N: DETAILED TERMS & CONDITIONS FROM WORD (.docx)
    if (this.docData.termsPages && this.docData.termsPages.length > 0) {
      this.docData.termsPages.forEach((pageContent, idx) => {
        if (!pageContent || !pageContent.trim()) return;
        doc.addPage();
        addLetterheadHeaderAndFooter(idx + 2);

        const termsBoxTop = headerH + 6;
        const termsBoxBottom = footerTopY - 6;
        const termsBoxHeight = termsBoxBottom - termsBoxTop;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.rect(margin, termsBoxTop, contentWidth, termsBoxHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(\`\${this.docData.documentTitle} - TERMS & CONDITIONS (\${this.docData.poWoNo})\`, margin + 4, termsBoxTop + 6.5);
        doc.line(margin, termsBoxTop + 9.5, margin + contentWidth, termsBoxTop + 9.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        const wrappedLines = doc.splitTextToSize(pageContent.trim(), contentWidth - 8);
        doc.text(wrappedLines, margin + 4, termsBoxTop + 15);
      });
    }

    const safeFileName = (this.docData.poWoNo || 'PO_WO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    window.open(blobUrl, '_blank');
    doc.save(\`\${safeFileName}.pdf\`);
  }`;

code = code.replace(pdfMethodRegex, pdfMethodNew);

fs.writeFileSync(filePath, code, 'utf8');
console.log('po-wo-letterhead-modal.component.ts updated successfully!');
