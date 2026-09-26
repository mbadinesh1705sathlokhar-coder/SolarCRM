const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const { conDb } = require('./database/database');
const { ProjectMaster } = require('./models/ProjectMaster');
const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');
const { ClientPaymentLedger } = require('./models/ClientPaymentLedger');

const clientList = [
  "SP242 : 5KW, Mr. Anbusevan, Ambattur, Chennai",
  "SP295 : 3KW, Mr. Elumalai, Puzhal, Chennai",
  "SP298 : 4KW, Mr. Sekar N, Madambakkam, Chennai",
  "SP299 : 5KW, Mr. Sivakumar, Madipakkam, Chennai",
  "SP300 : 13KW, Mr.Nithin Velachery, Chennai",
  "SP301 : 3KW, Mr. Haribaskar, Madambakkam, Chennai",
  "SP302 : 3KW, Mrs. Geetha, Ramapuram, Chennai",
  "SP303 : 6KW, Mr. Parthiv, Choolaimedu, Chennai",
  "SP304 : 3KW, Mr. Ramesh, Ambattur, Chennai",
  "SP305 : 3KW, M/s. Srinivasan A K, Padi, Chennai",
  "SP306 : 8KW, M/s. Dillibabu Contractor, Padi, Chennai",
  "SP307 : 57KW, M/s. Supreme Petrochem, Manali, Chennai",
  "SP308 : 120KW, M/s. Saro Technologies, Sriperumbathur.",
  "SP309 : 8KW, M/s. TATVA Projects, Madipakkam, Chennai",
  "SP310 : 5KW, M/s Ovia and Co, Choolaimedu, Chennai",
  "SP311 : 100KW, Mr. Kishore, Hosur.",
  "SP312 : 5KW, Mr. Sudarsan Subramaniam, Padapai, Chennai",
  "SP313 : 5KW, Mr. Sumeer Pradeep N R, Padapai, Chennai",
  "SP314 : 5KW, Mr. Arun Krishnamoorthi, Padapai, Chennai",
  "SP315 : 3KW, Mr. N Subrahmanyan, Besant Nagar, Chennai",
  "SP316 : 2KW, Mrs. Uma Mohan, Besant Nagar, Chennai",
  "SP317 : 3KW, Mrs. Jagannathan T V, Besant Nagar, Chennai",
  "SP318 : 3KW, Mrs. Lalitha Kumari, Besant Nagar, Chennai",
  "SP319 : 2KW, Mrs. Divya Balakrishnan, Besant Nagar, Chennai",
  "SP320 : 3KW, Mr. Kamala Natesan, Besant Nagar, Chennai",
  "SP321 : 4KW, Mr. Shanmugam, Besant Nagar, Chennai",
  "SP322 : 5KW, Mr. Khuzem Dawoodbhai, Royapuram, Chennai",
  "SP323 : 5KW, Mr. Taha Shabbir Madha, Royapuram, Chennai",
  "SP324 : 3KW, M/s. VT Enterprises, Puducherry",
  "SP325 : 3KW, Mr. R Thamilamudhan, Pammal, Chennai",
  "SP326 : 3KW, Mr. K Sundarapandy, Pammal, Chennai",
  "SP327 : 5KW, Mr. Babu, Avadi, Chennai",
  "SP328 : 25KW, M/s. DAC Prathayagara, Solinganallur, Chennai",
  "SP329 : 20KW, M/s. DAC Marshal, Tambaram, Chennai",
  "SP330 : 30KW, M/s. DAC Medalion, Selaiyur, Chennai",
  "SP331 : 3KW, Mr. Suresh Babu, Kolathur, Chennai",
  "SP332 : 3KW, Mr. Ashok, Wimco Nagar, Chennai",
  "SP333 : 20KW, Mrs. Seba Abraham, Maduravayol, Chennai",
  "SP334 : 7KW, Mr. Ida Mehathabel vimal, Ayanapakkam, Chennai",
  "SP335 : 4KW, Chandrasekar, Purasaivakkam, Chennai",
  "SP336 : 2KW, Mrs. B Shoba, Besant Nagar, Chennai",
  "SP337 : 17KW, M/s. Saravanaa Aircon Pvt Ltd, Adyar, Chennai",
  "SP338 : 4KW, Mrs. Aarthi, Nanganallur, Chennai",
  "SP339 : 5KW, Mr. Marimuthu, Puzhuthivakkam, Chennai",
  "SP340 : 5KW, Mrs. Shobana, Nesapakkam, Chennai",
  "SP341 : 5KW, Mr. Chandru Babu, Nesapakkam, Chennai",
  "SP342 : 3KW, Mr. Premdoss Samson, Besant Nagar, Chennai",
  "SP343 : 2KW, Mr. Shobana Srinivasan, Besant Nagar, Chennai",
  "SP344 : 2KW, Mr. Govind Prasad, Besant Nagar, Chennai",
  "SP345 : 5KW, Mr. Thangasaravanan, Manapakkam, Chennai",
  "SP346 : 15KW, M/s. Anand Steel Industries, Geroge Town, Chennai",
  "SP347 : 3KW, Mr. U. Selvakumar, T.M.Voyal, Chennai",
  "SP348 : 3KW, Mr. Balaji, Nanganallur, Chennai",
  "SP349 : 6KW, Mr. Ramachandran, Mylapore, Chennai",
  "SP350 : 3KW, Mrs. Geeta Das H, Virugambakkam, Chennai",
  "SP351 : 3KW, Mr. Parthiban, Kovilambakkam, Chennai",
  "SP352 : 5KW, Mr. Saravanan, Vengambakkam, Chennai",
  "SP353 : 3KW, Mr. Nagavijayan, Santhosapuram, Chennai",
  "SP354 : 2.9KW, Mrs. Archana, Mylapore, Chennai",
  "SP355 : 3KW, Mrs. Supriyakannan, Kelambakkam, Chennai",
  "SP356 : 3KW, Mr. Daniel Selvam, Madhavaram, Chennai",
  "SP357 : 5KW, Mr. Raju F Eluvathingal, Chennai",
  "SP358 : 3KW, Mr. Dinesh, Mathur, Chennai",
  "SP359 : 3.6KW, Mr. G Balaji, Nanganallur, Chennai",
  "SP360 : 3.6KW, Mr. Shiram, Nanganallur, Chennai",
  "SP361 : 3.6KW, Mr. R Ramkumar, Nanganallur, Chennai",
  "SP362 : 3KW, M/s TATVA Projects, Madipakkam, Chennai",
  "SP363 : 3KW, Mr. Sasikala Prem, Kolathur, Chennai",
  "SP364 : 3KW, Mr. Ramamohan Rao, Kodambakkam, Chennai",
  "SP365 : 5KW, Mr. Srikumar, Madipakkam, Chennai",
  "SP366 : 3KW, M/s. Saravanaa Aircon, Pondicherry",
  "SP367 : 21KW, Mr. Richard Paul, Villivakkam, Chennai",
  "SP368 : 3KW, Mrs. Kalaivani, Pammal, Chennai",
  "SP369 : 4KW, Mrs. T L Babitha, Iyyappanthangal, Chennai",
  "SP370 : 4KW, Mr. Ravi Chinnaswamy, Porur, Chennai",
  "SP371 : 3KW, M/s. Saraswathi Electricals, Madambakkam, Chennai",
  "SP372 : 3KW, Mr. Deenadaylan, Medavakkam, Chennai",
  "SP373 : 3KW, Mr. Thavaseelan, Madhavaram, Chennai",
  "SP374 : 5KW, Mr. Richard Philip, Selaiyur, Chennai",
  "SP375 : 3KW, Mr. Rajapandian P, Santhosapuram, Chennai",
  "SP376 : 5KW, Mr. Vignesh Babu V, Madipakkam, Chennai",
  "SP377 : 3KW, Mr. Raja A, Ambattur, Chennai",
  "SP378 : 3KW, Mrs. Renuka S, Mogapair, Chennai",
  "SP379 : 3KW, Mrs. Sumathy P V, Ambattur, Chennai",
  "SP380 : 3KW, Mrs. R Vedapriya, Triplicane, Chennai",
  "SP381 : 3KW, Mr. N Venkatramani, Triplicane, Chennai",
  "SP382 : 3KW, Mr. K Vatsal, Triplicane, Chennai",
  "SP383 : 38KW, M/s. VB Reality : Swathy College, Nellore",
  "SP384 : 100KW, M/s. Saravana Aircon : Saveetha College, Chennai",
  "SP385 : 3KW, Mrs. Geetha Menon S, Kovilambakkam, Chennai",
  "SP386 : 3KW, Mr. Parthiban, Chrompet, Chennai",
  "SP387 : 5KW, Mrs. Karpagavalli Ananthappan, Chrompet, Chennai",
  "SP388 : 3KW, Mrs. Karpagavalli Ananthappan, Chrompet, Chennai",
  "SP389 : 5KW, Mr. Kannanswamy, Triplicane, Chennai",
  "SP390 : 6KW, Mr. T N Ravi sankar, Anna Nagar, Chennai",
  "SP391 : 6KW, Mr. T Rajkumar, Anna Nagar, Chennai",
  "SP392 : 6KW, Mr. Sathosh KV, Anna Nagar, Chennai",
  "SP393 : 6KW, Mr. Ravidranath D, Anna Nagar, Chennai",
  "SP394 : 3KW, Mr. Tony Edwin, Anna Nagar, Chennai",
  "SP395 : 3KW Mr. P Subramanian,  Poonamalee, Chennai",
  "SP396 : 3KW Mr. Sandeep Reddy, Kelambakkam, Chennai",
  "SP397 : 3KW Mr. Ganeshan, Kovur, Chennai",
  "SP398 : 5KW Mr. Ganeshan, Kovur, Chennai",
  "SP399 : 5KW Mr. Aravind, Selaiyur, Chennai",
  "SP400 : 5KW Mr. Harsha Sathasivam , Perungudi, Chennai",
  "SP401 : 6KW Mr. Karthik, Perungudi, Chennai",
  "SP402 : 5KW Mr. Srinath, Padapai, Chennai",
  "SP403 : 5KW Mr. Prabhakar, Padapai, Chennai",
  "SP404 : 3KW Mr. Nadarajan, Anagaputhur, Chennai",
  "SP405 : 3KW Ms. Megala, Poonamalee",
  "SP406 : 6KW Ms. Saraswathi Electricals, Madambakkam, Chennai",
  "SP407 : 3KW Mr. Srinivasan, Mangadu, Kancheepuram",
  "SP408 : 3KW Mr. Suresh, Arumbakkam, Chennai",
  "SP409 : 5KW Mrs. Malini Gururajan, Madipakkam, Chennai",
  "SP410 : 3KW Mr. Saraswathi ,Perungaluthur, Chennai",
  "SP411 : 5KW Mr. Prasad, East Thambaram, Chennai",
  "SP412 : 5KW, Mr. Ravi, Mylapore, Chennai",
  "SP413 : 3KW, Mrs. Chitra, T. Nagar, Chennai",
  "SP414 : 3KW, Mr. Mohan, Arumbakkam, Chennai",
  "SP415 : 3KW, M/s. Sree Swastik Energy, Vengambakkam, Chennai",
  "SP416 : 12KW, M/S. GraviTech Solutions, Thirumudivakkam, Chennai",
  "SP417 : 15KW, M/S. Srinivasa Engineering Works, Sithalapakkam, Chennai",
  "Warehouse : Sathlokhar H.O",
  "SP418 : 250KW, M/S. Imperial Sprits, Pollachi"
];

