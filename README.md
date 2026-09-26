# Solar Sathlokhar - Project Master Management System

Full-stack Solar Project Management Application built with **Angular**, **Express.js**, and **MySQL with Sequelize ORM**.

## 📌 Project Overview
The **Project Master** module manages end-to-end solar site execution with 27 specialized columns, dynamic financial accounting (Due & Margin), milestone tracking (16.67% per tick), and Excel/PowerBI-style column filters matching the requested configurations.

---


## 📊 27 Columns & Configurations

| # | Field Name | Type | Notes & Formulas |
|---|---|---|---|
| 1 | **Awarded Date** | Date | Project award date |
| 2 | **Site ID** | String | Unique Site Identifier (e.g., `SLK-SOL-101`) |
| 3 | **Client Name** | String | Name of the client / organization |
| 4 | **Location** | String | Project city / state |
| 5 | **Contact No** | String | Client phone / contact number |
| 6 | **Email ID** | String | Client email address |
| 7 | **Address** | Text | Full installation site address |
| 8 | **Site Capacity** | String / Decimal | Capacity (e.g., `50 kW`, `150 kW`, `1 MW`) |
| 9 | **Site Value** | Currency (₹) | Total awarded contract value |
| 10 | **Site Type** | Dropdown | `Commercial`, `Industrial`, `Residential`, `Residential Common` *(Screenshot 1)* |
| 11 | **System Type** | Dropdown | `(Blanks)`, `Other`, `Premier`, `Tata SPG Order`, `Waaree` *(Screenshot 2)* |
| 12 | **Site Category** | String / Select | e.g., `Rooftop`, `Ground Mount`, `Carport Canopy` |
| 13 | **Client Type** | Dropdown | `Company`, `Individual`, `Institutional` *(Screenshot 3)* |
| 14 | **Sale Type** | String / Select | e.g., `Direct Sale`, `CAPEX`, `OPEX`, `RESCO` |
| 15 | **Order By** | Dropdown | `K KARTHIKEYAN`, `K SATHISH`, `S KARTHIKEYAN`, `SOUNDARARAJAN M`, `V SHARATH` *(Screenshot 4)* |
| 16 | **Received** | Currency (₹) | Default 0 / manual now; structured for `Client Payment Ledger` |
| 17 | **Due** | Currency (₹) | **Formula**: `Site Value - Received` |
| 18 | **Site Expenses** | Currency (₹) | Default 0 / manual now; structured for `Expenses Ledger` |
| 19 | **Margin** | Currency (₹) & % | **Formula**: `Site Value - Site Expenses` |
| 20 | **Materials Supply** | Checkbox | Milestone 1 (Contributes 16.67%) |
| 21 | **Installation** | Checkbox | Milestone 2 (Contributes 16.67%) |
| 22 | **EB Process** | Checkbox | Milestone 3 (Contributes 16.67%) |
| 23 | **Docu -ments** | Checkbox | Milestone 4 (Contributes 16.67%) |
| 24 | **Warranty** | Checkbox | Milestone 5 (Contributes 16.67%) |
| 25 | **Handed Over** | Checkbox | Milestone 6 (Contributes 16.67%) |
| 26 | **Work in Process** | Percentage (%) | **Formula**: `100 - Completed %` |
| 27 | **Completed** | Percentage (%) | **Formula**: `Count of checked ticks * 16.67%` (100% when all 6 checked) |

---

## 🚀 How to Run

### 1. Start Express.js Backend Server
```bash
cd server
npm start
```
* Backend runs on **`http://localhost:2000`**
* Uses `.env` credentials to connect to MySQL database **`SolarSathlokhar`**
* Sequelize automatically syncs table **`project_masters`**

### 2. Start Angular Frontend Client
```bash
cd client
npm start
```
* Frontend runs on **`http://localhost:4200`**
* Access the dashboard in your browser to create, edit, filter, and track solar projects.

---

## 🔗 Ledger Architecture Readiness
The backend and frontend are pre-configured to integrate with the upcoming ledger tables:
- **`Client Payment Ledger`**: Will sum payment receipts for each `site_id` to populate `Received`.
- **`Expenses Ledger`**: Will sum expense vouchers for each `site_id` to populate `Site Expenses`.
- Due and Margin automatically recompute upon any ledger ledger transaction.
