import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useSession } from './lib/store'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import ServiceEdit from './pages/ServiceEdit'
import SongList from './pages/SongList'
import Team from './pages/Team'
import { MenuProvider } from './components/Menu'
import SongView from './pages/SongView'
import DrumPage from './pages/DrumPage'
import StructureEdit from './pages/StructureEdit'
import Profile from './pages/Profile'
import Plan from './pages/Plan'
import Rhythms from './pages/Rhythms'
import NewSong from './pages/NewSong'
import SongEdit from './pages/SongEdit'
import Stage from './pages/Stage'

/** La pantalla aparte de voces ya no existe: todo está en la canción (menú "Ver"). */
function ToSong() {
  const { id } = useParams()
  return <Navigate to={`/cancion/${id}`} replace />
}

export default function App() {
  const { pathname } = useLocation()
  const session = useSession()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // El enlace para cambiar la contraseña se abre con o sin sesión
  if (pathname === '/restablecer') return <ResetPassword />
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
          <Route path="/cancion/:id/voces" element={<ToSong />} />
          <Route path="/cancion/:id/bateria" element={<DrumPage />} />
          <Route path="/cancion/:id/estructura" element={<StructureEdit />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/planear" element={<Plan />} />
          <Route path="/ritmos" element={<Rhythms />} />
          <Route path="/tarima" element={<Stage />} />
          <Route path="/configuracion" element={<Navigate to="/perfil" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </MenuProvider>
  )
}
