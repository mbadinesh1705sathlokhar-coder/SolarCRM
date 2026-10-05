const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');
const { Op } = require('sequelize');

async function backfillPettyCashSeq() {
  try {
    console.log('Starting Petty Cash sequence backfill...');
    const allExpenses = await SiteExpenseLedger.findAll({
      order: [
        ['expenseDate', 'ASC'],
        ['id', 'ASC']
      ]
    });

    const siteGroups = {};
    for (const exp of allExpenses) {
      const sid = (exp.siteId || 'UNASSIGNED').trim();
      if (!siteGroups[sid]) siteGroups[sid] = [];
      siteGroups[sid].push(exp);
    }

    let updatedCount = 0;
    let totalPettyCashCount = 0;

    for (const sid in siteGroups) {
      const list = siteGroups[sid];
      let pcCounter = 1;
      for (const exp of list) {
        const ref = (exp.referenceNo || '').trim();
        const pt = (exp.paymentThrough || '').trim();

        // Check if real PO or WO reference
        const isRealPoWo = ref && 
          !['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Not Submitted', 'Submitted', '-'].includes(ref) && 
          !ref.toUpperCase().startsWith('PC-') && 
          (ref.toUpperCase().includes('PO') || ref.toUpperCase().includes('WO') || ref.toUpperCase().includes('SOLAR'));

        if (!isRealPoWo) {
          totalPettyCashCount++;
          const expectedRef = `PC-${pcCounter}`;
          pcCounter++;
          
          const finalPt = ['Gatepass', 'GatePass', 'Accounts'].includes(pt) ? pt : 'Petty Cash';
          if (exp.referenceNo !== expectedRef || exp.paymentThrough !== finalPt) {
            await exp.update({
              referenceNo: expectedRef,
              paymentThrough: finalPt
            });
            updatedCount++;
          }
        }
      }
    }

    console.log(`Backfill Complete! ${updatedCount} petty cash entries updated to PC-1, PC-2... (Total petty cash entries: ${totalPettyCashCount})`);
    process.exit(0);
  } catch (err) {
    console.error('Error backfilling petty cash sequences:', err);
    process.exit(1);
  }
}

backfillPettyCashSeq();
