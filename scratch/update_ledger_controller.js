const fs = require('fs');
let code = fs.readFileSync('server/controllers/ledgerController.js', 'utf8');

const regex = /function ensureLetterheadDir\(\)[\s\S]*?function getDefaultPoWoConfig\(\) \{/;
const replacement = `function ensureLetterheadDir() {
    if (!fs.existsSync(LETTERHEAD_DIR)) {
        fs.mkdirSync(LETTERHEAD_DIR, { recursive: true });
    }
}

function getLetterheadBase64(fileName) {
    try {
        const filePath = path.join(LETTERHEAD_DIR, fileName);
        if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            return 'data:image/png;base64,' + buf.toString('base64');
        }
    } catch (e) {}
    return '';
}

function getDefaultPoWoConfig() {
    const defaultHeaderB64 = getLetterheadBase64('header.png');
    const defaultFooterB64 = getLetterheadBase64('footer.png');`;

code = code.replace(regex, replacement);

const readTarget = 'po: { ...defaults.po, ...(parsed.po || {}) },';
const readRepl = `po: {
                ...defaults.po,
                ...(parsed.po || {}),
                headerImageBase64: (parsed.po && parsed.po.headerImageBase64) ? parsed.po.headerImageBase64 : (defaults.po.headerImageBase64 || getLetterheadBase64('header.png')),
                footerImageBase64: (parsed.po && parsed.po.footerImageBase64) ? parsed.po.footerImageBase64 : (defaults.po.footerImageBase64 || getLetterheadBase64('footer.png'))
            },`;
code = code.replace(readTarget, readRepl);

const readTargetWo = 'wo: { ...defaults.wo, ...(parsed.wo || {}) },';
const readReplWo = `wo: {
                ...defaults.wo,
                ...(parsed.wo || {}),
                headerImageBase64: (parsed.wo && parsed.wo.headerImageBase64) ? parsed.wo.headerImageBase64 : (defaults.wo.headerImageBase64 || getLetterheadBase64('header.png')),
                footerImageBase64: (parsed.wo && parsed.wo.footerImageBase64) ? parsed.wo.footerImageBase64 : (defaults.wo.footerImageBase64 || getLetterheadBase64('footer.png'))
            },`;
code = code.replace(readTargetWo, readReplWo);

fs.writeFileSync('server/controllers/ledgerController.js', code, 'utf8');
console.log('ledgerController.js updated successfully!');