const warehouseExpenses = [
  { mop: 'Apr-26', date: '2026-04-28', amount: 5000.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Apr-26', date: '2026-04-28', amount: 5000.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Apr-26', date: '2026-04-28', amount: 1800.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Apr-26', date: '2026-04-28', amount: 6000.00, through: 'Petty Cash', purpose: 'Civil Work Labour', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Apr-26', date: '2026-04-28', amount: 1700.00, through: 'Petty Cash', purpose: 'Civil Work Labour', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'May-26', date: '2026-05-05', amount: 5000.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'May-26', date: '2026-05-05', amount: 5000.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'May-26', date: '2026-05-23', amount: 1800.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'VAIRAMANI' },
  { mop: 'May-26', date: '2026-05-29', amount: 210.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'MANIMARAN N' },
  { mop: 'Jun-26', date: '2026-06-02', amount: 484.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Jun-26', date: '2026-06-04', amount: 700.00, through: 'Petty Cash', purpose: 'Expo / Event Expenses', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Jun-26', date: '2026-06-05', amount: 1000.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Jun-26', date: '2026-06-06', amount: 2800.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'MANIMARAN N' },
  { mop: 'Jun-26', date: '2026-06-09', amount: 5000.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'SOUNDARARAJAN M' },
  { mop: 'Jun-26', date: '2026-06-15', amount: 3972.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'V SHARATH' },
  { mop: 'Jun-26', date: '2026-06-15', amount: 3435.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'V SHARATH' },
  { mop: 'Jun-26', date: '2026-06-15', amount: 161.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'V SHARATH' },
  { mop: 'Jun-26', date: '2026-06-15', amount: 175.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'V SHARATH' },
  { mop: 'Jun-26', date: '2026-06-18', amount: 485.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'S KARTHIKEYAN' },
  { mop: 'Jun-26', date: '2026-06-18', amount: 380.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'K KARTHIKEYAN' },
  { mop: 'Jun-26', date: '2026-06-19', amount: 472.00, through: 'Petty Cash', purpose: 'Earthing Materials', paidBy: 'V SHARATH' },
  { mop: 'Jul-26', date: '2026-07-01', amount: 944.00, through: 'Petty Cash', purpose: 'Tools Asset', paidBy: 'RAHUL' },
  { mop: 'Jul-26', date: '2026-07-04', amount: 3500.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'K KARTHIKEYAN' },
  { mop: 'Jul-26', date: '2026-07-06', amount: 140.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'K KARTHIKEYAN' },
  { mop: 'Jul-26', date: '2026-07-22', amount: 6500.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'VAIRAMANI' },
  { mop: 'Jul-26', date: '2026-07-22', amount: 107.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'V SHARATH' },
  { mop: 'Jul-26', date: '2026-07-29', amount: 232.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'K KARTHIKEYAN' },
  { mop: 'Aug-26', date: '2026-08-04', amount: 64900.00, through: 'P.O', purpose: 'Cable Tray Materials', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-04', amount: 1680.00, through: 'Petty Cash', purpose: 'Consumables', paidBy: 'VAIRAMANI' },
  { mop: 'Aug-26', date: '2026-08-06', amount: 25724.00, through: 'P.O', purpose: 'Expo / Event Expenses', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-08', amount: 25000.00, through: 'P.O', purpose: 'Expo / Event Expenses', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-13', amount: 480.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'V SHARATH' },
  { mop: 'Aug-26', date: '2026-08-20', amount: 300.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'K KARTHIKEYAN' },
  { mop: 'Aug-26', date: '2026-08-14', amount: 41300.00, through: 'W.O', purpose: 'Civil Work Labour', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-19', amount: 64900.00, through: 'P.O', purpose: 'Cables', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-19', amount: 160185.00, through: 'P.O', purpose: 'Cables', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-24', amount: 14632.00, through: 'P.O', purpose: 'DB Boxes', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-19', amount: 2832.00, through: 'P.O', purpose: 'Consumables', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-29', amount: 132160.00, through: 'P.O', purpose: 'Cables', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-29', amount: 15222.00, through: 'P.O', purpose: 'Consumables', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-29', amount: 7080.00, through: 'P.O', purpose: 'DB Boxes', paidBy: 'OFFICE' },
  { mop: 'Sep-26', date: '2026-09-02', amount: 660933.00, through: 'P.O', purpose: 'Solar Panels', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-15', amount: 17138.00, through: 'P.O', purpose: 'Earthing Materials', paidBy: 'OFFICE' },
  { mop: 'Sep-26', date: '2026-09-04', amount: 15458.00, through: 'P.O', purpose: 'Earthing Materials', paidBy: 'OFFICE' },
  { mop: 'Sep-26', date: '2026-09-12', amount: 10054.00, through: 'P.O', purpose: 'DB Boxes', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-28', amount: 350.00, through: 'Petty Cash', purpose: 'DB Boxes', paidBy: 'OFFICE' },
  { mop: 'Aug-26', date: '2026-08-28', amount: 350.00, through: 'Petty Cash', purpose: 'Material Transport', paidBy: 'OFFICE' },
  { mop: 'Sep-26', date: '2026-09-05', amount: 118000.00, through: 'P.O', purpose: 'Expo / Event Expenses', paidBy: 'OFFICE' },
  { mop: 'Sep-26', date: '2026-09-16', amount: 68440.00, through: 'P.O', purpose: 'Cables', paidBy: 'OFFICE' }
];

async function runMigration() {
  try {
    await conDb.authenticate();
    console.log('Connected to DB');
    await conDb.sync({ alter: true });
    console.log('Synced models with alter: true');

    // 1. Update ProjectMaster records with exact clientList strings and orderIndex
    let totalUpdated = 0;
    let totalCreated = 0;

    for (let i = 0; i < clientList.length; i++) {
      const entry = clientList[i];
      const orderIdx = i + 1;

      let siteId = '';
      if (entry.startsWith('Warehouse :')) {
        siteId = 'WAREHOUSE';
      } else {
        const m = entry.match(/^(SP\d+)\s*:/i);
        if (m) {
          siteId = m[1].toUpperCase();
        }
      }

      if (!siteId) continue;

      let project = await ProjectMaster.findOne({ where: { siteId } });
      if (project) {
        project.clientName = entry;
        project.orderIndex = orderIdx;
        await project.save();
        totalUpdated++;
      } else {
        // Create new project entry
        await ProjectMaster.create({
          siteId,
          clientName: entry,
          location: siteId === 'WAREHOUSE' ? 'Sathlokhar H.O' : 'Chennai',
          siteCapacity: siteId === 'WAREHOUSE' ? 'Central Store' : '5',
          siteValue: 0.00,
          received: 0.00,
          due: 0.00,
          siteExpenses: siteId === 'WAREHOUSE' ? 1509115.00 : 0.00,
          siteType: siteId === 'WAREHOUSE' ? 'Central Warehouse' : 'Residential',
          systemType: siteId === 'WAREHOUSE' ? 'Central Inventory' : 'Ongrid',
          siteCategory: siteId === 'WAREHOUSE' ? 'Material Stock' : 'TATA SPG',
          clientType: siteId === 'WAREHOUSE' ? 'Internal Store' : 'Individual',
          saleType: siteId === 'WAREHOUSE' ? 'Internal' : 'B2C',
          orderBy: 'OFFICE',
          orderIndex: orderIdx
        });
        totalCreated++;
      }
    }
    console.log(`ProjectMaster: ${totalUpdated} updated, ${totalCreated} created.`);

    // 2. Replace SiteExpenseLedger for WAREHOUSE with the 49 verified entries
    await SiteExpenseLedger.destroy({ where: { siteId: 'WAREHOUSE' } });
    console.log('Cleared existing WAREHOUSE expenses.');

    const expenseRecords = warehouseExpenses.map((exp, idx) => ({
      sNo: idx + 1,
      mop: exp.mop,
      expenseDate: exp.date,
      siteId: 'WAREHOUSE',
      clientSiteName: 'Warehouse : Sathlokhar H.O',
      clientName: 'Warehouse : Sathlokhar H.O',
      amount: exp.amount,
      paymentThrough: exp.through,
      purpose: exp.purpose,
      paidBy: exp.paidBy,
      remarks: 'Warehouse stock expense',
      billVoucher: exp.through === 'P.O' || exp.through === 'W.O' ? 'Submitted' : 'Not Submitted',
      category: exp.purpose,
      vendorName: exp.paidBy,
      referenceNo: exp.through
    }));

    await SiteExpenseLedger.bulkCreate(expenseRecords);
    console.log(`Inserted ${expenseRecords.length} warehouse expenses into SiteExpenseLedger.`);

    // 3. Update WAREHOUSE siteExpenses in ProjectMaster
    const totalExp = expenseRecords.reduce((sum, e) => sum + e.amount, 0);
    const whProject = await ProjectMaster.findOne({ where: { siteId: 'WAREHOUSE' } });
    if (whProject) {
      whProject.siteExpenses = totalExp;
      await whProject.save();
      console.log(`Updated WAREHOUSE project siteExpenses to ₹ ${totalExp}`);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
