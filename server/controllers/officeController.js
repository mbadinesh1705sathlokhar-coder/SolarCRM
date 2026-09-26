const { Employee } = require('../models/Employee');
const { OfficeVendor } = require('../models/OfficeVendor');

// --- EMPLOYEES CRUD ---
async function getAllEmployees(req, res) {
    try {
        const employees = await Employee.findAll({ order: [['id', 'ASC']] });
        res.json({ success: true, data: employees });
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch employees' });
    }
}

async function getEmployeeById(req, res) {
    try {
        const { id } = req.params;
        const employee = await Employee.findByPk(id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        res.json({ success: true, data: employee });
    } catch (err) {
        console.error('Error fetching employee:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch employee' });
    }
}

async function createEmployee(req, res) {
    try {
        const { name, designation, phoneNo, emailId, address, experience, username, password, role, photo, responsibility, accessPermissions } = req.body;
        if (!name || !designation) {
            return res.status(400).json({ success: false, message: 'Name and Designation are required.' });
        }
        const isAdmin = (role === 'admin' || (designation && designation.toLowerCase().includes('admin')));
        const defaultPerms = accessPermissions || (isAdmin 
            ? { canView: true, canAdd: true, canEdit: true, canDelete: true }
            : { canView: true, canAdd: true, canEdit: true, canDelete: false });
        const created = await Employee.create({
            name,
            designation,
            phoneNo: phoneNo || '',
            emailId: emailId || '',
            address: address || '',
            experience: experience || '',
            username: username || (emailId || null),
            password: password || null,
            role: role || 'employee',
            photo: photo || null,
            responsibility: responsibility || 'Sales',
            accessPermissions: defaultPerms
        });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating employee:', err);
        res.status(500).json({ success: false, message: 'Failed to create employee' });
    }
}

