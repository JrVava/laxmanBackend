const { query } = require("../db");
const moment = require('moment');

const createBilling = async (req, res) => {
    const { title, customer_name, location, items, billing_date, tax, packing, total_tax } = req.body;
    
    // Validate request body
    if (!title || !customer_name || !location || !billing_date || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Title, customer information, location, billing date, and items are required" });
    }

    try {
        // Start a transaction
        await query('START TRANSACTION');

        // Insert the customer
        const customerValues = [
            title,
            customer_name,
            location,
            new Date(),
            new Date()
        ];

        const customerResult = await query(
            'INSERT INTO customers (title, customer_name, location, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            customerValues
        );
        const customerId = customerResult.insertId; // Get the inserted customer ID

        // Insert billing items
        const itemValues = items.map(item => [
            customerId,
            item.description,
            parseFloat(item.qty),
            parseFloat(item.rate),
            item.unit,
            // parseFloat(item.amount),
            new Date(),
            new Date()
        ]);
        const billingResult = await query(
            'INSERT INTO billings (customer_id, description, qty, rate, unit, created_at, updated_at) VALUES ?',
            [itemValues]
        );

        // Ensure we have the correct billing_id
        const billingId = billingResult.insertId;

        // Calculate totals for billing details
        const totalAmount = itemValues.reduce((acc, item) => acc + (item[2] * item[3]), 0); // Sum of amounts (qty * rate)
        const totalTax = parseFloat(total_tax || 0);
        const packaging = parseFloat(packing || 0);
        const grandTotal = totalAmount + totalTax + packaging;

        // Format the billing date
        const formattedBillingDate = moment(billing_date).format('YYYY-MM-DD');
        // const formattedBillingDate = new Date(billing_date).toISOString().split('T')[0];

        // Insert billing details
        const billingDetailsValues = [
            billingId,
            parseFloat(grandTotal.toFixed(2)),
            parseFloat(totalTax.toFixed(2)),
            parseFloat(packaging.toFixed(2)),
            parseFloat(totalAmount.toFixed(2)), // Adding the total column
            formattedBillingDate,
            new Date(),
            new Date(),
            customerId
        ];

        
        await query(
            'INSERT INTO billing_details (billing_id, grand_total, tax, packaging, total, billing_date, created_at, updated_at,customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            billingDetailsValues
        );

        // Commit the transaction
        await query('COMMIT');

        res.status(201).json({ message: "Billing has been created." });
    } catch (error) {
        // Rollback the transaction in case of error
        await query('ROLLBACK');
        console.error('Database Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


const getBillings = async (req, res) => {
    try {
        // Fetch billing details information with associated customer data
        const billingDetailsResponse = await query(`
            SELECT
                bd.id AS billing_detail_id,
                bd.customer_id,
                bd.grand_total,
                bd.tax,
                bd.packaging,
                bd.billing_date,
                bd.created_at AS detail_created_at,
                bd.updated_at AS detail_updated_at,
                c.id AS customer_id,
                c.title AS customer_title,
                c.customer_name,
                c.location
            FROM billing_details bd
            LEFT JOIN customers c ON bd.customer_id = c.id
        `);

        // Fetch billing information
        const billingResponse = await query(`
            SELECT
                b.id AS billing_id,
                b.customer_id,
                b.description AS billing_description,
                b.qty AS billing_qty,
                b.rate AS billing_rate,
                b.amount AS billing_amount,
                b.unit AS billing_unit,
                b.created_at AS billing_created_at,
                b.updated_at AS billing_updated_at
            FROM billings b
        `);

        // Format the response to group items under their respective customer records
        const bills = billingDetailsResponse.map(detail => {
            const customerBillings = billingResponse.filter(bill => bill.customer_id === detail.customer_id).map(bill => ({
                id: bill.billing_id,
                description: bill.billing_description,
                qty: bill.billing_qty,
                rate: bill.billing_rate,
                amount: bill.billing_amount,
                unit: bill.billing_unit,
                created_at: bill.billing_created_at,
                updated_at: bill.billing_updated_at,
            }));

            return {
                customer: {
                    id: detail.customer_id,
                    title: detail.customer_title,
                    name: detail.customer_name,
                    phone: detail.phone,
                    location: detail.location
                },
                billing_detail: {
                    id: detail.billing_detail_id,
                    grand_total: detail.grand_total,
                    tax: detail.tax,
                    packaging: detail.packaging,
                    billing_date: detail.billing_date,
                    created_at: detail.detail_created_at,
                    updated_at: detail.detail_updated_at,
                },
                billings: customerBillings
            };
        });

        res.status(200).json({ bills });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const getBillingDetailsById = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch billing details information with associated customer data by billing detail ID
        const billingDetailsResponse = await query(`
            SELECT
                bd.id AS billing_detail_id,
                bd.customer_id,
                bd.billing_id AS bill_id,
                bd.grand_total,
                bd.tax,
                bd.packaging,
                bd.billing_date,
                bd.created_at AS detail_created_at,
                bd.updated_at AS detail_updated_at,
                c.id AS customer_id,
                c.title AS customer_title,
                c.customer_name,
                c.location
            FROM billing_details bd
            LEFT JOIN customers c ON bd.customer_id = c.id
            WHERE bd.id = ?
        `, [id]);

        if (billingDetailsResponse.length === 0) {
            return res.status(404).json({ error: "Billing detail not found" });
        }
        
        // Fetch billing information using the bill_id from billing_details
        const billingResponse = await query(`
            SELECT
                b.id AS billing_id,
                b.description AS billing_description,
                b.qty AS billing_qty,
                b.rate AS billing_rate,
                b.amount AS billing_amount,
                b.unit AS billing_unit,
                b.customer_id AS customer_id,
                b.created_at AS billing_created_at,
                b.updated_at AS billing_updated_at
            FROM billings b
            WHERE b.customer_id = ?
        `, [billingDetailsResponse[0].customer_id]);

        // Format the response to group items under their respective customer records
        const detail = billingDetailsResponse[0];
        const customerBillings = billingResponse.map(bill => ({
            id: bill.billing_id,
            description: bill.billing_description,
            qty: bill.billing_qty,
            rate: bill.billing_rate,
            amount: bill.billing_amount,
            unit: bill.billing_unit,
            customer_id: bill.customer_id,
            created_at: bill.billing_created_at,
            updated_at: bill.billing_updated_at,
        }));

        const billDetails = {
            customer: {
                id: detail.customer_id,
                title: detail.customer_title,
                name: detail.customer_name,
                phone: detail.phone,
                location: detail.location
            },
            billing_detail: {
                id: detail.billing_detail_id,
                grand_total: detail.grand_total,
                tax: detail.tax,
                packaging: detail.packaging,
                billing_date: detail.billing_date,
                customer_id: detail.customer_id,
                created_at: detail.detail_created_at,
                updated_at: detail.detail_updated_at,
            },
            billings: customerBillings
        };
        res.status(200).json(billDetails);
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const updateBill = async (req, res) => {
    const { id: billingId } = req.params; // Renamed to billingId for clarity
    const { gst, packing, grand_total, billing_date, title, customer_name, location, items, billing_to_delete } = req.body;

    try {
        // Validate required fields
        if (!title || !customer_name || !location || !billing_date || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Title, customer information, location, billing date, and items are required" });
        }

        // Validate billing_to_delete
        const billingToDeleteArray = Array.isArray(billing_to_delete) ? billing_to_delete : [];

        // Start transaction
        await query('START TRANSACTION');

        // Retrieve customer_id from billing_details
        const [billingDetails] = await query(`
            SELECT customer_id FROM billing_details WHERE id = ?
        `, [billingId]);

        if (!billingDetails) {
            await query('ROLLBACK');
            return res.status(404).json({ error: "Billing detail not found" });
        }

        const { customer_id } = billingDetails;

        // Update billing details
        const resultBillingDetails = await query(`
            UPDATE billing_details
            SET grand_total = ?,
                tax = ?,
                packaging = ?,
                billing_date = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [grand_total, gst, packing, billing_date, billingId]);

        if (resultBillingDetails.affectedRows === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ error: "Billing detail not found" });
        }

        // Update customer details
        await query(`
            UPDATE customers
            SET title = ?,
                customer_name = ?,
                location = ?
            WHERE id = ?
        `, [title, customer_name, location, customer_id]);

        // Delete billing items
        if (billingToDeleteArray.length > 0) {
            const deletePlaceholders = billingToDeleteArray.map(() => '?').join(',');
            await query(`
                DELETE FROM billings
                WHERE id IN (${deletePlaceholders})
                AND customer_id = ?
            `, [...billingToDeleteArray, customer_id]);
        }

        // Update or insert billing items
        for (const item of items) {
            const { id: itemId, description, qty, rate, amount, unit } = item;
            if (itemId) {
                // Update existing billing record
                await query(`
                    UPDATE billings
                    SET description = ?,
                        qty = ?,
                        rate = ?,
                        unit = ?,
                        updated_at = NOW()
                    WHERE id = ? AND customer_id = ?
                `, [description, qty, rate, unit, itemId, customer_id]);
            } else {
                // Insert new billing record
                await query(`
                    INSERT INTO billings (description, qty, rate, unit, customer_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                `, [description, qty, rate, unit, customer_id]);
            }
        }

        // Commit transaction
        await query('COMMIT');

        res.status(200).json({ message: "Records updated successfully" });
    } catch (error) {
        console.error('Database Error:', error);
        await query('ROLLBACK');
        res.status(500).json({ error: "Internal Server Error" });
    }
};


const searchBill = async (req, res) => {
    const { customer_name, start_date, end_date } = req.body;
    
    try {
        // Base query for fetching billing details with associated customer data
        let queryStr = `
            SELECT
                bd.id AS billing_detail_id,
                bd.customer_id,
                bd.billing_id AS bill_id,
                bd.grand_total,
                bd.tax,
                bd.packaging,
                bd.billing_date,
                bd.created_at AS detail_created_at,
                bd.updated_at AS detail_updated_at,
                c.id AS customer_id,
                c.title AS customer_title,
                c.customer_name,
                c.location
            FROM billing_details bd
            LEFT JOIN customers c ON bd.customer_id = c.id
            WHERE 1 = 1
        `;

        // Add dynamic filters
        const queryParams = [];

        if (customer_name) {
            queryStr += ' AND c.customer_name = ?';
            queryParams.push(customer_name);
        }

        if (start_date) {
            queryStr += ' AND bd.billing_date >= ?';
            queryParams.push(start_date);
        }

        if (end_date) {
            queryStr += ' AND bd.billing_date <= ?';
            queryParams.push(end_date);
        }

        // Execute the query
        const billingDetailsResponse = await query(queryStr, queryParams);

        if (billingDetailsResponse.length === 0) {
            return res.status(404).json({ error: "Billing detail not found" });
        }

        // Calculate the total grand total for all matching billing details
        const totalGrandTotal = billingDetailsResponse.reduce((acc, detail) => acc + detail.grand_total, 0);

        // Get unique customer IDs from the billing details
        const customerIds = [...new Set(billingDetailsResponse.map(detail => detail.customer_id))];

        // Fetch billing information for all unique customers
        const billingResponse = await query(`
            SELECT
                b.id AS billing_id,
                b.customer_id,
                b.description AS billing_description,
                b.qty AS billing_qty,
                b.rate AS billing_rate,
                b.amount AS billing_amount,
                b.unit AS billing_unit,
                b.created_at AS billing_created_at,
                b.updated_at AS billing_updated_at
            FROM billings b
            WHERE b.customer_id IN (?)
        `, [customerIds]);

        // Format the response to group items under their respective customer records
        const bills = billingDetailsResponse.map(detail => {
            const customerBillings = billingResponse.filter(bill => bill.customer_id === detail.customer_id).map(bill => ({
                id: bill.billing_id,
                description: bill.billing_description,
                qty: bill.billing_qty,
                rate: bill.billing_rate,
                amount: bill.billing_amount,
                unit: bill.billing_unit,
                created_at: bill.billing_created_at,
                updated_at: bill.billing_updated_at,
            }));

            return {
                customer: {
                    id: detail.customer_id,
                    title: detail.customer_title,
                    name: detail.customer_name,
                    location: detail.location
                },
                billing_detail: {
                    id: detail.billing_detail_id,
                    grand_total: detail.grand_total,
                    tax: detail.tax,
                    packaging: detail.packaging,
                    billing_date: detail.billing_date,
                    created_at: detail.detail_created_at,
                    updated_at: detail.detail_updated_at,
                },
                billings: customerBillings
            };
        });

        // Add the total grand total to the response
        const response = {
            totalGrandTotal,
            bills
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}




module.exports = { createBilling, getBillings,getBillingDetailsById,searchBill,updateBill };