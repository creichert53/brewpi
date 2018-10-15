import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import classnames from 'classnames'
import { MuiThemeProvider, withStyles, createMuiTheme } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'

import _ from 'lodash'
import moment from 'moment-timezone'

import timeFormat from '../helpers/hhmmss'

const muiTheme = createMuiTheme({
  palette: {
    type: 'light',
  }
})

const styles = theme => ({
  card: {
    minWidth: 200,
  }
})

class TempTooltip extends React.Component {
  render() {
    const { active, classes } = this.props

    if (true) {
      const { payload, label, theme } = this.props

      return (
        <MuiThemeProvider theme={muiTheme}>
          <Card className={classes.card}>
            <List component='div'>
              <ListItem>
                <ListItemText
                  style={{ color: 'black' }}
                  primary={payload && !_.isEqual(payload, []) ? timeFormat.fromS(payload[0].payload.brewTime, 'hh:mm:ss') : null}
                  secondary={payload && !_.isEqual(payload, []) ? moment.tz(payload[0].payload.time * 1000, 'America/New_York').format('h:mm:ss A') : null}
                />
              </ListItem>
              {payload && payload.map((line,i) => (
                <ListItem key={i}>
                  <div style={{ height: 40, width: 10, backgroundColor: `${line.stroke}` }}></div>
                  <ListItemText
                    primary={`${line.payload[line.dataKey].toFixed(1)} °F`}
                    secondary={`${line.name}`}
                  />
                </ListItem>
              ))}
            </List>
          </Card>
        </MuiThemeProvider>
      );
    }

    return null;
  }
}

TempTooltip.propTypes = {
}

export default withStyles(styles, { withTheme: true })(TempTooltip)
