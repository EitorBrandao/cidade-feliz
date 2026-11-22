import { createRoot } from 'react-dom/client'
import '@fontsource/baloo-2/500.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/baloo-2/800.css'
import './styles.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// Atualização automática: ao abrir o jogo, se tiver versão nova, ela baixa e a página recarrega sozinha.
// O save é gravado antes de recarregar (pagehide), então nada se perde.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <App />,
)
