const fs = require('fs');
const filePath = 'client/src/app/components/shared/po-wo-letterhead-modal/po-wo-letterhead-modal.component.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Normalize line endings to \n for consistent replacement
code = code.replace(/\r\n/g, '\n');

// 2. Ensure import
if (!code.includes('sathlokhar-letterhead-defaults')) {
  code = code.replace(
    "import autoTable from 'jspdf-autotable';",
    "import autoTable from 'jspdf-autotable';\nimport { SATHLOKHAR_HEADER_BASE64, SATHLOKHAR_FOOTER_BASE64 } from './sathlokhar-letterhead-defaults';"
  );
}

// 3. Update Tab 1 top:
const tab1TopRegex = /<div \*ngIf="activePageTab === 'page1'" class="po-sheet-container bg-white mx-auto shadow-lg">[\s\S]*?<div class="po-grid-border">/;
const tab1TopReplacement = `<div *ngIf="activePageTab === 'page1'" class="po-sheet-container bg-white mx-auto shadow-lg">

              <!-- Sathlokhar Letterhead Header Banner -->
              <div class="letterhead-header-banner w-100">
                <img [src]="getHeaderImage()" alt="Sathlokhar Letterhead Header" class="w-100 d-block letterhead-header-img">
              </div>

              <!-- MAIN BORDERED PO/WO TABLE (Centered in Page Body) -->
              <div class="po-sheet-content-wrapper flex-grow-1 d-flex flex-column justify-content-center">
                <div class="po-grid-border w-100">`;

code = code.replace(tab1TopRegex, tab1TopReplacement);

// 4. Update Tab 1 bottom:
const tab1BottomRegex = /<div class="fw-bold" style="font-size: 0\.82rem;">Suppliers Signature with Seal<\/div>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- =+ -->\s*<!-- TAB 2:/;
const tab1BottomReplacement = `<div class="fw-bold" style="font-size: 0.82rem;">Suppliers Signature with Seal</div>
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

            </div>

            <!-- ========================================================= -->
            <!-- TAB 2:`;

code = code.replace(tab1BottomRegex, tab1BottomReplacement);

// 5. Update Tab 2 (Terms Pages):
const termsRegex = /<div \*ngFor="let pageText of docData\.termsPages; let pIdx = index; trackBy: trackByIndex"[\s\S]*?<\/textarea>\s*<\/div>/;
const termsReplacement = `<div *ngFor="let pageText of docData.termsPages; let pIdx = index; trackBy: trackByIndex"
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

code = code.replace(termsRegex, termsReplacement);

// 6. Update styles:
const stylesRegex = /\.po-sheet-container\s*\{[\s\S]*?\.po-grid-border\s*\{[\s\S]*?margin:\s*10px;\s*\}/;
const stylesReplacement = `.po-sheet-container {
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

code = code.replace(stylesRegex, stylesReplacement);

// 7. Update poWoConfig and add getHeaderImage / getFooterImage:
const poWoConfigRegex = /poWoConfig:\s*any\s*=\s*\{[\s\S]*?savedPoWoDocs:\s*\{\}\s*\};/;
const poWoConfigReplacement = `poWoConfig: any = {
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

code = code.replace(poWoConfigRegex, poWoConfigReplacement);

// Restore CRLF
code = code.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully applied all fixes to po-wo-letterhead-modal.component.ts!');
