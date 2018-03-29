import React, { Component } from 'react'
import classnames from 'classnames'

import { BrowserRouter as Router } from 'react-router-dom'

import { Helmet } from 'react-helmet'

import { withStyles } from 'material-ui/styles'

import Main from './Main'
const Background = require('./assets/background.png')

const styles = theme => ({
  content: {
    /* The image used */
    backgroundImage: `url(${Background})`,

    // /* Full height */
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
      <Router>
        <div>
          <Helmet>
            <meta charset='utf-8' />
            <meta name='viewport' content='width=device-width, initial-scale=1, shrink-to-fit=no' />
            <meta name='theme-color' content='#000000' />
            <title>FMX Integrator</title>
          </Helmet>
          Hello
          <div className={classnames(classes.content)}>
            <Main />
          </div>
        </div>
      </Router>
    )
  }
}

export default withStyles(styles, { withTheme: true })(App)
