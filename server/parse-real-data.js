const fs = require('fs');
const path = require('path');

const rawTsv = `Awarded Date\tSite ID\tClient Name\tLocation\tContact No\tEmail ID\tAdress\tSite Capacity\tSite Value\tSite Type\tSystem Type\tSite Category\tClient Type\tSale Type\tOrder By\tReceived \tDue\tSite Expenses\tMargin\tMaterials Supply\tInstallation\tEB Process\tDocu -ments\tWarranty \tHanded Over\tWork in Process\tCompleted
31-07-2026\tSP242\tAnbuselvan A\tAmbattur\t\t\t7A/8 BALASUBRAMANIYAN STREET, GAJAVINAYAKA CITY N S C ROAD, VENKATAPURAM, AMBATTUR, CHENNAI - 600053\t5\t₹ 2,85,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,86,250.00\t₹ 98,750.00\t₹ 2,07,356.00\t27.24%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
27-07-2026\tSP295\tElumalai\tPuzhal\t\t\tP.No-1,Sf No 385/2, Mahaveer Garden 7th Cross St,Puzhal,Chennai - 600066\t3\t₹ 2,10,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,80,000.00\t₹ 30,000.00\t₹ 42,611.00\t79.71%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
02-04-2026\tSP298\tN Sekar\tMadampakkam\t\t\tS.Bhuwanavathi, Plot No-96, 5th Street, Maruthi Nagar, Madambakkam Chennai-126\t4\t₹ 2,65,672.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 79,702.00\t₹ 1,85,970.00\t₹ 2,34,200.00\t11.85%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
07-04-2026\tSP299\tSivakumar\tMadipakkam\t\t\tPlot No.337a, Vallalkari Street, Srinivasa Nagar ,Ram Nagar North, Madipakkam Chennai, 600091\t5\t₹ 4,90,000.00\tResidential\tHybrid\tWaaree \tIndividual \tB2C\tS KARTHIKEYAN\t₹ 1,47,000.00\t₹ 3,43,000.00\t₹ 3,94,665.00\t19.46%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
09-04-2026\tSP300\tNitin Unnikrishnan\tVelachery\t\t\t1st Floor, Rugmani Bhavan, 9/27, 2nd Street, Seetharam Nagar, Velachery, Chennai - 600042\t13\t₹ 8,41,896.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 2,52,569.00\t₹ 5,89,327.00\t₹ 97,964.00\t88.36%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
09-04-2026\tSP301\tHaribaskar\tMadampakkam\t\t\tR. Hari baskar, Plot A1 &A2/1, Jem orchid villas, Bala garden, noothencheri, Madambakkam, chennai 600126\t3\t₹ 2,22,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 2,00,000.00\t₹ 22,000.00\t₹ 1,42,677.30\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
09-04-2026\tSP302\tGeetha\tMadhavaram\t\t\tGeetha, 5/5 A Second Street , Natesan Nagar , Ramapuram, chennai 600089\t3\t₹ 2,18,453.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 2,18,453.00\t₹ 0.00\t₹ 1,73,979.30\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
09-04-2026\tSP303\tParthiv \tChoolaimedu\t\t\tNEW NO.28, OLD NO.18/4, KAMARAJ NAGAR 4TH STREET, CHOOLAIMEDU, CHENNAI- 94.\t6\t₹ 3,96,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 3,66,000.00\t₹ 30,000.00\t₹ 3,03,738.00\t23.30%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
09-04-2026\tSP304\tRamesh \tAmbattur\t\t\tG Ramesh babu, No3, 3rd Main Road, Banu Nagar, Ambattur, Chennai- 600 053\t3\t₹ 2,10,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,65,000.00\t₹ 45,000.00\t₹ 1,45,478.30\t30.72%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
09-04-2026\tSP305\tA K Srinivasan\tPadi\t\t\tA. K. Srinivasan, 160A, Kattabomman Street, Kumaran Nagar,  Padi, Chennai 600050.\t3\t₹ 2,10,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,10,000.00\t₹ 1,00,000.00\t₹ 1,61,960.30\t22.88%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
09-04-2026\tSP306\tDillibagu Contractor\tPadi\t\t\tNO 5, 4TH STREET, SIVASAKTHI NAGAR, KORATTUR CHENNAI,  Tamil Nadu, 600080. 33AAMPD1640B1ZH\t8\t₹ 4,00,751.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tK KARTHIKEYAN\t₹ 60,000.00\t₹ 3,40,751.00\t₹ 3,43,440.00\t14.30%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
09-04-2026\tSP307\tM/s. Supreme Petrochem Pvt Ltd\tManali\t\t\tAMMULLAVOYIL VILLAGE, ANDARKUPPAM POST, MANALI NEW TOWN, CHENNAI, TAMILNADU - 600103.\t57\t₹ 29,04,700.00\tIndustrial\tOn Gird\tWaaree \tCompany\tDirect B2B\tK KARTHIKEYAN\t₹ 14,53,500.00\t₹ 14,51,200.00\t₹ 26,78,302.00\t \tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\t67%\t33%
09-04-2026\tSP308\tM/s. Saro Technologies\tSriperumbatur\t\t\tS - 07/1, SIPCOT AEROSPACE PARK, VALLAM VADAGAL, Vallam Kandigai, Kancheepuram, Tamil Nadu, 631604. \t120\t₹ 37,00,000.00\tIndustrial\tOn Gird\tWaaree \tCompany\tDirect B2B\tK KARTHIKEYAN\t₹ 30,00,000.00\t₹ 7,00,000.00\t₹ 34,68,832.40\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
10-04-2026\tSP309\tTATVA Projects\tMadipakkam\t\t\t\t8\t₹ 5,24,788.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tK KARTHIKEYAN\t₹ 3,22,000.00\t₹ 2,02,788.00\t₹ 1,17,873.00\t77.54%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
13-04-2026\tSP310\tM/s Ovia and Co\tChoolaimedu\t\t\tOVIA AND CO, New No.35, Old No.10/2, Vanniar Street, Choolaimedu, Chennai, Tamil Nadu, 600094.\t5\t₹ 3,10,365.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tV SHARATH\t₹ 3,10,365.00\t₹ 0.00\t₹ 2,14,030.40\t31.04%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
17-04-2026\tSP311\tKishore\tHosur\t\t\t\t100\t₹ 32,00,000.00\tIndustrial\tOn Gird\tWaaree \tCompany\tDirect B2B\tV SHARATH\t₹ 6,40,360.00\t₹ 25,59,640.00\t₹ 37,02,701.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
20-04-2026\tSP312\tSudarsan Subramaniam\tPadapai\t\t\t\t5\t₹ 2,09,904.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tV SHARATH\t₹ 2,09,902.00\t₹ 2.00\t₹ 1,32,884.00\t36.69%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP313\tSumeer Pradeep N R\tPadapai\t\t\t\t5\t₹ 2,68,057.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tV SHARATH\t₹ 2,68,057.00\t₹ 0.00\t₹ 1,91,774.60\t28.46%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP314\tArun Krishnamoorthi\tPadapai\t\t\t\t5\t₹ 2,68,057.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tV SHARATH\t₹ 2,30,000.00\t₹ 38,057.00\t₹ 1,90,921.60\t28.78%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP315\tN Subrahmanyan\tBesant Nagar\t\t\t\t3\t₹ 2,12,355.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,48,655.00\t₹ 63,700.00\t₹ 1,40,660.40\t33.76%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP316\tUma Mohan\tBesant Nagar\t\t\t\t2\t₹ 1,58,667.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,58,667.00\t₹ 0.00\t₹ 92,937.60\t41.43%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP317\tJ Ganesh\tBesant Nagar\t\t\t\t3\t₹ 2,12,355.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 2,12,355.00\t₹ 0.00\t₹ 1,26,806.40\t40.29%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP318\tManjula\tBesant Nagar\t\t\t\t3\t₹ 2,12,355.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 2,12,355.00\t₹ 0.00\t₹ 1,26,806.40\t40.29%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP319\tDivya Balakrishnan\tBesant Nagar\t\t\t\t2\t₹ 1,58,667.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,58,667.00\t₹ 0.00\t₹ 92,937.60\t41.43%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP320\tKalpana Pradhap\tBesant Nagar\t\t\t\t3\t₹ 2,12,355.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 2,12,355.00\t₹ 0.00\t₹ 1,26,806.40\t40.29%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
20-04-2026\tSP321\tShanmugam\tBesant Nagar\t\t\t\t5\t₹ 2,66,151.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 2,66,151.00\t₹ 0.00\t₹ 1,65,312.00\t37.89%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
24-04-2026\tSP322\tKhuzem Dawoodbhai\tRoyapuram\t\t\tKHUZEM DAWOODBHAI, 33/16/2, West Madha Chruch Road, 2nd Floor, Opp to Petrol Bunk, Royapuram, Chennai - 600013\t5\t₹ 3,17,564.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,35,000.00\t₹ 82,564.00\t₹ 2,07,773.00\t34.57%\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\t0%\t100%
24-04-2026\tSP323\tTaha Shabbir Madha\tRoyapuram\t\t\tKHUZEM DAWOODBHAI, 33/16/2, West Madha Chruch Road, 2nd Floor, Opp to Petrol Bunk, Royapuram, Chennai - 600013\t4\t₹ 2,83,031.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,28,000.00\t₹ 55,031.00\t₹ 18,482.00\t93.47%\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\t0%\t100%
30-04-2026\tSP324\tM/s. VT Enterprises\tPuducherry\t\t\tNo 116 ,Ottamplayam road ,Puducherry 605110. 34CCOPV4806K1Z0\t3\t₹ 1,32,000.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tRetailer B2B\tK KARTHIKEYAN\t₹ 1,45,000.00\t₹ -13,000.00\t₹ 1,28,127.00\t2.93%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
30-04-2026\tSP325\tR Thamilamudhan\tPammal\t\t\tR.Thamilamudhan, Door no 1B,  Plot no 83, 11th Street, Sankar Nagar, Pammal, Chennai -600 075\t3\t₹ 2,20,940.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tSOUNDARARAJAN M\t₹ 2,20,006.00\t₹ 934.00\t₹ 1,73,386.00\t21.52%\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\t0%\t100%
30-04-2026\tSP326\tK Sundarapandy\tPammal\t\t\tK. SUNDARAPANDY, Door no 5A, 12 th Street, Sankar nagar, Pammal, Chennai 600075\t3\t₹ 2,20,940.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tSOUNDARARAJAN M\t₹ 1,95,000.00\t₹ 25,940.00\t₹ 1,62,087.00\t26.64%\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\t0%\t100%
05-05-2026\tSP327\tBabu\tAvadi\t\t\tPlot No 74, GPR NAGAR, MELPAKKAM, Avadi, Thiruvallur - 600055\t5\t₹ 2,85,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 50,000.00\t₹ 2,35,000.00\t₹ 32,283.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
20-04-2026\tSP328\tM/s. DAC Prathayagara\tSolinganallur\t\t\t\t25\t₹ 13,55,805.00\tResidential Common\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tV SHARATH\t₹ 0.00\t₹ 13,55,805.00\t₹ 7,32,211.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
21-04-2026\tSP329\tM/s. DAC Marshal\tTambaram\t\t\t\t20\t₹ 10,84,643.00\tResidential Common\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tV SHARATH\t₹ 0.00\t₹ 10,84,643.00\t₹ 5,86,757.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
21-04-2026\tSP330\tM/s. DAC Medalion\tSelaiyur\t\t\t\t30\t₹ 16,26,965.00\tResidential Common\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tV SHARATH\t₹ 0.00\t₹ 16,26,965.00\t₹ 9,48,427.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
24-04-2026\tSP331\tSuresh Babu\tKolathur\t\t\tD S Suresh babu, Sri Ganapathi Illam, No.1A Cholan Street, Anbalazan Nagar, Chennai 11.\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,14,500.00\t₹ 1,00,500.00\t₹ 43,497.50\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
26-04-2026\tSP332\tAshok\tWimco Nagar\t\t\t\t3\t₹ 2,18,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 2,18,000.00\t₹ 0.00\t₹ 41,869.00\t80.79%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
27-04-2026\tSP333\tSeba Abraham\tMaduravayol\t\t\t\t20\t₹ 8,06,000.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,50,000.00\t₹ 6,56,000.00\t₹ 1,31,647.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
28-04-2026\tSP334\tIda Mehathabel vimal\tAyanapakkam\t\t\t\t7\t₹ 4,68,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,40,000.00\t₹ 3,28,000.00\t₹ 84,184.00\t82.01%\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tTRUE\t33%\t67%
29-04-2026\tSP335\tChandrasekar\tPurasaiwakkam\t\t\t\t4\t₹ 2,80,090.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 2,10,000.00\t₹ 70,090.00\t₹ 53,808.00\t80.79%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
30-04-2026\tSP336\tB Shoba\tBesant Nagar\t\t\t\t2\t₹ 1,58,667.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,58,667.00\t₹ 0.00\t₹ 92,937.60\t41.43%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
01-05-2026\tSP337\tM/s. Saravanaa Aircon Pvt Ltd\tAdayar\t\t\t\t19.2\t₹ 6,42,972.00\tIndustrial\tOn Gird\tOther\tCompany\tDirect B2B\tK SATHISH\t₹ 3,00,000.00\t₹ 3,42,972.00\t₹ 6,31,122.00\t1.84%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
08-05-2026\tSP338\tAarthi\tNanganallur\t\t\t\t4\t₹ 2,60,489.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 78,000.00\t₹ 1,82,489.00\t₹ 2,26,166.00\t13.18%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
08-05-2026\tSP339\tMarimuthu\tPuzhuthivakkam\t\t\t\t5\t₹ 2,75,100.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tSOUNDARARAJAN M\t₹ 2,00,000.00\t₹ 75,100.00\t₹ 8,528.00\t96.90%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
09-05-2026\tSP340\tShobana\tNesapakkam\t\t\t\t5\t₹ 2,86,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 85,000.00\t₹ 2,01,000.00\t₹ 2,26,496.80\t20.81%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
09-05-2026\tSP341\tChandru Babu\tNesapakkam\t\t\t\t5\t₹ 2,86,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 85,000.00\t₹ 2,01,000.00\t₹ 2,26,496.80\t20.81%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
09-05-2026\tSP342\tPremdoss Samson\tBesant Nagar\t\t\t\t3\t₹ 2,12,355.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 2,12,367.00\t₹ -12.00\t₹ 1,26,806.40\t40.29%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
09-05-2026\tSP343\tShobana Srinivasan\tBesant Nagar\t\t\t\t2\t₹ 1,58,667.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,58,667.00\t₹ 0.00\t₹ 92,937.60\t41.43%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
09-05-2026\tSP344\tGovind Prasad\tBesant Nagar\t\t\t\t2\t₹ 1,58,667.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,58,666.00\t₹ 1.00\t₹ 92,937.60\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
13-05-2026\tSP345\tThangasaravanan\tManapakkam\t\t\t\t5\t₹ 2,10,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 2,10,000.00\t₹ 0.00\t₹ 1,64,449.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
15-05-2026\tSP346\tM/s. Anand Steel Industries\tGeroge Town\t\t\t\t15\t₹ 9,00,000.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tK SATHISH\t₹ 7,76,100.00\t₹ 1,23,900.00\t₹ 8,11,544.00\t9.83%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
15-05-2026\tSP347\tU. Selvakumar\tThirumullaivoyal\t\t\t\t3\t₹ 2,19,010.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,10,000.00\t₹ 9,010.00\t₹ 36,123.00\t83.51%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
18-05-2026\tSP348\tBalaji S\tNanganallur\t\t\t\t3\t₹ 2,17,345.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 1,30,000.00\t₹ 87,345.00\t₹ 1,89,619.40\t12.76%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
01-06-2026\tSP349\tRamachandran\tMylapore\t\t\t\t6\t₹ 4,20,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,29,209.00\t₹ 2,90,791.00\t₹ 77,728.00\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
15-05-2026\tSP350\tGeeta Das H\tVirugambakkam\t\t\t\t3\t₹ 2,18,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,95,000.00\t₹ 23,000.00\t₹ 0.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
15-05-2026\tSP351\tParthiban\tKovilambakkam\t\t\t\t3\t₹ 2,39,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 72,000.00\t₹ 1,67,000.00\t₹ 1,26,416.85\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
15-05-2026\tSP352\tSaravanan\tVengambakkam\t\t\t\t5\t₹ 3,10,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 3,10,000.00\t₹ 0.00\t₹ 51,355.00\t83.43%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
15-05-2026\tSP353\tNagavijayan\tSanthosapuram\t\t\t\t3\t₹ 2,20,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,20,000.00\t₹ 0.00\t₹ 50,352.00\t77.11%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
15-05-2026\tSP354\tArchana\tMylapore\t\t\t\t2.9\t₹ 1,94,931.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,94,932.00\t₹ -1.00\t₹ 1,09,872.00\t43.64%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
15-05-2026\tSP355\tSupriyakannan\tKelambakkam\t\t\t\t3\t₹ 2,25,096.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,65,000.00\t₹ 60,096.00\t₹ 47,215.00\t79.02%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
05-06-2006\tSP356\tDaniel Selvam\tMadhavaram\t\t\t\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,57,500.00\t₹ 57,500.00\t₹ 47,566.00\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
05-06-2026\tSP357\tRaju F Eluvathingal\tChennai\t\t\t\t5\t₹ 2,60,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,00,000.00\t₹ 1,60,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
06-06-2026\tSP358\tDinesh\tMathur\t\t\t\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 64,500.00\t₹ 1,50,500.00\t₹ 49,528.00\t \tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\t67%\t33%
15-06-2026\tSP359\tG Balaji\tNanganallur\t\t\t\t3.7\t₹ 2,33,166.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tS KARTHIKEYAN\t₹ 68,000.00\t₹ 1,65,166.00\t₹ 1,68,575.00\t \tTRUE\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t67%\t33%
15-06-2026\tSP360\tShiram\tNanganallur\t\t\t\t3.7\t₹ 2,33,166.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tS KARTHIKEYAN\t₹ 68,156.00\t₹ 1,65,010.00\t₹ 1,68,575.00\t \tTRUE\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t67%\t33%
15-06-2026\tSP361\tR Ramkumar\tNanganallur\t\t\t\t3.7\t₹ 2,33,166.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tS KARTHIKEYAN\t₹ 68,000.00\t₹ 1,65,166.00\t₹ 1,68,574.00\t \tTRUE\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t67%\t33%
09-06-2026\tSP362\tM/s TATVA Projects\tMadipakkam\t\t\t\t3\t₹ 2,20,000.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tDirect B2B\tK KARTHIKEYAN\t₹ 1,67,778.00\t₹ 52,222.00\t₹ 38,027.50\t \tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\t67%\t33%
17-06-2026\tSP363\tSasikala Prem\tKolathur\t\t\tPl. No : 3, RK Syndicate Nagar, Kolathur, Chennai - 99.\t3\t₹ 2,38,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 2,58,000.00\t₹ -20,000.00\t₹ 25,978.00\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
16-06-2026\tSP364\tRamamohan Rao\tKodambakkam\t\t\t2/24, Viswanathapuram 3rd Street, Kodambakkam, Chennai, 600024.\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 70,000.00\t₹ 1,45,000.00\t₹ 38,168.50\t \tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\t67%\t33%
18-06-2026\tSP365\tSrikumar\tMadipakkam\t\t\t999B Kalaivanar Street, Ram Nagar North Extn, Srinivasa Nagar, Chennai. 600091.\t5\t₹ 3,30,764.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 3,00,000.00\t₹ 30,764.00\t₹ 70,682.00\t \tTRUE\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t67%\t33%
20-06-2026\tSP366\tM/s. Saravanaa Aircon : David\tPondicherry\t\t\tPlot No.5171, F2, Sathlokhar, 9th Street, Ram Nagar North Extension, Madipakkam, Chennai, Tamil Nadu, 600091.\t3\t₹ 2,30,000.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tRetailer B2B\tK SATHISH\t₹ 1,65,000.00\t₹ 65,000.00\t₹ 58,877.50\t74.40%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
22-06-2026\tSP367\tRichard Paul\tVillivakkam\t\t\t\t21\t₹ 11,38,005.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 4,55,632.00\t₹ 6,82,373.00\t₹ 5,53,213.50\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
23-06-2026\tSP368\tKalaivani\tPammal\t\t\t6, Devadoss street, HL colony, Annanagar, Pammal, Chennai-600075.\t3\t₹ 2,28,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,37,000.00\t₹ 91,000.00\t₹ 46,675.00\t79.53%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\t33%\t67%
02-07-2026\tSP369\tT L Babitha\tIyyappanthangal\t\t\tSF NO.113, PLOT NO.59, ASHOK BRINDHAVAN NAGAR, IYYAPPANTHANGAL, CHENNAI - 600056.\t4\t₹ 2,70,368.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 50,000.00\t₹ 2,20,368.00\t₹ 22,464.00\t \tTRUE\tTRUE\tFALSE\tTRUE\tFALSE\tFALSE\t50%\t50%
08-07-2026\tSP370\tRavi Chinnaswamy\tPorur\t\t\t\t4\t₹ 2,80,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 2,35,000.00\t₹ 45,000.00\t₹ 4,154.00\t \tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\t50%\t50%
08-07-2026\tSP371\tM/s. Saraswathi Electricals\tMadambakkam\t\t\t\t3\t₹ 1,52,250.00\tResidential\tOn Gird\tTata SPG Order\tCompany\tRetailer B2B\tK SATHISH\t₹ 1,52,250.00\t₹ 0.00\t₹ 0.00\t100.00%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
11-07-2026\tSP372\tDeenadaylan\tMedavakkam\t\t\t9/501 4 th cross street, Sivagami, Medavakkam. 600 100\t3\t₹ 2,00,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 85,000.00\t₹ 1,15,000.00\t₹ 17,771.00\t91.11%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
11-07-2026\tSP373\tThavaseelan\tMadhavaram\t\t\t33, 4th cross street, Af Block, Madhavaram, Chennai-600060\t3\t₹ 2,12,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,12,000.00\t₹ 0.00\t₹ 36,036.00\t83.00%\tTRUE\tTRUE\tTRUE\tTRUE\tFALSE\tTRUE\t17%\t83%
11-07-2026\tSP374\tRichard Philip\tSelaiyur\t\t\tNo, K Roja thottam,  5th Street, Prashanthi Colony, Rajakilpakkam Selaiyur Chennai 73\t5\t₹ 3,20,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 3,20,000.00\t₹ 0.00\t₹ 62,658.00\t80.42%\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\tTRUE\t0%\t100%
16-07-2026\tSP375\tRajapandian P\tSanthosapuram\t\t\t83, Sellappa Street Vengaivasal, State : Tamil Nadu Pin Code : 600073\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,80,000.00\t₹ 35,000.00\t₹ 38,834.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
17-07-2026\tSP376\tVignesh Babu V\tMadipakkam\t\t\tPLOT NO 1031 RAM NAGAR SOUTH, 8TH MAIN ROAD, RAM NAGAR, MADIPAKKAM, Madipakkam, Kancheepuram, Tamil Nadu - 600091\t5\t₹ 3,30,000.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,75,000.00\t₹ 1,55,000.00\t₹ 2,46,986.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-07-2026\tSP377\tRaja A\tAmbattur\t\t\tGF- Bindhu Kudil, Balaji Homes, Naganathan Street, Ram Nagar, Ambattur, Thiruvallur Chennai - 600053 \t3\t₹ 2,00,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 50,000.00\t₹ 1,50,000.00\t₹ 36,007.00\t \tTRUE\tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\t67%\t33%
22-07-2026\tSP378\tRenuka S\tMogapair\t\t\t3/493, Pugazhendi Road 5th street, Mogappair East, Chennai - 600037\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 1,10,000.00\t₹ 1,05,000.00\t₹ 35,331.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tTRUE\tFALSE\t67%\t33%
23-07-2026\tSP379\tSumathy P V\tAmbattur\t\t\t#5171 ,9th Street, Ram Nagar North Extension Madipakkam,Chennai 600 091    \t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 1,00,000.00\t₹ 1,15,000.00\t₹ 32,022.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
24-07-2026\tSP380\tR Vedapriya\tTriplicane\t\t\tSTHRI APPT, 46/4, SINGARACHARY ST, TRIPLICANE, OPPT TO FUND KALYANA MANTAPAM, CHENNAI - 600005\t3\t₹ 2,05,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,05,000.00\t₹ 0.00\t₹ 32,208.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tTRUE\tFALSE\t67%\t33%
24-07-2026\tSP381\tN Venkatramani\tTriplicane\t\t\tSTHRI APPT, 46/4, SINGARACHARY ST, TRIPLICANE, OPPT TO FUND KALYANA MANTAPAM, CHENNAI - 600005\t3\t₹ 2,05,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 75,000.00\t₹ 1,30,000.00\t₹ 32,022.00\t \tTRUE\tFALSE\tTRUE\tFALSE\tTRUE\tFALSE\t50%\t50%
24-07-2026\tSP382\tK Vatsal\tTriplicane\t\t\tSTHRI APPT, 46/4, SINGARACHARY ST, TRIPLICANE, OPPT TO FUND KALYANA MANTAPAM, CHENNAI - 600005\t3\t₹ 2,05,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 1,50,000.00\t₹ 55,000.00\t₹ 32,022.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tTRUE\tFALSE\t67%\t33%
25-07-2026\tSP383\tM/s. VB Reality : Swathy College\tNellore\t\t\tV B Realty, E - 25, New No.8, First Floor, 16th Cross Street Besant Nagar, Chennai - 600090\t38\t₹ 13,54,126.00\tCommercial\tOn Gird\tPremier\tInstitutional\tRetailer B2B\tK SATHISH\t₹ 10,00,000.00\t₹ 3,54,126.00\t₹ 14,000.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
25-07-2026\tSP384\tM/s. Saravana Aircon : Saveetha College\tSriperumbatur\t\t\tSaveetha Nagar, Thandalam, Chennai Bengaluru, NH 48, Chennai, Tamil Nadu 602105.\t100\t₹ 28,99,502.00\tCommercial\tOn Gird\tPremier\tInstitutional\tRetailer B2B\tK SATHISH\t₹ 13,00,000.00\t₹ 15,99,502.00\t₹ 25,33,545.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
29-07-2026\tSP385\tGeeta Menon S\tKovilambakkam\t\t\t\t3\t₹ 2,22,600.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,38,600.00\t₹ 84,000.00\t₹ 0.00\t \tTRUE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t83%\t17%
05-08-2026\tSP386\tParthiban \tChrompet\t\t\t11, Rajesh Apartment, Kanni kovil Street, Zamin Rayapet, Chrompet, 600044.\t3\t₹ 2,39,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 0.00\t₹ 2,39,000.00\t₹ 53,154.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
11-08-2026\tSP387\tKarpagavalli Ananthappan\tChrompet\t\t\tW/O: Ananthappan, No 3, 7th Main Road, 3rd Extension, New Colony, Chromepet, Kancheepuram, Tamil Nadu - 600044\t5\t₹ 3,35,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 0.00\t₹ 3,35,000.00\t₹ 60,870.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
11-08-2026\tSP388\tKarpagavalli Ananthappan\tChrompet\t\t\tW/O: Ananthappan, No 3, 7th Main Road, 3rd Extension, New Colony, Chromepet, Kancheepuram, Tamil Nadu - 600044\t3\t₹ 2,35,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 0.00\t₹ 2,35,000.00\t₹ 41,989.00\t\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP389\tKannanswamy\tTriplicane\t\t\tSTHRI APPT, 46/4, SINGARACHARY ST, TRIPLICANE, OPPT TO FUND KALYANA MANTAPAM, CHENNAI - 600005\t5\t₹ 3,20,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 1,50,000.00\t₹ 1,70,000.00\t₹ 54,634.00\t\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP390\tT N Ravi sankar\tAnna Nagar\t\t\tFlat No 6, Golden King's Worth Apartment, 9th Main Road, Anna Nagar, Chennai -600040\t6\t₹ 3,00,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 50,000.00\t₹ 2,50,000.00\t₹ 0.00\t\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP391\tT Rajkumar\tAnna Nagar\t\t\tFlat No 3, Golden King's Worth Apartment, 9th Main Road, Anna Nagar, Chennai -600040\t6\t₹ 3,00,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 50,000.00\t₹ 2,50,000.00\t₹ 0.00\t\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP392\tSathosh KV\tAnna Nagar\t\t\tFlat No 4, Golden King's Worth Apartment, 9th Main Road, Anna Nagar, Chennai -600040\t6\t₹ 2,80,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 50,000.00\t₹ 2,30,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP393\tRavidranath D\tAnna Nagar\t\t\tFlat No 2, Golden King's Worth Apartment, 9th Main Road, Anna Nagar, Chennai -600040\t6\t₹ 3,00,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 50,000.00\t₹ 2,50,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP394\tTony Edwin\tAnna Nagar\t\t\tFlat No 5, Golden King's Worth Apartment, 9th Main Road, Anna Nagar, Chennai -600040\t3\t₹ 1,75,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 0.00\t₹ 1,75,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-08-2026\tSP395\tP Subramanian\tPoonamalle\t\t\t60, JAMES STREET, Poonamalle, Thiruvallur, 600016\t3\t₹ 2,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 2,25,000.00\t₹ -10,000.00\t₹ 41,307.00\t80.79%\tTRUE\tTRUE\tTRUE\tFALSE\tFALSE\tTRUE\t33%\t67%
21-08-2026\tSP396\tG Sandeep Reddy\tKelambakkam\t\t\tVilla No 601, Alliance Humming Garden Phase 2, Chennai, Kelambakkam, Kelambakkam, Kancheepuram, Tamil Nadu, 603103\t3\t₹ 2,19,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,23,200.00\t₹ 95,800.00\t₹ 24,426.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
26-08-2026\tSP397\tGaneshan\tKovur\t\t\t113, 8th Cross Strret, Samayapuram, Irandamkattalai, Kovur, Kancheepuram Tamil Nadu - 600122\t3\t₹ 2,10,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 0.00\t₹ 2,10,000.00\t₹ 44,423.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
26-08-2026\tSP398\tGaneshan\tKovur\t\t\t113, 8th Cross Strret, Samayapuram, Irandamkattalai, Kovur, Kancheepuram Tamil Nadu - 600122\t5\t₹ 3,04,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 0.00\t₹ 3,04,000.00\t₹ 51,043.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
27-08-2026\tSP399\tAravind\tSelaiyur\t+91 94439 30870\taravindisiceskater@gmail.com\tP.NO.138, 4TH STREET, PADMAVATHY NAGAR EXTENSION, MADAMBAKKAM, SELAIYUR, CHENNAI - 600126.\t5\t₹ 3,29,608.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tS KARTHIKEYAN\t₹ 1,00,000.00\t₹ 2,29,608.00\t₹ 53,808.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
28-08-2026\tSP400\tHarsha Sathasivam\tPerungudi\t\t\t23, Perumal Mudali Street, Kondithope, Chennai - 600001\t5\t₹ 3,35,000.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tV SHARATH\t₹ 2,10,000.00\t₹ 1,25,000.00\t₹ 2,17,858.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
01-09-2026\tSP401\tKarthik\tPerungudi\t89252 88853\t\tSakshaasset Holdings, 103A, Erikarai Street, Perungudy\t6\t₹ 2,28,690.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tV SHARATH\t₹ 1,35,000.00\t₹ 93,690.00\t₹ 93,433.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
02-09-2026\tSP402\tSrinath\tMinjur\t\t\t\t5\t₹ 3,18,000.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tK KARTHIKEYAN\t₹ 0.00\t₹ 3,18,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
02-09-2026\tSP403\tPrabakhar\tPadapai\t\t\tVilla No. 192 Casagrand Platinum,Vandalur WALAJABAD MAIN ROAD Padappai chennai 601301\t5\t₹ 2,68,776.00\tResidential\tOn Gird\tWaaree \tIndividual \tB2C\tV SHARATH\t₹ 2,40,000.00\t₹ 28,776.00\t₹ 1,81,927.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
05-09-2026\tSP404\tNadarajan\tAnagaputhur\t\t\t\t3\t₹ 1,75,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tSOUNDARARAJAN M\t₹ 65,000.00\t₹ 1,10,000.00\t₹ 1,274.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
05-09-2026\tSP405\tMegala\tPoonamalle\t\t\t884, Tahamarai Street, AnbuArasu Nagar, Nazarathpettai, Thiruvallur\t3\t₹ 2,25,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 75,000.00\t₹ 1,50,000.00\t₹ 15,930.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
10-09-2026\tSP406\tSaraswathi Electricals\tMadambakkam\t\t\t\t6\t₹ 2,76,360.00\tResidential\tOn Gird\t\tCompany\tRetailer B2B\tK SATHISH\t₹ 1,00,000.00\t₹ 1,76,360.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
16-09-2026\tSP407\tSrinivasan\tMangadu\t9710759994\t\t28B/29  Deekshita Nivas, Vinayakar Kovil Street,  Senthamil Nagar, Mangadu, Sriperumbudur, Kancheepuram, Tamil nadu - 600122\t3\t₹ 2,25,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK KARTHIKEYAN\t₹ 1,15,000.00\t₹ 1,10,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
16-09-2026\tSP408\tSuresh\tArumbakkam\t\t\t\t3\t₹ 2,50,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tV SHARATH\t₹ 1,00,000.00\t₹ 1,50,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-09-2026\tSP409\tMalini Gururajan\tMadipakkkam\t\t\t\t5\t₹ 3,15,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 25,000.00\t₹ 2,90,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%
17-09-2026\tSP410\tSaravana Aircon\t\t\t\t\t3\t₹ 2,50,000.00\tResidential\tOn Gird\tTata SPG Order\tIndividual \tB2C\tK SATHISH\t₹ 0.00\t₹ 2,50,000.00\t₹ 0.00\t \tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t100%\t0%`;

