import React, { useEffect, useRef, useState } from 'react'
import api, { fetchCharacters, startSession, validateClick, postScore, fetchScores, updateCharacter } from './api'

function toPx(norm, dim) {
  return Math.round(norm * dim)
}

export default function Game({ image, onNextImage }) {
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  const [characters, setCharacters] = useState([])
  const [session, setSession] = useState(null)
  const [markers, setMarkers] = useState([])
  const [target, setTarget] = useState(null)
  const [message, setMessage] = useState('')
  const [scores, setScores] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEditingId, setAdminEditingId] = useState(null)
  const [adminPreview, setAdminPreview] = useState(null)

  useEffect(() => {
    if (!image) return
    fetchCharacters(image.id).then(setCharacters)
    fetchScores(image.id).then(setScores)
  }, [image])

  async function handleStart() {
    if (!image) return
    const s = await startSession(image.id)
    setSession(s.sessionId)
    setMarkers([])
    setMessage('Game started')
  }

  function getDisplayDims() {
    const img = imgRef.current
    if (!img) return null
    return { width: img.clientWidth, height: img.clientHeight }
  }

  function handleClick(e) {
    if (!session) { setMessage('Press Start to begin'); return }
    const img = imgRef.current
    const rect = img.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    const normX = offsetX / rect.width
    const normY = offsetY / rect.height
    // If admin is editing a character's position, capture as preview instead of normal target
    if (isAdmin && adminEditingId) {
      setAdminPreview({ pxX: offsetX, pxY: offsetY, normX, normY })
      setMessage(`Preview set for ${adminEditingId} — click Save to persist`) 
      return
    }

    setTarget({ pxX: offsetX, pxY: offsetY, normX, normY, absoluteLeft: rect.left, absoluteTop: rect.top })
  }

  async function handleSelect(characterId) {
    if (!target) return
    const payload = { characterId, clickCoordinates: { x: target.normX, y: target.normY }, imageId: image.id, sessionId: session }
    const r = await validateClick(payload)
    if (r.success) {
      setMessage('Correct!')
      // place marker at true coordinates
      const dims = getDisplayDims()
      if (dims) {
        const pxX = toPx(r.trueCoordinates.x, dims.width)
        const pxY = toPx(r.trueCoordinates.y, dims.height)
        setMarkers((m) => [...m, { id: characterId, x: pxX, y: pxY }])
      }
      // remove character from remaining list
      setCharacters((cs) => cs.filter((c) => c.id !== characterId))
      if (r.gameComplete) {
        const timeMs = r.timeMs
        const name = prompt('Round complete! Enter your name for leaderboard:')
        if (name) {
          await postScore({ name, timeMs, imageId: image.id })
          fetchScores(image.id).then(setScores)
        }
        // If server provided a next image, ask parent to load it
        if (r.nextImage && typeof onNextImage === 'function') {
          onNextImage(r.nextImage)
        }
      }
    } else {
      setMessage(r.message || 'Incorrect')
    }
    setTarget(null)
  }

  async function startEdit(id) {
    setIsAdmin(true)
    setAdminEditingId(id)
    setAdminPreview(null)
    setMessage(`Admin mode: click image to set position for ${id}`)
  }

  async function saveAdmin() {
    if (!adminEditingId || !adminPreview) return
    const payload = { x: adminPreview.normX, y: adminPreview.normY }
    await updateCharacter(adminEditingId, payload)
    // refresh characters
    fetchCharacters(image.id).then(setCharacters)
    setIsAdmin(false)
    setAdminEditingId(null)
    setAdminPreview(null)
    setMessage('Saved coordinates')
  }

  function cancelAdmin() {
    setIsAdmin(false)
    setAdminEditingId(null)
    setAdminPreview(null)
    setMessage('Admin cancelled')
  }

  return (
    <div className="game">
      <div className="controls">
        <button onClick={handleStart}>Start</button>
        <div className="message">{message}</div>
        <div className="clues">
          <strong>Clues:</strong>
          <ul>
            {characters.map((c) => (
              <li key={c.id}><strong>{c.name}:</strong> {c.clue || 'No clue available'}</li>
            ))}
          </ul>
        </div>
      </div>

      <div ref={containerRef} className="image-container">
        {
          // Ensure image URL points to backend server (vite dev server would otherwise request local path)
        }
        <img
          ref={imgRef}
          src={image ? (image.url.startsWith('http') ? image.url : `${api.defaults.baseURL}${image.url}`) : ''}
          alt="game"
          onClick={handleClick}
        />

        {target && (
          <div className="target-box" style={{ left: target.pxX - 30, top: target.pxY - 30 }}>
            <select onChange={(e) => handleSelect(e.target.value)} defaultValue="">
              <option value="">Select character</option>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setTarget(null)}>X</button>
          </div>
        )}

        {adminPreview && (
          <div className="marker preview" style={{ left: adminPreview.pxX - 8, top: adminPreview.pxY - 8 }} title="preview"></div>
        )}

        {markers.map((m) => (
          <div key={m.id} className="marker" style={{ left: m.x - 8, top: m.y - 8 }} title={m.id}></div>
        ))}
      </div>

      {isAdmin ? (
        <div className="admin-bar">
          <button onClick={saveAdmin} disabled={!adminPreview}>Save</button>
          <button onClick={cancelAdmin}>Cancel</button>
          <span style={{ marginLeft: 12 }}>Editing: {adminEditingId || 'none'}</span>
        </div>
      ) : (
        <div className="admin-toggle">
          <button onClick={() => setIsAdmin(true)}>Enter Admin Mode</button>
          <small style={{ marginLeft: 8 }}>Click 'Set position' next to a character below to adjust</small>
        </div>
      )}

      <div className="leaderboard">
        <h3>Leaderboard</h3>
        <ol>
          {scores.map((s) => (
            <li key={s.id}>{s.username} — {(s.timeMs/1000).toFixed(2)}s</li>
          ))}
        </ol>
      </div>

      <div className="admin-list">
        <h3>Characters</h3>
        <ul>
          {characters.map((c) => (
            <li key={c.id} style={{ marginBottom: 6 }}>
              <strong>{c.name}</strong> — {c.clue}
              <button style={{ marginLeft: 8 }} onClick={() => startEdit(c.id)}>Set position</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
