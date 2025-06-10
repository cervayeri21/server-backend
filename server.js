
require("dotenv").config(); // this loads the variables form my mailer.env file
const sendMail = require("./mailer");  // this imports the mailer function

const express = require("express");
const cors = require("cors");

const bodyParser = require("body-parser");
const pool = require("./db");

const app = express(); 
app.use(cors());
app.use(bodyParser.json());

app.post("/submit-billing", async (req, res) => {
    console.log("📩 Received billing data:", req.body); // Debugging log

    const {
        email, firstName, lastName, address, country, zipCode, city, phone, Region,
        payment, cartItems, totalAmount, totalQuantity
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !address || !city || !Region || !zipCode || !country || !payment || cartItems.length === 0) {
        console.error("Missing required fields!", req.body);
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        let customerId;

        // Check if customer already exists
        const existingCustomer = await pool.query(
            `SELECT customer_id FROM customers WHERE email = $1`,
            [email]
        );

        if (existingCustomer.rows.length > 0) {
            // If customer exists, use the existing customer_id
            customerId = existingCustomer.rows[0].customer_id;
            console.log("🔄 Customer already exists, using existing customer_id:", customerId);
        } else {
            // Insert new customer if they do not exist
            const customerResult = await pool.query(
                `INSERT INTO customers (first_name, last_name, email, phone_number, address, city, Region, zip_code, country)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING customer_id`,
                [firstName, lastName, email, phone, address, city, Region, zipCode, country]
            );
            customerId = customerResult.rows[0].customer_id;
            console.log("✅ New customer created with customer_id:", customerId);
        }

        // Insert order info into the orders table
        const orderResult = await pool.query(
            `INSERT INTO orders (customer_id, total_price, total_quantity, payment_method, status)
             VALUES ($1, $2, $3, $4, 'Pending') RETURNING order_id`,
            [customerId, totalAmount, totalQuantity, payment]
        );

        const orderId = orderResult.rows[0].order_id;

        // Insert cart items into the order_items table
        for (const item of cartItems) {
            if (!item.name || !item.quantity || !item.price) {
                console.error("❌ Invalid cart item:", item);
                continue; // Skip invalid items
            }
            await pool.query(
                `INSERT INTO order_items (order_id, product_name, quantity, price)
                 VALUES ($1, $2, $3, $4)`,
                [orderId, item.name, item.quantity, item.price]
            );
        }



        //this function is all about email sending 

        const fs = require('fs');
        const path = require('path');

        // Simple template replacer funtion
        function fillTemplate(template, replacements) {
            return template.replace(/{{(.*?)}}/g, (_, key) => replacements[key.trim()] || '');
        }


        const customerFullName = `${firstName} ${lastName}`;
        const productListHTML = cartItems.map(item => 
            `<li>${item.name} (x${item.quantity}) - ₱${item.price}<li>`).join("");

                //Email template for customer
                const customerEmailHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; background-color: #f9f9f9; margin: 0; padding: 0; }
                        .email-container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 20px; }
                        .header { background-color: #4CAF50; color: #ffffff; padding: 10px 15px; text-align: center; border-radius: 8px 8px 0 0; }
                        .section { padding: 15px; }
                        .order-summary { background-color: #f1f1f1; padding: 10px; border-radius: 4px; margin: 10px 0; }
                        ul { list-style: none; padding: 0; }
                        ul li { margin: 5px 0; }
                        .footer { text-align: center; margin-top: 20px; font-size: 0.9em; color: #888; }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="header">
                            <h1>Order Confirmation</h1>
                        </div>
                        <div class="section">
                            <h2>Hi ${customerFullName},</h2>
                            <p>Thank you for your order! Below are the details:</p>
                        </div>
                        <div class="section">
                            <h3>Your Information:</h3>
                            <p>
                                <strong>Name:</strong> ${firstName} ${lastName}<br>
                                <strong>Email:</strong> ${email}<br>
                                <strong>Phone:</strong> ${phone}<br>
                                <strong>Address:</strong> ${address}, ${city}, ${Region}, ${zipCode}, ${country}
                            </p>
                        </div>
                        <div class="section">
                            <h3>Your Order:</h3>
                            <div class="order-summary">
                                <ul>${productListHTML}</ul>
                                ${item.variation ? `<div class = "item-variation">Variation: ${item.variation}</div>` : ""}
                                <p><strong>Total:</strong> ₱${totalAmount}</p>


                            <div class="footer">
                                <br><p>We'll notify you once the seller confirms your order.</p>
                            </div>
                            </div>
                        </div>

                    </div>
                </body>
                </html>
            `;

        // Email template for seller confirming the order
        const sellerEmailHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; background-color: #f9f9f9; margin: 0; padding: 0; }
                    .email-container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 20px; }
                    .header { background-color: #FF5722; color: #ffffff; padding: 10px 15px; text-align: center; border-radius: 8px 8px 0 0; }
                    .section { padding: 15px; }
                    .order-summary { background-color: #f1f1f1; padding: 10px; border-radius: 4px; margin: 10px 0; }
                    ul { list-style: none; padding: 0; }
                    ul li { margin: 5px 0; }
                    .confirm-button { text-align: center; margin-top: 20px; }
                    .confirm-button a { background-color: #4CAF50; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; font-size: 0.9em; color: #888; }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <h1>New Order Notification</h1>
                    </div>
                    <div class="section">
                        <h2>Customer Details:</h2>
                        <p>
                            <strong>Name:</strong> ${firstName} ${lastName}<br>
                            <strong>Email:</strong> ${email}<br>
                            <strong>Phone:</strong> ${phone}<br>
                            <strong>Address:</strong> ${address}, ${city}, ${Region}, ${zipCode}, ${country}
                        </p>
                    </div>
                    <div class="section">
                        <h3>Order Summary:</h3>
                        <div class="order-summary">
                            <ul>${productListHTML}</ul>
                            ${item.variation ? `<div class = "item-variation">Variation: ${item.variation}</div>` : ""}
                            <p><strong>Total:</strong> ₱${totalAmount}</p>

                        <div class="confirm-button">
                            <br><p><a href="${process.env.BASE_URL}/confirm-order?id=${orderId}">✅ Click here to confirm this order</a></p>
                        </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Thank you for being a valued partner!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // This will send email to the seller

        await sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "🧾 Order Received – Awaiting for Seller Confirmation",
            html: customerEmailHTML,
        });

        // This will send email to the customer
        await sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.SELLER_EMAIL,
            subject: "📬 New Order Received",
            html: sellerEmailHTML,
        });


        // Respond with a success message
        res.json({ success: true, message: "✅ Order submitted successfully!" });

    } catch (err) {
        console.error("Backend Error:", err);
        res.status(500).json({ success: false, message: "Error submitting order" });
    }
});

//This is the function of confirming the order route for the seller

app.get("/confirm-order", async (req, res) => {
    const orderId = req.query.id;
  
    try {
      // Update order status to 'Confirmed'
      await pool.query(`UPDATE orders SET status = 'Confirmed' WHERE order_id = $1`, [orderId]);
  
      // Get customer info
      const orderInfo = await pool.query(`
        SELECT o.total_price, o.total_quantity, c.email, c.first_name, c.last_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.order_id = $1
      `, [orderId]);
  
      const itemsInfo = await pool.query(`
        SELECT product_name, quantity, price FROM order_items WHERE order_id = $1
      `, [orderId]);
  
      const order = orderInfo.rows[0];
      const items = itemsInfo.rows;
      const customerEmail = order.email;
      const customerName = `${order.first_name} ${order.last_name}`;
      const productListHTML = items.map(i =>
        `<li>${i.product_name} (x${i.quantity}) - ₱${i.price}</li>`).join("");
  


        // //  Email to customer about confirmation
        const confirmationEmailHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                    font-family: Arial, sans-serif; 
                    line-height: 1.6; 
                    background-color: #f9f9f9; 
                    margin: 0; padding: 0; 
                    }
                    .email-container {
                    max-width: 600px; 
                    margin: 20px auto; 
                    background: #ffffff; 
                    border-radius: 8px; 
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                    padding: 20px; 
                    }
                    .header { 
                    background-color: #4CAF50; 
                    color: #ffffff; 
                    padding: 10px 15px; 
                    text-align: center; 
                    border-radius: 8px 8px 0 0; 
                    }
                    .section { 
                    padding: 15px; 
                    }
                    .order-summary { 
                    background-color: #f1f1f1; 
                    padding: 10px; 
                    border-radius: 4px; margin: 10px 0; 
                    }
                    ul { 
                    list-style: none; padding: 0; 
                    }
                    ul li { 
                    margin: 5px 0; 
                    }
                    .footer { 
                    text-align: center; 
                    margin-top: 20px; 
                    font-size: 0.9em; 
                    color: #888; 
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <h1>Order Confirmed</h1>
                    </div>
                    <div class="section">
                        <h2>Hi ${customerName},</h2>
                        <p>Your order has been confirmed by the seller.</p>
                    </div>
                    <div class="section">
                        <h3>Your Order:</h3>
                        <div class="order-summary">
                            <ul>${productListHTML}</ul>
                            ${item.variation ? `<div class = "item-variation">Variation: ${item.variation}</div>` : ""}
                            <p><strong>Total:</strong> ₱${order.total_price}</p>

                        <div class="footer">
                            <p>Please reply to this email with a screenshot or photo of your payment receipt.</p>
                        </div>
                        </div>
                    </div>

                </div>
            </body>
            </html>
        `;

        // Order confirmation sending email
        await sendMail({
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: "✅ Order Confirmed – Send Your Payment Proof",
            html: confirmationEmailHTML
        });


      res.send("✅ Order confirmed and customer notified!");
  
    } catch (err) {
      console.error("Error confirming order:", err);
      res.status(500).send("Failed to confirm order.");
    }
  });

//Function to send the contact inquiry from contact us section
app.post("/submit-contact", async (req, res) => {
    const {name, phone, email, description} = req.body;

    if (!name || !phone || !email || !description) {
        console.error("Missing required fields", req.body);
        return res.status(400).json({success: false, message: "Missing required fields"});
    }

    try {
        await sendMail ({
            to: process.env.SELLER_EMAIL,
            subject: "📬 New contact us submitted",
            html: `
            <h2> New Contact Inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p>${description}</p>`
        });

        //Function to automatic reply to the customer saying that the email is received

        await sendMail({
            to: email,
            subject: "Thank you for contacting Jessy & Co.",
            html: `
            <p>Good Day! ${name},</p>
            <p>Thank you for reaching out to Jessy & Co. We've received your message and will get back to you shortly.</p>
            <p><em>Here's your copy of your message:</em></p>
            <blockquote>${description}</blockquote>
            <br/>
            <p>Best regards, <br/> <strong>Jessy & Co. Team</strong></p>`
        });
        res.status(200).json({success: true, message: "Contact Form Submitted Sucessfully!"});
    }
    catch (err) {
        console.error("Error in contact inquiry form", err);
        res.status(500).json({success: false, message: "Failed to send contact form inquiry"});
    }
});


//function to send service inquiry from service section
app.post("/submit-inquiry", async (req, res) => {
    const {name, phone, email, inquiry, description} = req.body;

    if (!name || !phone || !email || !inquiry || !description) {
        console.error("missing required field", req.body);
        return res.status(400).json({success: false, message: "Missing required fields"});
    }

    try {
        await sendMail ({
            to: process.env.SELLER_EMAIL,
            subject: "📬 New Service inquiry submitted",
            html: `
            <h2> New Service Inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${phone}</p>
            <p><strong>Inquiry:</strong> ${inquiry}</p>
            <p>${description}</p>`
        });

        //function to automatically reply to the customer saying that the inquiry has been received

        await sendMail ({
            to: email,
            subject: "Thank you for inquiring at Jesst & Co.",
            html: `
            <p><strong>Good Day! ${name},</strong></p>
            <p>Thank you for reaching out to Jessy & Co. We've received your message and will get back to you shortly.</p>
            <p><em>Here's your copy of your message:</em></p>
            <blockquote>${description}</blockquote>
            <br/>
            <p>Best regards, <br/> <strong>Jessy & Co. Team</strong></p>`
        });
        res.status(200).json({success: true, message: "Service Inquiry submitted successfully!"});
    }
    catch (err) {
        console.error("Error in service inquiry form", err);
        res.status(500).json({success: false, message: "Failed to submit service inquiry form"});
    }
});


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));