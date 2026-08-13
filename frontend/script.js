//Single point of configuration for the API Gateway address.

const API_BASE = 'http://70.156.229.163:30187';

document.addEventListener('DOMContentLoaded', function() {
    //Dom elements
    const loginForm = document.getElementById('login-form');
    const loginSection = document.getElementById('login-section');
    const adminDashboard = document.getElementById('admin-dashboard');
    const logoutBtn = document.getElementById('logout-btn');
    const calendarEl = document.getElementById('calendar');

    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const registerSection = document.getElementById('register-section');
    const registerForm = document.getElementById('register-form');
    const clientBookingForm = document.getElementById('booking-form');

    //Rest API interction helpers
    //Communicate directly with the API gateway on port 5000

    //Sends a PUT request to update booking status (confirmed, completed, cancelled...)
    async function updateBooking(id, data) {
        try {
            const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                alert('Booking status updated!');
                if (calendar) calendar.refetchEvents();     //Dynamically refresh fullcalender view
            }
        } catch(e) { alert('Error connecting to server.'); }
    }


    //Sends a DELETE request to permanently remove a booking from SQLite Database
    async function deleteBooking(id) {
        try {
            const res = await fetch(`${API_BASE}/api/bookings/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Booking deleted!');
                const detailsCard = document.querySelector('.booking-details-card');
                if (detailsCard) {
                    detailsCard.innerHTML = '<p>Select an appointment on the calendar to manage it.</p>';
                }
                if (calendar) calendar.refetchEvents();         //Refresh calender UI
            }
        } catch(e) { alert('Error connecting to server.'); }
    }

    let selectedDateStr = '';
    const modalEl = document.getElementById('booking-modal');
    const modalForm = document.getElementById('modal-form');
    const cancelBtn = document.getElementById('modal-cancel');
    let calendar = null;

    //Fullcalender integration (admin UI)

    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            //Fetches all bookings via gateway rest API
            events: async function(fetchInfo, successCallback, failureCallback) {
                try {
                    const response = await fetch(`${API_BASE}/api/bookings`);
                    const data = await response.json();
                    
                    //Map raw backend models into full calander-compatible event objects
                    const events = data.map(booking => {

                        //Apply status-based visual color coding
                        let eventColor = '#ffc107'; // Pending - yellow
                        if (booking.status === 'confirmed') eventColor = '#28a745'; //Confirmed - green
                        if (booking.status === 'completed') eventColor = '#007bff'; //Completed - blue
                        if (booking.status === 'cancelled') eventColor = '#dc3545'; //Cancelled - red

                        const timeString = booking.time ? `T${booking.time}` : 'T09:00:00';

                        return {
                            id: booking.id,
                            title: `${booking.client_name} - ${booking.style}`,
                            start: `${booking.date}${timeString}`,
                            color: eventColor,
                            extendedProps: booking
                        };
                    });
                    successCallback(events);
                } catch (error) {
                    console.error("Error fetching bookings:", error);
                    failureCallback(error);
                }
            },

            //Treggired when an artist(admin) clicks an empty calender slot to manually add an appointment
            dateClick: function(info) {
                selectedDateStr = info.dateStr;
                const modalTitle = document.getElementById('modal-title');
                if (modalTitle) modalTitle.innerText = `NEW BOOKING (${selectedDateStr})`;
                
                const nameInput = document.getElementById('modal-client-name');
                const styleInput = document.getElementById('modal-style');
                const placementInput = document.getElementById('modal-placement');
                const notesInput = document.getElementById('modal-notes');
                const timeInput = document.getElementById('modal-time');
                
                if (nameInput) nameInput.value = '';
                if (styleInput) styleInput.value = '';
                if (placementInput) placementInput.value = '';
                if (notesInput) notesInput.value = '';
                if (timeInput) timeInput.value = '14:00';
                if (modalEl) modalEl.style.display = 'flex';
            },

            //Triggered when clicking an existing appointment -> loads management panel
            eventClick: function(info) {
                const props = info.event.extendedProps;
                const panel = document.querySelector('.booking-details-card');
                if (!panel) return;


                //Inject dynamic HTML panel showing booking details and management controls
                panel.innerHTML = `
                    <h4>${props.client_name}</h4>
                    <p><strong>Email:</strong> ${props.client_email}</p>
                    <p><strong>Date:</strong> ${props.date} at ${props.time}</p>
                    <p><strong>Style:</strong> ${props.style}</p>
                    <p><strong>Placement:</strong> ${props.placement}</p>
                    <p><strong>Notes:</strong> "${props.notes}"</p>
                    
                    <div class="status-actions">
                        <label>Update Status:</label>
                        <select class="status-dropdown" id="status-select-${info.event.id}">
                            <option value="pending" ${props.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${props.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="completed" ${props.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${props.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button class="btn btn-red btn-block update-status-btn" data-id="${info.event.id}" style="margin-top: 1rem;">Save Changes</button>
                        <button class="btn btn-outline btn-block delete-btn" data-id="${info.event.id}" style="margin-top: 0.5rem; border-color: #dc3545; color: #dc3545;">Delete Booking</button>
                    </div>
                `;
                //Attach click handler to newly rendered 'Save Changes' button
                const updateBtn = document.querySelector(`.update-status-btn[data-id="${info.event.id}"]`);
                if (updateBtn) {
                    updateBtn.addEventListener('click', async function() {

                        //Read selected status and trigger PUT request to gateway port 5000
                        const newStatus = document.getElementById(`status-select-${info.event.id}`).value;
                        await updateBooking(info.event.id, { status: newStatus });
                    });
                }
                //Attach click handler to newly rendered 'Delete' button
                const deleteBtn = document.querySelector(`.delete-btn[data-id="${info.event.id}"]`);
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async function() {

                        //Confirm deletion before sending DELETE request to gateway port 5000
                        if(confirm("Are you sure you want to permanently delete this booking?")) {
                            await deleteBooking(info.event.id);
                        }
                    });
                }
            }
        });
        window.myCalendar = calendar;
    }

    //Authentication & session persistence
    //Validates local session token expiry state

    const sessionExpires = localStorage.getItem('mariarty_session_expires');
    const now = Date.now() / 1000;

    //Checiking if session exists and is still valid
    if (sessionExpires && now < sessionExpires) {
        const userRole = localStorage.getItem('mariarty_user_role');

        //Auto-render the admin dashboard if active role is "artist"
        if (userRole === 'artist' && loginSection && adminDashboard) {
            loginSection.style.display = 'none';
            adminDashboard.style.display = 'block';
            if (calendar) calendar.render();
        }
    } else {

        //Expired or non-existent session: purge storage variables
        localStorage.removeItem('mariarty_session_expires');
        localStorage.removeItem('mariarty_user_role');
        localStorage.removeItem('mariarty_discount');
    }

    //Modals and client form submission + Handles form data collection for both client and artist booking interfaces
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (modalEl) modalEl.style.display = 'none';
        });
    }

    //Artist(admin) manual appointment creation
    if (modalForm) {
        modalForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newBooking = {
                client_name: document.getElementById('modal-client-name').value,
                client_email: "client@mariarty.com",
                date: selectedDateStr,
                time: document.getElementById('modal-time').value,
                style: document.getElementById('modal-style').value,
                placement: document.getElementById('modal-placement').value,
                notes: document.getElementById('modal-notes').value
            };

            try {
                const res = await fetch(`${API_BASE}/api/bookings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newBooking)
                });
                if (res.ok) {
                    if (modalEl) modalEl.style.display = 'none';
                    if (calendar) calendar.refetchEvents();
                } else {
                    alert('Failed to create booking.');
                }
            } catch (e) {
                alert('Error connecting to server.');
            }
        });
    }

    //Client appointment request
    if (clientBookingForm) {
        clientBookingForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const clientBookingData = {
                client_name: document.getElementById('client-name').value,
                client_email: document.getElementById('client-email').value,
                date: document.getElementById('preferred-date').value,
                time: document.getElementById('preferred-time').value,
                style: 'Custom Tattoo',
                placement: document.getElementById('tattoo-placement').value,
                notes: document.getElementById('tattoo-idea').value
            };

            try {

                //Post payload to Gateway -> Booking service -> Serverless email trigger
                const response = await fetch(`${API_BASE}/api/bookings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clientBookingData)
                });

                if (response.ok) {
                    alert('Appointment requested successfully! The studio will review it.');
                    clientBookingForm.reset();
                    window.location.href = 'index.html';
                } else {
                    alert('Failed to submit booking. Please try again.');
                }
            } catch (error) {
                alert('Cannot connect to gateway (Port 5000). Make sure it is running.');
            }
        });
    }

    //Authentication flow
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (loginSection) loginSection.style.display = 'none';
            if (registerSection) registerSection.style.display = 'block';
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (registerSection) registerSection.style.display = 'none';
            if (loginSection) loginSection.style.display = 'block';
        });
    }

    //User registration event
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const emailInput = registerForm.querySelector('input[type="email"]').value;
            const passwordInput = registerForm.querySelector('input[type="password"]').value;

            try {
                const response = await fetch(`${API_BASE}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput, password: passwordInput })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    alert(data.message);

                    //Award registered users a persistent 10% discount state
                    localStorage.setItem('mariarty_discount', '10');
                    localStorage.setItem('mariarty_user_role', 'client');
                    localStorage.setItem('mariarty_session_expires', (Date.now() / 1000) + 1800);
                    window.location.href = 'shop.html';
                } else {
                    alert(data.message || 'Registration failed');
                }
            } catch (error) {
                alert('Cannot connect to gateway (Port 5000). Make sure it is running.');
            }
        });
    }

    //User login event
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const emailInput = loginForm.querySelector('input[type="email"]').value;
            const passwordInput = loginForm.querySelector('input[type="password"]').value;

            try {
                const response = await fetch(`${API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput, password: passwordInput })
                });

                const data = await response.json();

                if (response.ok && data.success) {

                    //// Save response state to LocalStorage
                    localStorage.setItem('mariarty_session_expires', data.expires_at);
                    localStorage.setItem('mariarty_user_role', data.role);
                    localStorage.setItem('mariarty_discount', data.discount);


                    //Role-based UI redirection logic
                    if (data.role === 'artist') {
                        if (loginSection) loginSection.style.display = 'none';
                        if (adminDashboard) adminDashboard.style.display = 'block';
                        if (calendar) calendar.render();
                    } else {
                        alert('Logged in successfully! Your 10% member discount is now active in the shop.');
                        window.location.href = 'shop.html';
                    }
                } else {
                    alert(data.message || 'Invalid credentials');
                }
            } catch (error) {
                alert('Cannot connect to gateway (Port 5000). Make sure it is running.');
            }
        });
    }

    //Logout handler; clears state variables and resets page layout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('mariarty_session_expires');
            localStorage.removeItem('mariarty_user_role');
            localStorage.removeItem('mariarty_discount');
            if (adminDashboard) adminDashboard.style.display = 'none';
            if (loginSection) loginSection.style.display = 'block';
            if (loginForm) loginForm.reset();
        });
    }

    //Initial cart render execution on DOM load
    updateCartCount();
    renderCart();
});



//E-commerce
//Architecture decision is to use the localStorage array serialization for cart items
function getCart() {
    return JSON.parse(localStorage.getItem('mariarty_cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('mariarty_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        countEl.innerText = totalCount;
    }
}

//Add items to the cart
window.addToCart = function(name, price) {
    const cart = getCart();
    const existing = cart.find(item => item.name === name);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ name, price, quantity: 1 });
    }
    saveCart(cart);
    alert(`${name} added to cart!`);
};

//Cart UI builder - calculates subtotal, applies user discounts, and renders summary
function renderCart() {
    const cartItemsList = document.getElementById('cart-items-list');
    if (!cartItemsList) return;

    const cart = getCart();
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<p style="color: #aaa;">Your cart is empty.</p>';
        const subtotalEl = document.getElementById('cart-subtotal');
        const finalTotalEl = document.getElementById('cart-final-total');
        if (subtotalEl) subtotalEl.innerText = '€0';
        if (finalTotalEl) finalTotalEl.innerText = '€0';
        
        const discountRow = document.getElementById('discount-row');
        if (discountRow) discountRow.style.display = 'none';
        
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    let subtotal = 0;
    cartItemsList.innerHTML = cart.map((item, index) => {
        subtotal += item.price * item.quantity;
        return `
            <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid #333;">
                <div>
                    <h4 style="margin: 0; color: #fff;">${item.name}</h4>
                    <p style="margin: 0; color: #aaa; font-size: 0.9rem;">€${item.price} x ${item.quantity}</p>
                </div>
                <div>
                    <span style="font-weight: bold; color: #f70d29; margin-right: 1rem;">€${item.price * item.quantity}</span>
                    <button onclick="removeFromCart(${index})" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: #dc3545; color: #dc3545;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');


    //Dynamic discount engine reading active role status from localStorage
    const discountPercent = parseInt(localStorage.getItem('mariarty_discount')) || 0;
    let discountAmount = 0;
    const discountRow = document.getElementById('discount-row');

    if (discountPercent > 0 && discountRow) {
        discountAmount = subtotal * (discountPercent / 100);
        discountRow.style.display = 'flex';
        const discountEl = document.getElementById('cart-discount');
        if (discountEl) discountEl.innerText = `-€${discountAmount.toFixed(2)}`;
    } else if (discountRow) {
        discountRow.style.display = 'none';
    }

    const finalTotal = subtotal - discountAmount;

    const subtotalEl = document.getElementById('cart-subtotal');
    const finalTotalEl = document.getElementById('cart-final-total');
    if (subtotalEl) subtotalEl.innerText = `€${subtotal.toFixed(2)}`;
    if (finalTotalEl) finalTotalEl.innerText = `€${finalTotal.toFixed(2)}`;

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = false;
}

window.removeFromCart = function(index) {
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
};


//Dynamic payment form handler (hides/shows credit card fields depending on choice)
window.toggleCardInputs = function() {
    const methodEl = document.getElementById('payment-method');
    if (!methodEl) return;
    const method = methodEl.value;
    const cardFields = document.getElementById('card-fields');
    if (!cardFields) return;

    if (method === 'studio') {
        cardFields.style.display = 'none';
        document.querySelectorAll('#card-fields input').forEach(input => input.required = false);
    } else {
        cardFields.style.display = 'block';
        document.querySelectorAll('#card-fields input').forEach(input => input.required = true);
    }
};

window.processPayment = async function(event) {
    event.preventDefault();

    const cart = getCart();
    const discountPercent = parseInt(localStorage.getItem('mariarty_discount')) || 0;
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal - (subtotal * (discountPercent / 100));

    try {
        //Submit the finalized order to the shop microservice via the API Gateway
        const response = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart, total: total })
        });

        if (response.ok) {
            alert('Order placed successfully! Thank you for shopping with Mariarty Ink.');
            localStorage.removeItem('mariarty_cart');
            window.location.href = 'index.html';
        } else {
            alert('Failed to place order. Please try again.');
        }
    } catch (error) {
        alert('Cannot connect to gateway (Port 5000). Make sure it is running.');
    }
};

//Shop microservice data fetching
//Transforms JSON array from shop microservice into visual shop grid elements
function renderProducts(products) {
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return;

    productGrid.innerHTML = products.map(product => `
        <div class="service-card shop-card">
            <div class="card-content">
                <img src="${product.image_url}" alt="${product.name}">
                <h4>${product.name.toUpperCase()}</h4>
                <p>${product.description}</p>
            </div>
            <div class="card-footer">
                <span class="price">€${product.price.toFixed(2)} EUR</span>
                <button class="btn btn-red btn-block" onclick="addToCart('${product.name}', ${product.price})">Add to Cart</button>
            </div>
        </div>
    `).join('');
}

//Fetches product catalogue via the API Gateway (port 5000), which proxies to the shop microservice
async function fetchShopProducts() {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        const products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error('Error loading products from shop microservice:', error);
    }
}

//Auto-trigger product fetch if user is viewing the shop page DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-grid')) {
        fetchShopProducts();
    }
});