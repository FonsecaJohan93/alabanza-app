import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './lib/store'
import Login from './pages/Login'
import SongList from './pages/SongList'
import SongView from './pages/SongView'
import NewSong from './pages/NewSong'
import SongEdit from './pages/SongEdit'

export default function App() {
  const { pathname } = useLocation()
  const session = useSession()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (!session) return <Login />

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <Routes>
        <Route path="/" element={<SongList />} />
        <Route path="/nueva" element={<NewSong />} />
        <Route path="/nueva/editar" element={<SongEdit />} />
        <Route path="/cancion/:id" element={<SongView />} />
        <Route path="/cancion/:id/editar" element={<SongEdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
