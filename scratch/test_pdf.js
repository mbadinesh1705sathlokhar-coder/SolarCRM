const { jsPDF } = require('jspdf');
const fs = require('fs');

const hBuf = fs.readFileSync('client/src/assets/letterheads/header.png');
const fBuf = fs.readFileSync('client/src/assets/letterheads/footer.png');
const hB64 = 'data:image/png;base64,' + hBuf.toString('base64');
const fB64 = 'data:image/png;base64,' + fBuf.toString('base64');

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const pageWidth = 210;
const pageHeight = 297;
const margin = 10;
const contentWidth = pageWidth - margin * 2;
const headerH = 41.6;
const footerH = 33.8;

// Add Header & Footer
doc.addImage(hB64, 'PNG', 0, 0, pageWidth, headerH);
doc.addImage(fB64, 'PNG', 0, pageHeight - footerH, pageWidth, footerH);

// Table geometry
const availableMiddle = (pageHeight - footerH) - headerH;
const tableHeight = 165;
const startY = headerH + (availableMiddle - tableHeight) / 2;

doc.setDrawColor(0, 0, 0);
doc.setLineWidth(0.4);
doc.rect(margin, startY, contentWidth, tableHeight);

doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.text('PURCHASE ORDER (CENTERED)', pageWidth / 2, startY + 8, { align: 'center' });

const pdfBytes = doc.output();
fs.writeFileSync('scratch/test_output.pdf', Buffer.from(pdfBytes, 'binary'));
console.log('PDF generated successfully! Size:', fs.statSync('scratch/test_output.pdf').size, 'bytes. startY:', startY);