async function updateEmployee(req, res) {
    try {
        const { id } = req.params;
        const employee = await Employee.findByPk(id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        await employee.update(req.body);
        res.json({ success: true, data: employee });
    } catch (err) {
        console.error('Error updating employee:', err);
        res.status(500).json({ success: false, message: 'Failed to update employee' });
    }
}

async function deleteEmployee(req, res) {
    try {
        const { id } = req.params;
        const employee = await Employee.findByPk(id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        await employee.destroy();
        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (err) {
        console.error('Error deleting employee:', err);
        res.status(500).json({ success: false, message: 'Failed to delete employee' });
    }
}

// --- OFFICE VENDORS CRUD ---
async function getAllVendors(req, res) {
    try {
        const vendors = await OfficeVendor.findAll({ order: [['vendorName', 'ASC']] });
        res.json({ success: true, data: vendors });
    } catch (err) {
        console.error('Error fetching vendors:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
    }
}

async function createVendor(req, res) {
    try {
        const { vendorName, salesCoordinator, phoneNo, location, materialsSpec, creditDays } = req.body;
        if (!vendorName) {
            return res.status(400).json({ success: false, message: 'Vendor Name is required.' });
        }
        const created = await OfficeVendor.create({
            vendorName,
            salesCoordinator: salesCoordinator || 'Renuka',
            phoneNo: phoneNo || '',
            location: location || '',
            materialsSpec: materialsSpec || '',
            creditDays: creditDays || '30 Days'
        });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating vendor:', err);
        res.status(500).json({ success: false, message: 'Failed to create vendor' });
    }
}

async function updateVendor(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        await vendor.update(req.body);
        res.json({ success: true, data: vendor });
    } catch (err) {
        console.error('Error updating vendor:', err);
        res.status(500).json({ success: false, message: 'Failed to update vendor' });
    }
}

async function deleteVendor(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        await vendor.destroy();
        res.json({ success: true, message: 'Vendor deleted successfully' });
    } catch (err) {
        console.error('Error deleting vendor:', err);
        res.status(500).json({ success: false, message: 'Failed to delete vendor' });
    }
}

// Seed initial employees & vendors if empty
async function seedOfficeIfEmpty() {
    try {
        const empCount = await Employee.count();
        if (empCount === 0) {
            console.log('Seeding initial office employees...');
            await Employee.bulkCreate([
                {
                    name: 'Renuka Devi',
                    designation: 'Senior Sales Coordinator',
                    phoneNo: '+91 98401 55210',
                    emailId: 'renuka@sathlokhar.com',
                    address: 'Anna Nagar, Chennai, Tamil Nadu',
                    experience: '4.5 Years'
                },
                {
                    name: 'Daya Shankar',
                    designation: 'Lead Solar Electrical Engineer',
                    phoneNo: '+91 94440 66321',
                    emailId: 'daya@sathlokhar.com',
                    address: 'Gandhipuram, Coimbatore, Tamil Nadu',
                    experience: '6 Years'
                },
                {
                    name: 'Sharath Kumar',
                    designation: 'Technical Sales Executive',
                    phoneNo: '+91 97910 44102',
                    emailId: 'sharath@sathlokhar.com',
                    address: 'Guindy, Chennai, Tamil Nadu',
                    experience: '3 Years'
                },
                {
                    name: 'Sathish Raja',
                    designation: 'Field Project Manager',
                    phoneNo: '+91 98841 33201',
                    emailId: 'sathish@sathlokhar.com',
                    address: 'Thillai Nagar, Trichy, Tamil Nadu',
                    experience: '5 Years'
                },
                {
                    name: 'K Karthikeyan',
                    designation: 'VP - Operations & Projects',
                    phoneNo: '+91 98402 77890',
                    emailId: 'karthikeyan@sathlokhar.com',
                    address: 'Nungambakkam, Chennai, Tamil Nadu',
                    experience: '12 Years'
                }
            ]);
            console.log('Seeded 5 employees.');
        }

        const vendorCount = await OfficeVendor.count();
        if (vendorCount === 0) {
            console.log('Seeding initial office vendors...');
            const defaultVendorNames = [
                "4M SOLAR SOLUTIONS PRIVATE LIMITED", "AADHI ENTERPRISES", "AIM EVENTS", "AISWARYA POWER CORPORATION",
                "ANIKA ELECTRICALS", "ASHLOK SAFE EARTHING ELECTRODE LTD", "BUHIN ENGINEERS PVT LTD", "CHEMI TECH CONSTRUCTIONS PVT. LTD",
                "DEEKAY ELECTRICALS", "DEZERVE SOLAR INDIA PRIVATE LIMITED", "DK ELECTRO AND INDUSTRIAL SOLUTIONS LLP", "DVR POWER ENGINEERING",
                "EXCEL EARTHING PRIVATE LIMITED", "FESTA SOLAR PRIVATE LIMITED", "FINE LINE ENGINEERS", "FirstView Media Ventures Pvt Ltd",
                "FOMRA ELECTRICALS", "GEESYS TECHNOLOGIES INDIA", "GEMINI SOLARISS", "GLOW POWER TECHNOLOGIES",
                "G-NEXTER ENERGIES", "GRAVIN EARTHING & LIGHTNING PROTECTION", "GREEN ENERGY TRADERS", "GREEN FIELD SOLAR SOLUTION PRIVATE LIMITED",
                "HIMOUNT POWER SUPPORTS", "HIVESOLAR ENERGY", "IDEAL STRCTURES PVT LTD", "INFINITY SOLAR SOLUTION",
                "INFORMA MARKETS INDIA PVT LTD", "INTEGRATED POWER SYSTEMS", "IPOWER ELECTRIC", "JAISOLAR ENERGY MANAGEMENT SYSTEMS",
                "K SUBASH", "KARTHIKEYAN K", "LOYYAL BATTERY SERVICE", "MASIMA AUTOMATION SYSTEMS",
                "MASTER ADDS AND EVENT SERVICE", "METROPOLITAN CIVIL ENGINEERS ASSOCIATION", "OPTIMUM ENERGY SOLAR SYSTEM", "ORBIT SOLAR POWER",
                "POWERPLUS AGENCIES PVT LTD", "R R CONECTICS", "RADIUS SOLAR WORLD", "RAHUL",
                "SARASWATHI ELECTRICAL SOLAR POWER SYSTEMS", "SEYON ENERGY", "SOLAR MOUNTIN SYSTEM SOLUTIONS", "SOLSTROM ENERGY SOLUTION PVT LTD",
                "SOUNDARARAJAN M", "SP DESIGN & ENGINEERING", "SPAGTECH SOLUTIONS", "SREE SWASTIK ENERGY",
                "SS POWER SOLUTIONS", "STREAMTECH ENERGY SOLUTIONS", "SUNAP ECOPOWER PRIVATE LIMITED", "SUNDROPINDIA ENERGY SOLUTIONS",
                "SUNLIT FUTURE", "TATA POWER RENEWABLE ENERGY LIMITED", "TELEGLOBAL NETWORK ENTERPRISES", "TIEMA TEXPO-2026",
                "TOUCH AND GLOW", "TRANSFIX INDIA LIMITED", "TRIWIN SOLUTIONS", "UDAYAJIT SOLAR PRIVATE LIMITED",
                "UNO POWER", "V SHARATH", "VAIRAMANI M", "VARDHAMAN SOLAR SOLUTIONS",
                "VASHI INTEGRATED SOLUTIONS LTD", "VENKATESWARA SUPPLIERS PVT LTD", "VIRIDIS ENGINEERING INDIA PRIVATE LIMITED", "VRM STRUCTURES INDIA PRIVATE LIMITED"
            ];
            await OfficeVendor.bulkCreate(defaultVendorNames.map(name => ({
                vendorName: name,
                salesCoordinator: 'Renuka',
                phoneNo: '',
                location: '',
                materialsSpec: '',
                creditDays: '30 Days'
            })));
            console.log(`Seeded ${defaultVendorNames.length} office vendors.`);
        }
    } catch (err) {
        console.error('Error seeding office data:', err);
    }
}

// --- AUTHENTICATION LOGIN ---
async function loginEmployee(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required.' });
        }
        const trimmedUser = String(username).trim();
        const { Op } = require('sequelize');
        const employee = await Employee.findOne({
            where: {
                [Op.or]: [
                    { username: trimmedUser },
                    { emailId: trimmedUser }
                ]
            }
        });

        if (!employee) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        if (employee.password !== String(password)) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: employee.id,
                name: employee.name,
                designation: employee.designation,
                phoneNo: employee.phoneNo || '',
                emailId: employee.emailId,
                address: employee.address || '',
                experience: employee.experience || '',
                username: employee.username || employee.emailId,
                role: employee.role || 'employee',
                photo: employee.photo || null,
                responsibility: employee.responsibility || 'Sales',
                accessPermissions: employee.accessPermissions || { canView: true, canAdd: true, canEdit: true, canDelete: false }
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error during authentication.' });
    }
}

module.exports = {
    getAllEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    loginEmployee,
    getAllVendors,
    createVendor,
    updateVendor,
    deleteVendor,
    seedOfficeIfEmpty
};
