/** REACT - REDUX **/
import React, { Component } from 'react'
import { useDispatch } from 'react-redux'
import classnames from 'classnames'

/** ROUTER **/
import { BrowserRouter as Router } from 'react-router-dom'

/** HELMET **/
import { Helmet } from 'react-helmet'

/** MATERIAL-UI **/
import {
  MuiThemeProvider,
  withStyles
} from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Snackbar from '@material-ui/core/Snackbar'
import Alert from '@material-ui/lab/Alert';

/** SNACKBARS */
import { SnackbarProvider } from 'notistack'

/** CUSTOM **/
import { muiTheme } from './assets/muiTheme'
import Main from './Main'
import { closeSnackbar } from './Redux/actions'

const styles = theme => ({
  content: {
  /* The image used */
    backgroundColor: '#303A45',

    /* Full height */
    position: 'absolute',
    height: '100%',
    width: '100%',
    top: 0,
    left: 0,

    /* Center and scale the image nicely */
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',

    minHeight: '100%'
  },
  snackbar: {
    color: 'white'
  }
})

export const App = props => {
  const { classes } = props
  const dispatch = useDispatch()
  return (
    <Router>
      <MuiThemeProvider theme={muiTheme}>
        <SnackbarProvider
          hideIconVariant={false}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          classes={{
            variantInfo: classes.snackbar,
            variantError: classes.snackbar,
            variantSuccess: classes.snackbar,
            variantWarning: classes.snackbar,
          }}
          action={key => (
            <Button onClick={() => dispatch(closeSnackbar(key))}>
              Dismiss
            </Button>
          )}
        >
          <div>
            <Helmet>
              <meta charset='utf-8' />
              <meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no' />
              <script
                defer
                src='https://use.fontawesome.com/releases/v5.0.9/js/all.js'
                integrity='sha384-8iPTk2s/jMVj81dnzb/iFR2sdA7u06vHJyyLlAd4snFpCl/SnyUjRrbdJsw1pGIl'
                crossorigin='anonymous'></script>
              <title>My Brew Pi</title>
            </Helmet>
            <div className={classnames(classes.content)}>
              <Main />
            </div>
          </div>
        </SnackbarProvider>
      </MuiThemeProvider>
    </Router>
  )
}

export default withStyles(styles, { withTheme: true })(App)
