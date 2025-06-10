export function getMockCourses() {
  return new Promise(resolve =>
    setTimeout(
      () =>
        resolve([
          {
            id: "1",
            title: "Smart Contracts with Soroban",
            thumbnail: "/3horizontal.png",
            description: "Learn to build smart contracts on Soroban.",
            category: "Blockchain",
            price: "Free"
          },
          {
            id: "2",
            title: "Building with Solana and AI",
            thumbnail: "/3horizontal.png",
            description: "Combine Solana blockchain with AI for next-gen apps.",
            category: "Artificial Intelligence",
            price: "$20"
          },
          {
            id: "3",
            title: "Intro to Blockchain",
            thumbnail: "/3horizontal.png",
            description: "A beginner's guide to blockchain technology.",
            category: "Cloud Computing",
            price: "$10"
          }
        ]),
      1200
    )
  );
} 