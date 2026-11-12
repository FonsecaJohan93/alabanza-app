import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './lib/store'
import Login from './pages/Login'
import Home from './pages/Home'
import ServiceEdit from './pages/ServiceEdit'
import SongList from './pages/SongList'
import Team from './pages/Team'
import { MenuProvider } from './components/Menu'
import SongView from './pages/SongView'
import VocalView from './pages/VocalView'
import DrumPage from './pages/DrumPage'
import Settings from './pages/Settings'
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
    <MenuProvider>
      <div className="mx-auto min-h-dvh max-w-2xl md:landscape:max-w-6xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/repertorio" element={<SongList />} />
          <Route path="/equipo" element={<Team />} />
          <Route path="/servicio/:date" element={<ServiceEdit />} />
          <Route path="/nueva" element={<NewSong />} />
          <Route path="/nueva/editar" element={<SongEdit />} />
          <Route path="/cancion/:id" element={<SongView />} />
          <Route path="/cancion/:id/editar" element={<SongEdit />} />
          <Route path="/cancion/:id/voces" element={<VocalView />} />
          <Route path="/cancion/:id/bateria" element={<DrumPage />} />
          <Route path="/configuracion" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </MenuProvider>
  )
}
