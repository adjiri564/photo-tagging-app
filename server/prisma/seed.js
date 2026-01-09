const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Create a sample image entry. Place an actual image at public/images/sample.jpg
  let image = await prisma.image.findFirst({ where: { url: '/images/airport-scene.jpg' } })
  if (!image) {
    image = await prisma.image.create({ data: { url: '/images/airport-scene.jpg', originalWidth: 4000, originalHeight: 3000 } })
  }
  // Remove any existing characters for this image so seed is idempotent
  await prisma.character.deleteMany({ where: { imageId: image.id } })

  // Sample characters (normalized coordinates)
  const characters = [
    { 
        name: 'Boy on the bike', 
        x: 0.255, 
        y: 0.27, 
        width: 0.09, 
        height: 0.06, 
        clue: 'Wears a red helmet and rides a blue scooter' 
    },
    { 
        name: 'Man in the grey suit', 
        x: 0.885, 
        y: 0.80, 
        width: 0.025, 
        height: 0.30, 
        clue: 'Holding two brown bags near the terminal door' 
    },
    { 
        name: 'Man in the yellow long sleeve', 
        x: 0.445, 
        y: 0.535, 
        width: 0.07, 
        height: 0.13, 
        clue: 'Driving an orange utility vehicle near the plane' 
    }
];


  for (const c of characters) {
    await prisma.character.create({
      data: {
        id: c.name,
        name: c.name,
        clue: c.clue,
        imageId: image.id,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height
      }
    })
  }

  // Add second image (next round) and its character
  let nextImage = await prisma.image.findFirst({ where: { url: '/images/waldo-pic1.jpg' } })
  if (!nextImage) {
    nextImage = await prisma.image.create({ data: { url: '/images/waldo-pic1.jpg', originalWidth: 1024, originalHeight: 1024 } })
  }

  // Upsert the new character for the next image
  const nextChar = {
    name: 'Man in the red and white striped shirt',
    x: 0.50,
    y: 0.49,
    width: 0.08,
    height: 0.23,
    clue: 'Standing near the center of the scene wearing a red-and-white striped shirt, blue trousers, and a red hat'
  }

  // remove existing same-id character for idempotency
  await prisma.character.deleteMany({ where: { id: nextChar.name } })
  await prisma.character.create({ data: {
    id: nextChar.name,
    name: nextChar.name,
    clue: nextChar.clue,
    imageId: nextImage.id,
    x: nextChar.x,
    y: nextChar.y,
    width: nextChar.width,
    height: nextChar.height
  }})

  console.log('Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
