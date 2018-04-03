/** REACT - REDUX **/
import React, { Component } from 'react'
import { Provider } from 'react-redux'
import classnames from 'classnames'

/** ROUTER **/
import { BrowserRouter as Router } from 'react-router-dom'

/** HELMET **/
import { Helmet } from 'react-helmet'

/** MATERIAL-UI **/
import { MuiThemeProvider, withStyles } from 'material-ui/styles'

/** CUSTOM **/
import { muiTheme } from './assets/muiTheme'
import Main from './Main'
import store from './Redux'
const Background = require('./assets/background.png')

const styles = theme => ({
  content: {
    /* The image used */
    backgroundImage: `url(${Background})`,

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
})

class App extends Component {
  render() {
    const { classes } = this.props
    return (
      <Provider store={store}>
        <Router>
          <MuiThemeProvider theme={muiTheme}>
            <div>
              <Helmet>
                <meta charset='utf-8' />
                <meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no' />
                <title>FMX Integrator</title>
              </Helmet>
              <div className={classnames(classes.content)}>
                <Main />
              </div>
            </div>
          </MuiThemeProvider>
        </Router>
      </Provider>
    )
  }
}

export default withStyles(styles, { withTheme: true })(App)
