import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import Divider from '@material-ui/core/Divider'
import Grid from '@material-ui/core/Grid'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'
import Typography from '@material-ui/core/Typography'

import { updateOutput } from '../Redux/actions'

const styles = theme => ({
  root: {
    flexGrow: 1,
    margin: 'auto',
    maxWidth: 680
  },
  listItemText: {
    flexGrow: 1
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  }
})

export const Output = (props) => {
  const { classes, handleOutput, index, value } = props
  return (
    <ListItem divider={index < 7 ? true : false}>
      <ListItemText className={classes.listItemText} primary={value.displayName} />
      <ToggleButtonGroup value={value.value} exclusive onChange={(e, newValue) => handleOutput(e, newValue, index)}>
        <ToggleButton value={0}>
          <Typography variant='button'>
            AUTO
          </Typography>
        </ToggleButton>
        <ToggleButton value={-1} style={value.value === -1 ? { backgroundColor: 'red' } : {}}>
          <Typography variant='button'>
            OFF
          </Typography>
        </ToggleButton>
        <ToggleButton value={1} style={value.value === 1 ? { backgroundColor: 'green' } : {}}>
          <Typography variant='button'>
            ON
          </Typography>
        </ToggleButton>
      </ToggleButtonGroup>
    </ListItem>
  )
}
Output.propTypes = {
}

class ControlCenter extends React.Component {
  handleOutput = (event, newValue, index) => {
    if (newValue !== null) this.props.updateOutput(index, newValue)
  }

  render() {
    const { classes, outputs } = this.props
    return (
      <div className={classes.root}>
        <Grid container spacing={2} direction='column'>
          <Grid item xs>
            <Card>
              <List
                subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Outputs</ListSubheader>}
              >
                <Divider/>
                {outputs.map((value,i) => <Output key={i} index={i} handleOutput={this.handleOutput} classes={classes} value={value} />)}
              </List>
            </Card>
          </Grid>
        </Grid>
      </div>
    )
  }
}

ControlCenter.propTypes = {
  classes: PropTypes.object.isRequired,
}

const mapStateToProps = (state) => ({
  outputs: state.io
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {
  updateOutput
})(ControlCenter))
