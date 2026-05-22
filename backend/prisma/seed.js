const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚗 Starting database seeding...');

  // 1. Clear cars (branches have FK so clear in order)
  await prisma.car.deleteMany();
  await prisma.branch.deleteMany();
  console.log('🧹 Cleared existing cars and branches.');

  // 2. Seed Branches — 8 major Indian cities with real coordinates
  const branchesData = [
    {
      name: 'Mumbai Central Branch',
      address: 'Dr. Ambedkar Road, Near Central Station',
      city: 'Mumbai',
      latitude: 18.9696,
      longitude: 72.8193,
      contactNumber: '+91-22-4567-8901',
    },
    {
      name: 'Delhi Connaught Place Branch',
      address: 'Block A, Connaught Place, New Delhi',
      city: 'Delhi',
      latitude: 28.6315,
      longitude: 77.2167,
      contactNumber: '+91-11-4321-9876',
    },
    {
      name: 'Bangalore Indiranagar Branch',
      address: '100 Feet Road, Indiranagar',
      city: 'Bangalore',
      latitude: 12.9784,
      longitude: 77.6408,
      contactNumber: '+91-80-4567-1234',
    },
    {
      name: 'Hyderabad Banjara Hills Branch',
      address: 'Road No. 12, Banjara Hills',
      city: 'Hyderabad',
      latitude: 17.4239,
      longitude: 78.4738,
      contactNumber: '+91-40-4567-5678',
    },
    {
      name: 'Chennai T. Nagar Branch',
      address: 'Pondy Bazaar, T. Nagar',
      city: 'Chennai',
      latitude: 13.0418,
      longitude: 80.2341,
      contactNumber: '+91-44-4567-2345',
    },
    {
      name: 'Pune Koregaon Park Branch',
      address: 'North Main Road, Koregaon Park',
      city: 'Pune',
      latitude: 18.5362,
      longitude: 73.8943,
      contactNumber: '+91-20-4567-3456',
    },
    {
      name: 'Kolkata Park Street Branch',
      address: '12 Park Street, Central Kolkata',
      city: 'Kolkata',
      latitude: 22.5519,
      longitude: 88.3513,
      contactNumber: '+91-33-4567-4567',
    },
    {
      name: 'Ahmedabad SG Highway Branch',
      address: 'SG Highway, Bodakdev',
      city: 'Ahmedabad',
      latitude: 23.0583,
      longitude: 72.5246,
      contactNumber: '+91-79-4567-6789',
    },
  ];

  const createdBranches = [];
  for (const b of branchesData) {
    const branch = await prisma.branch.create({ data: b });
    createdBranches.push(branch);
    console.log(`  ✅ Branch: ${branch.name} (${branch.city})`);
  }

  // Map city name -> branch for easy assignment
  const branchMap = Object.fromEntries(createdBranches.map((b) => [b.city, b]));

  // 3. Seed Cars — each assigned to a branch
  const carsToInsert = [
    // Mumbai
    { name: 'Swift LXI', brand: 'Maruti Suzuki', model: 'Swift', type: 'hatchback', pricePerDay: 1200, seats: 5, transmission: 'manual', fuelType: 'petrol', availability: true, imageUrl: '/cars/swift.png', description: 'Fuel-efficient city hatchback, perfect for urban commutes.', branchCity: 'Mumbai' },
    { name: 'City ZX CVT', brand: 'Honda', model: 'City', type: 'sedan', pricePerDay: 2200, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/city.png', description: 'Premium sedan with smooth CVT gearbox and spacious cabin.', branchCity: 'Mumbai' },

    // Delhi
    { name: 'Fortuner Legender', brand: 'Toyota', model: 'Fortuner', type: 'suv', pricePerDay: 4500, seats: 7, transmission: 'automatic', fuelType: 'diesel', availability: true, imageUrl: '/cars/fortuner.png', description: 'Powerful SUV for long highway drives and family trips.', branchCity: 'Delhi' },
    { name: '3 Series 330i', brand: 'BMW', model: '3 Series', type: 'luxury', pricePerDay: 8500, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/bmw.png', description: 'The ultimate driving machine for premium road experience.', branchCity: 'Delhi' },
    { name: 'C-Class C200', brand: 'Mercedes-Benz', model: 'C-Class', type: 'luxury', pricePerDay: 9000, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/mercedes.png', description: 'Iconic luxury saloon with cutting-edge technology.', branchCity: 'Delhi' },

    // Bangalore
    { name: 'Creta SX', brand: 'Hyundai', model: 'Creta', type: 'suv', pricePerDay: 2500, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/creta.png', description: 'India\'s most popular compact SUV with panoramic sunroof.', branchCity: 'Bangalore' },
    { name: 'Nexon EV Max', brand: 'Tata', model: 'Nexon', type: 'electric', pricePerDay: 2800, seats: 5, transmission: 'automatic', fuelType: 'electric', availability: true, imageUrl: '/cars/nexon.png', description: 'Award-winning electric SUV with 437km range.', branchCity: 'Bangalore' },

    // Hyderabad
    { name: 'XUV700 AX7', brand: 'Mahindra', model: 'XUV700', type: 'suv', pricePerDay: 3500, seats: 7, transmission: 'automatic', fuelType: 'diesel', availability: true, imageUrl: '/cars/xuv700.png', description: 'Feature-packed SUV with ADAS and panoramic display.', branchCity: 'Hyderabad' },
    { name: 'A4 Technology', brand: 'Audi', model: 'A4', type: 'luxury', pricePerDay: 8000, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/audi.png', description: 'Precision-engineered luxury sedan with quattro AWD.', branchCity: 'Hyderabad' },

    // Chennai
    { name: 'Seltos HTX Plus', brand: 'Kia', model: 'Seltos', type: 'suv', pricePerDay: 2400, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/seltos.png', description: 'Stylish compact SUV with a large 10.25" touchscreen.', branchCity: 'Chennai' },
    { name: 'Innova Crysta GX', brand: 'Toyota', model: 'Innova', type: 'suv', pricePerDay: 3000, seats: 7, transmission: 'manual', fuelType: 'diesel', availability: true, imageUrl: '/cars/innova.png', description: 'India\'s go-to MPV for family travel and tour operators.', branchCity: 'Chennai' },

    // Pune
    { name: 'Thar LX 4x4', brand: 'Mahindra', model: 'Thar', type: 'suv', pricePerDay: 3200, seats: 4, transmission: 'manual', fuelType: 'diesel', availability: true, imageUrl: '/cars/thar.png', description: 'Iconic off-roader built for adventure and rugged terrain.', branchCity: 'Pune' },
    { name: 'Macan S', brand: 'Porsche', model: 'Macan', type: 'luxury', pricePerDay: 15000, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/macan.png', description: 'Sports SUV combining Porsche performance with everyday usability.', branchCity: 'Pune' },

    // Kolkata
    { name: 'Baleno Zeta', brand: 'Maruti Suzuki', model: 'Baleno', type: 'hatchback', pricePerDay: 1400, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/baleno.png', description: 'Premium hatchback with Heartect platform for safety and ride quality.', branchCity: 'Kolkata' },

    // Ahmedabad
    { name: 'Range Rover Evoque', brand: 'Land Rover', model: 'Evoque', type: 'luxury', pricePerDay: 12000, seats: 5, transmission: 'automatic', fuelType: 'petrol', availability: true, imageUrl: '/cars/evoque.png', description: 'Compact luxury SUV with iconic Land Rover capability.', branchCity: 'Ahmedabad' },
  ];

  let carCount = 0;
  for (const { branchCity, ...carData } of carsToInsert) {
    const branch = branchMap[branchCity];
    await prisma.car.create({
      data: {
        ...carData,
        pricePerDay: carData.pricePerDay,
        branchId: branch?.id || null,
      },
    });
    carCount++;
  }

  console.log(`\n✅ Successfully seeded:`);
  console.log(`   📍 ${createdBranches.length} branches across India`);
  console.log(`   🚗 ${carCount} cars assigned to branches`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
