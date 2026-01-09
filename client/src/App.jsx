import React, { useEffect, useState } from 'react'
import { fetchImages } from './api'
import Game from './Game'
import Admin from './Admin'

export default function App() {
  const [images, setImages] = useState([])
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('play')

  useEffect(() => {
    fetchImages().then(setImages).catch(() => setImages([]))
  }, [])

  // Filter out any deprecated filenames (remove `/images/waldo-next.jpg` if present)
  const filteredImages = images.filter((img) => img.url !== '/images/waldo-next.jpg')
  const selectedImage = filteredImages.find((i) => i.id === selected) || null

  return (
    <div className="app">
      <h1>Photo Tagging Game</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setMode('play')} disabled={mode==='play'}>Play</button>
        <button onClick={() => setMode('admin')} disabled={mode==='admin'} style={{ marginLeft: 8 }}>Admin</button>
      </div>
      <div className="image-select">
        <label>Select image:</label>
        <select onChange={(e) => setSelected(e.target.value)} value={selected || ''}>
          <option value="">-- choose --</option>
          {filteredImages.map((img) => (
            <option key={img.id} value={img.id}>{img.url}</option>
          ))}
        </select>
      </div>

      {mode === 'admin' ? (
        <Admin />
      ) : (
        (selected ? <Game image={selectedImage} onNextImage={(next) => { if (next && next.id) setSelected(next.id) }} /> : <p>Select an image to start a round.</p>)
      )}
    </div>
  )
}
