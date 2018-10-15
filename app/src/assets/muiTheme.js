import { createMuiTheme } from '@material-ui/core/styles'

const muiTheme = createMuiTheme({
  palette: {
    type: 'dark',
  },
  drawerWidth: 300,
  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    titleFont: {
      fontSize: '2rem',
      textTransform: 'uppercase',
      fontWeight: 500,
      fontFamily: "'Monoton', 'Helvetica', 'Arial', sans-serif",
    },
    tempFont: {
      fontSize: '2rem',
      fontSize: 100,
      fontFamily: "'Lato', 'Helvetica', 'Arial', sans-serif",
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
    graph: {
      temp1: '#e9229a',
      temp2: '#2ad63b',
      temp3: '#4940fa'
    },
    status: {
      success: '#2ced96',
      warning: '#ebde3b',
      caution: '#df9b26',
      danger: '#fa1a1a'
    },
    srm: [
      '#fee79a', // 1
      '#fce083', // 2
      '#fcd269', // 3
      '#fbc550', // 4
      '#fbbf3c', // 5
      '#f9b31b', // 6
      '#f4a506', // 7
      '#ee9b01', // 8
      '#e99001', // 9
      '#e48901', // 10
      '#d77c03', // 11
      '#d57601', // 12
      '#cb6d01', // 13
      '#c66701', // 14
      '#c46303', // 15
      '#bb5802', // 16
      '#b65302', // 17
      '#ad4e00', // 18
      '#ac4602', // 19
      '#a23f02', // 20
      '#9e3a00', // 21
      '#993800', // 22
      '#8f3000', // 23
      '#8c2c03', // 24
      '#882a02', // 25
      '#812503', // 26
      '#7e1e01', // 27
      '#791c02', // 28
      '#741a02', // 29
      '#741a02', // 30
      '#6a1601', // 31
      '#661100', // 32
      '#691002', // 33
      '#630d03', // 34
      '#5b0d01', // 35
      '#550b01', // 36
      '#540c03', // 37
      '#520b05', // 38
      '#4d0a05', // 39
      '#4b0707', // 40
      '#460606', // 41
      '#450707', // 42
      '#410807', // 43
      '#3e0908', // 44
      '#3c0608', // 45
      '#3b070b', // 46
      '#36070b', // 47
      '#34090b', // 48
      '#2f090b', // 49
      '#2b0809', // 50
      '#280708', // 51
      '#240705', // 52
      '#1f0606', // 53
      '#1f0609', // 54
      '#1a0506', // 55
      '#140404', // 56
      '#120302', // 57
      '#0d0403', // 58
      '#050002', // 59
      '#000000', // 60
    ]
  }
})

export { muiTheme }
