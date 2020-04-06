import React from 'react'
import { connect } from 'react-redux'

import { withStyles } from '@material-ui/core/styles'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Checkbox from '@material-ui/core/Checkbox'
import Typography from '@material-ui/core/Typography'

const styles = theme => ({
  list: {
    backgroundColor: 'rgb(145, 145, 145, 0.25)'
  }
})

class IOList extends React.Component {
  render() {
    const { classes, io: outputs } = this.props
    return (
      <List className={classes.list}>
        {outputs.map((out,i) => (
          <ListItem key={i}>
            <Typography style={{ color: 'rgb(100, 100, 100)', flex: 1 }} variant='subtitle1'>
              {out.displayName}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={out.liveValue === 1}
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
  io: state.io
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {})(IOList))
