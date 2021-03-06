import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core/styles'
import classnames from 'classnames'
import Card from '@material-ui/core/Card'
import Checkbox from '@material-ui/core/Checkbox'
import Divider from '@material-ui/core/Divider'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import Fab from '@material-ui/core/Fab'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Grid from '@material-ui/core/Grid'
import InputAdornment from '@material-ui/core/InputAdornment'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import MenuItem from '@material-ui/core/MenuItem'
import SaveIcon from '@material-ui/icons/Save'
import Select from '@material-ui/core/Select'
import Slider from '@material-ui/core/Slider'
import Switch from '@material-ui/core/Switch'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'

import get from 'lodash/get'
import isNumber from 'lodash/isNumber'
import numeral from 'numeral'

import { saveSettings, saveHeaterSettings, saveTempSettings, saveThermistorSettings } from '../Redux/actions'

const styles = theme => ({
  root: {
    flexGrow: 1,
    margin: 'auto',
    maxWidth: 680
  },
  listItemText: {
    flexGrow: 1
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  field: {
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  numberField: {
    width: 120,
  },
  calibrationTemp: {
    width: 150
  },
  expand: {
    transform: 'rotate(0deg)',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
    marginLeft: 'auto',
  },
  expandOpen: {
    transform: 'rotate(180deg)',
  },
  extendedIcon: {
    marginRight: theme.spacing(1),
  }
})

const Intervals = props => (
  <Select
    value={props.interval}
    onChange={props.handleChange}
    inputProps={{
      name: props.name,
      id: props.id,
    }}
  >
    <MenuItem value={1}>1s</MenuItem>
    <MenuItem value={5}>5s</MenuItem>
    <MenuItem value={10}>10s</MenuItem>
    <MenuItem value={30}>30s</MenuItem>
    <MenuItem value={60}>60s</MenuItem>
  </Select>
)

const thermistorSettings = [
  {
    id: 'iceTemp',
    label: 'Ice Temperature'
  },
  {
    id: 'boilTemp',
    label: 'Boil Temperature'
  },
  {
    id: 'boilBaseline',
    label: 'Boil Calibration Temp'
  }
]

const ThermistorCalibartionListItem = props => (
  <ListItem disableGutters>
    <ExpansionPanel
      expanded={props.expanded}
      className={props.classes.listItemText}
      elevation={0}
      onChange={
      props.handleExpandClick(props.id, !props.expanded)
    }>
      <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant='subtitle1'>{`Thermistor ${props.index + 1}`}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails>
        <Card className={props.classes.listItemText} elevation={5}>
          <List subheader={<ListSubheader component='div'>Calibration</ListSubheader>}>
            <ListItem>
              <Grid container spacing={2}>
                {thermistorSettings.map((setting,i) =>
                  <ThermistorSetting
                    key={i}
                    index={i}
                    temperatures={props.temperatures}
                    classes={props.classes}
                    thermistorId={props.id}
                    handleThermistorChange={props.handleThermistorChange}
                  />
                )}
              </Grid>
            </ListItem>
            <ListItem>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    id='name'
                    label='Thermistor Name'
                    name={props.id}
                    value={props.temperatures[props.id].name === null ? 0 : props.temperatures[props.id].name}
                    onChange={props.handleThermistorChange(props.id)}
                    margin='normal'
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <FormControlLabel
                    style={{ marginTop: 15 }}
                    control={
                      <Checkbox
                        id='useSetpointAdjust'
                        checked={get(props, `temperatures.${props.id}.useSetpointAdjust`, false)}
                        onChange={props.handleThermistorChange(props.id)}
                        value='useSetpointAdjust'
                      />
                    }
                    label='Use Setpoint Adjustment'
                  />
                </Grid>
              </Grid>
            </ListItem>
          </List>
        </Card>
      </ExpansionPanelDetails>
    </ExpansionPanel>
  </ListItem>
)
const ThermistorSetting = props => (
  <Grid item xs={12} sm={4}>
    <TextField
      id={thermistorSettings[props.index].id}
      label={thermistorSettings[props.index].label}
      value={props.temperatures[props.thermistorId][thermistorSettings[props.index].id] === null
        ? 0
        : props.temperatures[props.thermistorId][thermistorSettings[props.index].id]}
      onChange={props.handleThermistorChange(props.thermistorId)}
      className={props.classes.calibrationTemp}
      type='number'
      style={{ right: 0, left: 0}}
      InputLabelProps={{
        shrink: true,
      }}
      InputProps={{
        endAdornment: <InputAdornment position='start'>°F</InputAdornment>,
      }}
      margin='normal'
    />
  </Grid>
)

const deadband = 12

class Settings extends React.Component {
  state = {
    thermistor1: {
      expanded: false
    },
    thermistor2: {
      expanded: false
    },
    thermistor3: {
      expanded: false
    }
  }

  handleTempChange = event => {
    var value = event.target.name === 'logTemperatures' ? !this.props.settings.temperatures.logTemperatures : event.target.value
    this.props.saveTempSettings({
      temperatures: { ...this.props.settings.temperatures, [event.target.name]: value }
    })
  }
  handleSliderChange = (event, value) => {
    var adjust = (value / 100) * deadband - deadband * 0.5
    this.props.saveHeaterSettings({
      rims: { ...this.props.settings.rims, setpointAdjust: adjust }
    })
  }
  handleHeaterChange = event => {
    this.props.saveHeaterSettings({
      rims: { ...this.props.settings.rims, [event.target.id]: event.target.value }
    })
  }
  handleBoilChange = event => {
    this.props.saveHeaterSettings({
      boil: { ...this.props.settings.boil, [event.target.id]: event.target.value }
    })
  }
  handleThermistorChange = name => event => {
    this.props.saveThermistorSettings({
      temperatures: {
        ...this.props.settings.temperatures,
        [name]: {
          ...this.props.settings.temperatures[name],
          [event.target.id]: isNumber(event.target.value)
            ? numeral(event.target.value).value()
            : event.target.id === 'useSetpointAdjust'
            ? event.target.checked
            : event.target.value
        }
      }
    })
  }

  handleExpandClick = panel => (event, value) => {
    this.setState({
      [panel]: {
        expanded: value
      }
    })
  }

  render() {
    const { classes, settings, saveSettings } = this.props

    return (
      <div className={classes.root}>
        <Grid container spacing={2} direction='column'>
          <form onSubmit={(e) => {
            e.preventDefault()
            saveSettings(settings)
          }}>
            <Grid item xs>
              <Card>
                <List
                  subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Temperatures</ListSubheader>}
                >
                  <Divider/>
                  <ListItem divider>
                    <ListItemText className={classes.listItemText} primary='Log Temperatures' />
                    <Switch
                      name='logTemperatures'
                      checked={get(settings, 'temperatures.logTemperatures', false)}
                      onChange={this.handleTempChange}
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemText className={classes.listItemText} primary='Mash Temperature Interval' />
                    <FormControl className={classes.formControl}>
                      <Intervals
                        {...this.props}
                        name='mashTempInterval'
                        id='mash-temp-interval'
                        interval={settings.temperatures.mashTempInterval || ''}
                        handleChange={this.handleTempChange}
                      />
                    </FormControl>
                  </ListItem>
                  <ListItem divider>
                    <ListItemText className={classes.listItemText} primary='Boil Temperature Interval' />
                    <FormControl className={classes.formControl}>
                      <Intervals
                        {...this.props}
                        name='boilTempInterval'
                        id='boil-temp-interval'
                        interval={settings.temperatures.boilTempInterval}
                        handleChange={this.handleTempChange}
                      />
                    </FormControl>
                  </ListItem>
                  {['thermistor1', 'thermistor2', 'thermistor3'].map((t,i) =>
                    <ThermistorCalibartionListItem
                      key={i}
                      id={t}
                      expanded={this.state[t].expanded}
                      index={i}
                      classes={classes}
                      temperatures={settings.temperatures}
                      handleExpandClick={this.handleExpandClick}
                      handleThermistorChange={this.handleThermistorChange}
                    />
                  )}
                </List>
              </Card>
            </Grid>
            <Grid item xs>
              <Card className={classes.card}>
                <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>RIMS</ListSubheader>}>
                  <Divider/>
                  <ListItem divider>
                    <ListItemText className={classes.listItemText} primary='Proportional' />
                    <TextField
                      id='proportional'
                      value={settings.rims.proportional === null ? 0 : settings.rims.proportional}
                      onChange={this.handleHeaterChange}
                      type='number'
                      className={classnames(classes.numberField, classes.field)}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      margin='normal'
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemText className={classes.listItemText} primary='Integral' />
                    <TextField
                      id='integral'
                      value={settings.rims.integral === null ? 0 : settings.rims.integral}
                      onChange={this.handleHeaterChange}
                      type='number'
                      className={classnames(classes.numberField, classes.field)}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      margin='normal'
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemText className={classes.listItemText} primary='Derivative' />
                    <TextField
                      id='derivative'
                      value={settings.rims.derivative === null ? 0 : settings.rims.derivative}
                      onChange={this.handleHeaterChange}
                      type='number'
                      className={classnames(classes.numberField, classes.field)}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      margin='normal'
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText className={classes.listItemText} primary='Max Output' />
                    <TextField
                      id='maxOutput'
                      value={settings.rims.maxOutput === null ? 0 : settings.rims.maxOutput}
                      onChange={this.handleHeaterChange}
                      type='number'
                      className={classnames(classes.numberField, classes.field)}
                      InputProps={{
                        endAdornment: <InputAdornment position='start'>%</InputAdornment>,
                      }}
                    />
                  </ListItem>
                  <Divider/>
                  <ListItem>
                    <Typography variant='subtitle1' id='label'>Setpoint Adjustment</Typography>
                    <Slider
                      id='setpointAdjust'
                      value={((settings.rims.setpointAdjust + deadband * 0.5) / deadband) * 100}
                      aria-labelledby='label'
                      onChange={this.handleSliderChange}
                    />
                    <Typography variant='subtitle1' id='label' style={{ width: 100, paddingLeft: 20 }}>
                      {`${numeral(settings.rims.setpointAdjust).format('0.0')} Δ°F`}
                    </Typography>
                  </ListItem>
                </List>
              </Card>
            </Grid>
            <Grid item xs>
              <Card className={classes.card}>
                <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Boil</ListSubheader>}>
                  <Divider/>
                  <ListItem>
                    <ListItemText className={classes.listItemText} primary='Setpoint' />
                    <TextField
                      id='setpoint'
                      value={settings.boil.setpoint === null ? 0 : settings.boil.setpoint}
                      onChange={this.handleBoilChange}
                      type='number'
                      className={classnames(classes.numberField, classes.field)}
                      InputProps={{
                        endAdornment: <InputAdornment position='start'>%</InputAdornment>,
                      }}
                    />
                  </ListItem>
                </List>
              </Card>
            </Grid>
            <Grid item xs>
              <Fab
                type='submit'
                variant='extended'
                aria-label='save'
                className={classes.fab}
                onClick={() => saveSettings(settings)}
              >
                <SaveIcon className={classes.extendedIcon} />
                Save
              </Fab>
            </Grid>
          </form>
        </Grid>
      </div>
    )
  }
}

Settings.propTypes = {
  classes: PropTypes.object.isRequired,
}

const mapStateToProps = (state) => ({
  settings: state.settings
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {
  saveSettings, saveTempSettings, saveHeaterSettings, saveThermistorSettings
})(Settings))
