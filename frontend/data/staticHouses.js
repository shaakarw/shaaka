// data/staticHouses.js

const names = [
  "John Doe", "Jane Smith", "Eric Mugisha", "Alice Uwimana",
  "David Nkurunziza", "Claudine Mukamana", "Patrick Habimana",
  "Sandrine Uwera", "Emmanuel Tuyisenge", "Olivia Ishimwe"
];

const locations = [
  "Kigali, Gasabo",
  "Kigali, Kicukiro",
  "Kigali, Nyarutarama",
  "Kigali, Kimihurura",
  "Kigali, Remera",
  "Kigali, Nyamirambo"
];

const descriptions = [
  "Beautiful modern house with parking and garden.Beautiful modern house with parking and garden.Beautiful modern house with parking and garden.Beautiful modern house with parking and garden.Beautiful modern house with parking and garden.Beautiful modern house with parking and garden.Beautiful modern house with parking and garden.",
  "Affordable home near main road and shops.",
  "Luxury house with smart features and security.",
  "Spacious family home in a quiet neighborhood.",
  "Newly built house with amazing interior design."
];

export const staticHouses = Array.from({ length: 54 }, (_, i) => {
  return {
    id: i + 1,
    user: names[i % names.length],
    ownerPhone: `+25078${Math.floor(1000000 + Math.random() * 9000000)}`,
    location: locations[i % locations.length],
    amount: `${(100000 + i * 10000).toLocaleString()} RWF`,
    description: descriptions[i % descriptions.length],
    
    imageUser: {
      uri: `https://randomuser.me/api/portraits/${i % 2 === 0 ? "men" : "women"}/${(i % 10) + 1}.jpg`
    },

    houseImages: [
      { uri: `https://picsum.pho mb/id/${100 + i}/400/200` },
      { uri: `https://picsum.photos/id/${120 + i}/400/200` },
      { uri: `https://picsum.photos/id/${140 + i}/400/200` },
    ],
  };
});