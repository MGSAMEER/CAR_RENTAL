🚗 Car Rental System Design System
📌 APP CONTEXT
Style: Modern + Professional
Brand Colors: Blue (trust), Dark Gray (professional), Green (success)
Target Audience: Urban users (18–45), tech-comfortable, fast decision-makers
🧭 DESIGN PRINCIPLES
Clarity – Every action should be obvious
Consistency – Same patterns across all pages
Efficiency – Minimum clicks to complete booking
Accessibility – Usable for all users
Responsiveness – Works on all devices
🎨 DESIGN TOKENS
🎯 COLOR PALETTE
🔵 Primary (Blue)
Scale	Color
50	#EFF6FF
100	#DBEAFE
200	#BFDBFE
300	#93C5FD
400	#60A5FA
500	#3B82F6
600	#2563EB
700	#1D4ED8
800	#1E40AF
900	#1E3A8A
⚪ Neutral (Gray)
Scale	Color
50	#F9FAFB
100	#F3F4F6
200	#E5E7EB
300	#D1D5DB
400	#9CA3AF
500	#6B7280
600	#4B5563
700	#374151
800	#1F2933
900	#111827
🟢 Semantic Colors
Success: #10B981
Warning: #F59E0B
Error: #EF4444
Info: #3B82F6
Usage Rules
Primary → Buttons, links
Neutral → Backgrounds, text
Semantic → Alerts & status
🔤 TYPOGRAPHY
Fonts
Primary: Inter, sans-serif
Monospace: Fira Code
Font Sizes
Size	Value
xs	0.75rem
sm	0.875rem
base	1rem
lg	1.125rem
xl	1.25rem
2xl	1.5rem
3xl	1.875rem
4xl	2.25rem
Font Weights
Light: 300
Regular: 400
Medium: 500
Bold: 700
Line Heights
Tight: 1.25
Normal: 1.5
Relaxed: 1.75
Usage
Headings → Bold, large
Body → Regular
Labels → Medium
📏 SPACING SCALE
Token	Value
0	0px
1	4px
2	8px
3	12px
4	16px
5	20px
6	24px
8	32px
10	40px
12	48px
16	64px
Usage
Padding → 4–6
Sections → 8–12
Layout → 16
🔘 BORDER RADIUS
Token	Value
none	0
sm	0.125rem
base	0.25rem
md	0.375rem
lg	0.5rem
xl	0.75rem
full	9999px
🌑 SHADOWS
sm: 0 1px 2px rgba(0,0,0,0.05)
base: 0 1px 3px rgba(0,0,0,0.1)
md: 0 4px 6px rgba(0,0,0,0.1)
lg: 0 10px 15px rgba(0,0,0,0.1)
xl: 0 20px 25px rgba(0,0,0,0.1)
🧱 LAYOUT SYSTEM
Grid
Max width: 1200px
Columns: 12
Gutter: 16px
Breakpoints
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
Layout Patterns
Centered Layout
<div class="max-w-5xl mx-auto px-4"></div>
Two Column
<div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
Sidebar Layout
<div class="grid grid-cols-4">
  <aside class="col-span-1"></aside>
  <main class="col-span-3"></main>
</div>
🧩 COMPONENT LIBRARY
🔘 BUTTONS
Primary Button
<button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50">
  Book Now
</button>
Variants
Primary → Main action
Secondary → Less important
Danger → Delete
🧾 INPUT FIELD
<input class="border border-gray-300 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter email">
States
Error → border-red-500
Success → border-green-500
🪟 MODAL
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
  <div class="bg-white p-6 rounded-lg shadow-lg">
    Modal Content
  </div>
</div>
🪪 CARD
<div class="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition">
  Car Details
</div>
🔔 ALERT
<div class="bg-green-100 text-green-800 p-3 rounded-md">
  Booking Successful
</div>
♿ ACCESSIBILITY GUIDELINES
WCAG Level AA
Contrast ratio ≥ 4.5:1
Keyboard navigation required
Focus outline: 2px visible
All inputs must have labels
🎞️ ANIMATION GUIDELINES
Duration: 200ms
Easing: ease-in-out
Use transform + opacity
Respect reduced motion
🎯 ICON SYSTEM
Library: Lucide React
Sizes: 16px, 20px, 24px
Stroke: 2px
🔄 STATE INDICATORS
Loading Spinner
<div class="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
Empty State
<div class="text-center text-gray-500">
  No cars available
</div>
📱 RESPONSIVE DESIGN
Mobile-first approach
Touch target ≥ 44px
Flexible layouts
⚡ PERFORMANCE GUIDELINES
Use Next.js Image
Lazy load components
Code splitting
🌐 BROWSER SUPPORT
Chrome (latest 2 versions)
Edge (latest 2)
Firefox (latest 2)