const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const url = '/images/waldo-next.jpg'
  const deleted = await prisma.image.deleteMany({ where: { url } })
  console.log(`Deleted ${deleted.count} image(s) with url=${url}`)
  // Also delete any characters tied to that image (if any lingering)
  // Note: deleteMany above will cascade only if set; ensure characters are cleaned as well
  const chars = await prisma.character.deleteMany({ where: { image: { url } } }).catch(() => ({ count: 0 }))
  console.log(`Deleted ${chars.count || 0} characters associated with url=${url}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
