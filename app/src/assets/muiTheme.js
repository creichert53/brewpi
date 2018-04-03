import { createMuiTheme } from 'material-ui/styles'
import url from 'url'

const urlObj = url.parse(window.location.href)
console.log(`${urlObj.protocol}//${urlObj.host}`)
const muiTheme = createMuiTheme({
  drawerWidth: 300,
  apiHost: `${urlObj.protocol}//${urlObj.host}`,
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