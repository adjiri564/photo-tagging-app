require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()
app.use(cors())
app.use(bodyParser.json())

// Serve static public assets (images)
app.use('/images', express.static(path.join(__dirname, 'public', 'images')))

// Serve client build if it exists. In development you can run the Vite dev server
// instead of building the client. If the `client/dist` folder does not exist
// respond with a helpful message so the server doesn't crash with ENOENT.
const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
} else {
  console.warn('Client dist not found at', clientDist)
}

// Start game: create a session and return sessionId
app.post('/start', async (req, res) => {
  const { imageId } = req.body
  if (!imageId) return res.status(400).json({ error: 'imageId required' })
  const session = await prisma.gameSession.create({ data: { startTime: new Date(), imageId } })
  res.json({ sessionId: session.id, startTime: session.startTime })
})

// Get images
app.get('/images', async (req, res) => {
  const images = await prisma.image.findMany()
  res.json(images)
})

// Get characters for image
app.get('/characters', async (req, res) => {
  const { imageId } = req.query
  if (!imageId) return res.status(400).json({ error: 'imageId required' })
  const chars = await prisma.character.findMany({ where: { imageId } })
  res.json(chars)
})

// Validate click
app.post('/validate', async (req, res) => {
  try {
    const { characterId, clickCoordinates, imageId, sessionId } = req.body
    if (!characterId || !clickCoordinates || !imageId || !sessionId) {
      return res.status(400).json({ success: false, message: 'missing fields' })
    }

    const character = await prisma.character.findUnique({ where: { id: characterId } })
    if (!character) return res.status(404).json({ success: false, message: 'character not found' })

    const { x: cx, y: cy, width, height, radius } = character
    const { x: clickX, y: clickY } = clickCoordinates // expected normalized 0..1

    let correct = false
    if (width && height) {
      // stored x,y are the character center; compute bounding box around center
      // Apply a padding factor to make hit detection more forgiving for clicks near edges
      const halfWBase = width / 2
      const halfHBase = height / 2
      // Make hitbox more forgiving: increase padding factor and absolute padding
      const PADDING_FACTOR = 1.0 // expand by 100%
      const ABS_PADDING = 0.04 // additional absolute padding in normalized units
      const halfW = halfWBase * (1 + PADDING_FACTOR) + ABS_PADDING
      const halfH = halfHBase * (1 + PADDING_FACTOR) + ABS_PADDING
      const left = cx - halfW
      const top = cy - halfH
      const right = cx + halfW
      const bottom = cy + halfH
      correct = clickX >= left && clickX <= right && clickY >= top && clickY <= bottom
      // attach padded bounds for debugging
      var paddedBounds = { left, top, right, bottom }
    } else if (radius) {
      const dx = clickX - cx
      const dy = clickY - cy
      correct = Math.sqrt(dx * dx + dy * dy) <= radius
    }

    if (!correct) {
      // Include debug info to help frontend debugging
      const debug = { clickX, clickY, character: { x: cx, y: cy, width, height, radius }, paddedBounds }
      console.log('Validate miss:', JSON.stringify(debug))
      return res.json({ success: false, message: 'Incorrect', debug })
    }

    // mark found in session
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } })
    if (!session) return res.status(404).json({ success: false, message: 'session not found' })

    // session.found is stored as JSON text in SQLite; parse/serialize to keep it consistent
    let found = []
    try {
      if (session.found) found = JSON.parse(session.found)
    } catch (e) {
      found = []
    }
    if (!found.includes(characterId)) found.push(characterId)
    await prisma.gameSession.update({ where: { id: sessionId }, data: { found: JSON.stringify(found) } })

    // Check completion
    const total = await prisma.character.count({ where: { imageId } })
    const isComplete = found.length >= total
    let completionTime = null
    if (isComplete) {
      const durationMs = new Date().getTime() - new Date(session.startTime).getTime()
      completionTime = durationMs
    }

    // If complete, find a next image (simple: first image with different id)
    let nextImage = null
    if (isComplete) {
      nextImage = await prisma.image.findFirst({ where: { id: { not: imageId } } })
      if (nextImage) {
        // return only minimal fields
        nextImage = { id: nextImage.id, url: nextImage.url }
      }
    }

    res.json({ success: true, trueCoordinates: { x: cx, y: cy }, gameComplete: isComplete, timeMs: completionTime, nextImage })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'server error' })
  }
})

// Scores
app.post('/score', async (req, res) => {
  const { name, timeMs, imageId } = req.body
  if (!name || typeof timeMs !== 'number' || !imageId) return res.status(400).json({ error: 'invalid' })
  const score = await prisma.score.create({ data: { username: name, timeMs: timeMs, imageId } })
  res.json(score)
})

// Update character coordinates (admin)
app.post('/character/:id', async (req, res) => {
  const { id } = req.params
  const { x, y, width, height, radius, name, clue } = req.body
  try {
    const data = {}
    if (typeof x === 'number') data.x = x
    if (typeof y === 'number') data.y = y
    if (typeof width === 'number') data.width = width
    if (typeof height === 'number') data.height = height
    if (typeof radius === 'number') data.radius = radius
    if (typeof name === 'string') data.name = name
    if (typeof clue === 'string') data.clue = clue
    // Upsert: create if missing, otherwise update. Require imageId when creating.
    const existing = await prisma.character.findUnique({ where: { id } })
    if (existing) {
      const updated = await prisma.character.update({ where: { id }, data })
      res.json(updated)
    } else {
      const imageId = req.body.imageId
      if (!imageId) return res.status(400).json({ error: 'imageId required to create character' })
      const created = await prisma.character.create({ data: { id, imageId, name: name || id, clue: clue || null, x: data.x || 0, y: data.y || 0, width: data.width || null, height: data.height || null, radius: data.radius || null } })
      res.json(created)
    }
  } catch (err) {
    console.error('Failed to update character', err)
    res.status(500).json({ error: 'update failed' })
  }
})

app.get('/scores', async (req, res) => {
  const { imageId } = req.query
  const where = imageId ? { where: { imageId } } : {}
  const scores = await prisma.score.findMany({ where: where.where || undefined, orderBy: { timeMs: 'asc' }, take: 50 })
  res.json(scores)
})

// Fallback: if client build exists serve index.html, otherwise return helpful text
if (fs.existsSync(clientDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
} else {
  app.get('*', (req, res) => {
    res.status(404).send('Client not built. Start the client dev server or run `npm run build` in the client folder.')
  })
}

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server listening on ${PORT}`))