function cleanNumber(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = str.replace(/[₹,\s]/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split('-');
  if (parts.length === 3) {
    // DD-MM-YYYY -> YYYY-MM-DD
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return str;
}

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  return val.trim().toUpperCase() === 'TRUE';
}

const lines = rawTsv.trim().split('\n');
const header = lines[0].split('\t').map(h => h.trim());
console.log('Headers count:', header.length);

const parsedProjects = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const cols = line.split('\t');

  const awardedDateRaw = cols[0] || '';
  const siteId = (cols[1] || '').trim();
  const clientName = (cols[2] || '').trim();
  const location = (cols[3] || '').trim();
  const contactNo = (cols[4] || '').trim();
  const emailId = (cols[5] || '').trim();
  const address = (cols[6] || '').trim();
  const siteCapacity = (cols[7] || '').trim() ? `${(cols[7] || '').trim()} kW` : '';
  const siteValue = cleanNumber(cols[8]);
  const siteType = (cols[9] || 'Commercial').trim();
  const systemType = (cols[10] || 'Waaree').trim();
  const siteCategory = (cols[11] || 'Rooftop').trim();
  const clientType = (cols[12] || 'Company').trim();
  const saleType = (cols[13] || 'B2C').trim();
  const orderBy = (cols[14] || '').trim();
  const received = cleanNumber(cols[15]);
  const due = cleanNumber(cols[16]);
  const siteExpenses = cleanNumber(cols[17]);
  const materialsSupply = parseBool(cols[19]);
  const installation = parseBool(cols[20]);
  const ebProcess = parseBool(cols[21]);
  const documents = parseBool(cols[22]);
  const warranty = parseBool(cols[23]);
  const handedOver = parseBool(cols[24]);

  parsedProjects.push({
    awardedDate: parseDate(awardedDateRaw),
    siteId,
    clientName,
    location,
    contactNo,
    emailId,
    address,
    siteCapacity,
    siteValue,
    siteType,
    systemType,
    siteCategory,
    clientType,
    saleType,
    orderBy,
    received,
    siteExpenses,
    materialsSupply,
    installation,
    ebProcess,
    documents,
    warranty,
    handedOver
  });
}

console.log('Parsed projects count:', parsedProjects.length);
console.log('First project:', parsedProjects[0]);
console.log('Last project:', parsedProjects[parsedProjects.length - 1]);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const outputPath = path.join(dataDir, 'realProjectData.json');
fs.writeFileSync(outputPath, JSON.stringify(parsedProjects, null, 2), 'utf8');
console.log('Successfully saved real project data to:', outputPath);
