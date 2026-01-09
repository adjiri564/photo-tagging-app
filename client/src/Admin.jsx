import React, { useEffect, useState } from 'react'
import { fetchImages, fetchCharacters, updateCharacter } from './api'

export default function Admin() {
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [characters, setCharacters] = useState([])
  const [importText, setImportText] = useState('')

  useEffect(() => {
    fetchImages().then((list) => setImages(list))
  }, [])

  useEffect(() => {
    if (!selectedImage) return
    fetchCharacters(selectedImage.id).then(setCharacters)
  }, [selectedImage])

  function onSelectImage(e) {
    const id = e.target.value
    const img = images.find((i) => i.id === id) || null
    setSelectedImage(img)
    setCharacters([])
  }

  async function saveChar(c) {
    const payload = { x: parseFloat(c.x), y: parseFloat(c.y), width: parseFloat(c.width) || null, height: parseFloat(c.height) || null, name: c.name, clue: c.clue, imageId: selectedImage.id }
    await updateCharacter(c.id, payload)
    const refreshed = await fetchCharacters(selectedImage.id)
    setCharacters(refreshed)
  }

  function exportJSON() {
    const data = JSON.stringify(characters, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedImage ? selectedImage.id : 'characters'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport() {
    let parsed
    try {
      parsed = JSON.parse(importText)
    } catch (e) {
      alert('Invalid JSON')
      return
    }
    // Expect array of character objects with id and fields
    for (const c of parsed) {
      const payload = { x: c.x, y: c.y, width: c.width, height: c.height, name: c.name, clue: c.clue, imageId: selectedImage.id }
      await updateCharacter(c.id, payload)
    }
    const refreshed = await fetchCharacters(selectedImage.id)
    setCharacters(refreshed)
    setImportText('')
    alert('Import complete')
  }

  return (
    <div style={{ padding: 12 }}>
      <h2>Admin Dashboard</h2>
      <div>
        <label>Select image: </label>
        <select onChange={onSelectImage} value={selectedImage ? selectedImage.id : ''}>
          <option value="">-- choose --</option>
          {images.map((img) => <option key={img.id} value={img.id}>{img.url}</option>)}
        </select>
      </div>

      {selectedImage && (
        <div style={{ marginTop: 12 }}>
          <h3>Characters for {selectedImage.url}</h3>
          <button onClick={exportJSON}>Export JSON</button>
          <div style={{ marginTop: 8 }}>
            <textarea placeholder='Paste JSON here to import' value={importText} onChange={(e) => setImportText(e.target.value)} style={{ width: '100%', height: 120 }} />
            <div>
              <button onClick={doImport}>Import</button>
            </div>
          </div>

          <ul>
            {characters.map((c) => (
              <li key={c.id} style={{ marginBottom: 8 }}>
                <div><strong>{c.name}</strong> ({c.id})</div>
                <div>
                  x: <input value={c.x} onChange={(e) => setCharacters((cs) => cs.map((it) => it.id === c.id ? { ...it, x: e.target.value } : it))} style={{ width: 80 }} />
                  y: <input value={c.y} onChange={(e) => setCharacters((cs) => cs.map((it) => it.id === c.id ? { ...it, y: e.target.value } : it))} style={{ width: 80 }} />
                  width: <input value={c.width || ''} onChange={(e) => setCharacters((cs) => cs.map((it) => it.id === c.id ? { ...it, width: e.target.value } : it))} style={{ width: 80 }} />
                  height: <input value={c.height || ''} onChange={(e) => setCharacters((cs) => cs.map((it) => it.id === c.id ? { ...it, height: e.target.value } : it))} style={{ width: 80 }} />
                </div>
                <div>
                  name: <input value={c.name} onChange={(e) => setCharacters((cs) => cs.map((it) => it.id === c.id ? { ...it, name: e.target.value } : it))} style={{ width: 300 }} />
                </div>
                <div>
                  clue: <input value={c.clue || ''} onChange={(e) => setCharacters((cs) => cs.map((it) => it.id === c.id ? { ...it, clue: e.target.value } : it))} style={{ width: 400 }} />
                </div>
                <div>
                  <button onClick={() => saveChar(c)}>Save</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
