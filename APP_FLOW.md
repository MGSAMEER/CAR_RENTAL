🚗 APP_FLOW.md
Car Rental System (Web Application)
Context
A web-based car rental system that allows users to browse available cars, book them online, and manage bookings, while admins manage inventory and reservations.
________________________________________
1. ENTRY POINTS
•	Direct URL access (e.g., www.carrental.com) 
•	Search engines (Google search → landing page) 
•	Deep links: 
o	Booking confirmation email → booking details page 
•	OAuth login (optional future): 
o	Google login 
•	Marketing campaigns: 
o	Ads → landing page with offers 
________________________________________
2. CORE USER FLOWS
________________________________________
🔵 FLOW 1: User Onboarding / Registration
✅ HAPPY PATH
1.	Screen: Home Page 
o	UI: Navbar (Login/Register), Car listings 
o	Action: Click "Register" 
o	Next: Registration Page 
2.	Screen: Registration Page 
o	UI: Name, Email, Password fields, Submit button 
o	Action: User enters valid data 
o	Validation: 
	Email format must be valid 
	Password ≥ 6 characters 
o	System Response: 
	Save user in database 
o	Next: Login Page 
3.	Screen: Login Page 
o	Action: Enter credentials → Click Login 
o	System Response: 
	Authenticate user 
o	Next: Dashboard/Home 
Success Criteria: User account created and logged in
________________________________________
❌ ERROR STATES
•	Invalid email → "Enter a valid email address" 
•	Weak password → "Password must be at least 6 characters" 
•	Email already exists → "Account already registered" 
•	Server error → "Something went wrong. Try again" 
________________________________________
⚠️ EDGE CASES
•	User refreshes page → Data lost 
•	User abandons form → No account created 
•	Session timeout → Redirect to login 
________________________________________
🟢 FLOW 2: Car Booking (Main Feature)
✅ HAPPY PATH
1.	Screen: Dashboard 
o	UI: Car list, filters 
o	Action: Select car 
2.	Screen: Car Details Page 
o	UI: Car info, price, availability, "Book Now" 
o	Action: Click "Book Now" 
3.	Screen: Booking Page 
o	UI: Date picker, confirm button 
o	Validation: 
	Date must be future date 
o	Action: Submit 
4.	System Response: 
o	Check availability 
o	Create booking record 
5.	Next: Booking Confirmation Page 
Success Criteria: Booking successfully stored
________________________________________
❌ ERROR STATES
•	Car unavailable → "Selected car is not available" 
•	Invalid date → "Please select a valid future date" 
•	Network error → Retry option shown 
________________________________________
⚠️ EDGE CASES
•	Two users booking same car → Only first confirmed 
•	User goes back → Data retained temporarily 
•	Session expired → Redirect to login 
________________________________________
🟡 FLOW 3: Account Management
✅ HAPPY PATH
1.	Screen: Profile Page 
o	UI: User info, booking history 
o	Action: Edit profile / View bookings 
2.	System Response: 
o	Update data 
o	Fetch booking history 
Success Criteria: Data updated successfully
________________________________________
❌ ERROR STATES
•	Invalid input → Show validation message 
•	Update failed → Retry option 
________________________________________
⚠️ EDGE CASES
•	Concurrent update → Latest saved version persists 
________________________________________
🔴 FLOW 4: Error Recovery
Example: Payment Failure
•	Show message: "Payment failed. Try again" 
•	Options: 
o	Retry payment 
o	Cancel booking 
________________________________________
3. NAVIGATION MAP
Home (Public)
├── Login (Public)
├── Register (Public)
├── Car Listings (Public)
│   └── Car Details (Public)
│       └── Booking (Authenticated)
│           └── Confirmation (Authenticated)
├── Profile (Authenticated)
│   ├── Edit Profile
│   └── Booking History
└── Admin Panel (Admin Only)
    ├── Manage Cars
    └── Manage Bookings
________________________________________
4. SCREEN INVENTORY
________________________________________
🏠 Home Page
•	Route: / 
•	Access: Public 
•	Purpose: Show available cars 
•	Actions: 
o	View cars → Car Details 
o	Login/Register 
States:
•	Loading → Spinner 
•	Empty → "No cars available" 
•	Error → Retry 
________________________________________
🔐 Login Page
•	Route: /login 
•	Access: Public 
•	Actions: 
o	Login → Dashboard 
________________________________________
🚗 Car Details Page
•	Route: /car/:id 
•	Access: Public 
•	Actions: 
o	Book → Booking Page 
________________________________________
📅 Booking Page
•	Route: /booking 
•	Access: Authenticated 
•	Actions: 
o	Confirm booking → Success page 
________________________________________
👤 Profile Page
•	Route: /profile 
•	Access: Authenticated 
________________________________________
🛠️ Admin Dashboard
•	Route: /admin 
•	Access: Admin only 
________________________________________
5. DECISION POINTS
IF user not logged in
THEN redirect to login page

IF car availability = false
THEN disable booking button

IF payment success = true
THEN confirm booking
ELSE show retry option

IF session expired
THEN logout user and redirect to login
________________________________________
6. ERROR HANDLING
________________________________________
404 Error
•	Display: "Page not found" 
•	Action: Go to Home 
________________________________________
500 Error
•	Display: "Server error. Try again later" 
•	Action: Retry 
________________________________________
Network Offline
•	Display: "No internet connection" 
•	Action: Retry 
________________________________________
Permission Denied
•	Display: "Access denied" 
•	Redirect: Home 
________________________________________
Form Validation Failure
•	Highlight fields 
•	Show inline error messages 
________________________________________
7. RESPONSIVE BEHAVIOR
📱 Mobile
•	Simplified navigation (hamburger menu) 
•	Touch-friendly buttons 
📲 Tablet
•	Grid layout for cars 
💻 Desktop
•	Full navigation bar 
•	Advanced filters 
________________________________________
8. ANIMATIONS & TRANSITIONS
•	Page transition: 300ms ease-in-out 
•	Button click: subtle scale effect 
•	Loading: spinner animation 
•	Success: checkmark animation 
•	Modal: slide-up animation
