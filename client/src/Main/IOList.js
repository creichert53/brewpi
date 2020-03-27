import React from 'react'
import { connect } from 'react-redux'

import { withStyles } from '@material-ui/core/styles'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Checkbox from '@material-ui/core/Checkbox'
import Typography from '@material-ui/core/Typography'

import url from 'url'
import io from 'socket.io-client'

const styles = theme => ({
  list: {
    backgroundColor: 'rgb(145, 145, 145, 0.25)'
  }
})

class IOList extends React.Component {
  state = {
    outputs: this.props.io,
    displayNames: this.props.io.reduce((acc,val) => {
      acc[val.name] = val.displayName
      return acc
    }, {})
  }

  componentDidMount = () => {
    // CREATE SOCKET-IO MIDDLEWARE
    // this.props.socket.on('output update', val => {
    //   console.log(val)
    //   // this.setState({ outputs: val })
    // })
  }

  render() {
    const { classes } = this.props
    const { outputs, displayNames } = this.state
    return (
      <List className={classes.list}>
        {outputs.map((out,i) => (
          <ListItem key={i}>
            <Typography style={{ color: 'rgb(100, 100, 100)', flex: 1 }} variant='subtitle1'>
              {displayNames[out.name]}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={out.value === 1}
                  style={{ cursor: 'default' }}
                />
              }
            />
          </ListItem>
        ))}
      </List>
    )
  }
}

IOList.propTypes = {
}

const mapStateToProps = (state) => ({
  io: state.io,
  socket: state.socket
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {})(IOList))
