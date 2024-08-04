const express = require("express");
const router = express.Router();
const { 
    verifyToken
} = require("../middleware/authMiddleware");

const {
    registration,
    login
} = require("../controllers/AuthController");

const {
    createBilling,
    getBillings,
    getBillingDetailsById
    ,searchBill,
    updateBill
} = require("../controllers/BillingController");

router.use([
    "/create-billing",
    "/get-bills",
    "get-bill-by-phone",
    "/search-bill",
    "/update-bill/:id"
],verifyToken)

router.route('/sign-up').post(registration)

router.route('/sign-in').post(login)

router.route('/create-billing').post(createBilling)

router.route('/get-bills').get(getBillings)

router.route("/get-bill/:id").get(getBillingDetailsById);

router.route('/search-bill').post(searchBill);

router.route('/update-bill/:id').put(updateBill);

module.exports = router;