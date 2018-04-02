import { createMuiTheme } from 'material-ui/styles'
import url from 'url'

const muiTheme = createMuiTheme({
  drawerWidth: 300,
  apiHost: `http://${url.parse(window.location.href).host}`,
  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    titleFont: {
      fontSize: '2rem',
      textTransform: 'uppercase',
      fontWeight: 500,
      fontFamily: "'Monoton', 'Helvetica', 'Arial', sans-serif",
    }
  },
  colors: {
    palette: [
      '#2a292a',
      '#4CDEF5',
      '#A4D555',
      '#FF5992',
      '#841983',
    ],
    status: {
      success: '#2ced96',
      warning: '#ebde3b',
      caution: '#df9b26',
      danger: '#fa1a1a'
    }
  }
})

export { muiTheme }
