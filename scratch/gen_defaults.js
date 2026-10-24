const fs = require('fs');
const hBuf = fs.readFileSync('client/src/assets/letterheads/header.png');
const fBuf = fs.readFileSync('client/src/assets/letterheads/footer.png');

const hB64 = 'data:image/png;base64,' + hBuf.toString('base64');
const fB64 = 'data:image/png;base64,' + fBuf.toString('base64');

const content = '// Auto-generated Sathlokhar Synergys E&C Global Limited Letterhead Defaults\n' +
  'export const SATHLOKHAR_HEADER_BASE64 = \'' + hB64 + '\';\n\n' +
  'export const SATHLOKHAR_FOOTER_BASE64 = \'' + fB64 + '\';\n';

fs.writeFileSync('client/src/app/components/shared/po-wo-letterhead-modal/sathlokhar-letterhead-defaults.ts', content, 'utf8');
console.log('sathlokhar-letterhead-defaults.ts written successfully!');
