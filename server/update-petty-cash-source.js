const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');
const { Op } = require('sequelize');

async function updateSources() {
  try {
    const expenses = await SiteExpenseLedger.findAll();
    let updatedCount = 0;
    for (const e of expenses) {
      const ref = (e.referenceNo || '').trim();
      const isRealRef = ref && !['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Not Submitted', 'Submitted', '-'].includes(ref);
      
      let targetSource = e.paymentThrough;
      if (isRealRef) {
        if (ref.toUpperCase().includes('WO-') || ref.toUpperCase().includes('W.O')) {
          targetSource = 'W.O';
        } else {
          targetSource = 'P.O';
        }
      } else {
        if (e.paymentThrough !== 'Gatepass' && e.paymentThrough !== 'GatePass' && e.paymentThrough !== 'Accounts' && e.paymentThrough !== 'W.O') {
          targetSource = 'Petty Cash';
        }
      }

      if (e.paymentThrough !== targetSource) {
        await e.update({ paymentThrough: targetSource });
        updatedCount++;
      }
    }
    console.log(`Successfully updated ${updatedCount} expense records in DB to correct Source (P.O / Petty Cash / W.O)`);
    process.exit(0);
  } catch (err) {
    console.error('Error updating sources:', err);
    process.exit(1);
  }
}

updateSources();
