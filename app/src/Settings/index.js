import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core/styles'
import classnames from 'classnames'
import green from '@material-ui/core/colors/green'
import Button from '@material-ui/core/Button'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import Collapse from '@material-ui/core/Collapse'
import Divider from '@material-ui/core/Divider'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import FormControl from '@material-ui/core/FormControl'
import Grid from '@material-ui/core/Grid'
import IconButton from '@material-ui/core/IconButton'
import InputAdornment from '@material-ui/core/InputAdornment'
import InputLabel from '@material-ui/core/InputLabel'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import MenuItem from '@material-ui/core/MenuItem'
import SaveIcon from '@material-ui/icons/Save'
import Select from '@material-ui/core/Select'
import Slider from '@material-ui/lab/Slider'
import Switch from '@material-ui/core/Switch'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'

import _ from 'lodash'
import url from 'url'
import axios from 'axios'
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
    bottom: theme.spacing.unit * 2,
    right: theme.spacing.unit * 2,
  },
  formControl: {
    margin: theme.spacing.unit,
    minWidth: 120,
  },
  field: {
    marginTop: theme.spacing.unit,
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
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
    marginRight: theme.spacing.unit,
  }
})

const urlObj = url.parse(window.location.href)
const serverPort = process.env.REACT_APP_SERVER_PORT
const qualUrl = `${urlObj.protocol}//${urlObj.hostname}${serverPort ? ':' + serverPort : ''}`

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
        <Typography variant='subheading'>{`Thermistor ${props.index + 1}`}</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails>
        <Card className={props.classes.listItemText} elevation={5}>
          <List subheader={<ListSubheader component='div'>Calibration</ListSubheader>}>
            <ListItem>
              <Grid container spacing={24}>
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
              <Grid container spacing={24}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    id='name'
                    label='Thermistor Name'
                    name={props.id}
                    className={props.classes.textField}
                    value={props.temperatures[props.id].name || ''}
                    onChange={props.handleThermistorChange(props.id)}
                    margin='normal'
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
      value={props.temperatures[props.thermistorId][thermistorSettings[props.index].id]}
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

const deadband = 100

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
    var value = event.target.name === 'logTemperatures' ? !this.state.temperatures.logTemperatures : event.target.value
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
      rims: { ...this.props.settings.rims, [event.target.id]: numeral(event.target.value).value() }
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
          [event.target.id]: _.isNumber(event.target.value) ? numeral(event.target.value).value() : event.target.value
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
    const { theme, classes, settings, saveSettings, saveTempSettings, saveHeaterSettings, saveThermistorSettings } = this.props
    const { thermistor1, thermistor2, thermistor3 } = this.state

    return (
      <div className={classes.root}>
        <Grid container spacing={24} direction='column'>
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
                    checked={settings.temperatures.logTemperatures}
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
                      interval={settings.temperatures.mashTempInterval}
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
                    value={settings.rims.proportional}
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
                    value={settings.rims.integral}
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
                    value={settings.rims.derivative}
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
                    value={settings.rims.maxOutput}
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
                  <Typography variant='subheading' id='label'>Setpoint Adjustment</Typography>
                  <Slider
                    id='setpointAdjust'
                    value={((settings.rims.setpointAdjust + deadband * 0.5) / deadband) * 100}
                    aria-labelledby='label'
                    onChange={this.handleSliderChange}
                  />
                  <Typography variant='subheading' id='label' style={{ width: 100, paddingLeft: 20 }}>
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
                    value={settings.boil.setpoint}
                    onChange={this.handleHeaterChange}
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
            <Button variant='extendedFab' aria-label='save' className={classes.fab} onClick={() => saveSettings(settings)}>
              <SaveIcon className={classes.extendedIcon} />
              Save
            </Button>
          </Grid>
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
