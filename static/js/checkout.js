/**
 * Checkout Page JavaScript
 * - Address selection, payment method, form interactions
 * - Dynamic button text: "Place Order" (COD) / "Pay & Place Order" (Razorpay)
 * - Razorpay inline: create order -> open popup -> verify -> redirect success
 * - Pincode validation with Shiprocket for shipping rates and open box availability
 */

document.addEventListener('DOMContentLoaded', function() {
    initAddressSelection();
    initPaymentSelection();
    initPaymentButtonText();
    initAddressToggle();
    initCheckoutRemoveItems();
    initCheckoutSubmit();
    initPincodeValidation();
});

// ==================== PINCODE VALIDATION ====================
function initPincodeValidation() {
    const pincodeInput = document.getElementById('id_pincode');
    const checkPincodeBtn = document.getElementById('checkPincodeBtn');
    const pincodeStatus = document.getElementById('pincodeStatus');
    const shippingInfo = document.getElementById('shippingInfo');
    const openBoxContainer = document.getElementById('openBoxContainer');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const checkoutForm = document.getElementById('checkoutForm');
    
    if (!pincodeInput || !checkPincodeBtn) return;
    
    // Auto-check if pincode already exists (from session)
    if (pincodeInput.value && pincodeInput.value.length === 6) {
        checkPincode(pincodeInput.value);
    }
    
    checkPincodeBtn.addEventListener('click', function() {
        const pincode = pincodeInput.value.trim();
        checkPincode(pincode);
    });
    
    pincodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkPincode(pincodeInput.value.trim());
        }
    });

    // Add pincode to form validation on submit
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', function(e) {
            const pincode = pincodeInput.value.trim();
            const isValid = validatePincodeBeforeSubmit(pincode);
            if (!isValid) {
                e.preventDefault();
                pincodeInput.focus();
            }
        });
    }
    
    function validatePincodeBeforeSubmit(pincode) {
        if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
            showPincodeError('Please enter a valid 6-digit pincode');
            return false;
        }
        
        const storedPincode = pincodeInput.dataset.verified || '';
        if (storedPincode !== pincode) {
            showPincodeError('Please verify your pincode first');
            return false;
        }
        
        return true;
    }
    
    function checkPincode(pincode) {
        // Validate format
        if (!pincode || pincode.length !== 6 || !/^\d+$/.test(pincode)) {
            showPincodeError('Please enter a valid 6-digit pincode');
            return;
        }
        
        // Show loading
        checkPincodeBtn.disabled = true;
        checkPincodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        pincodeStatus.innerHTML = '<span class="text-warning">Checking pincode...</span>';
        if (shippingInfo) shippingInfo.style.display = 'none';
        
        // Get CSRF token
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        
        fetch('/check-pincode/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({ pincode: pincode })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.is_serviceable) {
                    showPincodeSuccess('✓ Delivery available to this pincode');
                    pincodeInput.dataset.verified = pincode;
                    updateShippingInfo(data);
                    
                    // Enable place order button
                    if (placeOrderBtn) placeOrderBtn.disabled = false;
                    
                    // Update open box availability
                    updateOpenBoxAvailability(data);
                } else {
                    showPincodeError('✗ Delivery not available to this pincode');
                    if (placeOrderBtn) placeOrderBtn.disabled = true;
                    if (shippingInfo) shippingInfo.style.display = 'none';
                    pincodeInput.dataset.verified = '';
                }
            } else {
                showPincodeError(data.error || 'Failed to check pincode');
                if (placeOrderBtn) placeOrderBtn.disabled = true;
                pincodeInput.dataset.verified = '';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showPincodeError('Network error. Please try again.');
            if (placeOrderBtn) placeOrderBtn.disabled = true;
            pincodeInput.dataset.verified = '';
        })
        .finally(() => {
            checkPincodeBtn.disabled = false;
            checkPincodeBtn.innerHTML = 'Check';
        });
    }
    
    function updateOpenBoxAvailability(data) {
        const openBoxCheckbox = document.getElementById('id_is_open_box');
        const openBoxWarning = document.getElementById('openBoxWarning');
        const openBoxContainer = document.getElementById('openBoxContainer');
        
        if (!openBoxCheckbox || !openBoxContainer) return;
        
        if (!data.open_box_supported) {
            openBoxCheckbox.disabled = true;
            openBoxCheckbox.checked = false;
            
            if (!openBoxWarning) {
                // Create warning element if it doesn't exist
                const warning = document.createElement('div');
                warning.id = 'openBoxWarning';
                warning.className = 'text-sm text-warning mt-1';
                warning.innerHTML = '⚠ Open box delivery not available for this pincode';
                openBoxContainer.appendChild(warning);
            } else {
                openBoxWarning.style.display = 'block';
                openBoxWarning.innerHTML = '⚠ Open box delivery not available for this pincode';
            }
            
            // Add disabled class to label
            const label = openBoxCheckbox.closest('label');
            if (label) label.classList.add('opacity-50');
        } else {
            openBoxCheckbox.disabled = false;
            if (openBoxWarning) {
                openBoxWarning.style.display = 'none';
            }
            
            // Remove disabled class from label
            const label = openBoxCheckbox.closest('label');
            if (label) label.classList.remove('opacity-50');
        }
    }
    
    function showPincodeError(message) {
        if (pincodeStatus) {
            pincodeStatus.innerHTML = `<span class="text-danger">${message}</span>`;
        }
    }
    
    function showPincodeSuccess(message) {
        if (pincodeStatus) {
            pincodeStatus.innerHTML = `<span class="text-success">${message}</span>`;
        }
    }
    
    function updateShippingInfo(data) {
        if (!shippingInfo) return;
        
        const shippingCharge = data.shipping_charge || 0;
        const codCharge = data.cod_charge || 0;
        
        let html = `
            <div class="shipping-details p-3 bg-gray-50 rounded">
                <h4 class="font-semibold mb-2">Shipping Details</h4>
                <div class="space-y-2">
        `;
        
        if (data.courier_name) {
            html += `
                <div class="flex justify-between">
                    <span>Courier Partner:</span>
                    <span class="font-medium">${data.courier_name}</span>
                </div>
            `;
        }
        
        if (data.estimated_days) {
            html += `
                <div class="flex justify-between">
                    <span>Estimated Delivery:</span>
                    <span class="font-medium">${data.estimated_days} days</span>
                </div>
            `;
        }
        
        html += `
                <div class="flex justify-between border-t pt-2 mt-2">
                    <span>Shipping Charge:</span>
                    <span class="font-bold">₹${shippingCharge}</span>
                </div>
        `;
        
        if (codCharge > 0) {
            html += `
                <div class="flex justify-between text-warning">
                    <span>COD Charge:</span>
                    <span class="font-bold">₹${codCharge}</span>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        // Show available couriers if multiple
        if (data.available_couriers && data.available_couriers.length > 1) {
            html += `
                <div class="mt-3">
                    <p class="text-sm font-semibold mb-1">Other available couriers:</p>
                    <ul class="text-sm text-gray-600 space-y-1">
            `;
            
            data.available_couriers.slice(1).forEach(courier => {
                html += `
                    <li class="flex justify-between">
                        <span>${courier.courier_name}</span>
                        <span>₹${courier.freight_charge} (${courier.estimated_delivery_days} days)</span>
                    </li>
                `;
            });
            
            html += `</ul></div>`;
        }
        
        shippingInfo.innerHTML = html;
        shippingInfo.style.display = 'block';
        
        // Update total display
        updateTotalDisplay(shippingCharge, codCharge);
        document.dispatchEvent(new Event('shippingRatesUpdated'));
    }
    
    function updateTotalDisplay(shipping, cod) {
        // Get subtotal from DOM
        const subtotalEl = document.getElementById('subtotal-value') || document.querySelector('[data-subtotal]');
        const totalEl = document.getElementById('total-value') || document.querySelector('[data-total]');
        const subtotalAmount = document.getElementById('subtotal-amount');
        const totalAmount = document.getElementById('total-amount');
        
        // Try multiple possible selectors
        let subtotal = 0;
        if (subtotalEl) {
            subtotal = parseFloat(subtotalEl.dataset.value || subtotalEl.textContent.replace(/[^0-9.]/g, '')) || 0;
        } else if (subtotalAmount) {
            subtotal = parseFloat(subtotalAmount.dataset.value || subtotalAmount.textContent.replace(/[^0-9.]/g, '')) || 0;
        }
        
        const newTotal = subtotal + shipping + cod;
        
        // Update total display
        if (totalEl) {
            totalEl.textContent = '₹' + newTotal.toFixed(2);
            if (totalEl.dataset) totalEl.dataset.value = newTotal;
        }
        if (totalAmount) {
            totalAmount.textContent = '₹' + newTotal.toFixed(2);
            if (totalAmount.dataset) totalAmount.dataset.value = newTotal;
        }
        
        // Update hidden fields if they exist
        const shippingHidden = document.getElementById('shipping_charge');
        const codHidden = document.getElementById('cod_charge');
        
        if (shippingHidden) shippingHidden.value = shipping;
        if (codHidden) codHidden.value = cod;
    }
}

// ==================== ADDRESS SELECTION ====================
function initAddressSelection() {
    const addressRadios = document.querySelectorAll('input[name="address_selection"]');
    const selectedAddressInput = document.getElementById('id_selected_address');
    const useNewAddressInput = document.getElementById('id_use_new_address');

    if (!addressRadios.length) return;

    addressRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.address-card.selectable').forEach(card => {
                card.classList.remove('selected');
            });
            const card = this.closest('.address-card');
            if (card) card.classList.add('selected');
            
            if (selectedAddressInput) selectedAddressInput.value = this.value;
            if (useNewAddressInput) useNewAddressInput.value = 'false';
            
            // Populate address fields for display (optional)
            populateAddressFields(card);
        });
    });
}

function populateAddressFields(card) {
    if (!card) return;
    
    const fullName = card.querySelector('[data-full-name]')?.textContent;
    const phone = card.querySelector('[data-phone]')?.textContent;
    const address = card.querySelector('[data-address]')?.textContent;
    const city = card.querySelector('[data-city]')?.textContent;
    const state = card.querySelector('[data-state]')?.textContent;
    const pincode = card.querySelector('[data-pincode]')?.textContent;
    
    // Update hidden preview fields if they exist
    const previewName = document.getElementById('addressPreviewName');
    const previewPhone = document.getElementById('addressPreviewPhone');
    const previewAddress = document.getElementById('addressPreviewAddress');
    
    if (previewName) previewName.textContent = fullName;
    if (previewPhone) previewPhone.textContent = phone;
    if (previewAddress) {
        previewAddress.innerHTML = `${address}, ${city}, ${state} - ${pincode}`;
    }
}

// ==================== PAYMENT METHODS ====================
function initPaymentSelection() {
    var paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    var paymentHidden = document.getElementById('id_payment');

    paymentRadios.forEach(function(radio) {
        if (radio.checked && paymentHidden) paymentHidden.value = radio.value;
        
        radio.addEventListener('change', function() {
            document.querySelectorAll('.payment-option').forEach(function(opt) {
                opt.classList.remove('selected');
            });
            const option = this.closest('.payment-option');
            if (option) option.classList.add('selected');
            
            if (paymentHidden) paymentHidden.value = this.value;
            updatePlaceOrderButtonText();
            
            // Update COD charge display if pincode is verified
            updateCODChargeDisplay();
        });
    });

    var checked = document.querySelector('input[name="payment_method"]:checked');
    if (!checked && paymentRadios.length) {
        paymentRadios[0].checked = true;
        const option = paymentRadios[0].closest('.payment-option');
        if (option) option.classList.add('selected');
        if (paymentHidden) paymentHidden.value = 'cod';
    }
    updatePlaceOrderButtonText();
}

function updateCODChargeDisplay() {
    const paymentMethod = getSelectedPaymentMethod();
    const codChargeEl = document.getElementById('codChargeDisplay');
    const codChargeInput = document.getElementById('cod_charge');
    
    if (paymentMethod === 'cod' && codChargeInput && codChargeEl) {
        const codCharge = parseFloat(codChargeInput.value) || 0;
        if (codCharge > 0) {
            codChargeEl.textContent = `+ ₹${codCharge} COD charges apply`;
            codChargeEl.style.display = 'block';
        } else {
            codChargeEl.style.display = 'none';
        }
    } else if (codChargeEl) {
        codChargeEl.style.display = 'none';
    }
}

// ==================== FORM SUBMISSION ====================
function initCheckoutSubmit() {
    var form = document.getElementById('checkoutForm');
    var placeOrderBtn = document.getElementById('placeOrderBtn');
    if (!form || !placeOrderBtn) return;

    form.addEventListener('submit', function(e) {
        syncAddressToHidden();
        syncPaymentToHidden();

        var payment = getSelectedPaymentMethod();
        if (payment === 'razorpay') {
            e.preventDefault();
            handleRazorpaySubmit();
            return;
        }
        
        // COD: allow default form submit; disable button to prevent double submit
        placeOrderBtn.disabled = true;
        var btnText = document.getElementById('placeOrderBtnText');
        if (btnText) btnText.textContent = 'Placing Order…';
    });
}

function getSelectedPaymentMethod() {
    var radio = document.querySelector('input[name="payment_method"]:checked');
    return radio ? radio.value : 'cod';
}

function syncPaymentToHidden() {
    var payment = getSelectedPaymentMethod();
    var hidden = document.getElementById('id_payment');
    if (hidden) hidden.value = payment;
}

function syncAddressToHidden() {
    var form = document.getElementById('checkoutForm');
    if (!form) return;
    
    var addr = form.querySelector('input[name="address_selection"]:checked');
    var sel = form.querySelector('input[name="selected_address"]');
    var useNew = form.querySelector('input[name="use_new_address"]');
    
    if (addr && sel) {
        sel.value = addr.value;
        if (useNew) useNew.value = '';
    } else if (useNew) {
        useNew.value = 'true';
    }
}

function initPaymentButtonText() {
    updatePlaceOrderButtonText();
}

function updatePlaceOrderButtonText() {
    var btnText = document.getElementById('placeOrderBtnText');
    if (!btnText) return;
    var payment = getSelectedPaymentMethod();
    btnText.textContent = payment === 'razorpay' ? 'Pay & Place Order' : 'Place Order';
}

// ==================== ADDRESS TOGGLE ====================
function initAddressToggle() {
    const addNewBtn = document.getElementById('addNewAddressBtn');
    const cancelNewBtn = document.getElementById('cancelNewAddressBtn');
    const savedAddressesSection = document.getElementById('savedAddresses');
    const newAddressSection = document.getElementById('newAddressSection');
    const selectedAddressInput = document.getElementById('id_selected_address');
    const useNewAddressInput = document.getElementById('id_use_new_address');

    if (addNewBtn) {
        addNewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (savedAddressesSection) savedAddressesSection.style.display = 'none';
            if (newAddressSection) newAddressSection.style.display = 'block';
            if (selectedAddressInput) selectedAddressInput.value = '';
            if (useNewAddressInput) useNewAddressInput.value = 'true';
            
            document.querySelectorAll('input[name="address_selection"]').forEach(r => { r.checked = false; });
            document.querySelectorAll('.address-card.selectable').forEach(c => c.classList.remove('selected'));
            
            if (newAddressSection) {
                newAddressSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    if (cancelNewBtn) {
        cancelNewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (savedAddressesSection) savedAddressesSection.style.display = 'grid';
            if (newAddressSection) newAddressSection.style.display = 'none';
            
            var defaultRadio = document.querySelector('input[name="address_selection"]:checked') ||
                document.querySelector('input[name="address_selection"]');
            
            if (defaultRadio) {
                defaultRadio.checked = true;
                const card = defaultRadio.closest('.address-card');
                if (card) card.classList.add('selected');
                if (selectedAddressInput) selectedAddressInput.value = defaultRadio.value;
                populateAddressFields(card);
            }
            
            if (useNewAddressInput) useNewAddressInput.value = 'false';
            clearNewAddressForm();
            
            if (savedAddressesSection) {
                savedAddressesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

function clearNewAddressForm() {
    var form = document.getElementById('checkoutForm');
    if (!form) return;
    
    ['full_name', 'phone', 'address_line', 'city', 'state', 'pincode', 'email'].forEach(function(name) {
        var field = form.querySelector('[name="' + name + '"]');
        if (field) field.value = '';
    });
    
    form.querySelectorAll('.form-error').forEach(function(el) { 
        el.textContent = ''; 
    });
}

// ==================== CART ITEM REMOVAL ====================
function initCheckoutRemoveItems() {
    document.querySelectorAll('.checkout-remove-form').forEach(function(form) {
        form.addEventListener('submit', function(e) {
            var msg = form.getAttribute('data-confirm');
            if (msg && !window.confirm(msg)) {
                e.preventDefault();
            }
        });
    });
}

// ==================== RAZORPAY INTEGRATION ====================
function handleRazorpaySubmit() {
    var form = document.getElementById('checkoutForm');
    var btn = document.getElementById('placeOrderBtn');
    var btnText = document.getElementById('placeOrderBtnText');
    var errDiv = document.getElementById('checkoutErrorMessage');
    var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
    
    if (!form || !btn || !csrfToken) return;

    syncAddressToHidden();
    syncPaymentToHidden();

    btn.disabled = true;
    if (btnText) btnText.textContent = 'Loading…';
    if (errDiv) {
        errDiv.style.display = 'none';
        errDiv.textContent = '';
    }

    var formData = new FormData(form);
    formData.set('payment', 'razorpay');

    fetch(form.getAttribute('data-razorpay-create-url') || '/checkout/create-razorpay-order/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken.value,
            'Accept': 'application/json',
        },
        body: formData,
    })
    .then(function(res) { 
        return res.json().then(function(data) { 
            return { ok: res.ok, data: data }; 
        }); 
    })
    .then(function(result) {
        if (result.ok && result.data.status === 'success') {
            openRazorpayPopup(result.data);
        } else {
            showCheckoutError(result.data.message || 'Could not create order. Please try again.');
            reenablePlaceOrderButton();
        }
    })
    .catch(function(error) {
        console.error('Razorpay error:', error);
        showCheckoutError('Network error. Please try again.');
        reenablePlaceOrderButton();
    });
}

function showCheckoutError(message) {
    var errDiv = document.getElementById('checkoutErrorMessage');
    if (errDiv) {
        errDiv.textContent = message;
        errDiv.style.display = 'block';
        errDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function reenablePlaceOrderButton() {
    var btn = document.getElementById('placeOrderBtn');
    var btnText = document.getElementById('placeOrderBtnText');
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = getSelectedPaymentMethod() === 'razorpay' ? 'Pay & Place Order' : 'Place Order';
}

function openRazorpayPopup(data) {
    var btn = document.getElementById('placeOrderBtn');
    var btnText = document.getElementById('placeOrderBtnText');
    if (btnText) btnText.textContent = 'Pay & Place Order';

    if (typeof Razorpay === 'undefined') {
        showCheckoutError('Payment script failed to load. Please refresh and try again.');
        reenablePlaceOrderButton();
        return;
    }

    var verifyUrl = (typeof window.STORE_RAZORPAY_VERIFY_URL !== 'undefined')
        ? window.STORE_RAZORPAY_VERIFY_URL
        : '/payment/razorpay/verify/';
    var cancelUrl = (typeof window.STORE_RAZORPAY_CANCEL_URL !== 'undefined')
        ? window.STORE_RAZORPAY_CANCEL_URL
        : '/payment/razorpay/cancel/';
    var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
    var csrf = csrfToken ? csrfToken.value : '';

    var options = {
        key: data.razorpay_key_id,
        amount: data.amount,
        currency: 'INR',
        order_id: data.razorpay_order_id,
        name: 'Hello Gads',
        description: 'Order #' + data.order_number,
        prefill: {
            name: data.customer_name || '',
            email: data.customer_email || '',
            contact: data.customer_phone || '',
        },
        handler: function(response) {
            verifyPayment(response, data.razorpay_order_id, verifyUrl, csrf, data.success_url);
        },
        modal: {
            ondismiss: function() {
                cancelPayment(data.order_number, cancelUrl, csrf);
                reenablePlaceOrderButton();
            },
        },
    };

    var rzp = new Razorpay(options);
    rzp.open();
}

function verifyPayment(response, razorpayOrderId, verifyUrl, csrf, successUrl) {
    var btn = document.getElementById('placeOrderBtn');
    var btnText = document.getElementById('placeOrderBtnText');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Verifying…';

    fetch(verifyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
        }),
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.status === 'success' && (data.redirect || data.order_number)) {
            window.location.href = data.redirect || ('/orders/' + data.order_number + '/');
        } else {
            showCheckoutError(data.message || 'Payment verification failed.');
            reenablePlaceOrderButton();
        }
    })
    .catch(function() {
        showCheckoutError('Verification failed. Please contact support if amount was deducted.');
        reenablePlaceOrderButton();
    });
}

function cancelPayment(orderNumber, cancelUrl, csrf) {
    fetch(cancelUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
        },
        body: JSON.stringify({ order_number: orderNumber }),
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.redirect) {
            window.location.href = data.redirect;
        }
    })
    .catch(function() {
        window.location.href = '/cart/';
    });
}