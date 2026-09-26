const fs = require('fs');
const path = require('path');

const rawPath = path.resolve(__dirname, '../.gemini/antigravity/brain/0087a2f4-00b0-4fc8-9a70-185ef5ba2728/scratch/realPaymentData.txt');
let content = '';

// Check if scratch path exists, or fallback
const fallbackPath = 'C:\\Users\\SATHLOKHAR\\.gemini\\antigravity\\brain\\0087a2f4-00b0-4fc8-9a70-185ef5ba2728\\scratch\\realPaymentData.txt';
if (fs.existsSync(fallbackPath)) {
    content = fs.readFileSync(fallbackPath, 'utf8');
} else if (fs.existsSync(rawPath)) {
    content = fs.readFileSync(rawPath, 'utf8');
}

const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
console.log('Total input lines:', lines.length);

const parsed = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const sNo = parts[0] ? parts[0].trim() : String(i + 1);
    const mop = parts[1] ? parts[1].trim() : '';
    const dateStr = parts[2] ? parts[2].trim() : '';
    const clientSiteName = parts[3] ? parts[3].trim() : '';
    let siteId = parts[4] ? parts[4].trim() : '';
    siteId = siteId.replace(/:/g, '').trim();

    const paymentMode = parts[5] && parts[5].trim() ? parts[5].trim() : '(Blanks)';
    const remarks = parts[6] ? parts[6].trim() : '';
    const rawAmt = parts[7] !== undefined ? parts[7].trim() : (parts[parts.length - 1] ? parts[parts.length - 1].trim() : '0');

    // Parse numeric amount
    const cleanAmt = parseFloat(rawAmt.replace(/[^0-9.]/g, '')) || 0;

    // Convert dd-mm-yyyy to yyyy-mm-dd
    let isoDate = '';
    if (dateStr.includes('-')) {
        const dParts = dateStr.split('-');
        if (dParts.length === 3) {
            if (dParts[0].length === 2 && dParts[2].length === 4) {
                isoDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
            } else if (dParts[0].length === 4) {
                isoDate = dateStr;
            }
        }
    }
    if (!isoDate) {
        isoDate = new Date().toISOString().slice(0, 10);
    }

    // Extract cleaner clientName from clientSiteName
    // e.g. "SP261 : 3KW, Mr. Janakiraman, Kovur, Chennai" -> "Mr. Janakiraman"
    let clientName = clientSiteName;
    if (clientSiteName.includes(',')) {
        const cParts = clientSiteName.split(',');
        if (cParts.length >= 2) {
            // second part or first part without SPxxx
            clientName = cParts[1].trim();
        }
    } else if (clientSiteName.includes(':')) {
        const cParts = clientSiteName.split(':');
        clientName = cParts[cParts.length - 1].trim();
    }

    parsed.push({
        sNo: parseInt(sNo) || (i + 1),
        mop,
        rawDate: dateStr,
        paymentDate: isoDate,
        clientSiteName,
        siteId,
        clientName,
        paymentMode,
        remarks,
        amount: cleanAmt
    });
}

console.log('Successfully parsed records:', parsed.length);
const totalAmt = parsed.reduce((sum, r) => sum + r.amount, 0);
console.log('Total Payment Received: ₹', totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }));

fs.writeFileSync(
    path.resolve(__dirname, 'data/realPaymentData.json'),
    JSON.stringify(parsed, null, 2),
    'utf8'
);
console.log('Written to server/data/realPaymentData.json');
