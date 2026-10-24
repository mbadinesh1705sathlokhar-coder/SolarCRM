const { jsPDF } = require('./client/node_modules/jspdf');
const autoTable = require('./client/node_modules/jspdf-autotable');
const fs = require('fs');

const hBuf = fs.readFileSync('client/src/assets/letterheads/header.png');
const fBuf = fs.readFileSync('client/src/assets/letterheads/footer.png');
const headerImg = 'data:image/png;base64,' + hBuf.toString('base64');
const footerImg = 'data:image/png;base64,' + fBuf.toString('base64');

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

const addLetterheadHeaderAndFooter = (pageNum) => {
  doc.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerH);
  doc.addImage(footerImg, 'PNG', 0, footerTopY, pageWidth, footerH);
};

addLetterheadHeaderAndFooter(1);

const numItems = 1;
const numSummaryRows = 4;
const numTerms = 6;

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

console.log('totalTableH:', totalTableH, 'remainingGap:', remainingGap, 'topOffset:', topOffset, 'startY:', y);

// 1. Title Bar
doc.rect(margin, y, contentWidth, 6.5);
doc.setFont('helvetica', 'bold');
doc.setFontSize(10.5);
doc.text('PURCHASE ORDER', pageWidth / 2, y + 4.5, { align: 'center' });
y += 6.5;

// 2. Vendor / Order Header
doc.rect(margin, y, halfWidth, 5.5);
doc.rect(margin + halfWidth, y, halfWidth, 5.5);
doc.setFontSize(8.5);
doc.text('VENDOR DETAILS', margin + 2, y + 3.8);
doc.text('ORDER DETAILS', margin + halfWidth + 2, y + 3.8);
y += 5.5;

// 3. Contact / PO NO / Date
doc.rect(margin, y, halfWidth, 10);
doc.rect(margin + halfWidth, y, halfWidth, 10);
y += 10;

// 4. Address block
const addrBlockH = 38;
doc.rect(margin, y, halfWidth, addrBlockH);
doc.rect(margin + halfWidth, y, halfWidth, 5.5);
doc.rect(margin + halfWidth, y + 5.5, halfWidth, 18);
doc.rect(margin + halfWidth, y + 23.5, halfWidth, 14.5);
y += addrBlockH;

// 5. GSTIN & PAN
doc.rect(margin, y, 16, 5);
doc.rect(margin + 16, y, halfWidth - 16, 5);
doc.rect(margin + halfWidth, y, halfWidth, 5);
y += 5;
doc.rect(margin, y, 16, 5);
doc.rect(margin + 16, y, halfWidth - 16, 5);
doc.rect(margin + halfWidth, y, 16, 5);
doc.rect(margin + halfWidth + 16, y, 32, 5);
doc.rect(margin + halfWidth + 48, y, 15, 5);
doc.rect(margin + halfWidth + 63, y, halfWidth - 63, 5);
y += 5;

// 6. Items Table
const itemRows = [
  [1, 'Supply of Solar Module Mounting Structures (2X5)', 'KW', 5, '5,500.00', '18%', '27,500.00']
];
autoTable.default(doc, {
  startY: y,
  margin: { left: margin, right: margin },
  head: [['S.No', 'Descriptions', 'Unit', 'Qty', 'Rate', 'GST %', 'Amount']],
  body: itemRows,
  theme: 'grid',
  styles: { font: 'helvetica', fontSize: 7.8, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.3, cellPadding: 1.8 },
  headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
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

y = doc.lastAutoTable.finalY;

// 7. Summary rows
const leftBoxW = 95;
const rightLabelW = 67;
const rightValW = 28;
const rowH = 5.0;
const summaryRows = [
  { label: 'Sub Total :', val: '27,500.00' },
  { label: 'CGST :', val: '2,475.00' },
  { label: 'SGST :', val: '2,475.00' },
  { label: 'Grand Total :', val: '32,450.00' }
];

doc.rect(margin, y, leftBoxW, rowH * summaryRows.length);
doc.text('Total Amount in words :', margin + 2, y + rowH * summaryRows.length - 1.5);
summaryRows.forEach((sr, i) => {
  const ry = y + i * rowH;
  doc.rect(margin + leftBoxW, ry, rightLabelW, rowH);
  doc.rect(margin + leftBoxW + rightLabelW, ry, rightValW, rowH);
});
y += rowH * summaryRows.length;

// 8. Words Banner
doc.rect(margin, y, contentWidth, 6.0);
doc.text('Rupees Thirty Two Thousand Four Hundred And Fifty Only', pageWidth / 2, y + 4.2, { align: 'center' });
y += 6.0;

// 9. Terms
doc.rect(margin, y, contentWidth, 5.5);
y += 5.5;
for (let t = 0; t < 6; t++) {
  doc.rect(margin, y, leftBoxW, 4.8);
  doc.rect(margin + leftBoxW, y, contentWidth - leftBoxW, 4.8);
  y += 4.8;
}

// 10. Signature Block
const sigH = 20;
doc.rect(margin, y, leftBoxW, sigH);
doc.rect(margin + leftBoxW, y, contentWidth - leftBoxW, sigH);
y += sigH;

// Outer Border
doc.setLineWidth(0.6);
doc.rect(margin, topStartY, contentWidth, y - topStartY);

console.log('Final Y:', y, 'Footer top:', footerTopY, 'Bottom margin gap:', footerTopY - y);
fs.writeFileSync('scratch/full_po_sample.pdf', Buffer.from(doc.output(), 'binary'));
console.log('Saved scratch/full_po_sample.pdf successfully!');
